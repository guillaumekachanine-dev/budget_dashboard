---
name: budget-dashboard-data-ux
description: Use when displaying Supabase analytics payloads in the budget_dashboard app. Focus on null handling, loading states, empty states, data freshness, and avoiding misleading zeros.
---

Data UX rules:
- null/undefined => display "—"
- real 0 => display 0
- no data array => show a useful empty state, not an error
- partial analytics => show "Données en consolidation"
- never fallback to hardcoded amounts
- never recompute primary DB metrics when already provided by RPC/views
- show data source/freshness only when useful
- distinguish actual, forecast, projected, and incomplete metrics