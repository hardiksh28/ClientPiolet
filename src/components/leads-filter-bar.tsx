"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useCallback, useTransition } from "react";
import { cn } from "@/lib/utils";

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "queued", label: "Queued" },
  { value: "sent", label: "Sent" },
  { value: "replied", label: "Replied" },
  { value: "archived", label: "Archived" },
];

const SOURCES = [
  { value: "", label: "All sources" },
  { value: "job_board", label: "Job board" },
  { value: "product_hunt", label: "Product Hunt" },
  { value: "directory", label: "Directory" },
  { value: "github", label: "GitHub" },
];

export function LeadsFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const set = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      startTransition(() => router.push(`/leads?${params.toString()}`));
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-col sm:flex-row gap-2.5">
      <div className="relative flex-1">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-2" />
        <input
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Search company or domain…"
          className="w-full rounded-full bg-surface pl-9 pr-4 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-foreground/20 transition"
        />
      </div>
      <select
        defaultValue={searchParams.get("status") ?? ""}
        onChange={(e) => set("status", e.target.value)}
        className={cn(
          "rounded-full bg-surface px-4 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-foreground/20 transition"
        )}
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("source") ?? ""}
        onChange={(e) => set("source", e.target.value)}
        className="rounded-full bg-surface px-4 py-2.5 text-[13px] font-medium outline-none focus:ring-2 focus:ring-foreground/20 transition"
      >
        {SOURCES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
