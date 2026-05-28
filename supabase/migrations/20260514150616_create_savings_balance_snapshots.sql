
-- ── TABLE ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budget_dashboard.savings_balance_snapshots (
  id                 uuid           DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id         uuid           NOT NULL
                                    REFERENCES budget_dashboard.accounts (id)
                                    ON DELETE CASCADE,
  snapshot_date      date           NOT NULL,
  balance_eur        numeric(12, 2),                   -- NULL si solde inconnu
  snapshot_type      text           NOT NULL DEFAULT 'certified'
                                    CHECK (snapshot_type IN ('certified', 'estimated', 'no_data')),
  total_saved_eur    numeric(12, 2) NOT NULL DEFAULT 0,
  operations_count   integer        NOT NULL DEFAULT 0,
  notable_date       date,
  notable_nature     text           CHECK (
                                      notable_nature IS NULL OR notable_nature IN (
                                        'virement', 'intérêts', 'frais_gestion',
                                        'valorisation', 'abondement_entreprise', 'dividendes'
                                      )
                                    ),
  notable_amount_eur numeric(12, 2) NOT NULL DEFAULT 0,
  source_document    text,
  notes              text,
  created_at         timestamptz    NOT NULL DEFAULT now(),
  updated_at         timestamptz    NOT NULL DEFAULT now(),

  UNIQUE (account_id, snapshot_date)
);

-- ── TRIGGER updated_at ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION budget_dashboard.set_updated_at()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = budget_dashboard AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER savings_balance_snapshots_updated_at
  BEFORE UPDATE ON budget_dashboard.savings_balance_snapshots
  FOR EACH ROW EXECUTE FUNCTION budget_dashboard.set_updated_at();

-- ── INDEX ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS savings_balance_snapshots_account_date_idx
  ON budget_dashboard.savings_balance_snapshots (account_id, snapshot_date DESC);

-- ── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE budget_dashboard.savings_balance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access"
  ON budget_dashboard.savings_balance_snapshots
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── GRANTS ───────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE
  ON budget_dashboard.savings_balance_snapshots TO authenticated;
GRANT ALL
  ON budget_dashboard.savings_balance_snapshots TO service_role;
;
