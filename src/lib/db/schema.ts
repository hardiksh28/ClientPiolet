import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  company: text("company").notNull(),
  domain: text("domain").notNull().unique(),
  country: text("country"),
  industry: text("industry"),
  source: text("source").notNull(), // job_board | product_hunt | directory | github
  sourceMeta: text("source_meta").notNull().default("{}"), // JSON
  status: text("status").notNull().default("queued"), // queued | sent | replied | archived
  archiveReason: text("archive_reason"), // low_score | no_problems | no_contact | dismissed | fetch_failed
  score: integer("score").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const audits = sqliteTable("audits", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  fetchedAt: integer("fetched_at").notNull(),
  httpStatus: integer("http_status"),
  title: text("title"),
  h1: text("h1"),
  metaDesc: text("meta_desc"),
  tech: text("tech").notNull().default("[]"), // JSON string[]
  problems: text("problems").notNull().default("[]"), // JSON {tag, weight, evidence}[]
  pageBytes: integer("page_bytes"),
});

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  name: text("name"),
  role: text("role"),
  email: text("email").notNull(),
  confidence: text("confidence").notNull(), // direct | role | form_only
  sourceUrl: text("source_url"),
});

export const outreach = sqliteTable("outreach", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("initial"), // initial | followup_1 | followup_2
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  service: text("service"),
  draftedAt: integer("drafted_at").notNull(),
  sentAt: integer("sent_at"),
  repliedAt: integer("replied_at"),
  replyClass: text("reply_class"), // hot | interested | maybe | not_now | no | auto
  replySnippet: text("reply_snippet"), // captured from Gmail sync only; null for manual marks
});

export const aiAnalysis = sqliteTable("ai_analysis", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  qualified: integer("qualified", { mode: "boolean" }).notNull(),
  confidence: text("confidence").notNull(), // high | medium | low
  opportunity: text("opportunity").notNull(),
  whyNow: text("why_now").notNull(),
  evidence: text("evidence").notNull().default("[]"), // JSON string[]
  service: text("service").notNull(),
  recommendedAction: text("recommended_action").notNull(),
  summary: text("summary").notNull(),
  model: text("model").notNull(),
  inputHash: text("input_hash").notNull(), // for cache-skip on re-runs with unchanged evidence
  analyzedAt: integer("analyzed_at").notNull(),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: false }).default(1),
  services: text("services").notNull().default("[]"), // JSON string[]
  countries: text("countries").notNull().default("[]"), // JSON string[]
  minScore: integer("min_score").notNull().default(70),
  dailyLimit: integer("daily_limit").notNull().default(20),
  portfolioUrl: text("portfolio_url").notNull().default(""),
  senderName: text("sender_name").notNull().default("Hardik"),
  gmailRefreshToken: text("gmail_refresh_token"),
  gmailConnectedEmail: text("gmail_connected_email"),
  automationEnabled: integer("automation_enabled", { mode: "boolean" }).notNull().default(false),
  automationIntervalMinutes: integer("automation_interval_minutes").notNull().default(360),
  lastAutoRunAt: integer("last_auto_run_at"),
});
