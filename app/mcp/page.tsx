import { requireCompany } from "@/lib/company";
import { getCompanySettings } from "@/lib/db";
import { ProductShell } from "@/components/product-shell";
import { McpKeyPanel } from "./mcp-key-panel";
import { McpTokenPanel } from "./mcp-token-panel";

function buildMcpProxyUrl(mcpToken: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "http://localhost:3000";
  return `${appUrl}/api/mcp/${mcpToken}/sse`;
}

function buildDirectMcpUrl(bankId: string): string {
  const baseUrl = process.env.HINDSIGHT_API_URL?.replace(/\/+$/, "");
  return baseUrl ? `${baseUrl}/mcp/${bankId}/` : "";
}

export default async function McpPage() {
  const company = await requireCompany();
  const settings = getCompanySettings(company);
  const directMcpUrl = buildDirectMcpUrl(company.hindsightBankId);
  const proxyMcpUrl = company.mcpToken ? buildMcpProxyUrl(company.mcpToken) : null;

  return (
    <ProductShell>
      <div className="space-y-8">
        <header>
          <p className="text-sm text-neutral-500">Access</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">MCP setup</h1>
          <p className="mt-2 max-w-2xl text-neutral-400">
            Connect Claude, ChatGPT, or other AI assistants to your company&rsquo;s knowledge bank.
          </p>
        </header>

        {/* Primary: Token-based URL — paste and go */}
        <McpTokenPanel
          mcpUrl={proxyMcpUrl}
          mcpToken={company.mcpToken ?? undefined}
        />

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-[#111111] p-5">
            <h2 className="font-semibold">Direct Server URL</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Advanced: direct Hindsight endpoint (requires separate API key auth).
            </p>
            <div className="mt-4 rounded-lg border border-white/10 bg-black p-4 font-mono text-sm text-neutral-300 break-all">
              {directMcpUrl || "Set HINDSIGHT_API_URL to display the MCP endpoint."}
            </div>
          </div>
          <McpKeyPanel keyPrefix={settings.hindsightScopedKey?.prefix} />
        </section>
      </div>
    </ProductShell>
  );
}

export const dynamic = "force-dynamic";
