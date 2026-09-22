import Link from "next/link";
import { MessageSquareOff } from "lucide-react";
import { getInboxReplies, getSettings } from "@/lib/data";
import { SourceBadge } from "@/components/badges";
import { SyncRepliesButton } from "@/components/sync-replies-button";
import { cn, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CLASS_STYLE: Record<string, string> = {
  hot: "bg-pink text-pink-on",
  interested: "bg-green text-green-on",
  maybe: "bg-yellow text-yellow-on",
  not_now: "bg-surface-2 text-muted",
  no: "bg-surface-2 text-muted",
  auto: "bg-blue text-blue-on",
};

const CLASS_LABEL: Record<string, string> = {
  hot: "Hot — wants to talk",
  interested: "Interested",
  maybe: "Maybe later",
  not_now: "Not now",
  no: "No",
  auto: "Needs a look",
};

export default async function InboxPage() {
  const replies = getInboxReplies();
  const gmailConnected = !!getSettings().gmailConnectedEmail;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight">Inbox</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {replies.length} repl{replies.length === 1 ? "y" : "ies"} across every lead you&apos;ve sent to.
          </p>
        </div>
        <SyncRepliesButton connected={gmailConnected} />
      </div>

      {replies.length === 0 ? (
        <div className="rounded-[20px] bg-surface px-6 py-14 text-center">
          <MessageSquareOff size={22} className="mx-auto mb-3 text-muted-2" />
          <p className="text-[13.5px] text-muted">
            No replies yet — they&apos;ll show up here the moment you mark one manually or Gmail
            sync finds one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {replies.map(({ lead, outreach }) => (
            <Link
              key={outreach.id}
              href={`/leads/${lead.id}`}
              className="block rounded-[20px] bg-surface p-4 hover:brightness-110 transition"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-[14px] truncate">{lead.company}</span>
                  <SourceBadge source={lead.source} />
                </div>
                <span className="text-[11px] text-muted-2 shrink-0">
                  {outreach.repliedAt ? timeAgo(outreach.repliedAt) : ""}
                </span>
              </div>
              {outreach.replySnippet ? (
                <p className="text-[13px] text-muted leading-relaxed mb-2 line-clamp-2">
                  &ldquo;{outreach.replySnippet}&rdquo;
                </p>
              ) : (
                <p className="text-[12px] text-muted-2 italic mb-2">
                  Marked replied manually — no reply text captured.
                </p>
              )}
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold",
                  CLASS_STYLE[outreach.replyClass ?? "auto"]
                )}
              >
                {CLASS_LABEL[outreach.replyClass ?? "auto"]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
