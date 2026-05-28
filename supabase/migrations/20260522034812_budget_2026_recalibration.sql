-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION : Budget 2026 — Recalibration complète
-- Date : 2026-05-22
-- Méthode par bucket :
--   socle_fixe           → somme des récurrences actives (recurring_obligations)
--   variable_essentielle → médiane rolling 12 mois ± correction intentionnelle
--   provision            → total annuel estimé ÷ 12, concentré sur les mois actifs
--   discretionnaire      → médiane rolling 12 mois × coefficient d'intention
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Partie 1 : upsert de toutes les lignes budgétaires pilotage ──────────────

WITH budget_data(category_id, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12) AS (
  VALUES
  -- ── SOCLE FIXE ──────────────────────────────────────────────────────────────
  -- Loyer/crédit : 330€ fixe
  ('89825ac5-1916-4a97-a623-ada8327b7b2d'::uuid, 330.00,330.00,330.00,330.00,330.00,330.00,330.00,330.00,330.00,330.00,330.00,330.00),
  -- Box stockage : 146€ jan-avr, 73€ mai-déc (partagé 50/50 compte joint)
  ('b6b57caa-82df-48b8-b883-9638070560c5'::uuid, 146.00,146.00,146.00,146.00, 73.00, 73.00, 73.00, 73.00, 73.00, 73.00, 73.00, 73.00),
  -- LLM (ChatGPT 23€ + Claude 21.60€ + Gemini 7.99€) = 52.59€
  ('94782c8a-e0bc-4fcb-83da-9d0538d30e78'::uuid,  52.59, 52.59, 52.59, 52.59, 52.59, 52.59, 52.59, 52.59, 52.59, 52.59, 52.59, 52.59),
  -- Assurance auto : 62€/mois
  ('136995f7-74ce-4a8b-8433-668d353dc701'::uuid,  62.00, 62.00, 62.00, 62.00, 62.00, 62.00, 62.00, 62.00, 62.00, 62.00, 62.00, 62.00),
  -- Électricité : médiane 12 mois = 29€
  ('bebb7217-200e-4d16-849e-b6cd14e93ce3'::uuid,  29.00, 29.00, 29.00, 29.00, 29.00, 29.00, 29.00, 29.00, 29.00, 29.00, 29.00, 29.00),
  -- Charges logement : médiane 12 mois = 58€
  ('9066566e-a623-4179-8ab3-9181c02eff68'::uuid,  58.00, 58.00, 58.00, 58.00, 58.00, 58.00, 58.00, 58.00, 58.00, 58.00, 58.00, 58.00),
  -- Téléphone mobile : 15.99€ (Orange, fixe)
  ('64922f30-6f58-4d2b-a347-ecc7188f745d'::uuid,  15.99, 15.99, 15.99, 15.99, 15.99, 15.99, 15.99, 15.99, 15.99, 15.99, 15.99, 15.99),
  -- IT (iCloud+ 2.99€ + Google One 1.99€ + YouTube Premium 12.99€) = 17.97€
  ('fcc861cf-2238-4f0d-831f-3ace93f4f503'::uuid,  17.97, 17.97, 17.97, 17.97, 17.97, 17.97, 17.97, 17.97, 17.97, 17.97, 17.97, 17.97),
  -- Autres abonnements : 4€ jan-avr, 8€ mai-déc (Netflix 7.99€ × 0.5 ajouté)
  ('a4494cdc-d3fd-46bb-934a-b9331eead659'::uuid,   4.00,  4.00,  4.00,  4.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00),
  -- Frais bancaires (cotisations fixes BP) : 7.10€
  ('f50868fc-4de2-4651-b09f-de315d7e929e'::uuid,   7.10,  7.10,  7.10,  7.10,  7.10,  7.10,  7.10,  7.10,  7.10,  7.10,  7.10,  7.10),
  -- Assurance habitation : 15€/mois × 0.5 (partagé) = 7.50€
  ('7d2ba7c0-1ff8-4001-ba9a-05002a16e883'::uuid,   7.50,  7.50,  7.50,  7.50,  7.50,  7.50,  7.50,  7.50,  7.50,  7.50,  7.50,  7.50),
  -- Internet logement : 19.99€/mois × 0.5 (partagé) = 10€
  ('08f5dba6-2730-457b-93f7-24140d04e150'::uuid,  10.00, 10.00, 10.00, 10.00, 10.00, 10.00, 10.00, 10.00, 10.00, 10.00, 10.00, 10.00),
  -- Ménage (Logement) : 90€/mois × 0.5 (partagé) = 45€ — démarre mai 2026
  ('e530a320-eb46-4fc5-8f92-7faefacd6f33'::uuid,   0.00,  0.00,  0.00,  0.00, 45.00, 45.00, 45.00, 45.00, 45.00, 45.00, 45.00, 45.00),

  -- ── VARIABLE ESSENTIELLE ────────────────────────────────────────────────────
  -- Courses : médiane 12 mois = 229€ → 230€
  ('0ca5d9ef-c516-4a1c-9dbe-45f9f6cd745b'::uuid, 230.00,230.00,230.00,230.00,230.00,230.00,230.00,230.00,230.00,230.00,230.00,230.00),
  -- Achats bébé : médiane 12 mois = 127€ → 130€
  ('55ef5a28-ae75-49ca-85d7-27d95defba7f'::uuid, 130.00,130.00,130.00,130.00,130.00,130.00,130.00,130.00,130.00,130.00,130.00,130.00),
  -- Coiffeur : médiane 12 mois = 29.75€ → 30€
  ('fdc7d61b-660d-4435-86fa-932ccc8beef3'::uuid,  30.00, 30.00, 30.00, 30.00, 30.00, 30.00, 30.00, 30.00, 30.00, 30.00, 30.00, 30.00),
  -- Carburant : intention utilisateur = 100€/mois
  ('b2062882-2ba3-40a2-8141-dd4e993ad26f'::uuid, 100.00,100.00,100.00,100.00,100.00,100.00,100.00,100.00,100.00,100.00,100.00,100.00),
  -- Péage : médiane 12 mois = 6.25€ → 8€
  ('7d8af098-1e12-44d8-a86c-88a649e14cfe'::uuid,   8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00),
  -- Transport public : médiane 12 mois = 4.68€ → 8€
  ('335f546f-8f63-4073-91b0-4f0fc53aef8d'::uuid,   8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00),
  -- Parking : médiane 12 mois = 5.20€ → 8€
  ('eac5f19e-2455-49ee-b24b-ca1510467431'::uuid,   8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00),
  -- Pharmacie : annualisé ~96€/an → 8€/mois
  ('e5698e8e-09ff-4496-984d-dc1e6e206e6f'::uuid,   8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00),
  -- Optique : sporadic (~80€ quand actif, 1/an) → annualisé 7€/mois
  ('0fd624d7-93fa-40aa-8335-872a52e4f5de'::uuid,   7.00,  7.00,  7.00,  7.00,  7.00,  7.00,  7.00,  7.00,  7.00,  7.00,  7.00,  7.00),

  -- ── PROVISIONS ──────────────────────────────────────────────────────────────
  -- Cadeaux : budget annuel 1000€ lissé = 83€/mois
  ('9f2478b6-c10d-4a19-b250-db8ab2135d55'::uuid,  83.00, 83.00, 83.00, 83.00, 83.00, 83.00, 83.00, 83.00, 83.00, 83.00, 83.00, 83.00),
  -- Impôts : 0€ jan-aoû, 310€ sep-déc (×4 = 1240€/an, pattern 2025 reconduit)
  ('f31e8dbe-db91-4c3d-8d95-5ae72fdfc26d'::uuid,   0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00,  0.00,310.00,310.00,310.00,310.00),
  -- Formations : retroactif jan-avr 135€ (1608/12) | 0 mai | 125 juin-juil (250€ total) | 0 aoû-déc
  ('b74ba5fd-344f-4dde-86c5-5d4f67d1c1a6'::uuid, 135.00,135.00,135.00,135.00,  0.00,125.00,125.00,  0.00,  0.00,  0.00,  0.00,  0.00),
  -- Achats professionnels : provision 100€/mois
  ('e001158e-5f46-4da9-9e72-6391efb4b94a'::uuid, 100.00,100.00,100.00,100.00,100.00,100.00,100.00,100.00,100.00,100.00,100.00,100.00),
  -- Dépense exceptionnelle : coussin de sécurité 80€/mois
  ('77437c76-b278-4b1d-b155-d9c23fec1b2b'::uuid,  80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00),
  -- Entretien véhicule : ~170€/an → 15€/mois
  ('fc53d342-062a-47b5-94e5-c0367edceb7a'::uuid,  15.00, 15.00, 15.00, 15.00, 15.00, 15.00, 15.00, 15.00, 15.00, 15.00, 15.00, 15.00),
  -- Médecin/soins : ~96€/an → 8€/mois
  ('3a7a3a1c-8d57-4ef0-a8c8-dabcff12b58f'::uuid,   8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00,  8.00),
  -- Logement voyage : ventilé par trip (avr=Budapest, mai=Camargue, juin=Bucarest+Belgrade, aoû=Jura, oct=Paris)
  ('1e0fbcd1-1183-42af-a73a-4e5ffd7dea62'::uuid,   0.00,  0.00,  0.00,200.00,100.00,500.00,  0.00,800.00,  0.00,200.00,  0.00,  0.00),
  -- Trajet voyage : ventilé par trip
  ('fc0e644a-6082-42d0-b2d4-c947b4d7f8a2'::uuid,   0.00,  0.00,  0.00,200.00,100.00,350.00,  0.00,100.00,  0.00,100.00,  0.00,  0.00),
  -- Repas voyage : ventilé par trip
  ('a64508ca-1f7f-4a62-a5d4-7adcc6061fc3'::uuid,   0.00,  0.00,  0.00, 70.00, 50.00,250.00,  0.00,500.00,  0.00,150.00,  0.00,  0.00),
  -- Activités voyage : ventilé par trip
  ('acacac44-fecb-46f3-972f-e0c54704c6b3'::uuid,   0.00,  0.00,  0.00, 30.00, 30.00,100.00,  0.00,200.00,  0.00, 50.00,  0.00,  0.00),

  -- ── DISCRÉTIONNAIRE ─────────────────────────────────────────────────────────
  -- Retrait d'espèces : 500€ jan-mai (historique), 320€ juin-déc (intention ÷2)
  ('cac78d28-95d8-4b27-ad69-c3a721b2e441'::uuid, 500.00,500.00,500.00,500.00,500.00,320.00,320.00,320.00,320.00,320.00,320.00,320.00),
  -- Petits achats alimentaires : médiane 202€ → 200€
  ('26705eb6-da60-47a5-be25-4ed3c6160944'::uuid, 200.00,200.00,200.00,200.00,200.00,200.00,200.00,200.00,200.00,200.00,200.00,200.00),
  -- Restaurant : médiane 88€ → 90€
  ('23a73f75-86f6-436a-a247-e572c7e59953'::uuid,  90.00, 90.00, 90.00, 90.00, 90.00, 90.00, 90.00, 90.00, 90.00, 90.00, 90.00, 90.00),
  -- Divers : médiane 93€ → 80€
  ('45e43429-edda-445e-bbd3-a5fc64e32e82'::uuid,  80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00),
  -- Alimentation rapide : médiane 68€ → 70€
  ('7f36cd1e-382f-49d7-bb9b-365b94e5c662'::uuid,  70.00, 70.00, 70.00, 70.00, 70.00, 70.00, 70.00, 70.00, 70.00, 70.00, 70.00, 70.00),
  -- Café/bars : intention maintenir à 80€
  ('caca21fd-1c3c-4175-a868-972d962d5901'::uuid,  80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00, 80.00),
  -- Vêtements : médiane ~40€ → 40€
  ('7f37d3d2-936f-4f63-aeb7-a65c1e0bdff8'::uuid,  40.00, 40.00, 40.00, 40.00, 40.00, 40.00, 40.00, 40.00, 40.00, 40.00, 40.00, 40.00),
  -- Achats maison : médiane 1€ → 5€
  ('ba5352f4-9821-48e9-97d2-a393e15a6315'::uuid,   5.00,  5.00,  5.00,  5.00,  5.00,  5.00,  5.00,  5.00,  5.00,  5.00,  5.00,  5.00),
  -- Froustilles voyage : 20€
  ('39adc1a6-713d-4821-af5b-14fa46dfa60d'::uuid,  20.00, 20.00, 20.00, 20.00, 20.00, 20.00, 20.00, 20.00, 20.00, 20.00, 20.00, 20.00),
  -- Autres sorties : médiane ~0€ → 15€ (micro-coussin)
  ('26e50cfd-0b11-484b-b5f4-9bc29fe5a5c2'::uuid,  15.00, 15.00, 15.00, 15.00, 15.00, 15.00, 15.00, 15.00, 15.00, 15.00, 15.00, 15.00),
  -- Culture/loisirs : médiane ~0€ → 10€ (micro-coussin)
  ('42ba71f3-d92b-44dd-acad-22ae86f91f52'::uuid,  10.00, 10.00, 10.00, 10.00, 10.00, 10.00, 10.00, 10.00, 10.00, 10.00, 10.00, 10.00)
),
period_map AS (
  SELECT id AS period_id, period_month
  FROM budget_dashboard.budget_periods
  WHERE period_year = 2026
),
desired AS (
  SELECT
    pm.period_id,
    bd.category_id,
    CASE pm.period_month
      WHEN  1 THEN bd.m1  WHEN  2 THEN bd.m2  WHEN  3 THEN bd.m3  WHEN  4 THEN bd.m4
      WHEN  5 THEN bd.m5  WHEN  6 THEN bd.m6  WHEN  7 THEN bd.m7  WHEN  8 THEN bd.m8
      WHEN  9 THEN bd.m9  WHEN 10 THEN bd.m10 WHEN 11 THEN bd.m11 WHEN 12 THEN bd.m12
    END AS amount
  FROM budget_data bd
  CROSS JOIN period_map pm
),
upd AS (
  UPDATE budget_dashboard.budgets b
  SET amount     = d.amount,
      updated_at = NOW()
  FROM desired d
  WHERE b.period_id   = d.period_id
    AND b.category_id = d.category_id
  RETURNING b.period_id, b.category_id
)
INSERT INTO budget_dashboard.budgets (id, user_id, period_id, category_id, budget_kind, amount, currency, notes)
SELECT
  gen_random_uuid(),
  (SELECT user_id FROM budget_dashboard.budget_periods LIMIT 1),
  d.period_id,
  d.category_id,
  'category',
  d.amount,
  'EUR',
  'Budget 2026 recalibré le 2026-05-22'
FROM desired d
WHERE d.amount > 0
  AND NOT EXISTS (SELECT 1 FROM upd u WHERE u.period_id = d.period_id AND u.category_id = d.category_id)
  AND NOT EXISTS (SELECT 1 FROM budget_dashboard.budgets b WHERE b.period_id = d.period_id AND b.category_id = d.category_id);

-- ── Partie 2 : voyages 2026 ──────────────────────────────────────────────────
-- Budapest et Camargue déjà insérés. Ajout des 4 trips restants.
INSERT INTO budget_dashboard.trips (id, user_id, name, start_date, end_date, emoji, notes)
VALUES
  (gen_random_uuid(), (SELECT user_id FROM budget_dashboard.budget_periods LIMIT 1), 'Bucarest', '2026-06-01', '2026-06-07',  '🏰', 'Budget 500€'),
  (gen_random_uuid(), (SELECT user_id FROM budget_dashboard.budget_periods LIMIT 1), 'Belgrade',  '2026-06-18', '2026-06-25', '🇷🇸', 'Budget 700€'),
  (gen_random_uuid(), (SELECT user_id FROM budget_dashboard.budget_periods LIMIT 1), 'Jura',      '2026-08-01', '2026-08-15', '🏔️', 'Budget 1600€'),
  (gen_random_uuid(), (SELECT user_id FROM budget_dashboard.budget_periods LIMIT 1), 'Paris',     '2026-10-10', '2026-10-14', '🗼', 'Budget 500€')
ON CONFLICT DO NOTHING;
