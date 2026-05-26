-- Fix: planned_operations had RLS enabled but no policies, which blocks INSERT/UPDATE/DELETE.
-- This policy mirrors the owner-scoped access model used across the app tables.

ALTER TABLE budget_dashboard.planned_operations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'budget_dashboard'
      AND tablename = 'planned_operations'
      AND policyname = 'planned_operations_owner_all'
  ) THEN
    CREATE POLICY planned_operations_owner_all
      ON budget_dashboard.planned_operations
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;
