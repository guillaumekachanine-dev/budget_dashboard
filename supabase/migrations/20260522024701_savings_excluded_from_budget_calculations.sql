-- =============================================================================
-- REGLE PERMANENTE : L'épargne n'entre JAMAIS dans les calculs de budget mensuel
--
-- Les transactions avec flow_type = 'savings' / direction = 'savings'
-- sont exclues de :
--   - la consommation mensuelle (consommé)
--   - les enveloppes budgétaires
--   - les totaux de pilotage
--   - la fonction get_budget_page_payload
--
-- L'épargne reste trackée séparément dans savings_actual_amount (informatif)
-- et dans les vues dédiées (v_savings_monthly_metrics, etc.)
-- =============================================================================


-- FIX 1: v_monthly_category_actuals_clean
CREATE OR REPLACE VIEW budget_dashboard.v_monthly_category_actuals_clean AS
SELECT vbte.user_id,
    (date_trunc('month'::text, (vbte.transaction_date)::timestamp with time zone))::date AS month_start,
    (EXTRACT(year FROM vbte.transaction_date))::integer AS period_year,
    (EXTRACT(month FROM vbte.transaction_date))::integer AS period_month,
    vbte.category_id,
    vbte.mapped_category_name AS category_name,
    vbte.mapped_parent_category_name AS parent_category_name,
    vbte.mapped_budget_bucket AS budget_bucket,
    count(*) AS transaction_count,
    round(sum(abs(vbte.pilotage_amount)), 2) AS actual_amount,
    c.parent_id AS parent_category_id,
    vbte.mapped_budget_behavior AS budget_behavior
FROM (budget_dashboard.v_budget_transactions_enriched vbte
     LEFT JOIN budget_dashboard.categories c ON ((c.id = vbte.category_id)))
WHERE (vbte.pilotage_amount <> (0)::numeric)
  AND (vbte.flow_type <> 'savings')
  AND (vbte.mapped_budget_bucket = ANY (ARRAY[
        'socle_fixe'::text, 'variable_essentielle'::text,
        'discretionnaire'::text, 'provision'::text
      ]))
GROUP BY vbte.user_id,
    ((date_trunc('month'::text, (vbte.transaction_date)::timestamp with time zone))::date),
    (EXTRACT(year FROM vbte.transaction_date)),
    (EXTRACT(month FROM vbte.transaction_date)),
    vbte.category_id, vbte.mapped_category_name, vbte.mapped_parent_category_name,
    vbte.mapped_budget_bucket, c.parent_id, vbte.mapped_budget_behavior;


-- FIX 2: v_monthly_bucket_actuals_clean
CREATE OR REPLACE VIEW budget_dashboard.v_monthly_bucket_actuals_clean AS
SELECT user_id,
    (date_trunc('month'::text, (transaction_date)::timestamp with time zone))::date AS month_start,
    mapped_budget_bucket AS budget_bucket,
    count(*) AS transaction_count,
    round(sum(CASE WHEN (mapped_budget_bucket = 'revenu'::text) THEN GREATEST(pilotage_amount, (0)::numeric) ELSE (0)::numeric END), 2) AS revenue_amount,
    round(sum(CASE WHEN (mapped_budget_bucket = ANY (ARRAY[
        'socle_fixe'::text, 'variable_essentielle'::text, 'discretionnaire'::text, 'provision'::text
    ])) THEN abs(pilotage_amount) ELSE (0)::numeric END), 2) AS expense_amount,
    round(sum(pilotage_amount), 2) AS net_amount
FROM budget_dashboard.v_budget_transactions_enriched
WHERE (mapped_budget_bucket <> 'hors_pilotage'::text)
  AND (pilotage_amount <> (0)::numeric)
  AND (flow_type <> 'savings')
GROUP BY user_id,
    ((date_trunc('month'::text, (transaction_date)::timestamp with time zone))::date),
    mapped_budget_bucket;


-- FIX 3: v_monthly_bucket_budgets_clean
CREATE OR REPLACE VIEW budget_dashboard.v_monthly_bucket_budgets_clean AS
SELECT b.user_id,
    make_date(bp.period_year, bp.period_month, 1) AS month_start,
    bp.period_year, bp.period_month, cbm.budget_bucket,
    count(*) AS budget_line_count,
    round(sum(b.amount), 2) AS budget_amount
FROM ((budget_dashboard.budgets b
     JOIN budget_dashboard.budget_periods bp ON (((bp.id = b.period_id) AND (bp.user_id = b.user_id))))
     JOIN budget_dashboard.category_budget_bucket_map cbm ON (((cbm.category_id = b.category_id) AND (cbm.user_id = b.user_id))))
WHERE (b.budget_kind = 'category'::text)
  AND (cbm.budget_bucket = ANY (ARRAY[
        'socle_fixe'::text, 'variable_essentielle'::text,
        'discretionnaire'::text, 'provision'::text
      ]))
GROUP BY b.user_id, bp.period_year, bp.period_month, cbm.budget_bucket;


-- FIX 4: budget_bucket_actuals_by_month
CREATE OR REPLACE VIEW budget_dashboard.budget_bucket_actuals_by_month AS
SELECT user_id, month_start,
    (EXTRACT(year FROM month_start))::integer AS period_year,
    (EXTRACT(month FROM month_start))::integer AS period_month,
    budget_bucket,
    expense_amount AS actual_budget_bucket_eur
FROM budget_dashboard.v_monthly_bucket_actuals_clean
WHERE (budget_bucket <> ALL (ARRAY['revenu'::text, 'hors_pilotage'::text, 'epargne'::text]));


-- FIX 5: v_home_month_bucket_snapshot
CREATE OR REPLACE VIEW budget_dashboard.v_home_month_bucket_snapshot AS
WITH bucket_list AS (
    SELECT unnest(ARRAY[
        'socle_fixe'::text, 'variable_essentielle'::text,
        'discretionnaire'::text, 'provision'::text
    ]) AS budget_bucket
), periods AS (
    SELECT DISTINCT budget_periods.user_id,
        make_date(budget_periods.period_year, budget_periods.period_month, 1) AS month_start,
        budget_periods.period_year, budget_periods.period_month
    FROM budget_dashboard.budget_periods
)
SELECT p.user_id, p.month_start, p.period_year, p.period_month, bl.budget_bucket,
    COALESCE(b.budget_line_count, (0)::bigint) AS budget_line_count,
    COALESCE(b.budget_amount, (0)::numeric) AS budget_amount,
    COALESCE(a.transaction_count, (0)::bigint) AS transaction_count,
    COALESCE(a.expense_amount, (0)::numeric) AS actual_amount,
    round((COALESCE(b.budget_amount, (0)::numeric) - COALESCE(a.expense_amount, (0)::numeric)), 2) AS remaining_amount,
    round((COALESCE(a.expense_amount, (0)::numeric) - COALESCE(b.budget_amount, (0)::numeric)), 2) AS variance_amount,
    CASE
        WHEN (COALESCE(b.budget_amount, (0)::numeric) = (0)::numeric) THEN NULL::numeric
        ELSE round(((COALESCE(a.expense_amount, (0)::numeric) - COALESCE(b.budget_amount, (0)::numeric)) / NULLIF(b.budget_amount, (0)::numeric)), 6)
    END AS variance_pct
FROM (((periods p CROSS JOIN bucket_list bl)
    LEFT JOIN budget_dashboard.v_monthly_bucket_budgets_clean b ON (((b.user_id = p.user_id) AND (b.month_start = p.month_start) AND (b.budget_bucket = bl.budget_bucket))))
    LEFT JOIN budget_dashboard.v_monthly_bucket_actuals_clean a ON (((a.user_id = p.user_id) AND (a.month_start = p.month_start) AND (a.budget_bucket = bl.budget_bucket))));


-- FIX 6: v_home_month_category_snapshot
CREATE OR REPLACE VIEW budget_dashboard.v_home_month_category_snapshot AS
WITH budget_lines AS (
    SELECT b.user_id,
        make_date(bp.period_year, bp.period_month, 1) AS month_start,
        bp.period_year, bp.period_month, b.category_id, m.category_name,
        m.parent_id AS parent_category_id, m.parent_category_name, m.budget_bucket,
        round(sum(b.amount), 2) AS budget_amount
    FROM ((budget_dashboard.budgets b
        JOIN budget_dashboard.budget_periods bp ON (((bp.id = b.period_id) AND (bp.user_id = b.user_id))))
        JOIN budget_dashboard.v_category_budget_mapping m ON (((m.category_id = b.category_id) AND (m.user_id = b.user_id))))
    WHERE (b.budget_kind = 'category'::text)
      AND (m.budget_bucket = ANY (ARRAY[
            'socle_fixe'::text, 'variable_essentielle'::text,
            'discretionnaire'::text, 'provision'::text
          ]))
    GROUP BY b.user_id, bp.period_year, bp.period_month, b.category_id,
        m.category_name, m.parent_id, m.parent_category_name, m.budget_bucket
), actual_lines AS (
    SELECT user_id, month_start, period_year, period_month, category_id,
        category_name, parent_category_name, budget_bucket, actual_amount
    FROM budget_dashboard.v_monthly_category_actuals_clean
), merged AS (
    SELECT
        COALESCE(b.user_id, a.user_id) AS user_id,
        COALESCE(b.month_start, a.month_start) AS month_start,
        COALESCE(b.period_year, a.period_year) AS period_year,
        COALESCE(b.period_month, a.period_month) AS period_month,
        COALESCE(b.category_id, a.category_id) AS category_id,
        COALESCE(b.category_name, a.category_name) AS category_name,
        b.parent_category_id,
        COALESCE(b.parent_category_name, a.parent_category_name) AS parent_category_name,
        COALESCE(b.budget_bucket, a.budget_bucket) AS budget_bucket,
        COALESCE(b.budget_amount, (0)::numeric) AS budget_amount,
        COALESCE(a.actual_amount, (0)::numeric) AS actual_amount
    FROM (budget_lines b FULL JOIN actual_lines a ON (((a.user_id = b.user_id) AND (a.month_start = b.month_start) AND (a.category_id = b.category_id))))
)
SELECT user_id, month_start, period_year, period_month, category_id, category_name,
    parent_category_id, parent_category_name, budget_bucket, budget_amount, actual_amount,
    round((budget_amount - actual_amount), 2) AS remaining_amount,
    round((actual_amount - budget_amount), 2) AS variance_amount,
    CASE
        WHEN (budget_amount = (0)::numeric) THEN NULL::numeric
        ELSE round(((actual_amount - budget_amount) / NULLIF(budget_amount, (0)::numeric)), 6)
    END AS variance_pct
FROM merged
WHERE (budget_bucket = ANY (ARRAY[
    'socle_fixe'::text, 'variable_essentielle'::text,
    'discretionnaire'::text, 'provision'::text
]));


-- FIX 7: v_home_month_summary_snapshot
CREATE OR REPLACE VIEW budget_dashboard.v_home_month_summary_snapshot AS
SELECT user_id,
    (date_trunc('month'::text, (transaction_date)::timestamp with time zone))::date AS month_start,
    (EXTRACT(year FROM transaction_date))::integer AS period_year,
    (EXTRACT(month FROM transaction_date))::integer AS period_month,
    count(*) FILTER (WHERE (COALESCE(is_hidden, false) = false)) AS total_transaction_count,
    round(sum(abs(amount)) FILTER (WHERE (COALESCE(is_hidden, false) = false)), 2) AS total_raw_operation_amount,
    count(*) FILTER (WHERE (pilotage_amount <> (0)::numeric)
                       AND (mapped_budget_bucket <> 'hors_pilotage'::text)
                       AND (flow_type <> 'savings'::text)) AS pilotage_transaction_count,
    round(sum(abs(pilotage_amount)) FILTER (WHERE (pilotage_amount <> (0)::numeric)
                                              AND (mapped_budget_bucket <> 'hors_pilotage'::text)
                                              AND (flow_type <> 'savings'::text)), 2) AS pilotage_operation_amount,
    round(sum(pilotage_amount) FILTER (WHERE (mapped_budget_bucket = 'revenu'::text)), 2) AS revenue_amount,
    round(sum(abs(pilotage_amount)) FILTER (WHERE (mapped_budget_bucket = ANY (ARRAY['socle_fixe'::text, 'variable_essentielle'::text, 'discretionnaire'::text]))), 2) AS consumption_expense_amount,
    round(sum(abs(pilotage_amount)) FILTER (WHERE (mapped_budget_bucket = 'provision'::text)), 2) AS provision_actual_amount,
    round(sum(abs(pilotage_amount)) FILTER (WHERE (mapped_budget_bucket = 'epargne'::text)), 2) AS savings_actual_amount,
    round(sum(abs(amount)) FILTER (WHERE (mapped_budget_bucket = 'hors_pilotage'::text)), 2) AS out_of_pilotage_raw_amount
FROM budget_dashboard.v_budget_transactions_enriched t
GROUP BY user_id,
    ((date_trunc('month'::text, (transaction_date)::timestamp with time zone))::date),
    (EXTRACT(year FROM transaction_date)),
    (EXTRACT(month FROM transaction_date));


-- FIX 8: get_budget_page_payload
DROP FUNCTION IF EXISTS budget_dashboard.get_budget_page_payload(uuid, integer, integer, integer);

CREATE FUNCTION budget_dashboard.get_budget_page_payload(
  p_user_id uuid,
  p_period_year integer,
  p_period_month integer,
  p_months_back integer DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  v_selected_month_start date;
  v_months_back int;
  v_period_label text;
  v_payload jsonb;
begin
  if p_user_id is null then raise exception 'p_user_id is required'; end if;
  if p_period_year is null or p_period_month is null then raise exception 'p_period_year and p_period_month are required'; end if;
  if p_period_month < 1 or p_period_month > 12 then raise exception 'p_period_month must be between 1 and 12'; end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then raise exception 'p_user_id must match auth.uid()'; end if;

  v_selected_month_start := make_date(p_period_year, p_period_month, 1);
  v_months_back := greatest(coalesce(p_months_back, 6), 1);

  select bp.label into v_period_label
  from budget_dashboard.budget_periods bp
  where bp.user_id = p_user_id and bp.period_year = p_period_year and bp.period_month = p_period_month
  order by bp.created_at desc limit 1;

  with
  selected_period as (
    select p_user_id as user_id, p_period_year as period_year, p_period_month as period_month,
      v_selected_month_start as month_start, v_months_back as months_back,
      coalesce(v_period_label, to_char(v_selected_month_start, 'YYYY-MM')) as label
  ),
  -- REGLE: seuls les 4 buckets de pilotage, jamais 'epargne'
  bucket_list as (
    select 'socle_fixe'::text as budget_bucket
    union all select 'variable_essentielle'::text
    union all select 'provision'::text
    union all select 'discretionnaire'::text
  ),
  window_months as (
    select (sp.month_start - make_interval(months => gs.month_offset))::date as month_start
    from selected_period sp cross join lateral generate_series(0, sp.months_back - 1) as gs(month_offset)
  ),
  window_periods as (
    select wm.month_start, extract(year from wm.month_start)::int as period_year, extract(month from wm.month_start)::int as period_month
    from window_months wm
  ),
  bucket_map as (
    select cbm.category_id, min(cbm.budget_bucket)::text as budget_bucket
    from budget_dashboard.category_budget_bucket_map cbm join bucket_list bl on bl.budget_bucket = cbm.budget_bucket
    group by cbm.category_id
  ),
  -- REGLE: flow_type = 'expense' uniquement, jamais de categories d'epargne
  mapped_categories as (
    select c.id as category_id, c.name as category_name, c.parent_id as parent_category_id,
      pc.name as parent_category_name, bm.budget_bucket
    from budget_dashboard.categories c
    left join budget_dashboard.categories pc on pc.id = c.parent_id
    join bucket_map bm on bm.category_id = c.id
    join selected_period sp on sp.user_id = c.user_id
    where c.flow_type = 'expense'
  ),
  actual_monthly_category_raw as (
    select vmca.period_year, vmca.period_month, vmca.category_id, sum(vmca.actual_amount)::numeric as actual_amount
    from budget_dashboard.v_monthly_category_actuals_clean vmca
    join window_periods wp on wp.period_year = vmca.period_year and wp.period_month = vmca.period_month
    join mapped_categories mc on mc.category_id = vmca.category_id
    where vmca.user_id = p_user_id
    group by vmca.period_year, vmca.period_month, vmca.category_id
  ),
  budget_monthly_category_raw as (
    select bp.period_year, bp.period_month, b.category_id, sum(b.amount)::numeric as budget_amount
    from budget_dashboard.budgets b
    join budget_dashboard.budget_periods bp on bp.id = b.period_id
    join selected_period sp on sp.user_id = b.user_id and sp.user_id = bp.user_id
    join window_periods wp on wp.period_year = bp.period_year and wp.period_month = bp.period_month
    join mapped_categories mc on mc.category_id = b.category_id
    where b.budget_kind = 'category'
    group by bp.period_year, bp.period_month, b.category_id
  ),
  actual_available_months as (
    select distinct wp.period_year, wp.period_month from window_periods wp
    where exists (
      select 1 from budget_dashboard.v_monthly_category_actuals_clean vmca
      where vmca.user_id = p_user_id and vmca.period_year = wp.period_year and vmca.period_month = wp.period_month
    )
  ),
  budget_available_months as (
    select bcr.period_year, bcr.period_month from budget_monthly_category_raw bcr group by bcr.period_year, bcr.period_month
  ),
  actual_month_count as (select count(*)::numeric as month_count from actual_available_months),
  budget_month_count as (select count(*)::numeric as month_count from budget_available_months),
  selected_actual_by_category as (
    select amcr.category_id, sum(amcr.actual_amount)::numeric as actual_amount
    from actual_monthly_category_raw amcr join selected_period sp on sp.period_year = amcr.period_year and sp.period_month = amcr.period_month
    group by amcr.category_id
  ),
  selected_budget_by_category as (
    select bmcr.category_id, sum(bmcr.budget_amount)::numeric as budget_amount
    from budget_monthly_category_raw bmcr join selected_period sp on sp.period_year = bmcr.period_year and sp.period_month = bmcr.period_month
    group by bmcr.category_id
  ),
  selected_category_rows as (
    select mc.category_id, mc.category_name, mc.parent_category_id, mc.parent_category_name, mc.budget_bucket,
      coalesce(sac.actual_amount, 0)::numeric as actual_amount, coalesce(sbc.budget_amount, 0)::numeric as budget_amount
    from mapped_categories mc
    left join selected_actual_by_category sac on sac.category_id = mc.category_id
    left join selected_budget_by_category sbc on sbc.category_id = mc.category_id
    where coalesce(sac.actual_amount, 0) <> 0 or coalesce(sbc.budget_amount, 0) <> 0
  ),
  selected_totals as (
    select coalesce(sum(scr.actual_amount), 0)::numeric as total_actual_amount, coalesce(sum(scr.budget_amount), 0)::numeric as total_budget_amount
    from selected_category_rows scr
  ),
  category_actual_6m_sum as (
    select mc.category_id, coalesce(sum(coalesce(amcr.actual_amount, 0)), 0)::numeric as sum_actual_6m
    from mapped_categories mc left join actual_available_months aam on true
    left join actual_monthly_category_raw amcr on amcr.category_id = mc.category_id and amcr.period_year = aam.period_year and amcr.period_month = aam.period_month
    group by mc.category_id
  ),
  category_budget_6m_sum as (
    select mc.category_id, coalesce(sum(coalesce(bmcr.budget_amount, 0)), 0)::numeric as sum_budget_6m
    from mapped_categories mc left join budget_available_months bam on true
    left join budget_monthly_category_raw bmcr on bmcr.category_id = mc.category_id and bmcr.period_year = bam.period_year and bmcr.period_month = bam.period_month
    group by mc.category_id
  ),
  by_category_rows as (
    select scr.category_id, scr.category_name, scr.parent_category_id, scr.parent_category_name, scr.budget_bucket,
      scr.actual_amount, scr.budget_amount,
      (scr.actual_amount - scr.budget_amount)::numeric as variance_amount,
      case when scr.budget_amount = 0 then null else (scr.actual_amount - scr.budget_amount) / scr.budget_amount end as variance_pct,
      case when st.total_actual_amount = 0 then null else scr.actual_amount / st.total_actual_amount end as share_actual_pct,
      case when st.total_budget_amount = 0 then null else scr.budget_amount / st.total_budget_amount end as share_budget_pct,
      case when amc.month_count = 0 then 0::numeric else cas6.sum_actual_6m / amc.month_count end as avg_actual_last_6m,
      case when bmc.month_count = 0 then 0::numeric else cbs6.sum_budget_6m / bmc.month_count end as avg_budget_last_6m,
      case when cbs6.sum_budget_6m = 0 then null else (cas6.sum_actual_6m - cbs6.sum_budget_6m) / cbs6.sum_budget_6m end as avg_variance_pct_last_6m
    from selected_category_rows scr cross join selected_totals st cross join actual_month_count amc cross join budget_month_count bmc
    left join category_actual_6m_sum cas6 on cas6.category_id = scr.category_id
    left join category_budget_6m_sum cbs6 on cbs6.category_id = scr.category_id
  ),
  by_parent_rows as (
    select coalesce(bcr.parent_category_id, bcr.category_id) as parent_category_id,
      coalesce(bcr.parent_category_name, bcr.category_name, 'Sans catégorie') as parent_category_name,
      coalesce(sum(bcr.actual_amount), 0)::numeric as actual_amount, coalesce(sum(bcr.budget_amount), 0)::numeric as budget_amount,
      coalesce(sum(bcr.avg_actual_last_6m), 0)::numeric as avg_actual_last_6m, coalesce(sum(bcr.avg_budget_last_6m), 0)::numeric as avg_budget_last_6m,
      coalesce(sum(cas6.sum_actual_6m), 0)::numeric as sum_actual_6m, coalesce(sum(cbs6.sum_budget_6m), 0)::numeric as sum_budget_6m
    from by_category_rows bcr
    left join category_actual_6m_sum cas6 on cas6.category_id = bcr.category_id
    left join category_budget_6m_sum cbs6 on cbs6.category_id = bcr.category_id
    group by 1, 2
  ),
  by_bucket_selected as (
    select bl.budget_bucket, coalesce(sum(scr.actual_amount), 0)::numeric as actual_amount, coalesce(sum(scr.budget_amount), 0)::numeric as budget_amount
    from bucket_list bl left join selected_category_rows scr on scr.budget_bucket = bl.budget_bucket group by bl.budget_bucket
  ),
  bucket_actual_6m_sum as (
    select bl.budget_bucket, coalesce(sum(coalesce(ambr.actual_amount, 0)), 0)::numeric as sum_actual_6m
    from bucket_list bl left join actual_available_months aam on true
    left join (
      select amcr.period_year, amcr.period_month, mc.budget_bucket, sum(amcr.actual_amount)::numeric as actual_amount
      from actual_monthly_category_raw amcr join mapped_categories mc on mc.category_id = amcr.category_id
      group by amcr.period_year, amcr.period_month, mc.budget_bucket
    ) ambr on ambr.budget_bucket = bl.budget_bucket and ambr.period_year = aam.period_year and ambr.period_month = aam.period_month
    group by bl.budget_bucket
  ),
  bucket_budget_6m_sum as (
    select bl.budget_bucket, coalesce(sum(coalesce(bmbr.budget_amount, 0)), 0)::numeric as sum_budget_6m
    from bucket_list bl left join budget_available_months bam on true
    left join (
      select bmcr.period_year, bmcr.period_month, mc.budget_bucket, sum(bmcr.budget_amount)::numeric as budget_amount
      from budget_monthly_category_raw bmcr join mapped_categories mc on mc.category_id = bmcr.category_id
      group by bmcr.period_year, bmcr.period_month, mc.budget_bucket
    ) bmbr on bmbr.budget_bucket = bl.budget_bucket and bmbr.period_year = bam.period_year and bmbr.period_month = bam.period_month
    group by bl.budget_bucket
  ),
  by_bucket_rows as (
    select bbs.budget_bucket, bbs.actual_amount, bbs.budget_amount,
      (bbs.actual_amount - bbs.budget_amount)::numeric as variance_amount,
      case when bbs.budget_amount = 0 then null else (bbs.actual_amount - bbs.budget_amount) / bbs.budget_amount end as variance_pct,
      case when st.total_actual_amount = 0 then null else bbs.actual_amount / st.total_actual_amount end as share_actual_pct,
      case when st.total_budget_amount = 0 then null else bbs.budget_amount / st.total_budget_amount end as share_budget_pct,
      case when amc.month_count = 0 then 0::numeric else bas6.sum_actual_6m / amc.month_count end as avg_actual_last_6m,
      case when bmc.month_count = 0 then 0::numeric else bbs6.sum_budget_6m / bmc.month_count end as avg_budget_last_6m,
      case when bbs6.sum_budget_6m = 0 then null else (bas6.sum_actual_6m - bbs6.sum_budget_6m) / bbs6.sum_budget_6m end as avg_variance_pct_last_6m
    from by_bucket_selected bbs cross join selected_totals st cross join actual_month_count amc cross join budget_month_count bmc
    left join bucket_actual_6m_sum bas6 on bas6.budget_bucket = bbs.budget_bucket
    left join bucket_budget_6m_sum bbs6 on bbs6.budget_bucket = bbs.budget_bucket
  ),
  actual_monthly_total_raw as (
    select amcr.period_year, amcr.period_month, sum(amcr.actual_amount)::numeric as actual_total
    from actual_monthly_category_raw amcr group by amcr.period_year, amcr.period_month
  ),
  budget_monthly_total_raw as (
    select bmcr.period_year, bmcr.period_month, sum(bmcr.budget_amount)::numeric as budget_total
    from budget_monthly_category_raw bmcr group by bmcr.period_year, bmcr.period_month
  ),
  history_months as (
    select sp.period_year, sp.period_month from selected_period sp
    union select aam.period_year, aam.period_month from actual_available_months aam
    union select bam.period_year, bam.period_month from budget_available_months bam
  ),
  history_rows as (
    select hm.period_year, hm.period_month,
      coalesce(amtr.actual_total, 0)::numeric as actual_total, coalesce(bmtr.budget_total, 0)::numeric as budget_total,
      (coalesce(amtr.actual_total, 0) - coalesce(bmtr.budget_total, 0))::numeric as variance_amount,
      case when coalesce(bmtr.budget_total, 0) = 0 then null else (coalesce(amtr.actual_total, 0) - coalesce(bmtr.budget_total, 0)) / bmtr.budget_total end as variance_pct
    from history_months hm
    left join actual_monthly_total_raw amtr on amtr.period_year = hm.period_year and amtr.period_month = hm.period_month
    left join budget_monthly_total_raw bmtr on bmtr.period_year = hm.period_year and bmtr.period_month = hm.period_month
  ),
  history_totals as (
    select coalesce(sum(hr.actual_total), 0)::numeric as sum_actual_6m, coalesce(sum(hr.budget_total), 0)::numeric as sum_budget_6m
    from history_rows hr
  ),
  summary_row as (
    select st.total_actual_amount as actual_total_to_date, st.total_budget_amount as budget_total_reference,
      (st.total_actual_amount - st.total_budget_amount)::numeric as variance_amount,
      case when st.total_budget_amount = 0 then null else (st.total_actual_amount - st.total_budget_amount) / st.total_budget_amount end as variance_pct,
      case when amc.month_count = 0 then 0::numeric else ht.sum_actual_6m / amc.month_count end as avg_actual_last_6m,
      case when bmc.month_count = 0 then 0::numeric else ht.sum_budget_6m / bmc.month_count end as avg_budget_last_6m,
      case when ht.sum_budget_6m = 0 then null else (ht.sum_actual_6m - ht.sum_budget_6m) / ht.sum_budget_6m end as avg_variance_pct_last_6m
    from selected_totals st cross join actual_month_count amc cross join budget_month_count bmc cross join history_totals ht
  )
  select jsonb_build_object(
    'selected_period', jsonb_build_object('period_year', sp.period_year, 'period_month', sp.period_month, 'label', sp.label),
    'summary', jsonb_build_object(
      'actual_total_to_date', sr.actual_total_to_date, 'budget_total_reference', sr.budget_total_reference,
      'variance_amount', sr.variance_amount, 'variance_pct', sr.variance_pct,
      'avg_actual_last_6m', sr.avg_actual_last_6m, 'avg_budget_last_6m', sr.avg_budget_last_6m,
      'avg_variance_pct_last_6m', sr.avg_variance_pct_last_6m
    ),
    'by_bucket', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'budget_bucket', bbr.budget_bucket, 'actual_amount', bbr.actual_amount, 'budget_amount', bbr.budget_amount,
          'variance_amount', bbr.variance_amount, 'variance_pct', bbr.variance_pct,
          'share_actual_pct', bbr.share_actual_pct, 'share_budget_pct', bbr.share_budget_pct,
          'avg_actual_last_6m', bbr.avg_actual_last_6m, 'avg_budget_last_6m', bbr.avg_budget_last_6m,
          'avg_variance_pct_last_6m', bbr.avg_variance_pct_last_6m
        ) order by bbr.budget_amount desc, bbr.budget_bucket) from by_bucket_rows bbr),
      '[]'::jsonb
    ),
    'by_parent_category', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'parent_category_id', bpr.parent_category_id, 'parent_category_name', bpr.parent_category_name,
          'actual_amount', bpr.actual_amount, 'budget_amount', bpr.budget_amount,
          'variance_amount', bpr.actual_amount - bpr.budget_amount,
          'variance_pct', case when bpr.budget_amount = 0 then null else (bpr.actual_amount - bpr.budget_amount) / bpr.budget_amount end,
          'share_actual_pct', case when st.total_actual_amount = 0 then null else bpr.actual_amount / st.total_actual_amount end,
          'share_budget_pct', case when st.total_budget_amount = 0 then null else bpr.budget_amount / st.total_budget_amount end,
          'avg_actual_last_6m', bpr.avg_actual_last_6m, 'avg_budget_last_6m', bpr.avg_budget_last_6m,
          'avg_variance_pct_last_6m', case when bpr.sum_budget_6m = 0 then null else (bpr.sum_actual_6m - bpr.sum_budget_6m) / bpr.sum_budget_6m end
        ) order by bpr.budget_amount desc, bpr.parent_category_name) from by_parent_rows bpr cross join selected_totals st),
      '[]'::jsonb
    ),
    'by_category', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'category_id', bcr.category_id, 'category_name', bcr.category_name,
          'parent_category_id', bcr.parent_category_id, 'parent_category_name', bcr.parent_category_name,
          'budget_bucket', bcr.budget_bucket, 'actual_amount', bcr.actual_amount, 'budget_amount', bcr.budget_amount,
          'variance_amount', bcr.variance_amount, 'variance_pct', bcr.variance_pct,
          'share_actual_pct', bcr.share_actual_pct, 'share_budget_pct', bcr.share_budget_pct,
          'avg_actual_last_6m', bcr.avg_actual_last_6m, 'avg_budget_last_6m', bcr.avg_budget_last_6m,
          'avg_variance_pct_last_6m', bcr.avg_variance_pct_last_6m
        ) order by bcr.budget_amount desc, bcr.category_name) from by_category_rows bcr),
      '[]'::jsonb
    ),
    'history_last_6m', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'period_year', hr.period_year, 'period_month', hr.period_month,
          'actual_total', hr.actual_total, 'budget_total', hr.budget_total,
          'variance_amount', hr.variance_amount, 'variance_pct', hr.variance_pct
        ) order by hr.period_year, hr.period_month) from history_rows hr),
      '[]'::jsonb
    )
  )
  into v_payload
  from selected_period sp cross join summary_row sr;

  return v_payload;
end;
$$;
