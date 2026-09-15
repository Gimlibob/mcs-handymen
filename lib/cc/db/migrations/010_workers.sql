-- MCS Command Center Phase 4B.1 — Job Assignment Foundation
-- Applied by: node scripts/cc-migrate.mjs
-- Additive only. Does not modify migration 009, Lead statuses, AI, or Playbook.
--
-- Worker = person who can be assigned as primary worker on a Job.
-- Assignment does not change Job status. Job status does not change assignment.
-- No worker authentication in this phase.

CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workers_display_name_nonempty CHECK (char_length(trim(display_name)) > 0),
  CONSTRAINT workers_status_valid CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX IF NOT EXISTS workers_status_idx ON workers (status);
CREATE INDEX IF NOT EXISTS workers_display_name_idx ON workers (display_name);
CREATE INDEX IF NOT EXISTS workers_created_at_idx ON workers (created_at DESC);

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS assigned_worker_id UUID REFERENCES workers (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS jobs_assigned_worker_id_idx
  ON jobs (assigned_worker_id)
  WHERE assigned_worker_id IS NOT NULL;
