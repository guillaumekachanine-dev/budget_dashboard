-- Fix canonical projected savings source for daily_cashflow_forecast
-- Source of truth: savings_planning_month_details.monthly_objective_amount

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
      AND o.flow_type IN ('income', 'expense')
      AND COALESCE(o.is_hidden, false) = false
      AND COALESCE(o.budget_accounting_amount, 0) <> 0
      AND o.operation_kind = 'planned_occurrence'
      AND COALESCE(o.is_matched, false) = false
  ),
  realized_savings_month AS (
    SELECT COALESCE(ABS(SUM(amount)), 0)::numeric AS actual_savings_month_total
    FROM realized_ops
    WHERE flow_type = 'savings'
  ),
  savings_plan AS (
    SELECT
      GREATEST(COALESCE(sp.monthly_objective_amount, 0), 0)::numeric AS monthly_objective_amount,
      CASE
        WHEN sp.transfer_date IS NOT NULL
         AND sp.transfer_date >= v_month_start
         AND sp.transfer_date <= v_month_end
          THEN sp.transfer_date
        ELSE v_month_end
      END::date AS projected_savings_date
    FROM budget_dashboard.savings_planning_month_details sp
    WHERE sp.user_id = p_user_id
      AND sp.period_year = p_year
      AND sp.period_month = p_month
    LIMIT 1
  ),
  remaining_savings_plan AS (
    SELECT
      CASE
        WHEN sp.projected_savings_date > v_cutoff
          THEN GREATEST(sp.monthly_objective_amount - r.actual_savings_month_total, 0)
        ELSE 0
      END::numeric AS remaining_projected_savings,
      sp.projected_savings_date
    FROM savings_plan sp
    CROSS JOIN realized_savings_month r
  ),
  projected_savings_by_day AS (
    SELECT
      rsp.projected_savings_date AS op_date,
      rsp.remaining_projected_savings AS savings_future
    FROM remaining_savings_plan rsp
    WHERE rsp.remaining_projected_savings > 0
      AND rsp.projected_savings_date >= v_month_start
      AND rsp.projected_savings_date <= v_month_end
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
      ROUND(COALESCE(r.savings_realized, 0) + COALESCE(ps.savings_future, 0), 2) AS daily_savings_projected,
      ROUND(COALESCE(r.cashflow_realized, 0) + COALESCE(f.cashflow_future, 0) - COALESCE(ps.savings_future, 0), 2) AS daily_cashflow_projected
    FROM days d
    LEFT JOIN realized_by_day r ON r.op_date = d.forecast_date
    LEFT JOIN future_by_day f ON f.op_date = d.forecast_date
    LEFT JOIN projected_savings_by_day ps ON ps.op_date = d.forecast_date
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
