-- Persisted editable data for "Epargne > Planning" monthly modals.
-- Scope: budget_dashboard schema only.

CREATE TABLE IF NOT EXISTS budget_dashboard.savings_planning_month_details (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_year             int NOT NULL CHECK (period_year >= 2000 AND period_year <= 2100),
  period_month            int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  monthly_objective_amount numeric(12,2) NOT NULL DEFAULT 0,
  planned_savings_amount   numeric(12,2) NOT NULL DEFAULT 0,
  transfer_date            date,
  transfer_amount          numeric(12,2) NOT NULL DEFAULT 0,
  source_account_id        uuid REFERENCES budget_dashboard.accounts(id) ON DELETE SET NULL,
  source_account_label     text,
  destination_account_id   uuid REFERENCES budget_dashboard.accounts(id) ON DELETE SET NULL,
  destination_label        text,
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at               timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT savings_planning_month_details_user_period_unique UNIQUE (user_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_savings_planning_month_details_user_period
  ON budget_dashboard.savings_planning_month_details (user_id, period_year, period_month);

CREATE OR REPLACE FUNCTION budget_dashboard.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_savings_planning_month_details_updated_at
  ON budget_dashboard.savings_planning_month_details;

CREATE TRIGGER trg_savings_planning_month_details_updated_at
BEFORE UPDATE ON budget_dashboard.savings_planning_month_details
FOR EACH ROW
EXECUTE FUNCTION budget_dashboard.set_updated_at();

ALTER TABLE budget_dashboard.savings_planning_month_details ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'budget_dashboard'
      AND tablename = 'savings_planning_month_details'
      AND policyname = 'savings_planning_month_details_owner_all'
  ) THEN
    CREATE POLICY savings_planning_month_details_owner_all
      ON budget_dashboard.savings_planning_month_details
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON budget_dashboard.savings_planning_month_details TO authenticated;
GRANT ALL
  ON budget_dashboard.savings_planning_month_details TO service_role;
