import { Flame, TrendingUp, Clock3, HelpCircle, Radio } from "lucide-react";
import type { Signal, SignalFreshness } from "@/lib/pipeline/signals";
import { cn, timeAgo } from "@/lib/utils";

const FRESHNESS_STYLE: Record<SignalFreshness, { icon: typeof Flame; label: string; className: string }> = {
  fresh: { icon: Flame, label: "Fresh", className: "bg-green-soft text-green" },
  recent: { icon: TrendingUp, label: "Recent", className: "bg-blue-soft text-blue" },
  aging: { icon: Clock3, label: "Aging", className: "bg-yellow-soft text-yellow" },
  unknown: { icon: HelpCircle, label: "Undated", className: "bg-surface-2 text-muted" },
};

export function BuyingSignals({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) return null;

  return (
    <div className="rounded-[20px] bg-surface p-4">
      <div className="flex items-center gap-1.5 text-[12px] font-bold text-muted-2 uppercase tracking-wide mb-2.5">
        <Radio size={13} className="text-green" />
        Buying signals
      </div>
      <div className="flex flex-col gap-2.5">
        {signals.map((s, i) => {
          const style = FRESHNESS_STYLE[s.freshness];
          const Icon = style.icon;
          return (
            <div key={i} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                  style.className
                )}
              >
                <Icon size={11} strokeWidth={2.5} />
                {style.label}
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold">{s.label}</div>
                <p className="text-[12px] text-muted leading-relaxed">{s.detail}</p>
                {s.detectedAt && (
                  <div className="text-[10.5px] text-muted-2 mt-0.5">Detected {timeAgo(s.detectedAt)}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
