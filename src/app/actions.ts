"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads, outreach, settings as settingsTable } from "@/lib/db/schema";
import { reconsiderArchivedLeads, runPipeline } from "@/lib/pipeline/run";
import { syncGmailReplies, type GmailSyncResult } from "@/lib/pipeline/gmail-sync";
import { draftFollowup } from "@/lib/pipeline/draft";
import type { PipelineRunSummary } from "@/lib/pipeline/types";

export async function runPipelineAction(): Promise<PipelineRunSummary> {
  const summary = await runPipeline();
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath("/analytics");
  return summary;
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
