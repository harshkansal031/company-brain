import { desc, eq, ingestionRuns, rawEvents, reflectionRuns, sql } from "@/lib/db";
import { requireCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { ProductShell } from "@/components/product-shell";

export default async function PipelinePage() {
  const company = await requireCompany();
  const [syncHistory, reflections, eventCounts] = await Promise.all([
    db.query.ingestionRuns.findMany({
      where: eq(ingestionRuns.companyId, company.id),
      orderBy: desc(ingestionRuns.startedAt),
      limit: 10,
    }),
    db.query.reflectionRuns.findMany({
      where: eq(reflectionRuns.companyId, company.id),
      orderBy: desc(reflectionRuns.ranAt),
      limit: 5,
    }),
    db
      .select({ status: rawEvents.extractionStatus, count: sql<number>`count(*)` })
      .from(rawEvents)
      .where(eq(rawEvents.companyId, company.id))
      .groupBy(rawEvents.extractionStatus),
  ]);

  const metrics = { pending: 0, done: 0, skipped: 0, failed: 0, processing: 0 };
  for (const item of eventCounts) {
    const key = item.status as keyof typeof metrics;
    if (key in metrics) metrics[key] = Number(item.count);
  }
  const total = Object.values(metrics).reduce((sum, value) => sum + value, 0);

  return (
    <ProductShell>
      <div className="space-y-8">
        <header>
          <p className="text-sm text-neutral-500">Operations</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Pipeline status</h1>
          <p className="mt-2 max-w-2xl text-neutral-400">
            Track ingestion, extraction, and nightly reflection activity for this workspace.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-5">
          <Metric label="Total" value={total} />
          <Metric label="Pending" value={metrics.pending} />
          <Metric label="Done" value={metrics.done} />
          <Metric label="Skipped" value={metrics.skipped} />
          <Metric label="Failed" value={metrics.failed} />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Panel title="Sync history">
            <div className="divide-y divide-white/10">
              {syncHistory.length === 0 ? (
                <Empty>No ingestion runs logged yet.</Empty>
              ) : (
                syncHistory.map((run) => (
                  <div key={run.id} className="grid grid-cols-[1fr_auto] gap-4 py-4 text-sm">
                    <div>
                      <p className="font-medium">{new Date(run.startedAt).toLocaleString()}</p>
                      <p className="text-neutral-500">{run.eventsFetched} events</p>
                    </div>
                    <Status status={run.status} />
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel title="Reflection history">
            <div className="space-y-4">
              {reflections.length === 0 ? (
                <Empty>No reflection cycles executed yet.</Empty>
              ) : (
                reflections.map((reflection) => (
                  <article key={reflection.id} className="rounded-lg border border-white/10 bg-black p-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs text-neutral-500">{new Date(reflection.ranAt).toLocaleString()}</p>
                      <Status status={reflection.retained ? "retained" : "failed"} />
                    </div>
                    <h3 className="mt-3 text-sm font-medium">{reflection.query}</h3>
                    <p className="mt-2 line-clamp-4 text-sm leading-6 text-neutral-400">{reflection.responseText}</p>
                  </article>
                ))
              )}
            </div>
          </Panel>
        </section>
      </div>
    </ProductShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#111111] p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#111111] p-5">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-neutral-500">{children}</p>;
}

function Status({ status }: { status: string }) {
  return <span className="inline-flex h-fit rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-neutral-300">{status}</span>;
}

export const dynamic = "force-dynamic";
