import { createComposioClient } from "@/lib/composio";
import { runExtractionPipeline } from "@/lib/extraction";
import { createHindsightClient } from "@/lib/hindsight";
import { runIngestionPipeline, type IngestOptions } from "@/lib/ingestion";
import type { DbClient } from "@/lib/db";

export { SynchronizationActiveError } from "@/lib/ingestion";

export interface PipelineResult {
  runId: string;
  extraction: { processed: number; skipped: number; failed: number };
}

const MAX_EXTRACTION_BATCHES = 40;

export async function runCompanyPipeline(db: DbClient, options: IngestOptions): Promise<PipelineResult> {
  const composio = createComposioClient(process.env.COMPOSIO_API_KEY!);
  const runId = await runIngestionPipeline(db, composio, options);

  const company = await db.query.companies.findFirst({
    where: (cols, { eq }) => eq(cols.id, options.companyId),
  });
  if (!company) throw new Error(`Company config not found: ${options.companyId}`);

  const hindsight = createHindsightClient(process.env.HINDSIGHT_API_URL!, process.env.HINDSIGHT_API_KEY!);
  const extraction = { processed: 0, skipped: 0, failed: 0 };

  for (let batch = 0; batch < MAX_EXTRACTION_BATCHES; batch++) {
    const result = await runExtractionPipeline(
      db,
      hindsight,
      company.hindsightBankId,
      process.env.GEMINI_API_KEY!,
      process.env.GEMINI_MODEL || "gemini-2.0-flash",
      options.companyId,
    );

    extraction.processed += result.processed;
    extraction.skipped += result.skipped;
    extraction.failed += result.failed;
    if (result.processed === 0 && result.skipped === 0 && result.failed === 0) break;
  }

  return { runId, extraction };
}
