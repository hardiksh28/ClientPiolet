import { MailCheck, MessagesSquare, Send, Target } from "lucide-react";
import { getAnalytics, getStats } from "@/lib/data";
import { StatCard } from "@/components/stat-card";
import { SOURCE_LABEL } from "@/lib/utils";

export const dynamic = "force-dynamic";

function BarRow({
  label,
  value,
  max,
  sub,
  color = "var(--foreground)",
}: {
  label: string;
  value: number;
  max: number;
  sub?: string;
  color?: string;
}) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="font-semibold">{label}</span>
        <span className="text-muted-2 tabular-nums">
          {value}
          {sub && <span className="ml-1 text-muted-2">{sub}</span>}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default async function AnalyticsPage() {
  const stats = getStats();
  const analytics = getAnalytics();

  const sourceEntries = Object.entries(analytics.bySource);
  const maxSourceTotal = Math.max(1, ...sourceEntries.map(([, v]) => v.total));

  const serviceEntries = Object.entries(analytics.byService);
  const maxServiceSent = Math.max(1, ...serviceEntries.map(([, v]) => v.sent));

  const reasonEntries = Object.entries(analytics.archiveReasons);
  const maxReason = Math.max(1, ...reasonEntries.map(([, v]) => v));

  const hasSends = analytics.sentCount > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[32px] font-extrabold tracking-tight">Analytics</h1>
        <p className="mt-1 text-[13.5px] text-muted">What&apos;s actually converting.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total researched" value={stats.totalLeads} icon={Target} />
        <StatCard label="Sent" value={analytics.sentCount} icon={Send} />
        <StatCard label="Replied" value={analytics.repliedCount} icon={MessagesSquare} tone="success" />
        <StatCard
          label="Reply rate"
          value={stats.replyRate === null ? "—" : `${stats.replyRate}%`}
          icon={MailCheck}
        />
      </div>

      {!hasSends ? (
        <div className="rounded-[20px] bg-surface px-6 py-14 text-center">
          <p className="text-[13.5px] text-muted">
            No sends yet. Once you start marking drafts as sent from the queue, reply rates by
            source and by service will show up here.
          </p>
        </div>
      ) : null}

      <section className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-[20px] bg-surface p-5">
          <h2 className="text-[13px] font-bold mb-4">Leads by source</h2>
          <div className="space-y-4">
            {sourceEntries.length === 0 && <p className="text-[12.5px] text-muted">No data yet.</p>}
            {sourceEntries.map(([source, v]) => (
              <BarRow
                key={source}
                label={SOURCE_LABEL[source] ?? source}
                value={v.total}
                max={maxSourceTotal}
                sub={`sent ${v.sent} · replied ${v.replied}`}
                color={
                  { job_board: "var(--green)", product_hunt: "var(--pink)", directory: "var(--blue)", github: "var(--yellow)" }[
                    source
                  ] ?? "var(--foreground)"
                }
              />
            ))}
          </div>
        </div>

        <div className="rounded-[20px] bg-surface p-5">
          <h2 className="text-[13px] font-bold mb-4">Sends by service pitched</h2>
          <div className="space-y-4">
            {serviceEntries.length === 0 && (
              <p className="text-[12.5px] text-muted">No sends yet.</p>
            )}
            {serviceEntries.map(([service, v]) => (
              <BarRow
                key={service}
                label={service}
                value={v.sent}
                max={maxServiceSent}
                sub={`replied ${v.replied}`}
                color="var(--blue)"
              />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[20px] bg-surface p-5">
        <h2 className="text-[13px] font-bold mb-4">Why leads get archived</h2>
        <div className="space-y-4">
          {reasonEntries.length === 0 && (
            <p className="text-[12.5px] text-muted">Nothing archived yet.</p>
          )}
          {reasonEntries.map(([reason, count]) => (
            <BarRow
              key={reason}
              label={reason.replaceAll("_", " ")}
              value={count}
              max={maxReason}
              color="var(--yellow)"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
