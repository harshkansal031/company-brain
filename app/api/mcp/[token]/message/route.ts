import { NextRequest, NextResponse } from "next/server";
import {
  corsHeaders,
  getHindsightApiKey,
  resolveCompanyByToken,
  upstreamMcpBase,
} from "@/lib/mcp/proxy";

/**
 * MCP message proxy — /api/mcp/[token]/message
 *
 * After the client opens SSE via /sse, Hindsight sends an `endpoint` event pointing here.
 * We forward JSON-RPC POSTs to Hindsight's /message endpoint (sessionId preserved).
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const company = await resolveCompanyByToken(token);

  if (!company) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const upstreamUrl = new URL(`${upstreamMcpBase(company.hindsightBankId)}/message`);
  req.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });

  const body = await req.text();

  console.log(
    `[MCP proxy message] Forwarding for ${company.name} → ${upstreamUrl.pathname}${upstreamUrl.search}`,
  );

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
    upstreamRes = await fetch(upstreamUrl.toString(), {
      method: "POST",
      headers,
      body,
      signal: req.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    console.error("[MCP proxy message] Upstream forward failed:", err);
    return NextResponse.json({ error: "Failed to connect to MCP server" }, { status: 502 });
  }

  const responseHeaders: Record<string, string> = {
    ...corsHeaders,
    "Content-Type": upstreamRes.headers.get("content-type") ?? "application/json",
  };

  const upstreamSessionId = upstreamRes.headers.get("MCP-Session-Id");
  if (upstreamSessionId) responseHeaders["MCP-Session-Id"] = upstreamSessionId;

  const responseText = await upstreamRes.text();

  return new Response(responseText || null, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
