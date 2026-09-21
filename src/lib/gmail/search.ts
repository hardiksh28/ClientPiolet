/**
 * Read-only Gmail message search — no send scope, matching the plan doc's
 * "read-only Gmail API" Phase 3 note. Uses plain fetch against the REST API
 * instead of the googleapis SDK, consistent with the rest of the pipeline.
 */

type GmailMessageListItem = { id: string; threadId: string };

type GmailMessageMetadata = {
  id: string;
  internalDate: string; // ms since epoch, as a string
  snippet: string;
};

function formatDateForQuery(ms: number): string {
  // Gmail's `after:` operator wants YYYY/MM/DD. Subtract a day so we never
  // miss a same-day reply due to the exclusive day boundary — real
  // filtering against sentAt happens afterwards using internalDate.
  const d = new Date(ms - 24 * 60 * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

export type FoundReply = { receivedAt: number; snippet: string };

/**
 * Looks for the newest message from `fromEmail` received after `sinceMs`.
 * Returns null if nothing found (or found but not actually after sinceMs,
 * which the day-granularity search can occasionally over-include).
 */
export async function findReplyFrom(
  accessToken: string,
  fromEmail: string,
  sinceMs: number
): Promise<FoundReply | null> {
  const q = `from:${fromEmail} after:${formatDateForQuery(sinceMs)}`;
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({
      q,
      maxResults: "5",
    })}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listRes.ok) {
    throw new Error(`Gmail search failed: ${listRes.status} ${await listRes.text()}`);
  }
  const listData = (await listRes.json()) as { messages?: GmailMessageListItem[] };
  const messages = listData.messages ?? [];
  if (messages.length === 0) return null;

  let newest: FoundReply | null = null;
  for (const m of messages) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) continue;
    const data = (await res.json()) as GmailMessageMetadata;
    const receivedAt = Number(data.internalDate);
    if (receivedAt <= sinceMs) continue; // day-granularity search can over-include
    if (!newest || receivedAt > newest.receivedAt) {
      newest = { receivedAt, snippet: data.snippet ?? "" };
    }
  }
  return newest;
}

const NO_KEYWORDS = ["not interested", "no thanks", "not for us", "unsubscribe", "remove me", "please stop"];
const NOT_NOW_KEYWORDS = ["not right now", "maybe later", "not now", "circle back", "revisit this later"];
const HOT_KEYWORDS = ["call", "chat", "jump on a", "schedule a", "book a", "let's talk", "quick call"];
const INTERESTED_KEYWORDS = ["sure", "sounds good", "interested", "yes,", "go ahead", "send it", "feel free", "would love"];

/** Cheap keyword heuristic — deliberately not an LLM call (deterministic core). */
export function classifyReplySnippet(
  snippet: string
): "hot" | "interested" | "maybe" | "not_now" | "no" | "auto" {
  const s = snippet.toLowerCase();
  if (NO_KEYWORDS.some((k) => s.includes(k))) return "no";
  if (NOT_NOW_KEYWORDS.some((k) => s.includes(k))) return "not_now";
  if (HOT_KEYWORDS.some((k) => s.includes(k))) return "hot";
  if (INTERESTED_KEYWORDS.some((k) => s.includes(k))) return "interested";
  return "auto";
}
