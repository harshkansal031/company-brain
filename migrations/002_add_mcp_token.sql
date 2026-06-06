-- Add MCP token column for URL-based proxy auth (no OAuth needed)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS mcp_token uuid DEFAULT gen_random_uuid();

-- Backfill existing rows that may have NULL tokens
UPDATE companies SET mcp_token = gen_random_uuid() WHERE mcp_token IS NULL;

-- Add unique index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS companies_mcp_token_idx ON companies(mcp_token);
