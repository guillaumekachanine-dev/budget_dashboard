
-- =========================================================
-- TRIPS TABLE
-- =========================================================
CREATE TABLE budget_dashboard.trips (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  start_date date NOT NULL,
  end_date   date NOT NULL,
  year       int GENERATED ALWAYS AS (EXTRACT(year FROM start_date)::int) STORED,
  emoji      text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_trips_user_year ON budget_dashboard.trips(user_id, year);

-- updated_at trigger
CREATE OR REPLACE FUNCTION budget_dashboard.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trips_updated_at
  BEFORE UPDATE ON budget_dashboard.trips
  FOR EACH ROW EXECUTE FUNCTION budget_dashboard.set_updated_at();

-- RLS
ALTER TABLE budget_dashboard.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_trips" ON budget_dashboard.trips
  FOR ALL USING (auth.uid() = user_id);

-- =========================================================
-- trip_id COLUMN ON TRANSACTIONS (manual override)
-- =========================================================
ALTER TABLE budget_dashboard.transactions
  ADD COLUMN trip_id uuid REFERENCES budget_dashboard.trips(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_trip_id ON budget_dashboard.transactions(trip_id);

-- =========================================================
-- VIEW: v_trip_transactions
-- Joins transactions to trips via:
--   1. manual trip_id (pre-trip bookings, any category, any date)
--   2. auto: voyages category + non-recurring + within trip dates
-- =========================================================
CREATE OR REPLACE VIEW budget_dashboard.v_trip_transactions AS
WITH voyages_cats AS (
  SELECT id FROM budget_dashboard.categories
  WHERE parent_id = 'a975a6e6-62d9-4686-8107-f4d76a7bd93d'::uuid
  UNION ALL
  SELECT 'a975a6e6-62d9-4686-8107-f4d76a7bd93d'::uuid
)
SELECT
  t.id,
  t.user_id,
  t.account_id,
  t.category_id,
  t.transaction_date,
  t.amount,
  t.direction,
  t.raw_label,
  t.normalized_label,
  t.merchant_name,
  t.is_recurring,
  t.notes,
  t.personal_share_ratio,
  t.personal_scope,
  t.trip_id                    AS manual_trip_id,
  tr.id                        AS trip_id,
  tr.name                      AS trip_name,
  tr.start_date                AS trip_start,
  tr.end_date                  AS trip_end,
  tr.year                      AS trip_year,
  (t.trip_id = tr.id)          AS is_manual
FROM budget_dashboard.transactions t
JOIN budget_dashboard.trips tr ON (
  t.trip_id = tr.id
  OR (
    t.trip_id IS NULL
    AND t.is_recurring = false
    AND t.is_hidden = false
    AND t.direction = 'debit'
    AND t.transaction_date BETWEEN tr.start_date AND tr.end_date
    AND t.category_id IN (SELECT id FROM voyages_cats)
    AND t.user_id = tr.user_id
  )
)
WHERE t.is_hidden = false;
;
