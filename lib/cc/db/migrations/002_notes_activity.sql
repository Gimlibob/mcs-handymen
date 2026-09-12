-- MCS Command Center Phase 3 — notes + activity history
-- Applied by: node scripts/cc-migrate.mjs
-- Does not modify 001_init_leads.sql

CREATE TABLE IF NOT EXISTS lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads (id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT 'owner',
  CONSTRAINT lead_notes_body_nonempty CHECK (char_length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS lead_notes_lead_id_idx ON lead_notes (lead_id);
CREATE INDEX IF NOT EXISTS lead_notes_created_at_idx ON lead_notes (created_at DESC);

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads (id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT 'system',
  CONSTRAINT activity_log_event_type_nonempty CHECK (char_length(event_type) > 0),
  CONSTRAINT activity_log_message_nonempty CHECK (char_length(message) > 0)
);

CREATE INDEX IF NOT EXISTS activity_log_lead_id_idx ON activity_log (lead_id);
CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON activity_log (created_at DESC);
