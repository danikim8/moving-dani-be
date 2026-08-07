import { Request, Response } from "express";
import { MoveType, RegionType } from "@prisma/client";
import agentService from "../services/agent.service";
import { asyncHandler } from "../utils/asyncHandler";
import { CustomError } from "../utils/customError";

// Day1 스캐폴딩용 도구 확인 엔드포인트 (MCP 연결 디버깅용으로 유지, PLAN.md 6장).
const previewTools = asyncHandler(async (req: Request, res: Response) => {
  const { moveType, fromRegion, toRegion, moveDate } = req.body;

  if (!moveType || !fromRegion || !toRegion || !moveDate) {
    throw new CustomError(400, "moveType, fromRegion, toRegion, moveDate는 필수입니다.");
  }
  if (!(moveType in MoveType)) {
    throw new CustomError(400, "유효하지 않은 moveType입니다.");
  }
  if (!(fromRegion in RegionType) || !(toRegion in RegionType)) {
    throw new CustomError(400, "유효하지 않은 지역 값입니다.");
  }

  const result = await agentService.previewTools({ moveType, fromRegion, toRegion, moveDate });
  res.status(200).json(result);
});

// 견적 추정 요청 — Gemini 오케스트레이션 실행 후 AgentEstimate/AgentLog 저장
const estimate = asyncHandler(async (req: Request, res: Response) => {
  const { moveType, fromRegion, toRegion, moveDate, itemVolume } = req.body;

  if (!moveType || !fromRegion || !toRegion || !moveDate || itemVolume === undefined) {
    throw new CustomError(400, "moveType, fromRegion, toRegion, moveDate, itemVolume는 필수입니다.");
  }
  if (!(moveType in MoveType)) {
    throw new CustomError(400, "유효하지 않은 moveType입니다.");
  }
  if (!(fromRegion in RegionType) || !(toRegion in RegionType)) {
    throw new CustomError(400, "유효하지 않은 지역 값입니다.");
  }

  const itemVolumeNum = Number(itemVolume);
  if (!Number.isFinite(itemVolumeNum) || itemVolumeNum <= 0) {
    throw new CustomError(400, "itemVolume은 0보다 큰 숫자여야 합니다.");
  }

  const result = await agentService.estimate({
    moveType,
    fromRegion,
    toRegion,
    moveDate,
    itemVolume: itemVolumeNum
  });
  res.status(201).json(result);
});

// 견적 추정 결과에 대한 사용자 피드백 저장
const submitFeedback = asyncHandler(async (req: Request, res: Response) => {
  const { agentEstimateId, actualPrice, wasAccurate } = req.body;

  if (!agentEstimateId || typeof wasAccurate !== "boolean") {
    throw new CustomError(400, "agentEstimateId, wasAccurate는 필수입니다.");
  }

  let actualPriceNum: number | undefined;
  if (actualPrice !== undefined && actualPrice !== null) {
    actualPriceNum = Number(actualPrice);
    if (!Number.isFinite(actualPriceNum) || actualPriceNum < 0) {
      throw new CustomError(400, "actualPrice는 0 이상의 숫자여야 합니다.");
    }
  }

  const result = await agentService.submitFeedback({ agentEstimateId, actualPrice: actualPriceNum, wasAccurate });
  res.status(201).json(result);
});

// 관찰 대시보드 — 최근 에이전트 실행 목록
const listLogs = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const result = await agentService.listRecentEstimates(limit);
  res.status(200).json(result);
});

// 관찰 대시보드 — 특정 실행의 전체 타임라인
const getLogDetail = asyncHandler(async (req: Request, res: Response) => {
  const { agentEstimateId } = req.params;
  const result = await agentService.getEstimateDetail(agentEstimateId);
  res.status(200).json(result);
});

export default { previewTools, estimate, submitFeedback, listLogs, getLogDetail };
