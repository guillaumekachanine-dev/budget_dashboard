CREATE TABLE IF NOT EXISTS lethia_build.prospect_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES lethia_build.prospects(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (prospect_id, mission_id)
);
CREATE INDEX IF NOT EXISTS prospect_missions_prospect_idx
  ON lethia_build.prospect_missions (prospect_id);
CREATE INDEX IF NOT EXISTS prospect_missions_mission_idx
  ON lethia_build.prospect_missions (mission_id);
ALTER TABLE lethia_build.prospect_missions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'authenticated_full_access'
      AND tablename = 'prospect_missions'
      AND schemaname = 'lethia_build'
  ) THEN
    CREATE POLICY authenticated_full_access
      ON lethia_build.prospect_missions
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END;
$$;
