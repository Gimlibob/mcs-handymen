-- MCS Command Center Phase 4B.0 — minimum Job operational foundation
-- Applied by: node scripts/cc-migrate.mjs
-- Additive only. Does not modify Lead statuses, CRM notes, photos, AI, or Playbook.
--
-- Job = authorized work MCS intends to execute.
-- Lead remains the commercial opportunity. No automatic Lead↔Job status sync.

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads (id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'authorized',
  service_type TEXT NOT NULL,
  scope_summary TEXT NOT NULL,
  property_type TEXT NOT NULL,
  service_city TEXT NOT NULL,
  authorized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT jobs_status_valid CHECK (
    status IN ('authorized', 'scheduled', 'in_progress', 'completed', 'cancelled')
  ),
  CONSTRAINT jobs_service_type_nonempty CHECK (char_length(trim(service_type)) > 0),
  CONSTRAINT jobs_scope_summary_nonempty CHECK (char_length(trim(scope_summary)) > 0),
  CONSTRAINT jobs_property_type_nonempty CHECK (char_length(trim(property_type)) > 0),
  CONSTRAINT jobs_service_city_nonempty CHECK (char_length(trim(service_city)) > 0),
  CONSTRAINT jobs_completed_trace CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status <> 'completed')
  ),
  CONSTRAINT jobs_cancelled_trace CHECK (
    (status = 'cancelled' AND cancelled_at IS NOT NULL)
    OR (status <> 'cancelled')
  )
);

-- At most one non-cancelled (active) Job per Lead.
CREATE UNIQUE INDEX IF NOT EXISTS jobs_one_active_per_lead_uidx
  ON jobs (lead_id)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS jobs_customer_id_idx ON jobs (customer_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);
CREATE INDEX IF NOT EXISTS jobs_authorized_at_idx ON jobs (authorized_at DESC);
CREATE INDEX IF NOT EXISTS jobs_lead_id_idx ON jobs (lead_id);
