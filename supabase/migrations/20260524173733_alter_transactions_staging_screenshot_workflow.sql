
-- Colonnes manquantes pour le workflow screenshot
ALTER TABLE budget_dashboard.transactions_staging
  ADD COLUMN IF NOT EXISTS direction         text,               -- income | expense | transfer_in | transfer_out | savings
  ADD COLUMN IF NOT EXISTS budget_behavior   text,               -- fixed | variable | excluded
  ADD COLUMN IF NOT EXISTS external_id       text,               -- hash dédup : md5(date|amount|label)
  ADD COLUMN IF NOT EXISTS confidence_score  numeric(4,3),       -- score LLM 0.000–1.000
  ADD COLUMN IF NOT EXISTS review_status     text NOT NULL DEFAULT 'pending_review';
                                                                  -- pending_review | approved | rejected

-- Index pour les lookups fréquents depuis le front
CREATE INDEX IF NOT EXISTS idx_staging_batch_review
  ON budget_dashboard.transactions_staging(import_batch_id, review_status);

CREATE INDEX IF NOT EXISTS idx_staging_external_id
  ON budget_dashboard.transactions_staging(external_id)
  WHERE external_id IS NOT NULL;
;
