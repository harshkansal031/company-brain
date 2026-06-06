import type { GitHubEvent, LinearIssue, SlackMessage } from "@/lib/composio";
import { parseLinearTimestamp } from "@/lib/composio";

export interface NormalizedEvent {
  source: "slack" | "linear" | "github";
  sourceId: string;
  eventType: string;
  occurredAt: Date;
  author: string;
  title?: string;
  body: string;
  payload: Record<string, unknown>;
}

export function normalizeSlackMessage(msg: SlackMessage, channelName: string): NormalizedEvent {
  const occurredAt = new Date(Number(msg.ts) * 1000);
  let body = `[#${channelName}] ${msg.user || "Unknown User"} (${occurredAt.toISOString()}): ${msg.text}`;

  if (msg.replies?.length) {
    body += "\n\nThread Replies:";
    for (const reply of msg.replies) {
      const replyTime = new Date(Number(reply.ts) * 1000);
      body += `\n- ${reply.user || "Unknown User"} (${replyTime.toISOString()}): ${reply.text}`;
    }
  }

  return {
    source: "slack",
    sourceId: msg.ts,
    eventType: "message",
    occurredAt,
    author: msg.user || "unknown",
    body,
    payload: msg as unknown as Record<string, unknown>,
  };
}

export function normalizeLinearIssue(issue: LinearIssue): NormalizedEvent {
  const occurredAt = parseLinearTimestamp(issue.updatedAt);
  const statusName = issue.status?.name || issue.state?.name || "Unknown";
  const assigneeName = issue.assignee?.name || "Unassigned";

  let body = `Issue ${issue.identifier} shifted status to "${statusName}" - Assignee: ${assigneeName}. Title: "${issue.title}".`;
  if (issue.description) body += ` Description: "${issue.description}"`;
  if (issue.comments?.length) {
    body += "\n\nComments:";
    for (const comment of issue.comments) {
      body += `\n- ${comment.user?.name || "User"} (${parseLinearTimestamp(comment.createdAt).toISOString()}): ${comment.body}`;
    }
  }

  return {
    source: "linear",
    sourceId: issue.id,
    eventType: "issue_update",
    occurredAt,
    author: assigneeName,
    title: issue.title,
    body,
    payload: issue as unknown as Record<string, unknown>,
  };
}

export function normalizeGitHubEvent(event: GitHubEvent): NormalizedEvent {
  const occurredAt = new Date(event.updated_at);
  const isPr = !!event.pull_request;
  const typeLabel = isPr ? "PR" : "Issue";
  const actionType = event.state === "closed" ? "closed/merged" : "opened/updated";

  return {
    source: "github",
    sourceId: event.id.toString(),
    eventType: isPr ? "pr" : "issue",
    occurredAt,
    author: event.user.login,
    title: event.title,
    body: `${typeLabel} #${event.number} ${actionType}: "${event.title}" by ${event.user.login} (${occurredAt.toISOString()}). URL: ${event.html_url}`,
    payload: event as unknown as Record<string, unknown>,
  };
}
