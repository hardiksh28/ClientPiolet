export type Source = "job_board" | "product_hunt" | "directory" | "github";

export type RawLead = {
  company: string;
  domain: string | null; // canonical domain if already known, else null (needs resolving)
  siteUrl?: string | null; // full URL to try if domain not yet canonical
  country?: string;
  industry?: string;
  source: Source;
  sourceMeta: Record<string, unknown>;
};

export type ResolvedLead = RawLead & {
  domain: string;
};

export type Problem = {
  tag: string;
  weight: number;
  evidence: string;
};

export type AuditResult = {
  httpStatus: number | null;
  title: string | null;
  h1: string | null;
  metaDesc: string | null;
  tech: string[];
  problems: Problem[];
  pageBytes: number | null;
  insecure: boolean;
  fetchFailed: boolean;
  /** Raw homepage HTML — used for contact extraction, never persisted. */
  html: string | null;
  origin: string | null;
};

export type ContactResult = {
  name: string | null;
  role: string | null;
  email: string;
  confidence: "direct" | "role" | "form_only";
  sourceUrl: string | null;
} | null;

export type ScoreBreakdown = {
  problemSeverity: number;
  serviceFit: number;
  buyingIntent: number;
  contactQuality: number;
  evidenceStrength: number;
  total: number;
};

export type PipelineRunSummary = {
  bySource: Record<Source, number>;
  discovered: number;
  candidatesAfterDedupe: number;
  audited: number;
  queued: number;
  archived: number;
  errors: string[];
  durationMs: number;
  aiAnalyzed: number;
  aiRejected: number;
};
