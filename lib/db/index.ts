import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "drizzle-orm";
export * from "./schema";

export function createDbClient(connectionString: string) {
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes("[")) {
    throw new Error("DATABASE_URL is missing or still contains placeholder values.");
  }
  return url;
}

let dbClient: DbClient | undefined;

function getDb(): DbClient {
  dbClient ??= createDbClient(requireDatabaseUrl());
  return dbClient;
}

export const db: DbClient = new Proxy({} as DbClient, {
  get(_target, prop) {
    const client = getDb();
    const value = client[prop as keyof DbClient];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type Company = typeof schema.companies.$inferSelect;

export type CompanySettings = {
  hindsightScopedKey?: {
    keyId: string;
    prefix: string;
    expiresAt: string;
    createdAt: string;
  };
  slackChannelIds?: string[];
  linearTeamIds?: string[];
  linearProjectId?: string;
  githubRepos?: Array<{ owner: string; repo: string }>;
  githubReposConfigured?: boolean;
  [key: string]: unknown;
};

export function getCompanySettings(company: { settings: unknown }): CompanySettings {
  return (company.settings as CompanySettings) || {};
}
