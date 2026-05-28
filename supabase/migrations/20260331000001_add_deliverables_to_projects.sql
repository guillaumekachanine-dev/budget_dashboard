-- Add missing deliverables column to projects table
ALTER TABLE folio_app.projects
ADD COLUMN IF NOT EXISTS deliverables TEXT;
