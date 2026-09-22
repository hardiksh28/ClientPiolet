import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { contacts, leads, outreach, settings as settingsTable } from "@/lib/db/schema";
import { refreshAccessToken } from "@/lib/gmail/oauth";
import { classifyReplySnippet, findReplyFrom } from "@/lib/gmail/search";

export type GmailSyncResult = {
  connected: boolean;
  checked: number;
  newReplies: number;
  errors: string[];
};

/**
 * For every sent-but-not-yet-replied outreach message, checks the connected
 * Gmail inbox for a reply from that contact and, if found, marks the lead
 * replied and classifies it with a cheap keyword heuristic. Read-only scope
 * — this never sends or modifies anything in Gmail.
 */
export async function syncGmailReplies(): Promise<GmailSyncResult> {
  const settingsRow = db.select().from(settingsTable).where(eq(settingsTable.id, 1)).get();
  if (!settingsRow?.gmailRefreshToken) {
    return { connected: false, checked: 0, newReplies: 0, errors: [] };
  }

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(settingsRow.gmailRefreshToken);
  } catch (e) {
    return {
      connected: true,
      checked: 0,
      newReplies: 0,
      errors: [`Couldn't refresh Gmail access: ${e instanceof Error ? e.message : String(e)}`],
    };
  }

  const pending = db
    .select({
      outreachId: outreach.id,
      leadId: outreach.leadId,
      sentAt: outreach.sentAt,
      email: contacts.email,
    })
    .from(outreach)
    .innerJoin(leads, eq(leads.id, outreach.leadId))
    .innerJoin(contacts, eq(contacts.leadId, leads.id))
    .where(and(isNotNull(outreach.sentAt), isNull(outreach.repliedAt), eq(leads.status, "sent")))
    .all();

  let checked = 0;
  let newReplies = 0;
  const errors: string[] = [];

  for (const row of pending) {
    if (!row.sentAt) continue;
    checked++;
    try {
      const reply = await findReplyFrom(accessToken, row.email, row.sentAt);
      if (!reply) continue;
      const replyClass = classifyReplySnippet(reply.snippet);
      db.update(outreach)
        .set({ repliedAt: reply.receivedAt, replyClass, replySnippet: reply.snippet })
        .where(eq(outreach.id, row.outreachId))
        .run();
      db.update(leads)
        .set({ status: "replied", updatedAt: Date.now() })
        .where(eq(leads.id, row.leadId))
        .run();
      newReplies++;
    } catch (e) {
      errors.push(`${row.email}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { connected: true, checked, newReplies, errors };
}
