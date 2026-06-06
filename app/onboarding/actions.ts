"use server";

import { randomUUID } from "node:crypto";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { companies, eq, members } from "@/lib/db";
import { db } from "@/lib/db";
import { createHindsightClient, setupCompanyBank } from "@/lib/hindsight";
import { getCompanyByClerkOrgId, slugifyCompanyName } from "@/lib/company";

export type CompanyBrainResult =
  | { success: true; orgId: string; companyId: string }
  | { success: false; error: string };

export type OnboardingState = {
  hasOrg: boolean;
  companyReady: boolean;
  needsProvisioning: boolean;
  provisioningFailed: boolean;
  canProvision: boolean;
  orgName?: string;
  companyName?: string;
};

function placeholderMentalModels(): Record<string, string> {
  return {
    weeklyExecution: "placeholder-weekly-execution",
    activeBlockers: "placeholder-active-blockers",
    recentDecisions: "placeholder-recent-decisions",
    engineeringRisks: "placeholder-engineering-risks",
  };
}

async function provisionHindsightBank(hindsightBankId: string, companyName: string) {
  let mentalModelIds = placeholderMentalModels();
  let provisioningStatus: "ready" | "failed" = "failed";

  if (!process.env.HINDSIGHT_API_URL || !process.env.HINDSIGHT_API_KEY) {
    return { mentalModelIds, provisioningStatus };
  }

  try {
    const hindsight = createHindsightClient(process.env.HINDSIGHT_API_URL, process.env.HINDSIGHT_API_KEY);
    const models = await setupCompanyBank(hindsight, hindsightBankId, companyName);
    mentalModelIds = {
      weeklyExecution: models.weeklyExecutionId,
      activeBlockers: models.activeBlockersId,
      recentDecisions: models.recentDecisionsId,
      engineeringRisks: models.engineeringRisksId,
    };
    provisioningStatus = "ready";
  } catch (err) {
    console.error("Failed to provision Hindsight bank:", err);
  }

  return { mentalModelIds, provisioningStatus };
}

async function persistCompanyForOrg(params: {
  clerkOrgId: string;
  companyName: string;
  userId: string;
  email: string | null;
  existingCompany?: { id: string; hindsightBankId: string; composioUserId: string };
}): Promise<CompanyBrainResult> {
  const companyId = params.existingCompany?.id ?? randomUUID();
  const hindsightBankId = params.existingCompany?.hindsightBankId ?? `company-${companyId}`;
  const composioUserId = params.existingCompany?.composioUserId ?? `company_${companyId}`;
  const { mentalModelIds, provisioningStatus } = await provisionHindsightBank(hindsightBankId, params.companyName);

  try {
    if (params.existingCompany) {
      await db
        .update(companies)
        .set({ name: params.companyName, provisioningStatus, mentalModelIds })
        .where(eq(companies.id, companyId));
    } else {
      await db.insert(companies).values({
        id: companyId,
        name: params.companyName,
        clerkOrgId: params.clerkOrgId,
        provisioningStatus,
        hindsightBankId,
        composioUserId,
        mentalModelIds,
        settings: {},
      });
    }

    await db
      .insert(members)
      .values({
        clerkUserId: params.userId,
        companyId,
        clerkRole: "org:admin",
        email: params.email,
      })
      .onConflictDoUpdate({
        target: members.clerkUserId,
        set: { companyId, clerkRole: "org:admin", email: params.email },
      });

    const clerk = await clerkClient();
    const org = await clerk.organizations.getOrganization({ organizationId: params.clerkOrgId });
    await clerk.organizations.updateOrganization(params.clerkOrgId, {
      publicMetadata: {
        ...(org.publicMetadata ?? {}),
        companyId,
        hindsightBankId,
        provisioningStatus,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to save company: ${message}` };
  }

  if (provisioningStatus === "failed") {
    return {
      success: false,
      error: "Company Brain was saved but Hindsight provisioning failed. Check HINDSIGHT_API_URL and HINDSIGHT_API_KEY, then retry.",
    };
  }

  return { success: true, orgId: params.clerkOrgId, companyId };
}

export async function completeCompanyBrain(companyName?: string): Promise<CompanyBrainResult> {
  const { userId, orgId, has } = await auth();
  if (!userId) return { success: false, error: "You must be signed in." };
  if (!orgId) return { success: false, error: "Select or create an organization before setup." };
  if (!has({ role: "org:admin" })) return { success: false, error: "Only organization admins can complete setup." };

  const clerk = await clerkClient();
  const org = await clerk.organizations.getOrganization({ organizationId: orgId });
  const trimmedName = (companyName?.trim() || org.name).trim();
  const existing = await getCompanyByClerkOrgId(orgId);
  if (existing?.provisioningStatus === "ready") return { success: true, orgId, companyId: existing.id };

  const user = await currentUser();
  return persistCompanyForOrg({
    clerkOrgId: orgId,
    companyName: trimmedName,
    userId,
    email: user?.emailAddresses[0]?.emailAddress ?? null,
    existingCompany:
      existing && existing.provisioningStatus === "failed"
        ? { id: existing.id, hindsightBankId: existing.hindsightBankId, composioUserId: existing.composioUserId }
        : undefined,
  });
}

export async function createCompanyBrain(companyName: string): Promise<CompanyBrainResult> {
  const trimmedName = companyName.trim();
  if (!trimmedName) return { success: false, error: "Company name is required." };

  const { userId, orgId } = await auth();
  if (!userId) return { success: false, error: "You must be signed in." };
  if (orgId) return completeCompanyBrain(trimmedName);

  const user = await currentUser();
  const clerk = await clerkClient();
  let clerkOrgId: string;

  async function tryCreateOrg(slug: string) {
    return clerk.organizations.createOrganization({
      name: trimmedName,
      slug,
      createdBy: userId!,
    });
  }

  try {
    const baseSlug = slugifyCompanyName(trimmedName);
    let org;
    try {
      org = await tryCreateOrg(baseSlug);
    } catch (firstErr: unknown) {
      // Log full Clerk error for debugging
      console.error("Clerk createOrganization failed (attempt 1):", JSON.stringify(firstErr, null, 2));

      // Check if the error is a slug uniqueness violation — retry with a random suffix
      const isSlugTaken = isDuplicateSlugError(firstErr);
      if (isSlugTaken) {
        const suffix = Math.random().toString(36).slice(2, 6);
        const retrySlug = `${baseSlug}-${suffix}`.slice(0, 48);
        console.log(`Retrying with slug: ${retrySlug}`);
        org = await tryCreateOrg(retrySlug);
      } else {
        throw firstErr;
      }
    }
    clerkOrgId = org.id;
  } catch (err: unknown) {
    console.error("Clerk createOrganization failed (final):", JSON.stringify(err, null, 2));
    const detail = extractClerkErrorDetail(err);
    return { success: false, error: `Failed to create organization: ${detail}` };
  }

  return persistCompanyForOrg({
    clerkOrgId,
    companyName: trimmedName,
    userId,
    email: user?.emailAddresses[0]?.emailAddress ?? null,
  });
}

function isDuplicateSlugError(err: unknown): boolean {
  if (err && typeof err === "object") {
    // Clerk SDK errors have an `errors` array with `code` fields
    const clerkErr = err as { errors?: Array<{ code?: string; message?: string }> };
    if (Array.isArray(clerkErr.errors)) {
      return clerkErr.errors.some(
        (e) =>
          e.code === "slug_already_exists" ||
          e.code === "duplicate_record" ||
          (e.message && /slug.*taken|already.*exists|unique/i.test(e.message))
      );
    }
    // Fallback: check top-level message
    const msg = (err as { message?: string }).message ?? "";
    return /slug.*taken|already.*exists|unique|duplicate/i.test(msg);
  }
  return false;
}

function extractClerkErrorDetail(err: unknown): string {
  if (err && typeof err === "object") {
    const clerkErr = err as { errors?: Array<{ code?: string; message?: string; longMessage?: string }> };
    if (Array.isArray(clerkErr.errors) && clerkErr.errors.length > 0) {
      return clerkErr.errors
        .map((e) => e.longMessage || e.message || e.code || "Unknown error")
        .join("; ");
    }
  }
  return err instanceof Error ? err.message : String(err);
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const { orgId, has } = await auth();
  if (!orgId) {
    return { hasOrg: false, companyReady: false, needsProvisioning: false, provisioningFailed: false, canProvision: false };
  }
  const clerk = await clerkClient();
  const org = await clerk.organizations.getOrganization({ organizationId: orgId });
  const company = await getCompanyByClerkOrgId(orgId);
  return {
    hasOrg: true,
    companyReady: company?.provisioningStatus === "ready",
    needsProvisioning: !company,
    provisioningFailed: company?.provisioningStatus === "failed",
    canProvision: has({ role: "org:admin" }),
    orgName: org.name,
    companyName: company?.name,
  };
}
