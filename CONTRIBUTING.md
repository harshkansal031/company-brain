# Contributing to Company Brain

Thanks for your interest in contributing. This guide covers local setup, conventions, and how to open a pull request.

## Prerequisites

- Node.js 20.x (LTS)
- pnpm 9.x
- Accounts for Clerk, Supabase, Composio, Hindsight Cloud, and Google Gemini

See [README.md](./README.md#-installation) for the full service checklist.

## Local setup

```bash
git clone https://github.com/harshkansal031/company-brain.git
cd company-brain
pnpm install
cp .env.example .env
# Fill in .env, then apply migrations
pnpm db:migrate
```

Run the app and worker in separate terminals:

```bash
pnpm dev      # Next.js at http://localhost:3000
pnpm worker   # Scheduled pipeline + reflection worker
```

For faster local iteration, add a `.env.local` file to override worker intervals:

```bash
PIPELINE_INTERVAL_MS=60000
REFLECTION_INTERVAL_MS=120000
```

## Project layout

```
app/          Next.js App Router pages and API routes
components/   Shared UI components (shadcn/ui)
lib/          Core logic — ingestion, extraction, pipeline, Hindsight, Composio
worker/       Background worker for scheduled pipelines and reflection
migrations/   SQL migrations applied by pnpm db:migrate
scripts/      One-off scripts (migrate runner)
```

Key modules:

| Module | Purpose |
|---|---|
| `lib/ingestion/` | Pull raw events from Slack, GitHub, and Linear via Composio |
| `lib/extraction/` | Classify events with Gemini and retain in Hindsight |
| `lib/pipeline.ts` | Orchestrates ingestion → extraction for a company |
| `lib/reflection.ts` | Nightly leadership queries against the memory bank |
| `lib/mcp/proxy.ts` | Token-authenticated MCP proxy to Hindsight |

## Development commands

```bash
pnpm dev            # Start Next.js dev server
pnpm worker         # Start pipeline worker
pnpm lint           # Run ESLint
pnpm build          # Production build
pnpm start          # Start production Next.js server
pnpm db:migrate     # Apply SQL migrations
pnpm db:generate    # Generate Drizzle migration from schema changes
```

## Branch and commit conventions

1. Branch from `main` using prefixes: `feat/`, `fix/`, or `chore/`
2. Use [Conventional Commits](https://www.conventionalcommits.org/): `feat: add X`, `fix: correct Y`
3. Keep changes focused — one logical change per PR

## Pull request checklist

- [ ] Code builds with `pnpm build`
- [ ] Lint passes with `pnpm lint`
- [ ] New env vars are documented in `.env.example` and README
- [ ] Database schema changes include a migration in `migrations/`
- [ ] Screenshots updated if UI changes are user-visible

## Database changes

Schema is defined in `lib/db/schema.ts`. After editing the schema:

```bash
pnpm db:generate   # optional — generate Drizzle migration files
# Add a numbered SQL file under migrations/ if you prefer hand-written migrations
pnpm db:migrate    # apply migrations locally
```

Use `DATABASE_DIRECT_URL` (port 5432) for migrations; the app uses `DATABASE_URL` (pooler, port 6543) at runtime.

## Questions

Open a [GitHub issue](https://github.com/harshkansal031/company-brain/issues) for bugs, feature requests, or setup help.
