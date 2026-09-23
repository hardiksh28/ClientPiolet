import Link from "next/link";
import { getDealsList, getEarningsSummary, getHistoricalAveragesByService, getSettings } from "@/lib/data";
import { StatCard } from "@/components/stat-card";
import { Wallet, TrendingUp, Target, Clock4 } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  estimated: "bg-surface-2 text-muted",
  proposed: "bg-blue text-blue-on",
  negotiating: "bg-yellow text-yellow-on",
  won: "bg-green text-green-on",
  invoiced: "bg-yellow text-yellow-on",
  partially_paid: "bg-yellow text-yellow-on",
  paid: "bg-green text-green-on",
  lost: "bg-pink text-pink-on",
};

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default async function EarningsPage() {
  const summary = getEarningsSummary();
  const dealsList = getDealsList();
  const averages = getHistoricalAveragesByService();
  const settings = getSettings();

  const goalPct = Math.min(100, Math.round((summary.earnedThisMonth / settings.monthlyTarget) * 100));
  const maxMonth = Math.max(1, ...summary.months.map((m) => m.total));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-extrabold tracking-tight">Earnings</h1>
        <p className="mt-1 text-[13.5px] text-muted">Track your freelance revenue and deal pipeline.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Earned" value={formatInr(summary.totalEarned)} icon={Wallet} tone="success" />
        <StatCard label="This Month" value={formatInr(summary.earnedThisMonth)} icon={TrendingUp} />
        <StatCard
          label="Pipeline"
          value={formatInr(summary.pipelineValue)}
          icon={Target}
          hint={`${summary.activeCount} active opportunities`}
        />
        <StatCard label="Pending Payment" value={formatInr(summary.pendingPayment)} icon={Clock4} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-[20px] bg-surface p-5">
            <h2 className="text-[13px] font-bold mb-4">Earnings by month</h2>
            <div className="flex items-end gap-3 h-32">
              {summary.months.map((m) => (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t-lg bg-green transition-all"
                      style={{ height: `${Math.max(4, (m.total / maxMonth) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10.5px] text-muted-2">{m.label}</span>
                </div>
              ))}
            </div>
            {summary.totalEarned === 0 && (
              <p className="text-[12px] text-muted-2 mt-3">
                No payments recorded yet — this fills in as you mark deals paid.
              </p>
            )}
          </section>

          <section className="rounded-[20px] bg-surface p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[13px] font-bold">
                {new Date().toLocaleString("en-US", { month: "long" })} goal
              </h2>
              <span className="text-[12px] text-muted">
                {formatInr(summary.earnedThisMonth)} / {formatInr(settings.monthlyTarget)}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-green transition-all"
                style={{ width: `${goalPct}%` }}
              />
            </div>
            <p className="text-[11.5px] text-muted-2 mt-2">
              {goalPct}% of target — editable in Settings.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-bold mb-3.5">Recent Deals</h2>
            <div className="rounded-[20px] bg-surface overflow-hidden">
              {dealsList.length === 0 ? (
                <div className="px-6 py-14 text-center text-[13.5px] text-muted">
                  No deals yet — one gets created automatically for every lead that reaches the
                  queue.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {dealsList.map(({ lead, deal }) => (
                    <Link
                      key={deal.id}
                      href={`/leads/${lead.id}`}
                      className="flex items-center gap-4 px-4 sm:px-5 py-3.5 hover:bg-surface-2 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[13.5px] truncate">{lead.company}</div>
                        <div className="text-[11.5px] text-muted-2 truncate">{deal.service}</div>
                      </div>
                      <span className="font-bold text-[14px] shrink-0">{formatInr(deal.currentPrice)}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize",
                          STATUS_STYLE[deal.status]
                        )}
                      >
                        {deal.status.replace("_", " ")}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[20px] bg-surface p-5">
            <h2 className="text-[13px] font-bold mb-3">Your historical rates</h2>
            {averages.length === 0 ? (
              <p className="text-[12.5px] text-muted">
                Not enough data yet — once you&apos;ve won a deal, its average shows up here
                instead of the generic base rate.
              </p>
            ) : (
              <div className="space-y-3">
                {averages.map((a) => (
                  <div key={a.service} className="flex items-center justify-between">
                    <div>
                      <div className="text-[12.5px] font-semibold">{a.service}</div>
                      <div className="text-[11px] text-muted-2">
                        {a.count} deal{a.count === 1 ? "" : "s"} won
                      </div>
                    </div>
                    <span className="font-bold text-[14px]">{formatInr(a.avg)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[20px] bg-surface p-5">
            <h2 className="text-[13px] font-bold mb-2">What these numbers mean</h2>
            <ul className="space-y-2 text-[12px] text-muted leading-relaxed">
              <li>
                <span className="font-semibold text-foreground">Pipeline</span> is the sum of
                current asking prices for open opportunities — not money you have, a estimate of
                what could come in if they convert.
              </li>
              <li>
                <span className="font-semibold text-foreground">Total Earned</span> only counts
                amounts you&apos;ve explicitly recorded as received via a deal&apos;s payment
                tracker — nothing here is assumed or auto-detected.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
