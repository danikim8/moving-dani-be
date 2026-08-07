import { Chat, FunctionDeclaration, GoogleGenAI, SendMessageParameters } from "@google/genai";
import { MoveType, RegionType } from "@prisma/client";
import { callAgentTool } from "./mcpClient";
import { EstimateConfidence, EstimatePriceOutput } from "../types/agent.type";

// "gemini-flash-latest"(→gemini-3.6-flash)는 무료 티어가 RPM 5 / RPD 20으로 매우 빡빡해서
// (한 번의 /agent/estimate 호출이 내부적으로 Gemini를 2~3회 호출하므로 하루 6~7건이면 소진됨),
// 대신 무료 한도가 훨씬 넉넉한 "gemini-flash-lite-latest" 별칭을 사용한다.
const MODEL = "gemini-flash-lite-latest";
const MAX_TOOL_LOOPS = 5;
// Gemini 호출 1회(정상 응답 기준) 최대 대기 시간. "멈춘 것"과 "느린 것"을 구분하기 위해
// 이 시간을 넘기면 곧바로 폴백하지 않고 한 번 재시도한 뒤, 그래도 넘기면 폴백한다 (아래 sendChatMessage 참고).
const GEMINI_CALL_TIMEOUT_MS = 30_000;
// 개별 호출은 재시도 덕분에 살아남더라도, 스텝이 많아지면 전체 소요 시간이 한없이 늘어질 수 있다.
// 데모/실사용 경험을 위해 전체 오케스트레이션에도 별도 상한선을 둔다.
const OVERALL_DEADLINE_MS = 90_000;

let client: GoogleGenAI | null = null;

// ⚠️ 실측 확인: 이 config(특히 tools)가 어떤 이유로든 호출에서 빠지면, Gemini는 에러를 던지지 않고
// functionCalls 없이 그럴듯하게 지어낸 가격(예: "유류비/인건비 포함 약 30만~40만원")을 자연어로 반환한다 —
// 겉보기엔 정상 응답처럼 보이는 조용한 실패. 다행히 이 경우 estimatePriceOutput이 채워지지 않으므로
// 아래 "estimate_price를 호출하지 않고 종료" 체크에 걸려 폴백으로 넘어가지만, 혹시 이 체크 자체가 깨진다면
// AI가 지어낸 가격이 그대로 사용자에게 나갈 수 있다는 뜻이니 이 함수를 건드릴 땐 특히 주의할 것.
function getSharedConfig(feedbackContext?: string) {
  return {
    systemInstruction: feedbackContext ? `${SYSTEM_INSTRUCTION}\n\n${feedbackContext}` : SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }]
  };
}

// @google/genai의 per-request config는 채팅 세션 레벨 config(tools/systemInstruction)를 상속하지 않으므로,
// abortSignal과 함께 항상 tools/systemInstruction을 명시적으로 다시 넘겨야 한다 (SDK 타입 주석 참고).
async function sendMessageOnce(
  chat: Chat,
  message: SendMessageParameters["message"],
  sharedConfig: ReturnType<typeof getSharedConfig>,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await chat.sendMessage({ message, config: { ...sharedConfig, abortSignal: controller.signal } });
  } finally {
    clearTimeout(timer);
  }
}

// 1차 호출이 타임아웃/실패하면 한 번 재시도한다. 진짜로 멈춘 요청은 재시도해도 다시 타임아웃되어
// 결국 폴백으로 넘어가고, 일시적으로 느렸을 뿐인 요청은 재시도에서 대부분 살아남는다 (reply.md 참고).
// AbortController로 실제 요청을 취소하므로, 재시도해도 먼저 보낸 요청이 뒤늦게 응답을 채팅 히스토리에
// 잘못된 순서로 끼워넣는 문제가 없다.
async function sendChatMessage(
  chat: Chat,
  message: SendMessageParameters["message"],
  sharedConfig: ReturnType<typeof getSharedConfig>
): Promise<{ response: Awaited<ReturnType<Chat["sendMessage"]>>; retried: boolean }> {
  try {
    const response = await sendMessageOnce(chat, message, sharedConfig, GEMINI_CALL_TIMEOUT_MS);
    return { response, retried: false };
  } catch (firstError) {
    console.warn("[agent.orchestrator] Gemini 응답 지연/실패, 1회 재시도:", firstError);
    const response = await sendMessageOnce(chat, message, sharedConfig, GEMINI_CALL_TIMEOUT_MS);
    return { response, retried: true };
  }
}

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY가 설정되어 있지 않습니다.");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "search_past_quotes",
    description: "이사 유형과 출발/도착 지역이 유사한 과거 견적(기사 제안가)을 최대 20건 조회한다.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        moveType: { type: "string", enum: Object.values(MoveType) },
        fromRegion: { type: "string", enum: Object.values(RegionType) },
        toRegion: { type: "string", enum: Object.values(RegionType) }
      },
      required: ["moveType", "fromRegion", "toRegion"]
    }
  },
  {
    name: "get_regional_pricing",
    description: "출발/도착 지역 기본 가중치와 이사 성수기 여부에 따른 시즌 가중치를 계산한다.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        fromRegion: { type: "string", enum: Object.values(RegionType) },
        toRegion: { type: "string", enum: Object.values(RegionType) },
        moveDate: { type: "string", description: "ISO 8601 날짜 문자열 (YYYY-MM-DD)" }
      },
      required: ["fromRegion", "toRegion", "moveDate"]
    }
  },
  {
    name: "estimate_price",
    description:
      "과거 견적과 지역/시즌 가중치를 종합해 예상 견적 범위를 산출한다. search_past_quotes와 get_regional_pricing을 먼저 호출해 그 결과값을 인자로 넘겨야 한다.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        pastPrices: {
          type: "array",
          items: { type: "number" },
          description: "search_past_quotes 결과의 quotes[].price 값들"
        },
        regionalFactor: { type: "number", description: "get_regional_pricing 결과의 regionalFactor" },
        seasonalFactor: { type: "number", description: "get_regional_pricing 결과의 seasonalFactor" },
        itemVolume: { type: "number" }
      },
      required: ["pastPrices", "regionalFactor", "seasonalFactor", "itemVolume"]
    }
  },
  {
    name: "flag_anomaly",
    description: "산출된 견적 범위가 해당 지역 평균 대비 지나치게 벗어났는지 판단한다. estimate_price 이후에 호출한다.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        estimatedMin: { type: "number" },
        estimatedMax: { type: "number" },
        fromRegion: { type: "string", enum: Object.values(RegionType) },
        toRegion: { type: "string", enum: Object.values(RegionType) }
      },
      required: ["estimatedMin", "estimatedMax", "fromRegion", "toRegion"]
    }
  }
];

const SYSTEM_INSTRUCTION = `너는 무빙 서비스의 이사 견적 추정 에이전트야. 아래 4개 도구 중 필요하다고 판단되는 것을 스스로 순서를 정해 호출해서 문제를 해결해:
- search_past_quotes: 과거 유사 견적 조회
- get_regional_pricing: 지역/시즌 가중치 계산
- estimate_price: 최종 가격 범위 산출 (앞의 두 도구 결과가 있어야 정확히 호출 가능)
- flag_anomaly: 산출된 범위의 이상치 여부 검증 (estimate_price 이후에 호출)

중요: 도구를 호출할 때마다, 그 직전에 반드시 "왜 지금 이 도구(들)를 호출하는지"를 한국어 한두 문장으로
짧게 설명하는 텍스트를 함께 출력한 뒤 호출해. 이 설명은 나중에 관찰 로그에 그대로 기록되어 사용자에게
보여지므로, 빈 텍스트 없이 매번 남겨야 해.

도구 호출 순서를 고정하지 말고 상황에 맞게 스스로 판단해. estimate_price와 flag_anomaly까지 모두 호출한 뒤,
최종적으로 추정 최소가/최대가와 그 근거를 한국어 자연어로 간결하게 요약해서 답변해. 절대 도구 결과 없이 숫자를 임의로 만들어내지 마.

형식: 굵게(**), 제목(#), 목록 기호(-, *) 같은 마크다운 문법은 절대 쓰지 말고, 순수 텍스트와 줄바꿈만으로 답변해.
이 텍스트는 마크다운 렌더링이 안 되는 화면에 그대로 노출돼.`;

export type OrchestrationStep = {
  step: number;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolOutput: unknown;
  reasoning: string;
};

export type OrchestrationInput = {
  moveType: MoveType;
  fromRegion: RegionType;
  toRegion: RegionType;
  moveDate: string;
  itemVolume: number;
  feedbackContext?: string;
};

export type OrchestrationResult = {
  estimatedMin: number;
  estimatedMax: number;
  confidence: EstimateConfidence;
  reasoning: string;
  steps: OrchestrationStep[];
  usedFallback: boolean;
};

function extractResponseText(response: { text?: string }): string {
  return (response.text ?? "").trim();
}

// Gemini 없이(또는 Gemini가 루프 내에 estimate_price까지 도달하지 못했을 때) 도구 3개를
// 고정 순서로 직접 호출하는 결정론적 폴백 — PLAN.md 5장 "실패 시 기본 응답" 요구사항.
async function runFallbackChain(input: OrchestrationInput, startStep: number): Promise<OrchestrationResult> {
  const steps: OrchestrationStep[] = [];
  let step = startStep;

  const past = await callAgentTool<{ quotes: { price: number }[]; sampleSize: number }>("search_past_quotes", {
    moveType: input.moveType,
    fromRegion: input.fromRegion,
    toRegion: input.toRegion
  });
  steps.push({
    step: step++,
    toolName: "search_past_quotes",
    toolInput: past.request.arguments,
    toolOutput: past.result,
    reasoning: "폴백: Gemini 응답 없이 고정 순서로 과거 견적을 조회함"
  });

  const pricing = await callAgentTool<{ regionalFactor: number; seasonalFactor: number; note: string }>(
    "get_regional_pricing",
    { fromRegion: input.fromRegion, toRegion: input.toRegion, moveDate: input.moveDate }
  );
  steps.push({
    step: step++,
    toolName: "get_regional_pricing",
    toolInput: pricing.request.arguments,
    toolOutput: pricing.result,
    reasoning: "폴백: Gemini 응답 없이 고정 순서로 지역/시즌 가중치를 계산함"
  });

  const priceResult = await callAgentTool<EstimatePriceOutput>("estimate_price", {
    pastPrices: past.result.quotes.map((q) => q.price),
    regionalFactor: pricing.result.regionalFactor,
    seasonalFactor: pricing.result.seasonalFactor,
    itemVolume: input.itemVolume
  });
  steps.push({
    step: step++,
    toolName: "estimate_price",
    toolInput: priceResult.request.arguments,
    toolOutput: priceResult.result,
    reasoning: "폴백: Gemini 응답 없이 과거 견적과 가중치를 종합해 범위를 산출함"
  });

  const anomaly = await callAgentTool<{ isAnomaly: boolean; message: string | null }>("flag_anomaly", {
    estimatedMin: priceResult.result.min,
    estimatedMax: priceResult.result.max,
    fromRegion: input.fromRegion,
    toRegion: input.toRegion
  });
  steps.push({
    step: step++,
    toolName: "flag_anomaly",
    toolInput: anomaly.request.arguments,
    toolOutput: anomaly.result,
    reasoning: "폴백: Gemini 응답 없이 이상치 여부를 검증함"
  });

  const reasoning = `[자동 폴백] 표본 ${past.result.sampleSize}건을 기반으로 ${priceResult.result.min.toLocaleString()}~${priceResult.result.max.toLocaleString()}원으로 추정했습니다.${
    anomaly.result.message ? ` ${anomaly.result.message}` : ""
  }`;

  return {
    estimatedMin: priceResult.result.min,
    estimatedMax: priceResult.result.max,
    confidence: priceResult.result.confidence,
    reasoning,
    steps,
    usedFallback: true
  };
}

export async function runEstimateAgent(input: OrchestrationInput): Promise<OrchestrationResult> {
  const steps: OrchestrationStep[] = [];
  let estimatePriceOutput: EstimatePriceOutput | undefined;
  const startedAt = Date.now();

  try {
    const ai = getClient();
    const sharedConfig = getSharedConfig(input.feedbackContext);
    const chat = ai.chats.create({ model: MODEL, config: sharedConfig });

    const userPrompt = `이사 조건 — 유형: ${input.moveType}, 출발지역: ${input.fromRegion}, 도착지역: ${input.toRegion}, 이사일: ${input.moveDate}, 짐 양(박스 수): ${input.itemVolume}. 이 조건의 예상 견적을 추정해줘.`;

    let { response, retried } = await sendChatMessage(chat, userPrompt, sharedConfig);

    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      if (Date.now() - startedAt > OVERALL_DEADLINE_MS) {
        throw new Error(`전체 처리 시간이 ${OVERALL_DEADLINE_MS / 1000}초를 초과했습니다.`);
      }

      const calls = response.functionCalls;
      if (!calls || calls.length === 0) break;

      const retryNote = retried ? " (1회 재시도 후 응답)" : "";
      const turnReasoning =
        (extractResponseText(response) || `에이전트가 ${calls.map((c) => c.name).join(", ")} 호출을 판단함`) + retryNote;
      const responseParts: { functionResponse: { name: string; response: Record<string, unknown> } }[] = [];

      for (const call of calls) {
        const toolName = call.name;
        if (!toolName) continue;
        const args = call.args ?? {};

        const { result } = await callAgentTool(toolName, args);
        if (toolName === "estimate_price") {
          estimatePriceOutput = result as EstimatePriceOutput;
        }

        steps.push({
          step: steps.length + 1,
          toolName,
          toolInput: args,
          toolOutput: result,
          reasoning: turnReasoning
        });
        responseParts.push({ functionResponse: { name: toolName, response: { output: result } } });
      }

      ({ response, retried } = await sendChatMessage(chat, responseParts, sharedConfig));
    }

    if (!estimatePriceOutput) {
      throw new Error("에이전트가 estimate_price를 호출하지 않고 종료했습니다.");
    }

    const finalText = extractResponseText(response);

    return {
      estimatedMin: estimatePriceOutput.min,
      estimatedMax: estimatePriceOutput.max,
      confidence: estimatePriceOutput.confidence,
      reasoning: finalText || `${estimatePriceOutput.min.toLocaleString()}~${estimatePriceOutput.max.toLocaleString()}원으로 추정됩니다.`,
      steps,
      usedFallback: false
    };
  } catch (error) {
    console.error("[agent.orchestrator] Gemini 오케스트레이션 실패, 폴백 체인으로 전환:", error);
    return runFallbackChain(input, steps.length + 1);
  }
}
