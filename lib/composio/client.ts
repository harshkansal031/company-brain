import { Composio } from "@composio/core";

export function createComposioClient(apiKey: string) {
  return new Composio({ apiKey });
}

export type ComposioSDKClient = Composio;
export * from "@composio/core";
