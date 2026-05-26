
-- Index unique partiel sur transactions.external_id pour le dédup lors de la promotion
-- Partiel (WHERE NOT NULL) pour éviter les conflits entre les transactions historiques sans external_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_id_unique
  ON budget_dashboard.transactions(external_id)
  WHERE external_id IS NOT NULL;
;
