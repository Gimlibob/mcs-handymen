-- MCS Command Center Auth Phase B — password reset tokens
-- Applied by: node scripts/cc-migrate.mjs
-- Additive only. Does not modify Workers, Jobs, Leads, or Playbook.

CREATE TABLE IF NOT EXISTS owner_password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES owner_accounts (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owner_password_reset_tokens_token_hash_nonempty CHECK (
    char_length(trim(token_hash)) > 0
  ),
  CONSTRAINT owner_password_reset_tokens_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS owner_password_reset_tokens_owner_created_idx
  ON owner_password_reset_tokens (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS owner_password_reset_tokens_expires_at_idx
  ON owner_password_reset_tokens (expires_at);
