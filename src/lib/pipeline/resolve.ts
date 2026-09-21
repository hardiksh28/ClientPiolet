import { canonicalizeDomain, fetchJson, isDisallowedByRobots } from "./http";
import type { RawLead, ResolvedLead } from "./types";

// Bare platform domains a Show HN / launch link sometimes resolves to
// (e.g. a repo link canonicalizing down to "github.com") — not an actual
// company site, so auditing it would be meaningless.
const PLATFORM_DENYLIST = new Set([
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "npmjs.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "medium.com",
  "reddit.com",
  "news.ycombinator.com",
]);

type ClearbitSuggestion = { name: string; domain: string; logo: string | null };

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Clearbit's autocomplete is fuzzy and `data[0]` is not necessarily *the*
 * company — for a common name like "Mercury" it could return any of several
 * unrelated real companies. Auditing and emailing based on the wrong site's
 * evidence would be a real correctness failure, not a cosmetic one, so we
 * require the top suggestion's name to actually resemble the query before
 * trusting it — otherwise we park the lead rather than guess.
 */
function looksLikeSameCompany(query: string, suggestion: string): boolean {
  const q = normalizeForMatch(query);
  const s = normalizeForMatch(suggestion);
  if (!q || !s) return false;
  return q === s || q.includes(s) || s.includes(q);
}

async function guessDomainFromCompanyName(company: string): Promise<string | null> {
  const data = await fetchJson<ClearbitSuggestion[]>(
    `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(
      company
    )}`,
    { timeoutMs: 5000 }
  );
  if (!data || data.length === 0) return null;
  const match = data.find((d) => looksLikeSameCompany(company, d.name));
  if (!match) return null;
  return canonicalizeDomain(match.domain);
}

/**
 * We only reliably know a lead's country for job-board leads (the posting's
 * "candidate required location"); Show HN/GitHub/Product Hunt never set it.
 * So the filter only excludes leads where we *do* have a country and it
 * doesn't match — it never drops a lead just because country is unknown,
 * or that would silently zero out three of the four sources.
 */
function matchesCountryFilter(leadCountry: string | undefined, targetCountries: string[]): boolean {
  if (targetCountries.length === 0) return true;
  if (!leadCountry) return true;
  const lc = leadCountry.toLowerCase();
  if (lc.includes("worldwide") || lc.includes("anywhere") || lc.includes("remote")) return true;
  return targetCountries.some((c) => {
    const tc = c.toLowerCase();
    return lc.includes(tc) || tc.includes(lc);
  });
}

/**
 * Resolves each raw lead to a canonical domain, dedupes within the batch and
 * against domains already known to the DB, drops anything robots.txt fully
 * disallows, and filters out leads outside the configured target countries.
 */
export async function resolveLeads(
  raw: RawLead[],
  existingDomains: Set<string>,
  targetCountries: string[] = []
): Promise<ResolvedLead[]> {
  const seen = new Set<string>();
  const resolved: ResolvedLead[] = [];

  for (const lead of raw) {
    if (!matchesCountryFilter(lead.country, targetCountries)) continue;

    let domain = lead.domain ? canonicalizeDomain(lead.domain) : null;
    if (!domain && lead.siteUrl) domain = canonicalizeDomain(lead.siteUrl);
    if (!domain) {
      domain = await guessDomainFromCompanyName(lead.company);
    }
    if (!domain) continue;
    if (PLATFORM_DENYLIST.has(domain)) continue;
    if (seen.has(domain) || existingDomains.has(domain)) continue;
    seen.add(domain);

    const blocked = await isDisallowedByRobots(domain);
    if (blocked) continue;

    resolved.push({ ...lead, domain });
  }

  return resolved;
}
