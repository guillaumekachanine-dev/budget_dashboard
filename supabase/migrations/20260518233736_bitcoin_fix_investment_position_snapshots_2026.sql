
-- Migration 6: Update 2026 investment_position_snapshots for merged Bitcoin (BTC-1 + BTC-2).
-- BTC-1: 0.034200 BTC (2000€ initial). BTC-2: 0.016591 BTC (1042€, Dec 2025).
-- Total: 0.050791 BTC. Cost basis: 3042€.

-- 2026-01-27: merged value = 2796.37€ at 55054.68 EUR/BTC
UPDATE budget_dashboard.investment_position_snapshots
SET
  units              = 0.050791,
  market_value       = 2796.37,
  total_value        = 2796.37,
  cost_basis_total   = 3042.00,
  unrealized_gain    = 2796.37 - 3042.00,
  unrealized_gain_pct = ROUND((2796.37 - 3042.00) / 3042.00 * 100, 4),
  updated_at         = now()
WHERE account_id = '93cbab65-75e5-4e1a-8bf7-a122970052f3'
  AND snapshot_date = '2026-01-27';

-- 2026-03-27: merged value = 2913.15€ at 57355.56 EUR/BTC
UPDATE budget_dashboard.investment_position_snapshots
SET
  units              = 0.050791,
  market_value       = 2913.15,
  total_value        = 2913.15,
  cost_basis_total   = 3042.00,
  unrealized_gain    = 2913.15 - 3042.00,
  unrealized_gain_pct = ROUND((2913.15 - 3042.00) / 3042.00 * 100, 4),
  updated_at         = now()
WHERE account_id = '93cbab65-75e5-4e1a-8bf7-a122970052f3'
  AND snapshot_date = '2026-03-27';

-- 2026-05-16: merged value = 3188.00€ at 62766.37 EUR/BTC
UPDATE budget_dashboard.investment_position_snapshots
SET
  units              = 0.050791,
  market_value       = 3188.00,
  total_value        = 3188.00,
  cost_basis_total   = 3042.00,
  unrealized_gain    = 3188.00 - 3042.00,
  unrealized_gain_pct = ROUND((3188.00 - 3042.00) / 3042.00 * 100, 4),
  notes              = 'Portefeuille consolidé Bitcoin (BTC-1 + BTC-2). cours BTC: 67965.58 USD',
  updated_at         = now()
WHERE account_id = '93cbab65-75e5-4e1a-8bf7-a122970052f3'
  AND snapshot_date = '2026-05-16';

-- Also update product_name in investment_account_config to remove stale "BTC-1" suffix
UPDATE budget_dashboard.investment_account_config
SET product_name = 'Bitcoin', updated_at = now()
WHERE account_id = '93cbab65-75e5-4e1a-8bf7-a122970052f3';
;
