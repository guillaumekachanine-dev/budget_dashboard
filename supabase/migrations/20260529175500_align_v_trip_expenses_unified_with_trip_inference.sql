-- Align v_trip_expenses_unified with v_trip_transactions auto-inference logic

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
    'explicit'::text AS assignment_method
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
    'inferred_date_category'::text AS assignment_method
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
    me.amount AS personal_amount,
    1.0 AS personal_share_ratio,
    me.category_id,
    c.name AS category_name,
    cp.id AS parent_category_id,
    cp.name AS parent_category_name,
    me.label,
    me.notes,
    me.id AS manual_expense_id,
    false AS is_recurring,
    NULL::uuid AS account_id,
    'manual_pending'::text AS assignment_method
   FROM ((budget_dashboard.trip_manual_expenses me
     LEFT JOIN budget_dashboard.categories c ON ((c.id = me.category_id)))
     LEFT JOIN budget_dashboard.categories cp ON ((cp.id = c.parent_id)))
  WHERE (me.status = 'pending'::text);
