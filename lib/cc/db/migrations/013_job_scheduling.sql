-- MCS Command Center Phase 5B — Job scheduling (date + window)
-- Applied by: node scripts/cc-migrate.mjs
-- Additive only. Does not invent dates or change existing Job statuses.
--
-- Does NOT enforce status='scheduled' => scheduled_date IS NOT NULL
-- (legacy Production rows may be scheduled with null date).

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS scheduled_date DATE NULL;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS scheduled_window TEXT NULL;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_scheduled_window_valid CHECK (
    scheduled_window IS NULL
    OR scheduled_window IN ('am', 'pm', 'flex')
  );

CREATE INDEX IF NOT EXISTS jobs_scheduled_date_idx ON jobs (scheduled_date);
