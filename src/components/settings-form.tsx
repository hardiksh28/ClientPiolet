"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { updateSettingsAction } from "@/app/actions";

const ALL_SERVICES = [
  "Landing Page Redesign",
  "Mobile Optimization",
  "Performance Tuning",
  "SEO Basics",
  "Trust & Conversion",
];

export function SettingsForm({
  initial,
}: {
  initial: {
    services: string[];
    countries: string[];
    minScore: number;
    dailyLimit: number;
    portfolioUrl: string;
    senderName: string;
  };
}) {
  const [services, setServices] = useState<string[]>(initial.services);
  const [countriesText, setCountriesText] = useState(initial.countries.join(", "));
  const [minScore, setMinScore] = useState(initial.minScore);
  const [dailyLimit, setDailyLimit] = useState(initial.dailyLimit);
  const [portfolioUrl, setPortfolioUrl] = useState(initial.portfolioUrl);
  const [senderName, setSenderName] = useState(initial.senderName);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [recheck, setRecheck] = useState<{ requeued: number; reevaluated: number } | null>(null);

  function toggleService(service: string) {
    setServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateSettingsAction({
        services,
        countries: countriesText
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        minScore,
        dailyLimit,
        portfolioUrl,
        senderName,
      });
      setRecheck(result);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="rounded-[20px] bg-surface p-5">
        <h2 className="text-[13px] font-bold mb-1">Services you deliver</h2>
        <p className="text-[12px] text-muted mb-3.5">
          Drives the scorer&apos;s &quot;service fit&quot; dimension — only problems that map to an
          enabled service count toward it.
        </p>
        <div className="flex flex-wrap gap-2">
          {ALL_SERVICES.map((s) => {
            const active = services.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleService(s)}
                className={
                  active
                    ? "rounded-full bg-foreground text-background px-3.5 py-1.5 text-[12.5px] font-bold transition"
                    : "rounded-full bg-surface-2 text-muted px-3.5 py-1.5 text-[12.5px] font-bold hover:text-foreground transition"
                }
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[20px] bg-surface p-5">
        <h2 className="text-[13px] font-bold mb-1">Target countries</h2>
        <p className="text-[12px] text-muted mb-3.5">
          Comma separated. Discovered leads outside this list are filtered out before auditing —
          leave blank to target everywhere.
        </p>
        <input
          value={countriesText}
          onChange={(e) => setCountriesText(e.target.value)}
          placeholder="e.g. USA, UK, India"
          className="w-full rounded-full bg-surface-2 px-4 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-foreground/20 transition"
        />
      </div>

      <div className="rounded-[20px] bg-surface p-5 grid sm:grid-cols-2 gap-5">
        <div>
          <h2 className="text-[13px] font-bold mb-1">Minimum score</h2>
          <p className="text-[12px] text-muted mb-3">
            Below this, leads are archived instead of queued. Start at 70, raise it — never lower it.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="flex-1 accent-[var(--foreground)]"
            />
            <span className="w-10 text-right font-mono text-[13px] font-bold">{minScore}</span>
          </div>
        </div>
        <div>
          <h2 className="text-[13px] font-bold mb-1">Daily discovery limit</h2>
          <p className="text-[12px] text-muted mb-3">
            Caps how many leads one pipeline run will queue, so it never feels like a backlog.
          </p>
          <input
            type="number"
            min={1}
            max={50}
            value={dailyLimit}
            onChange={(e) => setDailyLimit(Number(e.target.value))}
            className="w-24 rounded-full bg-surface-2 px-4 py-2.5 text-[13px] font-bold outline-none focus:ring-2 focus:ring-foreground/20 transition"
          />
        </div>
      </div>

      <div className="rounded-[20px] bg-surface p-5 grid sm:grid-cols-2 gap-5">
        <div>
          <h2 className="text-[13px] font-bold mb-1">Your name</h2>
          <p className="text-[12px] text-muted mb-3">Used as the email sign-off.</p>
          <input
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            className="w-full rounded-full bg-surface-2 px-4 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-foreground/20 transition"
          />
        </div>
        <div>
          <h2 className="text-[13px] font-bold mb-1">Portfolio link</h2>
          <p className="text-[12px] text-muted mb-3">One link, appended after your name.</p>
          <input
            value={portfolioUrl}
            onChange={(e) => setPortfolioUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-full bg-surface-2 px-4 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-foreground/20 transition"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-[13px] font-bold text-background hover:opacity-90 transition disabled:opacity-60"
        >
          {saved ? <Check size={15} /> : null}
          {saved ? "Saved" : isPending ? "Saving…" : "Save settings"}
        </button>
        {recheck && !isPending && (
          <span className="text-[12px] text-muted">
            Re-checked {recheck.reevaluated} archived lead(s) that only missed on score or the
            daily limit — <span className="font-bold text-foreground">{recheck.requeued} requeued</span>.
          </span>
        )}
      </div>
    </div>
  );
}
