import type { ComposioSDKClient } from "./client";

export const SUPPORTED_TOOLKITS = ["github", "slack", "linear"] as const;
export type SupportedToolkit = (typeof SUPPORTED_TOOLKITS)[number];

const COMPOSIO_TOOLKIT_SLUGS: Record<string, string> = {
  github: "github",
  slack: "slack",
  linear: "linear",
};

export function isSupportedToolkit(toolkit: string): toolkit is SupportedToolkit {
  return SUPPORTED_TOOLKITS.includes(toolkit as SupportedToolkit);
}

function authConfigEnvKey(toolkit: string): string {
  return `COMPOSIO_AUTH_CONFIG_${toolkit.toUpperCase()}`;
}

export async function getOrCreateAuthConfig(
  client: ComposioSDKClient,
  toolkit: string,
): Promise<string> {
  if (!isSupportedToolkit(toolkit)) {
    throw new Error(`Unsupported toolkit: ${toolkit}`);
  }

  const envOverride = process.env[authConfigEnvKey(toolkit)];
  if (envOverride) return envOverride;

  const composioToolkit = COMPOSIO_TOOLKIT_SLUGS[toolkit];
  const existing = await client.authConfigs.list({ toolkit: composioToolkit });
  const enabledConfig = (existing.items ?? []).find((config) => config.status === "ENABLED");
  if (enabledConfig?.id) return enabledConfig.id;

  const created = await client.authConfigs.create(composioToolkit, {
    type: "use_composio_managed_auth",
    name: `Company Brain - ${toolkit}`,
  });

  if (!created.id) {
    throw new Error(`Failed to create Composio auth config for ${toolkit}`);
  }

  return created.id;
}
