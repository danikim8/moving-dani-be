import rateLimit, { RateLimitExceededEventHandler, RateLimitRequestHandler } from "express-rate-limit";

// Gemini 무료 티어 보호용 안전장치. 실측 결과 gemini-flash-lite-latest 기준으로도
// 요청 1건(POST /agent/estimate)당 내부적으로 Gemini를 2~3회 호출하므로 보수적으로 잡는다.
// (gemini-3.6-flash 자체는 RPM 5 / RPD 20 밖에 안 돼서 Lite로 전환했음 — agent/orchestrator.ts 참고)

const rateLimitHandler: RateLimitExceededEventHandler = (_req, res, _next, options) => {
  res.status(typeof options.statusCode === "number" ? options.statusCode : 429).json(options.message);
};

const agentEstimatePerMinuteLimiter: RateLimitRequestHandler = rateLimit({
  limit: 3,
  windowMs: 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "요청이 너무 잦습니다. 1분 후 다시 시도해주세요." },
  handler: rateLimitHandler
});

const agentEstimatePerDayLimiter: RateLimitRequestHandler = rateLimit({
  limit: 60,
  windowMs: 24 * 60 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "오늘의 견적 추정 요청 한도를 모두 사용했습니다. 내일 다시 시도해주세요." },
  handler: rateLimitHandler
});

export { agentEstimatePerMinuteLimiter, agentEstimatePerDayLimiter };
