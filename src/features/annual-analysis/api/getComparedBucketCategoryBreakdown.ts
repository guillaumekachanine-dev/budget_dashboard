import { budgetDb } from '@/lib/supabaseBudget'
import { COMPARED_MONTHS, COMPARED_YEARS } from '@/features/annual-analysis/types.compared'

export interface BucketCategoryBreakdownRow {
  category_id:          string | null
  category_name:        string
  parent_category_name: string | null
  amount_2025:          number
  amount_2026:          number
}

type SavingsCategoryRow = {
  id: string
  name: string
  parent_id: string | null
}

type SavingsTransactionRow = {
  transaction_date: string | null
  amount: number | string | null
  category_id: string | null
}

function normalizeBucketKey(bucket: string): string {
  const key = bucket.trim().toLowerCase()
  if (key.includes('cagnotte') || key.includes('savings') || key.includes('epargne')) return 'epargne'
  return key
}

function getYearMonth(dateValue: string | null): { year: number; month: number } | null {
  if (!dateValue) return null
  const year = Number(dateValue.slice(0, 4))
  const month = Number(dateValue.slice(5, 7))
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null
  return { year, month }
}

async function getComparedSavingsCategoryBreakdown(): Promise<BucketCategoryBreakdownRow[]> {
  const minYear = Math.min(...COMPARED_YEARS)
  const maxYear = Math.max(...COMPARED_YEARS)
  const allowedYears = new Set<number>(COMPARED_YEARS as readonly number[])
  const allowedMonths = new Set<number>(COMPARED_MONTHS as readonly number[])

  const { data, error } = await budgetDb
    .from('transactions')
    .select('transaction_date, amount, category_id')
    .eq('flow_type', 'savings')
    .eq('is_hidden', false)
    .gte('transaction_date', `${minYear}-01-01`)
    .lt('transaction_date', `${maxYear + 1}-01-01`)
    .order('transaction_date', { ascending: true })

  if (error) throw new Error(`getComparedBucketCategoryBreakdown (savings): ${error.message}`)

  const categoryIds = [...new Set((data ?? [])
    .map((row) => String((row as SavingsTransactionRow).category_id ?? ''))
    .filter((id) => id.length > 0))]

  let categoryById = new Map<string, SavingsCategoryRow>()
  if (categoryIds.length > 0) {
    const { data: categories, error: categoriesError } = await budgetDb
      .from('categories')
      .select('id, name, parent_id')
      .in('id', categoryIds)

    if (categoriesError) throw new Error(`getComparedBucketCategoryBreakdown (savings categories): ${categoriesError.message}`)

    categoryById = new Map((categories ?? []).map((row) => {
      const category = row as SavingsCategoryRow
      return [category.id, category]
    }))
  }

  const parentIds = new Set<string>()
  const grouped = new Map<string, {
    category_id: string | null
    category_name: string
    parent_id: string | null
    amount_2025: number
    amount_2026: number
  }>()

  for (const row of (data ?? []) as SavingsTransactionRow[]) {
    const parsed = getYearMonth(row.transaction_date)
    if (!parsed) continue
    if (!allowedYears.has(parsed.year) || !allowedMonths.has(parsed.month)) continue

    const categoryId = row.category_id ?? null
    const category = categoryId ? categoryById.get(categoryId) : null
    const categoryName = category?.name?.trim() || 'Épargne'
    const parentId = category?.parent_id ?? null
    if (parentId) parentIds.add(parentId)

    const key = `${categoryId ?? ''}__${parentId ?? ''}__${categoryName}`
    const amount = Math.abs(Number(row.amount ?? 0))
    if (!Number.isFinite(amount) || amount === 0) continue

    const entry = grouped.get(key) ?? {
      category_id: categoryId,
      category_name: categoryName,
      parent_id: parentId,
      amount_2025: 0,
      amount_2026: 0,
    }

    if (parsed.year === 2025) entry.amount_2025 += amount
    if (parsed.year === 2026) entry.amount_2026 += amount

    grouped.set(key, entry)
  }

  let parentNameById = new Map<string, string>()
  if (parentIds.size > 0) {
    const { data: parents, error: parentError } = await budgetDb
      .from('categories')
      .select('id, name')
      .in('id', [...parentIds])

    if (parentError) throw new Error(`getComparedBucketCategoryBreakdown (savings parents): ${parentError.message}`)

    parentNameById = new Map((parents ?? []).map((parent) => [String(parent.id), String(parent.name ?? '')]))
  }

  return [...grouped.values()]
    .map((row) => ({
      category_id: row.category_id,
      category_name: row.category_name,
      parent_category_name: row.parent_id ? (parentNameById.get(row.parent_id) ?? null) : null,
      amount_2025: row.amount_2025,
      amount_2026: row.amount_2026,
    }))
    .sort((a, b) => (b.amount_2026 || b.amount_2025) - (a.amount_2026 || a.amount_2025))
}

/**
 * Dépenses YTD par sous-catégorie pour un bloc donné (Jan-Avr 2025+2026).
 * Jointure client-side : category_budget_bucket_map → analytics_monthly_category_metrics.
 */
export async function getComparedBucketCategoryBreakdown(
  bucket: string,
): Promise<BucketCategoryBreakdownRow[]> {
  if (normalizeBucketKey(bucket) === 'epargne') {
    return getComparedSavingsCategoryBreakdown()
  }

  // ① Récupérer les category_id appartenant au bloc
  const { data: mapData, error: mapError } = await budgetDb
    .from('category_budget_bucket_map')
    .select('category_id')
    .eq('budget_bucket', bucket)

  if (mapError) throw new Error(`getComparedBucketCategoryBreakdown (map): ${mapError.message}`)

  const categoryIds = (mapData ?? [])
    .map((r) => (r as { category_id: string }).category_id)
    .filter(Boolean)

  if (categoryIds.length === 0) return []

  // ② Récupérer les montants YTD pour ces catégories
  const { data, error } = await budgetDb
    .from('v_monthly_category_actuals_clean' as never)
    .select('period_year, category_id, category_name, parent_category_name, actual_amount')
    .in('period_year', [...COMPARED_YEARS])
    .in('period_month', [...COMPARED_MONTHS])
    .in('category_id', categoryIds)

  if (error) throw new Error(`getComparedBucketCategoryBreakdown (metrics): ${error.message}`)

  // ③ Agréger par (parent_category_name, category_name) et année
  const map = new Map<string, BucketCategoryBreakdownRow>()

  const rows = (data ?? []) as Array<Record<string, unknown>>
  for (const row of rows) {
    const catId      = row.category_id ? String(row.category_id) : null
    const catName    = String(row.category_name ?? '')
    const parentName = row.parent_category_name ? String(row.parent_category_name) : null
    const key        = `${catId ?? ''}__${parentName ?? ''}__${catName}`
    const amount     = Number(row.actual_amount ?? 0)

    const entry = map.get(key) ?? { category_id: catId, category_name: catName, parent_category_name: parentName, amount_2025: 0, amount_2026: 0 }
    if (Number(row.period_year) === 2025) entry.amount_2025 += amount
    if (Number(row.period_year) === 2026) entry.amount_2026 += amount
    map.set(key, entry)
  }

  // Tri décroissant sur 2026 (ou 2025 si pas de données 2026)
  return [...map.values()].sort((a, b) => (b.amount_2026 || b.amount_2025) - (a.amount_2026 || a.amount_2025))
}
