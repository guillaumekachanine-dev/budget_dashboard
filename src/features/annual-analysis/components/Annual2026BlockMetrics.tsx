import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import { BUCKET_LABELS, BUCKET_ORDER, MONTH_LABELS_SHORT } from './_constants'

interface Annual2026BlockMetricsProps {
  summary?: unknown
  buckets?: unknown[]
}

interface CategoryRow {
  id: string
  name: string
  parent_id: string | null
}

interface BucketMapRow {
  category_id: string
  budget_bucket: string
}

interface AnalyticsRow {
  period_month: number
  category_id: string
  amount_total: number | null
}

interface BudgetPeriodRow {
  id: string
  period_month: number
}

interface BudgetRow {
  period_id: string
  category_id: string | null
  amount: number | null
}

const YEAR_2026 = 2026

function monthFromPeriod(period: string): number | null {
  const idx = MONTH_LABELS_SHORT.findIndex((m) => m === period)
  if (idx < 0) return null
  return idx + 1
}

function periodMonths(period: string): number[] {
  const month = monthFromPeriod(period)
  if (month != null) return [month]
  return [1, 2, 3, 4, 5]
}

function periodDateRange(months: number[]): { startDate: string; endDate: string } {
  const first = Math.min(...months)
  const last = Math.max(...months)
  const startDate = `${YEAR_2026}-${String(first).padStart(2, '0')}-01`
  const endDateObj = new Date(YEAR_2026, last, 0)
  const endDate = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`
  return { startDate, endDate }
}

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

function fmtCurrencyCompact(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value).replace(/\s+€/g, '€')
}

function fmtPercentCompact(value: number): string {
  const formatted = value.toFixed(1).replace('.', ',')
  return `${value > 0 ? '+' : ''}${formatted}%`
}

export function Annual2026BlockMetrics(_props: Annual2026BlockMetricsProps) {
  const [analysisType, setAnalysisType] = useState<'bloc' | 'catégorie'>('bloc')
  const [selectedBlock, setSelectedBlock] = useState(BUCKET_ORDER[0])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('2026')

  const periods = ['2026', ...MONTH_LABELS_SHORT.slice(0, 5)]
  const selectedMonths = useMemo(() => periodMonths(selectedPeriod), [selectedPeriod])
  const range = useMemo(() => periodDateRange(selectedMonths), [selectedMonths])

  const { data: categories = [] } = useQuery({
    queryKey: ['budget-metrics-categories'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await budgetDb()
        .from('categories')
        .select('id, name, parent_id')
        .eq('flow_type', 'expense')
        .eq('is_active', true)
      if (error) throw new Error(`categories query failed: ${error.message}`)
      return (data ?? []) as CategoryRow[]
    },
  })

  const rootCategories = useMemo(
    () => categories.filter((row) => row.parent_id === null).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [categories],
  )
  const childrenByParentId = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const row of categories) {
      if (!row.parent_id) continue
      map.set(row.parent_id, [...(map.get(row.parent_id) ?? []), row.id])
    }
    return map
  }, [categories])
  const categoryNameById = useMemo(() => new Map(categories.map((row) => [row.id, row.name])), [categories])
  const categoryById = useMemo(() => new Map(categories.map((row) => [row.id, row])), [categories])

  useEffect(() => {
    if (analysisType !== 'catégorie') return
    if (selectedCategoryId) return
    if (!rootCategories.length) return
    setSelectedCategoryId(rootCategories[0].id)
  }, [analysisType, selectedCategoryId, rootCategories])

  useEffect(() => {
    if (analysisType !== 'catégorie') return
    if (!selectedCategoryId) return
    if (categoryById.has(selectedCategoryId)) return
    if (!rootCategories.length) return
    setSelectedCategoryId(rootCategories[0].id)
  }, [analysisType, selectedCategoryId, categoryById, rootCategories])

  const { data: bucketMapRows = [] } = useQuery({
    queryKey: ['budget-metrics-bucket-map'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await budgetDb()
        .from('category_budget_bucket_map')
        .select('category_id, budget_bucket')
      if (error) throw new Error(`bucket map query failed: ${error.message}`)
      return (data ?? []) as BucketMapRow[]
    },
  })

  const { data: periodDataset } = useQuery({
    queryKey: ['budget-metrics-period-dataset', selectedMonths.join(',')],
    staleTime: 30_000,
    queryFn: async () => {
      const [analyticsRes, periodsRes] = await Promise.all([
        budgetDb()
          .from('analytics_monthly_category_metrics')
          .select('period_month, category_id, amount_total')
          .eq('flow_type', 'expense')
          .eq('period_year', YEAR_2026)
          .in('period_month', selectedMonths),
        budgetDb()
          .from('budget_periods')
          .select('id, period_month')
          .eq('period_year', YEAR_2026)
          .in('period_month', selectedMonths),
      ])

      if (analyticsRes.error) throw new Error(`analytics query failed: ${analyticsRes.error.message}`)
      if (periodsRes.error) throw new Error(`periods query failed: ${periodsRes.error.message}`)

      const periodRows = (periodsRes.data ?? []) as BudgetPeriodRow[]
      const periodIds = periodRows.map((row) => row.id)

      let budgetRows: BudgetRow[] = []
      if (periodIds.length > 0) {
        const budgetsRes = await budgetDb()
          .from('budgets')
          .select('period_id, category_id, amount')
          .eq('budget_kind', 'category')
          .in('period_id', periodIds)
        if (budgetsRes.error) throw new Error(`budgets query failed: ${budgetsRes.error.message}`)
        budgetRows = (budgetsRes.data ?? []) as BudgetRow[]
      }

      return {
        analyticsRows: (analyticsRes.data ?? []) as AnalyticsRow[],
        periodRows,
        budgetRows,
      }
    },
  })

  const scopeCategoryIds = useMemo(() => {
    if (analysisType === 'bloc') {
      return bucketMapRows.filter((row) => row.budget_bucket === selectedBlock).map((row) => row.category_id)
    }
    if (!selectedCategoryId) return []
    return [selectedCategoryId, ...(childrenByParentId.get(selectedCategoryId) ?? [])]
  }, [analysisType, selectedBlock, selectedCategoryId, bucketMapRows, childrenByParentId])

  const { data: transactionCount = 0 } = useQuery({
    queryKey: ['budget-metrics-transaction-count', range.startDate, range.endDate, scopeCategoryIds.join(',')],
    enabled: scopeCategoryIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { count, error } = await budgetDb()
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('is_hidden', false)
        .eq('flow_type', 'expense')
        .gte('transaction_date', range.startDate)
        .lte('transaction_date', range.endDate)
        .in('category_id', scopeCategoryIds)

      if (error) throw new Error(`transactions count query failed: ${error.message}`)
      return count ?? 0
    },
  })

  const metricsState = useMemo(() => {
    const analyticsRows = periodDataset?.analyticsRows ?? []
    const budgetRows = periodDataset?.budgetRows ?? []
    const periodRows = periodDataset?.periodRows ?? []
    const selectedCategoryIdSet = new Set(scopeCategoryIds)

    const monthActualMap = new Map<number, number>()
    for (const month of selectedMonths) monthActualMap.set(month, 0)

    let actualAmount = 0
    for (const row of analyticsRows) {
      if (!selectedCategoryIdSet.has(row.category_id)) continue
      const amount = Number(row.amount_total ?? 0)
      actualAmount += amount
      monthActualMap.set(row.period_month, (monthActualMap.get(row.period_month) ?? 0) + amount)
    }

    const periodMonthById = new Map(periodRows.map((row) => [row.id, row.period_month]))
    let budgetAmount = 0
    for (const row of budgetRows) {
      if (!row.category_id || !selectedCategoryIdSet.has(row.category_id)) continue
      if (!periodMonthById.has(row.period_id)) continue
      budgetAmount += Number(row.amount ?? 0)
    }

    const monthValues = selectedMonths.map((month) => monthActualMap.get(month) ?? 0)
    const averageAmount = monthValues.length ? monthValues.reduce((sum, value) => sum + value, 0) / monthValues.length : 0
    const medianAmount = median(monthValues)
    const deltaPct = budgetAmount > 0 ? ((actualAmount - budgetAmount) / budgetAmount) * 100 : 0

    const bucketByCategoryId = new Map<string, string>()
    for (const row of bucketMapRows) {
      if (!bucketByCategoryId.has(row.category_id)) bucketByCategoryId.set(row.category_id, row.budget_bucket)
    }

    let rank = 0
    if (analysisType === 'bloc') {
      const totalsByBucket = new Map<string, number>()
      for (const key of BUCKET_ORDER) totalsByBucket.set(key, 0)

      for (const row of analyticsRows) {
        const bucket = bucketByCategoryId.get(row.category_id)
        if (!bucket) continue
        totalsByBucket.set(bucket, (totalsByBucket.get(bucket) ?? 0) + Number(row.amount_total ?? 0))
      }

      const sorted = [...totalsByBucket.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key)
      rank = sorted.findIndex((key) => key === selectedBlock) + 1
    } else if (selectedCategoryId) {
      const rootCategoryIds = rootCategories.map((row) => row.id)
      const totalsByRootId = new Map<string, number>()
      for (const rootId of rootCategoryIds) totalsByRootId.set(rootId, 0)

      const rootIdCache = new Map<string, string>()
      const resolveRoot = (categoryId: string): string | null => {
        const cached = rootIdCache.get(categoryId)
        if (cached) return cached

        let current = categoryById.get(categoryId) ?? null
        while (current?.parent_id) current = categoryById.get(current.parent_id) ?? null
        const rootId = current?.id ?? null
        if (rootId) rootIdCache.set(categoryId, rootId)
        return rootId
      }

      for (const row of analyticsRows) {
        const rootId = resolveRoot(row.category_id)
        if (!rootId) continue
        totalsByRootId.set(rootId, (totalsByRootId.get(rootId) ?? 0) + Number(row.amount_total ?? 0))
      }

      const sorted = [...totalsByRootId.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key)
      rank = sorted.findIndex((key) => key === selectedCategoryId) + 1
    }

    return {
      actualAmount,
      budgetAmount,
      deltaPct,
      averageAmount,
      medianAmount,
      rank: rank > 0 ? `#${rank}` : '—',
    }
  }, [
    periodDataset,
    scopeCategoryIds,
    selectedMonths,
    bucketMapRows,
    analysisType,
    selectedBlock,
    rootCategories,
    selectedCategoryId,
    categoryById,
  ])

  const currentItemLabel = analysisType === 'bloc'
    ? (BUCKET_LABELS[selectedBlock] ?? selectedBlock)
    : (categoryNameById.get(selectedCategoryId) ?? 'Catégorie')

  const metrics = [
    { label: 'Montant', value: fmtCurrencyCompact(metricsState.actualAmount), color: 'var(--neutral-900)' },
    { label: 'Budget', value: fmtCurrencyCompact(metricsState.budgetAmount), color: 'var(--neutral-900)' },
    { label: 'Réel/budget', value: fmtPercentCompact(metricsState.deltaPct), color: metricsState.deltaPct > 0 ? 'var(--color-error)' : 'var(--color-success)' },
    { label: 'Mt moyen', value: fmtCurrencyCompact(metricsState.averageAmount), color: 'var(--neutral-900)' },
    { label: 'Médiane', value: fmtCurrencyCompact(metricsState.medianAmount), color: 'var(--neutral-900)' },
    { label: 'Nbre opérations', value: String(transactionCount), color: 'var(--neutral-900)' },
    { label: 'Rang', value: metricsState.rank, color: 'var(--neutral-900)' },
  ]

  return (
    <div style={{ display: 'grid', gap: 'var(--space-6)', padding: '0 var(--space-6)', marginTop: 'var(--space-4)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 800 }}>
          Métriques 2026
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--neutral-200)', background: 'var(--neutral-100)', padding: 'var(--space-3) var(--space-2)', minHeight: 66, display: 'grid', placeItems: 'center' }}>
            <Selector
              label="Type"
              value={analysisType === 'bloc' ? 'Bloc' : 'Catégorie'}
              options={[
                { id: 'bloc', label: 'Bloc' },
                { id: 'catégorie', label: 'Catégorie' },
              ]}
              onSelect={(id) => setAnalysisType(id === 'catégorie' ? 'catégorie' : 'bloc')}
            />
          </div>
          <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--neutral-200)', background: 'var(--neutral-100)', padding: 'var(--space-3) var(--space-2)', minHeight: 66, display: 'grid', placeItems: 'center' }}>
            <Selector
              label={analysisType === 'bloc' ? 'Bloc' : 'Cat.'}
              value={currentItemLabel}
              options={analysisType === 'bloc'
                ? BUCKET_ORDER.map((bucketKey) => ({ id: bucketKey, label: BUCKET_LABELS[bucketKey] ?? bucketKey }))
                : rootCategories.map((category) => ({ id: category.id, label: category.name }))}
              onSelect={analysisType === 'bloc' ? setSelectedBlock : setSelectedCategoryId}
            />
          </div>
          <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--neutral-200)', background: 'var(--neutral-100)', padding: 'var(--space-3) var(--space-2)', minHeight: 66, display: 'grid', placeItems: 'center' }}>
            <Selector
              label="Période"
              value={selectedPeriod}
              options={periods.map((period) => ({ id: period, label: period }))}
              onSelect={setSelectedPeriod}
            />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2) var(--space-6)' }}
        >
          {metrics.map((metric) => (
            <div key={metric.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: 'var(--space-1) 0', borderBottom: '1px solid var(--neutral-50)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  {metric.label}
                </p>
              </div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: metric.color, fontFamily: 'var(--font-mono)' }}>
                {metric.value}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

function Selector({
  label,
  value,
  options,
  onSelect,
}: {
  label: string
  value: string
  options: Array<{ id: string; label: string }>
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
          <ChevronDown size={10} color="var(--neutral-400)" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-600)', lineHeight: 1.2, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value}
        </span>
      </button>

      {open ? (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
          <div style={{ position: 'absolute', top: '115%', left: 0, zIndex: 100, background: 'var(--neutral-0)', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', minWidth: 180, padding: 'var(--space-2)', display: 'grid', gap: 2, maxHeight: 300, overflowY: 'auto' }}>
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onSelect(option.id)
                  setOpen(false)
                }}
                style={{
                  background: value === option.label ? 'var(--primary-50)' : 'none',
                  border: 'none',
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: value === option.label ? 700 : 500,
                  color: value === option.label ? 'var(--primary-700)' : 'var(--neutral-600)',
                  cursor: 'pointer',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
