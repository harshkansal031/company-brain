import type { ComposioSDKClient } from "./client";

export interface GitHubRepo {
  owner: string;
  repo: string;
}

export interface GitHubEvent {
  id: string;
  number: number;
  title: string;
  body?: string;
  state: string;
  html_url: string;
  updated_at: string;
  created_at: string;
  user: { login: string };
  pull_request?: Record<string, unknown>;
}

type GitHubExecuteOptions = { connectedAccountId?: string };

function parsePayload(data: unknown): unknown {
  if (typeof data !== "string") return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function extractItems(data: unknown, ...keys: string[]): Record<string, unknown>[] {
  const parsed = parsePayload(data);
  if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
  if (!parsed || typeof parsed !== "object") return [];

  const record = parsed as Record<string, unknown>;
  if (record.data && record.data !== parsed) {
    const nested = extractItems(record.data, ...keys);
    if (nested.length > 0) return nested;
  }

  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value as Record<string, unknown>[];
  }
  return [];
}

function parseRepoRecord(raw: Record<string, unknown>): GitHubRepo | null {
  const name = typeof raw.name === "string" ? raw.name : null;
  if (!name) return null;

  const ownerRaw = raw.owner as { login?: string } | undefined;
  if (ownerRaw?.login) return { owner: ownerRaw.login, repo: name };

  if (typeof raw.full_name === "string" && raw.full_name.includes("/")) {
    const [owner, repo] = raw.full_name.split("/");
    if (owner && repo) return { owner, repo };
  }
  return null;
}

function coerceGitHubEvent(raw: Record<string, unknown>): GitHubEvent | null {
  const userRaw = raw.user as { login?: string } | undefined;
  if (
    (typeof raw.id !== "number" && typeof raw.id !== "string") ||
    typeof raw.number !== "number" ||
    typeof raw.title !== "string" ||
    typeof raw.updated_at !== "string" ||
    typeof raw.created_at !== "string" ||
    typeof raw.html_url !== "string" ||
    typeof raw.state !== "string" ||
    !userRaw?.login
  ) {
    return null;
  }

  return {
    id: String(raw.id),
    number: raw.number,
    title: raw.title,
    body: typeof raw.body === "string" ? raw.body : undefined,
    state: raw.state,
    html_url: raw.html_url,
    updated_at: raw.updated_at,
    created_at: raw.created_at,
    user: { login: userRaw.login },
    pull_request:
      raw.pull_request && typeof raw.pull_request === "object"
        ? (raw.pull_request as Record<string, unknown>)
        : undefined,
  };
}

export async function listGitHubRepos(
  client: ComposioSDKClient,
  userId: string,
  options?: GitHubExecuteOptions,
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await client.tools.execute(
      "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER",
      {
        userId,
        ...(options?.connectedAccountId ? { connectedAccountId: options.connectedAccountId } : {}),
        arguments: { per_page: 100, page, sort: "pushed", direction: "desc", type: "all" },
        dangerouslySkipVersionCheck: true,
      },
    );
    if (!response.successful) throw new Error(`GitHub list repos failed: ${response.error}`);

    const items = extractItems(response.data, "repositories");
    for (const item of items) {
      const repo = parseRepoRecord(item);
      if (repo) repos.push(repo);
    }
    hasMore = items.length === 100;
    page += 1;
  }

  const seen = new Set<string>();
  return repos.filter((repo) => {
    const key = `${repo.owner}/${repo.repo}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function fetchGitHubActivity(
  client: ComposioSDKClient,
  userId: string,
  owner: string,
  repo: string,
  since?: Date,
  options?: GitHubExecuteOptions,
): Promise<GitHubEvent[]> {
  const events: GitHubEvent[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await client.tools.execute("GITHUB_LIST_REPOSITORY_ISSUES", {
      userId,
      ...(options?.connectedAccountId ? { connectedAccountId: options.connectedAccountId } : {}),
      arguments: {
        owner,
        repo,
        state: "all",
        ...(since ? { since: since.toISOString() } : {}),
        sort: "updated",
        per_page: 100,
        page,
      },
      dangerouslySkipVersionCheck: true,
    });
    if (!response.successful) throw new Error(`GitHub fetch failed: ${response.error}`);

    const items = extractItems(response.data, "issues");
    for (const item of items) {
      const event = coerceGitHubEvent(item);
      if (event && (!since || new Date(event.updated_at).getTime() >= since.getTime())) {
        events.push(event);
      }
    }
    hasMore = items.length === 100;
    page += 1;
  }

  return events;
}
