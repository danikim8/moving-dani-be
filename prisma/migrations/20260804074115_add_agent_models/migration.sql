-- CreateEnum
CREATE TYPE "public"."AgentConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "public"."AgentEstimate" (
    "id" TEXT NOT NULL,
    "moveType" "public"."MoveType" NOT NULL,
    "fromRegion" "public"."RegionType" NOT NULL,
    "toRegion" "public"."RegionType" NOT NULL,
    "moveDate" TIMESTAMP(3) NOT NULL,
    "itemVolume" INTEGER NOT NULL,
    "estimatedMin" INTEGER NOT NULL,
    "estimatedMax" INTEGER NOT NULL,
    "confidence" "public"."AgentConfidence" NOT NULL,
    "reasoning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AgentEstimateFeedback" (
    "id" TEXT NOT NULL,
    "agentEstimateId" TEXT NOT NULL,
    "actualPrice" INTEGER,
    "wasAccurate" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentEstimateFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AgentLog" (
    "id" TEXT NOT NULL,
    "agentEstimateId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "toolName" TEXT NOT NULL,
    "toolInput" JSONB NOT NULL,
    "toolOutput" JSONB NOT NULL,
    "reasoning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentEstimate_moveType_fromRegion_toRegion_idx" ON "public"."AgentEstimate"("moveType", "fromRegion", "toRegion");

-- CreateIndex
CREATE INDEX "AgentEstimate_createdAt_idx" ON "public"."AgentEstimate"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentEstimateFeedback_agentEstimateId_key" ON "public"."AgentEstimateFeedback"("agentEstimateId");

-- CreateIndex
CREATE INDEX "AgentLog_agentEstimateId_idx" ON "public"."AgentLog"("agentEstimateId");

-- AddForeignKey
ALTER TABLE "public"."AgentEstimateFeedback" ADD CONSTRAINT "AgentEstimateFeedback_agentEstimateId_fkey" FOREIGN KEY ("agentEstimateId") REFERENCES "public"."AgentEstimate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgentLog" ADD CONSTRAINT "AgentLog_agentEstimateId_fkey" FOREIGN KEY ("agentEstimateId") REFERENCES "public"."AgentEstimate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
