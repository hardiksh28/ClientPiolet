import { createHash } from "node:crypto";
import { GROQ_MODEL_HEAVY, groqStructuredCompletion } from "./groq";
import { OPPORTUNITY_ANALYSIS_SCHEMA, type OpportunityAnalysis } from "./schemas";
import type { Problem, Source } from "@/lib/pipeline/types";

export type OpportunityInput = {
  company: string;
  domain: string;
  source: Source;
  sourceMeta: Record<string, unknown>;
  websiteTitle: string | null;
  h1: string | null;
  metaDescription: string | null;
  problems: Problem[];
  enabledServices: string[];
};

export function opportunityInputHash(input: OpportunityInput): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

const SYSTEM_PROMPT = `You assess whether a company is a realistic outreach opportunity for a freelance web developer (Hardik), based ONLY on the structured evidence provided by the user message.

Rules, no exceptions:
- Use ONLY the facts given to you. Never invent details about the company, its traffic, revenue, growth, team size, funding, or customers that were not provided.
- Do not claim to have observed anything you were not given (no "I noticed your company is growing rapidly" unless growth data was actually provided).
- "qualified: true" requires an actual reason tied to the given evidence, not just "the website has problems" — a bad website alone is not a business opportunity without a reason the timing matters.
- If nothing in the evidence gives a real "why now", set qualified to false and confidence to low rather than inventing urgency.
- evidence[] must each be a specific, checkable observation traceable to the input — not a generic claim.
- service must be exactly one of the enabledServices given, or the literal string "none".`;

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
