import { TAG_TO_SERVICE } from "./score";
import type { AuditResult, ContactResult, Problem, RawLead } from "./types";

function pickTopProblem(problems: Problem[]): Problem {
  return [...problems].sort((a, b) => b.weight - a.weight)[0];
}

function sourceHook(lead: RawLead): string {
  const meta = lead.sourceMeta as Record<string, unknown>;
  switch (lead.source) {
    case "job_board":
      return `Saw you're hiring for "${meta.role ?? "a frontend role"}" — figured you're thinking about the site too.`;
    case "product_hunt":
      return `Congrats on the launch${meta.tagline ? ` — "${meta.tagline}"` : ""}. Went to check out the site after seeing it.`;
    case "directory":
      return `Came across your Show HN post${meta.title ? ` ("${(meta.title as string).replace(/^Show HN:\s*/i, "")}")` : ""} and took a look at the site.`;
    case "github":
      return `Came across your project on GitHub and checked out the homepage linked from it.`;
    default:
      return `Came across your site while looking into companies in your space.`;
  }
}

function evidenceLine(problems: Problem[]): string {
  const top = pickTopProblem(problems);
  const second = problems.find((p) => p.tag !== top.tag && p.weight >= 6);
  const parts = [top.evidence];
  if (second) parts.push(second.evidence);
  return parts.join(" Also, ");
}

function offerLine(service: string): string {
  const offers: Record<string, string> = {
    "Mobile Optimization": "I can fix the mobile layout as a quick pass — want me to send a before/after?",
    "Landing Page Redesign": "I put together a quick idea for a rewritten hero — want me to send it over?",
    "SEO Basics": "I can tighten the on-page SEO in an afternoon — want a short list of what I'd change?",
    "Performance Tuning": "I can get that down significantly with a focused pass — want the details?",
    "Trust & Conversion": "I can help lay out testimonials/proof near the CTA — want a quick mockup?",
  };
  return offers[service] ?? "Happy to put together a quick fix if useful — want me to send it?";
}

function implicationLine(topProblem: Problem): string {
  const implications: Record<string, string> = {
    NOT_MOBILE_READY: "Most visitors on mobile are probably bouncing before they read anything.",
    UNCLEAR_VALUE_PROP: "New visitors likely leave without understanding what you actually do.",
    NO_CLEAR_CTA: "Visitors who are interested may not have an obvious next step.",
    WEAK_SEO: "That's likely costing you some organic search traffic.",
    BROKEN_LINKS: "That's a rough first impression for anyone poking around.",
    SLOW_SITE: "That's a meaningful drag on conversion, especially on mobile connections.",
    OUTDATED_BUILD: "It probably reads as dated compared to competitors.",
    NO_TRUST_SIGNALS: "Visitors on the fence have nothing to reassure them.",
    INSECURE: "Some browsers will actively warn visitors before they can even see the page.",
    NO_MEASUREMENT: "Hard to know what's working without any visibility into visitor behaviour.",
  };
  return implications[topProblem.tag] ?? "Small thing, but it adds up.";
}

export type Draft = {
  subject: string;
  body: string;
  service: string;
};

export function draftEmail(
  lead: RawLead,
  audit: AuditResult,
  contact: ContactResult,
  opts: { senderName: string; portfolioUrl: string }
): Draft {
  const top = pickTopProblem(audit.problems);
  const service = TAG_TO_SERVICE[top.tag] ?? "Landing Page Redesign";
  const firstName = contact?.name?.split(" ")[0] || "there";

  const subject = `quick note on ${lead.company.toLowerCase()}'s homepage`.slice(0, 45);

  const lines = [
    `Hi ${firstName},`,
    "",
    sourceHook(lead),
    "",
    evidenceLine(audit.problems),
    "",
    implicationLine(top),
    "",
    offerLine(service),
    "",
    `- ${opts.senderName}`,
    opts.portfolioUrl || undefined,
  ].filter((l): l is string => l !== undefined);

  return { subject, body: lines.join("\n"), service };
}

export function draftFollowup(kind: "followup_1" | "followup_2", company: string, senderName: string): Draft {
  const body =
    kind === "followup_1"
      ? `Hey — just floating this back up in case it got buried. Still happy to send over what I mentioned for ${company}'s site if useful.\n\n- ${senderName}`
      : `Last nudge from me — no worries if the timing's off. If anything changes on the site front, feel free to reach out.\n\n- ${senderName}`;
  return {
    subject: `re: quick note on ${company.toLowerCase()}'s homepage`.slice(0, 45),
    body,
    service: "",
  };
}
