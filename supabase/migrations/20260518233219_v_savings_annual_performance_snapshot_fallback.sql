
-- Migration 5: Rebuild v_savings_annual_performance with snapshot total_saved_eur fallback.
-- For accounts like PEG where salary deductions never appear in transactions,
-- COALESCE(NULLIF(transaction_versed, 0), snapshot_total_saved) provides the correct funded amount.

CREATE OR REPLACE VIEW budget_dashboard.v_savings_annual_performance AS
WITH account_display_map AS (
  SELECT
    sac.account_id,
    sac.user_id,
    sac.savings_kind,
    COALESCE(sac.parent_account_id, sac.id) AS display_config_id,
    primary_sac.account_id AS display_account_id,
    primary_sac.display_name,
    primary_sac.display_order,
    primary_sac.savings_family,
    primary_sac.savings_kind AS display_kind
  FROM budget_dashboard.savings_account_config sac
  JOIN budget_dashboard.savings_account_config primary_sac
    ON primary_sac.id = COALESCE(sac.parent_account_id, sac.id)
  WHERE sac.is_active = true
),
yearly_snapshots AS (
  -- Latest snapshot per account per year (DISTINCT ON ensures one row per account×year)
  SELECT DISTINCT ON (sbs.account_id, EXTRACT(year FROM sbs.snapshot_date)::integer)
    sbs.account_id,
    EXTRACT(year FROM sbs.snapshot_date)::integer AS snapshot_year,
    sbs.snapshot_date,
    sbs.balance_eur,
    sbs.total_saved_eur   -- added: annual contribution recorded in snapshot
  FROM budget_dashboard.savings_balance_snapshots sbs
  ORDER BY sbs.account_id, EXTRACT(year FROM sbs.snapshot_date)::integer, sbs.snapshot_date DESC
),
grouped_snapshots AS (
  SELECT
    adm.user_id,
    adm.display_account_id,
    adm.display_name,
    adm.display_order,
    adm.savings_family,
    adm.display_kind AS savings_kind,
    ys.snapshot_year AS period_year,
    sum(ys.balance_eur)::numeric(14,2) AS balance_eoy,
    sum(ys.total_saved_eur)::numeric(14,2) AS snapshot_total_saved_eur,  -- added
    max(ys.snapshot_date) AS latest_snapshot_date
  FROM yearly_snapshots ys
  JOIN account_display_map adm ON adm.account_id = ys.account_id
  GROUP BY adm.user_id, adm.display_account_id, adm.display_name, adm.display_order,
           adm.savings_family, adm.display_kind, ys.snapshot_year
),
with_boy AS (
  SELECT
    gs.user_id,
    gs.display_account_id,
    gs.display_name,
    gs.display_order,
    gs.savings_family,
    gs.savings_kind,
    gs.period_year,
    gs.balance_eoy,
    gs.snapshot_total_saved_eur,   -- passed through
    gs.latest_snapshot_date,
    lag(gs.balance_eoy) OVER (PARTITION BY gs.display_account_id ORDER BY gs.period_year) AS balance_boy
  FROM grouped_snapshots gs
),
funding AS (
  SELECT
    fas.user_id,
    adm.display_account_id,
    fas.period_year,
    sum(fas.total_versed_eur)::numeric(14,2) AS total_versed_eur,
    sum(fas.operations_count)::integer AS operations_count
  FROM budget_dashboard.v_savings_funding_annual_summary fas
  JOIN account_display_map adm ON adm.account_id = fas.destination_account_id
  GROUP BY fas.user_id, adm.display_account_id, fas.period_year
)
SELECT
  wb.user_id,
  wb.display_account_id AS account_id,
  wb.display_name,
  wb.display_order,
  wb.savings_family,
  wb.savings_kind,
  wb.period_year,
  wb.balance_boy,
  wb.balance_eoy,
  -- Use transaction-based funding if non-zero; fall back to snapshot value for salary-deduction accounts
  COALESCE(NULLIF(f.total_versed_eur, 0), wb.snapshot_total_saved_eur, 0)::numeric(14,2) AS total_versed_eur,
  COALESCE(f.operations_count, 0) AS operations_count,
  CASE
    WHEN wb.balance_boy IS NOT NULL THEN
      (wb.balance_eoy - wb.balance_boy
        - COALESCE(NULLIF(f.total_versed_eur, 0), wb.snapshot_total_saved_eur, 0))::numeric(14,2)
    ELSE NULL
  END AS performance_amount,
  CASE
    WHEN wb.balance_boy > 0 THEN
      round(
        100.0 * (wb.balance_eoy - wb.balance_boy
          - COALESCE(NULLIF(f.total_versed_eur, 0), wb.snapshot_total_saved_eur, 0))
        / wb.balance_boy,
        2
      )
    ELSE NULL
  END AS performance_pct,
  srh.rate_pct AS regulated_rate_pct,
  CASE
    WHEN srh.rate_pct IS NOT NULL AND wb.balance_boy IS NOT NULL THEN
      round(wb.balance_boy * srh.rate_pct / 100.0, 2)
    ELSE NULL
  END AS regulated_interest_theoretical,
  wb.latest_snapshot_date
FROM with_boy wb
LEFT JOIN funding f
  ON f.display_account_id = wb.display_account_id AND f.period_year = wb.period_year
LEFT JOIN budget_dashboard.savings_rate_history srh
  ON srh.savings_kind = wb.savings_kind AND srh.rate_year = wb.period_year
ORDER BY wb.savings_family, wb.display_order, wb.period_year;
;
