import { NextRequest, NextResponse } from "next/server";
import { createDbClient } from "@/lib/db";
import { runCompanyPipeline } from "@/lib/pipeline";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let companyId: string | null = null;
  try {
    const body = (await request.json()) as { companyId?: string };
    companyId = body.companyId ?? null;
  } catch {
    companyId = new URL(request.url).searchParams.get("companyId");
  }

  companyId ||= process.env.DEFAULT_COMPANY_ID || null;
  if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

  try {
    const db = createDbClient(process.env.DATABASE_URL!);
    const result = await runCompanyPipeline(db, { companyId, runType: "incremental" });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error(`Pipeline cron failed for ${companyId}:`, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
