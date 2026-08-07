import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MoveType, RegionType } from "@prisma/client";
import { searchPastQuotes } from "./tools/searchPastQuotes";
import { getRegionalPricing } from "./tools/getRegionalPricing";
import { estimatePrice } from "./tools/estimatePrice";
import { flagAnomaly } from "./tools/flagAnomaly";

const moveTypeSchema = z.nativeEnum(MoveType);
const regionSchema = z.nativeEnum(RegionType);

// 견적 추정 에이전트가 사용하는 도구 4종을 등록한 MCP 서버를 생성한다.
// PLAN.md 4장 참고. Day1: search_past_quotes / get_regional_pricing만 실동작, 나머지는 Day2 구현 예정.
export function createAgentMcpServer() {
  const server = new McpServer({ name: "moving-estimate-agent", version: "1.0.0" });

  server.registerTool(
    "search_past_quotes",
    {
      title: "과거 유사 견적 조회",
      description: "이사 유형과 출발/도착 지역이 유사한 과거 견적(기사 제안가)을 최대 20건 조회한다.",
      inputSchema: {
        moveType: moveTypeSchema,
        fromRegion: regionSchema,
        toRegion: regionSchema
      }
    },
    async (args) => {
      const result = await searchPastQuotes(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }], structuredContent: result };
    }
  );

  server.registerTool(
    "get_regional_pricing",
    {
      title: "지역/시즌 가중치 계산",
      description: "출발/도착 지역 기본 가중치와 이사 성수기 여부에 따른 시즌 가중치를 계산한다.",
      inputSchema: {
        fromRegion: regionSchema,
        toRegion: regionSchema,
        moveDate: z.string()
      }
    },
    async (args) => {
      const result = await getRegionalPricing(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }], structuredContent: result };
    }
  );

  server.registerTool(
    "estimate_price",
    {
      title: "최종 가격 범위 산출",
      description: "과거 견적과 지역/시즌 가중치를 종합해 예상 견적 범위를 산출한다.",
      inputSchema: {
        pastPrices: z.array(z.number()),
        regionalFactor: z.number(),
        seasonalFactor: z.number(),
        itemVolume: z.number()
      }
    },
    async (args) => {
      const result = await estimatePrice(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }], structuredContent: result };
    }
  );

  server.registerTool(
    "flag_anomaly",
    {
      title: "이상치 탐지",
      description: "산출된 견적 범위가 해당 지역 평균 대비 지나치게 벗어났는지 판단한다.",
      inputSchema: {
        estimatedMin: z.number(),
        estimatedMax: z.number(),
        fromRegion: regionSchema,
        toRegion: regionSchema
      }
    },
    async (args) => {
      const result = await flagAnomaly(args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }], structuredContent: result };
    }
  );

  return server;
}
