-- MCS Command Center Phase 4A.5.a — Playbook foundation (entries + revisions)
-- Applied by: node scripts/cc-migrate.mjs
-- Additive only. Does not modify CRM, AI analysis, or site-config constants.
-- No seed data. Sources / candidates tables deferred to later slices.

CREATE TABLE IF NOT EXISTS playbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  service_keys TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  sensitivity TEXT NOT NULL,
  validation_state TEXT NOT NULL,
  current_approved_revision_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT 'owner',
  CONSTRAINT playbook_entries_slug_nonempty CHECK (char_length(trim(slug)) > 0),
  CONSTRAINT playbook_entries_title_nonempty CHECK (char_length(trim(title)) > 0),
  CONSTRAINT playbook_entries_slug_unique UNIQUE (slug),
  CONSTRAINT playbook_entries_category_valid CHECK (
    category IN (
      'commercial_policy',
      'service_offered',
      'service_not_offered',
      'service_area',
      'lead_qualification',
      'pricing_rule',
      'work_procedure',
      'materials',
      'tools',
      'technical_spec',
      'manufacturer_ref',
      'safety',
      'quality_standard',
      'employee_procedure',
      'service_knowledge'
    )
  ),
  CONSTRAINT playbook_entries_sensitivity_valid CHECK (
    sensitivity IN (
      'commercial',
      'operational',
      'technical_critical',
      'internal_employee'
    )
  ),
  CONSTRAINT playbook_entries_validation_state_valid CHECK (
    validation_state IN ('validated', 'hypothesis', 'discussion')
  )
);

CREATE INDEX IF NOT EXISTS playbook_entries_category_idx ON playbook_entries (category);
CREATE INDEX IF NOT EXISTS playbook_entries_validation_state_idx ON playbook_entries (validation_state);
CREATE INDEX IF NOT EXISTS playbook_entries_sensitivity_idx ON playbook_entries (sensitivity);
CREATE INDEX IF NOT EXISTS playbook_entries_service_keys_gin_idx ON playbook_entries USING GIN (service_keys);
CREATE INDEX IF NOT EXISTS playbook_entries_tags_gin_idx ON playbook_entries USING GIN (tags);

CREATE TABLE IF NOT EXISTS playbook_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES playbook_entries (id) ON DELETE RESTRICT,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  summary TEXT,
  body_md TEXT NOT NULL DEFAULT '',
  structured_fields JSONB,
  change_note TEXT,
  supersedes_revision_id UUID REFERENCES playbook_revisions (id) ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT 'owner',
  CONSTRAINT playbook_revisions_version_positive CHECK (version >= 1),
  CONSTRAINT playbook_revisions_status_valid CHECK (
    status IN ('draft', 'approved', 'retired')
  ),
  CONSTRAINT playbook_revisions_entry_version_unique UNIQUE (entry_id, version),
  CONSTRAINT playbook_revisions_no_self_supersede CHECK (
    supersedes_revision_id IS NULL OR supersedes_revision_id <> id
  ),
  CONSTRAINT playbook_revisions_approved_trace CHECK (
    (status = 'approved' AND approved_at IS NOT NULL AND approved_by IS NOT NULL)
    OR (status <> 'approved')
  ),
  CONSTRAINT playbook_revisions_retired_trace CHECK (
    (status = 'retired' AND retired_at IS NOT NULL)
    OR (status <> 'retired')
  )
);

CREATE INDEX IF NOT EXISTS playbook_revisions_entry_id_idx ON playbook_revisions (entry_id);
CREATE INDEX IF NOT EXISTS playbook_revisions_status_idx ON playbook_revisions (status);
CREATE INDEX IF NOT EXISTS playbook_revisions_entry_status_idx
  ON playbook_revisions (entry_id, status);

-- At most one approved revision per entry (immutability of approved content via new drafts).
CREATE UNIQUE INDEX IF NOT EXISTS playbook_revisions_one_approved_per_entry_idx
  ON playbook_revisions (entry_id)
  WHERE status = 'approved';

ALTER TABLE playbook_entries
  DROP CONSTRAINT IF EXISTS playbook_entries_current_approved_revision_fkey;

ALTER TABLE playbook_entries
  ADD CONSTRAINT playbook_entries_current_approved_revision_fkey
  FOREIGN KEY (current_approved_revision_id)
  REFERENCES playbook_revisions (id)
  ON DELETE RESTRICT;
