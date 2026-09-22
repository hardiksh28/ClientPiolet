import Link from "next/link";
import { Suspense } from "react";
import { getLatestOutreachForLeads, getLeads } from "@/lib/data";
import { LeadsFilterBar } from "@/components/leads-filter-bar";
import { ScoreBadge, SourceBadge, StatusPill } from "@/components/badges";
import { DismissButton } from "@/components/dismiss-button";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: PageProps<"/leads">) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : undefined;
  const source = typeof params.source === "string" ? params.source : undefined;
  const q = typeof params.q === "string" ? params.q : undefined;

  const leads = getLeads({ status, source, q });
  const outreachByLead = getLatestOutreachForLeads(leads.map((l) => l.id));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[32px] font-extrabold tracking-tight">Opportunities</h1>
        <p className="mt-1 text-[13.5px] text-muted">{leads.length} matching this filter.</p>
      </div>

      <Suspense>
        <LeadsFilterBar />
      </Suspense>

      <div className="rounded-[20px] bg-surface overflow-hidden">
        {leads.length === 0 ? (
          <div className="px-6 py-14 text-center text-[13.5px] text-muted">No leads match this filter.</div>
        ) : (
          <div className="divide-y divide-border">
            {leads.map((lead) => {
              const draft = outreachByLead.get(lead.id);
              return (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center gap-4 px-4 sm:px-5 py-3.5 hover:bg-surface-2 transition group"
                >
                  <ScoreBadge score={lead.score} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[13.5px] truncate">{lead.company}</span>
                      {draft?.service && (
                        <span className="hidden md:inline text-[11px] text-muted-2 truncate">
                          {draft.service}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11.5px] text-muted-2 truncate">{lead.domain}</div>
                  </div>
                  <div className="hidden sm:block shrink-0">
                    <SourceBadge source={lead.source} />
                  </div>
                  <div className="shrink-0">
                    <StatusPill status={lead.status} />
                  </div>
                  <span className="hidden lg:inline text-[11px] text-muted-2 w-16 text-right shrink-0">
                    {timeAgo(lead.createdAt)}
                  </span>
                  {lead.status === "queued" && (
                    <div className="shrink-0">
                      <DismissButton leadId={lead.id} />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
