-- Stats reference data — single RPC replacing N×7 client-side queries
--
-- Before: for each usable period (N), 7 parallel Supabase requests fired + 1 per period
--         to resolve the period id from budget_periods → N*8 + 2 round-trips total
-- After:  1 RPC call, all aggregation done server-side as a single query plan
--
-- Source tables / views (all in schema budget_dashboard):
--   budget_bucket_totals_by_period         (has user_id)
--   budget_periods                          (has user_id)
--   budgets                                 (has user_id, joined via period_id)
--   categories                              (shared / flow_type filter)
--   budget_bucket_budget_vs_actual_by_month (view, scoped via period join)
--   savings_budget_totals_by_period         (view, scoped via period join)
--   savings_budget_lines_by_period          (view, scoped via period join)
--   savings_budget_vs_actual_by_period      (view, scoped via period join)
--   v_monthly_metrics_clean                 (view, filtered by period_year)

create or replace function budget_dashboard.get_stats_reference_data(
  p_user_id uuid,
  p_year    int default 2026
)
returns jsonb
language plpgsql
stable
security definer
set search_path = budget_dashboard, public
as $$
declare
  v_result jsonb;
begin
  -- Guard: user_id required and must match the JWT caller
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'p_user_id must match auth.uid()';
  end if;

  with

  -- ── 1. Usable periods for this user+year ─────────────────────────────────
  -- Anchor on budget_bucket_totals_by_period which is confirmed to carry user_id.
  -- DISTINCT because the view may have one row per bucket per period.
  usable_periods as (
    select distinct
      period_year,
      period_month
    from budget_dashboard.budget_bucket_totals_by_period
    where user_id   = p_user_id
      and period_year = p_year
  ),

  -- ── 2. Resolve period id + label from budget_periods ─────────────────────
  -- budget_periods has user_id; we restrict to our usable set.
  periods_resolved as (
    select
      bp.id,
      up.period_year,
      up.period_month,
      bp.label
    from usable_periods up
    left join budget_dashboard.budget_periods bp
      on  bp.period_year  = up.period_year
      and bp.period_month = up.period_month
      and bp.user_id      = p_user_id
  ),

  -- ── 3. Budget bucket totals (one JSON array per period) ───────────────────
  bucket_totals_agg as (
    select
      period_year,
      period_month,
      jsonb_agg(
        jsonb_build_object(
          'budget_bucket',           budget_bucket,
          'total_budget_bucket_eur', total_budget_bucket_eur,
          'period_year',             period_year,
          'period_month',            period_month
        )
      ) as rows
    from budget_dashboard.budget_bucket_totals_by_period
    where user_id    = p_user_id
      and period_year = p_year
    group by period_year, period_month
  ),

  -- ── 4+5. Global-variable budget + total expense budget per period ─────────
  -- Single pass over budgets (joined with categories for expense filter).
  -- We do both in one CTE to avoid scanning budgets twice.
  budget_totals_agg as (
    select
      pr.period_year,
      pr.period_month,
      coalesce(
        sum(b.amount) filter (where b.budget_kind = 'global_variable'),
        0
      ) as global_variable_budget,
      coalesce(
        sum(b.amount) filter (
          where b.budget_kind = 'category'
            and c.flow_type   = 'expense'
        ),
        0
      ) as total_expense_budget
    from periods_resolved pr
    left join budget_dashboard.budgets b
      on  b.period_id  = pr.id
      and b.budget_kind in ('global_variable', 'category')
    left join budget_dashboard.categories c
      on  c.id = b.category_id
      and b.budget_kind = 'category'
    where pr.id is not null
    group by pr.period_year, pr.period_month
  ),

  -- ── 6. Budget bucket vs actual per period ─────────────────────────────────
  -- View scoped via inner join on user-owned periods.
  bva_agg as (
    select
      pr.period_year,
      pr.period_month,
      jsonb_agg(to_jsonb(t.*)) as rows
    from periods_resolved pr
    join budget_dashboard.budget_bucket_budget_vs_actual_by_month t
      on  t.period_year  = pr.period_year
      and t.period_month = pr.period_month
    group by pr.period_year, pr.period_month
  ),

  -- ── 7. Savings budget totals per period ────────────────────────────────────
  savings_totals_agg as (
    select
      pr.period_year,
      pr.period_month,
      jsonb_agg(to_jsonb(t.*)) as rows
    from periods_resolved pr
    join budget_dashboard.savings_budget_totals_by_period t
      on  t.period_year  = pr.period_year
      and t.period_month = pr.period_month
    group by pr.period_year, pr.period_month
  ),

  -- ── 8. Savings budget lines per period ─────────────────────────────────────
  savings_lines_agg as (
    select
      pr.period_year,
      pr.period_month,
      jsonb_agg(to_jsonb(t.*)) as rows
    from periods_resolved pr
    join budget_dashboard.savings_budget_lines_by_period t
      on  t.period_year  = pr.period_year
      and t.period_month = pr.period_month
    group by pr.period_year, pr.period_month
  ),

  -- ── 9. Savings budget vs actual per period ──────────────────────────────────
  savings_vs_actual_agg as (
    select
      pr.period_year,
      pr.period_month,
      jsonb_agg(to_jsonb(t.*)) as rows
    from periods_resolved pr
    join budget_dashboard.savings_budget_vs_actual_by_period t
      on  t.period_year  = pr.period_year
      and t.period_month = pr.period_month
    group by pr.period_year, pr.period_month
  ),

  -- ── 10. Monthly evolution (v_monthly_metrics_clean) ─────────────────────────
  monthly_evolution_agg as (
    select
      jsonb_agg(
        jsonb_build_object(
          'month_start',               month_start::text,
          'period_year',               period_year,
          'period_month',              period_month,
          'variable_expense_total',    variable_expense_total,
          'fixed_expense_total',       fixed_expense_total,
          'expense_total',             expense_total,
          'income_total',              income_total,
          'savings_capacity_observed', savings_capacity_observed
        )
        order by period_month
      ) as rows
    from budget_dashboard.v_monthly_metrics_clean
    where period_year = p_year
  ),

  -- ── Assemble per-period JSON objects ────────────────────────────────────────
  period_data as (
    select
      jsonb_build_object(
        'id',                      pr.id,
        'period_year',             pr.period_year,
        'period_month',            pr.period_month,
        'label',                   pr.label,
        'budget_bucket_totals',    coalesce(bt.rows,  '[]'::jsonb),
        'global_variable_budget',  coalesce(bta.global_variable_budget, 0),
        'total_expense_budget',    coalesce(bta.total_expense_budget,   0),
        'budget_bucket_vs_actual', coalesce(bva.rows, '[]'::jsonb),
        'savings_budget_totals',   coalesce(st.rows,  '[]'::jsonb),
        'savings_budget_lines',    coalesce(sl.rows,  '[]'::jsonb),
        'savings_budget_vs_actual',coalesce(sva.rows, '[]'::jsonb)
      ) as period_json
    from periods_resolved pr
    left join bucket_totals_agg  bt  using (period_year, period_month)
    left join budget_totals_agg  bta using (period_year, period_month)
    left join bva_agg            bva using (period_year, period_month)
    left join savings_totals_agg st  using (period_year, period_month)
    left join savings_lines_agg  sl  using (period_year, period_month)
    left join savings_vs_actual_agg sva using (period_year, period_month)
  )

  select jsonb_build_object(
    'periods',
    coalesce(
      (
        select jsonb_agg(period_json order by
          (period_json->>'period_year')::int,
          (period_json->>'period_month')::int
        )
        from period_data
      ),
      '[]'::jsonb
    ),
    'monthly_evolution',
    coalesce(
      (select rows from monthly_evolution_agg),
      '[]'::jsonb
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- Grant execute to the anon + authenticated roles (mirrors existing RPCs)
grant execute on function budget_dashboard.get_stats_reference_data(uuid, int)
  to anon, authenticated;
