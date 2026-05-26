
ALTER TABLE agent_business_analyst.pitch_prospection
  ADD COLUMN IF NOT EXISTS destinataire  text,   -- 'dsi' | 'cto' | 'dg'
  ADD COLUMN IF NOT EXISTS ton           text,   -- 'expertise' | 'business_roi' | 'casual'
  ADD COLUMN IF NOT EXISTS format_mail   text;   -- 'concis' | 'normal' | 'detaille'
;
