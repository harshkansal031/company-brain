import { desc, eq, extractionJobs, ingestionRuns, rawEvents, reflectionRuns, sql } from "@/lib/db";
import { requireCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { ProductShell } from "@/components/product-shell";

export default async function DashboardPage() {
  const company = await requireCompany();
  const [runs, reflections, eventCounts, recentInsights] = await Promise.all([
    db.query.ingestionRuns.findMany({
      where: eq(ingestionRuns.companyId, company.id),
      orderBy: desc(ingestionRuns.startedAt),
      limit: 5,
    }),
    db.query.reflectionRuns.findMany({
      where: eq(reflectionRuns.companyId, company.id),
      orderBy: desc(reflectionRuns.ranAt),
      limit: 3,
    }),
    db
      .select({ status: rawEvents.extractionStatus, count: sql<number>`count(*)` })
      .from(rawEvents)
      .where(eq(rawEvents.companyId, company.id))
      .groupBy(rawEvents.extractionStatus),
    db.query.extractionJobs.findMany({
      where: eq(extractionJobs.companyId, company.id),
      orderBy: desc(extractionJobs.processedAt),
      limit: 4,
    }),
  ]);

  const totalEvents = eventCounts.reduce((sum, item) => sum + Number(item.count), 0);
  const retained = eventCounts.find((item) => item.status === "done")?.count ?? 0;

  return (
    <ProductShell>
      <div className="space-y-8">
        <header>
          <p className="text-sm text-neutral-500">Workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{company.name}</h1>
          <p className="mt-2 max-w-2xl text-neutral-400">
            Operational memory from Slack, Linear, and GitHub, retained into the company Hindsight bank.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <Metric label="Raw events" value={totalEvents} />
          <Metric label="Retained insights" value={Number(retained)} />
          <Metric label="Recent runs" value={runs.length} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel title="Latest Syncs">
            <div className="divide-y divide-white/10">
              {runs.length === 0 ? (
                <Empty>No sync runs yet. Connect a tool to begin ingestion.</Empty>
              ) : (
                runs.map((run) => (
                  <div key={run.id} className="flex items-center justify-between py-4 text-sm">
                    <div>
                      <p className="font-medium">{new Date(run.startedAt).toLocaleString()}</p>
                      <p className="text-neutral-500">{run.eventsFetched} events fetched</p>
                    </div>
                    <Status status={run.status} />
                  </div>
                ))
              )}
            </div>
          </Panel>
          <Panel title="Recent Reflections">
            <div className="space-y-4">
              {reflections.length === 0 ? (
                <Empty>No reflection runs yet.</Empty>
              ) : (
                reflections.map((reflection) => (
                  <article key={reflection.id} className="rounded-lg border border-white/10 bg-black p-4">
                    <p className="text-sm font-medium">{reflection.query}</p>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-400">{reflection.responseText}</p>
                  </article>
                ))
              )}
            </div>
          </Panel>
        </section>

        <Panel title="Latest Extraction Jobs">
          <div className="grid gap-3 sm:grid-cols-2">
            {recentInsights.length === 0 ? (
              <Empty>No extraction jobs yet.</Empty>
            ) : (
              recentInsights.map((job) => (
                <div key={job.id} className="rounded-lg border border-white/10 bg-black p-4 text-sm">
                  <Status status={job.status} />
                  <p className="mt-3 text-neutral-400">{new Date(job.processedAt).toLocaleString()}</p>
                  {job.error ? <p className="mt-2 text-neutral-500">{job.error}</p> : null}
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </ProductShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#111111] p-5">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#111111] p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-neutral-500">{children}</p>;
}

function Status({ status }: { status: string }) {
  const tone =
    status === "success" || status === "done"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : status === "running"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
        : status === "partial" || status === "skipped"
          ? "border-white/10 bg-white/5 text-neutral-300"
          : "border-red-500/20 bg-red-500/10 text-red-300";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${tone}`}>{status}</span>;
}
