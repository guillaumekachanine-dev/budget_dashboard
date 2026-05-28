-- Replace category-based voyage budget rows with trip-based amounts.
-- trips.planned_budget is the single source of truth for voyage budgets;
-- the old category lines (Logement voyage, Repas voyage, etc.) were causing
-- the bar chart and analytics views to show inflated monthly voyage budgets.
CREATE OR REPLACE VIEW budget_dashboard.v_monthly_bucket_budgets_clean AS
-- Non-voyage expense buckets: category-based monthly budgets (unchanged)
SELECT
    b.user_id,
    make_date(bp.period_year, bp.period_month, 1) AS month_start,
    bp.period_year,
    bp.period_month,
    cbm.budget_bucket,
    count(*) AS budget_line_count,
    round(sum(b.amount), 2) AS budget_amount
FROM budget_dashboard.budgets b
JOIN budget_dashboard.budget_periods bp ON bp.id = b.period_id AND bp.user_id = b.user_id
JOIN budget_dashboard.category_budget_bucket_map cbm ON cbm.category_id = b.category_id AND cbm.user_id = b.user_id
WHERE b.budget_kind = 'category'
  AND cbm.budget_bucket = ANY (ARRAY['socle_fixe'::text, 'variable_essentielle'::text, 'discretionnaire'::text, 'provision'::text])
GROUP BY b.user_id, bp.period_year, bp.period_month, cbm.budget_bucket

UNION ALL

-- Voyage bucket: trips.planned_budget grouped by trip start month
SELECT
    t.user_id,
    make_date(EXTRACT(year FROM t.start_date)::int, EXTRACT(month FROM t.start_date)::int, 1) AS month_start,
    EXTRACT(year FROM t.start_date)::int AS period_year,
    EXTRACT(month FROM t.start_date)::int AS period_month,
    'voyage'::text AS budget_bucket,
    count(*) AS budget_line_count,
    round(sum(t.planned_budget), 2) AS budget_amount
FROM budget_dashboard.trips t
WHERE t.planned_budget IS NOT NULL
GROUP BY t.user_id, EXTRACT(year FROM t.start_date), EXTRACT(month FROM t.start_date);
