
-- 1. Rerouter la transaction BTC-2 vers Bitcoin (BTC-1)
UPDATE budget_dashboard.transactions
SET account_id = '93cbab65-75e5-4e1a-8bf7-a122970052f3',
    normalized_label = 'Achat Bitcoin'
WHERE id = '6a05d97d-2c4b-4304-8153-da5311a7b5dd';

-- 2. Consolider le cashflow BTC-2 sur Bitcoin
UPDATE budget_dashboard.investment_cashflows
SET account_id  = '93cbab65-75e5-4e1a-8bf7-a122970052f3',
    description = 'Achat Bitcoin (2e tranche)'
WHERE id = 'b38e09ab-a586-4ad5-89c0-b53ca88e8aea';

-- 3. Supprimer investment_account_config BTC-2
DELETE FROM budget_dashboard.investment_account_config
WHERE id = '95904d3b-b49f-4946-ab44-dc91758ff591';

-- 4. Supprimer savings_account_config BTC-2
DELETE FROM budget_dashboard.savings_account_config
WHERE id = '3850cc99-ad49-4836-8a6b-7e0832fca332';

-- 5. Renommer BTC-1 → "Bitcoin" dans accounts
UPDATE budget_dashboard.accounts
SET name = 'Bitcoin', opening_balance = 0
WHERE id = '93cbab65-75e5-4e1a-8bf7-a122970052f3';

-- 6. Supprimer le compte BTC-2 (plus aucune FK)
DELETE FROM budget_dashboard.accounts
WHERE id = '4d580d08-c274-4ba3-b911-e80ab0be1909';

-- 7. Renommer display_name dans savings_account_config
UPDATE budget_dashboard.savings_account_config
SET display_name = 'Bitcoin'
WHERE id = '2f2ec3e3-77d8-4629-877c-02264ffab329';

-- 8. Mettre à jour accounts_balance pour les périodes post-achat BTC-2 (2026)
--    Valeurs = BTC-1 + BTC-2 calculées au cours bimestriel
UPDATE budget_dashboard.accounts_balance
SET balance_amount = 2796.37
WHERE account_id = '93cbab65-75e5-4e1a-8bf7-a122970052f3'
  AND balance_month = '2026-01-01';

UPDATE budget_dashboard.accounts_balance
SET balance_amount = 2913.15
WHERE account_id = '93cbab65-75e5-4e1a-8bf7-a122970052f3'
  AND balance_month = '2026-03-01';

UPDATE budget_dashboard.accounts_balance
SET balance_amount = 3188.00
WHERE account_id = '93cbab65-75e5-4e1a-8bf7-a122970052f3'
  AND balance_month = '2026-05-01';
;
