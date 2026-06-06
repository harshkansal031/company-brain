import { and, companies, connectedAccounts, eq, ingestionRuns, lt } from "@/lib/db";
import { requireCompany } from "@/lib/company";
import { db, getCompanySettings } from "@/lib/db";
import { ProductShell } from "@/components/product-shell";
import { ConnectDashboard } from "./connect-dashboard";

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ configure?: string }>;
}) {
  const params = await searchParams;
  const company = await requireCompany();
  const connections = await db
    .select()
    .from(connectedAccounts)
    .where(and(eq(connectedAccounts.companyId, company.id), eq(connectedAccounts.status, "ACTIVE")));

  const connectedToolkits = connections.map((connection) => connection.toolkit);
  await recoverStaleRuns(company.id);

  const activeRun = await db.query.ingestionRuns.findFirst({
    where: (runs, { and, eq }) => and(eq(runs.companyId, company.id), eq(runs.status, "running")),
  });

  let settings = getCompanySettings(company);
  if (connectedToolkits.includes("github") && settings.githubRepos?.length && settings.githubReposConfigured !== true) {
    await db
      .update(companies)
      .set({ settings: { ...settings, githubRepos: [], githubReposConfigured: false } })
      .where(eq(companies.id, company.id));
    settings = { ...settings, githubRepos: [], githubReposConfigured: false };
  }

  return (
    <ProductShell>
      <ConnectDashboard
        connectedToolkits={connectedToolkits}
        isSyncing={!!activeRun}
        openGitHubPicker={params.configure === "github" || (connectedToolkits.includes("github") && settings.githubReposConfigured !== true)}
        ingestConfig={{
          githubRepos: settings.githubRepos,
          githubReposConfigured: settings.githubReposConfigured,
          linearTeamIds: settings.linearTeamIds,
        }}
      />
    </ProductShell>
  );
}

export const dynamic = "force-dynamic";

async function recoverStaleRuns(companyId: string) {
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
}
