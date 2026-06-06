import { getOrCreateAuthConfig } from "./auth-config";
import type { ComposioSDKClient } from "./client";

export async function generateConnectionLink(
  client: ComposioSDKClient,
  userId: string,
  toolkit: string,
  callbackUrl: string,
) {
  const authConfigId = await getOrCreateAuthConfig(client, toolkit);
  const connectionRequest = await client.connectedAccounts.link(userId, authConfigId, {
    callbackUrl,
    allowMultiple: true,
  });

  return {
    redirectUrl: connectionRequest.redirectUrl,
    connectedAccountId: connectionRequest.id ?? "",
  };
}

export async function listActiveConnections(client: ComposioSDKClient, userId: string) {
  const response = await client.connectedAccounts.list({
    userIds: [userId],
    statuses: ["ACTIVE"],
  });
  return response.items;
}
