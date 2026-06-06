# Contains all the decisions and features

## MCP Approach: URL Token Proxy
Skip OAuth entirely. One route, one DB lookup.

### The Idea

When admin creates a bank, generate a **random MCP token** (UUID). That token IS the auth.

```
Admin's MCP URL → https://yourdomain.com/api/mcp/abc123xyz/sse
                                                  ↑
                                            maps to child_key in DB
```

No OAuth handshake. No client_id/secret. Just a unique URL per bank.

---

### Implementation — 1 API Route

```ts
// /api/mcp/[token]/route.ts

export async function GET(req, { params }) {
  const { token } = params

  // 1. look up child key
  const bank = await db.banks.findFirst({ where: { mcp_token: token } })
  if (!bank) return new Response("Unauthorized", { status: 401 })

  // 2. proxy to Hindsight with child key
  const hindsightRes = await fetch("https://api.hindsight.dev/mcp/sse", {
    headers: {
      Authorization: `Bearer ${bank.child_key}`,
      ...forwardHeaders(req),
    },
  })

  return new Response(hindsightRes.body, {
    headers: hindsightRes.headers,
  })
}
```

**DB change — just add one column:**
```sql
ALTER TABLE banks ADD COLUMN mcp_token UUID DEFAULT gen_random_uuid();
```

---

### What Admin Sees in Your UI

```
Connect to Claude / ChatGPT

Your MCP URL:
https://yourdomain.com/api/mcp/abc123xyz456/sse

Paste this into Claude → Settings → MCP Servers
```

That's it. They paste one URL, no OAuth dance.

---

### Why This Works for a Hackathon

| Concern | Answer |
|---|---|
| Security | UUID token is unguessable — fine for MVP |
| Per-company isolation | Each bank has its own token → own child key |
| Revocation | Delete/rotate the token in DB |
| Effort | 1 route + 1 DB column |

Post-hackathon you can layer proper OAuth on top without changing the DB schema — just add the OAuth flow that *resolves to the same token*.