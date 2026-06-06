"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { regenerateMcpToken } from "./actions";

export function McpTokenPanel({
  mcpUrl,
  mcpToken,
}: {
  mcpUrl: string | null;
  mcpToken?: string;
}) {
  const [currentUrl, setCurrentUrl] = useState(mcpUrl);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";

  const copyToClipboard = useCallback(async () => {
    if (!currentUrl) return;
    await navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentUrl]);

  async function handleRegenerate() {
    setLoading(true);
    setError(null);
    const result = await regenerateMcpToken();
    if (result.success) {
      setCurrentUrl(`${appUrl}/api/mcp/${result.token}/sse`);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  return (
    <section className="rounded-lg border border-white/10 bg-[#111111] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Connect to Claude / ChatGPT</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Paste this URL into your AI assistant&rsquo;s MCP settings. No API key needed.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="flex-1 rounded-lg border border-white/10 bg-black p-4 font-mono text-sm text-neutral-300 break-all select-all">
          {currentUrl || "No MCP token generated. Click regenerate below."}
        </div>
        {currentUrl && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-white/10 bg-transparent text-neutral-300 hover:bg-white/5"
            onClick={() => void copyToClipboard()}
          >
            {copied ? "Copied!" : "Copy"}
          </Button>
        )}
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        This URL contains a unique token that grants access to your company&rsquo;s bank.
        Regenerating creates a new URL and invalidates the old one.
      </p>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <Button
          className="bg-white text-black hover:bg-[#F5F5F5]"
          disabled={loading}
          onClick={() => void handleRegenerate()}
        >
          {loading ? "Regenerating..." : "Regenerate URL"}
        </Button>
      </div>
    </section>
  );
}
