import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Flame,
  Lightbulb,
  MessageCircle,
  MessagesSquare,
  Send,
  Sparkles,
  Target as TargetIcon,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import {
  getDealsList,
  getEarningsSummary,
  getInsights,
  getLatestAiForLeads,
  getLatestOutreachForLeads,
  getInboxReplies,
  getOverviewStats,
  getPipelineFunnel,
  getQueuedLeads,
  getSettings,
} from "@/lib/data";
import { StatCard } from "@/components/stat-card";
import { ScoreBadge } from "@/components/badges";
import { cn, SOURCE_LABEL, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SOURCE_AVATAR: Record<string, string> = {
  job_board: "bg-green text-green-on",
  product_hunt: "bg-pink text-pink-on",
  directory: "bg-blue text-blue-on",
  github: "bg-yellow text-yellow-on",
};

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function specificSourceLabel(lead: { source: string; sourceMeta: string }): string {
  try {
    const meta = JSON.parse(lead.sourceMeta) as Record<string, unknown>;
    if (lead.source === "directory" && meta.listing === "show_hn") return "Show HN";
  } catch {
    /* ignore */
  }
  return SOURCE_LABEL[lead.source] ?? lead.source;
}

export default async function HomePage() {
  const overview = getOverviewStats();
  const funnel = getPipelineFunnel();
  const queuedLeads = getQueuedLeads(3);
  const insights = getInsights();
  const recentReplies = getInboxReplies().slice(0, 3);
  const settings = getSettings();

  const outreachByLead = getLatestOutreachForLeads(queuedLeads.map((l) => l.id));
  const aiByLead = getLatestAiForLeads(queuedLeads.map((l) => l.id));

  const earnings = getEarningsSummary();
  const largestOpportunity = Math.max(
    0,
    ...getDealsList()
      .filter((d) => ["estimated", "proposed", "negotiating"].includes(d.deal.status))
      .map((d) => d.deal.currentPrice)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[30px] font-extrabold tracking-tight">
            {greeting()}, {settings.senderName} 👋
          </h1>
          <p className="mt-1 text-[13.5px] text-muted">
            Here&apos;s what&apos;s happening with your client pipeline today.
          </p>
        </div>
        <p className="text-[13px] text-muted-2 italic sm:text-right sm:max-w-[220px]">
          &ldquo;Small consistent actions create big opportunities.&rdquo;
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="New opportunities"
          value={overview.newOpportunitiesToday}
          icon={Users}
          hint="Found today"
        />
        <StatCard label="Outreach sent" value={overview.outreachSentThisWeek} icon={Send} hint="This week" />
        <StatCard
          label="Replies received"
          value={overview.repliesThisWeek}
          icon={MessagesSquare}
          tone="success"
          hint="This week"
        />
        <StatCard
          label="Interested leads"
          value={overview.interestedLeads}
          icon={TrendingUp}
          hint="In pipeline"
        />
      </div>

      <Link href="/earnings" className="block">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Earned this month" value={formatInr(earnings.earnedThisMonth)} icon={Wallet} tone="success" />
          <StatCard label="Active pipeline" value={formatInr(earnings.pipelineValue)} icon={TrendingUp} />
          <StatCard label="Monthly target" value={formatInr(settings.monthlyTarget)} icon={TargetIcon} />
          <StatCard
            label="Largest opportunity"
            value={largestOpportunity > 0 ? formatInr(largestOpportunity) : "—"}
            icon={Flame}
          />
        </div>
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h2 className="text-[15px] font-bold">Top Opportunities</h2>
                <p className="text-[12px] text-muted">Highest-scoring leads waiting on you.</p>
              </div>
              <Link
                href="/leads"
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold hover:underline shrink-0"
              >
                View all <ArrowUpRight size={13} />
              </Link>
            </div>

            {queuedLeads.length === 0 ? (
              <div className="rounded-[20px] bg-surface px-6 py-10 text-center">
                <p className="text-[13.5px] text-muted">
                  Nothing queued right now. Hit{" "}
                  <span className="font-semibold text-foreground">Run Pipeline</span> in the
                  sidebar to discover real companies from job boards, Show HN, and GitHub.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {queuedLeads.map((lead) => {
                  const draft = outreachByLead.get(lead.id);
                  const ai = aiByLead.get(lead.id);
                  const tags = [
                    specificSourceLabel(lead),
                    ai?.opportunity ?? draft?.service,
                    ai ? "AI qualified" : null,
                  ].filter((t): t is string => !!t);

                  return (
                    <Link
                      key={lead.id}
                      href={`/leads/${lead.id}`}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-[20px] bg-surface p-4 hover:brightness-110 transition"
                    >
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold",
                          SOURCE_AVATAR[lead.source] ?? "bg-surface-2 text-muted"
                        )}
                      >
                        {lead.company.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[14.5px]">{lead.company}</span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                              lead.score >= 80 ? "bg-green-soft text-green" : "bg-blue-soft text-blue"
                            )}
                          >
                            {lead.score >= 80 ? "High Match" : "Good Match"}
                          </span>
                        </div>
                        {ai?.summary ? (
                          <p className="text-[12px] text-muted mt-0.5 line-clamp-1">{ai.summary}</p>
                        ) : (
                          <p className="font-mono text-[11.5px] text-muted-2 mt-0.5">{lead.domain}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-surface-2 px-2.5 py-1 text-[10.5px] font-semibold text-muted"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 shrink-0">
                        <ScoreBadge score={lead.score} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-[15px] font-bold">Your Pipeline</h2>
              <Link
                href="/pipeline"
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold hover:underline"
              >
                Full view <ArrowRight size={13} />
              </Link>
            </div>
            <div className="rounded-[20px] bg-surface p-5 grid grid-cols-3 sm:grid-cols-6 gap-3">
              {(
                [
                  ["discovered", "Discovered"],
                  ["qualified", "Qualified"],
                  ["contacted", "Contacted"],
                  ["replied", "Replied"],
                  ["interested", "Interested"],
                  ["closed", "Closed"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <div className="text-[20px] font-extrabold tabular-nums">{funnel[key]}</div>
                  <div className="text-[11px] font-semibold text-muted-2">{label}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[20px] bg-surface p-5">
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles size={14} className="text-blue" />
              <h2 className="text-[13px] font-bold">Insights</h2>
            </div>
            {insights.length === 0 ? (
              <p className="text-[12.5px] text-muted">
                Nothing notable yet — insights show up here once you&apos;ve run the pipeline and
                sent a few emails.
              </p>
            ) : (
              <div className="space-y-2.5">
                {insights.map((text, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-[14px] bg-surface-2 p-3">
                    {i === 0 ? (
                      <Zap size={14} className="text-green shrink-0 mt-0.5" />
                    ) : (
                      <Lightbulb size={14} className="text-yellow shrink-0 mt-0.5" />
                    )}
                    <p className="text-[12.5px] leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[20px] bg-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <MessageCircle size={14} className="text-pink" />
                <h2 className="text-[13px] font-bold">Recent Replies</h2>
              </div>
              <Link href="/inbox" className="text-[11.5px] font-semibold hover:underline">
                View all
              </Link>
            </div>
            {recentReplies.length === 0 ? (
              <p className="text-[12.5px] text-muted">No replies yet.</p>
            ) : (
              <div className="space-y-3">
                {recentReplies.map(({ lead, outreach }) => (
                  <Link
                    key={outreach.id}
                    href={`/leads/${lead.id}`}
                    className="flex items-start gap-2.5 hover:opacity-80 transition"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[12px] font-bold">
                      {lead.company.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold">{lead.company}</div>
                      <p className="text-[12px] text-muted truncate">
                        {outreach.replySnippet ?? "Marked replied manually"}
                      </p>
                    </div>
                    <span className="text-[10.5px] text-muted-2 shrink-0">
                      {outreach.repliedAt ? timeAgo(outreach.repliedAt) : ""}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
