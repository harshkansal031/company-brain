CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  clerk_org_id text UNIQUE,
  provisioning_status text NOT NULL DEFAULT 'pending',
  hindsight_bank_id text NOT NULL,
  composio_user_id text NOT NULL,
  mental_model_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL UNIQUE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  clerk_role text NOT NULL DEFAULT 'org:member',
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS connected_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  toolkit text NOT NULL,
  composio_connected_account_id text NOT NULL,
  status text NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_sync_at timestamptz,
  CONSTRAINT company_toolkit_idx UNIQUE (company_id, toolkit)
);

CREATE TABLE IF NOT EXISTS raw_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_id text NOT NULL,
  dedup_key text NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  author text NOT NULL,
  title text,
  body text NOT NULL,
  payload jsonb NOT NULL,
  extraction_status text NOT NULL DEFAULT 'pending',
  ingested_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_source_id_idx UNIQUE (company_id, source, source_id)
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL,
  sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  events_fetched integer NOT NULL DEFAULT 0,
  error text
);

CREATE TABLE IF NOT EXISTS extraction_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  raw_event_id uuid NOT NULL REFERENCES raw_events(id) ON DELETE CASCADE,
  status text NOT NULL,
  extracted_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  hindsight_document_ids text[],
  error text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reflection_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  query text NOT NULL,
  response_text text NOT NULL,
  retained boolean NOT NULL DEFAULT false,
  ran_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS members_company_id_idx ON members(company_id);
CREATE INDEX IF NOT EXISTS company_extraction_status_occurred_idx ON raw_events(company_id, extraction_status, occurred_at);
CREATE INDEX IF NOT EXISTS company_occurred_idx ON raw_events(company_id, occurred_at);
