"use client";

import { useState, useTransition } from "react";
import { Loader2, Satellite } from "lucide-react";
import { runPipelineAction } from "@/app/actions";
import type { PipelineRunSummary } from "@/lib/pipeline/types";

export function RunPipelineButton() {
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<PipelineRunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await runPipelineAction();
        setSummary(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Pipeline run failed.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-[13px] font-bold text-background transition hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Satellite size={15} strokeWidth={2.5} />
        )}
        {isPending ? "Discovering, auditing, scoring…" : "Run pipeline now"}
      </button>

      {summary && !isPending && (
        <div className="max-w-sm rounded-[16px] bg-surface px-3.5 py-2.5 text-[12px] text-muted animate-rise-in">
          <span className="font-semibold text-foreground">
            {summary.discovered} discovered
          </span>{" "}
          → {summary.candidatesAfterDedupe} new domains → {summary.audited} audited →{" "}
          <span className="font-semibold text-green">{summary.queued} queued</span>,{" "}
          {summary.archived} archived{" "}
          <span className="text-muted-2">({(summary.durationMs / 1000).toFixed(1)}s)</span>
          {summary.candidatesAfterDedupe === 0 && (
            <div className="mt-1.5 text-muted-2">
              Every company this pass found is already in your database — that&apos;s the dedupe
              working, not a failure. Job boards / Show HN / GitHub refresh over hours, not
              minutes, so new candidates show up if you run this again later.
            </div>
          )}
          {summary.errors.length > 0 && (
            <div className="mt-1 text-pink">{summary.errors.length} error(s) — see server log.</div>
          )}
        </div>
      )}
      {error && (
        <div className="max-w-sm rounded-[16px] bg-pink-soft px-3.5 py-2.5 text-[12px] text-pink">
          {error}
        </div>
      )}
    </div>
  );
}
