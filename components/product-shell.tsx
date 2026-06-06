import Link from "next/link";
import { Brain, Cable, KeyRound, LayoutDashboard, LogOut, Workflow } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/connect", label: "Connect", icon: Cable },
  { href: "/pipeline", label: "Pipeline", icon: Workflow },
  { href: "/mcp", label: "MCP", icon: KeyRound },
];

export function ProductShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/10 bg-[#111111] p-4 lg:block">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 py-2 text-sm font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-white text-black">
            <Brain className="size-4" />
          </span>
          Company Brain
        </Link>
        <nav className="mt-8 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-white/5 hover:text-white"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute inset-x-4 bottom-4">
          <SignOutButton>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-400 hover:bg-white/5 hover:text-white">
              <LogOut className="size-4" />
              Sign out
            </button>
          </SignOutButton>
        </div>
      </aside>
      <div className="lg:pl-64">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/85 px-5 py-4 backdrop-blur lg:hidden">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold">
            <Brain className="size-4" />
            Company Brain
          </Link>
          <div className="flex gap-3 text-xs text-neutral-300">
            {NAV_ITEMS.slice(1).map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">{children}</main>
      </div>
    </div>
  );
}
