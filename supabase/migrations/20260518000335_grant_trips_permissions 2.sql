
GRANT SELECT, INSERT, UPDATE, DELETE ON budget_dashboard.trips TO authenticated;
GRANT SELECT ON budget_dashboard.v_trip_transactions TO authenticated;
ALTER VIEW budget_dashboard.v_trip_transactions SET (security_invoker = true);
;
