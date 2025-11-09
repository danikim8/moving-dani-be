import type { Request, Response, NextFunction } from "express";

// Redis 제거됨 - 캐시 기능 비활성화
// 향후 필요시 다른 캐싱 솔루션으로 교체 가능

// 빈 미들웨어 - 캐시 없이 바로 통과
export const cacheMiddleware = (ttl = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Redis 제거로 인해 캐싱 비활성화, 요청을 바로 통과시킴
      next();
  };
};

// 캐시 무효화 함수들 - Redis 제거로 인해 빈 함수로 변경
export const invalidateByExact = (key: string) => {
  // Redis 제거됨
  return;
};

export const invalidateByPrefix = async (prefix: string) => {
  // Redis 제거됨
  return 0;
};
