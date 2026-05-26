DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'folio_app'
      AND table_name = 'project_steps'
      AND column_name = 'notes'
  ) THEN
    ALTER TABLE folio_app.project_steps
      RENAME COLUMN notes TO description;
  END IF;
END $$;
