"use client";

import { useTransition } from "react";
import { CheckCircle2, Mail, Unplug } from "lucide-react";
import { disconnectGmailAction } from "@/app/actions";

const ERROR_MESSAGES: Record<string, string> = {
  not_configured:
    "GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET aren't set in .env.local yet — add them and restart the dev server.",
  access_denied: "You declined access on Google's consent screen — nothing was connected.",
  no_refresh_token:
    "Google didn't return a refresh token. This can happen on a repeat connect — try disconnecting any prior access at myaccount.google.com/permissions, then connect again.",
  missing_code: "Google didn't return an authorization code. Try connecting again.",
};

export function GmailConnect({
  configured,
  connectedEmail,
  justConnected,
  error,
}: {
  configured: boolean;
  connectedEmail: string | null;
  justConnected: boolean;
  error: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-[20px] bg-surface p-5">
      <h2 className="text-[13px] font-bold mb-1">Gmail reply sync</h2>
      <p className="text-[12px] text-muted mb-3.5">
        Read-only — checks your inbox for replies from leads you&apos;ve sent to and classifies
        them automatically. Never sends or modifies anything in Gmail.
      </p>

      {justConnected && (
        <div className="mb-3 rounded-full bg-green-soft text-green px-3.5 py-2 text-[12px] font-semibold w-fit">
          Connected successfully.
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-[14px] bg-pink-soft text-pink px-3.5 py-2.5 text-[12px] font-medium">
          {ERROR_MESSAGES[error] ?? error}
        </div>
      )}

      {connectedEmail ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-surface-2 px-3.5 py-2">
            <CheckCircle2 size={14} className="text-green" />
            <span className="text-[12.5px] font-semibold">Connected as {connectedEmail}</span>
          </div>
          <button
            onClick={() => startTransition(() => disconnectGmailAction())}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3.5 py-2 text-[12px] font-semibold text-muted hover:text-pink transition disabled:opacity-50"
          >
            <Unplug size={13} />
            Disconnect
          </button>
        </div>
      ) : (
        <a
          href="/api/auth/gmail/start"
          aria-disabled={!configured}
          className={
            configured
              ? "inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-[13px] font-bold text-background hover:opacity-90 transition"
              : "inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2.5 text-[13px] font-bold text-muted-2 cursor-not-allowed pointer-events-none"
          }
        >
          <Mail size={15} />
          Connect Gmail
        </a>
      )}
    </div>
  );
}
