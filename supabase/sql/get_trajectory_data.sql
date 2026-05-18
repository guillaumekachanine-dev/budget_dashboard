-- Trajectory chart RPC for Home page carousel slide 0 ("Consommé vs réel")
-- Returns pre-aggregated daily cumulative spending vs planned budget.
-- Replaces client-side GROUP BY + cumulative sum over raw transaction rows.
--
-- Source tables:
--   - budget_dashboard.transactions      (expense rows for the month)
--   - budget_dashboard.budget_periods    (period lookup)
--   - budget_dashboard.budgets           (category budget amounts)

-- Partial index: covers the exact WHERE used inside the RPC
-- (user_id, transaction_date) with the static filters inlined so Postgres
-- can skip the heap scan for non-expense / hidden rows entirely.
CREATE INDEX IF NOT EXISTS idx_transactions_expense_by_date
  ON budget_dashboard.transactions (user_id, transaction_date)
  WHERE is_hidden = FALSE AND flow_type = 'expense';

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION budget_dashboard.get_trajectory_data(
  p_user_id uuid,
  p_year    int,
  p_month   int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = budget_dashboard, public
AS $$
DECLARE
  v_month_start   date;
  v_month_end     date;
  v_days_in_month int;
  v_cutoff        date;
  v_days_elapsed  int;
  v_total_budget  numeric;
  v_result        jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  IF p_year IS NULL OR p_month IS NULL THEN
    RAISE EXCEPTION 'p_year and p_month are required';
  END IF;

  IF p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'p_month must be between 1 and 12';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'p_user_id must match auth.uid()';
  END IF;

  v_month_start   := make_date(p_year, p_month, 1);
  v_month_end     := (v_month_start + INTERVAL '1 month - 1 day')::date;
  v_days_in_month := EXTRACT(DAY FROM v_month_end)::int;

  -- cutoff = today for the current month, month-end for past months
  v_cutoff       := LEAST(CURRENT_DATE, v_month_end);
  v_days_elapsed := EXTRACT(DAY FROM v_cutoff)::int;

  -- Total monthly budget = sum of all category-level budgets for the period
  SELECT COALESCE(SUM(b.amount), 0)
  INTO   v_total_budget
  FROM   budget_dashboard.budget_periods bp
  JOIN   budget_dashboard.budgets b
      ON b.period_id    = bp.id
     AND b.budget_kind  = 'category'
  WHERE  bp.user_id     = p_user_id
    AND  bp.period_year  = p_year
    AND  bp.period_month = p_month;

  -- Build the 28-31 point daily series
  WITH
  day_series AS (
    SELECT gs AS day
    FROM   generate_series(1, v_days_in_month) AS gs
  ),
  daily_actual AS (
    -- One row per day that has expenses; missing days get 0 via LEFT JOIN below
    SELECT
      EXTRACT(DAY FROM t.transaction_date)::int AS day,
      SUM(t.amount)::numeric                    AS daily_amount
    FROM   budget_dashboard.transactions t
    WHERE  t.user_id          = p_user_id
      AND  t.flow_type        = 'expense'
      AND  t.is_hidden        = FALSE
      AND  t.transaction_date >= v_month_start
      AND  t.transaction_date <= v_cutoff       -- stops at today for current month
    GROUP  BY 1
  ),
  series AS (
    SELECT
      ds.day,
      COALESCE(da.daily_amount, 0)::numeric AS daily_amount
    FROM   day_series  ds
    LEFT JOIN daily_actual da ON da.day = ds.day
  ),
  cumulative AS (
    SELECT
      day,
      ROUND(
        SUM(daily_amount) OVER (ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),
        2
      )                                                             AS cumulative_actual,
      ROUND(v_total_budget / NULLIF(v_days_in_month, 0) * day, 2) AS planned
    FROM series
  )
  SELECT jsonb_build_object(
    'total_budget',  v_total_budget,
    'days_in_month', v_days_in_month,
    'days_elapsed',  v_days_elapsed,
    'days', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'day',     c.day,
          'planned', c.planned,
          -- actual / delta are NULL for future days (no data yet)
          'actual',  CASE WHEN c.day <= v_days_elapsed THEN c.cumulative_actual ELSE NULL END,
          'delta',   CASE WHEN c.day <= v_days_elapsed THEN c.cumulative_actual - c.planned ELSE NULL END
        )
        ORDER BY c.day
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM cumulative c;

  RETURN v_result;
END;
$$;
