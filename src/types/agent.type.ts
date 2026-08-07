import { MoveType, RegionType } from "@prisma/client";

// ---- search_past_quotes ----
export type SearchPastQuotesInput = {
  moveType: MoveType;
  fromRegion: RegionType;
  toRegion: RegionType;
};

export type PastQuote = {
  price: number;
  moveType: MoveType;
  fromRegion: RegionType;
  toRegion: RegionType;
  createdAt: string;
};

export type SearchPastQuotesOutput = {
  quotes: PastQuote[];
  sampleSize: number;
};

// ---- get_regional_pricing ----
export type GetRegionalPricingInput = {
  fromRegion: RegionType;
  toRegion: RegionType;
  moveDate: string; // ISO date string
};

export type GetRegionalPricingOutput = {
  regionalFactor: number;
  seasonalFactor: number;
  note: string;
};

// ---- estimate_price ----
export type EstimatePriceInput = {
  pastPrices: number[];
  regionalFactor: number;
  seasonalFactor: number;
  itemVolume: number;
};

export type EstimateConfidence = "low" | "medium" | "high";

export type EstimatePriceOutput = {
  min: number;
  max: number;
  confidence: EstimateConfidence;
};

// ---- flag_anomaly ----
export type FlagAnomalyInput = {
  estimatedMin: number;
  estimatedMax: number;
  fromRegion: RegionType;
  toRegion: RegionType;
};

export type FlagAnomalyOutput = {
  isAnomaly: boolean;
  message: string | null;
};

// ---- feedback ----
export type CreateFeedbackInput = {
  agentEstimateId: string;
  actualPrice?: number;
  wasAccurate: boolean;
};
