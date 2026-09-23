import { Sparkles } from "lucide-react";
import type { AiAnalysisRow } from "@/lib/data";
import { cn } from "@/lib/utils";

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "bg-green text-green-on",
  medium: "bg-yellow text-yellow-on",
  low: "bg-surface-2 text-muted",
};

export function AiOpportunityCard({ ai }: { ai: AiAnalysisRow }) {
  const evidence: string[] = JSON.parse(ai.evidence);

  return (
    <div className="rounded-[20px] bg-surface p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-muted-2 uppercase tracking-wide">
          <Sparkles size={13} className="text-blue" />
          AI opportunity read
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-bold capitalize",
            CONFIDENCE_STYLE[ai.confidence] ?? "bg-surface-2 text-muted"
          )}
        >
          {ai.confidence} confidence
        </span>
      </div>

      <p className="text-[13.5px] leading-relaxed mb-3">{ai.summary}</p>

      <div className="mb-3">
        <div className="text-[11px] font-bold text-muted-2 uppercase tracking-wide mb-1">
          Opportunity
        </div>
        <div className="text-[13px] font-semibold">{ai.opportunity}</div>
      </div>

      {evidence.length > 0 && (
        <div className="mb-3">
          <div className="text-[11px] font-bold text-muted-2 uppercase tracking-wide mb-1.5">
            Evidence
          </div>
          <ul className="space-y-1">
            {evidence.map((e, i) => (
              <li key={i} className="text-[12.5px] text-muted flex gap-1.5">
                <span className="text-green shrink-0">✓</span>
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border text-[12px]">
        <span className="text-muted-2">
          Service: <span className="font-semibold text-foreground">{ai.service}</span>
        </span>
        <span className="text-muted-2">
          Next: <span className="font-semibold text-foreground">{ai.recommendedAction}</span>
        </span>
      </div>
    </div>
  );
}
