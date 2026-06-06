import { createHash } from "node:crypto";
import {
  and,
  companies,
  connectedAccounts,
  desc,
  eq,
  ingestionRuns,
  lt,
  rawEvents,
  sql,
  type DbClient,
} from "@/lib/db";
import {
  fetchAllLinearIssues,
  fetchGitHubActivity,
  fetchLinearIssues,
  fetchSlackHistory,
  listLinearTeams,
  type ComposioSDKClient,
} from "@/lib/composio";
import {
  normalizeGitHubEvent,
  normalizeLinearIssue,
  normalizeSlackMessage,
  type NormalizedEvent,
} from "./normalize";

export interface IngestOptions {
  companyId: string;
  runType: "backfill" | "incremental";
  targetToolkit?: string;
}

export class SynchronizationActiveError extends Error {
  constructor(companyId: string) {
    super(`A synchronization is already active for company ${companyId}`);
    this.name = "SynchronizationActiveError";
  }
}

export function computeDedupKey(companyId: string, source: string, sourceId: string): string {
  return createHash("sha256").update(`${companyId}:${source}:${sourceId}`).digest("hex");
}

export async function runIngestionPipeline(
  db: DbClient,
  composio: ComposioSDKClient,
  options: IngestOptions,
): Promise<string> {
  const { companyId, runType, targetToolkit } = options;
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);

  await db
    .update(ingestionRuns)
    .set({ status: "failed", finishedAt: new Date(), error: "Stale run recovered (interrupted)" })
    .where(
      and(
        eq(ingestionRuns.companyId, companyId),
        eq(ingestionRuns.status, "running"),
        lt(ingestionRuns.startedAt, staleBefore),
      ),
    );

  const activeRun = await db.query.ingestionRuns.findFirst({
    where: (runs, { and, eq }) => and(eq(runs.companyId, companyId), eq(runs.status, "running")),
  });
  if (activeRun) throw new SynchronizationActiveError(companyId);

  const [runRecord] = await db
    .insert(ingestionRuns)
    .values({ companyId, status: "running", startedAt: new Date(), sources: {}, eventsFetched: 0 })
    .returning();

  const runId = runRecord.id;

  try {
    const queryConditions = [
      eq(connectedAccounts.companyId, companyId),
      eq(connectedAccounts.status, "ACTIVE"),
    ];
    if (runType === "backfill" && targetToolkit) {
      queryConditions.push(eq(connectedAccounts.toolkit, targetToolkit));
    }

    const activeAccounts = await db.select().from(connectedAccounts).where(and(...queryConditions));
    if (activeAccounts.length === 0) {
      await db
        .update(ingestionRuns)
        .set({
          status: "success",
          finishedAt: new Date(),
          error: "No active connected accounts found to sync.",
        })
        .where(eq(ingestionRuns.id, runId));
      return runId;
    }

    const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
    const settings = (company?.settings || {}) as Record<string, unknown>;
    const composioUserId = company?.composioUserId || `company_${companyId}`;
    const since =
      runType === "backfill"
        ? new Date(Date.now() - 48 * 60 * 60 * 1000)
        : await getIncrementalSince(db, companyId);

    let totalEventsFetched = 0;
    const sourcesSummary: Record<string, { fetched: number; status: string; error?: string }> = {};

    for (const account of activeAccounts) {
      const toolkit = account.toolkit;
      if (!["github", "slack", "linear"].includes(toolkit)) continue;
      sourcesSummary[toolkit] = { fetched: 0, status: "running" };

      try {
        const events = await ingestToolkit(db, composio, {
          companyId,
          composioUserId,
          toolkit,
          since,
          runType,
          settings,
          connectedAccountId: account.composioConnectedAccountId,
        });

        sourcesSummary[toolkit] = { fetched: events.length, status: "success" };
        totalEventsFetched += events.length;
        await db.update(connectedAccounts).set({ lastSyncAt: new Date() }).where(eq(connectedAccounts.id, account.id));
      } catch (err) {
        console.error(`Ingestion error for toolkit ${toolkit}:`, err);
        sourcesSummary[toolkit] = {
          fetched: 0,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    const hasFailures = Object.values(sourcesSummary).some((source) => source.status === "failed");
    await db
      .update(ingestionRuns)
      .set({
        status: hasFailures ? "partial" : "success",
        finishedAt: new Date(),
        sources: sourcesSummary,
        eventsFetched: totalEventsFetched,
      })
      .where(eq(ingestionRuns.id, runId));
  } catch (err) {
    await db
      .update(ingestionRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      })
      .where(eq(ingestionRuns.id, runId));
    throw err;
  }

  return runId;
}

async function getIncrementalSince(db: DbClient, companyId: string): Promise<Date> {
  const lastSuccessRun = await db.query.ingestionRuns.findFirst({
    where: (runs, { and, eq }) => and(eq(runs.companyId, companyId), eq(runs.status, "success")),
    orderBy: desc(ingestionRuns.finishedAt),
  });
  return lastSuccessRun?.finishedAt
    ? new Date(lastSuccessRun.finishedAt)
    : new Date(Date.now() - 60 * 60 * 1000);
}

async function ingestToolkit(
  db: DbClient,
  composio: ComposioSDKClient,
  params: {
    companyId: string;
    composioUserId: string;
    toolkit: string;
    since: Date;
    runType: "backfill" | "incremental";
    settings: Record<string, unknown>;
    connectedAccountId: string;
  },
): Promise<NormalizedEvent[]> {
  const events: NormalizedEvent[] = [];

  if (params.toolkit === "slack") {
    const channels = (params.settings.slackChannelIds || []) as string[];
    for (const channel of channels) {
      const messages = await fetchSlackHistory(composio, params.composioUserId, channel, params.since);
      events.push(...messages.map((message) => normalizeSlackMessage(message, channel)));
    }
  }

  if (params.toolkit === "linear") {
    const projectId = params.settings.linearProjectId as string | undefined;
    const teamIds = (params.settings.linearTeamIds || []) as string[];
    if (teamIds.length === 0) {
      const issues = await fetchAllLinearIssues(composio, params.composioUserId, params.since, projectId);
      events.push(...issues.map(normalizeLinearIssue));

      const discoveredTeamIds = await listLinearTeams(composio, params.composioUserId);
      if (discoveredTeamIds.length > 0) {
        await db
          .update(companies)
          .set({ settings: { ...params.settings, linearTeamIds: discoveredTeamIds } })
          .where(eq(companies.id, params.companyId));
      }
    } else {
      for (const teamId of teamIds) {
        const issues = await fetchLinearIssues(composio, params.composioUserId, teamId, projectId, params.since);
        events.push(...issues.map(normalizeLinearIssue));
      }
    }
  }

  if (params.toolkit === "github") {
    const reposConfigured = params.settings.githubReposConfigured === true;
    const repos = reposConfigured
      ? ((params.settings.githubRepos || []) as Array<{ owner: string; repo: string }>)
      : [];
    if (!reposConfigured || repos.length === 0) return [];

    for (const repo of repos) {
      const raw = await fetchGitHubActivity(
        composio,
        params.composioUserId,
        repo.owner,
        repo.repo,
        params.runType === "backfill" ? undefined : params.since,
        { connectedAccountId: params.connectedAccountId },
      );
      events.push(...raw.map(normalizeGitHubEvent));
    }
  }

  for (const event of events) {
    await db
      .insert(rawEvents)
      .values({
        companyId: params.companyId,
        source: event.source,
        sourceId: event.sourceId,
        dedupKey: computeDedupKey(params.companyId, event.source, event.sourceId),
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        author: event.author,
        title: event.title || null,
        body: event.body,
        payload: event.payload,
        extractionStatus: "pending",
      })
      .onConflictDoUpdate({
        target: [rawEvents.companyId, rawEvents.source, rawEvents.sourceId],
        set: {
          body: sql`EXCLUDED.body`,
          payload: sql`EXCLUDED.payload`,
          occurredAt: sql`EXCLUDED.occurred_at`,
          extractionStatus: "pending",
        },
      });
  }

  return events;
}
