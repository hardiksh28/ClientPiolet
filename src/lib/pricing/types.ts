export type Complexity = "low" | "medium" | "high";
export type PricingStrategy = "no_price" | "starting_price" | "mention_price";
export type PriceConfidence = "high" | "medium" | "low";

export type ScopeAssessment = {
  complexity: Complexity;
  estimatedDays: number;
};

export type PriceLine = { label: string; amount: number };

export type PriceCalculation = {
  breakdown: PriceLine[];
  recommendedPrice: number;
  minPrice: number;
  confidence: PriceConfidence;
};
