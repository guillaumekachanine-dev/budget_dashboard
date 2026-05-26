
-- ============================================================
-- Priorité 2 : migrer les vues Stats vers les données live
-- ============================================================

-- 1. budget_bucket_actuals_by_month
--    Avant : lit analytics_monthly_category_metrics (table stale)
--            + current_budget_bucket_map pour mapper catégorie → bucket
--    Après : lit v_monthly_bucket_actuals_clean (vue live déjà agrégée
--            par bucket, filtre hors_pilotage, expose expense_amount)
CREATE OR REPLACE VIEW budget_dashboard.budget_bucket_actuals_by_month AS
SELECT
  user_id,
  month_start,
  EXTRACT(year  FROM month_start)::integer AS period_year,
  EXTRACT(month FROM month_start)::integer AS period_month,
  budget_bucket,
  expense_amount AS actual_budget_bucket_eur
FROM budget_dashboard.v_monthly_bucket_actuals_clean
WHERE budget_bucket NOT IN ('revenu', 'hors_pilotage');

-- 2. budget_bucket_target_projection_by_month
--    Avant : CTE months_available lit analytics_monthly_metrics (table stale)
--    Après : CTE months_available lit transactions directement (toujours frais)
CREATE OR REPLACE VIEW budget_dashboard.budget_bucket_target_projection_by_month AS
WITH latest_bucket_target_period AS (
  SELECT DISTINCT ON (bb.user_id)
    bb.user_id,
    bb.period_id,
    bb.period_year,
    bb.period_month
  FROM budget_dashboard.budget_bucket_totals_by_period bb
  ORDER BY bb.user_id, bb.period_year DESC, bb.period_month DESC
), current_targets AS (
  SELECT
    bb.user_id,
    bb.budget_bucket,
    bb.total_budget_bucket_eur
  FROM budget_dashboard.budget_bucket_totals_by_period bb
  JOIN latest_bucket_target_period ltp
    ON ltp.user_id = bb.user_id AND ltp.period_id = bb.period_id
), months_available AS (
  -- Source live : détecte les mois disponibles depuis les transactions réelles
  -- (remplace l'ancienne lecture de analytics_monthly_metrics)
  SELECT DISTINCT
    user_id,
    date_trunc('month', transaction_date)::date           AS month_start,
    EXTRACT(year  FROM transaction_date)::integer          AS period_year,
    EXTRACT(month FROM transaction_date)::integer          AS period_month
  FROM budget_dashboard.transactions
  WHERE is_hidden = FALSE
)
SELECT
  ma.user_id,
  ma.month_start,
  ma.period_year,
  ma.period_month,
  ct.budget_bucket,
  ct.total_budget_bucket_eur AS target_budget_bucket_eur
FROM months_available ma
JOIN current_targets ct ON ct.user_id = ma.user_id;

-- budget_bucket_budget_vs_actual_by_month n'est pas modifié :
-- il fait un LEFT JOIN entre les deux vues ci-dessus
-- et devient automatiquement live grâce à elles.
;
