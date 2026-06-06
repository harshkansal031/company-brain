import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: path.resolve(__dirname, ".env") });
config({ path: path.resolve(__dirname, ".env.local"), override: true });

function getDatabaseUrl(): string {
  if (process.env.DATABASE_DIRECT_URL) return process.env.DATABASE_DIRECT_URL;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url.replace(":6543/", ":5432/").replace(/[?&]pgbouncer=true/g, "").replace(/\?$/, "");
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: { url: getDatabaseUrl() },
});
