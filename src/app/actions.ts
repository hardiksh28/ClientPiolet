"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { leads, outreach, settings as settingsTable } from "@/lib/db/schema";
import { reconsiderArchivedLeads, runPipeline } from "@/lib/pipeline/run";
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
