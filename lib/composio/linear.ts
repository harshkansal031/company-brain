import type { ComposioSDKClient } from "./client";

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  status?: { name: string; type: string };
  state?: { name: string; type?: string };
  assignee?: { name: string; email?: string };
  updatedAt: string;
  comments?: Array<{ body: string; createdAt: string; user?: { name: string } }>;
}

type PageInfo = {
  hasNextPage?: boolean;
  has_next_page?: boolean;
  endCursor?: string;
  end_cursor?: string;
};

function parsePayload(data: unknown): unknown {
  if (typeof data !== "string") return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function unwrapRecord(data: unknown): Record<string, unknown> {
  const parsed = parsePayload(data);
  if (!parsed || typeof parsed !== "object") return {};
  const record = parsed as Record<string, unknown>;
  if (record.issue && typeof record.issue === "object") return record.issue as Record<string, unknown>;
  if (record.data && typeof record.data === "object" && record.data !== parsed) {
    return unwrapRecord(record.data);
  }
  return record;
}

export function parseLinearTimestamp(value: unknown, fallback?: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return fallback ?? new Date();
}

function extractComments(raw: unknown): LinearIssue["comments"] {
  const nodes = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { nodes?: unknown[] }).nodes)
      ? (raw as { nodes: unknown[] }).nodes
      : [];

  return nodes
    .map((node) => {
      if (!node || typeof node !== "object") return null;
      const comment = node as Record<string, unknown>;
      if (typeof comment.body !== "string" || !comment.body) return null;
      const userRaw = comment.user as { name?: string } | undefined;
      return {
        body: comment.body,
        createdAt: parseLinearTimestamp(comment.createdAt ?? comment.created_at).toISOString(),
        user: userRaw?.name ? { name: userRaw.name } : undefined,
      };
    })
    .filter((comment): comment is NonNullable<typeof comment> => comment !== null);
}

export function coerceLinearIssue(raw: unknown): LinearIssue | null {
  const record = unwrapRecord(raw);
  const id = typeof record.id === "string" ? record.id : null;
  if (!id) return null;

  const stateRaw = (record.state ?? record.status) as { name?: string; type?: string } | undefined;
  const state = stateRaw?.name
    ? { name: String(stateRaw.name), type: stateRaw.type ? String(stateRaw.type) : undefined }
    : undefined;
  const assigneeRaw = record.assignee as Record<string, unknown> | undefined;

  return {
    id,
    identifier: typeof record.identifier === "string" ? record.identifier : id,
    title: typeof record.title === "string" ? record.title : "Untitled",
    description: typeof record.description === "string" ? record.description : undefined,
    state,
    status: state?.type ? { name: state.name, type: state.type } : undefined,
    assignee:
      assigneeRaw && typeof assigneeRaw.name === "string"
        ? {
            name: assigneeRaw.name,
            email: typeof assigneeRaw.email === "string" ? assigneeRaw.email : undefined,
          }
        : undefined,
    updatedAt: parseLinearTimestamp(
      record.updatedAt ?? record.updated_at ?? record.createdAt ?? record.created_at,
    ).toISOString(),
    comments: extractComments(record.comments),
  };
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
    if (value && typeof value === "object") {
      const nodes = (value as { nodes?: unknown[] }).nodes;
      if (Array.isArray(nodes)) return nodes as Record<string, unknown>[];
    }
  }
  return [];
}

function extractPageInfo(data: unknown): { hasNextPage: boolean; endCursor?: string } {
  const parsed = parsePayload(data);
  if (!parsed || typeof parsed !== "object") return { hasNextPage: false };
  const record = parsed as Record<string, unknown>;
  const pageInfo = (record.pageInfo ?? record.page_info) as PageInfo | undefined;
  if (!pageInfo) {
    return record.data && record.data !== parsed
      ? extractPageInfo(record.data)
      : { hasNextPage: false };
  }
  return {
    hasNextPage: !!(pageInfo.hasNextPage ?? pageInfo.has_next_page),
    endCursor: pageInfo.endCursor ?? pageInfo.end_cursor,
  };
}

function isUpdatedSince(raw: Record<string, unknown>, since: Date): boolean {
  const updatedAt = parseLinearTimestamp(
    raw.updatedAt ?? raw.updated_at ?? raw.createdAt ?? raw.created_at,
    new Date(0),
  );
  return updatedAt.getTime() >= since.getTime();
}

export async function listLinearTeams(client: ComposioSDKClient, userId: string): Promise<string[]> {
  const teamIds: string[] = [];
  let after: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await client.tools.execute("LINEAR_LIST_LINEAR_TEAMS", {
      userId,
      arguments: { first: 50, ...(after ? { after } : {}) },
      dangerouslySkipVersionCheck: true,
    });
    if (!response.successful) throw new Error(`Linear list teams failed: ${response.error}`);

    for (const node of extractItems(response.data, "teams", "nodes")) {
      if (typeof node.id === "string") teamIds.push(node.id);
    }

    const pageInfo = extractPageInfo(response.data);
    if (pageInfo.hasNextPage && pageInfo.endCursor) after = pageInfo.endCursor;
    else hasMore = false;
  }

  if (teamIds.length === 0) {
    const fallback = await client.tools.execute("LINEAR_GET_ALL_LINEAR_TEAMS", {
      userId,
      arguments: { first: 50 },
      dangerouslySkipVersionCheck: true,
    });
    if (fallback.successful) {
      for (const node of extractItems(fallback.data, "teams", "nodes")) {
        if (typeof node.id === "string") teamIds.push(node.id);
      }
    }
  }

  return [...new Set(teamIds)];
}

export async function fetchAllLinearIssues(
  client: ComposioSDKClient,
  userId: string,
  since: Date,
  projectId?: string,
): Promise<LinearIssue[]> {
  const listIssues: Record<string, unknown>[] = [];
  let after: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await client.tools.execute("LINEAR_LIST_LINEAR_ISSUES", {
      userId,
      arguments: { first: 50, ...(projectId ? { project_id: projectId } : {}), ...(after ? { after } : {}) },
      dangerouslySkipVersionCheck: true,
    });
    if (!response.successful) throw new Error(`Linear list issues failed: ${response.error}`);
    listIssues.push(...extractItems(response.data, "issues", "nodes"));

    const pageInfo = extractPageInfo(response.data);
    if (pageInfo.hasNextPage && pageInfo.endCursor) after = pageInfo.endCursor;
    else hasMore = false;
  }

  return enrichLinearIssues(client, userId, listIssues.filter((issue) => isUpdatedSince(issue, since)));
}

export async function fetchLinearIssues(
  client: ComposioSDKClient,
  userId: string,
  teamId: string,
  projectId: string | undefined,
  since: Date,
): Promise<LinearIssue[]> {
  const listIssues: Record<string, unknown>[] = [];
  let after: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await client.tools.execute("LINEAR_LIST_ISSUES_BY_TEAM_ID", {
      userId,
      arguments: { team_id: teamId, first: 50, ...(after ? { after } : {}) },
      dangerouslySkipVersionCheck: true,
    });
    if (!response.successful) throw new Error(`Linear fetch failed: ${response.error}`);
    listIssues.push(...extractItems(response.data, "issues", "nodes"));

    const pageInfo = extractPageInfo(response.data);
    if (pageInfo.hasNextPage && pageInfo.endCursor) after = pageInfo.endCursor;
    else hasMore = false;
  }

  const filtered = listIssues.filter((node) => {
    const matchesProject = projectId ? (node.project as { id?: string } | undefined)?.id === projectId : true;
    return matchesProject && isUpdatedSince(node, since);
  });

  return enrichLinearIssues(client, userId, filtered);
}

async function enrichLinearIssues(
  client: ComposioSDKClient,
  userId: string,
  nodes: Record<string, unknown>[],
): Promise<LinearIssue[]> {
  const issues: LinearIssue[] = [];
  for (const node of nodes) {
    if (typeof node.id !== "string") continue;
    try {
      const detail = await client.tools.execute("LINEAR_GET_LINEAR_ISSUE", {
        userId,
        arguments: { issue_id: node.id },
        dangerouslySkipVersionCheck: true,
      });
      const issue = detail.successful ? coerceLinearIssue(detail.data) : coerceLinearIssue(node);
      if (issue) issues.push(issue);
    } catch (err) {
      console.error(`Error fetching detailed Linear issue ${node.id}:`, err);
      const issue = coerceLinearIssue(node);
      if (issue) issues.push(issue);
    }
  }
  return issues;
}
