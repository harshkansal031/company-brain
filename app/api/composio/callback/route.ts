import { NextRequest, NextResponse } from "next/server";
import { companies, connectedAccounts, createDbClient, eq } from "@/lib/db";
import { isSupportedToolkit } from "@/lib/composio";
import { runCompanyPipeline, SynchronizationActiveError } from "@/lib/pipeline";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const connectedAccountId = searchParams.get("connectedAccountId") ?? searchParams.get("connected_account_id");
  const userId = searchParams.get("userId") ?? searchParams.get("user_id");
  const toolkit = searchParams.get("toolkit");

  if (status !== "success" || !connectedAccountId || !userId || !toolkit || !isSupportedToolkit(toolkit)) {
    return NextResponse.redirect(new URL("/connect?error=auth_failed", request.url));
  }

  const companyId = userId.replace("company_", "");
  const db = createDbClient(process.env.DATABASE_URL!);

  try {
    await db
      .insert(connectedAccounts)
      .values({ companyId, toolkit, composioConnectedAccountId: connectedAccountId, status: "ACTIVE" })
      .onConflictDoUpdate({
        target: [connectedAccounts.companyId, connectedAccounts.toolkit],
        set: { composioConnectedAccountId: connectedAccountId, status: "ACTIVE", connectedAt: new Date() },
      });

    if (toolkit === "github") {
      const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
      if (company) {
        const current = (company.settings || {}) as Record<string, unknown>;
        const rest = { ...current };
        delete rest.githubRepos;
        delete rest.githubReposConfigured;
        await db
          .update(companies)
          .set({ settings: { ...rest, githubRepos: [], githubReposConfigured: false } })
          .where(eq(companies.id, companyId));
      }
    } else {
      runCompanyPipeline(db, { companyId, runType: "backfill", targetToolkit: toolkit }).catch((err) => {
        if (err instanceof SynchronizationActiveError) {
          console.warn(`Backfill skipped for company ${companyId}: ${err.message}`);
        } else {
          console.error(`Asynchronous backfill failed for company ${companyId}:`, err);
        }
      });
    }

    return NextResponse.redirect(new URL(toolkit === "github" ? "/connect?configure=github" : "/connect", request.url));
  } catch (error) {
    console.error("Error handling Composio callback:", error);
    return NextResponse.redirect(new URL("/connect?error=internal_error", request.url));
  }
}

export const dynamic = "force-dynamic";
