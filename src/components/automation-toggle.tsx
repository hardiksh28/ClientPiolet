"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { autoRunPipelineAction, setAutomationAction } from "@/app/actions";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "due now";
  const totalMinutes = Math.ceil(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function AutomationToggle({
  initialEnabled,
  intervalMinutes,
  lastAutoRunAt,
}: {
  initialEnabled: boolean;
  intervalMinutes: number;
  lastAutoRunAt: number | null;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [lastRun, setLastRun] = useState(lastAutoRunAt);
  const [now, setNow] = useState(() => Date.now());
  const [isRunning, setIsRunning] = useState(false);
  const [, startTransition] = useTransition();
  const hasCheckedOnMount = useRef(false);

  // Tick every 30s to keep the countdown display live.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // The actual scheduler: only runs while this component is mounted, i.e.
  // while a browser tab has the dashboard open. There is no server-side
  // cron in this local setup — see the caption below the toggle.
  useEffect(() => {
    if (!enabled) return;

    async function maybeRun() {
      const due = !lastRun || Date.now() - lastRun >= intervalMinutes * 60000;
      if (!due || isRunning) return;
      setIsRunning(true);
      try {
        await autoRunPipelineAction();
        setLastRun(Date.now());
      } finally {
        setIsRunning(false);
      }
    }

    if (!hasCheckedOnMount.current) {
      hasCheckedOnMount.current = true;
      maybeRun();
    }
    const interval = setInterval(maybeRun, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, lastRun, intervalMinutes]);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(() => setAutomationAction(next, intervalMinutes));
  }

  const nextRunMs = lastRun ? lastRun + intervalMinutes * 60000 - now : 0;

  return (
    <div className="mx-3.5 mb-2 rounded-[18px] bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12.5px] font-bold">
          {isRunning ? <Loader2 size={13} className="animate-spin text-blue" /> : null}
          Automation
        </div>
        <button
          onClick={toggle}
          role="switch"
          aria-checked={enabled}
          className={`relative h-5 w-9 rounded-full transition-colors ${enabled ? "bg-green" : "bg-surface-2"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted-2 leading-relaxed">
        {enabled
          ? lastRun
            ? `Next run in ${formatCountdown(nextRunMs)} · while this tab stays open`
            : "Runs shortly · while this tab stays open"
          : "Off — run manually with the button above"}
      </p>
    </div>
  );
}
