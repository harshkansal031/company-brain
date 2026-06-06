import { reflectionRuns, type DbClient } from "@/lib/db";
import type { HindsightSDKClient } from "@/lib/hindsight";

const REFLECTION_QUERIES = [
  {
    key: "daily-changes",
    query: "What changed today across engineering and product? Summarize key facts, decisions, and status changes.",
    budget: "mid" as const,
  },
  {
    key: "blocked-projects",
    query: "What projects appear blocked or slipping? List blockers with evidence.",
    budget: "mid" as const,
  },
  { key: "new-risks", query: "What new risks emerged in the last 24 hours?", budget: "mid" as const },
  { key: "daily-decisions", query: "What significant decisions were made today?", budget: "low" as const },
  { key: "focus-tomorrow", query: "What should leadership focus on tomorrow?", budget: "high" as const },
];

export async function runNightlyReflection(
  db: DbClient,
  hindsight: HindsightSDKClient,
  hindsightBankId: string,
  companyId: string,
): Promise<{ runsCount: number; errors: string[] }> {
  let runsCount = 0;
  const errors: string[] = [];
  const dateString = new Date().toISOString().split("T")[0];

  for (const item of REFLECTION_QUERIES) {
    try {
      const result = await hindsight.reflect(hindsightBankId, item.query, { budget: item.budget });
      const text = result.text || "";
      if (!text.trim()) continue;

      await hindsight.retain(hindsightBankId, text, {
        documentId: `reflection:${item.key}:${dateString}`,
        context: "nightly-reflection",
        timestamp: new Date().toISOString(),
        tags: ["type:observation"],
        metadata: { query: item.query, queryKey: item.key },
      });

      await db.insert(reflectionRuns).values({
        companyId,
        query: item.query,
        responseText: text,
        retained: true,
      });
      runsCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Nightly reflection query failed for ${item.key}:`, err);
      errors.push(`${item.key}: ${message}`);
      await db.insert(reflectionRuns).values({
        companyId,
        query: item.query,
        responseText: `FAILED: ${message}`,
        retained: false,
      });
    }
  }

  return { runsCount, errors };
}
