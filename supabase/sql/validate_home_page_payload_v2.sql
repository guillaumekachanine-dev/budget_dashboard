-- Validation script for budget_dashboard.get_home_page_payload_v2
-- Replace values in params CTE before running.

WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS user_id,
    2026::int AS period_year,
    5::int AS period_month
),
payload AS (
  SELECT budget_dashboard.get_home_page_payload_v2(p.user_id, p.period_year, p.period_month) AS data
  FROM params p
),
summary_src AS (
  SELECT s.*
  FROM budget_dashboard.v_home_month_summary_snapshot s
  JOIN params p
    ON p.user_id = s.user_id
   AND p.period_year = s.period_year
   AND p.period_month = s.period_month
),
buckets_src AS (
  SELECT b.*
  FROM budget_dashboard.v_home_month_bucket_snapshot b
  JOIN params p
    ON p.user_id = b.user_id
   AND p.period_year = b.period_year
   AND p.period_month = b.period_month
),
planned_src AS (
  SELECT po.*
  FROM budget_dashboard.v_home_planned_operations_occurrences po
  JOIN params p
    ON p.user_id = po.user_id
  WHERE po.planned_date >= make_date(p.period_year, p.period_month, 1)
    AND po.planned_date <= (make_date(p.period_year, p.period_month, 1) + interval '1 month - 1 day')::date
)
SELECT
  'revenue_amount' AS metric,
  COALESCE((SELECT revenue_amount FROM summary_src), 0)::numeric AS source_value,
  COALESCE(((SELECT data FROM payload)->'realized'->>'revenue_amount')::numeric, 0) AS payload_value,
  COALESCE(((SELECT data FROM payload)->'realized'->>'revenue_amount')::numeric, 0)
    - COALESCE((SELECT revenue_amount FROM summary_src), 0)::numeric AS diff
UNION ALL
SELECT
  'provision_actual_amount',
  COALESCE((SELECT provision_actual_amount FROM summary_src), 0)::numeric,
  COALESCE(((SELECT data FROM payload)->'realized'->>'provision_actual_amount')::numeric, 0),
  COALESCE(((SELECT data FROM payload)->'realized'->>'provision_actual_amount')::numeric, 0)
    - COALESCE((SELECT provision_actual_amount FROM summary_src), 0)::numeric
UNION ALL
SELECT
  'savings_actual_amount',
  COALESCE((SELECT savings_actual_amount FROM summary_src), 0)::numeric,
  COALESCE(((SELECT data FROM payload)->'realized'->>'savings_actual_amount')::numeric, 0),
  COALESCE(((SELECT data FROM payload)->'realized'->>'savings_actual_amount')::numeric, 0)
    - COALESCE((SELECT savings_actual_amount FROM summary_src), 0)::numeric
UNION ALL
SELECT
  'planned_operations_count',
  COALESCE((SELECT COUNT(*) FROM planned_src), 0)::numeric,
  COALESCE(((SELECT data FROM payload)->'planned_operations'->>'count')::numeric, 0),
  COALESCE(((SELECT data FROM payload)->'planned_operations'->>'count')::numeric, 0)
    - COALESCE((SELECT COUNT(*) FROM planned_src), 0)::numeric
UNION ALL
SELECT
  'planned_operations_total_amount',
  COALESCE((SELECT SUM(ABS(COALESCE(planned_personal_amount, planned_amount, 0))) FROM planned_src), 0)::numeric,
  COALESCE(((SELECT data FROM payload)->'planned_operations'->>'total_amount')::numeric, 0),
  COALESCE(((SELECT data FROM payload)->'planned_operations'->>'total_amount')::numeric, 0)
    - COALESCE((SELECT SUM(ABS(COALESCE(planned_personal_amount, planned_amount, 0))) FROM planned_src), 0)::numeric
UNION ALL
SELECT
  'by_bucket_count',
  COALESCE((SELECT COUNT(*) FROM buckets_src), 0)::numeric,
  COALESCE((SELECT jsonb_array_length(data->'by_bucket') FROM payload), 0)::numeric,
  COALESCE((SELECT jsonb_array_length(data->'by_bucket') FROM payload), 0)::numeric
    - COALESCE((SELECT COUNT(*) FROM buckets_src), 0)::numeric
UNION ALL
SELECT
  'by_category_count',
  COALESCE((
    SELECT COUNT(*)
    FROM budget_dashboard.v_home_month_category_snapshot c
    JOIN params p
      ON p.user_id = c.user_id
     AND p.period_year = c.period_year
     AND p.period_month = c.period_month
  ), 0)::numeric,
  COALESCE((SELECT jsonb_array_length(data->'by_category') FROM payload), 0)::numeric,
  COALESCE((SELECT jsonb_array_length(data->'by_category') FROM payload), 0)::numeric
    - COALESCE((
      SELECT COUNT(*)
      FROM budget_dashboard.v_home_month_category_snapshot c
      JOIN params p
        ON p.user_id = c.user_id
       AND p.period_year = c.period_year
       AND p.period_month = c.period_month
    ), 0)::numeric
ORDER BY metric;

-- Inspect full payload
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS user_id,
    2026::int AS period_year,
    5::int AS period_month
)
SELECT jsonb_pretty(budget_dashboard.get_home_page_payload_v2(user_id, period_year, period_month))
FROM params;
