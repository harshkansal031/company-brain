"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { regenerateScopedKey } from "./actions";

export function McpKeyPanel({
  keyPrefix,
}: {
  keyPrefix?: string;
}) {
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function regenerate() {
    setLoading(true);
    setError(null);
    const result = await regenerateScopedKey();
    if (result.success) setRawKey(result.rawKey);
    else setError(result.error);
    setLoading(false);
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#111111] p-5">
      <h2 className="font-semibold">Scoped API key</h2>
      <p className="mt-2 text-sm text-neutral-400">
        Generate a bank-scoped key for MCP clients. The raw key is shown only once.
      </p>
      <div className="mt-4 rounded-lg border border-white/10 bg-black p-4 font-mono text-sm text-neutral-300">
        {rawKey ?? keyPrefix ?? "No scoped key generated"}
      </div>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <Button className="mt-4 bg-white text-black hover:bg-[#F5F5F5]" disabled={loading} onClick={() => void regenerate()}>
        {loading ? "Generating..." : "Regenerate key"}
      </Button>
    </div>
  );
}
