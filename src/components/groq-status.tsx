import { CheckCircle2, Sparkles } from "lucide-react";
import { GROQ_MODEL_HEAVY, GROQ_MODEL_LIGHT } from "@/lib/ai/groq";

export function GroqStatus({ configured }: { configured: boolean }) {
  return (
    <div className="rounded-[20px] bg-surface p-5">
      <h2 className="text-[13px] font-bold mb-1">AI opportunity analysis</h2>
      <p className="text-[12px] text-muted mb-3.5">
        After a lead clears every deterministic check, Groq reads the structured evidence (never
        raw HTML) and decides whether there&apos;s a real reason to reach out right now. If it
        says no, or the call fails for any reason, that never blocks the deterministic pipeline —
        AI is a filter on top, not a dependency.
      </p>
      {configured ? (
        <div className="flex items-center gap-2 rounded-full bg-surface-2 px-3.5 py-2 w-fit">
          <CheckCircle2 size={14} className="text-green" />
          <span className="text-[12.5px] font-semibold">
            Configured — {GROQ_MODEL_HEAVY} for analysis, {GROQ_MODEL_LIGHT} available for
            lighter tasks
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-full bg-surface-2 px-3.5 py-2 w-fit">
          <Sparkles size={14} className="text-muted-2" />
          <span className="text-[12.5px] font-semibold text-muted">
            Not configured — add GROQ_API_KEY to .env.local to turn this on
          </span>
        </div>
      )}
    </div>
  );
}
