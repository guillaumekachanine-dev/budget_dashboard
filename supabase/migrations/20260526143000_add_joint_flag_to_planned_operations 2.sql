-- Adds a durable per-row joint flag for planned operations.
-- The source of truth remains personal_share_ratio (0.5 => shared, 1 => personal).

ALTER TABLE budget_dashboard.planned_operations
  ADD COLUMN IF NOT EXISTS is_joint_expense boolean NOT NULL DEFAULT false;

UPDATE budget_dashboard.planned_operations
SET is_joint_expense = (COALESCE(personal_share_ratio, 1) < 1)
WHERE is_joint_expense IS DISTINCT FROM (COALESCE(personal_share_ratio, 1) < 1);

CREATE OR REPLACE FUNCTION budget_dashboard.sync_planned_operation_joint_flag()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.is_joint_expense := (COALESCE(NEW.personal_share_ratio, 1) < 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_planned_operations_sync_joint_flag
  ON budget_dashboard.planned_operations;

CREATE TRIGGER trg_planned_operations_sync_joint_flag
BEFORE INSERT OR UPDATE ON budget_dashboard.planned_operations
FOR EACH ROW
EXECUTE FUNCTION budget_dashboard.sync_planned_operation_joint_flag();
