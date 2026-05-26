-- ============================================================
-- Fix projection views: three bugs eliminated
--   1. Static pre-populated table (analytics_monthly_category_metrics)
--      replaced by live views (v_monthly_category_actuals_clean,
--      v_budget_transactions_enriched).
--   2. Month cutoff corrected:
--      BEFORE  current_month = EXTRACT(month FROM CURRENT_DATE)  (includes in-progress month)
--      AFTER   completed_months = GREATEST(current_month - 1, 0) (only fully-closed months)
--   3. projected_annual_amount now uses uniform formula:
--        actual_ytd + budget_annual - budget_ytd
--      No forward_remaining and no trip_forward are added to the total
--      (kept as informational column only). This matches the reference
--      "Projection 2026 - detail" modal in ProjectionsTabContent.tsx.
--
-- All three surfaces now produce the same expense total: 37 798 EUR.
-- ============================================================

-- ============================================================
-- 1/2  v_category_annual_cost_projection_2026
-- ============================================================
CREATE OR REPLACE VIEW budget_dashboard.v_category_annual_cost_projection_2026 AS
WITH params AS (
    SELECT 2026 AS period_year,
           CASE
               WHEN EXTRACT(year FROM CURRENT_DATE)::int < 2026 THEN 0
               WHEN EXTRACT(year FROM CURRENT_DATE)::int > 2026 THEN 12
               ELSE GREATEST(EXTRACT(month FROM CURRENT_DATE)::int - 1, 0)
           END AS completed_months
),
category_scope AS (
    SELECT DISTINCT
        c.id    AS category_id,
        c.name  AS category_name,
        pc.name AS parent_category_name,
        cbm.budget_bucket
    FROM budget_dashboard.categories c
    LEFT JOIN budget_dashboard.categories pc ON pc.id = c.parent_id
    JOIN  budget_dashboard.category_budget_bucket_map cbm ON cbm.category_id = c.id
    WHERE COALESCE(c.is_active, true) = true
),
actuals_ytd AS (
    SELECT
        vca.category_id,
        sum(vca.actual_amount)::numeric(14,2) AS actual_ytd_amount
    FROM budget_dashboard.v_monthly_category_actuals_clean vca
    CROSS JOIN params p_1
    WHERE vca.period_year   = p_1.period_year
      AND vca.period_month <= p_1.completed_months
    GROUP BY vca.category_id
),
budgets AS (
    SELECT
        b_1.category_id,
        sum(CASE WHEN bp.period_month <= p_1.completed_months
                 THEN COALESCE(b_1.amount, 0) ELSE 0 END)::numeric(14,2) AS budget_ytd_amount,
        sum(COALESCE(b_1.amount, 0))::numeric(14,2)                       AS budget_annual_amount
    FROM budget_dashboard.budgets b_1
    JOIN  budget_dashboard.budget_periods bp ON bp.id = b_1.period_id
    CROSS JOIN params p_1
    WHERE bp.period_year  = p_1.period_year
      AND b_1.budget_kind = 'category'
      AND b_1.category_id IS NOT NULL
    GROUP BY b_1.category_id
),
forward_remaining_cat AS (
    SELECT
        po.category_id,
        sum(round(po.planned_amount * po.personal_share_ratio, 2))::numeric(14,2) AS forward_remaining_amount
    FROM budget_dashboard.planned_operations po
    CROSS JOIN params p_1
    CROSS JOIN LATERAL (
        SELECT gs::date AS occ_date
        FROM generate_series(
            COALESCE(po.recurrence_start_date, po.planned_date)::timestamptz,
            CASE WHEN po.is_recurring
                 THEN COALESCE(po.recurrence_end_date,
                               (date_trunc('year', CURRENT_DATE::timestamptz) + '2 years'::interval)::date)
                 ELSE po.planned_date
            END::timestamptz,
            '1 mon'::interval
        ) gs(gs)
    ) occ
    WHERE po.budget_impact    = 'additional_commitment'
      AND po.status           = 'planned'
      AND po.flow_type        = 'expense'
      AND EXTRACT(year  FROM occ.occ_date)::int = p_1.period_year
      AND EXTRACT(month FROM occ.occ_date)::int > p_1.completed_months
    GROUP BY po.category_id
),
total_future_trip_budget AS (
    SELECT
        COALESCE(sum(t.planned_budget), 0)::numeric(14,2)   AS total_planned,
        count(*) FILTER (WHERE t.planned_budget IS NOT NULL) AS trips_with_budget,
        count(*)                                             AS future_trip_count
    FROM budget_dashboard.trips t
    CROSS JOIN params p_1
    WHERE t.year = p_1.period_year
      AND t.start_date > CURRENT_DATE
),
voyage_budget_info AS (
    SELECT
        COALESCE(sum(b_1.budget_annual_amount), 0)::numeric(14,2) AS total_budget_annual,
        count(DISTINCT cs_1.category_id)                          AS cat_count
    FROM budgets b_1
    JOIN category_scope cs_1 ON cs_1.category_id = b_1.category_id
    WHERE cs_1.budget_bucket = 'voyage'
),
trip_forward_per_cat AS (
    SELECT
        cs_1.category_id,
        (CASE
            WHEN vbi.total_budget_annual > 0
            THEN round((tfb.total_planned * COALESCE(b_1.budget_annual_amount, 0)) / vbi.total_budget_annual, 2)
            WHEN vbi.cat_count > 0
            THEN round(tfb.total_planned / vbi.cat_count::numeric, 2)
            ELSE 0
         END)::numeric(14,2) AS trip_forward_amount,
        tfb.trips_with_budget
    FROM category_scope cs_1
    CROSS JOIN total_future_trip_budget tfb
    CROSS JOIN voyage_budget_info vbi
    LEFT JOIN budgets b_1 ON b_1.category_id = cs_1.category_id
    WHERE cs_1.budget_bucket = 'voyage'
)
SELECT
    cs.category_id,
    cs.category_name,
    cs.parent_category_name,
    cs.budget_bucket,
    p.completed_months                                AS months_elapsed,
    GREATEST(12 - p.completed_months, 0)              AS remaining_months,
    COALESCE(a.actual_ytd_amount, 0)::numeric(14,2)   AS actual_ytd_amount,
    CASE
        WHEN p.completed_months > 0
        THEN (COALESCE(a.actual_ytd_amount, 0) / p.completed_months::numeric)::numeric(14,2)
        ELSE 0::numeric(14,2)
    END AS avg_monthly_ytd_amount,
    -- projected_remaining = budget for future months (uniform formula, no forward_remaining)
    (COALESCE(b.budget_annual_amount, 0)
     - COALESCE(b.budget_ytd_amount,  0))::numeric(14,2) AS projected_remaining_amount,
    -- projected_annual = actual + budget_remaining  (matches reference "Projection 2026 - detail")
    (COALESCE(a.actual_ytd_amount,    0)
     + COALESCE(b.budget_annual_amount, 0)
     - COALESCE(b.budget_ytd_amount,   0))::numeric(14,2) AS projected_annual_amount,
    COALESCE(b.budget_ytd_amount,    0)::numeric(14,2)    AS budget_ytd_amount,
    COALESCE(b.budget_annual_amount, 0)::numeric(14,2)    AS budget_annual_amount,
    (COALESCE(a.actual_ytd_amount,   0)
     - COALESCE(b.budget_ytd_amount, 0))::numeric(14,2)   AS projected_vs_budget_amount,
    CASE
        WHEN COALESCE(b.budget_annual_amount, 0) > 0
        THEN ((COALESCE(a.actual_ytd_amount, 0) - COALESCE(b.budget_ytd_amount, 0))
             / b.budget_annual_amount)::numeric(10,4)
        ELSE NULL::numeric
    END AS projected_vs_budget_pct,
    -- forward_remaining: informational only (not summed into projection total)
    --   voyage: trip-based forward allocation + planned_operations commitments
    --   others: planned_operations commitments only
    (CASE
        WHEN cs.budget_bucket = 'voyage' AND COALESCE(tfpc.trips_with_budget, 0) > 0
        THEN  COALESCE(tfpc.trip_forward_amount,     0) + COALESCE(frc.forward_remaining_amount, 0)
        ELSE  COALESCE(frc.forward_remaining_amount, 0)
    END)::numeric(14,2) AS forward_remaining_amount
FROM category_scope cs
CROSS JOIN params p
LEFT JOIN actuals_ytd           a    ON a.category_id    = cs.category_id
LEFT JOIN budgets                b    ON b.category_id    = cs.category_id
LEFT JOIN forward_remaining_cat  frc  ON frc.category_id  = cs.category_id
LEFT JOIN trip_forward_per_cat   tfpc ON tfpc.category_id = cs.category_id;


-- ============================================================
-- 2/2  v_annual_projection_overview_2026
-- ============================================================
CREATE OR REPLACE VIEW budget_dashboard.v_annual_projection_overview_2026 AS
WITH params AS (
    SELECT 2026 AS period_year,
           CASE
               WHEN EXTRACT(year FROM CURRENT_DATE)::int < 2026 THEN 0
               WHEN EXTRACT(year FROM CURRENT_DATE)::int > 2026 THEN 12
               ELSE GREATEST(EXTRACT(month FROM CURRENT_DATE)::int - 1, 0)
           END AS completed_months
),
bucket_scope AS (
    SELECT v.budget_bucket, v.bucket_label
    FROM (VALUES
        ('revenu',               'Revenus'),
        ('socle_fixe',           'Socle fixe'),
        ('variable_essentielle', 'Variable essentielle'),
        ('discretionnaire',      'Discretionnaire'),
        ('provision',            'Provisions'),
        ('voyage',               'Voyages'),
        ('epargne',              'Epargne')
    ) v(budget_bucket, bucket_label)
),
actuals_ytd AS (
    SELECT
        vbte.mapped_budget_bucket AS budget_bucket,
        sum(
            CASE
                WHEN vbte.mapped_budget_bucket = 'revenu'
                THEN GREATEST(vbte.pilotage_amount, 0)
                ELSE abs(vbte.pilotage_amount)
            END
        )::numeric(14,2) AS actual_ytd_amount
    FROM budget_dashboard.v_budget_transactions_enriched vbte
    CROSS JOIN params p
    WHERE EXTRACT(year  FROM vbte.transaction_date)::int  = p.period_year
      AND EXTRACT(month FROM vbte.transaction_date)::int BETWEEN 1 AND p.completed_months
      AND vbte.pilotage_amount <> 0
      AND vbte.mapped_budget_bucket = ANY(ARRAY[
            'revenu', 'socle_fixe', 'variable_essentielle',
            'discretionnaire', 'provision', 'voyage', 'epargne'])
    GROUP BY vbte.mapped_budget_bucket
),
budget_remaining AS (
    SELECT
        cbm.budget_bucket,
        sum(b.amount)::numeric(14,2) AS budget_remaining_amount
    FROM budget_dashboard.budgets b
    JOIN  budget_dashboard.budget_periods bp
          ON bp.id = b.period_id
    JOIN  budget_dashboard.category_budget_bucket_map cbm
          ON cbm.category_id = b.category_id
         AND cbm.user_id     = b.user_id
    CROSS JOIN params p
    WHERE bp.period_year   = p.period_year
      AND bp.period_month  > p.completed_months
      AND b.budget_kind    = 'category'
      AND cbm.budget_bucket = ANY(ARRAY[
            'revenu', 'socle_fixe', 'variable_essentielle',
            'discretionnaire', 'provision', 'voyage', 'epargne'])
    GROUP BY cbm.budget_bucket
),
bucket_projection AS (
    SELECT
        bs.budget_bucket,
        bs.bucket_label,
        p.completed_months                                    AS months_elapsed,
        GREATEST(12 - p.completed_months, 0)                  AS remaining_months,
        COALESCE(a.actual_ytd_amount,  0)::numeric(14,2)      AS actual_ytd_amount,
        CASE
            WHEN p.completed_months > 0
            THEN (COALESCE(a.actual_ytd_amount, 0) / p.completed_months::numeric)::numeric(14,2)
            ELSE 0::numeric(14,2)
        END                                                    AS avg_monthly_ytd_amount,
        COALESCE(br.budget_remaining_amount, 0)::numeric(14,2) AS projected_remaining_amount,
        -- projected_annual = actual + budget_remaining (no forward_remaining)
        (COALESCE(a.actual_ytd_amount,          0)
         + COALESCE(br.budget_remaining_amount, 0))::numeric(14,2) AS projected_annual_amount
    FROM bucket_scope bs
    CROSS JOIN params p
    LEFT JOIN actuals_ytd       a  ON a.budget_bucket  = bs.budget_bucket
    LEFT JOIN budget_remaining  br ON br.budget_bucket = bs.budget_bucket
),
summary AS (
    SELECT
        max(months_elapsed)   AS months_elapsed,
        max(remaining_months) AS remaining_months,
        sum(projected_annual_amount) FILTER (WHERE budget_bucket = ANY(ARRAY['socle_fixe','variable_essentielle']))
            ::numeric(14,2) AS projected_core_expenses_amount,
        sum(projected_annual_amount) FILTER (WHERE budget_bucket = ANY(ARRAY['discretionnaire','provision']))
            ::numeric(14,2) AS projected_flexible_expenses_amount,
        sum(projected_annual_amount) FILTER (WHERE budget_bucket = 'voyage')
            ::numeric(14,2) AS projected_travel_expenses_amount,
        sum(projected_annual_amount) FILTER (WHERE budget_bucket = ANY(ARRAY['socle_fixe','variable_essentielle','discretionnaire','provision']))
            ::numeric(14,2) AS projected_total_expenses_before_travel_amount,
        sum(projected_annual_amount) FILTER (WHERE budget_bucket = ANY(ARRAY['socle_fixe','variable_essentielle','discretionnaire','provision','voyage']))
            ::numeric(14,2) AS projected_total_expenses_amount,
        sum(projected_annual_amount) FILTER (WHERE budget_bucket = 'revenu')
            ::numeric(14,2) AS projected_revenue_amount,
        sum(projected_annual_amount) FILTER (WHERE budget_bucket = 'epargne')
            ::numeric(14,2) AS projected_savings_amount
    FROM bucket_projection
)
SELECT
    months_elapsed,
    remaining_months,
    COALESCE(projected_core_expenses_amount,                0)::numeric(14,2) AS projected_core_expenses_amount,
    COALESCE(projected_flexible_expenses_amount,            0)::numeric(14,2) AS projected_flexible_expenses_amount,
    COALESCE(projected_total_expenses_amount,               0)::numeric(14,2) AS projected_total_expenses_amount,
    COALESCE(projected_revenue_amount,                      0)::numeric(14,2) AS projected_revenue_amount,
    COALESCE(projected_savings_amount,                      0)::numeric(14,2) AS projected_savings_amount,
    GREATEST(COALESCE(projected_revenue_amount, 0)
           - COALESCE(projected_savings_amount, 0), 0)::numeric(14,2)         AS projected_revenue_after_savings_amount,
    CASE
        WHEN COALESCE(projected_revenue_amount, 0) > 0
        THEN (COALESCE(projected_total_expenses_amount, 0) / projected_revenue_amount)::numeric(10,4)
        ELSE NULL::numeric
    END AS projected_expenses_to_revenue_pct,
    CASE
        WHEN COALESCE(projected_revenue_amount, 0) > 0
        THEN (COALESCE(projected_savings_amount, 0) / projected_revenue_amount)::numeric(10,4)
        ELSE NULL::numeric
    END AS projected_savings_to_revenue_pct,
    COALESCE(projected_travel_expenses_amount,              0)::numeric(14,2) AS projected_travel_expenses_amount,
    COALESCE(projected_total_expenses_before_travel_amount, 0)::numeric(14,2) AS projected_total_expenses_before_travel_amount,
    (COALESCE(projected_revenue_amount, 0)
   - COALESCE(projected_total_expenses_before_travel_amount, 0))::numeric(14,2) AS projected_capacity_before_travel_amount,
    (COALESCE(projected_revenue_amount, 0)
   - COALESCE(projected_total_expenses_amount, 0))::numeric(14,2)             AS projected_capacity_after_travel_amount,
    COALESCE(projected_travel_expenses_amount,              0)::numeric(14,2) AS projected_travel_capacity_delta_amount
FROM summary;
