"use server";

import { companies, eq } from "@/lib/db";
import { db, getCompanySettings } from "@/lib/db";
import { requireCompany } from "@/lib/company";
import { createScopedApiKey, formatScopedKeyError, revokeScopedApiKey, type HindsightScopedKeyMetadata } from "@/lib/hindsight";

export type RegenerateScopedKeyResult =
  | { success: true; rawKey: string; metadata: HindsightScopedKeyMetadata }
  | { success: false; error: string };

export async function regenerateScopedKey(): Promise<RegenerateScopedKeyResult> {
  try {
    const company = await requireCompany();
    const settings = getCompanySettings(company);

    if (settings.hindsightScopedKey?.keyId) {
      try {
        await revokeScopedApiKey(settings.hindsightScopedKey.keyId);
      } catch (err) {
        console.error("Failed to revoke previous scoped key:", err);
      }
    }

    const expiresInDays = Number(process.env.HINDSIGHT_SCOPED_KEY_EXPIRES_IN_DAYS ?? 365);
    const { rawKey, metadata } = await createScopedApiKey({
      name: `${company.name} MCP`,
      allowedBankIds: [company.hindsightBankId],
      expiresInDays,
      metadata: { company_id: company.id },
    });

    await db
      .update(companies)
      .set({ settings: { ...settings, hindsightScopedKey: metadata } })
      .where(eq(companies.id, company.id));

    return { success: true, rawKey, metadata };
  } catch (err) {
    return { success: false, error: formatScopedKeyError(err instanceof Error ? err.message : String(err)) };
  }
}
