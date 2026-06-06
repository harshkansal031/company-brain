"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAvailableGitHubRepos, saveGitHubRepos, type GitHubRepoSelection } from "./actions";

function repoKey(repo: GitHubRepoSelection): string {
  return `${repo.owner}/${repo.repo}`;
}

export function GitHubRepoPicker({
  selectedRepos,
  reposConfigured,
  defaultOpen,
}: {
  selectedRepos: GitHubRepoSelection[];
  reposConfigured: boolean;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen || !reposConfigured);
  const [availableRepos, setAvailableRepos] = useState<GitHubRepoSelection[]>([]);
  const [selected, setSelected] = useState(() => new Set(selectedRepos.map(repoKey)));
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRepos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAvailableRepos(await fetchAvailableGitHubRepos());
    } catch {
      setError("Could not load repositories. Reconnect GitHub and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? availableRepos.filter((repo) => repoKey(repo).toLowerCase().includes(q)) : availableRepos;
  }, [availableRepos, search]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const result = await saveGitHubRepos(availableRepos.filter((repo) => selected.has(repoKey(repo))));
      if (result.count === 0) {
        setError("Select at least one repository.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Failed to save repository selection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open && availableRepos.length === 0 && !loading) void loadRepos();
        }}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm"
      >
        <span className="font-medium">GitHub repositories</span>
        <span className="text-neutral-500">{selected.size || "None"} selected</span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-white/10 p-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search repositories"
            className="h-9 border-white/10 bg-[#111111] text-white"
          />
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <div className="max-h-64 overflow-auto rounded-lg border border-white/10">
            {loading ? (
              <p className="p-6 text-center text-sm text-neutral-500">Loading repositories...</p>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-neutral-500">No repositories loaded.</p>
                <Button
                  variant="ghost"
                  className="mt-3 text-neutral-300 hover:bg-white/5"
                  onClick={() => void loadRepos()}
                >
                  Load repositories
                </Button>
              </div>
            ) : (
              filtered.map((repo) => {
                const key = repoKey(repo);
                return (
                  <label key={key} className="flex cursor-pointer items-center gap-3 border-b border-white/10 px-3 py-2 text-sm last:border-b-0">
                    <input
                      type="checkbox"
                      checked={selected.has(key)}
                      onChange={() =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        })
                      }
                    />
                    <span className="font-mono text-neutral-300">{key}</span>
                  </label>
                );
              })
            )}
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" className="text-neutral-300 hover:bg-white/5" onClick={() => setSelected(new Set(availableRepos.map(repoKey)))}>
              Select all
            </Button>
            <Button className="bg-white text-black hover:bg-[#F5F5F5]" disabled={saving || selected.size === 0} onClick={() => void save()}>
              {saving ? "Saving..." : "Save and sync"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
