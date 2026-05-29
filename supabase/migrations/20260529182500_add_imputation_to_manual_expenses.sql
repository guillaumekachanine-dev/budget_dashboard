-- Add imputation fields to trip_manual_expenses
ALTER TABLE budget_dashboard.trip_manual_expenses 
ADD COLUMN IF NOT EXISTS imputation_type text not null default 'personal',
ADD COLUMN IF NOT EXISTS personal_share_ratio numeric not null default 1.0;

-- Add check constraints
ALTER TABLE budget_dashboard.trip_manual_expenses
DROP CONSTRAINT IF EXISTS chk_imputation_type,
DROP CONSTRAINT IF EXISTS chk_personal_share_ratio,
DROP CONSTRAINT IF EXISTS chk_imputation_ratio_coherence;

ALTER TABLE budget_dashboard.trip_manual_expenses
ADD CONSTRAINT chk_imputation_type CHECK (imputation_type IN ('personal', 'joint')),
ADD CONSTRAINT chk_personal_share_ratio CHECK (personal_share_ratio IN (1.0, 0.5)),
ADD CONSTRAINT chk_imputation_ratio_coherence CHECK (
  (imputation_type = 'personal' AND personal_share_ratio = 1.0) OR
  (imputation_type = 'joint' AND personal_share_ratio = 0.5)
);

-- Recreate v_trip_expenses_unified
CREATE OR REPLACE VIEW budget_dashboard.v_trip_expenses_unified AS
 SELECT 'bank'::text AS source_type,
    t.id AS source_id,
    t.trip_id,
    t.user_id,
    t.transaction_date AS expense_date,
    abs(t.amount) AS amount,
    round((abs(t.amount) * COALESCE(t.personal_share_ratio, 1.0)), 2) AS personal_amount,
    COALESCE(t.personal_share_ratio, 1.0) AS personal_share_ratio,
    t.category_id,
    c.name AS category_name,
    cp.id AS parent_category_id,
    cp.name AS parent_category_name,
    COALESCE(t.normalized_label, t.raw_label, t.merchant_name, 'Dépense voyage'::text) AS label,
    t.notes,
    NULL::uuid AS manual_expense_id,
    t.is_recurring,
    t.account_id,
    'explicit'::text AS assignment_method,
    CASE WHEN t.personal_share_ratio = 0.5 THEN 'joint'::text ELSE 'personal'::text END AS imputation_type
   FROM ((budget_dashboard.transactions t
     LEFT JOIN budget_dashboard.categories c ON ((c.id = t.category_id)))
     LEFT JOIN budget_dashboard.categories cp ON ((cp.id = c.parent_id)))
  WHERE ((t.trip_id IS NOT NULL) AND (t.is_hidden = false) AND (t.direction = 'expense'::text))

UNION ALL

 SELECT 'bank'::text AS source_type,
    t.id AS source_id,
    tr.id AS trip_id,
    t.user_id,
    t.transaction_date AS expense_date,
    abs(t.amount) AS amount,
    round((abs(t.amount) * COALESCE(t.personal_share_ratio, 1.0)), 2) AS personal_amount,
    COALESCE(t.personal_share_ratio, 1.0) AS personal_share_ratio,
    t.category_id,
    c.name AS category_name,
    cp.id AS parent_category_id,
    cp.name AS parent_category_name,
    COALESCE(t.normalized_label, t.raw_label, t.merchant_name, 'Dépense voyage'::text) AS label,
    t.notes,
    NULL::uuid AS manual_expense_id,
    t.is_recurring,
    t.account_id,
    'inferred_date_category'::text AS assignment_method,
    CASE WHEN t.personal_share_ratio = 0.5 THEN 'joint'::text ELSE 'personal'::text END AS imputation_type
   FROM (((budget_dashboard.transactions t
     JOIN budget_dashboard.trips tr ON (((t.trip_id IS NULL) AND (t.is_hidden = false) AND (t.is_recurring = false) AND (t.direction = 'expense'::text) AND (t.transaction_date >= tr.start_date) AND (t.transaction_date <= tr.end_date) AND (t.user_id = tr.user_id))))
     LEFT JOIN budget_dashboard.categories c ON ((c.id = t.category_id)))
     LEFT JOIN budget_dashboard.categories cp ON ((cp.id = c.parent_id)))
  WHERE (t.category_id = 'a975a6e6-62d9-4686-8107-f4d76a7bd93d'::uuid OR t.category_id IN (
    SELECT cat.id FROM budget_dashboard.categories cat WHERE cat.parent_id = 'a975a6e6-62d9-4686-8107-f4d76a7bd93d'::uuid
  ))

UNION ALL

 SELECT 'manual'::text AS source_type,
    me.id AS source_id,
    me.trip_id,
    me.user_id,
    me.expense_date,
    me.amount,
    round((me.amount * COALESCE(me.personal_share_ratio, 1.0)), 2) AS personal_amount,
    COALESCE(me.personal_share_ratio, 1.0) AS personal_share_ratio,
    me.category_id,
    c.name AS category_name,
    cp.id AS parent_category_id,
    cp.name AS parent_category_name,
    me.label,
    me.notes,
    me.id AS manual_expense_id,
    false AS is_recurring,
    NULL::uuid AS account_id,
    'manual_pending'::text AS assignment_method,
    me.imputation_type
   FROM ((budget_dashboard.trip_manual_expenses me
     LEFT JOIN budget_dashboard.categories c ON ((c.id = me.category_id)))
     LEFT JOIN budget_dashboard.categories cp ON ((cp.id = c.parent_id)))
  WHERE (me.status = 'pending'::text);


-- Recreate v_trip_cockpit
CREATE OR REPLACE VIEW budget_dashboard.v_trip_cockpit AS
 SELECT tr.id AS trip_id,
    tr.user_id,
    tr.name,
    tr.emoji,
    tr.start_date,
    tr.end_date,
    tr.year,
    tr.notes AS trip_notes,
    tr.planned_budget,
    COALESCE(sum(e.personal_amount) FILTER (WHERE e.source_type = 'bank'::text), 0::numeric) AS total_bank,
    COALESCE(sum(e.personal_amount) FILTER (WHERE e.source_type = 'manual'::text), 0::numeric) AS total_manual_pending,
    COALESCE(sum(e.personal_amount), 0::numeric) AS total_actual,
    COALESCE(sum(e.personal_amount), 0::numeric) AS total_personal_actual,
    COALESCE(sum(e.amount) FILTER (WHERE e.source_type = 'bank'::text), 0::numeric) AS total_bank_gross,
    COALESCE(sum(e.amount) FILTER (WHERE e.source_type = 'manual'::text), 0::numeric) AS total_manual_pending_gross,
    COALESCE(sum(e.amount), 0::numeric) AS total_actual_gross,
        CASE
            WHEN tr.planned_budget IS NOT NULL AND tr.planned_budget > 0::numeric THEN round(tr.planned_budget - COALESCE(sum(e.personal_amount), 0::numeric), 2)
            ELSE NULL::numeric
        END AS remaining,
        CASE
            WHEN tr.planned_budget IS NOT NULL AND tr.planned_budget > 0::numeric THEN round(COALESCE(sum(e.personal_amount), 0::numeric) / tr.planned_budget * 100::numeric, 1)
            ELSE NULL::numeric
        END AS consumed_pct,
    count(e.source_id) AS expense_count,
    count(e.source_id) FILTER (WHERE e.source_type = 'bank'::text) AS bank_expense_count,
    count(e.source_id) FILTER (WHERE e.source_type = 'manual'::text) AS manual_pending_count,
    count(e.source_id) FILTER (WHERE e.source_type = 'manual'::text) > 0 AS has_pending_manual,
    ( SELECT count(*) AS count
           FROM budget_dashboard.trip_manual_expenses me2
          WHERE me2.trip_id = tr.id AND me2.status = 'pending'::text) AS pending_match_count,
    tr.end_date - tr.start_date + 1 AS days_total,
        CASE
            WHEN (tr.end_date - tr.start_date + 1) > 0 THEN round(COALESCE(sum(e.personal_amount), 0::numeric) / (tr.end_date - tr.start_date + 1)::numeric, 2)
            ELSE 0::numeric
        END AS avg_per_day,
        CASE
            WHEN tr.end_date < CURRENT_DATE THEN 'past'::text
            WHEN tr.start_date > CURRENT_DATE THEN 'future'::text
            ELSE 'ongoing'::text
        END AS trip_status
   FROM budget_dashboard.trips tr
     LEFT JOIN budget_dashboard.v_trip_expenses_unified e ON e.trip_id = tr.id AND e.user_id = tr.user_id
  GROUP BY tr.id, tr.user_id, tr.name, tr.emoji, tr.start_date, tr.end_date, tr.year, tr.notes, tr.planned_budget;
