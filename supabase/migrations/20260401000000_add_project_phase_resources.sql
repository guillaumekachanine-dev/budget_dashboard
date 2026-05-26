ALTER TABLE folio_app.project_phases
  ADD COLUMN IF NOT EXISTS resources TEXT[] NOT NULL DEFAULT '{}';
