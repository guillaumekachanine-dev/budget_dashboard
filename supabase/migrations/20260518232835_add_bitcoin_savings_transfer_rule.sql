
-- Migration 4: Add Bitcoin matching rule in savings_transfer_rules
-- Priority 55 = between PER (50) and catch-all crypto (60)
-- Regex matches: "Achat Bitcoin BTC-1", "Achat Bitcoin", any BTC label
INSERT INTO budget_dashboard.savings_transfer_rules
  (id, user_id, rule_name, label_regex, destination_account_id, destination_label, destination_family, priority, is_active, notes)
VALUES
  (gen_random_uuid(),
   'da1d9874-4cf9-4607-b09d-34336e69126b',
   'Destination Bitcoin',
   '(BITCOIN|BTC)',
   '93cbab65-75e5-4e1a-8bf7-a122970052f3',
   'Bitcoin',
   'placements',
   55,
   true,
   'Achats Bitcoin (BTC-1 + BTC-2 consolidés). Source = destination car transactions saisies directement dans le compte épargne Bitcoin.');
;
