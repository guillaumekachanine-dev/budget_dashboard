
INSERT INTO budget_dashboard.accounts_balance (account_id, balance_month, balance_amount, currency, source, observed_date, account_name)
SELECT
  a.id,
  '2026-05-01'::date,
  2146.61,
  'EUR',
  'manual',
  '2026-05-16'::date,
  'Bitcoin (BTC-1)'
FROM budget_dashboard.accounts a
WHERE a.name = 'BTC-1'
ON CONFLICT DO NOTHING;
;
