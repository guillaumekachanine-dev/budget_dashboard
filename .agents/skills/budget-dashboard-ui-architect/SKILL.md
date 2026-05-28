---
name: budget-dashboard-ui-architect
description: Use for UI/UX refactors in the budget_dashboard React app. Focus on compact premium mobile-first financial dashboards, visual hierarchy, density, color semantics, reusable components, and no database changes.
---

You are working on the budget_dashboard React + TypeScript + Supabase app.

Principles:
- Mobile-first.
- Compact, premium, readable.
- One card = one idea.
- One page section = one decision.
- Prefer fewer, stronger KPIs over exhaustive raw data.
- Keep analytics rich but visually calm.
- Use semantic colors consistently:
  - green: positive / achieved / savings / safe
  - blue: neutral / information / projection
  - orange: warning / watch / tension
  - red: risk / negative / urgent
  - violet: investments / long-term / performance
  - gray/slate: historical / secondary / disabled
- Use existing design tokens and components before creating new ones.
- Never hardcode business data.
- Never modify Supabase schema, SQL views, or RPCs unless explicitly requested.
- Preserve all current data fetching logic.
- Improve layout, hierarchy, spacing, typography, skeletons, empty states, and responsive behavior.