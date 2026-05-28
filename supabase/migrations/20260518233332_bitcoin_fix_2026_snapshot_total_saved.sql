
-- Migration 4c: Fix 2026 Bitcoin snapshots total_saved_eur.
-- These snapshots had total_saved_eur=3042 (cumulative since inception), but the
-- v_savings_annual_performance fallback treats this field as annual contribution.
-- No new Bitcoin was purchased in 2026, so annual contribution = 0.
-- 2024 invested 2000 (transaction-based) and 2025 invested 1042 (transaction-based),
-- so those years are unaffected (fallback is not triggered when transactions > 0).
UPDATE budget_dashboard.savings_balance_snapshots
SET total_saved_eur = 0.00, updated_at = now()
WHERE account_id = '93cbab65-75e5-4e1a-8bf7-a122970052f3'
  AND snapshot_date >= '2026-01-01';
;
