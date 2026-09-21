import { fetchJson, fetchWithTimeout, USER_AGENT } from "./http";
import type { RawLead } from "./types";

const FRONTEND_ROLE_RE =
  /\b(frontend|front-end|front end|react|next\.?js|webflow|landing page|web designer|ui\/ux|ui engineer|web developer)\b/i;

// ---------- 1. Job boards (highest buying intent — hiring = budget) ----------

type RemotiveJob = {
  company_name: string;
  title: string;
  candidate_required_location?: string;
  url: string;
};

async function discoverRemotive(limit: number): Promise<RawLead[]> {
  const data = await fetchJson<{ jobs: RemotiveJob[] }>(
    "https://remotive.com/api/remote-jobs?category=software-dev&limit=100"
  );
  if (!data) return [];
  const leads: RawLead[] = [];
  for (const job of data.jobs) {
    if (!FRONTEND_ROLE_RE.test(job.title)) continue;
    leads.push({
      company: job.company_name,
      domain: null,
      source: "job_board",
      country: job.candidate_required_location,
      sourceMeta: {
        board: "remotive",
        role: job.title,
        jobUrl: job.url,
      },
    });
    if (leads.length >= limit) break;
  }
  return leads;
}

type RemoteOkJob = {
  company?: string;
  position?: string;
  tags?: string[];
  url?: string;
  company_logo?: string;
};

async function discoverRemoteOk(limit: number): Promise<RawLead[]> {
  const res = await fetchWithTimeout("https://remoteok.com/api", {
    headers: { Accept: "application/json" },
  });
  if (!res || !res.ok) return [];
  let data: RemoteOkJob[] = [];
  try {
    data = (await res.json()) as RemoteOkJob[];
  } catch {
    return [];
  }
  const leads: RawLead[] = [];
  for (const job of data) {
    if (!job.company || !job.position) continue;
    const haystack = `${job.position} ${(job.tags ?? []).join(" ")}`;
    if (!FRONTEND_ROLE_RE.test(haystack)) continue;
    leads.push({
      company: job.company,
      domain: null,
      source: "job_board",
      sourceMeta: {
        board: "remoteok",
        role: job.position,
        jobUrl: job.url,
        tags: job.tags,
      },
    });
    if (leads.length >= limit) break;
  }
  return leads;
}

export async function discoverJobBoards(limit = 15): Promise<RawLead[]> {
  const [a, b] = await Promise.all([
    discoverRemotive(Math.ceil(limit * 0.6)),
    discoverRemoteOk(Math.ceil(limit * 0.6)),
  ]);
  return [...a, ...b].slice(0, limit);
}

// ---------- 2. Product Hunt (needs a free developer token; skipped gracefully without one) ----------

type PHNode = {
  name: string;
  tagline: string;
  website: string;
  createdAt: string;
};

export async function discoverProductHunt(limit = 10): Promise<RawLead[]> {
  const token = process.env.PRODUCTHUNT_TOKEN;
  if (!token) return [];
  const query = `query { posts(order: NEWEST, first: ${limit}) { edges { node { name tagline website createdAt } } } }`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const r = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ query }),
    });
    clearTimeout(timer);
    if (!r.ok) return [];
    const json = (await r.json()) as {
      data?: { posts?: { edges?: { node: PHNode }[] } };
    };
    const edges = json.data?.posts?.edges ?? [];
    return edges.map(({ node }) => ({
      company: node.name,
      domain: null,
      siteUrl: node.website,
      source: "product_hunt" as const,
      sourceMeta: { tagline: node.tagline, launchedAt: node.createdAt },
    }));
  } catch {
    return [];
  }
}

// ---------- 3. Directories — Show HN launches (public, no key, links straight to the maker's site) ----------

type HNHit = {
  title: string;
  url: string | null;
  author: string;
  created_at: string;
  points: number | null;
};

export async function discoverDirectories(limit = 15): Promise<RawLead[]> {
  const perPage = Math.ceil((limit * 2) / 2);
  const [page0, page1] = await Promise.all([
    fetchJson<{ hits: HNHit[] }>(
      `https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&hitsPerPage=${perPage}&page=0`
    ),
    fetchJson<{ hits: HNHit[] }>(
      `https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&hitsPerPage=${perPage}&page=1`
    ),
  ]);
  const hits = [...(page0?.hits ?? []), ...(page1?.hits ?? [])];
  if (hits.length === 0) return [];
  const leads: RawLead[] = [];
  for (const hit of hits) {
    if (!hit.url) continue;
    const company = hit.title.replace(/^Show HN:\s*/i, "").split(/[-–—|:]/)[0].trim();
    if (!company) continue;
    leads.push({
      company: company.slice(0, 80),
      domain: null,
      siteUrl: hit.url,
      source: "directory",
      sourceMeta: {
        listing: "show_hn",
        title: hit.title,
        points: hit.points,
        author: hit.author,
        postedAt: hit.created_at,
      },
    });
    if (leads.length >= limit) break;
  }
  return leads;
}

// ---------- 4. GitHub orgs — lowest intent, used sparingly ----------

type GhRepo = {
  full_name: string;
  owner: { login: string; type: string };
  homepage: string | null;
  html_url: string;
  language: string | null;
};

// Several topic queries, rotated by the hour so consecutive runs don't just
// re-hit the same top-N "sort:updated" results.
const GITHUB_QUERIES = [
  "topic:landing-page topic:saas",
  "topic:startup topic:nextjs",
  "topic:saas-boilerplate",
  "topic:open-startup",
];

type GhOrg = { name: string | null; email: string | null };

export async function discoverGithub(limit = 8): Promise<RawLead[]> {
  const pat = process.env.GITHUB_PAT;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (pat) headers.Authorization = `Bearer ${pat}`;

  const hour = new Date().getUTCHours();
  const query = GITHUB_QUERIES[hour % GITHUB_QUERIES.length];

  const data = await fetchJson<{ items: GhRepo[] }>(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(
      query
    )}&sort=updated&order=desc&per_page=50`,
    { headers }
  );
  if (!data) return [];

  const seen = new Set<string>();
  const leads: RawLead[] = [];
  for (const repo of data.items) {
    // Doc's own framing: "Org, homepage URL" — personal user accounts aren't
    // companies you'd cold-email for freelance work, skip them.
    if (repo.owner.type !== "Organization") continue;
    if (seen.has(repo.owner.login)) continue;
    seen.add(repo.owner.login);
    if (!repo.homepage) continue;

    const org = await fetchJson<GhOrg>(`https://api.github.com/orgs/${repo.owner.login}`, {
      headers,
      timeoutMs: 5000,
    });

    leads.push({
      company: org?.name || repo.owner.login,
      domain: null,
      siteUrl: repo.homepage,
      source: "github",
      sourceMeta: {
        repo: repo.full_name,
        repoUrl: repo.html_url,
        language: repo.language,
        orgEmail: org?.email ?? undefined,
      },
    });
    if (leads.length >= limit) break;
  }
  return leads;
}
