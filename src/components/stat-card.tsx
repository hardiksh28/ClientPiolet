import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "accent" | "success" | "warning";
}) {
  const toneStyles = {
    default: "text-foreground",
    accent: "text-foreground",
    success: "text-green",
    warning: "text-yellow",
  }[tone];

  return (
    <div className="rounded-[20px] bg-surface p-5 animate-rise-in">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-muted">{label}</span>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-muted">
          <Icon size={14} strokeWidth={2.2} />
        </div>
      </div>
      <div className={cn("mt-3 text-[30px] font-extrabold tracking-tight tabular-nums", toneStyles)}>
        {value}
      </div>
      {hint && <p className="mt-1 text-[12px] text-muted-2">{hint}</p>}
    </div>
  );
}
