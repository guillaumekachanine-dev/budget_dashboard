
-- Migration 3: Fix PEG Capgemini balance double-count and align snapshot data with PDF

-- 1. Set PERCOL opening_balance = 0 to eliminate double-count in v_savings_accounts_display
--    PERCOL (27f0f529) has no accounts_balance entry → view falls back to opening_balance (1251.45)
--    which gets summed with PEG parent → 7671.46 + 1251.45 = 8922.91 (wrong)
UPDATE budget_dashboard.accounts
SET opening_balance = 0
WHERE id = '27f0f529-0d65-4a2b-9f17-56682dc8024f';

-- 2. Correct total_saved_eur in existing PEG savings_balance_snapshots to match PDF source
UPDATE budget_dashboard.savings_balance_snapshots
SET total_saved_eur = 376.24, updated_at = now()
WHERE account_id = 'aaa904ee-d007-44e6-b71d-72e9b1b77262' AND snapshot_date = '2020-12-31';

UPDATE budget_dashboard.savings_balance_snapshots
SET total_saved_eur = 1711.90, updated_at = now()
WHERE account_id = 'aaa904ee-d007-44e6-b71d-72e9b1b77262' AND snapshot_date = '2021-12-31';

UPDATE budget_dashboard.savings_balance_snapshots
SET total_saved_eur = 2451.13, updated_at = now()
WHERE account_id = 'aaa904ee-d007-44e6-b71d-72e9b1b77262' AND snapshot_date = '2022-12-31';

UPDATE budget_dashboard.savings_balance_snapshots
SET total_saved_eur = 1453.34, updated_at = now()
WHERE account_id = 'aaa904ee-d007-44e6-b71d-72e9b1b77262' AND snapshot_date = '2023-12-31';

-- 3. Insert 2026 snapshot for PEG (needed so v_savings_annual_performance has a 2026 row)
INSERT INTO budget_dashboard.savings_balance_snapshots
  (id, account_id, snapshot_date, balance_eur, snapshot_type, total_saved_eur, operations_count, account_name, notes)
VALUES
  (gen_random_uuid(), 'aaa904ee-d007-44e6-b71d-72e9b1b77262', '2026-05-15', 7671.46, 'estimated', 0.00, 0,
   'PEG Capgemini', 'Valorisation 15/05/2026 — synthèse PDF PEG Capgemini');
;
