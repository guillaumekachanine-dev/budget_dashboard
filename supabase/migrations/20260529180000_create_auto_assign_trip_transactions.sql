-- Create auto_assign_trip_transactions function

CREATE OR REPLACE FUNCTION budget_dashboard.auto_assign_trip_transactions(
    p_year integer default null,
    p_dry_run boolean default true
)
RETURNS TABLE (
    processed_year integer,
    eligible_count integer,
    assigned_count integer,
    skipped_ambiguous_count integer
) AS $$
DECLARE
    v_assigned_count integer := 0;
    v_skipped_ambiguous_count integer := 0;
    v_eligible_count integer := 0;
BEGIN
    DROP TABLE IF EXISTS temp_matching_candidates;

    -- 1. Temp table containing eligible transaction candidates and their matching trip counts
    CREATE TEMP TABLE temp_matching_candidates ON COMMIT DROP AS
    WITH voyages_cats AS (
        SELECT id FROM budget_dashboard.categories WHERE parent_id = 'a975a6e6-62d9-4686-8107-f4d76a7bd93d'::uuid
        UNION ALL
        SELECT 'a975a6e6-62d9-4686-8107-f4d76a7bd93d'::uuid AS id
    ),
    matched_trips AS (
        SELECT 
            t.id AS transaction_id,
            tr.id AS trip_id
        FROM budget_dashboard.transactions t
        JOIN budget_dashboard.trips tr ON (
            t.trip_id IS NULL AND
            t.is_hidden = false AND
            t.is_recurring = false AND
            t.direction = 'expense'::text AND
            t.transaction_date >= tr.start_date AND
            t.transaction_date <= tr.end_date AND
            t.user_id = tr.user_id AND
            (p_year IS NULL OR tr.year = p_year)
        )
        WHERE t.category_id IN (SELECT id FROM voyages_cats)
    ),
    grouped AS (
        SELECT 
            transaction_id,
            count(trip_id) AS matches_count,
            min(trip_id::text)::uuid AS single_trip_id -- Will be the trip_id if matches_count = 1
        FROM matched_trips
        GROUP BY transaction_id
    )
    SELECT * FROM grouped;

    -- 2. Calculate counts
    SELECT COALESCE(count(*), 0) INTO v_eligible_count FROM temp_matching_candidates;
    SELECT COALESCE(count(*), 0) INTO v_assigned_count FROM temp_matching_candidates WHERE matches_count = 1;
    SELECT COALESCE(count(*), 0) INTO v_skipped_ambiguous_count FROM temp_matching_candidates WHERE matches_count > 1;

    -- 3. Perform update if not dry-run
    IF NOT p_dry_run THEN
        UPDATE budget_dashboard.transactions t
        SET trip_id = tc.single_trip_id
        FROM temp_matching_candidates tc
        WHERE t.id = tc.transaction_id AND tc.matches_count = 1;
    END IF;

    -- 4. Return report
    RETURN QUERY SELECT p_year, v_eligible_count, v_assigned_count, v_skipped_ambiguous_count;
END;
$$ LANGUAGE plpgsql;

-- Create preview view
CREATE OR REPLACE VIEW budget_dashboard.v_auto_assign_trip_transactions_preview AS
WITH voyages_cats AS (
    SELECT id FROM budget_dashboard.categories WHERE parent_id = 'a975a6e6-62d9-4686-8107-f4d76a7bd93d'::uuid
    UNION ALL
    SELECT 'a975a6e6-62d9-4686-8107-f4d76a7bd93d'::uuid AS id
),
matched_trips AS (
    SELECT 
        t.id AS transaction_id,
        t.transaction_date,
        t.raw_label,
        t.normalized_label,
        t.amount,
        t.category_id,
        t.user_id,
        tr.id AS trip_id,
        tr.name AS trip_name,
        tr.start_date,
        tr.end_date
    FROM budget_dashboard.transactions t
    JOIN budget_dashboard.trips tr ON (
        t.trip_id IS NULL AND
        t.is_hidden = false AND
        t.is_recurring = false AND
        t.direction = 'expense'::text AND
        t.transaction_date >= tr.start_date AND
        t.transaction_date <= tr.end_date AND
        t.user_id = tr.user_id
    )
    WHERE t.category_id IN (SELECT id FROM voyages_cats)
),
counts AS (
    SELECT 
        transaction_id,
        count(trip_id) AS matches_count
    FROM matched_trips
    GROUP BY transaction_id
)
SELECT 
    mt.transaction_id,
    mt.transaction_date,
    mt.raw_label,
    mt.normalized_label,
    mt.amount,
    mt.category_id,
    mt.trip_id,
    mt.trip_name,
    CASE 
        WHEN c.matches_count = 1 THEN 'assignable'::text
        ELSE 'ambiguous'::text
    END AS status
FROM matched_trips mt
JOIN counts c ON mt.transaction_id = c.transaction_id;
