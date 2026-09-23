export type OpportunityAnalysis = {
  qualified: boolean;
  confidence: "high" | "medium" | "low";
  opportunity: string;
  whyNow: string;
  evidence: string[];
  service: string;
  recommendedAction: string;
  summary: string;
  complexity: "low" | "medium" | "high";
  estimatedDays: number;
  deliverables: string[];
  pricingStrategy: "no_price" | "starting_price" | "mention_price";
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
    complexity: {
      type: "string",
      enum: ["low", "medium", "high"],
      description:
        "How much work the scope implies. You are assessing effort only — you do not set a price, a separate deterministic calculator does that from this assessment.",
    },
    estimatedDays: {
      type: "integer",
      description: "Rough estimated days of freelance work for the described scope, e.g. 3-7.",
    },
    deliverables: {
      type: "array",
      items: { type: "string" },
      description: "2-5 short concrete deliverables implied by the scope, e.g. 'Hero redesign'.",
    },
    pricingStrategy: {
      type: "string",
      enum: ["no_price", "starting_price", "mention_price"],
      description:
        "How the outreach email should handle price. 'no_price' for cold first contact where interest isn't established yet (default/safest). 'starting_price' when scope is somewhat clear but could change. 'mention_price' only when the opportunity and scope are both very clear-cut.",
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
    "complexity",
    "estimatedDays",
    "deliverables",
    "pricingStrategy",
  ],
  additionalProperties: false,
} as const;
