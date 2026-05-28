
CREATE OR REPLACE VIEW budget_dashboard.v_variable_category_summary_clean AS
WITH monthly_amounts AS (
  SELECT
    user_id,
    category_id,
    parent_category_id,
    MAX(category_name)         AS category_name,
    MAX(parent_category_name)  AS parent_category_name,
    month_start,
    SUM(actual_amount)         AS month_amount
  FROM budget_dashboard.v_monthly_category_actuals_clean
  WHERE budget_behavior = 'variable'
  GROUP BY user_id, category_id, parent_category_id, month_start
)
SELECT
  user_id,
  category_id,
  parent_category_id,
  MAX(category_name)                                                    AS category_name,
  MAX(parent_category_name)                                             AS parent_category_name,
  CASE
    WHEN MAX(parent_category_name) IS NOT NULL
    THEN MAX(parent_category_name) || ' > ' || MAX(category_name)
    ELSE MAX(category_name)
  END                                                                   AS category_path,
  COUNT(*)::integer                                                     AS active_months_count,
  ROUND(AVG(month_amount), 2)                                           AS avg_monthly_amount,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY month_amount)::numeric, 2) AS median_monthly_amount,
  ROUND(MIN(month_amount), 2)                                           AS min_monthly_amount,
  ROUND(MAX(month_amount), 2)                                           AS max_monthly_amount,
  ROUND(SUM(month_amount), 2)                                           AS total_amount
FROM monthly_amounts
GROUP BY user_id, category_id, parent_category_id
ORDER BY total_amount DESC;
;
