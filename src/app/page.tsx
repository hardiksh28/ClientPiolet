import Link from "next/link";
import { ArrowUpRight, Inbox, MailCheck, MessagesSquare, Sparkles } from "lucide-react";
import { getQueuedLeads, getRecentLeads, getStats } from "@/lib/data";
import { StatCard } from "@/components/stat-card";
import { RunPipelineButton } from "@/components/run-pipeline-button";
import { ScoreBadge, SourceBadge, StatusPill } from "@/components/badges";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SOURCE_AVATAR: Record<string, string> = {
  job_board: "bg-green text-green-on",
  product_hunt: "bg-pink text-pink-on",
  directory: "bg-blue text-blue-on",
  github: "bg-yellow text-yellow-on",
};

export default async function HomePage() {
  const stats = getStats();
  const queuedLeads = getQueuedLeads(6);
  const recent = getRecentLeads(8);

  return (
    <div className="space-y-9">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight">Queue</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            10 minutes a day: read a draft, edit a line, send it yourself.
          </p>
        </div>
        <RunPipelineButton />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="In queue" value={stats.queued} icon={Inbox} hint="score ≥ 70" />
        <StatCard label="Sent" value={stats.sent} icon={MailCheck} hint="awaiting reply" />
        <StatCard
          label="Reply rate"
          value={stats.replyRate === null ? "—" : `${stats.replyRate}%`}
          icon={MessagesSquare}
          tone="success"
          hint={`${stats.replied} replied`}
        />
        <StatCard label="Total researched" value={stats.totalLeads} icon={Sparkles} hint={`${stats.archived} archived`} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-[15px] font-bold">Top of the queue</h2>
          <Link
            href="/leads"
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold hover:underline"
          >
            View all leads <ArrowUpRight size={13} />
          </Link>
        </div>

        {queuedLeads.length === 0 ? (
          <EmptyQueue hasResearched={stats.totalLeads > 0} />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {queuedLeads.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="group relative overflow-hidden rounded-[20px] bg-surface p-4 transition hover:brightness-110 animate-rise-in"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${
                        SOURCE_AVATAR[lead.source] ?? "bg-surface-2 text-muted"
                      }`}
                    >
                      {lead.company.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[14px] truncate">{lead.company}</div>
                      <div className="font-mono text-[11px] text-muted-2 truncate">{lead.domain}</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <SourceBadge source={lead.source} />
                  <ScoreBadge score={lead.score} />
                </div>
                <div className="mt-2 text-right text-[10.5px] text-muted-2">{timeAgo(lead.createdAt)}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[15px] font-bold mb-3.5">Recent activity</h2>
        <div className="rounded-[20px] bg-surface overflow-hidden">
          {recent.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-muted">
              Nothing yet — run the pipeline to discover your first leads.
            </div>
          ) : (
            recent.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusPill status={lead.status} />
                  <span className="font-semibold text-[13px] truncate">{lead.company}</span>
                  <span className="hidden sm:inline font-mono text-[11.5px] text-muted-2 truncate">
                    {lead.domain}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <SourceBadge source={lead.source} />
                  <span className="text-[11px] text-muted-2 w-14 text-right">{timeAgo(lead.createdAt)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyQueue({ hasResearched }: { hasResearched: boolean }) {
  if (hasResearched) {
    return (
      <div className="rounded-[20px] bg-surface px-6 py-10 text-center">
        <p className="text-[13.5px] text-muted">
          Nothing cleared the bar yet — every researched company so far was either missing a
          verifiable contact email or scored below your threshold, so it was archived rather than
          queued (that&apos;s the discipline rule working, not a bug). See exactly why on the{" "}
          <Link href="/leads?status=archived" className="font-semibold text-foreground hover:underline">
            archived leads
          </Link>{" "}
          list, or run the pipeline again later once more postings are live.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-[20px] bg-surface px-6 py-10 text-center">
      <p className="text-[13.5px] text-muted">
        No leads queued yet. Hit <span className="font-semibold text-foreground">Run pipeline now</span> to
        discover, audit and score real companies from job boards, Show HN, and GitHub.
      </p>
    </div>
  );
}
