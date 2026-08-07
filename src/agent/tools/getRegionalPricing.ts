import { RegionType } from "@prisma/client";
import dayjs from "dayjs";
import { GetRegionalPricingInput, GetRegionalPricingOutput } from "../../types/agent.type";

// 지역별 기본 가중치 (초기엔 하드코딩, 이후 실제 데이터 기반으로 조정 가능 — PLAN.md 4.2 참고)
// 수도권/광역시는 수요가 많아 소폭 高가, 도서 지역(제주)은 운송비 특성상 高가
const REGIONAL_BASE_FACTOR: Record<RegionType, number> = {
  SEOUL: 1.15,
  GYEONGGI: 1.05,
  INCHEON: 1.05,
  BUSAN: 1.0,
  DAEGU: 0.95,
  DAEJEON: 0.95,
  GWANGJU: 0.95,
  ULSAN: 0.95,
  SEJONG: 0.9,
  GANGWON: 0.9,
  CHUNGBUK: 0.9,
  CHUNGNAM: 0.9,
  JEONBUK: 0.9,
  JEONNAM: 0.9,
  GYEONGBUK: 0.9,
  GYEONGNAM: 0.9,
  JEJU: 1.2
};

// 이사 성수기(3월, 11월) 가중치
const SEASONAL_MONTH_FACTOR: Record<number, number> = {
  3: 1.2,
  11: 1.15
};
const DEFAULT_SEASONAL_FACTOR = 1.0;
const CROSS_REGION_SURCHARGE = 0.05; // 출발/도착 지역이 다르면(장거리) 소폭 가산

export async function getRegionalPricing(input: GetRegionalPricingInput): Promise<GetRegionalPricingOutput> {
  const { fromRegion, toRegion, moveDate } = input;

  const fromFactor = REGIONAL_BASE_FACTOR[fromRegion];
  const toFactor = REGIONAL_BASE_FACTOR[toRegion];
  const isCrossRegion = fromRegion !== toRegion;

  const regionalFactor = (fromFactor + toFactor) / 2 + (isCrossRegion ? CROSS_REGION_SURCHARGE : 0);

  const month = dayjs(moveDate).month() + 1;
  const seasonalFactor = SEASONAL_MONTH_FACTOR[month] ?? DEFAULT_SEASONAL_FACTOR;
  const isPeakSeason = Boolean(SEASONAL_MONTH_FACTOR[month]);

  const note = `${fromRegion}->${toRegion} 지역 가중치 ${regionalFactor.toFixed(2)}, ${month}월 시즌 가중치 ${seasonalFactor.toFixed(
    2
  )} (${isPeakSeason ? "성수기" : "비수기"})`;

  return { regionalFactor, seasonalFactor, note };
}
