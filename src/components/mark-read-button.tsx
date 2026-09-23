"use client";

import { useTransition } from "react";
import { Mail, MailOpen } from "lucide-react";
import { setOutreachReadAction } from "@/app/actions";

export function MarkReadButton({ outreachId, read }: { outreachId: string; read: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(() => setOutreachReadAction(outreachId, !read));
      }}
      disabled={isPending}
      title={read ? "Mark as unread" : "Mark as read"}
      className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted hover:text-foreground transition disabled:opacity-50 shrink-0"
    >
      {read ? <MailOpen size={12} /> : <Mail size={12} />}
      {read ? "Read" : "Mark as read"}
    </button>
  );
}
