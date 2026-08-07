import dayjs from "dayjs";
import prisma from "../config/prisma";
import { AgentConfidence, MoveType, Prisma, RegionType } from "@prisma/client";

export type CreateAgentEstimateInput = {
  moveType: MoveType;
  fromRegion: RegionType;
  toRegion: RegionType;
  moveDate: Date;
  itemVolume: number;
  estimatedMin: number;
  estimatedMax: number;
  confidence: AgentConfidence;
  reasoning: string;
  logs: {
    step: number;
    toolName: string;
    toolInput: Prisma.InputJsonValue;
    toolOutput: Prisma.InputJsonValue;
    reasoning: string;
  }[];
};

async function createAgentEstimateWithLogs(data: CreateAgentEstimateInput) {
  const { logs, ...estimateData } = data;
  return prisma.agentEstimate.create({
    data: {
      ...estimateData,
      logs: { create: logs }
    },
    include: { logs: { orderBy: { step: "asc" } } }
  });
}

async function findAgentEstimateById(id: string) {
  return prisma.agentEstimate.findUnique({ where: { id } });
}

async function findAgentEstimateWithLogsById(id: string) {
  return prisma.agentEstimate.findUnique({
    where: { id },
    include: { logs: { orderBy: { step: "asc" } }, feedback: true }
  });
}

async function listRecentAgentEstimates(limit: number) {
  return prisma.agentEstimate.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { feedback: true, _count: { select: { logs: true } } }
  });
}

type CreateAgentEstimateFeedbackInput = {
  agentEstimateId: string;
  actualPrice?: number;
  wasAccurate: boolean;
};

async function createAgentEstimateFeedback(data: CreateAgentEstimateFeedbackInput) {
  return prisma.agentEstimateFeedback.create({ data });
}

const RECENT_FEEDBACK_WINDOW_DAYS = 7;

// 최근 7일간 동일 조건(moveType/fromRegion/toRegion) 추정에 대한 피드백 중
// "부정확했다"는 응답 비율을 계산 — 시스템 프롬프트에 반영할 컨텍스트를 만들기 위함 (PLAN.md 5장)
async function getRecentFeedbackStats(params: { moveType: MoveType; fromRegion: RegionType; toRegion: RegionType }) {
  const since = dayjs().subtract(RECENT_FEEDBACK_WINDOW_DAYS, "day").toDate();

  const feedbacks = await prisma.agentEstimateFeedback.findMany({
    where: {
      createdAt: { gte: since },
      agentEstimate: {
        moveType: params.moveType,
        fromRegion: params.fromRegion,
        toRegion: params.toRegion
      }
    },
    select: { wasAccurate: true }
  });

  const total = feedbacks.length;
  const inaccurateCount = feedbacks.filter((f) => !f.wasAccurate).length;

  return { total, inaccurateCount };
}

export default {
  createAgentEstimateWithLogs,
  findAgentEstimateById,
  findAgentEstimateWithLogsById,
  listRecentAgentEstimates,
  createAgentEstimateFeedback,
  getRecentFeedbackStats
};
