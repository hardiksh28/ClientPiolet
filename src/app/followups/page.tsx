import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getFollowupsDueList } from "@/lib/data";
import { SourceBadge } from "@/components/badges";
import { daysSince } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FollowupsPage() {
  const items = getFollowupsDueList();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[32px] font-extrabold tracking-tight">Follow-ups</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          {items.length} sent lead{items.length === 1 ? "" : "s"} past the day-4/day-9 window with
          no reply yet.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[20px] bg-surface px-6 py-14 text-center">
          <CheckCircle2 size={22} className="mx-auto mb-3 text-green" />
          <p className="text-[13.5px] text-muted">
            Nothing due right now — every sent lead is either within its waiting window or has
            already replied.
          </p>
        </div>
      ) : (
        <div className="rounded-[20px] bg-surface overflow-hidden divide-y divide-border">
          {items.map(({ lead, outreach, dueSince }) => {
            const days = daysSince(dueSince);
            const nextKind = outreach.kind === "initial" ? "Follow-up 1" : "Follow-up 2";
            return (
              <Link
                key={outreach.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 hover:bg-surface-2 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 rounded-full bg-yellow text-yellow-on px-2.5 py-1 text-[11px] font-bold">
                    {nextKind}
                  </span>
                  <span className="font-semibold text-[13.5px] truncate">{lead.company}</span>
                  <SourceBadge source={lead.source} />
                </div>
                <span className="text-[11.5px] text-muted-2 shrink-0">sent {days}d ago</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
