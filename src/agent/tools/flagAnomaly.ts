import prisma from "../../config/prisma";
import { FlagAnomalyInput, FlagAnomalyOutput } from "../../types/agent.type";

const MAX_REQUESTS = 50;
const MIN_SAMPLE_FOR_COMPARISON = 3;
const ANOMALY_DEVIATION_RATIO = 0.5; // 지역 평균 대비 50% 이상 벗어나면 이상치로 판단

// 산출된 견적 범위가 해당 지역(출발/도착) 평균 대비 지나치게 벗어났는지 체크 (PLAN.md 4.4)
export async function flagAnomaly(input: FlagAnomalyInput): Promise<FlagAnomalyOutput> {
  const { estimatedMin, estimatedMax, fromRegion, toRegion } = input;

  const requests = await prisma.estimateRequest.findMany({
    where: {
      deletedAt: null,
      fromAddress: { region: fromRegion },
      toAddress: { region: toRegion }
    },
    include: {
      estimates: { where: { deletedAt: null, price: { not: null } } }
    },
    take: MAX_REQUESTS
  });

  const prices = requests.flatMap((request) => request.estimates.map((estimate) => estimate.price as number));

  if (prices.length < MIN_SAMPLE_FOR_COMPARISON) {
    return {
      isAnomaly: false,
      message: `${fromRegion}->${toRegion} 조건의 과거 데이터가 ${prices.length}건뿐이라 이상치 여부를 판단하기엔 근거가 부족합니다. 참고용으로만 활용하세요.`
    };
  }

  const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const estimatedMid = (estimatedMin + estimatedMax) / 2;
  const deviationRatio = Math.abs(estimatedMid - mean) / mean;

  if (deviationRatio > ANOMALY_DEVIATION_RATIO) {
    return {
      isAnomaly: true,
      message: `추정 범위(${estimatedMin.toLocaleString()}~${estimatedMax.toLocaleString()}원)가 ${fromRegion}->${toRegion} 평균가(${Math.round(
        mean
      ).toLocaleString()}원)보다 ${Math.round(deviationRatio * 100)}% 벗어났습니다. 재확인이 필요할 수 있습니다.`
    };
  }

  return { isAnomaly: false, message: null };
}
