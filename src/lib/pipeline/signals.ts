import type { Source } from "./types";

export type SignalFreshness = "fresh" | "recent" | "aging" | "unknown";

export type Signal = {
  type: "launch" | "hiring" | "technical";
  label: string;
  detail: string;
  detectedAt: number | null;
  freshness: SignalFreshness;
};

function freshnessOf(detectedAt: number | null, now: number): SignalFreshness {
  if (detectedAt == null || detectedAt > now) return "unknown";
  const days = (now - detectedAt) / 86_400_000;
  if (days <= 4) return "fresh";
  if (days <= 14) return "recent";
  if (days <= 45) return "aging";
  return "unknown";
}

function parseDate(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Derives buying signals from data the pipeline already captured at
 * discovery time — no new fetching, no invented urgency. Each lead currently
 * comes from exactly one discovery source, so this returns at most one
 * signal today; the shape exists so a future multi-source merge (one company,
 * several signals) can slot in without another redesign.
 */
export function computeSignals(
  source: Source,
  sourceMeta: Record<string, unknown>,
  now = Date.now()
): Signal[] {
  if (source === "job_board") {
    const postedAt = parseDate(sourceMeta.postedAt);
    return [
      {
        type: "hiring",
        label: `Hiring: ${String(sourceMeta.role ?? "developer role")}`,
        detail:
          typeof sourceMeta.jobDescription === "string" && sourceMeta.jobDescription
            ? sourceMeta.jobDescription
            : "Open role posted on a public job board.",
        detectedAt: postedAt,
        freshness: freshnessOf(postedAt, now),
      },
    ];
  }

  if (source === "product_hunt") {
    const launchedAt = parseDate(sourceMeta.launchedAt);
    return [
      {
        type: "launch",
        label: "Product Hunt launch",
        detail: String(sourceMeta.tagline ?? "Launched on Product Hunt."),
        detectedAt: launchedAt,
        freshness: freshnessOf(launchedAt, now),
      },
    ];
  }

  if (source === "directory" && sourceMeta.listing === "show_hn") {
    const postedAt = parseDate(sourceMeta.postedAt);
    return [
      {
        type: "launch",
        label: "Show HN launch",
        detail: String(sourceMeta.title ?? "Publicly launched on Hacker News."),
        detectedAt: postedAt,
        freshness: freshnessOf(postedAt, now),
      },
    ];
  }

  if (source === "github") {
    const pushedAt = parseDate(sourceMeta.pushedAt);
    return [
      {
        type: "technical",
        label: "Active GitHub development",
        detail:
          typeof sourceMeta.repo === "string"
            ? `Recent activity on ${sourceMeta.repo}.`
            : "Public repo with recent activity.",
        detectedAt: pushedAt,
        freshness: freshnessOf(pushedAt, now),
      },
    ];
  }

  return [];
}
