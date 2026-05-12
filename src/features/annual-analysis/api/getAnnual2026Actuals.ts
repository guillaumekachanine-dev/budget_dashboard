import { budgetDb } from '@/lib/supabaseBudget'

export interface CategoryYtdActual {
  parentCategoryName: string
  ytdActual: number
  monthCount: number
}

export async function getAnnual2026Actuals(year: number): Promise<CategoryYtdActual[]> {
  const [metricsRes, catsRes] = await Promise.all([
    budgetDb
      .from('analytics_monthly_category_metrics')
      .select('period_month, parent_category_id, amount_total')
      .eq('period_year', year)
      .eq('flow_type', 'expense')
      .order('period_month', { ascending: true }),
    budgetDb
      .from('categories')
      .select('id, name')
      .is('parent_id', null),
  ])

  if (metricsRes.error) throw new Error(`getAnnual2026Actuals (metrics): ${metricsRes.error.message}`)
  if (catsRes.error) throw new Error(`getAnnual2026Actuals (categories): ${catsRes.error.message}`)

  const nameById = new Map<string, string>(
    (catsRes.data ?? []).map((c) => [c.id as string, c.name as string]),
  )

  const aggregate = new Map<string, { total: number; months: Set<number> }>()

  for (const row of metricsRes.data ?? []) {
    const id = row.parent_category_id as string | null
    if (!id) continue
    const name = nameById.get(id)
    if (!name) continue
    const existing = aggregate.get(name) ?? { total: 0, months: new Set<number>() }
    existing.total += Math.abs(Number(row.amount_total ?? 0))
    existing.months.add(Number(row.period_month))
    aggregate.set(name, existing)
  }

  return [...aggregate.entries()].map(([name, data]) => ({
    parentCategoryName: name,
    ytdActual: data.total,
    monthCount: data.months.size,
  }))
}
