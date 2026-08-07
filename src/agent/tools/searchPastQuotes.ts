import prisma from "../../config/prisma";
import { SearchPastQuotesInput, SearchPastQuotesOutput } from "../../types/agent.type";

const MAX_REQUESTS = 30;
const MAX_QUOTES = 20;

// 조건이 유사한 과거 견적 요청을 찾고, 그에 달린 기사 제안가(Estimate.price)를 모아 반환한다.
export async function searchPastQuotes(input: SearchPastQuotesInput): Promise<SearchPastQuotesOutput> {
  const { moveType, fromRegion, toRegion } = input;

  const requests = await prisma.estimateRequest.findMany({
    where: {
      moveType,
      deletedAt: null,
      fromAddress: { region: fromRegion },
      toAddress: { region: toRegion }
    },
    include: {
      estimates: {
        where: { deletedAt: null, price: { not: null } }
      }
    },
    orderBy: { createdAt: "desc" },
    take: MAX_REQUESTS
  });

  const quotes = requests
    .flatMap((request) =>
      request.estimates.map((estimate) => ({
        price: estimate.price as number,
        moveType: request.moveType,
        fromRegion,
        toRegion,
        createdAt: estimate.createdAt.toISOString()
      }))
    )
    .slice(0, MAX_QUOTES);

  return { quotes, sampleSize: quotes.length };
}
