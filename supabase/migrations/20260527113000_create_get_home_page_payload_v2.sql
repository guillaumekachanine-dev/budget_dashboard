-- Unified Home payload (v2)
-- Single RPC to feed Home page financial data without frontend recomputation.
-- Scope: budget_dashboard schema only.

DROP FUNCTION IF EXISTS budget_dashboard.get_home_page_payload_v2(uuid, integer, integer);

CREATE OR REPLACE FUNCTION budget_dashboard.get_home_page_payload_v2(
  p_user_id uuid,
  p_period_year integer,
  p_period_month integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = budget_dashboard
AS $function$
DECLARE
  v_month_start date;
  v_month_end date;
  v_today date := CURRENT_DATE;
  v_effective_today date;
  v_days_remaining integer;

  v_planned_source regclass;
  v_planned_items jsonb := '[]'::jsonb;
  v_planned_count integer := 0;
  v_planned_total numeric := 0;
  v_planned_additional_commitment numeric := 0;
  v_planned_remaining_useful_impact numeric := 0;

  v_result jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  IF p_period_year IS NULL OR p_period_month IS NULL THEN
    RAISE EXCEPTION 'p_period_year and p_period_month are required';
  END IF;

  IF p_period_month < 1 OR p_period_month > 12 THEN
    RAISE EXCEPTION 'p_period_month must be between 1 and 12';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'p_user_id must match auth.uid()';
  END IF;

  v_month_start := make_date(p_period_year, p_period_month, 1);
  v_month_end := (v_month_start + interval '1 month - 1 day')::date;
  v_effective_today := LEAST(v_today, v_month_end);
  v_days_remaining := GREATEST((v_month_end - v_effective_today)::int, 0);

  -- Preferred source requested for Home planned operations.
  v_planned_source := to_regclass('budget_dashboard.v_home_planned_operations_occurrences');
  IF v_planned_source IS NULL THEN
    -- Backward-compatible fallback if renamed in an environment.
    v_planned_source := to_regclass('budget_dashboard.v_planned_operations_occurrences_enriched');
  END IF;

  IF v_planned_source IS NOT NULL THEN
    EXECUTE format(
      $sql$
      WITH planned AS (
        SELECT *
        FROM %s
        WHERE user_id = $1
          AND planned_date >= $2
          AND planned_date <= $3
      )
      SELECT
        COALESCE(jsonb_agg(to_jsonb(planned) ORDER BY planned_date, id), '[]'::jsonb) AS items,
        COUNT(*)::int AS item_count,
        COALESCE(SUM(ABS(COALESCE(planned_personal_amount, planned_amount, 0))), 0)::numeric AS total_amount,
        COALESCE(SUM(
          CASE
            WHEN budget_impact = 'additional_commitment'
            THEN ABS(COALESCE(planned_personal_amount, planned_amount, 0))
            ELSE 0
          END
        ), 0)::numeric AS additional_commitment_amount,
        COALESCE(SUM(
          CASE
            WHEN COALESCE(impacts_remaining_useful, false)
            THEN ABS(COALESCE(remaining_useful_impact_amount, planned_personal_amount, planned_amount, 0))
            ELSE 0
          END
        ), 0)::numeric AS remaining_useful_impact_amount
      FROM planned
      $sql$,
      v_planned_source::text
    )
    INTO
      v_planned_items,
      v_planned_count,
      v_planned_total,
      v_planned_additional_commitment,
      v_planned_remaining_useful_impact
    USING p_user_id, v_month_start, v_month_end;
  END IF;

  WITH
  period_ctx AS (
    SELECT
      p_user_id AS user_id,
      p_period_year AS period_year,
      p_period_month AS period_month,
      v_month_start AS month_start,
      v_month_end AS month_end,
      v_effective_today AS today,
      v_days_remaining AS days_remaining
  ),
  summary AS (
    SELECT
      s.user_id,
      s.month_start,
      s.period_year,
      s.period_month,
      COALESCE(s.total_transaction_count, 0)::bigint AS total_transaction_count,
      COALESCE(s.total_raw_operation_amount, 0)::numeric AS total_raw_operation_amount,
      COALESCE(s.pilotage_transaction_count, 0)::bigint AS pilotage_transaction_count,
      COALESCE(s.pilotage_operation_amount, 0)::numeric AS pilotage_operation_amount,
      COALESCE(s.revenue_amount, 0)::numeric AS revenue_amount,
      COALESCE(s.consumption_expense_amount, 0)::numeric AS consumption_expense_amount,
      COALESCE(s.provision_actual_amount, 0)::numeric AS provision_actual_amount,
      COALESCE(s.savings_actual_amount, 0)::numeric AS savings_actual_amount,
      COALESCE(s.out_of_pilotage_raw_amount, 0)::numeric AS out_of_pilotage_raw_amount
    FROM budget_dashboard.v_home_month_summary_snapshot s
    JOIN period_ctx p
      ON p.user_id = s.user_id
     AND p.period_year = s.period_year
     AND p.period_month = s.period_month
  ),
  bucket_rows AS (
    SELECT
      b.user_id,
      b.month_start,
      b.period_year,
      b.period_month,
      b.budget_bucket,
      COALESCE(b.budget_line_count, 0)::bigint AS budget_line_count,
      COALESCE(b.budget_amount, 0)::numeric AS budget_amount,
      COALESCE(b.transaction_count, 0)::bigint AS transaction_count,
      COALESCE(b.actual_amount, 0)::numeric AS actual_amount,
      COALESCE(b.remaining_amount, 0)::numeric AS remaining_amount,
      COALESCE(b.variance_amount, 0)::numeric AS variance_amount,
      b.variance_pct
    FROM budget_dashboard.v_home_month_bucket_snapshot b
    JOIN period_ctx p
      ON p.user_id = b.user_id
     AND p.period_year = b.period_year
     AND p.period_month = b.period_month
  ),
  category_rows AS (
    SELECT
      c.user_id,
      c.month_start,
      c.period_year,
      c.period_month,
      c.category_id,
      c.category_name,
      c.parent_category_id,
      c.parent_category_name,
      c.budget_bucket,
      COALESCE(c.budget_amount, 0)::numeric AS budget_amount,
      COALESCE(c.actual_amount, 0)::numeric AS actual_amount,
      COALESCE(c.remaining_amount, 0)::numeric AS remaining_amount,
      COALESCE(c.variance_amount, 0)::numeric AS variance_amount,
      c.variance_pct
    FROM budget_dashboard.v_home_month_category_snapshot c
    JOIN period_ctx p
      ON p.user_id = c.user_id
     AND p.period_year = c.period_year
     AND p.period_month = c.period_month
  ),
  bucket_agg AS (
    SELECT
      COALESCE(SUM(br.budget_amount) FILTER (WHERE br.budget_bucket = 'socle_fixe'), 0)::numeric AS fixed_budget_amount,
      COALESCE(SUM(br.budget_amount) FILTER (WHERE br.budget_bucket = 'variable_essentielle'), 0)::numeric AS variable_essential_budget_amount,
      COALESCE(SUM(br.budget_amount) FILTER (WHERE br.budget_bucket = 'discretionnaire'), 0)::numeric AS discretionary_budget_amount,
      COALESCE(SUM(br.budget_amount) FILTER (WHERE br.budget_bucket = 'provision'), 0)::numeric AS provision_budget_amount,
      COALESCE(SUM(br.budget_amount) FILTER (WHERE br.budget_bucket = 'voyage'), 0)::numeric AS voyage_budget_amount,
      COALESCE(SUM(br.budget_amount) FILTER (WHERE br.budget_bucket = 'epargne'), 0)::numeric AS savings_budget_amount,

      COALESCE(SUM(br.actual_amount) FILTER (WHERE br.budget_bucket = 'socle_fixe'), 0)::numeric AS fixed_actual_amount,
      COALESCE(SUM(br.actual_amount) FILTER (WHERE br.budget_bucket = 'variable_essentielle'), 0)::numeric AS variable_essential_actual_amount,
      COALESCE(SUM(br.actual_amount) FILTER (WHERE br.budget_bucket = 'discretionnaire'), 0)::numeric AS discretionary_actual_amount,
      COALESCE(SUM(br.actual_amount) FILTER (WHERE br.budget_bucket = 'provision'), 0)::numeric AS provision_actual_amount,
      COALESCE(SUM(br.actual_amount) FILTER (WHERE br.budget_bucket = 'voyage'), 0)::numeric AS voyage_actual_amount,
      COALESCE(SUM(br.actual_amount) FILTER (WHERE br.budget_bucket = 'epargne'), 0)::numeric AS savings_actual_amount,

      COALESCE(SUM(br.budget_amount), 0)::numeric AS total_budget_amount,
      COALESCE(SUM(br.actual_amount), 0)::numeric AS total_actual_amount
    FROM bucket_rows br
  ),
  travel_fallback AS (
    SELECT
      COALESCE(SUM(ABS(t.pilotage_amount)) FILTER (WHERE t.mapped_budget_bucket = 'voyage' AND t.pilotage_amount <> 0), 0)::numeric AS travel_actual_amount
    FROM budget_dashboard.v_budget_transactions_enriched t
    JOIN period_ctx p
      ON p.user_id = t.user_id
    WHERE t.transaction_date >= p.month_start
      AND t.transaction_date <= p.month_end
      AND COALESCE(t.is_hidden, false) = false
      AND t.flow_type <> 'savings'
  ),
  account_bal AS (
    SELECT
      a.id,
      a.name,
      a.account_type,
      COALESCE(ab.current_balance, 0)::numeric AS current_balance,
      CASE WHEN lower(a.name) LIKE '%joint%' THEN true ELSE false END AS is_joint_like,
      CASE WHEN lower(a.name) LIKE '%principal%' OR lower(a.name) LIKE '%courant%' THEN true ELSE false END AS is_main_like
    FROM budget_dashboard.accounts a
    LEFT JOIN budget_dashboard.account_balances ab
      ON ab.account_id = a.id
    JOIN period_ctx p
      ON p.user_id = a.user_id
    WHERE a.include_in_dashboard = true
      AND a.account_type = 'checking'
  ),
  account_selected AS (
    SELECT
      COALESCE((
        SELECT ab.id
        FROM account_bal ab
        WHERE ab.is_joint_like = false
        ORDER BY ab.is_main_like DESC, ab.name ASC
        LIMIT 1
      ), (
        SELECT ab.id
        FROM account_bal ab
        ORDER BY ab.is_main_like DESC, ab.name ASC
        LIMIT 1
      )) AS main_account_id
  ),
  account_summary AS (
    SELECT
      s.main_account_id,
      (SELECT ab.name FROM account_bal ab WHERE ab.id = s.main_account_id) AS main_account_name,
      COALESCE((SELECT ab.current_balance FROM account_bal ab WHERE ab.id = s.main_account_id), 0)::numeric AS main_account_balance,
      COALESCE((SELECT SUM(ab.current_balance) FROM account_bal ab WHERE ab.is_joint_like = true), 0)::numeric AS joint_account_balance,
      COALESCE((SELECT SUM(ab.current_balance) FROM account_bal ab), 0)::numeric AS total_checking_balance
    FROM account_selected s
  ),
  category_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'category_id', cr.category_id,
          'category_name', cr.category_name,
          'parent_category_id', cr.parent_category_id,
          'parent_category_name', cr.parent_category_name,
          'budget_bucket', cr.budget_bucket,
          'budget_amount', cr.budget_amount,
          'actual_amount', cr.actual_amount,
          'remaining_amount', cr.remaining_amount,
          'variance_amount', cr.variance_amount,
          'variance_pct', cr.variance_pct
        )
        ORDER BY cr.budget_bucket, cr.category_name
      ),
      '[]'::jsonb
    ) AS value
    FROM category_rows cr
  ),
  bucket_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'budget_bucket', br.budget_bucket,
          'budget_line_count', br.budget_line_count,
          'budget_amount', br.budget_amount,
          'transaction_count', br.transaction_count,
          'actual_amount', br.actual_amount,
          'remaining_amount', br.remaining_amount,
          'variance_amount', br.variance_amount,
          'variance_pct', br.variance_pct
        )
        ORDER BY br.budget_bucket
      ),
      '[]'::jsonb
    ) AS value
    FROM bucket_rows br
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object(
      'today', p.today,
      'month_start', p.month_start,
      'month_end', p.month_end,
      'period_year', p.period_year,
      'period_month', p.period_month,
      'days_remaining', p.days_remaining,
      'total_operations_count', COALESCE(s.total_transaction_count, 0),
      'total_operations_amount', COALESCE(s.total_raw_operation_amount, 0)
    ),
    'account', jsonb_build_object(
      'main_account_id', a.main_account_id,
      'main_account_name', a.main_account_name,
      'main_account_balance', a.main_account_balance,
      'joint_account_balance', a.joint_account_balance,
      'total_checking_balance', a.total_checking_balance
    ),
    'budgets', jsonb_build_object(
      'fixed_budget_amount', ba.fixed_budget_amount,
      'variable_essential_budget_amount', ba.variable_essential_budget_amount,
      'discretionary_budget_amount', ba.discretionary_budget_amount,
      'provision_budget_amount', ba.provision_budget_amount,
      'voyage_budget_amount', ba.voyage_budget_amount,
      'savings_budget_amount', ba.savings_budget_amount
    ),
    'realized', jsonb_build_object(
      'revenue_amount', COALESCE(s.revenue_amount, 0),
      'savings_actual_amount', COALESCE(s.savings_actual_amount, ba.savings_actual_amount, 0),
      'provision_actual_amount', COALESCE(s.provision_actual_amount, ba.provision_actual_amount, 0),
      'travel_actual_amount', GREATEST(COALESCE(ba.voyage_actual_amount, 0), COALESCE(tf.travel_actual_amount, 0)),
      'total_transaction_count', COALESCE(s.total_transaction_count, 0),
      'pilotage_operation_amount', COALESCE(s.pilotage_operation_amount, 0),
      'consumption_expense_amount', COALESCE(s.consumption_expense_amount, 0),
      'out_of_pilotage_raw_amount', COALESCE(s.out_of_pilotage_raw_amount, 0),
      'pilotage_transaction_count', COALESCE(s.pilotage_transaction_count, 0),
      'total_raw_operation_amount', COALESCE(s.total_raw_operation_amount, 0)
    ),
    'daily_pilotage', jsonb_build_object(
      'revenue_amount', COALESCE(s.revenue_amount, 0),
      'committed_amount', (
        COALESCE(ba.fixed_actual_amount, 0)
        + COALESCE(ba.variable_essential_actual_amount, 0)
        + COALESCE(ba.discretionary_actual_amount, 0)
        + COALESCE(ba.provision_actual_amount, 0)
        + GREATEST(COALESCE(ba.voyage_actual_amount, 0), COALESCE(tf.travel_actual_amount, 0))
      ),
      'remaining_useful_amount', (
        a.total_checking_balance
        - (
          COALESCE(ba.fixed_actual_amount, 0)
          + COALESCE(ba.variable_essential_actual_amount, 0)
          + COALESCE(ba.discretionary_actual_amount, 0)
          + COALESCE(ba.provision_actual_amount, 0)
          + GREATEST(COALESCE(ba.voyage_actual_amount, 0), COALESCE(tf.travel_actual_amount, 0))
          + COALESCE(v_planned_remaining_useful_impact, 0)
        )
      ),
      'budget_per_remaining_day',
        CASE
          WHEN p.days_remaining <= 0 THEN (
            a.total_checking_balance
            - (
              COALESCE(ba.fixed_actual_amount, 0)
              + COALESCE(ba.variable_essential_actual_amount, 0)
              + COALESCE(ba.discretionary_actual_amount, 0)
              + COALESCE(ba.provision_actual_amount, 0)
              + GREATEST(COALESCE(ba.voyage_actual_amount, 0), COALESCE(tf.travel_actual_amount, 0))
              + COALESCE(v_planned_remaining_useful_impact, 0)
            )
          )
          ELSE (
            a.total_checking_balance
            - (
              COALESCE(ba.fixed_actual_amount, 0)
              + COALESCE(ba.variable_essential_actual_amount, 0)
              + COALESCE(ba.discretionary_actual_amount, 0)
              + COALESCE(ba.provision_actual_amount, 0)
              + GREATEST(COALESCE(ba.voyage_actual_amount, 0), COALESCE(tf.travel_actual_amount, 0))
              + COALESCE(v_planned_remaining_useful_impact, 0)
            )
          ) / p.days_remaining
        END
    ),
    'planned_operations', jsonb_build_object(
      'count', COALESCE(v_planned_count, 0),
      'total_amount', COALESCE(v_planned_total, 0),
      'items', COALESCE(v_planned_items, '[]'::jsonb)
    ),
    'planned_operations_impact', jsonb_build_object(
      'additional_commitment_amount', COALESCE(v_planned_additional_commitment, 0),
      'remaining_useful_impact_amount', COALESCE(v_planned_remaining_useful_impact, 0)
    ),
    'totals', jsonb_build_object(
      'month_budget_total', COALESCE(ba.total_budget_amount, 0),
      'month_actual_total', COALESCE(ba.total_actual_amount, 0),
      'month_variance_amount', COALESCE(ba.total_actual_amount, 0) - COALESCE(ba.total_budget_amount, 0),
      'variable_budget_amount', COALESCE(ba.variable_essential_budget_amount, 0) + COALESCE(ba.discretionary_budget_amount, 0),
      'variable_actual_amount', COALESCE(ba.variable_essential_actual_amount, 0) + COALESCE(ba.discretionary_actual_amount, 0),
      'projected_end_of_month_expense_amount', COALESCE(ba.total_actual_amount, 0) + COALESCE(v_planned_additional_commitment, 0),
      'consumed_pct',
        CASE
          WHEN COALESCE(ba.total_budget_amount, 0) = 0 THEN 0
          ELSE ROUND((COALESCE(ba.total_actual_amount, 0) / NULLIF(ba.total_budget_amount, 0)) * 100, 2)
        END
    ),
    'by_bucket', bj.value,
    'by_category', cj.value
  )
  INTO v_result
  FROM period_ctx p
  LEFT JOIN summary s ON true
  LEFT JOIN bucket_agg ba ON true
  LEFT JOIN travel_fallback tf ON true
  LEFT JOIN account_summary a ON true
  LEFT JOIN bucket_json bj ON true
  LEFT JOIN category_json cj ON true;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$function$;

GRANT EXECUTE ON FUNCTION budget_dashboard.get_home_page_payload_v2(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION budget_dashboard.get_home_page_payload_v2(uuid, integer, integer) TO service_role;
