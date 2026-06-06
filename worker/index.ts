import path from "node:path";
import { config } from "dotenv";
import { companies, createDbClient, eq } from "@/lib/db";
import { createHindsightClient } from "@/lib/hindsight";
import { runCompanyPipeline, SynchronizationActiveError } from "@/lib/pipeline";
import { runNightlyReflection } from "@/lib/reflection";

const appRoot = path.resolve(__dirname, "..");
config({ path: path.join(appRoot, ".env") });
config({ path: path.join(appRoot, ".env.local"), override: true });

function parseIntervalMs(name: string, defaultMs: number): number {
  const raw = process.env[name];
  if (!raw) return defaultMs;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1000) {
    console.warn(`[worker] ${name} invalid (${raw}), using ${defaultMs}ms`);
    return defaultMs;
  }
  return parsed;
}

const PIPELINE_INTERVAL_MS = parseIntervalMs("PIPELINE_INTERVAL_MS", 3_600_000);
const REFLECTION_INTERVAL_MS = parseIntervalMs("REFLECTION_INTERVAL_MS", 86_400_000);

function requireEnv(): void {
  const missing = ["DATABASE_URL", "COMPOSIO_API_KEY", "HINDSIGHT_API_URL", "HINDSIGHT_API_KEY", "GEMINI_API_KEY"].filter(
    (key) => !process.env[key],
  );
  if (missing.length > 0) {
    console.error(`[worker] Missing required env: ${missing.join(", ")}`);
    process.exit(1);
  }
}

async function getActiveCompanies(db: ReturnType<typeof createDbClient>) {
  return db.query.companies.findMany({ where: eq(companies.provisioningStatus, "ready") });
}

async function runScheduledPipelines() {
  const db = createDbClient(process.env.DATABASE_URL!);
  const activeCompanies = await getActiveCompanies(db);
  console.log(`[worker] pipeline pass for ${activeCompanies.length} companies`);
  for (const company of activeCompanies) {
    try {
      const result = await runCompanyPipeline(db, { companyId: company.id, runType: "incremental" });
      console.log(`[worker] pipeline complete ${company.id}`, result);
    } catch (err) {
      if (err instanceof SynchronizationActiveError) console.warn(`[worker] skipped ${company.id}: ${err.message}`);
      else console.error(`[worker] pipeline failed ${company.id}:`, err);
    }
  }
}

async function runScheduledReflection() {
  const db = createDbClient(process.env.DATABASE_URL!);
  const hindsight = createHindsightClient(process.env.HINDSIGHT_API_URL!, process.env.HINDSIGHT_API_KEY!);
  const activeCompanies = await getActiveCompanies(db);
  console.log(`[worker] reflection pass for ${activeCompanies.length} companies`);
  for (const company of activeCompanies) {
    try {
      const result = await runNightlyReflection(db, hindsight, company.hindsightBankId, company.id);
      console.log(`[worker] reflection complete ${company.id}`, result);
    } catch (err) {
      console.error(`[worker] reflection failed ${company.id}:`, err);
    }
  }
}

requireEnv();
console.log(`[worker] started: pipeline=${PIPELINE_INTERVAL_MS}ms reflection=${REFLECTION_INTERVAL_MS}ms`);
void runScheduledPipelines();
setInterval(() => void runScheduledPipelines(), PIPELINE_INTERVAL_MS);
setInterval(() => void runScheduledReflection(), REFLECTION_INTERVAL_MS);
