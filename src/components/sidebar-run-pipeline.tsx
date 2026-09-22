"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Play } from "lucide-react";
import { runPipelineAction } from "@/app/actions";

export function SidebarRunPipeline() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      await runPipelineAction();
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="mx-3.5 mb-3 rounded-[18px] bg-green-soft p-4 text-left transition hover:brightness-110 disabled:opacity-70 w-[calc(100%-1.75rem)]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-bold text-green">
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} fill="currentColor" />}
          Run Pipeline
        </div>
        {!isPending && <ArrowRight size={14} className="text-green" />}
      </div>
      <p className="mt-1 text-[11.5px] text-muted leading-relaxed">
        {isPending ? "Discovering, auditing, scoring…" : "Discover new opportunities across the web"}
      </p>
    </button>
  );
}
