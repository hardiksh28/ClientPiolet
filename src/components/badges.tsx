import { cn } from "@/lib/utils";
import { SOURCE_LABEL } from "@/lib/utils";
import { Briefcase, Compass, GitFork, Rocket } from "lucide-react";

export function ScoreBadge({ score }: { score: number }) {
  const tier = score >= 80 ? "act" : score >= 70 ? "good" : "low";
  const styles = {
    act: "bg-green text-green-on",
    good: "bg-yellow text-yellow-on",
    low: "bg-surface-2 text-muted",
  }[tier];
  const label = { act: "ACT NOW", good: "GOOD", low: "LOW" }[tier];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold tabular-nums",
        styles
      )}
    >
      <span className="font-mono text-[12px]">{score}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: "bg-blue text-blue-on",
    sent: "bg-yellow text-yellow-on",
    replied: "bg-green text-green-on",
    archived: "bg-surface-2 text-muted-2",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-bold capitalize",
        styles[status] ?? "bg-surface-2 text-muted"
      )}
    >
      {status}
    </span>
  );
}

// One vivid color per discovery source — the same trick the reference uses
// for shift roles, applied to where a lead came from.
const SOURCE_STYLE: Record<string, { icon: typeof Briefcase; className: string }> = {
  job_board: { icon: Briefcase, className: "bg-green text-green-on" },
  product_hunt: { icon: Rocket, className: "bg-pink text-pink-on" },
  directory: { icon: Compass, className: "bg-blue text-blue-on" },
  github: { icon: GitFork, className: "bg-yellow text-yellow-on" },
};

export function SourceBadge({ source }: { source: string }) {
  const style = SOURCE_STYLE[source] ?? { icon: Compass, className: "bg-surface-2 text-muted" };
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold",
        style.className
      )}
    >
      <Icon size={12} strokeWidth={2.5} />
      {SOURCE_LABEL[source] ?? source}
    </span>
  );
}

// Severity-tiered coloring for evidence tags: the heaviest-weighted problems
// (the ones actually worth leading an email with) stand out most.
export function ProblemTag({ tag, weight }: { tag: string; weight: number }) {
  const style = weight >= 8 ? "bg-pink text-pink-on" : weight >= 5 ? "bg-yellow text-yellow-on" : "bg-blue text-blue-on";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
        style
      )}
    >
      {tag.replaceAll("_", " ")}
      <span className="rounded-full bg-black/15 px-1.5 font-mono text-[10px]">+{weight}</span>
    </span>
  );
}
