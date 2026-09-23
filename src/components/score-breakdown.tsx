import { Gauge } from "lucide-react";
import type { ScoreBreakdown as ScoreBreakdownType } from "@/lib/pipeline/types";

const DIMENSIONS: { key: keyof Omit<ScoreBreakdownType, "total">; label: string; max: number }[] = [
  { key: "problemSeverity", label: "Problem severity", max: 30 },
  { key: "serviceFit", label: "Service fit", max: 25 },
  { key: "buyingIntent", label: "Buying intent (source)", max: 20 },
  { key: "contactQuality", label: "Contact quality", max: 15 },
  { key: "evidenceStrength", label: "Evidence strength", max: 10 },
];

export function ScoreBreakdown({ raw }: { raw: string }) {
  let breakdown: ScoreBreakdownType | null = null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.total === "number") breakdown = parsed;
  } catch {
    breakdown = null;
  }
  if (!breakdown) return null;

  return (
    <div className="rounded-[20px] bg-surface p-4">
      <div className="flex items-center gap-1.5 text-[12px] font-bold text-muted-2 uppercase tracking-wide mb-2.5">
        <Gauge size={13} className="text-blue" />
        Why this score
      </div>
      <div className="flex flex-col gap-2.5">
        {DIMENSIONS.map(({ key, label, max }) => {
          const value = breakdown![key];
          const pct = Math.max(4, Math.round((value / max) * 100));
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold">{label}</span>
                <span className="text-muted-2 tabular-nums">
                  {value}/{max}
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
