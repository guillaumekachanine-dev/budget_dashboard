-- Canonical banking balance status for a single account.
-- Distinguishes observed / estimated / projected balances without touching budget analytics.

DROP FUNCTION IF EXISTS budget_dashboard.get_account_balance_status(uuid, date);

CREATE OR REPLACE FUNCTION budget_dashboard.get_account_balance_status(
  p_account_id uuid,
  p_as_of_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  account_id uuid,
  account_name text,
  observed_balance_amount numeric,
  observed_date date,
  estimated_balance_today numeric,
  projected_balance_eom numeric,
  actual_delta_since_observed numeric,
  future_planned_delta_eom numeric,
  as_of_date date,
  month_end date,
  confidence_level text,
  source_label text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = budget_dashboard
AS $function$
DECLARE
  v_as_of_date date := COALESCE(p_as_of_date, CURRENT_DATE);
  v_month_end date := (date_trunc('month', COALESCE(p_as_of_date, CURRENT_DATE)) + interval '1 month - 1 day')::date;
BEGIN
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'p_account_id is required';
  END IF;

  RETURN QUERY
  WITH account_row AS (
    SELECT a.id, a.name
    FROM budget_dashboard.accounts a
    WHERE a.id = p_account_id
    LIMIT 1
  ),
  latest_snapshot AS (
    SELECT
      ab.account_id,
      ab.balance_amount,
      ab.observed_date,
      ab.created_at
    FROM budget_dashboard.accounts_balance ab
    WHERE ab.account_id = p_account_id
    ORDER BY ab.observed_date DESC NULLS LAST, ab.created_at DESC
    LIMIT 1
  ),
  actual_delta AS (
    SELECT
      COALESCE(SUM(COALESCE(f.banking_amount, 0)), 0)::numeric AS delta
    FROM budget_dashboard.v_flux_operations_unified f
    JOIN latest_snapshot s
      ON s.account_id = f.account_id
    WHERE f.account_id = p_account_id
      AND f.is_actual_transaction = true
      AND COALESCE(f.is_hidden, false) = false
      AND f.operation_date > s.observed_date
      AND f.operation_date <= v_as_of_date
  ),
  future_planned_delta AS (
    SELECT
      COALESCE(SUM(COALESCE(f.banking_amount, 0)), 0)::numeric AS delta
    FROM budget_dashboard.v_flux_operations_unified f
    WHERE f.account_id = p_account_id
      AND f.is_planned_occurrence = true
      AND COALESCE(f.is_matched, false) = false
      AND COALESCE(f.is_hidden, false) = false
      AND f.operation_date > v_as_of_date
      AND f.operation_date <= v_month_end
  )
  SELECT
    ar.id AS account_id,
    ar.name AS account_name,
    s.balance_amount::numeric AS observed_balance_amount,
    s.observed_date::date AS observed_date,
    CASE
      WHEN s.observed_date IS NULL THEN NULL
      ELSE (s.balance_amount + ad.delta)::numeric
    END AS estimated_balance_today,
    CASE
      WHEN s.observed_date IS NULL THEN NULL
      ELSE (s.balance_amount + ad.delta + fp.delta)::numeric
    END AS projected_balance_eom,
    CASE
      WHEN s.observed_date IS NULL THEN NULL
      ELSE ad.delta
    END AS actual_delta_since_observed,
    CASE
      WHEN s.observed_date IS NULL THEN NULL
      ELSE fp.delta
    END AS future_planned_delta_eom,
    v_as_of_date AS as_of_date,
    v_month_end AS month_end,
    CASE
      WHEN s.observed_date IS NULL THEN 'missing_snapshot'
      WHEN s.observed_date = v_as_of_date AND ad.delta = 0 THEN 'observed'
      ELSE 'estimated'
    END AS confidence_level,
    CASE
      WHEN s.observed_date IS NULL THEN 'accounts_balance (missing snapshot)'
      ELSE 'accounts_balance + v_flux_operations_unified.banking_amount'
    END AS source_label
  FROM account_row ar
  LEFT JOIN latest_snapshot s ON s.account_id = ar.id
  LEFT JOIN actual_delta ad ON true
  LEFT JOIN future_planned_delta fp ON true;
END;
$function$;

GRANT EXECUTE ON FUNCTION budget_dashboard.get_account_balance_status(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION budget_dashboard.get_account_balance_status(uuid, date) TO service_role;
