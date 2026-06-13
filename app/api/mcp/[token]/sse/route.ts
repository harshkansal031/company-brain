import { NextRequest, NextResponse } from "next/server";
import {
  corsHeaders,
  createSseRewriteStream,
  getHindsightApiKey,
  getProxyOrigin,
  resolveCompanyByToken,
  upstreamMcpBase,
} from "@/lib/mcp/proxy";

/**
 * MCP SSE / Streamable HTTP proxy — /api/mcp/[token]/sse
 *
 * Hindsight MCP (stateful SSE mode):
 *   1. GET  /mcp/{bankId}/           → SSE stream; first event is `endpoint` with message URL
 *   2. POST /mcp/{bankId}/message    → JSON-RPC in; responses on the SSE stream (202 Accepted)
 *
 * We proxy GET to Hindsight and rewrite `endpoint` URLs to /api/mcp/{token}/message.
 * POST on this route forwards Streamable HTTP requests to the same upstream base URL.
 */

function upstreamHeaders(req: NextRequest): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getHindsightApiKey()}`,
    Accept: req.headers.get("accept") ?? "text/event-stream, application/json",
  };

  const protocolVersion = req.headers.get("MCP-Protocol-Version");
  if (protocolVersion) headers["MCP-Protocol-Version"] = protocolVersion;

  const sessionId = req.headers.get("MCP-Session-Id");
  if (sessionId) headers["MCP-Session-Id"] = sessionId;

  return headers;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const company = await resolveCompanyByToken(token);

  if (!company) {
    console.error(`[MCP proxy GET] Unauthorized token: ${token}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const upstreamUrl = `${upstreamMcpBase(company.hindsightBankId)}/`;
  const proxyOrigin = getProxyOrigin(req);

  console.log(
    `[MCP proxy GET] Opening upstream SSE for ${company.name} → ${upstreamUrl}`,
  );

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: "GET",
      headers: upstreamHeaders(req),
      signal: req.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    console.error("[MCP proxy GET] Upstream connection failed:", err);
    return NextResponse.json({ error: "Failed to connect to Hindsight" }, { status: 502 });
  }

  if (!upstreamRes.ok) {
    const body = await upstreamRes.text();
    console.error(`[MCP proxy GET] Upstream error ${upstreamRes.status}:`, body);
    return new Response(body || null, {
      status: upstreamRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!upstreamRes.body) {
    return NextResponse.json({ error: "Upstream returned empty body" }, { status: 502 });
  }

  const rewritten = upstreamRes.body.pipeThrough(
    createSseRewriteStream(proxyOrigin, token, company.hindsightBankId),
  );

  const responseHeaders: Record<string, string> = {
    ...corsHeaders,
    "Content-Type": upstreamRes.headers.get("content-type") ?? "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };

  const upstreamSessionId = upstreamRes.headers.get("MCP-Session-Id");
  if (upstreamSessionId) responseHeaders["MCP-Session-Id"] = upstreamSessionId;

  return new Response(rewritten, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const company = await resolveCompanyByToken(token);

  if (!company) {
    console.error(`[MCP proxy POST] Unauthorized token: ${token}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const upstreamUrl = `${upstreamMcpBase(company.hindsightBankId)}/`;
  const body = await req.text();

  console.log(`[MCP proxy POST] Forwarding Streamable HTTP for ${company.name}`);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${getHindsightApiKey()}`,
    "Content-Type": req.headers.get("content-type") ?? "application/json",
    Accept: req.headers.get("accept") ?? "application/json, text/event-stream",
  };

  const protocolVersion = req.headers.get("MCP-Protocol-Version");
  if (protocolVersion) headers["MCP-Protocol-Version"] = protocolVersion;

  const sessionId = req.headers.get("MCP-Session-Id");
  if (sessionId) headers["MCP-Session-Id"] = sessionId;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body,
      signal: req.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    console.error("[MCP proxy POST] Upstream forward failed:", err);
    return NextResponse.json({ error: "Failed to connect to Hindsight" }, { status: 502 });
  }

  const responseHeaders: Record<string, string> = {
    ...corsHeaders,
    "Content-Type": upstreamRes.headers.get("content-type") ?? "application/json",
  };

  const upstreamSessionId = upstreamRes.headers.get("MCP-Session-Id");
  if (upstreamSessionId) responseHeaders["MCP-Session-Id"] = upstreamSessionId;

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
