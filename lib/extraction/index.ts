import { and, eq, extractionJobs, rawEvents, type DbClient } from "@/lib/db";
import type { HindsightSDKClient } from "@/lib/hindsight";
import { extractInsightsFromEvent } from "./extract";
import { shouldFilterNoise } from "./noise-filter";

export function deriveDocumentId(
  source: string,
  eventType: string,
  sourceId: string,
  payload: Record<string, unknown>,
): string {
  if (source === "slack") {
    const slackChannel = payload.channel_id || "default";
    const slackThreadTs = payload.thread_ts || sourceId;
    return `slack:${slackChannel}:${slackThreadTs}`;
  }
  if (source === "linear") return `linear:${sourceId}`;
  if (source === "github") {
    const repoPath =
      typeof payload.html_url === "string" ? payload.html_url.replace("https://github.com/", "") : "repo";
    return `github:${repoPath}`;
  }
  return `${source}:${eventType}:${sourceId}`;
}

export async function runExtractionPipeline(
  db: DbClient,
  hindsight: HindsightSDKClient,
  hindsightBankId: string,
  geminiApiKey: string,
  geminiModel: string,
  companyId: string,
  batchSize = 25,
): Promise<{ processed: number; skipped: number; failed: number }> {
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  const pendingEvents = await db.transaction((tx) =>
    tx
      .select()
      .from(rawEvents)
      .where(and(eq(rawEvents.companyId, companyId), eq(rawEvents.extractionStatus, "pending")))
      .orderBy(rawEvents.occurredAt)
      .limit(batchSize)
      .for("update", { skipLocked: true }),
  );

  for (const event of pendingEvents) {
    try {
      await db.update(rawEvents).set({ extractionStatus: "processing" }).where(eq(rawEvents.id, event.id));

      const filterResult = shouldFilterNoise(event.body, event.author);
      if (filterResult.filter) {
        await markExtraction(db, companyId, event.id, "skipped", [], [], `Noise Filter skipped: ${filterResult.reason}`);
        skipped++;
        continue;
      }

      const insights = await extractInsightsFromEvent(geminiApiKey, geminiModel, event.body);
      const highSignalInsights = insights.filter((item) => item.confidence >= 0.5);

      if (highSignalInsights.length === 0) {
        await markExtraction(db, companyId, event.id, "skipped", insights, [], "Low confidence / No high-signal insights extracted.");
        skipped++;
        continue;
      }

      const payload = (event.payload || {}) as Record<string, unknown>;
      const documentId = deriveDocumentId(event.source, event.eventType, event.sourceId, payload);
      const hindsightDocumentIds: string[] = [];

      for (const item of highSignalInsights) {
        await hindsight.retain(hindsightBankId, item.content, {
          documentId,
          context: `${event.source} ${item.type}`,
          timestamp: new Date(event.occurredAt).toISOString(),
          tags: [`source:${event.source}`, `type:${item.type}`],
          metadata: {
            rawEventId: event.id,
            entities: item.entities.join(", "),
            confidence: item.confidence.toString(),
          },
        });
        hindsightDocumentIds.push(documentId);
      }

      await markExtraction(db, companyId, event.id, "done", highSignalInsights, hindsightDocumentIds);
      processed++;
    } catch (err) {
      console.error(`Extraction failed for event ${event.id}:`, err);
      await markExtraction(db, companyId, event.id, "failed", [], [], err instanceof Error ? err.message : String(err));
      failed++;
    }
  }

  return { processed, skipped, failed };
}

async function markExtraction(
  db: DbClient,
  companyId: string,
  rawEventId: string,
  status: "done" | "skipped" | "failed",
  extractedItems: unknown[],
  hindsightDocumentIds: string[],
  error?: string,
) {
  await db.update(rawEvents).set({ extractionStatus: status }).where(eq(rawEvents.id, rawEventId));
  await db.insert(extractionJobs).values({
    companyId,
    rawEventId,
    status,
    extractedItems,
    hindsightDocumentIds,
    error,
  });
}
