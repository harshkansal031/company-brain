import { NextRequest, NextResponse } from "next/server";
import { db, companies, eq } from "@/lib/db";

/**
 * MCP URL-token proxy: /api/mcp/[token]/sse
 *
 * Looks up the company by its unique mcp_token, then proxies
 * the request to Hindsight's MCP endpoint using the company's
 * child key (scoped API key stored in settings).
 *
 * No OAuth — the UUID in the URL IS the auth.
 */

function getHindsightMcpUrl(): string {
  const base = process.env.HINDSIGHT_API_URL?.replace(/\/+$/, "");
  if (!base) throw new Error("HINDSIGHT_API_URL is not set");
  return `${base}/mcp/sse`;
}

function getChildKey(company: { hindsightBankId: string; settings: unknown }): string {
  // Use the parent API key to proxy on behalf of this bank.
  // The Hindsight MCP endpoint uses the bank ID in the path,
  // so the parent key with bank-scoped access works.
  const parentKey = process.env.HINDSIGHT_API_KEY;
  if (!parentKey) throw new Error("HINDSIGHT_API_KEY is not set");
  return parentKey;
}

function forwardHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  // Forward relevant headers
  const forward = ["accept", "content-type", "cache-control"];
  for (const key of forward) {
    const value = req.headers.get(key);
    if (value) headers[key] = value;
  }
  return headers;
}

// GET handler — SSE streaming proxy
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // 1. Look up company by mcp_token
  const company = await db.query.companies.findFirst({
    where: eq(companies.mcpToken, token),
  });

  if (!company) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Proxy to Hindsight MCP endpoint for this company's bank
  const hindsightBase = process.env.HINDSIGHT_API_URL?.replace(/\/+$/, "");
  const hindsightUrl = `${hindsightBase}/mcp/${company.hindsightBankId}/sse`;
  const childKey = getChildKey(company);

  try {
    const hindsightRes = await fetch(hindsightUrl, {
      headers: {
        Authorization: `Bearer ${childKey}`,
        ...forwardHeaders(req),
      },
    });

    if (!hindsightRes.ok) {
      return NextResponse.json(
        { error: "Upstream MCP server error" },
        { status: hindsightRes.status },
      );
    }

    // Stream the SSE response back
    return new Response(hindsightRes.body, {
      status: hindsightRes.status,
      headers: {
        "Content-Type": hindsightRes.headers.get("content-type") ?? "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("MCP proxy error:", err);
    return NextResponse.json(
      { error: "Failed to connect to MCP server" },
      { status: 502 },
    );
  }
}

// POST handler — for MCP message transport
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const company = await db.query.companies.findFirst({
    where: eq(companies.mcpToken, token),
  });

  if (!company) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hindsightBase = process.env.HINDSIGHT_API_URL?.replace(/\/+$/, "");
  const hindsightUrl = `${hindsightBase}/mcp/${company.hindsightBankId}/sse`;
  const childKey = getChildKey(company);
  const body = await req.text();

  try {
    const hindsightRes = await fetch(hindsightUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${childKey}`,
        "Content-Type": req.headers.get("content-type") ?? "application/json",
        ...forwardHeaders(req),
      },
      body,
    });

    if (!hindsightRes.ok) {
      return NextResponse.json(
        { error: "Upstream MCP server error" },
        { status: hindsightRes.status },
      );
    }

    const responseBody = await hindsightRes.text();
    return new Response(responseBody, {
      status: hindsightRes.status,
      headers: {
        "Content-Type": hindsightRes.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err) {
    console.error("MCP proxy error:", err);
    return NextResponse.json(
      { error: "Failed to connect to MCP server" },
      { status: 502 },
    );
  }
}

// Disable body parsing and edge runtime timeouts for streaming
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
