/**
 * Centralized Groq client — every AI call in ClientPilot goes through here.
 * Plain fetch against Groq's OpenAI-compatible endpoint, consistent with
 * the rest of the pipeline (no SDK dependency). One retry on transient
 * failure, a hard timeout, and callers always get null instead of a thrown
 * error on failure — AI is an enhancement layer, never a point of failure
 * for the deterministic pipeline underneath it.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export const GROQ_MODEL_HEAVY = process.env.GROQ_MODEL_HEAVY || "openai/gpt-oss-120b";
export const GROQ_MODEL_LIGHT = process.env.GROQ_MODEL_LIGHT || "openai/gpt-oss-20b";

export function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

type JsonSchema = Record<string, unknown>;

export async function groqStructuredCompletion<T>(opts: {
  model: string;
  system: string;
  user: string;
  schemaName: string;
  schema: JsonSchema;
  timeoutMs?: number;
}): Promise<T | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const body = {
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: opts.schemaName,
        schema: opts.schema,
        strict: true,
      },
    },
    temperature: 0.2,
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      clearTimeout(timer);

      if (!res.ok) {
        // Retry once on 429/5xx (rate limit / transient), not on 4xx like
        // a bad request — that would just fail identically again.
        if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        return null;
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;
      return JSON.parse(content) as T;
    } catch {
      clearTimeout(timer);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      return null;
    }
  }
  return null;
}
