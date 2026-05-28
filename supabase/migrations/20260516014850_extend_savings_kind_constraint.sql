
ALTER TABLE budget_dashboard.savings_account_config
  DROP CONSTRAINT savings_account_config_savings_kind_check;

ALTER TABLE budget_dashboard.savings_account_config
  ADD CONSTRAINT savings_account_config_savings_kind_check
  CHECK (savings_kind = ANY (ARRAY[
    'livret_a', 'ldds', 'lep',
    'pea', 'peg', 'per', 'percol',
    'assurance_vie', 'cto', 'bitcoin', 'crypto',
    'autre'
  ]));
;
