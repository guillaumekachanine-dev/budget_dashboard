-- Vue account_balances
-- Calcule le solde courant de chaque compte directement en SQL
-- pour éviter de charger toutes les transactions côté client.
CREATE OR REPLACE VIEW budget_dashboard.account_balances AS
SELECT
  a.id                          AS account_id,
  COALESCE(a.opening_balance, 0) +
    COALESCE(
      SUM(
        CASE
          WHEN t.direction IN ('income', 'transfer_in', 'savings')
            THEN t.amount
          ELSE -t.amount
        END
      ),
      0
    )                           AS current_balance
FROM budget_dashboard.accounts a
LEFT JOIN budget_dashboard.transactions t
  ON  t.account_id = a.id
  AND t.is_hidden   = false
GROUP BY a.id, a.opening_balance;

-- Accès en lecture pour le rôle authenticated (nécessaire avec RLS)
GRANT SELECT ON budget_dashboard.account_balances TO authenticated;
GRANT SELECT ON budget_dashboard.account_balances TO service_role;
