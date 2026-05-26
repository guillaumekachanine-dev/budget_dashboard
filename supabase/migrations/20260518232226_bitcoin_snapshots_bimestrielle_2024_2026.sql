
-- Migration 2: Insert missing bimestrielle snapshots for merged Bitcoin account
-- and update existing snapshots to reflect merged BTC-1 + BTC-2 values.

-- 1. Insert 9 missing pre-BTC-2 snapshots (BTC-1 only, total_saved_eur=2000)
INSERT INTO budget_dashboard.savings_balance_snapshots
  (id, account_id, snapshot_date, balance_eur, snapshot_type, total_saved_eur, operations_count, account_name, notes)
VALUES
  (gen_random_uuid(), '93cbab65-75e5-4e1a-8bf7-a122970052f3', '2024-03-27', 2000.00, 'estimated', 2000.00, 1, 'Bitcoin', 'Valorisation bi-mensuelle portefeuille Bitcoin'),
  (gen_random_uuid(), '93cbab65-75e5-4e1a-8bf7-a122970052f3', '2024-05-27', 1844.15, 'estimated', 2000.00, 1, 'Bitcoin', 'Valorisation bi-mensuelle portefeuille Bitcoin'),
  (gen_random_uuid(), '93cbab65-75e5-4e1a-8bf7-a122970052f3', '2024-07-27', 1724.56, 'estimated', 2000.00, 1, 'Bitcoin', 'Valorisation bi-mensuelle portefeuille Bitcoin'),
  (gen_random_uuid(), '93cbab65-75e5-4e1a-8bf7-a122970052f3', '2024-09-27', 1802.46, 'estimated', 2000.00, 1, 'Bitcoin', 'Valorisation bi-mensuelle portefeuille Bitcoin'),
  (gen_random_uuid(), '93cbab65-75e5-4e1a-8bf7-a122970052f3', '2025-01-27', 3063.32, 'estimated', 2000.00, 1, 'Bitcoin', 'Valorisation bi-mensuelle portefeuille Bitcoin'),
  (gen_random_uuid(), '93cbab65-75e5-4e1a-8bf7-a122970052f3', '2025-03-27', 2439.45, 'estimated', 2000.00, 1, 'Bitcoin', 'Valorisation bi-mensuelle portefeuille Bitcoin'),
  (gen_random_uuid(), '93cbab65-75e5-4e1a-8bf7-a122970052f3', '2025-05-27', 2912.10, 'estimated', 2000.00, 1, 'Bitcoin', 'Valorisation bi-mensuelle portefeuille Bitcoin'),
  (gen_random_uuid(), '93cbab65-75e5-4e1a-8bf7-a122970052f3', '2025-07-27', 3012.91, 'estimated', 2000.00, 1, 'Bitcoin', 'Valorisation bi-mensuelle portefeuille Bitcoin'),
  (gen_random_uuid(), '93cbab65-75e5-4e1a-8bf7-a122970052f3', '2025-09-27', 3077.92, 'estimated', 2000.00, 1, 'Bitcoin', 'Valorisation bi-mensuelle portefeuille Bitcoin');

-- 2. Insert 2 post-BTC-2 merged snapshots (BTC-1 + BTC-2, total_saved_eur=3042)
INSERT INTO budget_dashboard.savings_balance_snapshots
  (id, account_id, snapshot_date, balance_eur, snapshot_type, total_saved_eur, operations_count, account_name, notes)
VALUES
  (gen_random_uuid(), '93cbab65-75e5-4e1a-8bf7-a122970052f3', '2026-01-27', 2796.37, 'estimated', 3042.00, 2, 'Bitcoin', 'Valorisation bi-mensuelle portefeuille Bitcoin (BTC-1 + BTC-2 consolidés)'),
  (gen_random_uuid(), '93cbab65-75e5-4e1a-8bf7-a122970052f3', '2026-03-27', 2913.15, 'estimated', 3042.00, 2, 'Bitcoin', 'Valorisation bi-mensuelle portefeuille Bitcoin (BTC-1 + BTC-2 consolidés)');

-- 3. Update existing snapshots: fix account_name, total_saved_eur for 2024-11-27 and 2025-11-27
UPDATE budget_dashboard.savings_balance_snapshots
SET account_name = 'Bitcoin', updated_at = now()
WHERE account_id = '93cbab65-75e5-4e1a-8bf7-a122970052f3'
  AND snapshot_date IN ('2024-11-27', '2025-11-27');

-- 4. Update 2026-05-16: set merged balance, total_saved_eur=3042, operations_count=2
UPDATE budget_dashboard.savings_balance_snapshots
SET
  balance_eur      = 3188.00,
  total_saved_eur  = 3042.00,
  operations_count = 2,
  account_name     = 'Bitcoin',
  notes            = 'Valorisation bi-mensuelle portefeuille Bitcoin (BTC-1 + BTC-2 consolidés)',
  updated_at       = now()
WHERE account_id = '93cbab65-75e5-4e1a-8bf7-a122970052f3'
  AND snapshot_date = '2026-05-16';
;
