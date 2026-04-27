# Budget Analytics Supabase

## Objectif
Intégrer côté front les analytics du schéma `budget_dashboard` avec:
- un client Supabase dédié (`supabaseBudget`)
- un RPC de recalcul (`refresh_budget_analytics`)
- la lecture des tables analytics
- une intégration UI minimale sur la page Budgets

Sans modifier le client Supabase global principal.

## Fichiers créés
- `/Users/dosta/Desktop/Projets-Dev/Dashboard_budget/src/lib/supabaseBudget.ts`
- `/Users/dosta/Desktop/Projets-Dev/Dashboard_budget/src/features/budget/api/refreshBudgetAnalytics.ts`
- `/Users/dosta/Desktop/Projets-Dev/Dashboard_budget/src/features/budget/api/getMonthlyMetrics.ts`
- `/Users/dosta/Desktop/Projets-Dev/Dashboard_budget/src/features/budget/api/getMonthlyVariableCategories.ts`
- `/Users/dosta/Desktop/Projets-Dev/Dashboard_budget/src/features/budget/api/getVariableCategorySummary.ts`
- `/Users/dosta/Desktop/Projets-Dev/Dashboard_budget/src/features/budget/hooks/useBudgetAnalytics.ts`
- `/Users/dosta/Desktop/Projets-Dev/Dashboard_budget/src/features/budget/components/BudgetAnalyticsPanel.tsx`
- `/Users/dosta/Desktop/Projets-Dev/Dashboard_budget/docs/budget-analytics-supabase.md`

## Fichiers modifiés
- `/Users/dosta/Desktop/Projets-Dev/Dashboard_budget/src/pages/Budgets.tsx`
- `/Users/dosta/Desktop/Projets-Dev/Dashboard_budget/src/lib/types.ts`

## Refresh / Reload
- `refreshAndReload()`:
  1. appelle `refresh_budget_analytics(p_user_id)` via RPC
  2. recharge ensuite les 3 datasets analytics
- `reloadOnly()`:
  - recharge uniquement les 3 datasets analytics sans recalcul SQL

Le hook `useBudgetAnalytics` gère:
- `loading`
- `refreshing`
- `error`
- protection des updates après unmount
- erreur claire si utilisateur non connecté

## Tables lues
- `budget_dashboard.analytics_monthly_metrics`
- `budget_dashboard.analytics_monthly_category_metrics`
- `budget_dashboard.analytics_variable_category_summary`

## Prérequis Supabase manuels

### A. Dashboard
Dans Supabase:
- `Project Settings > API > Exposed schemas`
- vérifier que `budget_dashboard` est bien ajouté

### B. SQL à vérifier
```sql
grant usage on schema budget_dashboard to authenticated;

grant select on budget_dashboard.analytics_monthly_metrics to authenticated;
grant select on budget_dashboard.analytics_monthly_category_metrics to authenticated;
grant select on budget_dashboard.analytics_variable_category_summary to authenticated;

grant execute on function budget_dashboard.refresh_budget_analytics(uuid) to authenticated;
```

### C. Sécurité
- vérifier que les tables analytics ont la RLS activée
- vérifier qu’une policy limite les lignes à `auth.uid() = user_id`
