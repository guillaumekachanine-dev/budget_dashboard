-- Create folio_app.prospects + folio_app.contacts for Prospection (phase 1)

CREATE TABLE IF NOT EXISTS folio_app.prospects (
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
  CONSTRAINT folio_prospects_company_name_key UNIQUE (company_name),
  CONSTRAINT folio_prospects_potential_score_check
    CHECK (potential_score IS NULL OR (potential_score >= 1 AND potential_score <= 5))
);
CREATE TABLE IF NOT EXISTS folio_app.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES folio_app.prospects(id) ON DELETE SET NULL,
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
  CONSTRAINT folio_contacts_gender_check CHECK (gender = ANY (ARRAY['M.'::text, 'Mme'::text])),
  CONSTRAINT folio_contacts_full_name_email_key UNIQUE (full_name, email)
);
-- Ensure columns exist if tables were created earlier with partial schema
ALTER TABLE folio_app.prospects
  ADD COLUMN IF NOT EXISTS site_web TEXT,
  ADD COLUMN IF NOT EXISTS analysis_data JSONB,
  ADD COLUMN IF NOT EXISTS analysis_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS business_lines TEXT,
  ADD COLUMN IF NOT EXISTS headquarters_address TEXT,
  ADD COLUMN IF NOT EXISTS revenue TEXT,
  ADD COLUMN IF NOT EXISTS employee_count TEXT,
  ADD COLUMN IF NOT EXISTS potential_score INTEGER,
  ADD COLUMN IF NOT EXISTS brand_color TEXT,
  ADD COLUMN IF NOT EXISTS nb_contacts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nb_with_email INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nb_with_phone INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nb_male INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nb_female INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nb_unknown_gender INTEGER DEFAULT 0;
ALTER TABLE folio_app.contacts
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS last_activity DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS activity_note TEXT;
CREATE INDEX IF NOT EXISTS folio_prospects_sector_idx ON folio_app.prospects (sector);
CREATE INDEX IF NOT EXISTS folio_prospects_location_idx ON folio_app.prospects (location);
CREATE INDEX IF NOT EXISTS folio_contacts_prospect_id_idx ON folio_app.contacts (prospect_id);
CREATE INDEX IF NOT EXISTS folio_contacts_email_idx ON folio_app.contacts (email);
CREATE INDEX IF NOT EXISTS folio_contacts_full_name_idx ON folio_app.contacts (full_name);
-- updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_updated_at_folio_prospects'
  ) THEN
    CREATE TRIGGER trg_updated_at_folio_prospects
      BEFORE UPDATE ON folio_app.prospects
      FOR EACH ROW EXECUTE FUNCTION folio_app.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_updated_at_folio_contacts'
  ) THEN
    CREATE TRIGGER trg_updated_at_folio_contacts
      BEFORE UPDATE ON folio_app.contacts
      FOR EACH ROW EXECUTE FUNCTION folio_app.set_updated_at();
  END IF;
END;
$$;
-- RLS policies
ALTER TABLE folio_app.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE folio_app.contacts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'authenticated_full_access'
      AND tablename = 'prospects'
      AND schemaname = 'folio_app'
  ) THEN
    CREATE POLICY authenticated_full_access
      ON folio_app.prospects
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'authenticated_full_access'
      AND tablename = 'contacts'
      AND schemaname = 'folio_app'
  ) THEN
    CREATE POLICY authenticated_full_access
      ON folio_app.contacts
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END;
$$;
-- Optional: keep prospect_missions usable for phase 2+
ALTER TABLE IF EXISTS folio_app.prospect_missions
  ADD COLUMN IF NOT EXISTS prospect_id UUID REFERENCES folio_app.prospects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS folio_prospect_missions_prospect_idx
  ON folio_app.prospect_missions (prospect_id);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'folio_prospect_missions_prospect_unique'
  ) THEN
    ALTER TABLE folio_app.prospect_missions
      ADD CONSTRAINT folio_prospect_missions_prospect_unique
      UNIQUE (prospect_id, mission_id);
  END IF;
END;
$$;
