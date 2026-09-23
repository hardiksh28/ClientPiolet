import type { Complexity, PriceCalculation, PriceConfidence, ScopeAssessment } from "./types";

const FALLBACK_BASE_PRICE = 6000;
const BASELINE_DAYS = 3; // included in the base price before extra-day charges kick in
const PER_EXTRA_DAY = 1200;
const MAX_BILLED_EXTRA_DAYS = 10; // guardrail against a runaway estimate

const COMPLEXITY_MODIFIER: Record<Complexity, number> = {
  low: 0,
  medium: 2000,
  high: 5000,
};

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Deterministic pricing — this is the one rule from the discussion that
 * matters most: Groq (or any AI) never sets a number. It can assess scope
 * (complexity, estimated days); this function turns that into a price
 * using your own configured base rates. Same inputs always produce the
 * same price.
 */
export function calculatePrice(
  service: string,
  scope: ScopeAssessment,
  servicePricing: Record<string, number>,
  aiConfidence?: PriceConfidence
): PriceCalculation {
  const base = servicePricing[service] ?? FALLBACK_BASE_PRICE;
  const breakdown: PriceCalculation["breakdown"] = [{ label: service, amount: base }];

  const complexityAmount = COMPLEXITY_MODIFIER[scope.complexity];
  if (complexityAmount > 0) {
    breakdown.push({ label: `${scope.complexity} complexity`, amount: complexityAmount });
  }

  const extraDays = Math.min(
    Math.max(0, scope.estimatedDays - BASELINE_DAYS),
    MAX_BILLED_EXTRA_DAYS
  );
  const extraDaysAmount = extraDays * PER_EXTRA_DAY;
  if (extraDaysAmount > 0) {
    breakdown.push({ label: `${extraDays} extra day${extraDays === 1 ? "" : "s"}`, amount: extraDaysAmount });
  }

  const rawTotal = base + complexityAmount + extraDaysAmount;
  const recommendedPrice = roundToNearest(rawTotal, 500);
  const minPrice = roundToNearest(Math.max(base, recommendedPrice * 0.75), 500);

  // Confidence follows the AI's read on the opportunity when we have one;
  // without AI, scope is a safe deterministic default, not a guess, so
  // "medium" rather than "low" — but never "high" without an AI read
  // actually looking at the specific evidence.
  const confidence: PriceConfidence = aiConfidence ?? "medium";

  return { breakdown, recommendedPrice, minPrice, confidence };
}
