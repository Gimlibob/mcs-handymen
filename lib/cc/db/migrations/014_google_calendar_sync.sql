-- MCS Command Center Phase GC-1/GC-2 — Google Calendar sync data model
-- Applied by: node scripts/cc-migrate.mjs
-- Additive only. No event-id backfill.
--
-- GC-2 amendment (pre-Production): calendar_id nullable; connection statuses
-- include disconnected; optional google_account_sub + scopes.
--
-- Preferred OAuth scopes:
--   openid
--   email
--   https://www.googleapis.com/auth/calendar.app.created
-- Do NOT request full calendar scope unless proven required.

CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_account_email TEXT NOT NULL,
  google_account_sub TEXT NULL,
  calendar_id TEXT NULL,
  refresh_token_ciphertext TEXT NULL,
  scopes TEXT NULL,
  status TEXT NOT NULL,
  last_error TEXT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  token_updated_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT google_calendar_connections_status_valid CHECK (
    status IN ('connected', 'disconnected', 'revoked', 'error')
  )
);

CREATE INDEX IF NOT EXISTS google_calendar_connections_status_idx
  ON google_calendar_connections (status);

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS google_event_id TEXT NULL;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS google_sync_status TEXT NULL;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS google_synced_at TIMESTAMPTZ NULL;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS google_sync_error TEXT NULL;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS google_sync_attempts INT NOT NULL DEFAULT 0;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_google_sync_status_valid CHECK (
    google_sync_status IS NULL
    OR google_sync_status IN (
      'none',
      'pending',
      'synced',
      'error',
      'missing_remote'
    )
  );
