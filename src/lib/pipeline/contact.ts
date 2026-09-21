import * as cheerio from "cheerio";
import { fetchWithTimeout } from "./http";
import type { ContactResult } from "./types";

const ROLE_LOCAL_PARTS = new Set([
  "info",
  "hello",
  "hi",
  "support",
  "contact",
  "sales",
  "team",
  "help",
  "admin",
  "office",
  "enquiries",
  "inquiries",
]);

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Filenames like "photo@2x.jpg" (a standard retina-asset naming convention)
// match the email regex too — reject anything whose "TLD" is actually a file
// extension, and anything whose local part is a bare hex/asset id.
const NON_EMAIL_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "svg",
  "webp",
  "ico",
  "css",
  "js",
  "woff",
  "woff2",
  "ttf",
  "pdf",
  "json",
  "map",
]);

function looksLikeRealEmail(email: string): boolean {
  const tld = email.split(".").pop()?.toLowerCase() ?? "";
  if (NON_EMAIL_EXTENSIONS.has(tld)) return false;
  if (/^[0-9a-f]{6,}$/i.test(email.split("@")[0] ?? "")) return false; // bare hex/asset id
  return true;
}

function classify(email: string): "direct" | "role" {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  return ROLE_LOCAL_PARTS.has(local) ? "role" : "direct";
}

/** Decodes Cloudflare's email-obfuscation (`data-cfemail="…"` XOR cipher). */
function decodeCloudflareEmail(encoded: string): string | null {
  try {
    const bytes = encoded.match(/../g)?.map((b) => parseInt(b, 16)) ?? [];
    if (bytes.length < 2) return null;
    const key = bytes[0];
    const chars = bytes.slice(1).map((b) => b ^ key);
    return String.fromCharCode(...chars);
  } catch {
    return null;
  }
}

function extractFromHtml(html: string): { email: string; name: string | null } | null {
  const $ = cheerio.load(html);

  const mailto = $('a[href^="mailto:"]').first().attr("href");
  if (mailto) {
    const email = mailto.replace("mailto:", "").split("?")[0].trim();
    if (email) return { email, name: null };
  }

  const cfEncoded = $("[data-cfemail]").first().attr("data-cfemail");
  if (cfEncoded) {
    const decoded = decodeCloudflareEmail(cfEncoded);
    if (decoded && decoded.includes("@")) return { email: decoded, name: null };
  }

  // .text() includes <script>/<style> contents (they're text nodes too) —
  // strip them first so embedded JSON/JS/CSS asset paths can't be picked up.
  const bodyClone = $("body").clone();
  bodyClone.find("script, style, noscript").remove();
  const bodyText = bodyClone.text();
  const matches = bodyText.match(EMAIL_RE) ?? [];
  const realEmail = matches.find(looksLikeRealEmail);
  if (realEmail) return { email: realEmail, name: null };
  return null;
}

/**
 * Priority order: mailto on homepage -> /contact page -> parked (no guessing).
 */
export async function findContact(
  domain: string,
  origin: string,
  homepageHtml: string
): Promise<ContactResult> {
  const found = extractFromHtml(homepageHtml);
  if (found) {
    return {
      name: found.name,
      role: null,
      email: found.email,
      confidence: classify(found.email),
      sourceUrl: origin,
    };
  }

  for (const path of ["/contact", "/contact-us", "/about"]) {
    const res = await fetchWithTimeout(`${origin}${path}`, { timeoutMs: 5000 });
    if (!res || !res.ok) continue;
    const html = await res.text();
    const foundOnPage = extractFromHtml(html);
    if (foundOnPage) {
      return {
        name: foundOnPage.name,
        role: null,
        email: foundOnPage.email,
        confidence: classify(foundOnPage.email),
        sourceUrl: `${origin}${path}`,
      };
    }
  }

  return null;
}
