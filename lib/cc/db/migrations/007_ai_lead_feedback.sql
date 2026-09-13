-- MCS Command Center Phase 4A.6 — Lead Agent human feedback (learning signal)
-- Applied by: node scripts/cc-migrate.mjs
-- Additive only. Does not modify ai_lead_analyses content or CRM / Playbook tables.
--
-- Supersession atomicity (application transaction):
--   1) LOCK parent ai_lead_analyses row (FOR UPDATE)
--   2) UPDATE prior active feedback SET superseded_by = new_id
--      (FK to new_id is DEFERRABLE INITIALLY DEFERRED)
--   3) INSERT new active row with id = new_id
-- Never: insert active first then supersede (violates unique active index).

CREATE TABLE IF NOT EXISTS ai_lead_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES ai_lead_analyses (id) ON DELETE RESTRICT,
  lead_id UUID NOT NULL REFERENCES leads (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT 'owner',
  decision TEXT NOT NULL,
  corrected_suggested_next_action TEXT,
  correction_note TEXT,
  superseded_by UUID,
  CONSTRAINT ai_lead_feedback_decision_allowed CHECK (
    decision IN ('accepted', 'rejected', 'corrected')
  ),
  CONSTRAINT ai_lead_feedback_correction_shape CHECK (
    (
      decision = 'corrected'
      AND corrected_suggested_next_action IS NOT NULL
      AND char_length(trim(corrected_suggested_next_action)) > 0
    )
    OR (
      decision IN ('accepted', 'rejected')
      AND corrected_suggested_next_action IS NULL
    )
  ),
  CONSTRAINT ai_lead_feedback_note_nonempty CHECK (
    correction_note IS NULL OR char_length(trim(correction_note)) > 0
  ),
  CONSTRAINT ai_lead_feedback_no_self_supersede CHECK (
    superseded_by IS NULL OR superseded_by <> id
  ),
  CONSTRAINT ai_lead_feedback_superseded_by_fkey
    FOREIGN KEY (superseded_by) REFERENCES ai_lead_feedback (id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS ai_lead_feedback_lead_id_idx
  ON ai_lead_feedback (lead_id);

CREATE INDEX IF NOT EXISTS ai_lead_feedback_analysis_id_idx
  ON ai_lead_feedback (analysis_id);

CREATE INDEX IF NOT EXISTS ai_lead_feedback_lead_created_idx
  ON ai_lead_feedback (lead_id, created_at DESC);

-- One active (current) decision per analysis
CREATE UNIQUE INDEX IF NOT EXISTS ai_lead_feedback_active_per_analysis_uidx
  ON ai_lead_feedback (analysis_id)
  WHERE superseded_by IS NULL;
