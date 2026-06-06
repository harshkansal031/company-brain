import { requireCompany } from "@/lib/company";
import { getCompanySettings } from "@/lib/db";
import { ProductShell } from "@/components/product-shell";
import { McpKeyPanel } from "./mcp-key-panel";

function buildMcpUrl(bankId: string): string {
  const baseUrl = process.env.HINDSIGHT_API_URL?.replace(/\/+$/, "");
  return baseUrl ? `${baseUrl}/mcp/${bankId}/` : "";
}

export default async function McpPage() {
  const company = await requireCompany();
  const settings = getCompanySettings(company);
  const mcpUrl = buildMcpUrl(company.hindsightBankId);

  return (
    <ProductShell>
      <div className="space-y-8">
        <header>
          <p className="text-sm text-neutral-500">Access</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">MCP setup</h1>
          <p className="mt-2 max-w-2xl text-neutral-400">
            Connect assistant clients to the isolated Hindsight bank for this company.
          </p>
        </header>
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-[#111111] p-5">
            <h2 className="font-semibold">Server URL</h2>
            <p className="mt-2 text-sm text-neutral-400">Use this endpoint in MCP clients that support remote servers.</p>
            <div className="mt-4 rounded-lg border border-white/10 bg-black p-4 font-mono text-sm text-neutral-300">
              {mcpUrl || "Set HINDSIGHT_API_URL to display the MCP endpoint."}
            </div>
          </div>
          <McpKeyPanel keyPrefix={settings.hindsightScopedKey?.prefix} />
        </section>
      </div>
    </ProductShell>
  );
}

export const dynamic = "force-dynamic";
