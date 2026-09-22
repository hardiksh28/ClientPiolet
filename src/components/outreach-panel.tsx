"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Mail, MailCheck, RefreshCw, X } from "lucide-react";
import {
  dismissLeadAction,
  generateFollowupAction,
  markRepliedAction,
  markSentAction,
  updateDraftAction,
} from "@/app/actions";
import { cn, daysSince } from "@/lib/utils";
import type { ContactRow, LeadRow, OutreachRow } from "@/lib/data";

const REPLY_CLASSES: { value: "hot" | "interested" | "maybe" | "not_now" | "no"; label: string }[] = [
  { value: "hot", label: "Hot — wants to talk" },
  { value: "interested", label: "Interested" },
  { value: "maybe", label: "Maybe later" },
  { value: "not_now", label: "Not now" },
  { value: "no", label: "No" },
];

export function OutreachPanel({
  lead,
  outreach,
  contact,
}: {
  lead: LeadRow;
  outreach: OutreachRow | null;
  contact: ContactRow | null;
}) {
  const [subject, setSubject] = useState(outreach?.subject ?? "");
  const [body, setBody] = useState(outreach?.body ?? "");
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!outreach) {
    return (
      <div className="rounded-[20px] bg-surface p-6 text-center text-[13px] text-muted">
        {lead.archiveReason === "no_contact" &&
          "No verifiable contact email found — parked without a draft. No pattern-guessing, no bounces."}
        {lead.archiveReason === "no_problems" &&
          "No concrete problems detected on this site — rejected by design, no generic pitch was drafted."}
        {lead.archiveReason === "low_score" &&
          "Score came in below your minimum threshold — archived without drafting."}
        {lead.archiveReason === "dismissed" && "You dismissed this lead."}
        {lead.archiveReason === "fetch_failed" && "Couldn't fetch this site — archived."}
        {lead.archiveReason === "daily_limit_reached" &&
          "This one cleared the bar, but your daily discovery limit was already hit for this run — raise it in Settings and re-run to pick it up."}
        {lead.archiveReason === "ai_not_qualified" &&
          "Passed every deterministic check, but the AI opportunity read below found no real reason to reach out right now — archived without drafting."}
        {!lead.archiveReason && "No draft has been generated for this lead yet."}
      </div>
    );
  }

  // Gate editing/sending on this specific outreach message, not the lead's
  // overall status — a freshly generated follow-up draft is editable and
  // sendable even though the lead itself is already "sent" from the
  // original message.
  const draftIsPending = !outreach.sentAt;

  function handleSave() {
    startTransition(async () => {
      await updateDraftAction(outreach!.id, subject, body);
      setDirty(false);
    });
  }

  async function handleCopy() {
    const text = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard permission denied (or insecure context) — fall back to a
      // hidden textarea + the legacy copy command.
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch {
        /* give up silently — user can still select the text manually */
      }
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  // A real <a target="_blank"> is far less likely to get popup-blocked than
  // window.open() from a click handler — browsers, ad blockers, and privacy
  // extensions are consistently more lenient with genuine link navigation.
  let gmailUrl: string | null = null;
  if (contact) {
    const url = new URL("https://mail.google.com/mail/?view=cm&fs=1");
    url.searchParams.set("to", contact.email);
    url.searchParams.set("su", subject);
    url.searchParams.set("body", body);
    gmailUrl = url.toString();
  }

  const sinceSent = outreach.sentAt ? daysSince(outreach.sentAt) : null;
  const followupDue = sinceSent !== null && !outreach.repliedAt ? (sinceSent >= 9 ? 2 : sinceSent >= 4 ? 1 : 0) : 0;
  const canGenerateFollowup =
    !draftIsPending && !outreach.repliedAt && followupDue > 0 && outreach.kind !== "followup_2";
  const nextFollowupKind = outreach.kind === "initial" ? "followup_1" : "followup_2";
  const closedNoReply = outreach.kind === "followup_2" && !draftIsPending && !outreach.repliedAt;

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] bg-surface overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-[12px] font-bold text-muted-2 uppercase tracking-wide">
            Draft {outreach.kind !== "initial" && `— ${outreach.kind.replace("_", " ")}`}
          </span>
          {dirty && (
            <button
              onClick={handleSave}
              disabled={isPending}
              className="text-[11.5px] font-bold hover:underline disabled:opacity-50"
            >
              Save changes
            </button>
          )}
        </div>
        <div className="p-4 pt-0 space-y-3">
          <input
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setDirty(true);
            }}
            disabled={!draftIsPending}
            className="w-full rounded-[14px] bg-surface-2 px-3.5 py-2.5 text-[13.5px] font-semibold outline-none focus:ring-2 focus:ring-foreground/20 transition disabled:opacity-70"
          />
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setDirty(true);
            }}
            disabled={!draftIsPending}
            rows={10}
            className="w-full resize-none rounded-[14px] bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed outline-none focus:ring-2 focus:ring-foreground/20 transition disabled:opacity-70"
          />
          <div className="flex items-center justify-between text-[11px] text-muted-2">
            <span>{body.trim().split(/\s+/).filter(Boolean).length} words</span>
            {contact ? (
              <span className="font-mono">{contact.email}</span>
            ) : (
              <span className="text-pink">no contact on file</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface px-4 py-2.5 text-[12.5px] font-bold hover:bg-surface-2 transition"
        >
          {copied ? <Check size={14} className="text-green" /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy draft"}
        </button>
        {gmailUrl ? (
          <a
            href={gmailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-surface px-4 py-2.5 text-[12.5px] font-bold hover:bg-surface-2 transition"
          >
            <Mail size={14} />
            Open in Gmail
            <ExternalLink size={11} className="text-muted-2" />
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-4 py-2.5 text-[12.5px] font-bold opacity-50 cursor-not-allowed">
            <Mail size={14} />
            Open in Gmail
            <ExternalLink size={11} className="text-muted-2" />
          </span>
        )}

        {draftIsPending && (
          <button
            onClick={() => startTransition(() => markSentAction(lead.id, outreach.id))}
            disabled={isPending}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-[12.5px] font-bold text-background hover:opacity-90 transition disabled:opacity-60"
          >
            <MailCheck size={14} />
            Mark as sent
          </button>
        )}
        {lead.status === "queued" && draftIsPending && (
          <button
            onClick={() => startTransition(() => dismissLeadAction(lead.id))}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface px-4 py-2.5 text-[12.5px] font-bold text-muted hover:text-pink transition disabled:opacity-60"
          >
            <X size={14} />
            Dismiss
          </button>
        )}
      </div>

      {lead.status === "sent" && (
        <div className="rounded-[20px] bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-muted-2 uppercase tracking-wide">
              Reply tracking
            </span>
            {followupDue > 0 && !draftIsPending && !outreach.repliedAt && (
              <span className="rounded-full bg-yellow text-yellow-on px-2.5 py-1 text-[11px] font-bold">
                Follow-up {followupDue} due
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-muted">
            {draftIsPending
              ? "Draft ready — send it to start tracking."
              : `Sent ${sinceSent}d ago. Two follow-ups max (day 4, day 9), then it closes automatically.`}
          </p>

          {canGenerateFollowup && (
            <button
              onClick={() =>
                startTransition(() => generateFollowupAction(lead.id, nextFollowupKind))
              }
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-yellow text-yellow-on px-3.5 py-2 text-[12px] font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              <RefreshCw size={13} />
              Generate {nextFollowupKind.replace("_", " ")} draft
            </button>
          )}
          {closedNoReply && (
            <p className="text-[12px] text-muted-2">
              Two follow-ups sent, no reply — this lead is closed.
            </p>
          )}

          {!draftIsPending && (
            <div className="flex flex-wrap gap-1.5">
              {REPLY_CLASSES.map((rc) => (
                <button
                  key={rc.value}
                  onClick={() =>
                    startTransition(() => markRepliedAction(lead.id, outreach.id, rc.value))
                  }
                  disabled={isPending}
                  className="rounded-full bg-surface-2 px-3 py-1.5 text-[11.5px] font-semibold hover:bg-foreground hover:text-background transition disabled:opacity-50"
                >
                  {rc.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {lead.status === "replied" && outreach.replyClass && (
        <div className={cn("rounded-[20px] p-4 text-[13px] font-bold", "bg-green-soft text-green")}>
          Marked replied — {REPLY_CLASSES.find((r) => r.value === outreach.replyClass)?.label ?? "auto-detected"}
        </div>
      )}
    </div>
  );
}
