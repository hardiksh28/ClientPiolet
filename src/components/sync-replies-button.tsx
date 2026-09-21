"use client";

import { useState, useTransition } from "react";
import { Loader2, MailSearch } from "lucide-react";
import { syncGmailRepliesAction } from "@/app/actions";
import type { GmailSyncResult } from "@/lib/pipeline/gmail-sync";

export function SyncRepliesButton({ connected }: { connected: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<GmailSyncResult | null>(null);

  if (!connected) return null;

  function handleClick() {
    startTransition(async () => {
      const r = await syncGmailRepliesAction();
      setResult(r);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-[12.5px] font-bold hover:bg-surface-2 transition disabled:opacity-60"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <MailSearch size={14} />}
        {isPending ? "Checking inbox…" : "Check for replies"}
      </button>
      {result && !isPending && (
        <div className="text-[11.5px] text-muted-2">
          Checked {result.checked}, found{" "}
          <span className="font-bold text-green">{result.newReplies} new repl{result.newReplies === 1 ? "y" : "ies"}</span>
          {result.errors.length > 0 && <span className="text-pink"> · {result.errors.length} error(s)</span>}
        </div>
      )}
    </div>
  );
}
