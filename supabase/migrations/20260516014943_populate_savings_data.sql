
-- 2a. Ajouter BTC-2 comme sous-compte de BTC-1
INSERT INTO budget_dashboard.savings_account_config
  (user_id, account_id, savings_family, savings_kind, display_name, display_order,
   is_active, is_liquid, risk_level, is_tax_advantaged, is_locked, parent_account_id, notes)
SELECT
  (SELECT user_id FROM budget_dashboard.savings_account_config WHERE savings_kind = 'bitcoin'),
  (SELECT id FROM budget_dashboard.accounts WHERE name = 'BTC-2'),
  'placements', 'bitcoin', 'Bitcoin (wallet 2)', 61,
  true, false, 'high', false, false,
  (SELECT id FROM budget_dashboard.savings_account_config WHERE savings_kind = 'bitcoin'),
  'Sous-compte Bitcoin – agrégé avec BTC-1 pour l''affichage front'
WHERE NOT EXISTS (
  SELECT 1 FROM budget_dashboard.savings_account_config
  WHERE account_id = (SELECT id FROM budget_dashboard.accounts WHERE name = 'BTC-2')
);

-- 2b. Ajouter PERCOL comme sous-compte de PEG Capgemini
INSERT INTO budget_dashboard.savings_account_config
  (user_id, account_id, savings_family, savings_kind, display_name, display_order,
   is_active, is_liquid, risk_level, is_tax_advantaged, is_locked, parent_account_id, notes)
SELECT
  (SELECT user_id FROM budget_dashboard.savings_account_config WHERE savings_kind = 'peg'),
  (SELECT id FROM budget_dashboard.accounts WHERE name = 'PERCOL Capgemini'),
  'placements', 'percol', 'PERCOL Capgemini', 41,
  true, false, 'medium', false, true,
  (SELECT id FROM budget_dashboard.savings_account_config WHERE savings_kind = 'peg'),
  'Sous-compte PERCOL – agrégé avec PEG Capgemini pour l''affichage front'
WHERE NOT EXISTS (
  SELECT 1 FROM budget_dashboard.savings_account_config
  WHERE account_id = (SELECT id FROM budget_dashboard.accounts WHERE name = 'PERCOL Capgemini')
);

-- 2c. Taux historiques livrets réglementés
INSERT INTO budget_dashboard.savings_rate_history (savings_kind, rate_year, rate_pct, rate_type, notes)
VALUES
  ('livret_a', 2019, 0.75, 'regulated', 'Taux 2019 (0.75% avant baisse fév 2020)'),
  ('livret_a', 2020, 0.50, 'regulated', null),
  ('livret_a', 2021, 0.50, 'regulated', null),
  ('livret_a', 2022, 1.50, 'regulated', 'Moyenne 2022 : 0.5→1% (fév)→2% (août)'),
  ('livret_a', 2023, 3.00, 'regulated', null),
  ('livret_a', 2024, 2.70, 'regulated', 'Moyenne 2024 : 3% (7 mois) + 2.25% (5 mois)'),
  ('livret_a', 2025, 2.40, 'regulated', null),
  ('livret_a', 2026, 2.40, 'regulated', 'Estimé – taux en vigueur au 01/2026'),
  ('ldds',     2019, 0.75, 'regulated', null),
  ('ldds',     2020, 0.50, 'regulated', null),
  ('ldds',     2021, 0.50, 'regulated', null),
  ('ldds',     2022, 1.50, 'regulated', null),
  ('ldds',     2023, 3.00, 'regulated', null),
  ('ldds',     2024, 2.70, 'regulated', null),
  ('ldds',     2025, 2.40, 'regulated', null),
  ('ldds',     2026, 2.40, 'regulated', null),
  ('lep',      2019, 1.25, 'regulated', null),
  ('lep',      2020, 1.00, 'regulated', null),
  ('lep',      2021, 1.00, 'regulated', null),
  ('lep',      2022, 2.20, 'regulated', null),
  ('lep',      2023, 6.10, 'regulated', 'Taux exceptionnel LEP 2023'),
  ('lep',      2024, 5.00, 'regulated', null),
  ('lep',      2025, 3.50, 'regulated', null),
  ('lep',      2026, 3.50, 'regulated', null)
ON CONFLICT (savings_kind, rate_year) DO NOTHING;

-- 2d. Peupler investment_cashflows PEA depuis les transactions réelles
-- (flow_month est une colonne générée, exclue de l'INSERT)
INSERT INTO budget_dashboard.investment_cashflows
  (user_id, account_id, flow_date, flow_type, amount, source_transaction_id, description, source)
SELECT
  t.user_id,
  r.destination_account_id,
  t.transaction_date,
  'contribution',
  ABS(t.amount),
  t.id,
  COALESCE(t.normalized_label, t.raw_label, 'Versement PEA'),
  'transaction'
FROM budget_dashboard.transactions t
LEFT JOIN LATERAL (
  SELECT r2.destination_account_id
  FROM budget_dashboard.savings_transfer_rules r2
  WHERE r2.user_id = t.user_id AND r2.is_active = true
    AND COALESCE(t.normalized_label, t.raw_label, t.merchant_name, '') ~* r2.label_regex
  ORDER BY r2.priority LIMIT 1
) r ON true
WHERE t.is_hidden = false
  AND (t.flow_type = 'savings' OR t.direction = 'savings')
  AND r.destination_account_id = (SELECT id FROM budget_dashboard.accounts WHERE name = 'PEA')
  AND NOT EXISTS (
    SELECT 1 FROM budget_dashboard.investment_cashflows cf
    WHERE cf.source_transaction_id = t.id
  );
;
