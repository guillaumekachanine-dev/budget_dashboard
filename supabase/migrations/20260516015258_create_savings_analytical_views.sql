
-- ============================================================
-- Vue 1 : v_savings_accounts_display
-- Comptes épargne pour le front (sous-comptes agrégés dans leur parent)
-- ============================================================
CREATE OR REPLACE VIEW budget_dashboard.v_savings_accounts_display AS
WITH current_balances AS (
  SELECT
    sac.id                                                            AS config_id,
    sac.user_id,
    sac.account_id,
    sac.parent_account_id,
    sac.savings_family,
    sac.savings_kind,
    sac.display_name,
    sac.display_order,
    sac.is_liquid,
    sac.risk_level,
    sac.is_tax_advantaged,
    sac.is_locked,
    a.institution_name,
    a.currency,
    COALESCE(lb.balance_amount, a.opening_balance, 0)::numeric(14,2)  AS current_balance,
    CASE
      WHEN lb.balance_amount IS NOT NULL THEN 'accounts_balance'
      WHEN a.opening_balance  IS NOT NULL THEN 'accounts.opening_balance'
      ELSE 'missing'
    END                                                               AS balance_source,
    lb.balance_month  AS latest_balance_month,
    lb.observed_date  AS latest_observed_date
  FROM budget_dashboard.savings_account_config sac
  JOIN budget_dashboard.accounts a ON a.id = sac.account_id
  LEFT JOIN LATERAL (
    SELECT ab.balance_amount, ab.balance_month, ab.observed_date
    FROM   budget_dashboard.accounts_balance ab
    WHERE  ab.account_id = sac.account_id
    ORDER  BY ab.balance_month DESC, ab.observed_date DESC NULLS LAST
    LIMIT  1
  ) lb ON true
  WHERE sac.is_active = true
)
SELECT
  p.config_id,
  p.user_id,
  p.account_id,
  p.savings_family,
  p.savings_kind,
  p.display_name,
  p.display_order,
  p.is_liquid,
  p.risk_level,
  p.is_tax_advantaged,
  p.is_locked,
  p.institution_name,
  p.currency,
  SUM(c.current_balance)::numeric(14,2)  AS current_balance,
  COUNT(c.config_id)::integer            AS sub_accounts_count,
  MAX(c.latest_balance_month)            AS latest_balance_month,
  MAX(c.latest_observed_date)            AS latest_observed_date
FROM current_balances p
JOIN current_balances c
  ON COALESCE(c.parent_account_id, c.config_id) = p.config_id
WHERE p.parent_account_id IS NULL
GROUP BY
  p.config_id, p.user_id, p.account_id, p.savings_family, p.savings_kind,
  p.display_name, p.display_order, p.is_liquid, p.risk_level,
  p.is_tax_advantaged, p.is_locked, p.institution_name, p.currency;

-- ============================================================
-- Mise à jour v_savings_current_summary
-- Utilise désormais v_savings_accounts_display (sans double-comptage)
-- ============================================================
CREATE OR REPLACE VIEW budget_dashboard.v_savings_current_summary AS
SELECT
  user_id,
  SUM(current_balance)::numeric(14,2)                                                    AS total_savings,
  SUM(current_balance) FILTER (WHERE savings_family = 'livrets')::numeric(14,2)          AS livrets_total,
  SUM(current_balance) FILTER (WHERE savings_family = 'placements')::numeric(14,2)       AS placements_total,
  SUM(current_balance) FILTER (WHERE is_liquid = true)::numeric(14,2)                    AS liquid_savings_total,
  SUM(current_balance) FILTER (WHERE is_locked = true)::numeric(14,2)                    AS locked_savings_total,
  COUNT(*)::integer                                                                       AS accounts_count,
  ROUND(100.0 * SUM(current_balance) FILTER (WHERE savings_family = 'livrets')
        / NULLIF(SUM(current_balance), 0), 2)                                            AS livrets_share_pct,
  ROUND(100.0 * SUM(current_balance) FILTER (WHERE savings_family = 'placements')
        / NULLIF(SUM(current_balance), 0), 2)                                            AS placements_share_pct,
  ROUND(100.0 * SUM(current_balance) FILTER (WHERE is_liquid = true)
        / NULLIF(SUM(current_balance), 0), 2)                                            AS liquid_share_pct,
  ROUND(100.0 * SUM(current_balance) FILTER (WHERE is_locked = true)
        / NULLIF(SUM(current_balance), 0), 2)                                            AS locked_share_pct
FROM budget_dashboard.v_savings_accounts_display
GROUP BY user_id;

-- ============================================================
-- Vue 2 : v_savings_funding_annual_summary
-- Virements vers comptes épargne, par destination × année
-- ============================================================
CREATE OR REPLACE VIEW budget_dashboard.v_savings_funding_annual_summary AS
SELECT
  user_id,
  destination_account_id,
  destination_label,
  destination_family,
  period_year,
  SUM(personal_amount)::numeric(14,2)  AS total_versed_eur,
  COUNT(*)::integer                    AS operations_count,
  ROUND(AVG(personal_amount), 2)       AS avg_operation_eur,
  MIN(transaction_date)                AS first_operation_date,
  MAX(transaction_date)                AS last_operation_date
FROM budget_dashboard.v_savings_transfers_enriched
WHERE destination_account_id IS NOT NULL
GROUP BY user_id, destination_account_id, destination_label, destination_family, period_year;

-- ============================================================
-- Vue 3 : v_savings_annual_performance
-- Performance par display_account × année (plus-values, rendement, taux réglementés)
-- ============================================================
CREATE OR REPLACE VIEW budget_dashboard.v_savings_annual_performance AS
WITH account_display_map AS (
  SELECT
    sac.account_id,
    sac.user_id,
    sac.savings_kind,
    COALESCE(sac.parent_account_id, sac.id)  AS display_config_id,
    primary_sac.account_id                   AS display_account_id,
    primary_sac.display_name,
    primary_sac.display_order,
    primary_sac.savings_family,
    primary_sac.savings_kind                 AS display_kind
  FROM budget_dashboard.savings_account_config sac
  JOIN budget_dashboard.savings_account_config primary_sac
    ON primary_sac.id = COALESCE(sac.parent_account_id, sac.id)
  WHERE sac.is_active = true
),
yearly_snapshots AS (
  SELECT DISTINCT ON (sbs.account_id, EXTRACT(year FROM sbs.snapshot_date)::integer)
    sbs.account_id,
    EXTRACT(year FROM sbs.snapshot_date)::integer AS snapshot_year,
    sbs.snapshot_date,
    sbs.balance_eur
  FROM budget_dashboard.savings_balance_snapshots sbs
  ORDER BY sbs.account_id,
           EXTRACT(year FROM sbs.snapshot_date)::integer,
           sbs.snapshot_date DESC
),
grouped_snapshots AS (
  SELECT
    adm.user_id,
    adm.display_account_id,
    adm.display_name,
    adm.display_order,
    adm.savings_family,
    adm.display_kind                       AS savings_kind,
    ys.snapshot_year                       AS period_year,
    SUM(ys.balance_eur)::numeric(14,2)     AS balance_eoy,
    MAX(ys.snapshot_date)                  AS latest_snapshot_date
  FROM yearly_snapshots ys
  JOIN account_display_map adm ON adm.account_id = ys.account_id
  GROUP BY adm.user_id, adm.display_account_id, adm.display_name,
           adm.display_order, adm.savings_family, adm.display_kind, ys.snapshot_year
),
with_boy AS (
  SELECT
    gs.*,
    LAG(gs.balance_eoy) OVER (
      PARTITION BY gs.display_account_id ORDER BY gs.period_year
    ) AS balance_boy
  FROM grouped_snapshots gs
),
funding AS (
  SELECT
    fas.user_id,
    adm.display_account_id,
    fas.period_year,
    SUM(fas.total_versed_eur)::numeric(14,2)  AS total_versed_eur,
    SUM(fas.operations_count)::integer        AS operations_count
  FROM budget_dashboard.v_savings_funding_annual_summary fas
  JOIN account_display_map adm ON adm.account_id = fas.destination_account_id
  GROUP BY fas.user_id, adm.display_account_id, fas.period_year
)
SELECT
  wb.user_id,
  wb.display_account_id                                                   AS account_id,
  wb.display_name,
  wb.display_order,
  wb.savings_family,
  wb.savings_kind,
  wb.period_year,
  wb.balance_boy,
  wb.balance_eoy,
  COALESCE(f.total_versed_eur, 0)::numeric(14,2)                         AS total_versed_eur,
  COALESCE(f.operations_count, 0)::integer                               AS operations_count,
  CASE WHEN wb.balance_boy IS NOT NULL
    THEN (wb.balance_eoy - wb.balance_boy
          - COALESCE(f.total_versed_eur, 0))::numeric(14,2)
  END                                                                     AS performance_amount,
  CASE WHEN wb.balance_boy > 0
    THEN ROUND(100.0
         * (wb.balance_eoy - wb.balance_boy - COALESCE(f.total_versed_eur, 0))
         / wb.balance_boy, 2)
  END                                                                     AS performance_pct,
  srh.rate_pct                                                            AS regulated_rate_pct,
  CASE WHEN srh.rate_pct IS NOT NULL AND wb.balance_boy IS NOT NULL
    THEN ROUND(wb.balance_boy * srh.rate_pct / 100.0, 2)
  END                                                                     AS regulated_interest_theoretical,
  wb.latest_snapshot_date
FROM with_boy wb
LEFT JOIN funding f
  ON  f.display_account_id = wb.display_account_id
  AND f.period_year        = wb.period_year
LEFT JOIN budget_dashboard.savings_rate_history srh
  ON  srh.savings_kind = wb.savings_kind
  AND srh.rate_year    = wb.period_year
ORDER BY wb.savings_family, wb.display_order, wb.period_year;

-- ============================================================
-- Vue 4 : v_savings_portfolio_annual_summary
-- Performance globale du portfolio par année (avec cumulatifs)
-- ============================================================
CREATE OR REPLACE VIEW budget_dashboard.v_savings_portfolio_annual_summary AS
WITH per_year AS (
  SELECT
    user_id,
    period_year,
    SUM(balance_eoy)::numeric(14,2)                                              AS total_portfolio_eoy,
    SUM(balance_boy)::numeric(14,2)                                              AS total_portfolio_boy,
    SUM(total_versed_eur)::numeric(14,2)                                         AS total_versed_year,
    SUM(performance_amount)::numeric(14,2)                                       AS total_performance_amount,
    SUM(balance_eoy)    FILTER (WHERE savings_family = 'livrets')::numeric(14,2) AS livrets_eoy,
    SUM(balance_eoy)    FILTER (WHERE savings_family = 'placements')::numeric(14,2) AS placements_eoy,
    SUM(total_versed_eur) FILTER (WHERE savings_family = 'livrets')::numeric(14,2)  AS livrets_versed,
    SUM(total_versed_eur) FILTER (WHERE savings_family = 'placements')::numeric(14,2) AS placements_versed,
    SUM(performance_amount) FILTER (WHERE savings_family = 'livrets')::numeric(14,2)    AS livrets_performance,
    SUM(performance_amount) FILTER (WHERE savings_family = 'placements')::numeric(14,2) AS placements_performance,
    COUNT(DISTINCT account_id)::integer                                          AS accounts_count
  FROM budget_dashboard.v_savings_annual_performance
  WHERE balance_boy IS NOT NULL
  GROUP BY user_id, period_year
)
SELECT
  py.*,
  CASE WHEN py.total_portfolio_boy > 0
    THEN ROUND(100.0 * py.total_performance_amount / py.total_portfolio_boy, 2)
  END                                                                             AS portfolio_performance_pct,
  SUM(py.total_versed_year) OVER (
    PARTITION BY py.user_id ORDER BY py.period_year
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  )::numeric(14,2)                                                                AS cumul_versed_all_time,
  SUM(py.total_performance_amount) OVER (
    PARTITION BY py.user_id ORDER BY py.period_year
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  )::numeric(14,2)                                                                AS cumul_performance_all_time
FROM per_year py
ORDER BY py.user_id, py.period_year;
;
