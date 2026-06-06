import { HindsightClient } from "@vectorize-io/hindsight-client";

export function createHindsightClient(baseUrl: string, apiKey: string) {
  return new HindsightClient({ baseUrl, apiKey });
}

export type HindsightSDKClient = HindsightClient;

export interface SetupBankResult {
  weeklyExecutionId: string;
  activeBlockersId: string;
  recentDecisionsId: string;
  engineeringRisksId: string;
}

export async function setupCompanyBank(
  client: HindsightSDKClient,
  bankId: string,
  companyName: string,
): Promise<SetupBankResult> {
  const mission = `I am the organizational memory for ${companyName}. I track decisions, risks, milestones, blockers, and execution health across Slack, Linear, and GitHub. I synthesize patterns for leadership and ignore noise, greetings, and scheduling logistics.`;

  await client.createBank(bankId, {
    name: `${companyName} Brain`,
    mission,
    disposition: { skepticism: 4, literalism: 3, empathy: 2 },
  });

  const weeklyExecution = await client.createMentalModel(
    bankId,
    "Weekly Execution Health",
    "What is the overall execution health this week? Which projects are on track, slipping, or blocked?",
    { tags: [], trigger: { refreshAfterConsolidation: true } },
  );
  const activeBlockers = await client.createMentalModel(
    bankId,
    "Active Blockers",
    "What are the current blockers, stalled work items, and unresolved dependencies across all projects?",
    { tags: [], trigger: { refreshAfterConsolidation: true } },
  );
  const recentDecisions = await client.createMentalModel(
    bankId,
    "Recent Decisions",
    "What significant decisions were made in the last 14 days across engineering and product?",
    { tags: [], trigger: { refreshAfterConsolidation: true } },
  );
  const engineeringRisks = await client.createMentalModel(
    bankId,
    "Engineering Risks",
    "What engineering risks, incidents, or quality concerns have emerged recently?",
    { tags: ["source:github", "source:linear"], trigger: { refreshAfterConsolidation: true } },
  );

  return {
    weeklyExecutionId: weeklyExecution.mental_model_id || "",
    activeBlockersId: activeBlockers.mental_model_id || "",
    recentDecisionsId: recentDecisions.mental_model_id || "",
    engineeringRisksId: engineeringRisks.mental_model_id || "",
  };
}

export interface HindsightScopedKeyMetadata {
  keyId: string;
  prefix: string;
  expiresAt: string;
  createdAt: string;
}

export function getHindsightParentConfig() {
  const baseUrl = process.env.HINDSIGHT_API_URL;
  const parentKey = process.env.HINDSIGHT_API_KEY;
  const expiresInDays = Number(process.env.HINDSIGHT_SCOPED_KEY_EXPIRES_IN_DAYS ?? 365);
  if (!baseUrl || !parentKey) {
    throw new Error("HINDSIGHT_API_URL and HINDSIGHT_API_KEY must be set to manage scoped API keys");
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), parentKey, expiresInDays };
}

async function parseErrorResponse(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text) as { detail?: string; message?: string };
    return json.detail ?? json.message ?? text;
  } catch {
    return text || res.statusText;
  }
}

export function formatScopedKeyError(message: string): string {
  if (message.includes("create_scoped_keys")) {
    return "The Hindsight parent key is missing the Key Creator capability. Create a parent key with scoped child key creation enabled.";
  }
  return message.startsWith("HINDSIGHT_API_URL")
    ? message
    : `Failed to create scoped API key: ${message}`;
}

export async function createScopedApiKey(input: {
  name: string;
  allowedBankIds: string[];
  expiresInDays: number;
  metadata?: Record<string, string>;
}) {
  const { baseUrl, parentKey } = getHindsightParentConfig();
  const res = await fetch(`${baseUrl}/v1/api-keys/scoped`, {
    method: "POST",
    headers: { Authorization: `Bearer ${parentKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      allowed_bank_ids: input.allowedBankIds,
      expires_in_days: input.expiresInDays,
      metadata: input.metadata,
    }),
  });

  if (!res.ok) throw new Error(formatScopedKeyError(await parseErrorResponse(res)));

  const raw = (await res.json()) as Record<string, unknown> & { data?: Record<string, unknown> };
  const data = raw.data ?? raw;
  const rawKey = data.api_key ?? data.raw_key ?? data.key;
  const keyId = data.key_id ?? data.id;
  const prefix = data.prefix ?? data.key_prefix;
  const expiresAt = data.expires_at;
  const createdAt = data.created_at ?? new Date().toISOString();

  if (
    typeof rawKey !== "string" ||
    typeof keyId !== "string" ||
    typeof prefix !== "string" ||
    typeof expiresAt !== "string"
  ) {
    throw new Error("Hindsight scoped key response missing required fields");
  }

  return {
    rawKey,
    metadata: { keyId, prefix, expiresAt, createdAt: String(createdAt) },
  };
}

export async function revokeScopedApiKey(keyId: string): Promise<void> {
  const { baseUrl, parentKey } = getHindsightParentConfig();
  const res = await fetch(`${baseUrl}/v1/api-keys/scoped/${encodeURIComponent(keyId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${parentKey}` },
  });
  if (!res.ok) throw new Error(`Failed to revoke scoped API key: ${await parseErrorResponse(res)}`);
}
