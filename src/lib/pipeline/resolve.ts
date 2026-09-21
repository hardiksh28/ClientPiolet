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

async function guessDomainFromCompanyName(company: string): Promise<string | null> {
  const data = await fetchJson<ClearbitSuggestion[]>(
    `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(
      company
    )}`,
    { timeoutMs: 5000 }
  );
  if (!data || data.length === 0) return null;
  return canonicalizeDomain(data[0].domain);
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
