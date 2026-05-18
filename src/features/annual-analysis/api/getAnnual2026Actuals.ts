import { budgetDb } from '@/lib/supabaseBudget'

export interface CategoryYtdActual {
  parentCategoryName: string
  ytdActual: number
  monthCount: number
}

export async function getAnnual2026Actuals(year: number): Promise<CategoryYtdActual[]> {
  const [metricsRes, catsRes] = await Promise.all([
    budgetDb
      .from('v_monthly_category_actuals_clean' as never)
      .select('period_month, parent_category_id, actual_amount')
      .eq('period_year', year)
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

  const metricsRows = (metricsRes.data ?? []) as Array<Record<string, unknown>>
  for (const row of metricsRows) {
    const id = typeof row.parent_category_id === 'string' ? row.parent_category_id : null
    if (!id) continue
    const name = nameById.get(id)
    if (!name) continue
    const existing = aggregate.get(name) ?? { total: 0, months: new Set<number>() }
    existing.total += Math.abs(Number(row.actual_amount ?? 0))
    existing.months.add(Number(row.period_month))
    aggregate.set(name, existing)
  }

  return [...aggregate.entries()].map(([name, data]) => ({
    parentCategoryName: name,
    ytdActual: data.total,
    monthCount: data.months.size,
  }))
}
