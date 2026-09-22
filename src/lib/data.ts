import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiAnalysis, audits, contacts, leads, outreach, settings as settingsTable } from "@/lib/db/schema";

export type LeadRow = typeof leads.$inferSelect;
export type AuditRow = typeof audits.$inferSelect;
export type ContactRow = typeof contacts.$inferSelect;
export type OutreachRow = typeof outreach.$inferSelect;
export type SettingsRow = typeof settingsTable.$inferSelect;
export type AiAnalysisRow = typeof aiAnalysis.$inferSelect;

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
  return {
    lead,
    audit: audit ?? null,
    contact: contact ?? null,
    outreach: outreachRow ?? null,
    ai: ai ?? null,
  };
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
