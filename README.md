# ClientPilot

Research-and-drafting machine for freelance outreach. It discovers companies, audits their
websites for concrete problems, scores the opportunity, and drafts a cold email — **it never
sends anything itself.** You read the draft, edit a line, and click "Open in Gmail" yourself.

Full plan: [`ClientPilot-Plan-Architecture.pdf`](./ClientPilot-Plan-Architecture.pdf).

## Stack (V1 — matches the plan, minus the hosted pieces)

- Next.js 16 (App Router) + Tailwind — dashboard
- SQLite via Drizzle ORM (`clientpilot.db`, gitignored) instead of Neon — same schema, zero setup.
  Swapping to `drizzle-orm/neon-http` later is a client-file change, not a schema rewrite.
- The pipeline (`src/lib/pipeline/`) runs **for real**, on demand, from the dashboard's "Run
  pipeline now" button instead of a nightly GitHub Actions cron:
  - `discover.ts` — Remotive + RemoteOK (job boards), Show HN (directories), GitHub repo search,
    Product Hunt (needs a token, see below)
  - `resolve.ts` — canonical domain, dedupe, robots.txt check
  - `audit.ts` — real `fetch` + `cheerio`, the 10 deterministic detection rules from the plan
  - `contact.ts` — mailto / Cloudflare-obfuscated email / `/contact` page, no pattern-guessing
  - `score.ts` — the exact 0–100 scoring formula from the plan
  - `draft.ts` — template + evidence → email draft (no AI, per the plan)
  - `gmail-sync.ts` — optional, read-only: checks your inbox for replies from leads you've sent
    to and auto-classifies them (see below)

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The SQLite file and its tables are created automatically on first
run — nothing else to set up.

Click **Run pipeline now** on the Queue page to discover, audit, and score real companies. A
run takes anywhere from ~10s to ~45s depending on how many candidates it audits. It's idempotent
— re-running skips domains already in the database, same as the nightly-cron design in the plan.

Every row in `clientpilot.db` comes from that button — there is no seed data or fake/demo
content anywhere in this project. If the queue looks empty after a run, check the Leads page
filtered to "Archived" to see why each candidate was rejected (no contact found, score too low,
etc.) rather than queued.

### Optional env vars (`.env.local`, see `.env.example`)

- `GITHUB_PAT` — raises the GitHub search rate limit and enables the GitHub-contact lookup.
- `PRODUCTHUNT_TOKEN` — a free PH GraphQL dev token. Without it, Product Hunt discovery is
  skipped (the other three sources still run).
- `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` — from a Google Cloud OAuth client (Gmail API,
  read-only scope). Without these, the "Connect Gmail" button in Settings explains what's
  missing; everything else works fine without it.

## Gmail reply sync (optional, read-only)

Once connected (Settings → Gmail reply sync), the **Check for replies** button on the Queue page
searches your inbox for messages from contacts you've sent to, and — if found — marks the lead
replied and classifies it with a small keyword heuristic (not an LLM call; deliberately
deterministic, same as the rest of the pipeline). It never sends, drafts, or modifies anything in
Gmail — read-only scope only. This still requires a manual click, same as "Run pipeline now"; there
is no cron running in the background.

Once a reply lands and the day-4/day-9 window opens with no response, the lead's page gets a
**Generate follow-up draft** button — it drafts the next follow-up for you to review and send the
same way as the initial email (never auto-sent). Both of these — replies and follow-ups due —
surface together in the **Needs attention** section on the Queue page, so there's one place that
says what to do next instead of you having to click into every lead.

## Known V1 limitations (honest, not bugs)

- Contact discovery only reads static HTML (`fetch` + `cheerio`, no headless browser), so
  JS-rendered contact forms are invisible to it. Per the plan's own discipline rule, a lead with
  no discoverable email is parked, not sent to with a guessed address.
- A site behind a WAF/bot-detection block page returns a 4xx/5xx and is treated as a failed
  fetch rather than audited — parsing a block page as "the homepage" would just fabricate
  evidence.
- Gmail reply search uses day-granularity (`after:YYYY/MM/DD`), so "replied 4 minutes ago" is
  accurate once found, but the search window itself doesn't distinguish morning from evening on
  the send day.
- Reply classification is a keyword heuristic, not AI — it can land on "auto" (needs a manual
  look) for anything that doesn't match an obvious pattern. Deliberate: see the plan doc's
  position on where AI is/isn't worth it.
- No test suite yet for the pipeline modules (`audit.ts`, `score.ts`, `contact.ts`, `resolve.ts`,
  `draft.ts`) — next thing worth adding given the app makes unattended judgment calls about real
  businesses.
