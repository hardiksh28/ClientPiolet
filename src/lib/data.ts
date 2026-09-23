import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiAnalysis, audits, contacts, deals, leads, outreach, settings as settingsTable } from "@/lib/db/schema";

export type LeadRow = typeof leads.$inferSelect;
export type AuditRow = typeof audits.$inferSelect;
export type ContactRow = typeof contacts.$inferSelect;
export type OutreachRow = typeof outreach.$inferSelect;
export type SettingsRow = typeof settingsTable.$inferSelect;
export type AiAnalysisRow = typeof aiAnalysis.$inferSelect;
export type DealRow = typeof deals.$inferSelect;

export function getSettings(): SettingsRow {
  const row = db.select().from(settingsTable).where(eq(settingsTable.id, 1)).get();
  if (!row) throw new Error("settings row missing");
  return row;
}

export function getStats() {
  const counts = db
    .select({ status: leads.status, c: sql<number>`count(*)` })
    .from(leads)
    .groupBy(leads.status)
    .all();

  const byStatus: Record<string, number> = {};
  for (const row of counts) byStatus[row.status] = Number(row.c);

  const totalLeads = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const sent = byStatus.sent ?? 0;
  const replied = byStatus.replied ?? 0;
  const sentOrReplied = sent + replied;
  const replyRate = sentOrReplied > 0 ? Math.round((replied / sentOrReplied) * 100) : null;

  return {
    totalLeads,
    queued: byStatus.queued ?? 0,
    sent,
    replied,
    archived: byStatus.archived ?? 0,
    replyRate,
  };
}

export function getQueuedLeads(limit = 8): LeadRow[] {
  return db
    .select()
    .from(leads)
    .where(eq(leads.status, "queued"))
    .orderBy(desc(leads.score))
    .limit(limit)
    .all();
}

export function getRecentLeads(limit = 10): LeadRow[] {
  return db.select().from(leads).orderBy(desc(leads.createdAt)).limit(limit).all();
}

export type LeadFilter = {
  status?: string;
  source?: string;
  q?: string;
};

export function getLeads(filter: LeadFilter): LeadRow[] {
  let rows = db.select().from(leads).orderBy(desc(leads.score)).all();
  if (filter.status) rows = rows.filter((r) => r.status === filter.status);
  if (filter.source) rows = rows.filter((r) => r.source === filter.source);
  if (filter.q) {
    const q = filter.q.toLowerCase();
    rows = rows.filter(
      (r) => r.company.toLowerCase().includes(q) || r.domain.toLowerCase().includes(q)
    );
  }
  return rows;
}

export function getLatestOutreachForLeads(leadIds: string[]): Map<string, OutreachRow> {
  if (leadIds.length === 0) return new Map();
  const rows = db.select().from(outreach).all();
  const map = new Map<string, OutreachRow>();
  for (const row of rows) {
    if (!leadIds.includes(row.leadId)) continue;
    const existing = map.get(row.leadId);
    if (!existing || row.draftedAt > existing.draftedAt) map.set(row.leadId, row);
  }
  return map;
}

export type NextActionItem = {
  lead: LeadRow;
  outreach: OutreachRow;
  kind: "hot_reply" | "reply" | "followup_due";
};

/**
 * "What should I do right now" — recently replied leads (freshest first)
 * and sent leads whose day-4/day-9 follow-up window has opened with no
 * reply yet. Deliberately lightweight: computed from existing columns, not
 * a separate stored "next action" — see README for why.
 */
export function getNeedsAttention(limit = 6): NextActionItem[] {
  const repliedRows = db
    .select()
    .from(outreach)
    .where(sql`${outreach.repliedAt} is not null`)
    .orderBy(desc(outreach.repliedAt))
    .limit(limit)
    .all();

  const sentAwaitingRows = db
    .select()
    .from(outreach)
    .where(sql`${outreach.sentAt} is not null and ${outreach.repliedAt} is null`)
    .all();

  const leadIds = [...new Set([...repliedRows, ...sentAwaitingRows].map((o) => o.leadId))];
  const leadRows = leadIds.length
    ? db.select().from(leads).where(inArray(leads.id, leadIds)).all()
    : [];
  const leadById = new Map(leadRows.map((l) => [l.id, l]));

  const items: NextActionItem[] = [];

  for (const o of repliedRows) {
    const lead = leadById.get(o.leadId);
    if (!lead) continue;
    items.push({ lead, outreach: o, kind: o.replyClass === "hot" ? "hot_reply" : "reply" });
  }

  const now = Date.now();
  for (const o of sentAwaitingRows) {
    if (!o.sentAt) continue;
    const days = Math.floor((now - o.sentAt) / (1000 * 60 * 60 * 24));
    const dueForFollowup = (o.kind === "initial" && days >= 4) || (o.kind === "followup_1" && days >= 9);
    if (!dueForFollowup) continue;
    const lead = leadById.get(o.leadId);
    if (!lead) continue;
    items.push({ lead, outreach: o, kind: "followup_due" });
  }

  const rank = { hot_reply: 0, reply: 1, followup_due: 2 };
  items.sort((a, b) => rank[a.kind] - rank[b.kind]);
  return items.slice(0, limit);
}

export function getLeadDetail(id: string) {
  const lead = db.select().from(leads).where(eq(leads.id, id)).get();
  if (!lead) return null;
  const audit = db
    .select()
    .from(audits)
    .where(eq(audits.leadId, id))
    .orderBy(desc(audits.fetchedAt))
    .get();
  const contact = db.select().from(contacts).where(eq(contacts.leadId, id)).get();
  const outreachRow = db
    .select()
    .from(outreach)
    .where(eq(outreach.leadId, id))
    .orderBy(desc(outreach.draftedAt))
    .get();
  const ai = db
    .select()
    .from(aiAnalysis)
    .where(eq(aiAnalysis.leadId, id))
    .orderBy(desc(aiAnalysis.analyzedAt))
    .get();
  const deal = db.select().from(deals).where(eq(deals.leadId, id)).get();
  return {
    lead,
    audit: audit ?? null,
    contact: contact ?? null,
    outreach: outreachRow ?? null,
    ai: ai ?? null,
    deal: deal ?? null,
  };
}

export function getDealsForLeads(leadIds: string[]): Map<string, DealRow> {
  if (leadIds.length === 0) return new Map();
  const rows = db.select().from(deals).where(inArray(deals.leadId, leadIds)).all();
  return new Map(rows.map((d) => [d.leadId, d]));
}

function startOfDay(ts = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(ts = Date.now()): number {
  const d = new Date(ts);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Real counts for the Overview stat row — no placeholders. */
export function getOverviewStats() {
  const todayStart = startOfDay();
  const weekStart = startOfWeek();

  const newToday = db
    .select({ c: sql<number>`count(*)` })
    .from(leads)
    .where(sql`${leads.createdAt} >= ${todayStart}`)
    .get();

  const sentThisWeek = db
    .select({ c: sql<number>`count(*)` })
    .from(outreach)
    .where(sql`${outreach.sentAt} is not null and ${outreach.sentAt} >= ${weekStart}`)
    .get();

  const repliesThisWeek = db
    .select({ c: sql<number>`count(*)` })
    .from(outreach)
    .where(sql`${outreach.repliedAt} is not null and ${outreach.repliedAt} >= ${weekStart}`)
    .get();

  const interested = db
    .select({ c: sql<number>`count(*)` })
    .from(outreach)
    .where(sql`${outreach.replyClass} in ('hot', 'interested')`)
    .get();

  return {
    newOpportunitiesToday: Number(newToday?.c ?? 0),
    outreachSentThisWeek: Number(sentThisWeek?.c ?? 0),
    repliesThisWeek: Number(repliesThisWeek?.c ?? 0),
    interestedLeads: Number(interested?.c ?? 0),
  };
}

/**
 * Funnel counts. Mapped onto the real state machine, not a separate stored
 * stage: Discovered = every researched lead; Qualified = cleared every
 * deterministic (+ AI, if enabled) gate, whether or not it's been sent yet;
 * Contacted = sent or replied; Replied; Interested = replied hot/interested;
 * Closed = replyClass no/not_now, or a followup_2 sent with no reply (the
 * "two follow-ups max, then it closes" rule already used on the lead page).
 */
export function getPipelineFunnel() {
  const discovered = db.select({ c: sql<number>`count(*)` }).from(leads).get();

  const qualified = db
    .select({ c: sql<number>`count(*)` })
    .from(leads)
    .where(sql`${leads.status} in ('queued', 'sent', 'replied')`)
    .get();

  const contacted = db
    .select({ c: sql<number>`count(*)` })
    .from(leads)
    .where(sql`${leads.status} in ('sent', 'replied')`)
    .get();

  const replied = db.select({ c: sql<number>`count(*)` }).from(leads).where(eq(leads.status, "replied")).get();

  const interested = db
    .select({ c: sql<number>`count(distinct ${outreach.leadId})` })
    .from(outreach)
    .where(sql`${outreach.replyClass} in ('hot', 'interested')`)
    .get();

  const closedNegative = db
    .select({ c: sql<number>`count(distinct ${outreach.leadId})` })
    .from(outreach)
    .where(sql`${outreach.replyClass} in ('no', 'not_now')`)
    .get();
  const closedNoReplyAfterFollowups = db
    .select({ c: sql<number>`count(*)` })
    .from(outreach)
    .where(sql`${outreach.kind} = 'followup_2' and ${outreach.sentAt} is not null and ${outreach.repliedAt} is null`)
    .get();

  return {
    discovered: Number(discovered?.c ?? 0),
    qualified: Number(qualified?.c ?? 0),
    contacted: Number(contacted?.c ?? 0),
    replied: Number(replied?.c ?? 0),
    interested: Number(interested?.c ?? 0),
    closed: Number(closedNegative?.c ?? 0) + Number(closedNoReplyAfterFollowups?.c ?? 0),
  };
}

export type OutreachListItem = { lead: LeadRow; outreach: OutreachRow };

export function getOutreachList(filter?: { status?: "draft" | "sent" | "replied" }): OutreachListItem[] {
  const rows = db.select().from(outreach).orderBy(desc(outreach.draftedAt)).all();
  const leadIds = [...new Set(rows.map((o) => o.leadId))];
  const leadRows = leadIds.length ? db.select().from(leads).where(inArray(leads.id, leadIds)).all() : [];
  const leadById = new Map(leadRows.map((l) => [l.id, l]));

  const items: OutreachListItem[] = [];
  for (const o of rows) {
    const lead = leadById.get(o.leadId);
    if (!lead) continue;
    const status = o.repliedAt ? "replied" : o.sentAt ? "sent" : "draft";
    if (filter?.status && filter.status !== status) continue;
    items.push({ lead, outreach: o });
  }
  return items;
}

export type InboxReplyItem = { lead: LeadRow; outreach: OutreachRow };

/** Recent-enough-to-still-matter reply count, used for the sidebar badge —
 * there's no read/unread tracking, so "recent" (7 days) stands in for it. */
export function getRecentInboxCount(): number {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const row = db
    .select({ c: sql<number>`count(*)` })
    .from(outreach)
    .where(sql`${outreach.repliedAt} is not null and ${outreach.repliedAt} >= ${weekAgo}`)
    .get();
  return Number(row?.c ?? 0);
}

export function getInboxReplies(): InboxReplyItem[] {
  const rows = db
    .select()
    .from(outreach)
    .where(sql`${outreach.repliedAt} is not null`)
    .orderBy(desc(outreach.repliedAt))
    .all();
  const leadIds = [...new Set(rows.map((o) => o.leadId))];
  const leadRows = leadIds.length ? db.select().from(leads).where(inArray(leads.id, leadIds)).all() : [];
  const leadById = new Map(leadRows.map((l) => [l.id, l]));
  return rows.flatMap((o) => {
    const lead = leadById.get(o.leadId);
    return lead ? [{ lead, outreach: o }] : [];
  });
}

export type FollowupItem = { lead: LeadRow; outreach: OutreachRow; dueSince: number };

export function getFollowupsDueList(): FollowupItem[] {
  const rows = db
    .select()
    .from(outreach)
    .where(sql`${outreach.sentAt} is not null and ${outreach.repliedAt} is null`)
    .all();
  const leadIds = [...new Set(rows.map((o) => o.leadId))];
  const leadRows = leadIds.length ? db.select().from(leads).where(inArray(leads.id, leadIds)).all() : [];
  const leadById = new Map(leadRows.map((l) => [l.id, l]));

  const now = Date.now();
  const items: FollowupItem[] = [];
  for (const o of rows) {
    if (!o.sentAt) continue;
    const days = Math.floor((now - o.sentAt) / (1000 * 60 * 60 * 24));
    const due = (o.kind === "initial" && days >= 4) || (o.kind === "followup_1" && days >= 9);
    if (!due) continue;
    const lead = leadById.get(o.leadId);
    if (!lead) continue;
    items.push({ lead, outreach: o, dueSince: o.sentAt });
  }
  return items.sort((a, b) => a.dueSince - b.dueSince);
}

export function getLatestAiForLeads(leadIds: string[]): Map<string, AiAnalysisRow> {
  if (leadIds.length === 0) return new Map();
  const rows = db.select().from(aiAnalysis).where(inArray(aiAnalysis.leadId, leadIds)).all();
  const map = new Map<string, AiAnalysisRow>();
  for (const row of rows) {
    const existing = map.get(row.leadId);
    if (!existing || row.analyzedAt > existing.analyzedAt) map.set(row.leadId, row);
  }
  return map;
}

/**
 * Real, computed insights — no invented claims. Each string is grounded in
 * an actual query result; if there's nothing to say, nothing is returned.
 */
export function getInsights(): string[] {
  const insights: string[] = [];
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

  const newLeadsBySource = db
    .select({ source: leads.source, c: sql<number>`count(*)` })
    .from(leads)
    .where(sql`${leads.createdAt} >= ${dayAgo}`)
    .groupBy(leads.source)
    .all();
  const topSource = newLeadsBySource.sort((a, b) => Number(b.c) - Number(a.c))[0];
  if (topSource && Number(topSource.c) > 0) {
    insights.push(
      `${topSource.c} new lead${Number(topSource.c) === 1 ? "" : "s"} found via ${
        { job_board: "job boards", product_hunt: "Product Hunt", directory: "Show HN / directories", github: "GitHub" }[
          topSource.source
        ] ?? topSource.source
      } in the last 24h.`
    );
  }

  const staleCount = getFollowupsDueList().length;
  if (staleCount > 0) {
    insights.push(
      `${staleCount} sent lead${staleCount === 1 ? "" : "s"} ${
        staleCount === 1 ? "hasn't" : "haven't"
      } replied and ${staleCount === 1 ? "is" : "are"} ready for a follow-up.`
    );
  }

  const hotCount = db
    .select({ c: sql<number>`count(*)` })
    .from(outreach)
    .where(sql`${outreach.replyClass} = 'hot' and ${outreach.repliedAt} is not null`)
    .get();
  if (Number(hotCount?.c ?? 0) > 0) {
    insights.push(`${hotCount!.c} hot repl${Number(hotCount!.c) === 1 ? "y" : "ies"} waiting on you in the Inbox.`);
  }

  return insights;
}

export type DealListItem = { lead: LeadRow; deal: DealRow };

const ACTIVE_DEAL_STATUSES = ["estimated", "proposed", "negotiating"];
const OPEN_DEAL_STATUSES = [...ACTIVE_DEAL_STATUSES, "won", "invoiced", "partially_paid"];

export function getEarningsSummary() {
  const allDeals = db.select().from(deals).all();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const totalEarned = allDeals.reduce((sum, d) => sum + d.amountPaid, 0);
  const earnedThisMonth = allDeals
    .filter((d) => d.paidAt && d.paidAt >= monthStart)
    .reduce((sum, d) => sum + d.amountPaid, 0);

  const pipelineValue = allDeals
    .filter((d) => ACTIVE_DEAL_STATUSES.includes(d.status))
    .reduce((sum, d) => sum + d.currentPrice, 0);
  const activeCount = allDeals.filter((d) => ACTIVE_DEAL_STATUSES.includes(d.status)).length;

  const pendingPayment = allDeals
    .filter((d) => d.status === "invoiced" || d.status === "partially_paid")
    .reduce((sum, d) => sum + (d.currentPrice - d.amountPaid), 0);

  const wonTotal = allDeals
    .filter((d) => OPEN_DEAL_STATUSES.includes(d.status) && d.status !== "estimated")
    .reduce((sum, d) => sum + d.currentPrice, 0);

  // Monthly earned totals for the last 6 months, oldest first — real
  // history from paidAt timestamps, not synthetic/interpolated data. A
  // month with nothing paid is genuinely 0, shown as such.
  const months: { label: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = d.getTime();
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime();
    const total = allDeals
      .filter((deal) => deal.paidAt && deal.paidAt >= start && deal.paidAt < end)
      .reduce((sum, deal) => sum + deal.amountPaid, 0);
    months.push({ label: d.toLocaleString("en-US", { month: "short" }), total });
  }

  return {
    totalEarned,
    earnedThisMonth,
    pipelineValue,
    activeCount,
    pendingPayment,
    wonTotal,
    months,
  };
}

export function getDealsList(): DealListItem[] {
  const rows = db.select().from(deals).orderBy(desc(deals.updatedAt)).all();
  const leadIds = rows.map((d) => d.leadId);
  const leadRows = leadIds.length ? db.select().from(leads).where(inArray(leads.id, leadIds)).all() : [];
  const leadById = new Map(leadRows.map((l) => [l.id, l]));
  return rows.flatMap((deal) => {
    const lead = leadById.get(deal.leadId);
    return lead ? [{ lead, deal }] : [];
  });
}

/** Average won price per service — only returned once there's at least one
 * won deal for that service. No zero-based or extrapolated averages. */
export function getHistoricalAveragesByService(): { service: string; avg: number; count: number }[] {
  const won = db.select().from(deals).where(sql`${deals.status} != 'estimated' and ${deals.wonAt} is not null`).all();
  const bySvc = new Map<string, number[]>();
  for (const d of won) {
    const arr = bySvc.get(d.service) ?? [];
    arr.push(d.currentPrice);
    bySvc.set(d.service, arr);
  }
  return [...bySvc.entries()].map(([service, prices]) => ({
    service,
    avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    count: prices.length,
  }));
}

export function getAnalytics() {
  const allLeads = db.select().from(leads).all();
  const allOutreach = db.select().from(outreach).all();

  const bySource: Record<string, { total: number; sent: number; replied: number }> = {};
  for (const lead of allLeads) {
    bySource[lead.source] ??= { total: 0, sent: 0, replied: 0 };
    bySource[lead.source].total++;
    if (lead.status === "sent") bySource[lead.source].sent++;
    if (lead.status === "replied") bySource[lead.source].replied++;
  }

  const byService: Record<string, { sent: number; replied: number }> = {};
  for (const o of allOutreach) {
    if (!o.service) continue;
    byService[o.service] ??= { sent: 0, replied: 0 };
    if (o.sentAt) byService[o.service].sent++;
    if (o.repliedAt) byService[o.service].replied++;
  }

  const archiveReasons: Record<string, number> = {};
  for (const lead of allLeads) {
    if (lead.status !== "archived" || !lead.archiveReason) continue;
    archiveReasons[lead.archiveReason] = (archiveReasons[lead.archiveReason] ?? 0) + 1;
  }

  const sentCount = allLeads.filter((l) => l.status === "sent" || l.status === "replied").length;
  const repliedCount = allLeads.filter((l) => l.status === "replied").length;

  return { bySource, byService, archiveReasons, sentCount, repliedCount };
}
