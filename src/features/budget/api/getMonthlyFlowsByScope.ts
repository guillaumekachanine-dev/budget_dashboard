import { budgetDb } from '@/lib/supabaseBudget'
import { MONTH_LABELS_SHORT } from '@/features/annual-analysis/components/_constants'
import {
  EXPENSE_BUCKETS,
  assertNoNonExpenseBucketsInExpenseTotal,
  isExpenseBucket,
} from '@/features/annual-analysis/components/_constants'

export type MonthlyFlowsScopeRow = {
  month: number
  monthLabel: string
  depense: number
  budgetAmount: number
  ecartPct: number | null
  evolMoins1Pct: number | null
  partPct: number | null
}

export type MonthlyFlowsScopeResult = {
  rows: MonthlyFlowsScopeRow[]
  synth: {
    totalDepense: number
    avgEcartPct: number | null
    avgEvolPct: number | null
    partYtdPct: number | null
  }
}

export type MonthlyFlowsScopeParams =
  | { kind: 'categorie'; id: string; year: number }
  | { kind: 'bloc'; id: string; year: number }

function getCurrentMonthCutoff(year: number): number {
  const now = new Date()
  if (now.getFullYear() < year) return 0
  if (now.getFullYear() > year) return 12
  return Math.max(1, Math.min(12, now.getMonth() + 1))
}

export async function getMonthlyFlowsByScope(params: MonthlyFlowsScopeParams): Promise<MonthlyFlowsScopeResult> {
  const { kind, id, year } = params
  const cutoff = getCurrentMonthCutoff(year)

  const startDate = `${year}-01-01`
  const endDateExclusive = `${year + 1}-01-01`

  // Totaux mensuels dépenses strictes (whitelist) → pour le calcul de "part"
  const metricsRes = await budgetDb
    .from('v_monthly_bucket_actuals_clean')
    .select('month_start, budget_bucket, expense_amount, net_amount')
    .gte('month_start', startDate)
    .lt('month_start', endDateExclusive)
    .in('budget_bucket', [...EXPENSE_BUCKETS])
    .order('month_start', { ascending: true })

  if (metricsRes.error) throw new Error(`getMonthlyFlowsByScope (metrics): ${metricsRes.error.message}`)

  const expenseTotalByMonth = new Map<number, number>()
  const includedBucketsInExpenseTotal: string[] = []
  for (const row of metricsRes.data ?? []) {
    const month = Number(String(row.month_start ?? '').slice(5, 7))
    if (!Number.isFinite(month) || month <= 0) continue
    const bucket = String(row.budget_bucket ?? '')
    includedBucketsInExpenseTotal.push(bucket)
    if (!isExpenseBucket(bucket)) continue
    expenseTotalByMonth.set(month, (expenseTotalByMonth.get(month) ?? 0) + Number(row.expense_amount ?? row.net_amount ?? 0))
  }
  assertNoNonExpenseBucketsInExpenseTotal(includedBucketsInExpenseTotal, 'getMonthlyFlowsByScope:expenseTotalByMonth')
  if (import.meta.env.DEV) {
    console.log('[Budgets Slide 3][Audit dépenses] rawData', metricsRes.data ?? [])
    console.log('[Budgets Slide 3][Audit dépenses] buckets included in expenses', [...new Set(includedBucketsInExpenseTotal)])
    console.log('[Budgets Slide 3][Audit dépenses] expenseTotal', Object.fromEntries(expenseTotalByMonth.entries()))
  }

  if (kind === 'categorie') {
    // Actuals : somme des sous-catégories via parent_category_id
    const [actualsRes, periodsRes] = await Promise.all([
      budgetDb
        .from('analytics_monthly_category_metrics')
        .select('period_month, amount_total')
        .eq('period_year', year)
        .eq('parent_category_id', id)
        .eq('flow_type', 'expense')
        .order('period_month', { ascending: true }),
      budgetDb
        .from('budget_periods')
        .select('id, period_month')
        .eq('period_year', year)
        .lte('period_month', cutoff),
    ])

    if (actualsRes.error) throw new Error(`getMonthlyFlowsByScope (cat actuals): ${actualsRes.error.message}`)
    if (periodsRes.error) throw new Error(`getMonthlyFlowsByScope (periods): ${periodsRes.error.message}`)

    // Actuals agrégés par mois (somme des sous-catégories)
    const actualByMonth = new Map<number, number>()
    for (const row of actualsRes.data ?? []) {
      const month = Number(row.period_month)
      if (!Number.isFinite(month) || month <= 0) continue
      actualByMonth.set(month, (actualByMonth.get(month) ?? 0) + Number(row.amount_total ?? 0))
    }

    // Budget : sous-catégories de ce parent
    const periodIdToMonth = new Map<string, number>()
    const periodIds: string[] = []
    for (const r of periodsRes.data ?? []) {
      periodIdToMonth.set(r.id, Number(r.period_month))
      periodIds.push(r.id)
    }

    const budgetByMonth = new Map<number, number>()
    if (periodIds.length > 0) {
      // Récupère d'abord les category_ids enfants
      const childCatsRes = await budgetDb
        .from('categories')
        .select('id')
        .eq('parent_id', id)

      if (childCatsRes.error) throw new Error(`getMonthlyFlowsByScope (child cats): ${childCatsRes.error.message}`)

      const childIds = (childCatsRes.data ?? []).map((r) => r.id)
      if (childIds.length > 0) {
        const budgetsRes = await budgetDb
          .from('budgets')
          .select('period_id, category_id, amount')
          .eq('budget_kind', 'category')
          .in('period_id', periodIds)
          .in('category_id', childIds)

        if (budgetsRes.error) throw new Error(`getMonthlyFlowsByScope (budgets): ${budgetsRes.error.message}`)

        for (const r of budgetsRes.data ?? []) {
          const month = periodIdToMonth.get(r.period_id)
          if (month == null) continue
          budgetByMonth.set(month, (budgetByMonth.get(month) ?? 0) + Number(r.amount ?? 0))
        }
      }
    }

    return buildResult(actualByMonth, budgetByMonth, expenseTotalByMonth, cutoff)
  }

  // kind === 'bloc'
  const actualByMonth = new Map<number, number>()
  const budgetByMonth = new Map<number, number>()
  const [bucketActualsRes, bucketBudgetsRes] = await Promise.all([
    budgetDb
      .from('v_monthly_bucket_actuals_clean')
      .select('month_start, budget_bucket, expense_amount, revenue_amount, net_amount')
      .gte('month_start', startDate)
      .lt('month_start', endDateExclusive)
      .eq('budget_bucket', id)
      .order('month_start', { ascending: true }),
    budgetDb
      .from('v_monthly_bucket_budgets_clean' as never)
      .select('period_month, budget_bucket, budget_amount')
      .eq('period_year', year)
      .eq('budget_bucket', id)
      .order('period_month', { ascending: true }),
  ])

  if (bucketActualsRes.error) throw new Error(`getMonthlyFlowsByScope (bucket actuals): ${bucketActualsRes.error.message}`)
  if (bucketBudgetsRes.error) throw new Error(`getMonthlyFlowsByScope (bucket budgets): ${bucketBudgetsRes.error.message}`)

  for (const row of bucketActualsRes.data ?? []) {
    const month = Number(String(row.month_start ?? '').slice(5, 7))
    if (!Number.isFinite(month) || month <= 0) continue
    const value = id === 'revenu'
      ? Number(row.revenue_amount ?? row.net_amount ?? 0)
      : Number(row.expense_amount ?? row.net_amount ?? 0)
    actualByMonth.set(month, value)
  }

  for (const row of (bucketBudgetsRes.data ?? []) as Array<{ period_month: number | null; budget_amount: number | null }>) {
    const month = Number(row.period_month)
    if (!Number.isFinite(month) || month <= 0) continue
    budgetByMonth.set(month, Number(row.budget_amount ?? 0))
  }

  return buildResult(actualByMonth, budgetByMonth, expenseTotalByMonth, cutoff)
}

function buildResult(
  actualByMonth: Map<number, number>,
  budgetByMonth: Map<number, number>,
  expenseTotalByMonth: Map<number, number>,
  cutoff: number,
): MonthlyFlowsScopeResult {
  const allMonths = new Set([...actualByMonth.keys(), ...expenseTotalByMonth.keys()])
  const months = [...allMonths].filter((m) => m >= 1 && m <= cutoff).sort((a, b) => a - b)

  const rows: MonthlyFlowsScopeRow[] = months.map((month, idx) => {
    const depense = actualByMonth.get(month) ?? 0
    const budget = budgetByMonth.get(month) ?? 0
    const expenseTotal = expenseTotalByMonth.get(month) ?? 0

    const ecartPct = budget > 0 ? (depense - budget) / budget : null

    const prevMonth = months[idx - 1]
    const prevDepense = prevMonth != null ? (actualByMonth.get(prevMonth) ?? 0) : null
    const evolMoins1Pct =
      prevDepense != null && prevDepense > 0 ? (depense - prevDepense) / prevDepense : null

    const partPct = expenseTotal > 0 ? depense / expenseTotal : null

    return {
      month,
      monthLabel: MONTH_LABELS_SHORT[month - 1] ?? `M${month}`,
      depense,
      budgetAmount: budget,
      ecartPct,
      evolMoins1Pct,
      partPct,
    }
  })

  const totalDepense = rows.reduce((sum, r) => sum + r.depense, 0)
  const totalExpenseYtd = months.reduce((sum, m) => sum + (expenseTotalByMonth.get(m) ?? 0), 0)

  const ecartValues = rows.map((r) => r.ecartPct).filter((v): v is number => v != null)
  const avgEcartPct = ecartValues.length > 0 ? ecartValues.reduce((s, v) => s + v, 0) / ecartValues.length : null

  // rows.slice(1) : la première ligne n'a pas de mois précédent → toujours null
  const evolValues = rows.slice(1).map((r) => r.evolMoins1Pct).filter((v): v is number => v != null)
  const avgEvolPct = evolValues.length > 0 ? evolValues.reduce((s, v) => s + v, 0) / evolValues.length : null

  const partYtdPct = totalExpenseYtd > 0 ? totalDepense / totalExpenseYtd : null

  return {
    rows,
    synth: { totalDepense, avgEcartPct, avgEvolPct, partYtdPct },
  }
}
