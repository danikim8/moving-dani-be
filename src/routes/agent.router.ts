import express from "express";
import agentController from "../controllers/agent.controller";
import { agentEstimatePerDayLimiter, agentEstimatePerMinuteLimiter } from "../middlewares/agentLimiter";

const router = express.Router();

// MCP 도구 연결 확인용 디버깅 엔드포인트
router.post("/tools/preview", agentController.previewTools);

// 견적 추정 요청 (Gemini function-calling 오케스트레이션) — Gemini 무료 티어 보호를 위해 rate limit 적용
router.post("/estimate", agentEstimatePerMinuteLimiter, agentEstimatePerDayLimiter, agentController.estimate);

// 견적 추정 결과 피드백
router.post("/feedback", agentController.submitFeedback);

// 관찰 대시보드
router.get("/logs", agentController.listLogs);
router.get("/logs/:agentEstimateId", agentController.getLogDetail);

export default router;
