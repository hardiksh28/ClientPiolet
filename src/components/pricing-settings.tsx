"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { updatePricingSettingsAction } from "@/app/actions";

export function PricingSettings({
  services,
  initialPricing,
  initialTarget,
}: {
  services: string[];
  initialPricing: Record<string, number>;
  initialTarget: number;
}) {
  const [prices, setPrices] = useState<Record<string, number>>(initialPricing);
  const [target, setTarget] = useState(initialTarget);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    startTransition(async () => {
      await updatePricingSettingsAction({ servicePricing: prices, monthlyTarget: target });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="rounded-[20px] bg-surface p-5">
      <h2 className="text-[13px] font-bold mb-1">Pricing</h2>
      <p className="text-[12px] text-muted mb-3.5">
        Your starting base rates, not universal market prices — the deterministic pricing
        calculator adjusts from here based on each opportunity&apos;s assessed scope. Groq never
        sets a price directly; see the Pricing card on any lead for the full breakdown.
      </p>

      <div className="space-y-2.5 mb-5">
        {services.map((service) => (
          <div key={service} className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] font-medium">{service}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-muted-2">₹</span>
              <input
                type="number"
                value={prices[service] ?? 0}
                onChange={(e) => setPrices((p) => ({ ...p, [service]: Number(e.target.value) }))}
                className="w-24 rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[12.5px] font-bold">Monthly earnings target</h3>
          <p className="text-[11.5px] text-muted-2">Shown as your goal on the Earnings page.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-muted-2">₹</span>
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="w-28 rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-[13px] font-bold text-background hover:opacity-90 transition disabled:opacity-60"
      >
        {saved && <Check size={15} />}
        {saved ? "Saved" : isPending ? "Saving…" : "Save pricing"}
      </button>
    </div>
  );
}
