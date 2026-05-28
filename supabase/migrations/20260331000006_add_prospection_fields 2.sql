-- Add extra fields for prospection features
ALTER TABLE folio_app.clients
  ADD COLUMN IF NOT EXISTS segment TEXT,
  ADD COLUMN IF NOT EXISTS business_lines TEXT,
  ADD COLUMN IF NOT EXISTS hq TEXT,
  ADD COLUMN IF NOT EXISTS revenue BIGINT,
  ADD COLUMN IF NOT EXISTS employee_count INTEGER,
  ADD COLUMN IF NOT EXISTS brand_color TEXT,
  ADD COLUMN IF NOT EXISTS potential_score INTEGER,
  ADD COLUMN IF NOT EXISTS analysis_status TEXT DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS analysis_data JSONB;
-- Ensure potential_score stays between 1 and 5
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clients_potential_score_check'
  ) THEN
    ALTER TABLE folio_app.clients
      ADD CONSTRAINT clients_potential_score_check
      CHECK (potential_score IS NULL OR (potential_score >= 1 AND potential_score <= 5));
  END IF;
END;
$$;
-- Table to store analysis phase results
CREATE TABLE IF NOT EXISTS folio_app.prospect_phase_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES folio_app.clients(id) ON DELETE CASCADE,
  phase INTEGER NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, phase)
);
-- Table to store mission ids
CREATE TABLE IF NOT EXISTS folio_app.prospect_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES folio_app.clients(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_updated_at_prospect_phase_results'
  ) THEN
    CREATE TRIGGER trg_updated_at_prospect_phase_results
      BEFORE UPDATE ON folio_app.prospect_phase_results
      FOR EACH ROW EXECUTE FUNCTION folio_app.set_updated_at();
  END IF;
END;
$$;
-- RLS for new tables
ALTER TABLE folio_app.prospect_phase_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE folio_app.prospect_missions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'authenticated_full_access'
      AND tablename = 'prospect_phase_results'
      AND schemaname = 'folio_app'
  ) THEN
    CREATE POLICY authenticated_full_access
      ON folio_app.prospect_phase_results
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'authenticated_full_access'
      AND tablename = 'prospect_missions'
      AND schemaname = 'folio_app'
  ) THEN
    CREATE POLICY authenticated_full_access
      ON folio_app.prospect_missions
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END;
$$;
