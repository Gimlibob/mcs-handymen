-- MCS Command Center Phase 2 — minimal lead persistence
-- Applied by: node scripts/cc-migrate.mjs

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'new',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  city TEXT NOT NULL,
  property_type TEXT NOT NULL,
  project_type TEXT NOT NULL,
  description TEXT NOT NULL,
  contact_method TEXT NOT NULL,
  preferred_date DATE,
  source TEXT NOT NULL DEFAULT 'website_quote',
  CONSTRAINT leads_status_nonempty CHECK (char_length(status) > 0),
  CONSTRAINT leads_email_nonempty CHECK (char_length(email) > 0)
);

CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS leads_email_idx ON leads (email);

CREATE TABLE IF NOT EXISTS lead_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads (id) ON DELETE RESTRICT,
  blob_pathname TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lead_photos_pathname_nonempty CHECK (char_length(blob_pathname) > 0),
  CONSTRAINT lead_photos_pathname_unique UNIQUE (blob_pathname)
);

CREATE INDEX IF NOT EXISTS lead_photos_lead_id_idx ON lead_photos (lead_id);
