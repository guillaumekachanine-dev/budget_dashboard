
-- Table de correspondance merchant → catégorie pour guider le LLM dans n8n
CREATE TABLE IF NOT EXISTS budget_dashboard.category_mapping (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL,
  keyword      text        NOT NULL,        -- ex: 'CARREFOUR', 'EDF', 'SPOTIFY'
  category_id  uuid        REFERENCES budget_dashboard.categories(id) ON DELETE SET NULL,
  priority     integer     NOT NULL DEFAULT 0,   -- ordre de priorité (plus haut = prioritaire)
  is_regex     boolean     NOT NULL DEFAULT false,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at   timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- RLS — même pattern que les autres tables
ALTER TABLE budget_dashboard.category_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own rows select" ON budget_dashboard.category_mapping
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "own rows insert" ON budget_dashboard.category_mapping
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "own rows update" ON budget_dashboard.category_mapping
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "own rows delete" ON budget_dashboard.category_mapping
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Index pour le lookup keyword par user
CREATE INDEX IF NOT EXISTS idx_category_mapping_lookup
  ON budget_dashboard.category_mapping(user_id, priority DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION budget_dashboard.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER category_mapping_updated_at
  BEFORE UPDATE ON budget_dashboard.category_mapping
  FOR EACH ROW EXECUTE FUNCTION budget_dashboard.set_updated_at();
;
