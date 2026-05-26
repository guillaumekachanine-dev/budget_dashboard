
-- 1. Colonne statut_pitch dans missions
ALTER TABLE agent_business_analyst.missions
  ADD COLUMN IF NOT EXISTS statut_pitch text NOT NULL DEFAULT 'pending';

-- 2. Table dédiée pitch_prospection
CREATE TABLE agent_business_analyst.pitch_prospection (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id      uuid NOT NULL REFERENCES agent_business_analyst.missions(id) ON DELETE CASCADE,

  -- Interlocuteur ciblé
  contact_prenom  text NOT NULL,
  contact_nom     text NOT NULL,
  contact_fonction text NOT NULL,
  contact_email   text,

  -- Contenu généré
  objet_mail      text,          -- Sujet de l'email
  corps_mail      text,          -- Corps complet du mail
  points_cles     jsonb,         -- Tableau des arguments-clés mis en avant

  -- Méta
  statut          text NOT NULL DEFAULT 'pending',  -- pending | running | review | error
  tokens_input    integer DEFAULT 0,
  tokens_output   integer DEFAULT 0,
  cout_estime     numeric DEFAULT 0,
  started_at      timestamptz DEFAULT now(),
  completed_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 3. Grants service_role
GRANT ALL ON agent_business_analyst.pitch_prospection TO service_role;
;
