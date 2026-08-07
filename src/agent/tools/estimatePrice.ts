import { EstimateConfidence, EstimatePriceInput, EstimatePriceOutput } from "../../types/agent.type";

// 과거 데이터가 아예 없을 때 쓰는 기준 단가(원/박스) — 실제 데이터가 쌓이면 조정 가능한 초기 추정치
const BASE_PRICE_PER_VOLUME = 40000;
const BASELINE_ITEM_VOLUME = 5;
// itemVolume이 극단적으로 크거나 작을 때 추정이 과하게 왜곡되지 않도록 배율 상한/하한을 둠
const MIN_VOLUME_FACTOR = 0.7;
const MAX_VOLUME_FACTOR = 1.6;
// 과거 데이터가 1건뿐이면 표준편차가 0이 되므로, 평균의 일정 비율을 최소 변동폭으로 사용
const MIN_STD_RATIO = 0.15;
const MIN_SPREAD_RATIO = 0.05;

function computeStats(prices: number[]) {
  const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const variance = prices.reduce((sum, price) => sum + (price - mean) ** 2, 0) / prices.length;
  return { mean, std: Math.sqrt(variance) };
}

function resolveConfidence(sampleSize: number): EstimateConfidence {
  if (sampleSize >= 10) return "high";
  if (sampleSize >= 3) return "medium";
  return "low";
}

// 과거 견적 평균/표준편차에 지역·시즌 가중치를 곱해 최종 견적 범위를 산출 (PLAN.md 4.3)
export async function estimatePrice(input: EstimatePriceInput): Promise<EstimatePriceOutput> {
  const { pastPrices, regionalFactor, seasonalFactor, itemVolume } = input;
  const weight = regionalFactor * seasonalFactor;
  const volumeFactor = Math.min(MAX_VOLUME_FACTOR, Math.max(MIN_VOLUME_FACTOR, itemVolume / BASELINE_ITEM_VOLUME));

  if (pastPrices.length === 0) {
    const base = BASE_PRICE_PER_VOLUME * itemVolume * weight;
    return {
      min: Math.round(base * 0.7),
      max: Math.round(base * 1.3),
      confidence: "low"
    };
  }

  const { mean, std } = computeStats(pastPrices);
  const effectiveStd = pastPrices.length === 1 ? mean * MIN_STD_RATIO : std;
  const adjustedMean = mean * weight * volumeFactor;
  const spread = Math.max(effectiveStd * weight, adjustedMean * MIN_SPREAD_RATIO);

  return {
    min: Math.max(0, Math.round(adjustedMean - spread)),
    max: Math.round(adjustedMean + spread),
    confidence: resolveConfidence(pastPrices.length)
  };
}
