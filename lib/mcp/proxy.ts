import { NextRequest } from "next/server";
import { db, companies, eq } from "@/lib/db";

export function hindsightBase(): string {
  const base = process.env.HINDSIGHT_API_URL;
  if (!base) throw new Error("HINDSIGHT_API_URL is not set");
  return base.replace(/\/+$/, "");
}

export function getHindsightApiKey(): string {
  const key = process.env.HINDSIGHT_API_KEY;
  if (!key) throw new Error("HINDSIGHT_API_KEY is not set");
  return key;
}

export function getProxyOrigin(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || req.nextUrl.origin;
}

export function upstreamMcpBase(bankId: string): string {
  return `${hindsightBase()}/mcp/${bankId}`;
}

export async function resolveCompanyByToken(token: string) {
  return (
    (await db.query.companies.findFirst({
      where: eq(companies.mcpToken, token),
    })) ?? null
  );
}

function rewriteEndpointUrl(
  rawUrl: string,
  proxyOrigin: string,
  token: string,
  bankId: string,
): string {
  const trimmed = rawUrl.trim();
  const hindsightOrigin = hindsightBase();

  try {
    const url = new URL(trimmed, hindsightOrigin);
    const path = url.pathname.replace(/\/+$/, "");
    const expectedMessagePath = `/mcp/${bankId}/message`;

    if (path === expectedMessagePath || path.endsWith("/message")) {
      const proxyUrl = new URL(`/api/mcp/${token}/message`, proxyOrigin);
      url.searchParams.forEach((value, key) => proxyUrl.searchParams.set(key, value));
      return proxyUrl.toString();
    }
  } catch {
    // Not a URL — return unchanged.
  }

  return trimmed;
}

function rewriteSseEventBlock(
  block: string,
  proxyOrigin: string,
  token: string,
  bankId: string,
): string {
  const lines = block.split("\n");
  let eventName = "";
  const out: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      out.push(line);
      continue;
    }

    if (line.startsWith("data:") && eventName === "endpoint") {
      const payload = line.slice(5).trim();
      out.push(`data: ${rewriteEndpointUrl(payload, proxyOrigin, token, bankId)}`);
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}

/** Pipe upstream SSE bytes through endpoint URL rewriting. */
export function createSseRewriteStream(
  proxyOrigin: string,
  token: string,
  bankId: string,
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });

      let splitAt = buffer.indexOf("\n\n");
      while (splitAt !== -1) {
        const block = buffer.slice(0, splitAt);
        buffer = buffer.slice(splitAt + 2);
        const rewritten = rewriteSseEventBlock(block, proxyOrigin, token, bankId);
        controller.enqueue(encoder.encode(`${rewritten}\n\n`));
        splitAt = buffer.indexOf("\n\n");
      }
    },
    flush(controller) {
      if (buffer.length > 0) {
        controller.enqueue(encoder.encode(buffer));
      }
    },
  });
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Accept, MCP-Protocol-Version, MCP-Session-Id",
} as const;
