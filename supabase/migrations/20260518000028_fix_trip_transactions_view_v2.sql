
DROP VIEW budget_dashboard.v_trip_transactions;

CREATE VIEW budget_dashboard.v_trip_transactions AS
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
  tr.emoji                     AS trip_emoji,
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
    AND t.direction = 'expense'
    AND t.transaction_date BETWEEN tr.start_date AND tr.end_date
    AND t.category_id IN (SELECT id FROM voyages_cats)
    AND t.user_id = tr.user_id
  )
)
WHERE t.is_hidden = false;
;
