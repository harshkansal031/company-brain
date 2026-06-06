import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { companies, eq } from "@/lib/db";
import { db, type Company } from "@/lib/db";

export async function getCompanyByClerkOrgId(clerkOrgId: string): Promise<Company | undefined> {
  return db.query.companies.findFirst({ where: eq(companies.clerkOrgId, clerkOrgId) });
}

export async function requireCompany(): Promise<Company> {
  const { orgId } = await auth();
  if (!orgId) redirect("/onboarding");

  const company = await getCompanyByClerkOrgId(orgId);
  if (!company || company.provisioningStatus !== "ready") redirect("/onboarding");
  return company;
}

export async function getOptionalCompany(): Promise<Company | null> {
  const { orgId } = await auth();
  if (!orgId) return null;
  const company = await getCompanyByClerkOrgId(orgId);
  return company?.provisioningStatus === "ready" ? company : null;
}

export function slugifyCompanyName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "company";
}
