-- ============================================================
-- Add 'formation' type support and KPI fields to projects
-- ============================================================

-- Update the CHECK constraint on projects.type to include 'formation'
ALTER TABLE folio_app.projects
DROP CONSTRAINT projects_type_check;
ALTER TABLE folio_app.projects
ADD CONSTRAINT projects_type_check CHECK (type IN ('perso', 'pro', 'formation'));
-- Add missing columns to projects table
ALTER TABLE folio_app.projects
ADD COLUMN IF NOT EXISTS activities TEXT,
ADD COLUMN IF NOT EXISTS kpis JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#4f6ef7',
ADD COLUMN IF NOT EXISTS charge_hours NUMERIC(6,1),
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS deadline DATE;
-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_type ON folio_app.projects(type);
CREATE INDEX IF NOT EXISTS idx_project_phases_project_id ON folio_app.project_phases(project_id);
