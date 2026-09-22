import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "./schema";

const DB_PATH = path.join(process.cwd(), "clientpilot.db");

// Reuse the connection across hot reloads in dev.
const globalForDb = globalThis as unknown as {
  __clientpilot_sqlite?: Database.Database;
};

// `timeout` sets SQLite's busy_timeout so concurrent Next.js build workers
// opening this same file wait instead of immediately throwing SQLITE_BUSY.
const sqlite = globalForDb.__clientpilot_sqlite ?? new Database(DB_PATH, { timeout: 10000 });
globalForDb.__clientpilot_sqlite = sqlite;

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  country TEXT,
  industry TEXT,
  source TEXT NOT NULL,
  source_meta TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  archive_reason TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audits (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  fetched_at INTEGER NOT NULL,
  http_status INTEGER,
  title TEXT,
  h1 TEXT,
  meta_desc TEXT,
  tech TEXT NOT NULL DEFAULT '[]',
  problems TEXT NOT NULL DEFAULT '[]',
  page_bytes INTEGER
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT,
  email TEXT NOT NULL,
  confidence TEXT NOT NULL,
  source_url TEXT
);

CREATE TABLE IF NOT EXISTS outreach (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'initial',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  service TEXT,
  drafted_at INTEGER NOT NULL,
  sent_at INTEGER,
  replied_at INTEGER,
  reply_class TEXT,
  reply_snippet TEXT
);

CREATE TABLE IF NOT EXISTS ai_analysis (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  qualified INTEGER NOT NULL,
  confidence TEXT NOT NULL,
  opportunity TEXT NOT NULL,
  why_now TEXT NOT NULL,
  evidence TEXT NOT NULL DEFAULT '[]',
  service TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  summary TEXT NOT NULL,
  model TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  analyzed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  services TEXT NOT NULL DEFAULT '[]',
  countries TEXT NOT NULL DEFAULT '[]',
  min_score INTEGER NOT NULL DEFAULT 70,
  daily_limit INTEGER NOT NULL DEFAULT 20,
  portfolio_url TEXT NOT NULL DEFAULT '',
  sender_name TEXT NOT NULL DEFAULT 'Hardik',
  automation_enabled INTEGER NOT NULL DEFAULT 0,
  automation_interval_minutes INTEGER NOT NULL DEFAULT 360,
  last_auto_run_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_leads_status_score ON leads(status, score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_domain ON leads(domain);
CREATE INDEX IF NOT EXISTS idx_outreach_lead ON outreach(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_lead ON ai_analysis(lead_id);
`);

// Lightweight migrations: add columns that didn't exist in earlier versions
// of this file. SQLite has no "ADD COLUMN IF NOT EXISTS", so check first.
const settingsColumns = sqlite.prepare("PRAGMA table_info(settings)").all() as {
  name: string;
}[];
const settingsColumnNames = new Set(settingsColumns.map((c) => c.name));
if (!settingsColumnNames.has("gmail_refresh_token")) {
  sqlite.exec("ALTER TABLE settings ADD COLUMN gmail_refresh_token TEXT");
}
if (!settingsColumnNames.has("gmail_connected_email")) {
  sqlite.exec("ALTER TABLE settings ADD COLUMN gmail_connected_email TEXT");
}
if (!settingsColumnNames.has("automation_enabled")) {
  sqlite.exec("ALTER TABLE settings ADD COLUMN automation_enabled INTEGER NOT NULL DEFAULT 0");
}
if (!settingsColumnNames.has("automation_interval_minutes")) {
  sqlite.exec("ALTER TABLE settings ADD COLUMN automation_interval_minutes INTEGER NOT NULL DEFAULT 360");
}
if (!settingsColumnNames.has("last_auto_run_at")) {
  sqlite.exec("ALTER TABLE settings ADD COLUMN last_auto_run_at INTEGER");
}

const outreachColumns = sqlite.prepare("PRAGMA table_info(outreach)").all() as { name: string }[];
if (!outreachColumns.some((c) => c.name === "reply_snippet")) {
  sqlite.exec("ALTER TABLE outreach ADD COLUMN reply_snippet TEXT");
}

const settingsRow = sqlite
  .prepare("SELECT id FROM settings WHERE id = 1")
  .get();
if (!settingsRow) {
  sqlite
    .prepare(
      `INSERT INTO settings (id, services, countries, min_score, daily_limit, portfolio_url, sender_name)
       VALUES (1, ?, ?, 70, 20, '', 'Hardik')`
    )
    .run(
      JSON.stringify([
        "Landing Page Redesign",
        "Mobile Optimization",
        "Performance Tuning",
        "SEO Basics",
        "Trust & Conversion",
      ]),
      JSON.stringify(["USA", "UK", "India", "Canada", "Europe"])
    );
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
