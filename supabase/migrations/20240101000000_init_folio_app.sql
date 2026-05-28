-- ============================================================
-- FOLIO APP — Initial Schema Migration
-- Schema: folio_app (NEVER public)
-- RLS: enabled on all tables, policy: authenticated user has full access
-- ============================================================

-- Create the schema
CREATE SCHEMA IF NOT EXISTS folio_app;
-- gen_random_uuid() is native in PostgreSQL 13+ — no extension needed


-- ─── PROJECTS ────────────────────────────────────────────────────────────────

CREATE TABLE folio_app.projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('perso', 'pro')),
  description   TEXT,
  objective     TEXT,
  context       TEXT,
  means         TEXT,
  client_id     UUID,
  cover_image_url TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE folio_app.project_phases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES folio_app.projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE folio_app.project_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id        UUID NOT NULL REFERENCES folio_app.project_phases(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES folio_app.projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  order_index     INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'backlog'
                    CHECK (status IN ('backlog','planifie','en_cours','en_validation','termine')),
  start_date      DATE,
  deadline        DATE,
  charge_hours    NUMERIC(6,1),
  priority        INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  deliverables    TEXT,
  notes           TEXT,
  is_sub_project  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE folio_app.sub_projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_step_id  UUID NOT NULL REFERENCES folio_app.project_steps(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE folio_app.sub_project_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_project_id  UUID NOT NULL REFERENCES folio_app.sub_projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  order_index     INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'backlog'
                    CHECK (status IN ('backlog','planifie','en_cours','en_validation','termine')),
  start_date      DATE,
  deadline        DATE,
  charge_hours    NUMERIC(6,1),
  priority        INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  deliverables    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE folio_app.project_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES folio_app.projects(id) ON DELETE CASCADE,
  step_id     UUID REFERENCES folio_app.project_steps(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'link' CHECK (type IN ('upload', 'link')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- ─── PROSPECTION ─────────────────────────────────────────────────────────────

CREATE TABLE folio_app.clients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  sector              TEXT,
  logo_url            TEXT,
  website             TEXT,
  status              TEXT NOT NULL DEFAULT 'prospect'
                        CHECK (status IN ('prospect','contact','proposal','won','lost','inactive')),
  notes               TEXT,
  ai_analysis         JSONB,
  ai_sector_analysis  JSONB,
  last_contacted_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE folio_app.client_contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES folio_app.clients(id) ON DELETE CASCADE,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  role          TEXT,
  email         TEXT,
  phone         TEXT,
  linkedin_url  TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE folio_app.contact_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES folio_app.client_contacts(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES folio_app.clients(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('call','email','meeting','note','proposal')),
  summary     TEXT NOT NULL,
  date        DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- ─── BUDGET ───────────────────────────────────────────────────────────────────

CREATE TABLE folio_app.budget_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('income','expense')),
  color       TEXT,
  icon        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE folio_app.budget_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id           UUID REFERENCES folio_app.budget_categories(id) ON DELETE SET NULL,
  label                 TEXT NOT NULL,
  amount                NUMERIC(12,2) NOT NULL,
  type                  TEXT NOT NULL CHECK (type IN ('income','expense')),
  date                  DATE NOT NULL,
  is_recurring          BOOLEAN NOT NULL DEFAULT false,
  recurrence_interval   TEXT CHECK (recurrence_interval IN ('weekly','monthly','yearly')),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- ─── PLANNING ─────────────────────────────────────────────────────────────────

CREATE TABLE folio_app.planning_schedule (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  start_date   DATE NOT NULL,
  end_date     DATE,
  all_day      BOOLEAN NOT NULL DEFAULT true,
  category     TEXT NOT NULL DEFAULT 'perso'
                 CHECK (category IN ('projet','formation','perso','pro')),
  source_type  TEXT CHECK (source_type IN ('step','formation','manual')),
  source_id    UUID,
  status       TEXT NOT NULL DEFAULT 'planifie'
                 CHECK (status IN ('backlog','planifie','en_cours','en_validation','termine')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- ─── FORMATIONS ───────────────────────────────────────────────────────────────

CREATE TABLE folio_app.formations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  provider     TEXT,
  start_date   DATE,
  end_date     DATE,
  status       TEXT NOT NULL DEFAULT 'planifie'
                 CHECK (status IN ('backlog','planifie','en_cours','en_validation','termine')),
  url          TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE folio_app.formations_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id  UUID NOT NULL REFERENCES folio_app.formations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'link' CHECK (type IN ('upload','link')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- ─── AI NEWS ──────────────────────────────────────────────────────────────────

CREATE TABLE folio_app.ai_news_digests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE NOT NULL,
  category       TEXT NOT NULL CHECK (category IN ('business','llm','frontier','youtube')),
  content        TEXT NOT NULL,
  article_count  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (date, category)
);
CREATE TABLE folio_app.ai_news_articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  url           TEXT,
  summary       TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('business','llm','frontier','youtube')),
  source        TEXT,
  published_at  TIMESTAMPTZ,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  digest_id     UUID REFERENCES folio_app.ai_news_digests(id) ON DELETE SET NULL
);
-- ─── MISC ─────────────────────────────────────────────────────────────────────

CREATE TABLE folio_app.activity_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    UUID NOT NULL,
  summary      TEXT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE folio_app.item_customizations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type      TEXT NOT NULL,
  entity_id        UUID NOT NULL,
  cover_image_url  TEXT,
  color            TEXT,
  icon             TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id)
);
-- ─── INDEXES ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_project_phases_project_id ON folio_app.project_phases(project_id);
CREATE INDEX idx_project_steps_phase_id    ON folio_app.project_steps(phase_id);
CREATE INDEX idx_project_steps_project_id  ON folio_app.project_steps(project_id);
CREATE INDEX idx_project_steps_status      ON folio_app.project_steps(status);
CREATE INDEX idx_project_steps_deadline    ON folio_app.project_steps(deadline);
CREATE INDEX idx_client_contacts_client_id ON folio_app.client_contacts(client_id);
CREATE INDEX idx_budget_transactions_date  ON folio_app.budget_transactions(date);
CREATE INDEX idx_budget_transactions_type  ON folio_app.budget_transactions(type);
CREATE INDEX idx_planning_start_date       ON folio_app.planning_schedule(start_date);
CREATE INDEX idx_ai_news_articles_category ON folio_app.ai_news_articles(category);
CREATE INDEX idx_ai_news_articles_ingested ON folio_app.ai_news_articles(ingested_at DESC);
CREATE INDEX idx_ai_news_digests_date      ON folio_app.ai_news_digests(date DESC);
CREATE INDEX idx_activity_events_entity    ON folio_app.activity_events(entity_type, entity_id);
-- ─── updated_at TRIGGER ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION folio_app.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'projects','project_phases','project_steps','sub_projects','sub_project_steps',
    'clients','client_contacts','budget_transactions','planning_schedule',
    'formations','item_customizations'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_updated_at BEFORE UPDATE ON folio_app.%I
       FOR EACH ROW EXECUTE FUNCTION folio_app.set_updated_at()',
      tbl
    );
  END LOOP;
END;
$$;
-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- App is mono-user. Policy: authenticated user has full access on all tables.

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'projects','project_phases','project_steps','sub_projects','sub_project_steps',
    'project_documents','clients','client_contacts','contact_activities',
    'budget_categories','budget_transactions','planning_schedule',
    'formations','formations_documents','ai_news_digests','ai_news_articles',
    'activity_events','item_customizations'
  ] LOOP
    EXECUTE format('ALTER TABLE folio_app.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY "authenticated_full_access" ON folio_app.%I
       FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      tbl
    );
  END LOOP;
END;
$$;
