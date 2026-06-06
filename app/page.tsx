import Link from "next/link";
import { ArrowRight, Brain, CheckCircle2, GitBranch, MessageSquareText, Play, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-black">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-black text-white">
            <Brain className="size-4" />
          </span>
          Company Brain
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-neutral-600 sm:flex">
          <a href="#demo" className="hover:text-black">Demo</a>
          <Link href="/connect" className="hover:text-black">Product</Link>
        </nav>
        <Button asChild className="h-9 rounded-lg bg-black px-4 text-white hover:bg-[#111111]">
          <a href="mailto:waitlist@companybrain.local?subject=Join%20Company%20Brain%20Waitlist">
            Join Waitlist
          </a>
        </Button>
      </header>

      <main>
        <section className="mx-auto grid min-h-[calc(100vh-76px)] w-full max-w-7xl items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2A2A2A]/20 bg-[#F5F5F5] px-3 py-1 text-sm text-neutral-700">
              <CheckCircle2 className="size-4 text-black" />
              Private company memory from the tools your team already uses
            </div>
            <h1 className="text-5xl font-semibold tracking-tight text-black sm:text-7xl">
              Company Brain
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-600 sm:text-xl">
              Turn Slack, Linear, and GitHub activity into a searchable operating memory for decisions,
              risks, blockers, and execution health.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-11 rounded-lg bg-black px-5 text-white hover:bg-[#111111]">
                <a href="mailto:waitlist@companybrain.local?subject=Join%20Company%20Brain%20Waitlist">
                  Join Waitlist <ArrowRight className="size-4" />
                </a>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-lg border-[#2A2A2A]/25 bg-white px-5">
                <Link href="/sign-in">Open product</Link>
              </Button>
            </div>
            <div className="mt-10 grid max-w-xl grid-cols-3 gap-3 text-sm text-neutral-600">
              {[
                ["GitHub", GitBranch],
                ["Slack", MessageSquareText],
                ["Linear", Workflow],
              ].map(([label, Icon]) => (
                <div key={String(label)} className="flex items-center gap-2 rounded-lg border border-[#2A2A2A]/15 bg-white p-3">
                  <Icon className="size-4 text-black" />
                  {label as string}
                </div>
              ))}
            </div>
          </div>

          <div id="demo" className="rounded-lg border border-[#2A2A2A] bg-[#111111] p-3 shadow-2xl shadow-black/20">
            <div className="aspect-video rounded-md bg-[#1A1A1A] p-5 text-white">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm text-neutral-400">Demo placeholder</p>
                  <h2 className="mt-1 text-xl font-medium">Execution health review</h2>
                </div>
                <span className="flex size-10 items-center justify-center rounded-full bg-white text-black">
                  <Play className="ml-0.5 size-4 fill-black" />
                </span>
              </div>
              <div className="grid h-[calc(100%-73px)] grid-cols-[0.8fr_1.2fr] gap-4 pt-4">
                <div className="space-y-3">
                  {["Slack threads", "Linear issues", "GitHub PRs"].map((item) => (
                    <div key={item} className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-neutral-300">
                      {item}
                    </div>
                  ))}
                </div>
                <div className="rounded-md border border-white/10 bg-black p-4">
                  <p className="text-sm uppercase tracking-wide text-neutral-500">Synthesized memory</p>
                  <p className="mt-4 text-2xl font-medium leading-tight">
                    API rollout is blocked by unresolved rate-limit failures in the billing service.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs text-neutral-300">
                    <span className="rounded-full bg-[#1A1A1A] px-3 py-1">risk</span>
                    <span className="rounded-full bg-[#1A1A1A] px-3 py-1">billing</span>
                    <span className="rounded-full bg-[#1A1A1A] px-3 py-1">github</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#2A2A2A]/15 bg-[#F5F5F5]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-medium text-black">Company Brain</p>
          <p>Memory for teams that ship through conversation.</p>
        </div>
      </footer>
    </div>
  );
}
