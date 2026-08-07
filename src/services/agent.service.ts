import { AgentConfidence, MoveType, Prisma, RegionType } from "@prisma/client";
import { callAgentTool } from "../agent/mcpClient";
import { runEstimateAgent } from "../agent/orchestrator";
import agentRepository from "../repositories/agent.repository";
import { CreateFeedbackInput, GetRegionalPricingOutput, SearchPastQuotesOutput } from "../types/agent.type";
import { CustomError } from "../utils/customError";

type PreviewToolsInput = {
  moveType: MoveType;
  fromRegion: RegionType;
  toRegion: RegionType;
  moveDate: string;
};

// Day1 스캐폴딩: MCP 클라이언트 → MCP 서버(In-Memory Transport) 경로로 실제 도구 호출이
// 되는지 확인하기 위한 미리보기. 실제 견적 흐름은 아래 estimate()가 담당한다 (PLAN.md 5장).
async function previewTools(input: PreviewToolsInput) {
  const { moveType, fromRegion, toRegion, moveDate } = input;

  const pastQuotes = await callAgentTool<SearchPastQuotesOutput>("search_past_quotes", {
    moveType,
    fromRegion,
    toRegion
  });

  const regionalPricing = await callAgentTool<GetRegionalPricingOutput>("get_regional_pricing", {
    fromRegion,
    toRegion,
    moveDate
  });

  return { pastQuotes, regionalPricing };
}

type EstimateInput = {
  moveType: MoveType;
  fromRegion: RegionType;
  toRegion: RegionType;
  moveDate: string;
  itemVolume: number;
};

// estimate_price가 반환하는 "low"|"medium"|"high"를 Prisma의 AgentConfidence enum으로 변환
function toAgentConfidence(confidence: string): AgentConfidence {
  return confidence.toUpperCase() as AgentConfidence;
}

const FEEDBACK_MIN_SAMPLE = 2; // 이보다 적으면 우연일 수 있어 컨텍스트에 반영하지 않음
const FEEDBACK_INACCURATE_RATIO_THRESHOLD = 0.5;

// 최근 7일간 동일 조건의 피드백 중 "부정확했다" 비율이 높으면, 다음 추정 시 시스템 프롬프트에
// 넣을 경고 문구를 만든다 — 이게 "룰/피드백이 축적되어 개선되는 구조"의 핵심 구현 포인트 (PLAN.md 5장).
async function buildFeedbackContext(params: {
  moveType: MoveType;
  fromRegion: RegionType;
  toRegion: RegionType;
}): Promise<string | undefined> {
  const { total, inaccurateCount } = await agentRepository.getRecentFeedbackStats(params);

  if (total < FEEDBACK_MIN_SAMPLE) return undefined;

  const inaccurateRatio = inaccurateCount / total;
  if (inaccurateRatio <= FEEDBACK_INACCURATE_RATIO_THRESHOLD) return undefined;

  return `[최근 피드백 주의] 지난 7일간 ${params.moveType} ${params.fromRegion}->${params.toRegion} 조건의 추정 ${total}건 중 ${inaccurateCount}건이 "실제 견적과 달랐다"는 피드백을 받았습니다. 이번 추정은 범위를 평소보다 넓게 잡아 신중하게 산출하세요.`;
}

// Gemini가 4개 MCP 도구를 스스로 판단해 호출하는 오케스트레이션을 실행하고,
// 결과와 단계별 로그를 AgentEstimate/AgentLog로 영속화한다.
async function estimate(input: EstimateInput) {
  const feedbackContext = await buildFeedbackContext(input);
  const orchestration = await runEstimateAgent({ ...input, feedbackContext });

  const saved = await agentRepository.createAgentEstimateWithLogs({
    moveType: input.moveType,
    fromRegion: input.fromRegion,
    toRegion: input.toRegion,
    moveDate: new Date(input.moveDate),
    itemVolume: input.itemVolume,
    estimatedMin: orchestration.estimatedMin,
    estimatedMax: orchestration.estimatedMax,
    confidence: toAgentConfidence(orchestration.confidence),
    reasoning: orchestration.reasoning,
    logs: orchestration.steps.map((step) => ({
      step: step.step,
      toolName: step.toolName,
      toolInput: step.toolInput as Prisma.InputJsonValue,
      toolOutput: step.toolOutput as Prisma.InputJsonValue,
      reasoning: step.reasoning
    }))
  });

  return { ...saved, usedFallback: orchestration.usedFallback };
}

// 사용자가 남긴 "실제 견적과 비교했을 때 정확했나요?" 피드백을 저장한다.
async function submitFeedback(input: CreateFeedbackInput) {
  const target = await agentRepository.findAgentEstimateById(input.agentEstimateId);
  if (!target) {
    throw new CustomError(404, "해당 견적 추정 요청을 찾을 수 없습니다.");
  }

  try {
    return await agentRepository.createAgentEstimateFeedback(input);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new CustomError(409, "이미 피드백을 남긴 요청입니다.");
    }
    throw error;
  }
}

const DEFAULT_LOGS_LIMIT = 20;

// 관찰 대시보드용 — 최근 에이전트 실행(견적 추정) 목록
async function listRecentEstimates(limit: number = DEFAULT_LOGS_LIMIT) {
  return agentRepository.listRecentAgentEstimates(limit);
}

// 관찰 대시보드용 — 특정 실행의 전체 단계별 타임라인
async function getEstimateDetail(agentEstimateId: string) {
  const detail = await agentRepository.findAgentEstimateWithLogsById(agentEstimateId);
  if (!detail) {
    throw new CustomError(404, "해당 견적 추정 요청을 찾을 수 없습니다.");
  }
  return detail;
}

export default { previewTools, estimate, submitFeedback, listRecentEstimates, getEstimateDetail };
