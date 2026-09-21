import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { audits, contacts, leads, outreach, settings as settingsTable } from "@/lib/db/schema";

export type LeadRow = typeof leads.$inferSelect;
export type AuditRow = typeof audits.$inferSelect;
export type ContactRow = typeof contacts.$inferSelect;
export type OutreachRow = typeof outreach.$inferSelect;
export type SettingsRow = typeof settingsTable.$inferSelect;

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
  return { lead, audit: audit ?? null, contact: contact ?? null, outreach: outreachRow ?? null };
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
