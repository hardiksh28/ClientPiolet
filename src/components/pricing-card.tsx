"use client";

import { useState, useTransition } from "react";
import { DollarSign, Pencil } from "lucide-react";
import {
  advanceDealStatusAction,
  overrideDealPriceAction,
  recordPaymentAction,
  type DealStatus,
} from "@/app/actions";
import type { DealRow } from "@/lib/data";
import { cn } from "@/lib/utils";

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "bg-green text-green-on",
  medium: "bg-yellow text-yellow-on",
  low: "bg-surface-2 text-muted",
};

const STATUS_FLOW: { value: DealStatus; label: string }[] = [
  { value: "estimated", label: "Estimated" },
  { value: "proposed", label: "Proposed" },
  { value: "negotiating", label: "Negotiating" },
  { value: "won", label: "Won" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
];

const STATUS_STYLE: Record<string, string> = {
  estimated: "bg-surface-2 text-muted",
  proposed: "bg-blue text-blue-on",
  negotiating: "bg-yellow text-yellow-on",
  won: "bg-green text-green-on",
  invoiced: "bg-yellow text-yellow-on",
  partially_paid: "bg-yellow text-yellow-on",
  paid: "bg-green text-green-on",
  lost: "bg-pink text-pink-on",
};

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function PricingCard({ deal }: { deal: DealRow }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [priceInput, setPriceInput] = useState(String(deal.currentPrice));
  const [paymentInput, setPaymentInput] = useState("");
  const breakdown: { label: string; amount: number }[] = JSON.parse(deal.priceBreakdown);

  const currentIndex = STATUS_FLOW.findIndex((s) => s.value === deal.status);
  const nextStatus = deal.status === "partially_paid" ? null : STATUS_FLOW[currentIndex + 1];

  function applyPrice() {
    const n = Number(priceInput);
    if (!Number.isFinite(n) || n <= 0) return;
    startTransition(() => overrideDealPriceAction(deal.id, Math.round(n)));
    setEditing(false);
  }

  function submitPayment() {
    const n = Number(paymentInput);
    if (!Number.isFinite(n) || n <= 0) return;
    startTransition(() => recordPaymentAction(deal.id, Math.round(n)));
    setPaymentInput("");
  }

  const remaining = deal.currentPrice - deal.amountPaid;

  return (
    <div className="rounded-[20px] bg-surface p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-muted-2 uppercase tracking-wide">
          <DollarSign size={13} className="text-green" />
          Recommended offer
        </div>
        <span
          className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold capitalize", STATUS_STYLE[deal.status])}
        >
          {deal.status.replace("_", " ")}
        </span>
      </div>

      <div className="text-[15px] font-bold mb-3">{deal.service}</div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-[11px] font-bold text-muted-2 uppercase tracking-wide mb-1">
            {deal.status === "estimated" ? "Recommended ask" : "Price"}
          </div>
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                type="number"
                className="w-24 rounded-full bg-surface-2 px-3 py-1.5 text-[15px] font-extrabold outline-none focus:ring-2 focus:ring-foreground/20"
              />
              <button
                onClick={applyPrice}
                disabled={isPending}
                className="rounded-full bg-foreground text-background px-3 py-1.5 text-[11px] font-bold"
              >
                Apply
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[22px] font-extrabold">{formatInr(deal.currentPrice)}</span>
              <button
                onClick={() => {
                  setPriceInput(String(deal.currentPrice));
                  setEditing(true);
                }}
                className="text-muted-2 hover:text-foreground transition"
                title="Edit price"
              >
                <Pencil size={13} />
              </button>
            </div>
          )}
          {deal.currentPrice !== deal.recommendedPrice && (
            <p className="text-[11px] text-muted-2 mt-0.5">was {formatInr(deal.recommendedPrice)}</p>
          )}
        </div>
        <div>
          <div className="text-[11px] font-bold text-muted-2 uppercase tracking-wide mb-1">Minimum</div>
          <div className="text-[15px] font-bold text-muted">{formatInr(deal.minPrice)}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {breakdown.map((line, i) => (
          <span key={i} className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted">
            {line.label} {line.amount > 0 && `+${formatInr(line.amount)}`}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-[12px] mb-4">
        <span className="text-muted-2">
          Est. effort: <span className="font-semibold text-foreground">{deal.estimatedDays}d</span>
        </span>
        <span className="text-muted-2">
          Complexity: <span className="font-semibold text-foreground capitalize">{deal.complexity}</span>
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10.5px] font-bold capitalize",
            CONFIDENCE_STYLE[deal.priceConfidence]
          )}
        >
          {deal.priceConfidence} confidence
        </span>
      </div>

      {(deal.status === "invoiced" || deal.status === "partially_paid") && (
        <div className="mb-4 rounded-[14px] bg-surface-2 p-3">
          <div className="flex items-center justify-between text-[12px] mb-2">
            <span className="text-muted">Received: {formatInr(deal.amountPaid)}</span>
            <span className="text-muted">Remaining: {formatInr(remaining)}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={paymentInput}
              onChange={(e) => setPaymentInput(e.target.value)}
              type="number"
              placeholder="Amount received"
              className="flex-1 rounded-full bg-background px-3 py-2 text-[12.5px] outline-none focus:ring-2 focus:ring-foreground/20"
            />
            <button
              onClick={submitPayment}
              disabled={isPending}
              className="rounded-full bg-foreground text-background px-3.5 py-2 text-[12px] font-bold"
            >
              Record payment
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {nextStatus && deal.status !== "lost" && (
          <button
            onClick={() => startTransition(() => advanceDealStatusAction(deal.id, nextStatus.value))}
            disabled={isPending}
            className="rounded-full bg-foreground text-background px-3.5 py-2 text-[12px] font-bold hover:opacity-90 transition disabled:opacity-60"
          >
            Mark {nextStatus.label}
          </button>
        )}
        {deal.status !== "lost" && deal.status !== "paid" && (
          <button
            onClick={() => startTransition(() => advanceDealStatusAction(deal.id, "lost"))}
            disabled={isPending}
            className="rounded-full bg-surface-2 px-3.5 py-2 text-[12px] font-bold text-muted hover:text-pink transition disabled:opacity-60"
          >
            Mark lost
          </button>
        )}
      </div>
    </div>
  );
}
