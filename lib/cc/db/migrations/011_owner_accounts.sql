-- MCS Command Center Auth Phase A — owner_accounts foundation
-- Applied by: node scripts/cc-migrate.mjs
-- Additive only. Does not modify Workers, Jobs, Leads, or Playbook.
--
-- Single Command Center owner account (not Worker auth).
-- Password hashing remains scrypt (application layer).

CREATE TABLE IF NOT EXISTS owner_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owner_accounts_email_nonempty CHECK (char_length(trim(email)) > 0),
  CONSTRAINT owner_accounts_email_normalized_nonempty CHECK (
    char_length(trim(email_normalized)) > 0
  ),
  CONSTRAINT owner_accounts_password_hash_nonempty CHECK (
    char_length(trim(password_hash)) > 0
  ),
  CONSTRAINT owner_accounts_password_version_positive CHECK (password_version >= 1),
  CONSTRAINT owner_accounts_email_normalized_unique UNIQUE (email_normalized)
);

-- Exactly one owner row for this Command Center.
CREATE UNIQUE INDEX IF NOT EXISTS owner_accounts_singleton_uidx
  ON owner_accounts ((true));
