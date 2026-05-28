---
name: budget-dashboard-component-system
description: Use when refactoring repeated dashboard cards, KPI blocks, stat rows, badges, tabs, lists, and mobile tables into reusable React TypeScript components.
---

Create reusable, typed, low-abstraction components for financial dashboard UI.

Prefer components such as:
- MetricCard
- InsightCard
- StatusBadge
- AmountDelta
- SectionHeader
- CompactStatGrid
- MonthlyTimeline
- DataQualityNotice
- EmptyState
- LoadingSkeleton

Rules:
- TypeScript strict.
- Small props API.
- No business fetching inside pure display components.
- Keep components composable.
- Reuse existing formatters.
- Avoid unnecessary dependencies.
- Keep className override possible.