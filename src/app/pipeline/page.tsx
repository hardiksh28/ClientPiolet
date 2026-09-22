import { getPipelineFunnel } from "@/lib/data";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "discovered", label: "Discovered", color: "var(--muted-2)", hint: "Every company ever researched" },
  { key: "qualified", label: "Qualified", color: "var(--blue)", hint: "Cleared score + contact + AI gates" },
  { key: "contacted", label: "Contacted", color: "var(--yellow)", hint: "Marked sent" },
  { key: "replied", label: "Replied", color: "var(--pink)", hint: "Got a reply, any kind" },
  { key: "interested", label: "Interested", color: "var(--green)", hint: "Replied hot or interested" },
  { key: "closed", label: "Closed", color: "var(--foreground)", hint: "Declined, or 2 follow-ups with no reply" },
] as const;

export default async function PipelinePage() {
  const funnel = getPipelineFunnel();
  const max = Math.max(1, funnel.discovered);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-extrabold tracking-tight">Pipeline</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          Where every researched company actually is right now, not just leads vs. archived.
        </p>
      </div>

      <div className="rounded-[20px] bg-surface p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {STAGES.map((stage) => {
            const value = funnel[stage.key];
            const pct = Math.max(4, Math.round((value / max) * 100));
            return (
              <div key={stage.key} className="space-y-2">
                <div className="text-[26px] font-extrabold tabular-nums">{value}</div>
                <div className="text-[12px] font-bold text-muted">{stage.label}</div>
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: stage.color }}
                  />
                </div>
                <p className="text-[11px] text-muted-2 leading-snug">{stage.hint}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[20px] bg-surface p-5">
        <h2 className="text-[13px] font-bold mb-3">Reading this funnel</h2>
        <ul className="space-y-1.5 text-[12.5px] text-muted leading-relaxed">
          <li>
            <span className="font-semibold text-foreground">Discovered → Qualified</span> drop is
            mostly the discipline rule working: no contact found, score below threshold, or (if
            enabled) the AI opportunity check said no.
          </li>
          <li>
            <span className="font-semibold text-foreground">Qualified → Contacted</span> is you —
            leads sit in the queue until you review and send.
          </li>
          <li>
            <span className="font-semibold text-foreground">Closed</span> counts declines and
            leads that got two follow-ups with no response — not lost opportunity, just leads
            that ran their course.
          </li>
        </ul>
      </div>
    </div>
  );
}
