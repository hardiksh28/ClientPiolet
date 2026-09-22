import Link from "next/link";
import { getOutreachList } from "@/lib/data";
import { SourceBadge } from "@/components/badges";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { value: undefined, label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "replied", label: "Replied" },
] as const;

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-blue text-blue-on",
  sent: "bg-yellow text-yellow-on",
  replied: "bg-green text-green-on",
};

export default async function OutreachPage({ searchParams }: PageProps<"/outreach">) {
  const params = await searchParams;
  const statusParam = typeof params.status === "string" ? params.status : undefined;
  const filter = statusParam as "draft" | "sent" | "replied" | undefined;

  const items = getOutreachList(filter ? { status: filter } : undefined);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[32px] font-extrabold tracking-tight">Outreach</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          Every message ClientPilot has drafted — {items.length} matching this filter.
        </p>
      </div>

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.label}
            href={tab.value ? `/outreach?status=${tab.value}` : "/outreach"}
            className={`rounded-full px-4 py-2 text-[12.5px] font-bold transition ${
              statusParam === tab.value
                ? "bg-foreground text-background"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="rounded-[20px] bg-surface overflow-hidden">
        {items.length === 0 ? (
          <div className="px-6 py-14 text-center text-[13.5px] text-muted">
            No outreach messages match this filter yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map(({ lead, outreach }) => {
              const status = outreach.repliedAt ? "replied" : outreach.sentAt ? "sent" : "draft";
              return (
                <Link
                  key={outreach.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center gap-4 px-4 sm:px-5 py-3.5 hover:bg-surface-2 transition"
                >
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${STATUS_STYLE[status]}`}>
                    {status}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[13.5px] truncate">{outreach.subject}</div>
                    <div className="text-[11.5px] text-muted-2 truncate">
                      {lead.company} · {outreach.kind.replace("_", " ")}
                    </div>
                  </div>
                  <div className="hidden sm:block shrink-0">
                    <SourceBadge source={lead.source} />
                  </div>
                  <span className="text-[11px] text-muted-2 w-16 text-right shrink-0">
                    {timeAgo(outreach.draftedAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
