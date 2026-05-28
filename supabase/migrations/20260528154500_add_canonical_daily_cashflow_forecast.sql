-- Additive canonical layer for daily_cashflow_forecast
-- Keeps legacy columns and legacy refresh function intact for Home trajectory.

ALTER TABLE budget_dashboard.daily_cashflow_forecast
  ADD COLUMN IF NOT EXISTS daily_income_realized numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_income_projected numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_expense_realized numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_expense_projected numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_savings_realized numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_savings_projected numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_cashflow_realized numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_cashflow_projected numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cumulative_income_realized numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cumulative_income_projected numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cumulative_expense_realized numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cumulative_expense_projected numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cumulative_savings_realized numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cumulative_savings_projected numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cumulative_cashflow_realized numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cumulative_cashflow_projected numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canonical_source_version text NOT NULL DEFAULT 'v2_flux_unified',
  ADD COLUMN IF NOT EXISTS canonical_generated_at timestamptz;

CREATE OR REPLACE FUNCTION budget_dashboard.refresh_daily_cashflow_forecast_canonical(
  p_user_id uuid,
  p_year integer,
  p_month integer,
  p_as_of_date date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = budget_dashboard, public
AS $$
DECLARE
  v_month_start date;
  v_month_end date;
  v_cutoff date;
  v_auth_uid uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  IF p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'p_month must be between 1 and 12. Got: %', p_month;
  END IF;

  v_auth_uid := auth.uid();
  IF v_auth_uid IS NOT NULL AND v_auth_uid <> p_user_id THEN
    RAISE EXCEPTION 'forbidden: auth.uid() must match p_user_id';
  END IF;

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end := (v_month_start + INTERVAL '1 month - 1 day')::date;
  v_cutoff := LEAST(COALESCE(p_as_of_date, CURRENT_DATE), v_month_end);

  INSERT INTO budget_dashboard.daily_cashflow_forecast (
    user_id,
    forecast_date,
    period_year,
    period_month,
    day_of_month,
    daily_income,
    daily_fixed_ops,
    daily_variable_ops,
    daily_forward_ops,
    daily_savings_ops,
    daily_total_expenses,
    cumulative_income,
    cumulative_expenses,
    cumulative_savings,
    cumulative_cashflow,
    daily_income_realized,
    daily_income_projected,
    daily_expense_realized,
    daily_expense_projected,
    daily_savings_realized,
    daily_savings_projected,
    daily_cashflow_realized,
    daily_cashflow_projected,
    cumulative_income_realized,
    cumulative_income_projected,
    cumulative_expense_realized,
    cumulative_expense_projected,
    cumulative_savings_realized,
    cumulative_savings_projected,
    cumulative_cashflow_realized,
    cumulative_cashflow_projected,
    canonical_source_version,
    canonical_generated_at
  )
  WITH days AS (
    SELECT
      d::date AS forecast_date,
      EXTRACT(day FROM d)::int AS day_of_month
    FROM generate_series(v_month_start, v_month_end, INTERVAL '1 day') AS d
  ),
  realized_ops AS (
    SELECT
      o.operation_date::date AS op_date,
      o.flow_type,
      o.budget_accounting_amount::numeric AS amount
    FROM budget_dashboard.v_flux_operations_unified o
    WHERE o.user_id = p_user_id
      AND o.operation_date >= v_month_start
      AND o.operation_date <= v_month_end
      AND o.operation_date <= v_cutoff
      AND o.flow_type IN ('income', 'expense', 'savings')
      AND COALESCE(o.is_hidden, false) = false
      AND COALESCE(o.budget_accounting_amount, 0) <> 0
      AND (
        (o.operation_kind = 'actual' AND COALESCE(o.is_matched, false) = false)
        OR (o.operation_kind = 'planned_occurrence' AND COALESCE(o.is_matched, false) = true)
      )
  ),
  future_ops AS (
    SELECT
      o.operation_date::date AS op_date,
      o.flow_type,
      o.budget_accounting_amount::numeric AS amount
    FROM budget_dashboard.v_flux_operations_unified o
    WHERE o.user_id = p_user_id
      AND o.operation_date >= v_month_start
      AND o.operation_date <= v_month_end
      AND o.operation_date > v_cutoff
      AND o.flow_type IN ('income', 'expense', 'savings')
      AND COALESCE(o.is_hidden, false) = false
      AND COALESCE(o.budget_accounting_amount, 0) <> 0
      AND o.operation_kind = 'planned_occurrence'
      AND COALESCE(o.is_matched, false) = false
  ),
  realized_by_day AS (
    SELECT
      op_date,
      SUM(CASE WHEN flow_type = 'income' THEN amount ELSE 0 END) AS income_realized,
      ABS(SUM(CASE WHEN flow_type = 'expense' THEN amount ELSE 0 END)) AS expense_realized,
      ABS(SUM(CASE WHEN flow_type = 'savings' THEN amount ELSE 0 END)) AS savings_realized,
      SUM(amount) AS cashflow_realized
    FROM realized_ops
    GROUP BY op_date
  ),
  future_by_day AS (
    SELECT
      op_date,
      SUM(CASE WHEN flow_type = 'income' THEN amount ELSE 0 END) AS income_future,
      ABS(SUM(CASE WHEN flow_type = 'expense' THEN amount ELSE 0 END)) AS expense_future,
      ABS(SUM(CASE WHEN flow_type = 'savings' THEN amount ELSE 0 END)) AS savings_future,
      SUM(amount) AS cashflow_future
    FROM future_ops
    GROUP BY op_date
  ),
  daily AS (
    SELECT
      d.forecast_date,
      d.day_of_month,
      ROUND(COALESCE(r.income_realized, 0), 2) AS daily_income_realized,
      ROUND(COALESCE(r.expense_realized, 0), 2) AS daily_expense_realized,
      ROUND(COALESCE(r.savings_realized, 0), 2) AS daily_savings_realized,
      ROUND(COALESCE(r.cashflow_realized, 0), 2) AS daily_cashflow_realized,
      ROUND(COALESCE(r.income_realized, 0) + COALESCE(f.income_future, 0), 2) AS daily_income_projected,
      ROUND(COALESCE(r.expense_realized, 0) + COALESCE(f.expense_future, 0), 2) AS daily_expense_projected,
      ROUND(COALESCE(r.savings_realized, 0) + COALESCE(f.savings_future, 0), 2) AS daily_savings_projected,
      ROUND(COALESCE(r.cashflow_realized, 0) + COALESCE(f.cashflow_future, 0), 2) AS daily_cashflow_projected
    FROM days d
    LEFT JOIN realized_by_day r ON r.op_date = d.forecast_date
    LEFT JOIN future_by_day f ON f.op_date = d.forecast_date
  ),
  cumul AS (
    SELECT
      d.*,
      ROUND(SUM(d.daily_income_realized) OVER (ORDER BY d.day_of_month ROWS UNBOUNDED PRECEDING), 2) AS cumulative_income_realized,
      ROUND(SUM(d.daily_income_projected) OVER (ORDER BY d.day_of_month ROWS UNBOUNDED PRECEDING), 2) AS cumulative_income_projected,
      ROUND(SUM(d.daily_expense_realized) OVER (ORDER BY d.day_of_month ROWS UNBOUNDED PRECEDING), 2) AS cumulative_expense_realized,
      ROUND(SUM(d.daily_expense_projected) OVER (ORDER BY d.day_of_month ROWS UNBOUNDED PRECEDING), 2) AS cumulative_expense_projected,
      ROUND(SUM(d.daily_savings_realized) OVER (ORDER BY d.day_of_month ROWS UNBOUNDED PRECEDING), 2) AS cumulative_savings_realized,
      ROUND(SUM(d.daily_savings_projected) OVER (ORDER BY d.day_of_month ROWS UNBOUNDED PRECEDING), 2) AS cumulative_savings_projected,
      ROUND(SUM(d.daily_cashflow_realized) OVER (ORDER BY d.day_of_month ROWS UNBOUNDED PRECEDING), 2) AS cumulative_cashflow_realized,
      ROUND(SUM(d.daily_cashflow_projected) OVER (ORDER BY d.day_of_month ROWS UNBOUNDED PRECEDING), 2) AS cumulative_cashflow_projected
    FROM daily d
  )
  SELECT
    p_user_id,
    c.forecast_date,
    p_year,
    p_month,
    c.day_of_month,
    c.daily_income_projected,
    0,
    c.daily_expense_projected,
    0,
    c.daily_savings_projected,
    c.daily_expense_projected,
    c.cumulative_income_projected,
    c.cumulative_expense_projected,
    c.cumulative_savings_projected,
    c.cumulative_cashflow_projected,
    c.daily_income_realized,
    c.daily_income_projected,
    c.daily_expense_realized,
    c.daily_expense_projected,
    c.daily_savings_realized,
    c.daily_savings_projected,
    c.daily_cashflow_realized,
    c.daily_cashflow_projected,
    c.cumulative_income_realized,
    c.cumulative_income_projected,
    c.cumulative_expense_realized,
    c.cumulative_expense_projected,
    c.cumulative_savings_realized,
    c.cumulative_savings_projected,
    c.cumulative_cashflow_realized,
    c.cumulative_cashflow_projected,
    'v2_flux_unified',
    now()
  FROM cumul c
  ON CONFLICT (user_id, forecast_date)
  DO UPDATE SET
    daily_income_realized = EXCLUDED.daily_income_realized,
    daily_income_projected = EXCLUDED.daily_income_projected,
    daily_expense_realized = EXCLUDED.daily_expense_realized,
    daily_expense_projected = EXCLUDED.daily_expense_projected,
    daily_savings_realized = EXCLUDED.daily_savings_realized,
    daily_savings_projected = EXCLUDED.daily_savings_projected,
    daily_cashflow_realized = EXCLUDED.daily_cashflow_realized,
    daily_cashflow_projected = EXCLUDED.daily_cashflow_projected,
    cumulative_income_realized = EXCLUDED.cumulative_income_realized,
    cumulative_income_projected = EXCLUDED.cumulative_income_projected,
    cumulative_expense_realized = EXCLUDED.cumulative_expense_realized,
    cumulative_expense_projected = EXCLUDED.cumulative_expense_projected,
    cumulative_savings_realized = EXCLUDED.cumulative_savings_realized,
    cumulative_savings_projected = EXCLUDED.cumulative_savings_projected,
    cumulative_cashflow_realized = EXCLUDED.cumulative_cashflow_realized,
    cumulative_cashflow_projected = EXCLUDED.cumulative_cashflow_projected,
    canonical_source_version = EXCLUDED.canonical_source_version,
    canonical_generated_at = EXCLUDED.canonical_generated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION budget_dashboard.refresh_daily_cashflow_forecast_canonical(uuid, integer, integer, date) TO authenticated;
