"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { setAutomationAction } from "@/app/actions";

const INTERVALS = [
  { minutes: 60, label: "Every hour" },
  { minutes: 180, label: "Every 3 hours" },
  { minutes: 360, label: "Every 6 hours" },
  { minutes: 720, label: "Every 12 hours" },
  { minutes: 1440, label: "Once a day" },
];

export function AutomationSettings({
  enabled,
  intervalMinutes,
  lastAutoRunAt,
}: {
  enabled: boolean;
  intervalMinutes: number;
  lastAutoRunAt: number | null;
}) {
  const [interval, setIntervalValue] = useState(intervalMinutes);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleChange(minutes: number) {
    setIntervalValue(minutes);
    startTransition(async () => {
      await setAutomationAction(enabled, minutes);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="rounded-[20px] bg-surface p-5">
      <h2 className="text-[13px] font-bold mb-1">Automation interval</h2>
      <p className="text-[12px] text-muted mb-3.5">
        How often the pipeline runs itself when Automation is on (toggle lives in the sidebar).
        This only fires while a browser tab has the dashboard open — there&apos;s no server-side
        cron in this local setup, so it can&apos;t run while your laptop is closed. For true
        background automation, this would need deploying with a real scheduler (GitHub Actions,
        same as the original plan doc), which isn&apos;t built yet.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {INTERVALS.map((opt) => (
          <button
            key={opt.minutes}
            onClick={() => handleChange(opt.minutes)}
            disabled={isPending}
            className={
              interval === opt.minutes
                ? "rounded-full bg-foreground text-background px-3.5 py-1.5 text-[12.5px] font-bold transition disabled:opacity-60"
                : "rounded-full bg-surface-2 text-muted px-3.5 py-1.5 text-[12.5px] font-bold hover:text-foreground transition disabled:opacity-60"
            }
          >
            {opt.label}
          </button>
        ))}
        {saved && <Check size={15} className="text-green" />}
      </div>
      {lastAutoRunAt && (
        <p className="mt-3 text-[11.5px] text-muted-2">
          Last automatic run: {new Date(lastAutoRunAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
