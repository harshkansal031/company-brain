import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  clerkOrgId: text("clerk_org_id").unique(),
  provisioningStatus: text("provisioning_status").default("pending").notNull(),
  hindsightBankId: text("hindsight_bank_id").notNull(),
  composioUserId: text("composio_user_id").notNull(),
  mentalModelIds: jsonb("mental_model_ids").default({}).notNull(),
  settings: jsonb("settings").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    clerkRole: text("clerk_role").notNull().default("org:member"),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("members_company_id_idx").on(table.companyId)],
);

export const connectedAccounts = pgTable(
  "connected_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    toolkit: text("toolkit").notNull(),
    composioConnectedAccountId: text("composio_connected_account_id").notNull(),
    status: text("status").notNull(),
    connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow().notNull(),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("company_toolkit_idx").on(table.companyId, table.toolkit)],
);

export const rawEvents = pgTable(
  "raw_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    dedupKey: text("dedup_key").notNull(),
    eventType: text("event_type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    author: text("author").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    payload: jsonb("payload").notNull(),
    extractionStatus: text("extraction_status").default("pending").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("company_source_id_idx").on(table.companyId, table.source, table.sourceId),
    index("company_extraction_status_occurred_idx").on(
      table.companyId,
      table.extractionStatus,
      table.occurredAt,
    ),
    index("company_occurred_idx").on(table.companyId, table.occurredAt),
  ],
);

export const ingestionRuns = pgTable("ingestion_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull(),
  sources: jsonb("sources").default({}).notNull(),
  eventsFetched: integer("events_fetched").default(0).notNull(),
  error: text("error"),
});

export const extractionJobs = pgTable("extraction_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  rawEventId: uuid("raw_event_id")
    .references(() => rawEvents.id, { onDelete: "cascade" })
    .notNull(),
  status: text("status").notNull(),
  extractedItems: jsonb("extracted_items").default([]).notNull(),
  hindsightDocumentIds: text("hindsight_document_ids").array(),
  error: text("error"),
  processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reflectionRuns = pgTable("reflection_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  query: text("query").notNull(),
  responseText: text("response_text").notNull(),
  retained: boolean("retained").default(false).notNull(),
  ranAt: timestamp("ran_at", { withTimezone: true }).defaultNow().notNull(),
});

export const companiesRelations = relations(companies, ({ many }) => ({
  members: many(members),
  connectedAccounts: many(connectedAccounts),
  rawEvents: many(rawEvents),
  ingestionRuns: many(ingestionRuns),
  extractionJobs: many(extractionJobs),
  reflectionRuns: many(reflectionRuns),
}));

export const membersRelations = relations(members, ({ one }) => ({
  company: one(companies, { fields: [members.companyId], references: [companies.id] }),
}));

export const connectedAccountsRelations = relations(connectedAccounts, ({ one }) => ({
  company: one(companies, {
    fields: [connectedAccounts.companyId],
    references: [companies.id],
  }),
}));

export const rawEventsRelations = relations(rawEvents, ({ one, many }) => ({
  company: one(companies, { fields: [rawEvents.companyId], references: [companies.id] }),
  extractionJobs: many(extractionJobs),
}));

export const ingestionRunsRelations = relations(ingestionRuns, ({ one }) => ({
  company: one(companies, { fields: [ingestionRuns.companyId], references: [companies.id] }),
}));

export const extractionJobsRelations = relations(extractionJobs, ({ one }) => ({
  company: one(companies, { fields: [extractionJobs.companyId], references: [companies.id] }),
  rawEvent: one(rawEvents, { fields: [extractionJobs.rawEventId], references: [rawEvents.id] }),
}));

export const reflectionRunsRelations = relations(reflectionRuns, ({ one }) => ({
  company: one(companies, { fields: [reflectionRuns.companyId], references: [companies.id] }),
}));
