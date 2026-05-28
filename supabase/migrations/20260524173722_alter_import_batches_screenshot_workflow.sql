
-- Colonnes nécessaires au workflow screenshot → n8n → staging
ALTER TABLE budget_dashboard.import_batches
  ADD COLUMN IF NOT EXISTS category_hint text,        -- 'operations' | 'savings_snapshot'
  ADD COLUMN IF NOT EXISTS period_start  date,        -- début de la période couverte
  ADD COLUMN IF NOT EXISTS period_end    date,        -- fin de la période couverte
  ADD COLUMN IF NOT EXISTS directive     text,        -- directive libre pour le LLM
  ADD COLUMN IF NOT EXISTS error_log     jsonb,       -- erreurs n8n
  ADD COLUMN IF NOT EXISTS llm_model     text;        -- ex: 'claude-3-5-sonnet-20241022'

-- Contrainte CHECK pour documenter les statuts valides
-- 'pending' = valeur historique, on la conserve pour compatibilité
ALTER TABLE budget_dashboard.import_batches
  DROP CONSTRAINT IF EXISTS import_batches_status_check;

ALTER TABLE budget_dashboard.import_batches
  ADD CONSTRAINT import_batches_status_check
  CHECK (status IN ('pending', 'processing', 'pending_review', 'completed', 'rejected', 'error'));
;
