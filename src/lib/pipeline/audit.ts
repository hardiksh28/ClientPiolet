import * as cheerio from "cheerio";
import { fetchWithTimeout } from "./http";
import type { AuditResult, Problem } from "./types";

const CTA_VERBS =
  /\b(get started|start|book|try|demo|contact|sign up|buy now|order|schedule|talk to|request|subscribe|join)\b/i;

const TRUST_KEYWORDS =
  /\b(testimonial|review|trusted by|rated|as seen in|case stud(y|ies)|customers|clients love|5-star|g2\.com|capterra)\b/i;

const ANALYTICS_SIGNATURES = [
  "google-analytics.com",
  "googletagmanager.com",
  "gtag(",
  "plausible.io",
  "posthog",
  "hotjar",
  "segment.com/analytics.js",
  "mixpanel",
];

const LEGACY_SIGNATURES = ["jquery"];
const MODERN_FRAMEWORK_SIGNATURES = [
  { needle: "_next/static", tag: "Next.js" },
  { needle: "__next", tag: "Next.js" },
  { needle: "data-reactroot", tag: "React" },
  { needle: "react-dom", tag: "React" },
  { needle: "data-v-", tag: "Vue" },
  { needle: "__nuxt", tag: "Nuxt" },
  { needle: "svelte", tag: "Svelte" },
  { needle: "webflow.js", tag: "Webflow" },
  { needle: "cdn.shopify.com", tag: "Shopify" },
  { needle: "wp-content", tag: "WordPress" },
  { needle: "squarespace", tag: "Squarespace" },
  { needle: "static.wixstatic.com", tag: "Wix" },
  { needle: "webpack", tag: "Bundled JS" },
];

function addProblem(list: Problem[], tag: string, weight: number, evidence: string) {
  list.push({ tag, weight, evidence });
}

export async function auditSite(domain: string): Promise<AuditResult> {
  let res = await fetchWithTimeout(`https://${domain}`, { timeoutMs: 9000 });
  let insecure = false;
  if (!res) {
    res = await fetchWithTimeout(`http://${domain}`, { timeoutMs: 9000 });
    insecure = !!res;
  }

  if (!res) {
    return {
      httpStatus: null,
      title: null,
      h1: null,
      metaDesc: null,
      tech: [],
      problems: [],
      pageBytes: null,
      insecure: false,
      fetchFailed: true,
      html: null,
      origin: null,
    };
  }

  // A 4xx/5xx is often a WAF/bot-detection block page (Cloudflare/CloudFront/Akamai),
  // not the real homepage. Parsing it as content would produce fabricated "evidence" —
  // park the lead instead of drafting a factually wrong email.
  if (res.status >= 400) {
    return {
      httpStatus: res.status,
      title: null,
      h1: null,
      metaDesc: null,
      tech: [],
      problems: [],
      pageBytes: null,
      insecure: false,
      fetchFailed: true,
      html: null,
      origin: null,
    };
  }

  const finalUrl = res.url || `https://${domain}`;
  if (finalUrl.startsWith("http://")) insecure = true;

  const html = await res.text();
  const pageBytes = new TextEncoder().encode(html).length;
  const $ = cheerio.load(html);
  const problems: Problem[] = [];
  const lowerHtml = html.toLowerCase();

  // 1. Missing viewport meta -> NOT_MOBILE_READY (9)
  const hasViewport = $('meta[name="viewport"]').length > 0;
  if (!hasViewport) {
    addProblem(problems, "NOT_MOBILE_READY", 9, "No <meta name=\"viewport\"> tag found — page will not scale on mobile.");
  }

  // 2. Weak H1 -> UNCLEAR_VALUE_PROP (8)
  const h1 = $("h1").first().text().trim().replace(/\s+/g, " ");
  const companyNameGuess = ($("title").text().split(/[-|–]/)[0] || "").trim().toLowerCase();
  const weakH1 =
    !h1 || h1.length < 15 || (companyNameGuess.length > 0 && h1.toLowerCase() === companyNameGuess);
  if (weakH1) {
    addProblem(
      problems,
      "UNCLEAR_VALUE_PROP",
      8,
      h1 ? `H1 is just "${h1}" — says who, not what or why.` : "No H1 found on the homepage."
    );
  }

  // 3. No CTA above the fold -> NO_CLEAR_CTA (9)
  const foldCandidates = $("body").children().slice(0, 3);
  let ctaFound = false;
  foldCandidates.find("a, button").each((_, el) => {
    const text = $(el).text().trim();
    if (text && CTA_VERBS.test(text)) ctaFound = true;
  });
  if (!ctaFound) {
    addProblem(
      problems,
      "NO_CLEAR_CTA",
      9,
      "No button or link with a clear call-to-action verb in the first sections of the page."
    );
  }

  // 4. Missing/weak meta description -> WEAK_SEO (4)
  const metaDesc = $('meta[name="description"]').attr("content")?.trim() ?? null;
  if (!metaDesc || metaDesc.length > 160 || metaDesc.length < 50) {
    addProblem(
      problems,
      "WEAK_SEO",
      4,
      metaDesc
        ? `Meta description is ${metaDesc.length} characters (outside the 50–160 sweet spot).`
        : "No meta description tag."
    );
  }

  // 5. Broken internal links -> BROKEN_LINKS (7)
  const origin = new URL(finalUrl).origin;
  const navLinks = new Set<string>();
  $("nav a[href], header a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const u = new URL(href, origin);
      if (u.origin === origin && u.pathname !== "/" && u.pathname.length > 1) {
        navLinks.add(u.toString());
      }
    } catch {
      /* ignore */
    }
  });
  const linksToCheck = Array.from(navLinks).slice(0, 5);
  const linkChecks = await Promise.allSettled(
    linksToCheck.map((url) => fetchWithTimeout(url, { timeoutMs: 5000, method: "HEAD" }))
  );
  const brokenLinks = linkChecks.filter(
    (r) => r.status === "fulfilled" && r.value && r.value.status >= 400
  ).length;
  if (brokenLinks > 0) {
    addProblem(
      problems,
      "BROKEN_LINKS",
      7,
      `${brokenLinks} of ${linksToCheck.length} checked nav link(s) return an error status.`
    );
  }

  // 6. Heavy page -> SLOW_SITE (7)
  const renderBlockingScripts = $("script[src]").filter((_, el) => {
    const async = $(el).attr("async");
    const defer = $(el).attr("defer");
    const type = $(el).attr("type");
    return async === undefined && defer === undefined && type !== "module";
  }).length;
  if (pageBytes > 2_000_000 || renderBlockingScripts > 25) {
    addProblem(
      problems,
      "SLOW_SITE",
      7,
      pageBytes > 2_000_000
        ? `Homepage HTML is ${(pageBytes / 1_000_000).toFixed(1)} MB.`
        : `${renderBlockingScripts} render-blocking scripts detected.`
    );
  }

  // 7. Legacy stack -> OUTDATED_BUILD (8)
  const tech: string[] = [];
  for (const sig of MODERN_FRAMEWORK_SIGNATURES) {
    if (lowerHtml.includes(sig.needle)) tech.push(sig.tag);
  }
  const hasJquery = LEGACY_SIGNATURES.some((s) => lowerHtml.includes(s));
  if (hasJquery) tech.push("jQuery");
  const hasModernSignature = tech.some((t) => t !== "jQuery");
  if (hasJquery && !hasModernSignature && !hasViewport) {
    addProblem(
      problems,
      "OUTDATED_BUILD",
      8,
      "jQuery-only stack, no modern framework signature, and not mobile-responsive."
    );
  }

  // 8. No social proof -> NO_TRUST_SIGNALS (5)
  const bodyText = $("body").text();
  if (!TRUST_KEYWORDS.test(bodyText)) {
    addProblem(
      problems,
      "NO_TRUST_SIGNALS",
      5,
      "No testimonial, review, or 'trusted by' language anywhere on the homepage."
    );
  }

  // 9. No HTTPS / bad cert -> INSECURE (6)
  if (insecure) {
    addProblem(problems, "INSECURE", 6, "Site is only reachable over http:// (no valid HTTPS).");
  }

  // 10. No analytics -> NO_MEASUREMENT (3)
  const hasAnalytics = ANALYTICS_SIGNATURES.some((s) => lowerHtml.includes(s));
  if (!hasAnalytics) {
    addProblem(
      problems,
      "NO_MEASUREMENT",
      3,
      "No GA4 / Plausible / PostHog / Hotjar tag detected — they can't see what's working."
    );
  }

  return {
    httpStatus: res.status,
    title: $("title").text().trim() || null,
    h1: h1 || null,
    metaDesc,
    tech: Array.from(new Set(tech)),
    problems,
    pageBytes,
    insecure,
    fetchFailed: false,
    html,
    origin,
  };
}
