import type { ComposioSDKClient } from "./client";

export interface SlackMessage {
  ts: string;
  user: string;
  text: string;
  thread_ts?: string;
  reply_count?: number;
  replies?: SlackMessage[];
}

export async function fetchSlackHistory(
  client: ComposioSDKClient,
  userId: string,
  channelId: string,
  since: Date,
): Promise<SlackMessage[]> {
  const historyResponse = await client.tools.execute("SLACK_FETCH_CONVERSATION_HISTORY", {
    userId,
    arguments: {
      channel_id: channelId,
      oldest: Math.floor(since.getTime() / 1000).toString(),
    },
    dangerouslySkipVersionCheck: true,
  });

  if (!historyResponse.successful) {
    throw new Error(`Slack fetch failed: ${historyResponse.error}`);
  }

  const data = historyResponse.data as { messages?: SlackMessage[] } | undefined;
  const messages = data?.messages ?? [];

  for (const message of messages) {
    if (!message.reply_count || message.reply_count <= 0) continue;
    try {
      const threadResponse = await client.tools.execute(
        "SLACK_FETCH_MESSAGE_THREAD_FROM_A_CONVERSATION",
        {
          userId,
          arguments: { channel_id: channelId, ts: message.ts },
          dangerouslySkipVersionCheck: true,
        },
      );
      const threadData = threadResponse.data as { messages?: SlackMessage[] } | undefined;
      if (threadResponse.successful && threadData?.messages) {
        message.replies = threadData.messages.filter((reply) => reply.ts !== message.ts);
      }
    } catch (err) {
      console.error(`Error fetching Slack replies for ${message.ts}:`, err);
    }
  }

  return messages;
}
