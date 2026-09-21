"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { dismissLeadAction } from "@/app/actions";

export function DismissButton({ leadId }: { leadId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(() => dismissLeadAction(leadId));
      }}
      disabled={isPending}
      title="Dismiss"
      className="inline-flex items-center justify-center rounded-full h-7 w-7 text-muted-2 hover:text-pink hover:bg-pink-soft transition disabled:opacity-50"
    >
      <X size={13} strokeWidth={2.3} />
    </button>
  );
}
