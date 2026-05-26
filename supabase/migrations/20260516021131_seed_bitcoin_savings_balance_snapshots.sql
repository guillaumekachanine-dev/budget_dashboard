
INSERT INTO budget_dashboard.savings_balance_snapshots
  (account_id, snapshot_date, balance_eur, snapshot_type, total_saved_eur, operations_count, account_name, notes)
SELECT
  a.id,
  s.snapshot_date,
  s.balance_eur,
  'estimated',
  2000.00,
  1,
  'Bitcoin (BTC-1)',
  'Valorisation bi-mensuelle portefeuille BTC'
FROM budget_dashboard.accounts a
CROSS JOIN (VALUES
  ('2024-11-27'::date, 2310.27::numeric),
  ('2025-11-27'::date, 2456.13::numeric),
  ('2026-05-16'::date, 2146.61::numeric)
) AS s(snapshot_date, balance_eur)
WHERE a.name = 'BTC-1'
ON CONFLICT DO NOTHING;
;
