import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, sqlite } from "@/lib/db/client";
import { aiAnalysis, audits, contacts, deals, leads, outreach, settings as settingsTable } from "@/lib/db/schema";
import { analyzeOpportunity, opportunityInputHash } from "@/lib/ai/opportunity";
import { GROQ_MODEL_HEAVY, isGroqConfigured } from "@/lib/ai/groq";
import { calculatePrice } from "@/lib/pricing/calculator";
import { DEFAULT_SERVICE_PRICING } from "@/lib/pricing/catalog";
import type { PricingStrategy, ScopeAssessment } from "@/lib/pricing/types";
import { auditSite } from "./audit";
import { findContact } from "./contact";
import { discoverDirectories, discoverGithub, discoverJobBoards, discoverProductHunt } from "./discover";
import { draftEmail } from "./draft";
import { resolveLeads } from "./resolve";
import { scoreLead, TAG_TO_SERVICE } from "./score";
import type { AuditResult, ContactResult, PipelineRunSummary, RawLead, Source } from "./types";

/**
 * Turns a queued lead's service/scope (AI-assessed, or a safe deterministic
 * default without AI) into a real deal row via the deterministic pricing
 * calculator, and returns what draftEmail needs to stay consistent with it.
 */
function createDeal(
  leadId: string,
  topProblemTag: string,
  aiResult: { service: string; complexity: string; estimatedDays: number; pricingStrategy: string; confidence: string } | null,
  enabledServices: string[],
  servicePricing: Record<string, number>,
  now: number
): { service: string; strategy: PricingStrategy; price: number } {
  const fallbackService = TAG_TO_SERVICE[topProblemTag] ?? "Landing Page Redesign";
  const service =
    aiResult?.service && enabledServices.includes(aiResult.service) ? aiResult.service : fallbackService;

  const scope: ScopeAssessment = aiResult
    ? { complexity: aiResult.complexity as ScopeAssessment["complexity"], estimatedDays: aiResult.estimatedDays }
    : { complexity: "medium", estimatedDays: 4 };

  const priceCalc = calculatePrice(
    service,
    scope,
    servicePricing,
    aiResult ? (aiResult.confidence as "high" | "medium" | "low") : undefined
  );
  // Cold-contact-safe default when there's no AI read to justify mentioning
  // a number up front — matches the "don't lead with price" guidance.
  const pricingStrategy = (aiResult?.pricingStrategy as PricingStrategy | undefined) ?? "no_price";

  db.insert(deals)
    .values({
      id: randomUUID(),
      leadId,
      service,
      complexity: scope.complexity,
      estimatedDays: scope.estimatedDays,
      priceBreakdown: JSON.stringify(priceCalc.breakdown),
      recommendedPrice: priceCalc.recommendedPrice,
      minPrice: priceCalc.minPrice,
      currentPrice: priceCalc.recommendedPrice,
      priceConfidence: priceCalc.confidence,
      pricingStrategy,
      status: "estimated",
      amountPaid: 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { service, strategy: pricingStrategy, price: priceCalc.recommendedPrice };
}

// Budget cap: at most this many Groq calls per manual pipeline run, tunable
// without a code change since free-tier limits vary by account.
const MAX_AI_LEADS_PER_RUN = Number(process.env.AI_MAX_LEADS_PER_RUN ?? 10);

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function runPipeline(): Promise<PipelineRunSummary> {
  const startedAt = Date.now();
  const errors: string[] = [];
  const bySource: Record<Source, number> = {
    job_board: 0,
    product_hunt: 0,
    directory: 0,
    github: 0,
  };

  const settingsRow = db.select().from(settingsTable).get();
  const enabledServices: string[] = settingsRow ? JSON.parse(settingsRow.services) : [];
  const targetCountries: string[] = settingsRow ? JSON.parse(settingsRow.countries) : [];
  const minScore = settingsRow?.minScore ?? 70;
  const dailyLimit = settingsRow?.dailyLimit ?? 20;
  const senderName = settingsRow?.senderName ?? "Hardik";
  const portfolioUrl = settingsRow?.portfolioUrl ?? "";
  const servicePricing: Record<string, number> = settingsRow?.servicePricing
    ? JSON.parse(settingsRow.servicePricing)
    : DEFAULT_SERVICE_PRICING;

  let raw: RawLead[] = [];
  try {
    const [jobBoard, productHunt, directory, github] = await Promise.all([
      discoverJobBoards(20),
      discoverProductHunt(10),
      discoverDirectories(25),
      discoverGithub(12),
    ]);
    raw = [...jobBoard, ...productHunt, ...directory, ...github];
  } catch (e) {
    errors.push(`discovery failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  const existingDomains = new Set(
    (db.select({ domain: leads.domain }).from(leads).all() as { domain: string }[]).map(
      (r) => r.domain
    )
  );

  let resolved: Awaited<ReturnType<typeof resolveLeads>> = [];
  try {
    resolved = await resolveLeads(raw, existingDomains, targetCountries);
  } catch (e) {
    errors.push(`resolve failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Cap the batch so a manual "Run Pipeline" click stays reasonably fast.
  const batch = resolved.slice(0, 45);

  let queuedCount = 0;
  let archivedCount = 0;
  let auditedCount = 0;
  let aiAnalyzedCount = 0;
  let aiRejectedCount = 0;
  const groqEnabled = isGroqConfigured();

  await mapLimit(batch, 6, async (lead) => {
    try {
      const audit = await auditSite(lead.domain);
      auditedCount++;

      const now = Date.now();
      const leadId = randomUUID();

      if (audit.fetchFailed) {
        db.insert(leads)
          .values({
            id: leadId,
            company: lead.company,
            domain: lead.domain,
            country: lead.country ?? null,
            industry: lead.industry ?? null,
            source: lead.source,
            sourceMeta: JSON.stringify(lead.sourceMeta),
            status: "archived",
            archiveReason: "fetch_failed",
            score: 0,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        archivedCount++;
        bySource[lead.source]++;
        return;
      }

      if (audit.problems.length === 0) {
        db.insert(leads)
          .values({
            id: leadId,
            company: lead.company,
            domain: lead.domain,
            country: lead.country ?? null,
            industry: lead.industry ?? null,
            source: lead.source,
            sourceMeta: JSON.stringify(lead.sourceMeta),
            status: "archived",
            archiveReason: "no_problems",
            score: 0,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        db.insert(audits)
          .values({
            id: randomUUID(),
            leadId,
            fetchedAt: now,
            httpStatus: audit.httpStatus,
            title: audit.title,
            h1: audit.h1,
            metaDesc: audit.metaDesc,
            tech: JSON.stringify(audit.tech),
            problems: JSON.stringify(audit.problems),
            pageBytes: audit.pageBytes,
          })
          .run();
        archivedCount++;
        bySource[lead.source]++;
        return;
      }

      let contact = audit.html && audit.origin ? await findContact(lead.domain, audit.origin, audit.html) : null;
      if (!contact && lead.source === "github") {
        const orgEmail = (lead.sourceMeta as Record<string, unknown>).orgEmail;
        if (typeof orgEmail === "string" && orgEmail) {
          contact = {
            name: null,
            role: null,
            email: orgEmail,
            confidence: "direct",
            sourceUrl: `https://github.com/${lead.company}`,
          };
        }
      }

      const score = scoreLead(lead.source, audit, contact, enabledServices);
      const noContact = !contact;
      const belowThreshold = score.total < minScore;
      const limitReached = !noContact && !belowThreshold && queuedCount >= dailyLimit;

      let status: "queued" | "archived" = noContact || belowThreshold || limitReached ? "archived" : "queued";
      let archiveReason: string | null = noContact
        ? "no_contact"
        : belowThreshold
        ? "low_score"
        : limitReached
        ? "daily_limit_reached"
        : null;

      // AI opportunity gate: only for leads that already cleared every
      // deterministic bar. A missing key, exhausted budget, or any API
      // failure just skips this — the deterministic decision above stands.
      let aiResult: Awaited<ReturnType<typeof analyzeOpportunity>> = null;
      let aiInputHash: string | null = null;
      if (status === "queued" && groqEnabled && aiAnalyzedCount < MAX_AI_LEADS_PER_RUN) {
        aiAnalyzedCount++;
        const aiInput = {
          company: lead.company,
          domain: lead.domain,
          source: lead.source,
          sourceMeta: lead.sourceMeta,
          websiteTitle: audit.title,
          h1: audit.h1,
          metaDescription: audit.metaDesc,
          problems: audit.problems,
          enabledServices,
        };
        aiInputHash = opportunityInputHash(aiInput);
        aiResult = await analyzeOpportunity(aiInput);
        if (aiResult && !aiResult.qualified) {
          status = "archived";
          archiveReason = "ai_not_qualified";
          aiRejectedCount++;
        }
      }

      db.insert(leads)
        .values({
          id: leadId,
          company: lead.company,
          domain: lead.domain,
          country: lead.country ?? null,
          industry: lead.industry ?? null,
          source: lead.source,
          sourceMeta: JSON.stringify(lead.sourceMeta),
          status,
          archiveReason,
          score: score.total,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(audits)
        .values({
          id: randomUUID(),
          leadId,
          fetchedAt: now,
          httpStatus: audit.httpStatus,
          title: audit.title,
          h1: audit.h1,
          metaDesc: audit.metaDesc,
          tech: JSON.stringify(audit.tech),
          problems: JSON.stringify(audit.problems),
          pageBytes: audit.pageBytes,
        })
        .run();

      if (contact) {
        db.insert(contacts)
          .values({
            id: randomUUID(),
            leadId,
            name: contact.name,
            role: contact.role,
            email: contact.email,
            confidence: contact.confidence,
            sourceUrl: contact.sourceUrl,
          })
          .run();
      }

      if (aiResult && aiInputHash) {
        db.insert(aiAnalysis)
          .values({
            id: randomUUID(),
            leadId,
            qualified: aiResult.qualified,
            confidence: aiResult.confidence,
            opportunity: aiResult.opportunity,
            whyNow: aiResult.whyNow,
            evidence: JSON.stringify(aiResult.evidence),
            service: aiResult.service,
            recommendedAction: aiResult.recommendedAction,
            summary: aiResult.summary,
            complexity: aiResult.complexity,
            estimatedDays: aiResult.estimatedDays,
            deliverables: JSON.stringify(aiResult.deliverables),
            pricingStrategy: aiResult.pricingStrategy,
            model: GROQ_MODEL_HEAVY,
            inputHash: aiInputHash,
            analyzedAt: now,
          })
          .run();
      }

      if (status === "queued") {
        const topProblemTag = [...audit.problems].sort((a, b) => b.weight - a.weight)[0].tag;
        const deal = createDeal(
          leadId,
          topProblemTag,
          aiResult && aiResult.qualified ? aiResult : null,
          enabledServices,
          servicePricing,
          now
        );
        const draft = draftEmail(lead, audit, contact, {
          senderName,
          portfolioUrl,
          service: deal.service,
          pricing: { strategy: deal.strategy, price: deal.price },
        });
        db.insert(outreach)
          .values({
            id: randomUUID(),
            leadId,
            kind: "initial",
            subject: draft.subject,
            body: draft.body,
            service: draft.service,
            draftedAt: now,
          })
          .run();
        queuedCount++;
      } else {
        archivedCount++;
      }

      bySource[lead.source]++;
    } catch (e) {
      errors.push(`${lead.domain}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  return {
    bySource,
    discovered: raw.length,
    candidatesAfterDedupe: resolved.length,
    audited: auditedCount,
    queued: queuedCount,
    archived: archivedCount,
    errors,
    durationMs: Date.now() - startedAt,
    aiAnalyzed: aiAnalyzedCount,
    aiRejected: aiRejectedCount,
  };
}

/**
 * Re-applies the current scoring formula to already-archived `low_score`
 * leads, using the real audit/contact data already on file (no re-fetch, no
 * fabrication). Run this after a settings change so lowering the threshold
 * actually surfaces the leads it was meant to affect, instead of only
 * changing behavior for the next full pipeline run.
 */
export async function reconsiderArchivedLeads(): Promise<{ requeued: number; reevaluated: number }> {
  const settingsRow = db.select().from(settingsTable).where(eq(settingsTable.id, 1)).get();
  const enabledServices: string[] = settingsRow ? JSON.parse(settingsRow.services) : [];
  const minScore = settingsRow?.minScore ?? 70;
  const dailyLimit = settingsRow?.dailyLimit ?? 20;
  const senderName = settingsRow?.senderName ?? "Hardik";
  const portfolioUrl = settingsRow?.portfolioUrl ?? "";
  const servicePricing: Record<string, number> = settingsRow?.servicePricing
    ? JSON.parse(settingsRow.servicePricing)
    : DEFAULT_SERVICE_PRICING;

  // low_score: might clear the bar under new settings. daily_limit_reached:
  // already cleared the bar, just needs room under a (possibly raised) cap.
  const candidates = db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.status, "archived"),
        sql`${leads.archiveReason} in ('low_score', 'daily_limit_reached')`
      )
    )
    .all();

  const alreadyQueued = db
    .select()
    .from(leads)
    .where(eq(leads.status, "queued"))
    .all().length;

  let requeued = 0;

  for (const lead of candidates) {
    const auditRow = db
      .select()
      .from(audits)
      .where(eq(audits.leadId, lead.id))
      .orderBy(desc(audits.fetchedAt))
      .get();
    if (!auditRow) continue;
    const contactRow = db.select().from(contacts).where(eq(contacts.leadId, lead.id)).get();

    const auditResult: AuditResult = {
      httpStatus: auditRow.httpStatus,
      title: auditRow.title,
      h1: auditRow.h1,
      metaDesc: auditRow.metaDesc,
      tech: JSON.parse(auditRow.tech),
      problems: JSON.parse(auditRow.problems),
      pageBytes: auditRow.pageBytes,
      insecure: false,
      fetchFailed: false,
      html: null,
      origin: `https://${lead.domain}`,
    };

    const contact: ContactResult = contactRow
      ? {
          name: contactRow.name,
          role: contactRow.role,
          email: contactRow.email,
          confidence: contactRow.confidence as "direct" | "role" | "form_only",
          sourceUrl: contactRow.sourceUrl,
        }
      : null;

    const score = scoreLead(lead.source as Source, auditResult, contact, enabledServices);
    const now = Date.now();

    if (contact && score.total >= minScore && alreadyQueued + requeued < dailyLimit) {
      db.update(leads)
        .set({ status: "queued", archiveReason: null, score: score.total, updatedAt: now })
        .where(eq(leads.id, lead.id))
        .run();

      const rawLead: RawLead = {
        company: lead.company,
        domain: lead.domain,
        source: lead.source as Source,
        sourceMeta: JSON.parse(lead.sourceMeta),
        country: lead.country ?? undefined,
        industry: lead.industry ?? undefined,
      };

      const existingAi = db
        .select()
        .from(aiAnalysis)
        .where(eq(aiAnalysis.leadId, lead.id))
        .orderBy(desc(aiAnalysis.analyzedAt))
        .get();
      const topProblemTag = [...auditResult.problems].sort((a, b) => b.weight - a.weight)[0].tag;
      const deal = createDeal(
        lead.id,
        topProblemTag,
        existingAi && existingAi.qualified && existingAi.complexity && existingAi.estimatedDays != null && existingAi.pricingStrategy
          ? {
              service: existingAi.service,
              complexity: existingAi.complexity,
              estimatedDays: existingAi.estimatedDays,
              pricingStrategy: existingAi.pricingStrategy,
              confidence: existingAi.confidence,
            }
          : null,
        enabledServices,
        servicePricing,
        now
      );

      const draft = draftEmail(rawLead, auditResult, contact, {
        senderName,
        portfolioUrl,
        service: deal.service,
        pricing: { strategy: deal.strategy, price: deal.price },
      });
      db.insert(outreach)
        .values({
          id: randomUUID(),
          leadId: lead.id,
          kind: "initial",
          subject: draft.subject,
          body: draft.body,
          service: draft.service,
          draftedAt: now,
        })
        .run();
      requeued++;
    } else {
      // Keep the displayed score honest even when it doesn't clear the bar.
      db.update(leads).set({ score: score.total, updatedAt: now }).where(eq(leads.id, lead.id)).run();
    }
  }

  return { requeued, reevaluated: candidates.length };
}

export function countRows(table: "leads" | "audits" | "outreach"): number {
  const row = sqlite.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number };
  return row.c;
}
