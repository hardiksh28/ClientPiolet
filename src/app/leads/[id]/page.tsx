import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Flame, Globe, User } from "lucide-react";
import { getLeadDetail } from "@/lib/data";
import { ScoreBadge, SourceBadge, StatusPill, ProblemTag } from "@/components/badges";
import { OutreachPanel } from "@/components/outreach-panel";
import { AiOpportunityCard } from "@/components/ai-opportunity-card";
import { BuyingSignals } from "@/components/buying-signals";
import { ScoreBreakdown } from "@/components/score-breakdown";
import { PricingCard } from "@/components/pricing-card";
import { computeSignals } from "@/lib/pipeline/signals";
import type { Source } from "@/lib/pipeline/types";
import { timeAgo, SOURCE_LABEL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: PageProps<"/leads/[id]">) {
  const { id } = await params;
  const detail = getLeadDetail(id);
  if (!detail) notFound();
  const { lead, audit, contact, outreach, ai, deal } = detail;
  const problems: { tag: string; weight: number; evidence: string }[] = audit
    ? JSON.parse(audit.problems)
    : [];
  const tech: string[] = audit ? JSON.parse(audit.tech) : [];
  const meta = JSON.parse(lead.sourceMeta) as Record<string, unknown>;
  const signals = computeSignals(lead.source as Source, meta);

  return (
    <div className="space-y-6">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-foreground transition"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface">
          <ArrowLeft size={12} />
        </div>
        Back to leads
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[30px] font-extrabold tracking-tight">{lead.company}</h1>
            <StatusPill status={lead.status} />
          </div>
          <a
            href={`https://${lead.domain}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 font-mono text-[13px] text-muted hover:text-foreground transition"
          >
            <Globe size={12} /> {lead.domain} <ExternalLink size={11} />
          </a>
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            <SourceBadge source={lead.source} />
            {lead.country && (
              <span className="text-[11.5px] text-muted-2">{lead.country}</span>
            )}
            <span className="text-[11.5px] text-muted-2">found {timeAgo(lead.createdAt)}</span>
          </div>
        </div>
        <ScoreBadge score={lead.score} />
      </div>

      {lead.status === "archived" && lead.archiveReason && (
        <div className="rounded-full bg-surface px-4 py-2.5 text-[12.5px] text-muted w-fit">
          Archived — reason:{" "}
          <span className="font-semibold text-foreground">{lead.archiveReason.replaceAll("_", " ")}</span>
        </div>
      )}

      {ai?.whyNow && (
        <div className="rounded-[20px] bg-green-soft px-5 py-4 flex items-start gap-3">
          <Flame size={18} className="text-green shrink-0 mt-0.5" />
          <div>
            <div className="text-[11px] font-bold text-green uppercase tracking-wide mb-0.5">
              Why now
            </div>
            <p className="text-[14px] font-medium leading-relaxed">{ai.whyNow}</p>
          </div>
        </div>
      )}

      {ai && <AiOpportunityCard ai={ai} />}

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <BuyingSignals signals={signals} />
          <ScoreBreakdown raw={lead.scoreBreakdown} />

          <div className="rounded-[20px] bg-surface p-4">
            <div className="text-[12px] font-bold text-muted-2 uppercase tracking-wide mb-2.5">
              Evidence
            </div>
            {problems.length === 0 ? (
              <p className="text-[12.5px] text-muted">No problems detected.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {problems
                  .sort((a, b) => b.weight - a.weight)
                  .map((p) => (
                    <div key={p.tag} className="space-y-1">
                      <ProblemTag tag={p.tag} weight={p.weight} />
                      <p className="text-[12.5px] text-muted leading-relaxed pl-0.5">{p.evidence}</p>
                    </div>
                  ))}
              </div>
            )}

            {tech.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-[12px] font-bold text-muted-2 uppercase tracking-wide mb-2">
                  Detected stack
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tech.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {audit && (
              <div className="mt-4 pt-4 border-t border-border space-y-1.5 text-[12px] text-muted">
                <div>
                  <span className="text-muted-2">Title: </span>
                  {audit.title || "—"}
                </div>
                <div>
                  <span className="text-muted-2">H1: </span>
                  {audit.h1 || "—"}
                </div>
                <div>
                  <span className="text-muted-2">Meta description: </span>
                  {audit.metaDesc || "—"}
                </div>
                <div>
                  <span className="text-muted-2">Page size: </span>
                  {audit.pageBytes ? `${(audit.pageBytes / 1024).toFixed(0)} KB` : "—"}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[20px] bg-surface p-4">
            <div className="text-[12px] font-bold text-muted-2 uppercase tracking-wide mb-2.5">
              Contact
            </div>
            {contact ? (
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue text-blue-on">
                  <User size={14} />
                </div>
                <div className="min-w-0">
                  {contact.name && <div className="text-[12.5px] font-semibold truncate">{contact.name}</div>}
                  {contact.role && <div className="text-[11.5px] text-muted truncate">{contact.role}</div>}
                  <div className="font-mono text-[12.5px] truncate">{contact.email}</div>
                  <div className="text-[11px] text-muted-2 capitalize">{contact.confidence} confidence</div>
                </div>
              </div>
            ) : (
              <p className="text-[12.5px] text-muted">No verified contact found.</p>
            )}
          </div>

          <div className="rounded-[20px] bg-surface p-4">
            <div className="text-[12px] font-bold text-muted-2 uppercase tracking-wide mb-2.5">
              Source signal
            </div>
            <dl className="space-y-1.5 text-[12.5px]">
              {Object.entries(meta).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="text-muted-2 capitalize shrink-0">{k}:</dt>
                  <dd className="text-muted truncate">{String(v)}</dd>
                </div>
              ))}
              {Object.keys(meta).length === 0 && (
                <p className="text-muted-2">via {SOURCE_LABEL[lead.source]}</p>
              )}
            </dl>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {deal && <PricingCard deal={deal} />}
          <OutreachPanel lead={lead} outreach={outreach} contact={contact} />
        </div>
      </div>
    </div>
  );
}
