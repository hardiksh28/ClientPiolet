export const USER_AGENT =
  "ClientPilotBot/1.0 (+outreach research tool; contact: hardik9462@gmail.com)";

export async function fetchWithTimeout(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string>; method?: string } = {}
): Promise<Response | null> {
  const { timeoutMs = 8000, headers = {}, method = "GET" } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, ...headers },
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(
  url: string,
  opts?: { timeoutMs?: number; headers?: Record<string, string> }
): Promise<T | null> {
  const res = await fetchWithTimeout(url, opts);
  if (!res || !res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function canonicalizeDomain(input: string): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  if (!s) return null;
  if (!s.startsWith("http://") && !s.startsWith("https://")) {
    s = "https://" + s;
  }
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");
    if (!host.includes(".")) return null;
    return host;
  } catch {
    return null;
  }
}

// Tiny in-memory per-run robots.txt cache: domain -> disallowed-all boolean
const robotsCache = new Map<string, boolean>();

export async function isDisallowedByRobots(domain: string): Promise<boolean> {
  if (robotsCache.has(domain)) return robotsCache.get(domain)!;
  const res = await fetchWithTimeout(`https://${domain}/robots.txt`, {
    timeoutMs: 5000,
  });
  if (!res || !res.ok) {
    robotsCache.set(domain, false);
    return false;
  }
  try {
    const text = await res.text();
    const lines = text.split("\n").map((l) => l.trim());
    let applies = false;
    let disallowedRoot = false;
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.startsWith("user-agent:")) {
        const ua = lower.split(":")[1]?.trim();
        applies = ua === "*";
      } else if (applies && lower.startsWith("disallow:")) {
        const path = line.split(":").slice(1).join(":").trim();
        if (path === "/") disallowedRoot = true;
      }
    }
    robotsCache.set(domain, disallowedRoot);
    return disallowedRoot;
  } catch {
    robotsCache.set(domain, false);
    return false;
  }
}
