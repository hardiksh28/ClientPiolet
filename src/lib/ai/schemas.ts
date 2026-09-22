export type OpportunityAnalysis = {
  qualified: boolean;
  confidence: "high" | "medium" | "low";
  opportunity: string;
  whyNow: string;
  evidence: string[];
  service: string;
  recommendedAction: string;
  summary: string;
};

export const OPPORTUNITY_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    qualified: {
      type: "boolean",
      description:
        "True only if there is a realistic, evidence-backed reason this company might need one of the listed services right now. False if this is just 'a website with problems' and nothing else.",
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    opportunity: {
      type: "string",
      description: "One short phrase naming the opportunity, e.g. 'Landing page clarity'.",
    },
    whyNow: {
      type: "string",
      description:
        "One sentence: why this specific moment (not months from now) is a reasonable time to reach out. Must be grounded in the given source/signal data, not invented.",
    },
    evidence: {
      type: "array",
      items: { type: "string" },
      description:
        "2-4 short, specific, verifiable observations from the given data only. No invented facts, no assumed metrics, no claims about traffic/revenue/growth that weren't in the input.",
    },
    service: {
      type: "string",
      description: "Which one of the provided enabled services fits best, or 'none' if none fit.",
    },
    recommendedAction: {
      type: "string",
      description: "One short actionable next step, e.g. 'Send a homepage concept'.",
    },
    summary: {
      type: "string",
      description: "2-3 plain sentences: what this company/product does and why it was found.",
    },
  },
  required: [
    "qualified",
    "confidence",
    "opportunity",
    "whyNow",
    "evidence",
    "service",
    "recommendedAction",
    "summary",
  ],
  additionalProperties: false,
} as const;
