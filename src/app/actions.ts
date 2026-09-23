"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { deals, leads, outreach, settings as settingsTable } from "@/lib/db/schema";
import { reconsiderArchivedLeads, runPipeline } from "@/lib/pipeline/run";
import { syncGmailReplies, type GmailSyncResult } from "@/lib/pipeline/gmail-sync";
import { draftFollowup } from "@/lib/pipeline/draft";
import type { PipelineRunSummary } from "@/lib/pipeline/types";

export async function runPipelineAction(): Promise<PipelineRunSummary> {
  const summary = await runPipeline();
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath("/analytics");
  revalidatePath("/pipeline");
  return summary;
}

/** Same as runPipelineAction, but also stamps lastAutoRunAt — called by the
 * client-side automation scheduler, never by a real background cron (there
 * isn't one in this local dev setup). */
export async function autoRunPipelineAction(): Promise<PipelineRunSummary> {
  const summary = await runPipeline();
  db.update(settingsTable).set({ lastAutoRunAt: Date.now() }).where(eq(settingsTable.id, 1)).run();
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath("/analytics");
  revalidatePath("/pipeline");
  return summary;
}

export async function setAutomationAction(enabled: boolean, intervalMinutes: number) {
  db.update(settingsTable)
    .set({ automationEnabled: enabled, automationIntervalMinutes: intervalMinutes })
    .where(eq(settingsTable.id, 1))
    .run();
  revalidatePath("/");
  revalidatePath("/settings");
}

export async function markSentAction(leadId: string, outreachId: string) {
  const now = Date.now();
  db.update(outreach).set({ sentAt: now }).where(eq(outreach.id, outreachId)).run();
  db.update(leads).set({ status: "sent", updatedAt: now }).where(eq(leads.id, leadId)).run();
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/analytics");
}

export async function dismissLeadAction(leadId: string) {
  const now = Date.now();
  db.update(leads)
    .set({ status: "archived", archiveReason: "dismissed", updatedAt: now })
    .where(eq(leads.id, leadId))
    .run();
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function setOutreachReadAction(outreachId: string, read: boolean) {
  db.update(outreach)
    .set({ readAt: read ? Date.now() : null })
    .where(eq(outreach.id, outreachId))
    .run();
  revalidatePath("/");
  revalidatePath("/inbox");
}

export async function markRepliedAction(
  leadId: string,
  outreachId: string,
  replyClass: "hot" | "interested" | "maybe" | "not_now" | "no"
) {
  const now = Date.now();
  db.update(outreach)
    .set({ repliedAt: now, replyClass })
    .where(eq(outreach.id, outreachId))
    .run();
  db.update(leads).set({ status: "replied", updatedAt: now }).where(eq(leads.id, leadId)).run();
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/analytics");
}

export async function updateDraftAction(outreachId: string, subject: string, body: string) {
  db.update(outreach).set({ subject, body }).where(eq(outreach.id, outreachId)).run();
  revalidatePath("/leads");
}

export async function generateFollowupAction(leadId: string, kind: "followup_1" | "followup_2") {
  const lead = db.select().from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) throw new Error("Lead not found");
  const settingsRow = db.select().from(settingsTable).where(eq(settingsTable.id, 1)).get();
  const senderName = settingsRow?.senderName ?? "Hardik";

  const draft = draftFollowup(kind, lead.company, senderName);
  const now = Date.now();
  db.insert(outreach)
    .values({
      id: randomUUID(),
      leadId,
      kind,
      subject: draft.subject,
      body: draft.body,
      service: null,
      draftedAt: now,
    })
    .run();

  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function syncGmailRepliesAction(): Promise<GmailSyncResult> {
  const result = await syncGmailReplies();
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath("/analytics");
  return result;
}

export async function disconnectGmailAction() {
  db.update(settingsTable)
    .set({ gmailRefreshToken: null, gmailConnectedEmail: null })
    .where(eq(settingsTable.id, 1))
    .run();
  revalidatePath("/settings");
}

export async function updateSettingsAction(data: {
  services: string[];
  countries: string[];
  minScore: number;
  dailyLimit: number;
  portfolioUrl: string;
  senderName: string;
}): Promise<{ requeued: number; reevaluated: number }> {
  db.update(settingsTable)
    .set({
      services: JSON.stringify(data.services),
      countries: JSON.stringify(data.countries),
      minScore: data.minScore,
      dailyLimit: data.dailyLimit,
      portfolioUrl: data.portfolioUrl,
      senderName: data.senderName,
    })
    .where(eq(settingsTable.id, 1))
    .run();

  // Re-apply the (possibly just-changed) scoring formula to leads that were
  // only archived for scoring below the old threshold — using the real
  // audit/contact data already on file, no re-fetch.
  const result = await reconsiderArchivedLeads();

  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath("/analytics");
  return result;
}

export async function updatePricingSettingsAction(data: {
  servicePricing: Record<string, number>;
  monthlyTarget: number;
}) {
  db.update(settingsTable)
    .set({
      servicePricing: JSON.stringify(data.servicePricing),
      monthlyTarget: data.monthlyTarget,
    })
    .where(eq(settingsTable.id, 1))
    .run();
  revalidatePath("/settings");
  revalidatePath("/earnings");
}

export async function overrideDealPriceAction(dealId: string, newPrice: number) {
  db.update(deals)
    .set({ currentPrice: newPrice, updatedAt: Date.now() })
    .where(eq(deals.id, dealId))
    .run();
  revalidatePath("/leads");
  revalidatePath("/earnings");
}

export type DealStatus =
  | "estimated"
  | "proposed"
  | "negotiating"
  | "won"
  | "invoiced"
  | "partially_paid"
  | "paid"
  | "lost";

export async function advanceDealStatusAction(dealId: string, status: DealStatus) {
  const now = Date.now();
  const patch: Partial<typeof deals.$inferInsert> = { status, updatedAt: now };
  if (status === "won") patch.wonAt = now;
  if (status === "paid") {
    patch.paidAt = now;
    const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
    if (deal) patch.amountPaid = deal.currentPrice;
  }
  db.update(deals).set(patch).where(eq(deals.id, dealId)).run();
  revalidatePath("/leads");
  revalidatePath("/earnings");
  revalidatePath("/pipeline");
}

export async function recordPaymentAction(dealId: string, amount: number) {
  const deal = db.select().from(deals).where(eq(deals.id, dealId)).get();
  if (!deal) throw new Error("Deal not found");
  const now = Date.now();
  const totalPaid = deal.amountPaid + amount;
  const status = totalPaid >= deal.currentPrice ? "paid" : "partially_paid";
  db.update(deals)
    .set({
      amountPaid: totalPaid,
      status,
      paidAt: status === "paid" ? now : deal.paidAt,
      updatedAt: now,
    })
    .where(eq(deals.id, dealId))
    .run();
  revalidatePath("/leads");
  revalidatePath("/earnings");
  revalidatePath("/pipeline");
}
