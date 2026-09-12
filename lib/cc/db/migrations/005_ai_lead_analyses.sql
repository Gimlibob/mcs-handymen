-- MCS Command Center Phase 4A — Lead Agent read-only analysis store
-- Applied by: node scripts/cc-migrate.mjs
-- Additive only. Does not modify CRM tables (leads, notes, customers, tags).

CREATE TABLE IF NOT EXISTS ai_lead_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT 'owner',
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  crm_next_action_snapshot TEXT,
  analysis JSONB NOT NULL,
  meta JSONB,
  superseded_by UUID REFERENCES ai_lead_analyses (id) ON DELETE RESTRICT,
  CONSTRAINT ai_lead_analyses_provider_nonempty CHECK (char_length(trim(provider)) > 0),
  CONSTRAINT ai_lead_analyses_model_nonempty CHECK (char_length(trim(model)) > 0),
  CONSTRAINT ai_lead_analyses_prompt_version_nonempty CHECK (char_length(trim(prompt_version)) > 0),
  CONSTRAINT ai_lead_analyses_fingerprint_nonempty CHECK (char_length(trim(input_fingerprint)) > 0),
  CONSTRAINT ai_lead_analyses_no_self_supersede CHECK (
    superseded_by IS NULL OR superseded_by <> id
  )
);

CREATE INDEX IF NOT EXISTS ai_lead_analyses_lead_id_idx ON ai_lead_analyses (lead_id);
CREATE INDEX IF NOT EXISTS ai_lead_analyses_lead_created_idx
  ON ai_lead_analyses (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_lead_analyses_active_idx
  ON ai_lead_analyses (lead_id)
  WHERE superseded_by IS NULL;
