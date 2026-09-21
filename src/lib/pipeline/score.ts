import type { AuditResult, ContactResult, ScoreBreakdown, Source } from "./types";

const BUYING_INTENT: Record<Source, number> = {
  job_board: 20,
  product_hunt: 15,
  directory: 8,
  github: 4,
};

export const TAG_TO_SERVICE: Record<string, string> = {
  NOT_MOBILE_READY: "Mobile Optimization",
  UNCLEAR_VALUE_PROP: "Landing Page Redesign",
  NO_CLEAR_CTA: "Landing Page Redesign",
  WEAK_SEO: "SEO Basics",
  BROKEN_LINKS: "Landing Page Redesign",
  SLOW_SITE: "Performance Tuning",
  OUTDATED_BUILD: "Landing Page Redesign",
  NO_TRUST_SIGNALS: "Trust & Conversion",
  INSECURE: "Performance Tuning",
  NO_MEASUREMENT: "SEO Basics",
};

export function scoreLead(
  source: Source,
  audit: AuditResult,
  contact: ContactResult,
  enabledServices: string[]
): ScoreBreakdown {
  const problemSeverity = Math.min(
    30,
    audit.problems.reduce((sum, p) => sum + p.weight, 0)
  );

  const matchedServices = new Set<string>();
  for (const p of audit.problems) {
    const service = TAG_TO_SERVICE[p.tag];
    if (service && enabledServices.includes(service)) matchedServices.add(service);
  }
  const serviceFit = Math.min(25, matchedServices.size * 5);

  const buyingIntent = BUYING_INTENT[source] ?? 4;

  const contactQuality = !contact
    ? 0
    : contact.confidence === "direct"
    ? 15
    : contact.confidence === "role"
    ? 10
    : 3;

  const hasStrongEvidence = audit.problems.some((p) => p.weight >= 8);
  const evidenceStrength = audit.problems.length === 0 ? 0 : hasStrongEvidence ? 10 : 4;

  const total = Math.min(
    100,
    problemSeverity + serviceFit + buyingIntent + contactQuality + evidenceStrength
  );

  return { problemSeverity, serviceFit, buyingIntent, contactQuality, evidenceStrength, total };
}
