
ALTER TABLE budget_dashboard.import_batches
  DROP CONSTRAINT IF EXISTS import_batches_import_type_check;

ALTER TABLE budget_dashboard.import_batches
  ADD CONSTRAINT import_batches_import_type_check
  CHECK (import_type IN ('expenses', 'income', 'mixed', 'operations', 'savings_snapshot'));
;
