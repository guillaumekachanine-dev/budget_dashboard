
-- 1a. Ajout parent_account_id dans savings_account_config
ALTER TABLE budget_dashboard.savings_account_config
  ADD COLUMN IF NOT EXISTS parent_account_id uuid
    REFERENCES budget_dashboard.savings_account_config(id) ON DELETE SET NULL;

COMMENT ON COLUMN budget_dashboard.savings_account_config.parent_account_id IS
  'Si non NULL : ce compte est un sous-compte agrégé dans le compte primaire pour l''affichage front.';

-- 1b. Table des taux historiques des livrets réglementés
CREATE TABLE IF NOT EXISTS budget_dashboard.savings_rate_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  savings_kind text       NOT NULL,
  rate_year   integer     NOT NULL,
  rate_pct    numeric(6,4) NOT NULL,
  rate_type   text        NOT NULL DEFAULT 'regulated'
                          CHECK (rate_type IN ('regulated','estimated','historical')),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (savings_kind, rate_year)
);

COMMENT ON TABLE budget_dashboard.savings_rate_history IS
  'Taux annuels des livrets réglementés et placements, source de vérité pour les projections.';

ALTER TABLE budget_dashboard.savings_rate_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "savings_rate_history_select"
  ON budget_dashboard.savings_rate_history FOR SELECT USING (true);
;
