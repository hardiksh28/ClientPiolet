import { createHash } from "node:crypto";
import { GROQ_MODEL_HEAVY, groqStructuredCompletion } from "./groq";
import { OPPORTUNITY_ANALYSIS_SCHEMA, type OpportunityAnalysis } from "./schemas";
import type { Problem, Source } from "@/lib/pipeline/types";
import type { Signal } from "@/lib/pipeline/signals";

export type OpportunityInput = {
  company: string;
  domain: string;
  source: Source;
  sourceMeta: Record<string, unknown>;
  websiteTitle: string | null;
  h1: string | null;
  metaDescription: string | null;
  problems: Problem[];
  signals: Signal[];
  enabledServices: string[];
};

export function opportunityInputHash(input: OpportunityInput): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

const SYSTEM_PROMPT = `You assess whether a company is a realistic outreach opportunity for a freelance web developer (Hardik), based ONLY on the structured evidence provided by the user message. You also assess project scope — but you never set a price. A separate deterministic calculator turns your scope assessment into a number from Hardik's own rate card; your job stops at complexity/estimatedDays/deliverables.

Rules, no exceptions:
- Use ONLY the facts given to you. Never invent details about the company, its traffic, revenue, growth, team size, funding, or customers that were not provided.
- Do not claim to have observed anything you were not given (no "I noticed your company is growing rapidly" unless growth data was actually provided).
- "qualified: true" requires an actual reason tied to the given evidence, not just "the website has problems" — a bad website alone is not a business opportunity without a reason the timing matters.
- signals[] each carry a freshness label ("fresh" = days old, "recent" = ~2 weeks, "aging" = ~1-6 weeks, "unknown" = no reliable date). A "fresh" signal is a much stronger reason to reach out now than an "aging" or "unknown" one — if the only signal you have is "aging" or "unknown", be more conservative about urgency and confidence rather than claiming timing you can't support.
- If a signal has a jobDescription, use what the role actually asks for (not just its title) when reasoning about the opportunity and writing evidence — a role about "improving our marketing site" is a much better signal than a generic "Frontend Engineer" title.
- If nothing in the evidence gives a real "why now", set qualified to false and confidence to low rather than inventing urgency.
- evidence[] must each be a specific, checkable observation traceable to the input — not a generic claim.
- service must be exactly one of the enabledServices given, or the literal string "none".
- complexity/estimatedDays/deliverables should reflect only the scope implied by the detected problems and service — don't inflate it to justify a bigger number, you aren't setting the number anyway.
- pricingStrategy should default toward "no_price" for anything short of a very clear-cut, well-understood scope — cold first contact should rarely lead with a price before interest is established.`;

/**
 * Runs the AI opportunity analysis for one lead. Returns null on any
 * failure (missing key, API error, bad JSON, timeout) — callers must treat
 * null as "proceed without AI", never as a pipeline-blocking error.
 */
export async function analyzeOpportunity(
  input: OpportunityInput
): Promise<OpportunityAnalysis | null> {
  const user = JSON.stringify(
    {
      company: input.company,
      website: input.domain,
      source: input.source,
      sourceMeta: input.sourceMeta,
      websiteTitle: input.websiteTitle,
      h1: input.h1,
      metaDescription: input.metaDescription,
      detectedProblems: input.problems.map((p) => ({ tag: p.tag, evidence: p.evidence })),
      signals: input.signals,
      enabledServices: input.enabledServices,
    },
    null,
    2
  );

  const result = await groqStructuredCompletion<OpportunityAnalysis>({
    model: GROQ_MODEL_HEAVY,
    system: SYSTEM_PROMPT,
    user,
    schemaName: "opportunity_analysis",
    schema: OPPORTUNITY_ANALYSIS_SCHEMA,
    timeoutMs: 25000,
  });

  if (!result) return null;
  // Belt-and-suspenders against a model that ignores the enum constraint.
  if (!["high", "medium", "low"].includes(result.confidence)) return null;
  return result;
}
