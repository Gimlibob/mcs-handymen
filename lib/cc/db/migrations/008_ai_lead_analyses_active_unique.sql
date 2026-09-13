-- MCS Command Center Phase 4A — harden one-active analysis per lead
-- Applied by: node scripts/cc-migrate.mjs
-- Additive integrity fix. Does not change analysis JSON / CRM / Playbook.
--
-- Application insert order (Neon transaction):
--   1) LOCK parent leads row (FOR UPDATE)
--   2) UPDATE prior active analyses SET superseded_by = new_id
--      (FK DEFERRABLE INITIALLY DEFERRED)
--   3) INSERT new analysis with id = new_id
-- Never: insert-active-then-supersede (would violate unique active index).

-- 1) Repair any pre-existing duplicate actives: keep newest per lead.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lead_id
      ORDER BY created_at DESC, id DESC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY lead_id
      ORDER BY created_at DESC, id DESC
    ) AS keep_id
  FROM ai_lead_analyses
  WHERE superseded_by IS NULL
)
UPDATE ai_lead_analyses AS a
SET superseded_by = ranked.keep_id
FROM ranked
WHERE a.id = ranked.id
  AND ranked.rn > 1
  AND a.superseded_by IS NULL;

-- 2) Make superseded_by FK deferrable so supersede-before-insert works in one txn.
ALTER TABLE ai_lead_analyses
  DROP CONSTRAINT IF EXISTS ai_lead_analyses_superseded_by_fkey;

ALTER TABLE ai_lead_analyses
  ADD CONSTRAINT ai_lead_analyses_superseded_by_fkey
  FOREIGN KEY (superseded_by) REFERENCES ai_lead_analyses (id) ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

-- 3) Replace non-unique active index with unique guard: one active per lead.
DROP INDEX IF EXISTS ai_lead_analyses_active_idx;

CREATE UNIQUE INDEX IF NOT EXISTS ai_lead_analyses_active_per_lead_uidx
  ON ai_lead_analyses (lead_id)
  WHERE superseded_by IS NULL;
