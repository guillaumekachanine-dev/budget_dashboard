-- Create lethia_build schema and tables to mirror original Lethia
CREATE SCHEMA IF NOT EXISTS lethia_build;
CREATE TABLE IF NOT EXISTS lethia_build.prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  sector TEXT,
  segment TEXT,
  location TEXT,
  nb_contacts INTEGER DEFAULT 0,
  nb_with_email INTEGER DEFAULT 0,
  nb_with_phone INTEGER DEFAULT 0,
  nb_male INTEGER DEFAULT 0,
  nb_female INTEGER DEFAULT 0,
  nb_unknown_gender INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  site_web TEXT,
  analysis_data JSONB,
  analysis_status TEXT NOT NULL DEFAULT 'none',
  logo_url TEXT,
  business_lines TEXT,
  headquarters_address TEXT,
  revenue TEXT,
  employee_count TEXT,
  potential_score INTEGER,
  brand_color TEXT,
  CONSTRAINT prospects_company_name_key UNIQUE (company_name),
  CONSTRAINT prospects_potential_score_check
    CHECK (potential_score IS NULL OR (potential_score >= 1 AND potential_score <= 5))
);
CREATE TABLE IF NOT EXISTS lethia_build.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES lethia_build.prospects(id) ON DELETE SET NULL,
  company_name TEXT,
  gender TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  job_title TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  linkedin_url TEXT,
  last_activity DATE,
  notes TEXT,
  activity_note TEXT,
  CONSTRAINT contacts_gender_check CHECK (gender = ANY (ARRAY['M.'::text, 'Mme'::text])),
  CONSTRAINT contacts_full_name_email_key UNIQUE (full_name, email)
);
CREATE INDEX IF NOT EXISTS prospects_sector_idx ON lethia_build.prospects (sector);
CREATE INDEX IF NOT EXISTS prospects_location_idx ON lethia_build.prospects (location);
CREATE INDEX IF NOT EXISTS contacts_prospect_id_idx ON lethia_build.contacts (prospect_id);
CREATE INDEX IF NOT EXISTS contacts_email_idx ON lethia_build.contacts (email);
CREATE INDEX IF NOT EXISTS contacts_full_name_idx ON lethia_build.contacts (full_name);
-- updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_updated_at_lethia_prospects'
  ) THEN
    CREATE TRIGGER trg_updated_at_lethia_prospects
      BEFORE UPDATE ON lethia_build.prospects
      FOR EACH ROW EXECUTE FUNCTION folio_app.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_updated_at_lethia_contacts'
  ) THEN
    CREATE TRIGGER trg_updated_at_lethia_contacts
      BEFORE UPDATE ON lethia_build.contacts
      FOR EACH ROW EXECUTE FUNCTION folio_app.set_updated_at();
  END IF;
END;
$$;
-- RLS policies
ALTER TABLE lethia_build.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE lethia_build.contacts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'authenticated_full_access'
      AND tablename = 'prospects'
      AND schemaname = 'lethia_build'
  ) THEN
    CREATE POLICY authenticated_full_access
      ON lethia_build.prospects
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'authenticated_full_access'
      AND tablename = 'contacts'
      AND schemaname = 'lethia_build'
  ) THEN
    CREATE POLICY authenticated_full_access
      ON lethia_build.contacts
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END;
$$;
