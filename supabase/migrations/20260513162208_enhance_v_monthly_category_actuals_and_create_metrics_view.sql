
-- ============================================================
-- Priorité 3 — Migration 1/2
-- Enrichit v_monthly_category_actuals_clean :
--   colonnes existantes inchangées (même ordre),
--   nouvelles colonnes ajoutées EN FIN DE LISTE :
--   + parent_category_id (LEFT JOIN categories)
--   + budget_behavior    (mapped_budget_behavior)
-- ============================================================
CREATE OR REPLACE VIEW budget_dashboard.v_monthly_category_actuals_clean AS
SELECT
  vbte.user_id,
  date_trunc('month', vbte.transaction_date)::date           AS month_start,
  EXTRACT(year  FROM vbte.transaction_date)::integer          AS period_year,
  EXTRACT(month FROM vbte.transaction_date)::integer          AS period_month,
  vbte.category_id,
  vbte.mapped_category_name                                   AS category_name,
  vbte.mapped_parent_category_name                            AS parent_category_name,
  vbte.mapped_budget_bucket                                   AS budget_bucket,
  count(*)                                                    AS transaction_count,
  round(sum(abs(vbte.pilotage_amount)), 2)                    AS actual_amount,
  -- nouvelles colonnes (append uniquement)
  c.parent_id                                                 AS parent_category_id,
  vbte.mapped_budget_behavior                                 AS budget_behavior
FROM budget_dashboard.v_budget_transactions_enriched vbte
LEFT JOIN budget_dashboard.categories c ON c.id = vbte.category_id
WHERE vbte.pilotage_amount <> 0
  AND vbte.mapped_budget_bucket = ANY(ARRAY[
    'socle_fixe', 'variable_essentielle', 'discretionnaire', 'provision', 'epargne'
  ])
GROUP BY
  vbte.user_id,
  date_trunc('month', vbte.transaction_date)::date,
  EXTRACT(year  FROM vbte.transaction_date),
  EXTRACT(month FROM vbte.transaction_date),
  vbte.category_id,
  vbte.mapped_category_name,
  vbte.mapped_parent_category_name,
  vbte.mapped_budget_bucket,
  c.parent_id,
  vbte.mapped_budget_behavior;

-- ============================================================
-- Priorité 3 — Migration 2/2
-- Crée v_monthly_metrics_clean : équivalent live de analytics_monthly_metrics.
-- savings_capacity_observed = income_total - expense_total (confirmé par vérification).
-- ============================================================
CREATE OR REPLACE VIEW budget_dashboard.v_monthly_metrics_clean AS
SELECT
  user_id,
  date_trunc('month', transaction_date)::date                  AS month_start,
  EXTRACT(year  FROM transaction_date)::integer                 AS period_year,
  EXTRACT(month FROM transaction_date)::integer                 AS period_month,
  round(
    sum(CASE WHEN is_revenue         THEN GREATEST(pilotage_amount, 0) ELSE 0 END), 2
  )                                                             AS income_total,
  round(
    sum(CASE WHEN is_pilotage_expense THEN abs(pilotage_amount) ELSE 0 END), 2
  )                                                             AS expense_total,
  round(
    sum(CASE WHEN is_pilotage_expense AND mapped_budget_behavior = 'fixed'
             THEN abs(pilotage_amount) ELSE 0 END), 2
  )                                                             AS fixed_expense_total,
  round(
    sum(CASE WHEN is_pilotage_expense AND mapped_budget_behavior = 'variable'
             THEN abs(pilotage_amount) ELSE 0 END), 2
  )                                                             AS variable_expense_total,
  round(
    sum(CASE WHEN is_revenue         THEN GREATEST(pilotage_amount, 0) ELSE 0 END)
    - sum(CASE WHEN is_pilotage_expense THEN abs(pilotage_amount)       ELSE 0 END),
    2
  )                                                             AS savings_capacity_observed
FROM budget_dashboard.v_budget_transactions_enriched
WHERE mapped_budget_bucket <> 'hors_pilotage'
  AND pilotage_amount <> 0
GROUP BY
  user_id,
  date_trunc('month', transaction_date)::date,
  EXTRACT(year  FROM transaction_date),
  EXTRACT(month FROM transaction_date);
;
