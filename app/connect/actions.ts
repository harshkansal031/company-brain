"use server";

import { revalidatePath } from "next/cache";
import { and, companies, connectedAccounts, eq } from "@/lib/db";
import { db, getCompanySettings } from "@/lib/db";
import { createComposioClient, generateConnectionLink, isSupportedToolkit, listGitHubRepos } from "@/lib/composio";
import { requireCompany } from "@/lib/company";
import { runCompanyPipeline, SynchronizationActiveError } from "@/lib/pipeline";

export type GitHubRepoSelection = { owner: string; repo: string };

export async function connectToolkit(toolkit: string) {
  if (!isSupportedToolkit(toolkit)) throw new Error(`Unsupported toolkit: ${toolkit}`);

  const company = await requireCompany();
  const composio = createComposioClient(process.env.COMPOSIO_API_KEY!);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const callbackUrl = new URL("/api/composio/callback", baseUrl);
  callbackUrl.searchParams.set("toolkit", toolkit);
  callbackUrl.searchParams.set("userId", company.composioUserId || `company_${company.id}`);

  return generateConnectionLink(composio, company.composioUserId || `company_${company.id}`, toolkit, callbackUrl.toString());
}

export async function disconnectToolkit(toolkit: string) {
  const company = await requireCompany();
  const account = await db.query.connectedAccounts.findFirst({
    where: and(
      eq(connectedAccounts.companyId, company.id),
      eq(connectedAccounts.toolkit, toolkit),
      eq(connectedAccounts.status, "ACTIVE"),
    ),
  });

  if (!account) return { success: false as const, error: "not_found" };

  const composio = createComposioClient(process.env.COMPOSIO_API_KEY!);
  await composio.connectedAccounts.delete(account.composioConnectedAccountId);
  await db.delete(connectedAccounts).where(eq(connectedAccounts.id, account.id));

  if (toolkit === "github") {
    const settings = getCompanySettings(company);
    const rest = { ...settings };
    delete rest.githubRepos;
    delete rest.githubReposConfigured;
    await db
      .update(companies)
      .set({ settings: { ...rest, githubRepos: [], githubReposConfigured: false } })
      .where(eq(companies.id, company.id));
  }

  revalidatePath("/connect");
  return { success: true as const };
}

export async function fetchAvailableGitHubRepos(): Promise<GitHubRepoSelection[]> {
  const company = await requireCompany();
  const account = await db.query.connectedAccounts.findFirst({
    where: and(
      eq(connectedAccounts.companyId, company.id),
      eq(connectedAccounts.toolkit, "github"),
      eq(connectedAccounts.status, "ACTIVE"),
    ),
  });
  if (!account) throw new Error("GitHub is not connected");

  const composio = createComposioClient(process.env.COMPOSIO_API_KEY!);
  return listGitHubRepos(composio, company.composioUserId || `company_${company.id}`, {
    connectedAccountId: account.composioConnectedAccountId,
  });
}

export async function saveGitHubRepos(repos: GitHubRepoSelection[]) {
  const company = await requireCompany();
  const settings = getCompanySettings(company);
  const normalized = repos
    .map((repo) => ({ owner: repo.owner.trim(), repo: repo.repo.trim() }))
    .filter((repo) => repo.owner && repo.repo);

  await db
    .update(companies)
    .set({ settings: { ...settings, githubRepos: normalized, githubReposConfigured: normalized.length > 0 } })
    .where(eq(companies.id, company.id));

  if (normalized.length > 0) {
    runCompanyPipeline(db, { companyId: company.id, runType: "backfill", targetToolkit: "github" }).catch((err) => {
      if (err instanceof SynchronizationActiveError) {
        console.warn(`GitHub backfill skipped for ${company.id}: ${err.message}`);
      } else {
        console.error(`GitHub backfill after repo selection failed for ${company.id}:`, err);
      }
    });
  }

  revalidatePath("/connect");
  revalidatePath("/pipeline");
  return { success: true as const, count: normalized.length };
}
