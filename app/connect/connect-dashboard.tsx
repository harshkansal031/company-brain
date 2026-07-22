"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Cable, FileUp, GitBranch, MessageSquareText, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectToolkit, disconnectToolkit } from "./actions";
import { GitHubRepoPicker } from "./github-repo-picker";

const TOOLKITS = [
  { slug: "slack", name: "Slack", icon: MessageSquareText, description: "Channel messages and threaded replies." },
  { slug: "linear", name: "Linear", icon: Workflow, description: "Issues, comments, and status transitions." },
  { slug: "github", name: "GitHub", icon: GitBranch, description: "Issues and pull requests from selected repositories." },
];

export function ConnectDashboard({
  connectedToolkits,
  isSyncing,
  openGitHubPicker,
  ingestConfig,
}: {
  connectedToolkits: string[];
  isSyncing: boolean;
  openGitHubPicker?: boolean;
  ingestConfig?: {
    githubRepos?: Array<{ owner: string; repo: string }>;
    githubReposConfigured?: boolean;
    linearTeamIds?: string[];
  };
}) {
  const router = useRouter();
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const documentUploadRef = useRef<HTMLInputElement>(null);

  async function connect(slug: string) {
    setLoadingSlug(slug);
    try {
      const { redirectUrl } = await connectToolkit(slug);
      if (!redirectUrl) throw new Error("Composio did not return a redirect URL");
      window.location.href = redirectUrl;
    } finally {
      setLoadingSlug(null);
    }
  }

  async function disconnect(slug: string) {
    setLoadingSlug(slug);
    try {
      await disconnectToolkit(slug);
      router.refresh();
    } finally {
      setLoadingSlug(null);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-neutral-500">Sources</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Connect tools</h1>
        <p className="mt-2 max-w-2xl text-neutral-400">
          Link the systems that carry operational signal. GitHub sync starts after repositories are selected.
        </p>
      </header>

      {isSyncing ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          A sync is currently running. Connection changes may wait until it finishes.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {TOOLKITS.map((toolkit) => {
          const connected = connectedToolkits.includes(toolkit.slug);
          const loading = loadingSlug === toolkit.slug;
          const Icon = toolkit.icon;
          return (
            <article key={toolkit.slug} className="rounded-lg border border-white/10 bg-[#111111] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-white text-black">
                  <Icon className="size-5" />
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs ${connected ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-neutral-400"}`}>
                  {connected ? "Connected" : "Not connected"}
                </span>
              </div>
              <h2 className="mt-5 text-lg font-medium">{toolkit.name}</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">{toolkit.description}</p>

              {connected && toolkit.slug === "github" ? (
                <div className="mt-5">
                  <GitHubRepoPicker
                    selectedRepos={ingestConfig?.githubRepos ?? []}
                    reposConfigured={ingestConfig?.githubReposConfigured === true}
                    defaultOpen={openGitHubPicker}
                  />
                </div>
              ) : null}

              {connected && toolkit.slug === "linear" ? (
                <p className="mt-5 rounded-lg border border-white/10 bg-black p-3 text-sm text-neutral-400">
                  {(ingestConfig?.linearTeamIds?.length ?? 0) > 0
                    ? `${ingestConfig?.linearTeamIds?.length} Linear team(s) configured`
                    : "All accessible issues will be auto-discovered on sync."}
                </p>
              ) : null}

              <Button
                className={`mt-5 w-full ${connected ? "border-red-500/20 bg-red-500/10 text-red-200 hover:bg-red-500/15" : "bg-white text-black hover:bg-[#F5F5F5]"}`}
                disabled={loading || isSyncing}
                onClick={() => void (connected ? disconnect(toolkit.slug) : connect(toolkit.slug))}
              >
                <Cable className="size-4" />
                {loading ? "Working..." : connected ? `Disconnect ${toolkit.name}` : `Connect ${toolkit.name}`}
              </Button>
            </article>
          );
        })}

        <article className="rounded-lg border border-white/10 bg-[#111111] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-white text-black">
              <FileUp className="size-5" />
            </div>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
              Active
            </span>
          </div>
          <h2 className="mt-5 text-lg font-medium">Upload documents</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            Add PDFs, docs, and internal files to enrich the memory bank alongside connected tools.
          </p>
          <input
            ref={documentUploadRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.pptx"
            className="hidden"
          />
          <Button
            className="mt-5 w-full bg-white text-black hover:bg-[#F5F5F5]"
            disabled={isSyncing}
            onClick={() => documentUploadRef.current?.click()}
          >
            <FileUp className="size-4" />
            Upload documents
          </Button>
        </article>
      </div>
    </div>
  );
}
