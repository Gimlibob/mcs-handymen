-- Applied ONLY after orphan check: every lead has customer_id.
-- Do not apply this file until scripts/cc-verify-customer-backfill.mjs reports 0 orphans.

ALTER TABLE leads
  ALTER COLUMN customer_id SET NOT NULL;
