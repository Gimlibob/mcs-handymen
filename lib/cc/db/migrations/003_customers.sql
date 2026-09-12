-- MCS Command Center Phase 3.5 — customers + link from leads
-- Applied by: node scripts/cc-migrate.mjs
-- Does not modify 001/002. customer_id stays NULLABLE until orphan check passes
-- (see 004_leads_customer_id_not_null.sql, applied only after verify).

-- Future manual merge/split: merged_into_customer_id allows soft-merge without
-- destroying history. Split can create a new customer and reassign lead.customer_id.
-- No merge UI in Phase 3.5.

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  city TEXT,
  merged_into_customer_id UUID REFERENCES customers (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customers_full_name_nonempty CHECK (char_length(trim(full_name)) > 0),
  CONSTRAINT customers_email_nonempty CHECK (char_length(trim(email)) > 0),
  CONSTRAINT customers_email_normalized_nonempty CHECK (char_length(trim(email_normalized)) > 0),
  CONSTRAINT customers_email_normalized_unique UNIQUE (email_normalized),
  CONSTRAINT customers_no_self_merge CHECK (
    merged_into_customer_id IS NULL OR merged_into_customer_id <> id
  )
);

CREATE INDEX IF NOT EXISTS customers_created_at_idx ON customers (created_at DESC);
CREATE INDEX IF NOT EXISTS customers_full_name_idx ON customers (full_name);
CREATE INDEX IF NOT EXISTS customers_merged_into_idx ON customers (merged_into_customer_id)
  WHERE merged_into_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT 'owner',
  CONSTRAINT customer_notes_body_nonempty CHECK (char_length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS customer_notes_customer_id_idx ON customer_notes (customer_id);
CREATE INDEX IF NOT EXISTS customer_notes_created_at_idx ON customer_notes (created_at DESC);

CREATE TABLE IF NOT EXISTS customer_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  tag_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT 'owner',
  CONSTRAINT customer_tag_key_nonempty CHECK (char_length(trim(tag_key)) > 0),
  CONSTRAINT customer_tag_assignments_unique UNIQUE (customer_id, tag_key)
);

CREATE INDEX IF NOT EXISTS customer_tag_assignments_customer_id_idx
  ON customer_tag_assignments (customer_id);

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS leads_customer_id_idx ON leads (customer_id);

-- Backfill: one customer per normalized email. Lead rows are never rewritten
-- except setting customer_id. Lead city/name/email history stays intact.
INSERT INTO customers (full_name, email, email_normalized, city, created_at, updated_at)
SELECT
  (array_agg(l.full_name ORDER BY l.created_at ASC))[1],
  (array_agg(l.email ORDER BY l.created_at DESC))[1],
  lower(trim(l.email)),
  (array_agg(l.city ORDER BY l.created_at DESC))[1],
  min(l.created_at),
  max(l.updated_at)
FROM leads l
WHERE l.customer_id IS NULL
  AND char_length(trim(l.email)) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM customers c
    WHERE c.email_normalized = lower(trim(l.email))
  )
GROUP BY lower(trim(l.email));

UPDATE leads l
SET customer_id = c.id
FROM customers c
WHERE l.customer_id IS NULL
  AND c.email_normalized = lower(trim(l.email))
  AND c.merged_into_customer_id IS NULL;
