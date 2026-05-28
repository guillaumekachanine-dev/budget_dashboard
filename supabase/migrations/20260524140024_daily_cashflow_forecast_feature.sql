-- Migration: daily_cashflow_forecast feature
-- Adds 4 missing planned_operations, creates the daily_cashflow_forecast table,
-- and creates the refresh_cashflow_forecast function used to populate it.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Missing planned_operations (already_budgeted recurring ops)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Abonnement internet SFR (part perso 50%)
  IF NOT EXISTS (
    SELECT 1 FROM budget_dashboard.planned_operations WHERE label = 'Abonnement internet SFR'
  ) THEN
    INSERT INTO budget_dashboard.planned_operations
      (label, planned_amount, personal_share_ratio, flow_type,
       recurrence_frequency, recurrence_day_of_month,
       recurrence_start_date, recurrence_end_date,
       category_id, budget_impact, is_active)
    VALUES
      ('Abonnement internet SFR', 19.99, 0.5, 'expense',
       'monthly', 8,
       '2026-01-08', '2026-12-31',
       '08f5dba6-2730-457b-93f7-24140d04e150', 'already_budgeted', true);
  END IF;

  -- Charges résidence SDC (part perso 50%)
  IF NOT EXISTS (
    SELECT 1 FROM budget_dashboard.planned_operations WHERE label = 'Charges résidence SDC'
  ) THEN
    INSERT INTO budget_dashboard.planned_operations
      (label, planned_amount, personal_share_ratio, flow_type,
       recurrence_frequency, recurrence_day_of_month,
       recurrence_start_date, recurrence_end_date,
       category_id, budget_impact, is_active)
    VALUES
      ('Charges résidence SDC', 117.73, 0.5, 'expense',
       'monthly', 15,
       '2026-01-15', '2026-12-31',
       '9066566e-a623-4179-8ab3-9181c02eff68', 'already_budgeted', true);
  END IF;

  -- Électricité TotalEnergies (part perso 50%)
  IF NOT EXISTS (
    SELECT 1 FROM budget_dashboard.planned_operations WHERE label = 'Électricité TotalEnergies'
  ) THEN
    INSERT INTO budget_dashboard.planned_operations
      (label, planned_amount, personal_share_ratio, flow_type,
       recurrence_frequency, recurrence_day_of_month,
       recurrence_start_date, recurrence_end_date,
       category_id, budget_impact, is_active)
    VALUES
      ('Électricité TotalEnergies', 58.00, 0.5, 'expense',
       'monthly', 27,
       '2026-01-27', '2026-12-31',
       'bebb7217-200e-4d16-849e-b6cd14e93ce3', 'already_budgeted', true);
  END IF;

  -- Assurance habitation Allianz (part perso 100%)
  -- NOTE: budget line says 7.50 EUR but actual ALLIANZ IARD charge is 22.04 EUR
  IF NOT EXISTS (
    SELECT 1 FROM budget_dashboard.planned_operations WHERE label = 'Assurance habitation Allianz'
  ) THEN
    INSERT INTO budget_dashboard.planned_operations
      (label, planned_amount, personal_share_ratio, flow_type,
       recurrence_frequency, recurrence_day_of_month,
       recurrence_start_date, recurrence_end_date,
       category_id, budget_impact, is_active)
    VALUES
      ('Assurance habitation Allianz', 22.04, 1.0, 'expense',
       'monthly', 5,
       '2026-01-05', '2026-12-31',
       '7d2ba7c0-1ff8-4001-ba9a-05002a16e883', 'already_budgeted', true);
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Table: daily_cashflow_forecast
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budget_dashboard.daily_cashflow_forecast (
  id                   uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              uuid          NOT NULL,
  forecast_date        date          NOT NULL,
  period_year          int           NOT NULL,
  period_month         int           NOT NULL,
  day_of_month         int           NOT NULL,
  daily_income         numeric(12,2) NOT NULL DEFAULT 0,
  daily_fixed_ops      numeric(12,2) NOT NULL DEFAULT 0,
  daily_variable_ops   numeric(12,2) NOT NULL DEFAULT 0,
  daily_forward_ops    numeric(12,2) NOT NULL DEFAULT 0,
  daily_savings_ops    numeric(12,2) NOT NULL DEFAULT 0,
  daily_total_expenses numeric(12,2) NOT NULL DEFAULT 0,
  cumulative_income    numeric(12,2) NOT NULL DEFAULT 0,
  cumulative_expenses  numeric(12,2) NOT NULL DEFAULT 0,
  cumulative_savings   numeric(12,2) NOT NULL DEFAULT 0,
  cumulative_cashflow  numeric(12,2) NOT NULL DEFAULT 0,
  generated_at         timestamptz   DEFAULT now(),
  UNIQUE (user_id, forecast_date)
);

CREATE INDEX IF NOT EXISTS idx_dcf_user_period
  ON budget_dashboard.daily_cashflow_forecast (user_id, period_year, period_month);

ALTER TABLE budget_dashboard.daily_cashflow_forecast ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'budget_dashboard'
      AND tablename  = 'daily_cashflow_forecast'
      AND policyname = 'owner_only_dcf'
  ) THEN
    CREATE POLICY owner_only_dcf
      ON budget_dashboard.daily_cashflow_forecast
      FOR ALL
      USING (user_id = auth.uid());
  END IF;
END;
$$;

GRANT SELECT ON budget_dashboard.daily_cashflow_forecast TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Function: refresh_cashflow_forecast(p_year, p_month)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION budget_dashboard.refresh_cashflow_forecast(
  p_year  int,
  p_month int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id          uuid := 'da1d9874-4cf9-4607-b09d-34336e69126b';
  v_month_start      date := make_date(p_year, p_month, 1);
  v_month_end        date := (v_month_start + interval '1 month - 1 day')::date;
  v_days_in_month    int  := extract(day from v_month_end)::int;
  v_expense_budget   numeric;
  v_total_fixed      numeric;
  v_variable_budget  numeric;
BEGIN
  SELECT COALESCE(projected_non_savings_expenses, 0)
  INTO   v_expense_budget
  FROM   budget_dashboard.v_optimization_monthly_budget_forecast
  WHERE  period_year = p_year
    AND  period_month = p_month
  LIMIT 1;

  v_expense_budget := COALESCE(v_expense_budget, 0);

  SELECT COALESCE(SUM(planned_personal_amount), 0)
  INTO   v_total_fixed
  FROM   budget_dashboard.v_planned_operations_occurrences_enriched
  WHERE  period_year   = p_year
    AND  period_month  = p_month
    AND  budget_impact = 'already_budgeted'
    AND  flow_type     = 'expense';

  v_variable_budget := GREATEST(0, v_expense_budget - v_total_fixed);

  DELETE FROM budget_dashboard.daily_cashflow_forecast
  WHERE  user_id      = v_user_id
    AND  period_year  = p_year
    AND  period_month = p_month;

  INSERT INTO budget_dashboard.daily_cashflow_forecast
    (user_id, forecast_date, period_year, period_month, day_of_month,
     daily_income, daily_fixed_ops, daily_variable_ops, daily_forward_ops, daily_savings_ops,
     daily_total_expenses,
     cumulative_income, cumulative_expenses, cumulative_savings, cumulative_cashflow)
  WITH
  day_weights AS (
    SELECT
      d::date                      AS dt,
      extract(day from d)::int     AS dom,
      CASE extract(dow from d)
        WHEN 0 THEN 1.3
        WHEN 1 THEN 0.8
        WHEN 2 THEN 0.8
        WHEN 3 THEN 1.0
        WHEN 4 THEN 1.0
        WHEN 5 THEN 1.3
        WHEN 6 THEN 1.6
      END                          AS weight
    FROM generate_series(v_month_start, v_month_end, interval '1 day') AS d
  ),
  weight_total AS (
    SELECT SUM(weight) AS total FROM day_weights
  ),
  fixed_by_day AS (
    SELECT
      extract(day from planned_date)::int AS dom,
      SUM(planned_personal_amount)        AS fixed_amt
    FROM budget_dashboard.v_planned_operations_occurrences_enriched
    WHERE period_year  = p_year
      AND period_month = p_month
      AND budget_impact = 'already_budgeted'
      AND flow_type     = 'expense'
    GROUP BY 1
  ),
  forward_by_day AS (
    SELECT
      LEAST(
        CASE WHEN recurrence_frequency = 'none'
          THEN extract(day from recurrence_start_date)::int
          ELSE recurrence_day_of_month
        END,
        v_days_in_month
      ) AS dom,
      SUM(planned_amount * personal_share_ratio) AS forward_amt
    FROM budget_dashboard.planned_operations
    WHERE budget_impact = 'additional_commitment'
      AND is_active     = true
      AND flow_type     = 'expense'
      AND (
        (recurrence_frequency = 'none'
          AND recurrence_start_date BETWEEN v_month_start AND v_month_end)
        OR
        (recurrence_frequency = 'monthly'
          AND recurrence_start_date <= v_month_end
          AND (recurrence_end_date IS NULL OR recurrence_end_date >= v_month_start))
      )
    GROUP BY 1
  ),
  savings_by_day AS (
    SELECT
      extract(day from planned_date)::int AS dom,
      SUM(planned_personal_amount)        AS savings_amt
    FROM budget_dashboard.v_planned_operations_occurrences_enriched
    WHERE period_year  = p_year
      AND period_month = p_month
      AND flow_type    = 'savings'
    GROUP BY 1
  ),
  income_by_day AS (
    SELECT
      LEAST(day_of_month, v_days_in_month) AS dom,
      SUM(monthly_amount)                  AS income_amt
    FROM budget_dashboard.income_sources
    WHERE is_active = true
    GROUP BY 1
  ),
  daily_raw AS (
    SELECT
      dw.dom,
      dw.dt,
      COALESCE(i.income_amt,   0)                              AS inc,
      COALESCE(f.fixed_amt,    0)                              AS fixed,
      ROUND(v_variable_budget * dw.weight / wt.total, 2)      AS variable,
      COALESCE(fw.forward_amt, 0)                              AS forward,
      COALESCE(s.savings_amt,  0)                              AS savings
    FROM       day_weights dw
    CROSS JOIN weight_total wt
    LEFT JOIN  income_by_day   i  ON i.dom  = dw.dom
    LEFT JOIN  fixed_by_day    f  ON f.dom  = dw.dom
    LEFT JOIN  forward_by_day  fw ON fw.dom = dw.dom
    LEFT JOIN  savings_by_day  s  ON s.dom  = dw.dom
  ),
  daily_totals AS (
    SELECT dom, dt, inc, fixed, variable, forward, savings,
           fixed + variable + forward + savings AS total_exp
    FROM daily_raw
  ),
  cumul AS (
    SELECT
      dom, dt, inc, fixed, variable, forward, savings, total_exp,
      SUM(inc)       OVER (ORDER BY dom ROWS UNBOUNDED PRECEDING) AS cum_inc,
      SUM(total_exp) OVER (ORDER BY dom ROWS UNBOUNDED PRECEDING) AS cum_exp,
      SUM(savings)   OVER (ORDER BY dom ROWS UNBOUNDED PRECEDING) AS cum_sav
    FROM daily_totals
  )
  SELECT
    v_user_id, dt, p_year, p_month, dom,
    inc, fixed, variable, forward, savings, total_exp,
    cum_inc, cum_exp, cum_sav,
    cum_inc - cum_exp - cum_sav
  FROM cumul
  ORDER BY dom;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Populate June–December 2026 (idempotent: DELETE+INSERT inside function)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE m int;
BEGIN
  FOR m IN 6..12 LOOP
    PERFORM budget_dashboard.refresh_cashflow_forecast(2026, m);
  END LOOP;
END;
$$;
