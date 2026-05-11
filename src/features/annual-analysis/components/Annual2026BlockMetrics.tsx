import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { budgetDb } from '@/lib/supabaseBudget'
import type { CategoryRolling12mStats } from '@/features/budget/api/getCategoryRolling12mStats'
import { BUCKET_LABELS, BUCKET_ORDER, MONTH_LABELS_SHORT } from './_constants'

export type MetricsScopeKind = 'bloc' | 'categorie'
export type MetricsDisplayMode = 'tableau' | 'graphique'

export interface MetricsScopeSelection {
  kind: MetricsScopeKind
  id: string
}

interface Annual2026BlockMetricsProps {
  hideParameterRow?: boolean
  scopeSelection?: MetricsScopeSelection
  visualAccentColor?: string
  period?: string
  displayMode?: MetricsDisplayMode
  compactMobile?: boolean
  rollingStats?: CategoryRolling12mStats[]
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

type BudgetBucketId =
  | 'revenu'
  | 'socle_fixe'
  | 'variable_essentielle'
  | 'discretionnaire'
  | 'provision'
  | 'epargne'
  | 'hors_pilotage'

type MonthlyBucketMetric = {
  month_start: string
  period_year: number
  period_month: number
  budget_bucket: BudgetBucketId
  actual_amount: number
  budget_amount: number
  variance_amount: number
  variance_pct: number | null
}

interface BucketBudgetVsActualRow {
  period_month: number | null
  budget_bucket: string | null
  target_budget_bucket_eur: number | null
  actual_budget_bucket_eur: number | null
}

interface MonthlyBucketActualsFallbackRow {
  month_start: string | null
  budget_bucket: string | null
  revenue_amount: number | null
  net_amount: number | null
}

interface MonthlyBucketBudgetsFallbackRow {
  period_month: number | null
  budget_bucket: string | null
  total_budget_bucket_eur: number | null
}

const YEAR_2026 = 2026
const ALL_CATEGORIES_ID = 'all_categories'
const FULL_MONTH_LABEL_BY_SHORT: Record<string, string> = {
  Jan: 'Janvier',
  Fév: 'Février',
  Mar: 'Mars',
  Avr: 'Avril',
  Mai: 'Mai',
  Juin: 'Juin',
  Juil: 'Juillet',
  Aoû: 'Août',
  Sep: 'Septembre',
  Oct: 'Octobre',
  Nov: 'Novembre',
  Déc: 'Décembre',
}
const SHORT_MONTH_LABEL_BY_FULL: Record<string, string> = Object.fromEntries(
  Object.entries(FULL_MONTH_LABEL_BY_SHORT).map(([shortLabel, fullLabel]) => [fullLabel, shortLabel]),
) as Record<string, string>

function monthFromPeriod(period: string): number | null {
  const shortPeriod = SHORT_MONTH_LABEL_BY_FULL[period] ?? period
  const idx = MONTH_LABELS_SHORT.findIndex((m) => m === shortPeriod)
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

function asNullableFiniteNumber(value: number | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getNiceStep(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 100
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  if (normalized <= 1) return magnitude
  if (normalized <= 2) return 2 * magnitude
  if (normalized <= 5) return 5 * magnitude
  return 10 * magnitude
}

function getActiveYearMonth(): number {
  const now = new Date()
  if (now.getFullYear() !== YEAR_2026) return 12
  return Math.max(1, Math.min(12, now.getMonth() + 1))
}

const ALLOWED_BUCKETS: BudgetBucketId[] = [
  'revenu',
  'socle_fixe',
  'variable_essentielle',
  'discretionnaire',
  'provision',
  'epargne',
  'hors_pilotage',
]

const HISTOGRAM_BUCKET_COLOR: Record<BudgetBucketId, string> = {
  revenu: '#2ED47A',
  socle_fixe: '#5B57F5',
  variable_essentielle: '#4CC9F0',
  discretionnaire: '#FC5A5A',
  provision: '#6C63FF',
  epargne: '#FFAB2E',
  hors_pilotage: '#B0BEC5',
}
const HISTOGRAM_BUDGET_LINE_COLOR = '#EF4444'
const HISTOGRAM_AVG12_LINE_COLOR = '#7C4DFF'
const HISTOGRAM_MEDIAN12_LINE_COLOR = '#FFB300'
const HISTORIQUE_LEGEND = [
  { key: 'budget_2026', label: 'Budget 2026', color: HISTOGRAM_BUDGET_LINE_COLOR },
  { key: 'avg_12m', label: 'Moy.12 mois', color: HISTOGRAM_AVG12_LINE_COLOR },
  { key: 'median_12m', label: 'Méd.12 mois', color: HISTOGRAM_MEDIAN12_LINE_COLOR },
] as const

function isBudgetBucketId(value: string | null | undefined): value is BudgetBucketId {
  if (!value) return false
  return (ALLOWED_BUCKETS as string[]).includes(value)
}

function normalizeBucketAmount(bucket: BudgetBucketId, value: number): number {
  if (bucket === 'revenu' || bucket === 'epargne') return Math.abs(value)
  return value
}

function parseMonthFromMonthStart(value?: string | null): number | null {
  if (!value) return null
  const rawMonth = Number(value.slice(5, 7))
  if (!Number.isFinite(rawMonth) || rawMonth < 1 || rawMonth > 12) return null
  return rawMonth
}

function buildBudgetYtdBucketMetrics(rows: BucketBudgetVsActualRow[], months: number[]): {
  byBucket: Map<BudgetBucketId, { actualAmount: number; budgetAmount: number; varianceAmount: number; variancePct: number | null }>
  byBucketMonth: Map<string, MonthlyBucketMetric>
} {
  const byBucket = new Map<BudgetBucketId, { actualAmount: number; budgetAmount: number; varianceAmount: number; variancePct: number | null }>()
  const byBucketMonth = new Map<string, MonthlyBucketMetric>()

  for (const bucket of ALLOWED_BUCKETS) {
    byBucket.set(bucket, { actualAmount: 0, budgetAmount: 0, varianceAmount: 0, variancePct: null })
    for (const month of months) {
      byBucketMonth.set(`${bucket}:${month}`, {
        month_start: `${YEAR_2026}-${String(month).padStart(2, '0')}-01`,
        period_year: YEAR_2026,
        period_month: month,
        budget_bucket: bucket,
        actual_amount: 0,
        budget_amount: 0,
        variance_amount: 0,
        variance_pct: null,
      })
    }
  }

  for (const row of rows) {
    const month = Number(row.period_month)
    const bucketRaw = row.budget_bucket
    if (!Number.isFinite(month) || !months.includes(month)) continue
    if (!isBudgetBucketId(bucketRaw)) continue

    const actual = normalizeBucketAmount(bucketRaw, Number(row.actual_budget_bucket_eur ?? 0))
    const budget = normalizeBucketAmount(bucketRaw, Number(row.target_budget_bucket_eur ?? 0))
    const metricKey = `${bucketRaw}:${month}`
    const metric = byBucketMonth.get(metricKey)
    if (!metric) continue

    metric.actual_amount += actual
    metric.budget_amount += budget
    metric.variance_amount = metric.actual_amount - metric.budget_amount
    metric.variance_pct = metric.budget_amount > 0 ? metric.variance_amount / metric.budget_amount : null
  }

  for (const bucket of ALLOWED_BUCKETS) {
    let actualAmount = 0
    let budgetAmount = 0
    for (const month of months) {
      const metric = byBucketMonth.get(`${bucket}:${month}`)
      if (!metric) continue
      actualAmount += metric.actual_amount
      budgetAmount += metric.budget_amount
    }
    const varianceAmount = actualAmount - budgetAmount
    byBucket.set(bucket, {
      actualAmount,
      budgetAmount,
      varianceAmount,
      variancePct: budgetAmount > 0 ? varianceAmount / budgetAmount : null,
    })
  }

  return { byBucket, byBucketMonth }
}

function applyRevenueSavingsFallbackToMetrics(
  metrics: { byBucket: Map<BudgetBucketId, { actualAmount: number; budgetAmount: number; varianceAmount: number; variancePct: number | null }>; byBucketMonth: Map<string, MonthlyBucketMetric> },
  months: number[],
  actualRows: MonthlyBucketActualsFallbackRow[],
  budgetRows: MonthlyBucketBudgetsFallbackRow[],
) {
  const fallbackBuckets: BudgetBucketId[] = ['revenu', 'epargne']

  for (const bucket of fallbackBuckets) {
    let hasPrimaryData = false
    for (const month of months) {
      const metric = metrics.byBucketMonth.get(`${bucket}:${month}`)
      if (!metric) continue
      if (Math.abs(metric.actual_amount) > 0.0001 || Math.abs(metric.budget_amount) > 0.0001) {
        hasPrimaryData = true
        break
      }
    }
    if (hasPrimaryData) continue

    for (const row of actualRows) {
      if (!isBudgetBucketId(row.budget_bucket) || row.budget_bucket !== bucket) continue
      const month = parseMonthFromMonthStart(row.month_start)
      if (month == null || !months.includes(month)) continue
      const key = `${bucket}:${month}`
      const metric = metrics.byBucketMonth.get(key)
      if (!metric) continue
      const rawActual = bucket === 'revenu' ? Number(row.revenue_amount ?? row.net_amount ?? 0) : Number(row.net_amount ?? row.revenue_amount ?? 0)
      metric.actual_amount = normalizeBucketAmount(bucket, rawActual)
    }

    for (const row of budgetRows) {
      if (!isBudgetBucketId(row.budget_bucket) || row.budget_bucket !== bucket) continue
      const month = Number(row.period_month)
      if (!Number.isFinite(month) || !months.includes(month)) continue
      const key = `${bucket}:${month}`
      const metric = metrics.byBucketMonth.get(key)
      if (!metric) continue
      metric.budget_amount = normalizeBucketAmount(bucket, Number(row.total_budget_bucket_eur ?? 0))
    }
  }

  for (const bucket of ALLOWED_BUCKETS) {
    let actualAmount = 0
    let budgetAmount = 0
    for (const month of months) {
      const metric = metrics.byBucketMonth.get(`${bucket}:${month}`)
      if (!metric) continue
      metric.variance_amount = metric.actual_amount - metric.budget_amount
      metric.variance_pct = metric.budget_amount > 0 ? metric.variance_amount / metric.budget_amount : null
      actualAmount += metric.actual_amount
      budgetAmount += metric.budget_amount
    }
    const varianceAmount = actualAmount - budgetAmount
    metrics.byBucket.set(bucket, {
      actualAmount,
      budgetAmount,
      varianceAmount,
      variancePct: budgetAmount > 0 ? varianceAmount / budgetAmount : null,
    })
  }
}

async function fetchDatasetForMonths(months: number[]): Promise<{
  analyticsRows: AnalyticsRow[]
  periodRows: BudgetPeriodRow[]
  budgetRows: BudgetRow[]
  bucketRows: BucketBudgetVsActualRow[]
  monthlyBucketActualRows: MonthlyBucketActualsFallbackRow[]
  monthlyBucketBudgetRows: MonthlyBucketBudgetsFallbackRow[]
}> {
  const startMonth = Math.min(...months)
  const endMonth = Math.max(...months)
  const startDate = `${YEAR_2026}-${String(startMonth).padStart(2, '0')}-01`
  const endDate = `${YEAR_2026}-${String(endMonth).padStart(2, '0')}-31`

  const [analyticsRes, periodsRes, bucketVsActualRes, monthlyBucketActualsRes, monthlyBucketBudgetsRes] = await Promise.all([
    budgetDb
      .from('analytics_monthly_category_metrics')
      .select('period_month, category_id, amount_total')
      .eq('period_year', YEAR_2026)
      .in('period_month', months),
    budgetDb
      .from('budget_periods')
      .select('id, period_month')
      .eq('period_year', YEAR_2026)
      .in('period_month', months),
    budgetDb
      .from('budget_bucket_budget_vs_actual_by_month')
      .select('period_month,budget_bucket,target_budget_bucket_eur,actual_budget_bucket_eur')
      .eq('period_year', YEAR_2026)
      .in('period_month', months),
    budgetDb
      .from('v_monthly_bucket_actuals_clean')
      .select('month_start,budget_bucket,revenue_amount,net_amount')
      .gte('month_start', startDate)
      .lte('month_start', endDate),
    budgetDb
      .from('budget_bucket_totals_by_period')
      .select('period_month,budget_bucket,total_budget_bucket_eur')
      .eq('period_year', YEAR_2026)
      .in('period_month', months),
  ])

  if (analyticsRes.error) throw new Error(`analytics query failed: ${analyticsRes.error.message}`)
  if (periodsRes.error) throw new Error(`periods query failed: ${periodsRes.error.message}`)
  if (bucketVsActualRes.error) throw new Error(`bucket budget-vs-actual query failed: ${bucketVsActualRes.error.message}`)
  if (monthlyBucketActualsRes.error) throw new Error(`v_monthly_bucket_actuals_clean query failed: ${monthlyBucketActualsRes.error.message}`)
  if (monthlyBucketBudgetsRes.error) throw new Error(`budget_bucket_totals_by_period query failed: ${monthlyBucketBudgetsRes.error.message}`)

  const periodRows = (periodsRes.data ?? []) as BudgetPeriodRow[]
  const periodIds = periodRows.map((row) => row.id)

  let budgetRows: BudgetRow[] = []
  if (periodIds.length > 0) {
    const budgetsRes = await budgetDb
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
    bucketRows: (bucketVsActualRes.data ?? []) as BucketBudgetVsActualRow[],
    monthlyBucketActualRows: (monthlyBucketActualsRes.data ?? []) as MonthlyBucketActualsFallbackRow[],
    monthlyBucketBudgetRows: (monthlyBucketBudgetsRes.data ?? []) as MonthlyBucketBudgetsFallbackRow[],
  }
}

export function Annual2026BlockMetrics({
  hideParameterRow = false,
  scopeSelection,
  visualAccentColor,
  period,
  displayMode = 'tableau',
  compactMobile = false,
  rollingStats = [],
}: Annual2026BlockMetricsProps) {
  const [analysisType, setAnalysisType] = useState<'bloc' | 'catégorie'>('bloc')
  const [selectedBlock, setSelectedBlock] = useState<string>(BUCKET_ORDER[0] as string)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('2026')

  useEffect(() => {
    if (!scopeSelection) return
    if (scopeSelection.kind === 'bloc') {
      setAnalysisType('bloc')
      setSelectedBlock(scopeSelection.id)
    } else {
      setAnalysisType('catégorie')
      setSelectedCategoryId(scopeSelection.id)
    }
  }, [scopeSelection])

  useEffect(() => {
    if (!period) return
    setSelectedPeriod(period)
  }, [period])

  const periods = ['2026', ...MONTH_LABELS_SHORT.slice(0, 5).map((label) => FULL_MONTH_LABEL_BY_SHORT[label] ?? label)]
  const selectedMonths = useMemo(() => periodMonths(selectedPeriod), [selectedPeriod])
  const range = useMemo(() => periodDateRange(selectedMonths), [selectedMonths])

  const yearMonths = useMemo(() => {
    const lastMonth = getActiveYearMonth()
    return Array.from({ length: lastMonth }, (_, i) => i + 1)
  }, [])

  const { data: categories = [] } = useQuery({
    queryKey: ['budget-metrics-categories'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await budgetDb
        .from('categories')
        .select('id, name, parent_id')
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

  const { data: bucketMapRows = [] } = useQuery({
    queryKey: ['budget-metrics-bucket-map'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await budgetDb
        .from('category_budget_bucket_map')
        .select('category_id, budget_bucket')
      if (error) throw new Error(`bucket map query failed: ${error.message}`)
      return (data ?? []) as BucketMapRow[]
    },
  })

  const { data: periodDataset } = useQuery({
    queryKey: ['budget-metrics-period-dataset', selectedMonths.join(',')],
    staleTime: 30_000,
    queryFn: () => fetchDatasetForMonths(selectedMonths),
  })

  const { data: yearDataset } = useQuery({
    queryKey: ['budget-metrics-year-dataset', yearMonths.join(',')],
    staleTime: 30_000,
    queryFn: () => fetchDatasetForMonths(yearMonths),
  })

  const periodBucketMetrics = useMemo(() => {
    const metrics = buildBudgetYtdBucketMetrics(periodDataset?.bucketRows ?? [], selectedMonths)
    applyRevenueSavingsFallbackToMetrics(
      metrics,
      selectedMonths,
      periodDataset?.monthlyBucketActualRows ?? [],
      periodDataset?.monthlyBucketBudgetRows ?? [],
    )
    return metrics
  }, [
    periodDataset?.bucketRows,
    periodDataset?.monthlyBucketActualRows,
    periodDataset?.monthlyBucketBudgetRows,
    selectedMonths,
  ])

  const yearBucketMetrics = useMemo(() => {
    const metrics = buildBudgetYtdBucketMetrics(yearDataset?.bucketRows ?? [], yearMonths)
    applyRevenueSavingsFallbackToMetrics(
      metrics,
      yearMonths,
      yearDataset?.monthlyBucketActualRows ?? [],
      yearDataset?.monthlyBucketBudgetRows ?? [],
    )
    return metrics
  }, [
    yearDataset?.bucketRows,
    yearDataset?.monthlyBucketActualRows,
    yearDataset?.monthlyBucketBudgetRows,
    yearMonths,
  ])

  const scopeCategoryIds = useMemo(() => {
    if (analysisType === 'bloc') {
      return bucketMapRows.filter((row) => row.budget_bucket === selectedBlock).map((row) => row.category_id)
    }
    if (selectedCategoryId === ALL_CATEGORIES_ID) {
      return categories.map((row) => row.id)
    }
    if (!selectedCategoryId) return []
    return [selectedCategoryId, ...(childrenByParentId.get(selectedCategoryId) ?? [])]
  }, [analysisType, selectedBlock, selectedCategoryId, bucketMapRows, childrenByParentId, categories])

  const selectedVisualizationBucket = useMemo<BudgetBucketId | null>(() => {
    if (analysisType === 'bloc' && isBudgetBucketId(selectedBlock)) return selectedBlock
    if (analysisType !== 'catégorie') return null
    if (!selectedCategoryId || selectedCategoryId === ALL_CATEGORIES_ID) return null

    const candidateIds = new Set<string>([selectedCategoryId, ...(childrenByParentId.get(selectedCategoryId) ?? [])])
    const counts = new Map<BudgetBucketId, number>()

    for (const row of bucketMapRows) {
      if (!candidateIds.has(row.category_id)) continue
      if (!isBudgetBucketId(row.budget_bucket)) continue
      counts.set(row.budget_bucket, (counts.get(row.budget_bucket) ?? 0) + 1)
    }

    if (counts.size === 0) return null
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }, [analysisType, selectedBlock, selectedCategoryId, childrenByParentId, bucketMapRows])

  const histogramBarColor = visualAccentColor
    ?? (selectedVisualizationBucket
      ? HISTOGRAM_BUCKET_COLOR[selectedVisualizationBucket]
      : 'var(--primary-500)')

  const selectedRevenueSavingsUnavailable = useMemo(() => {
    if (analysisType !== 'bloc') return false
    if (selectedBlock !== 'revenu' && selectedBlock !== 'epargne') return false
    if (!isBudgetBucketId(selectedBlock)) return false
    const totals = periodBucketMetrics.byBucket.get(selectedBlock)
    if (!totals) return true
    return Math.abs(totals.actualAmount) < 0.0001 && Math.abs(totals.budgetAmount) < 0.0001
  }, [analysisType, selectedBlock, periodBucketMetrics.byBucket])

  const rollingStatsByCategoryId = useMemo(() => (
    new Map(rollingStats.map((row) => [row.category_id, row]))
  ), [rollingStats])

  const rollingScopeStats = useMemo((): { averageAmount12m: number | null; medianAmount12m: number | null } => {
    if (!rollingStats.length) return { averageAmount12m: null, medianAmount12m: null }

    if (analysisType === 'bloc' && isBudgetBucketId(selectedBlock)) {
      const bucketRows = rollingStats.filter((row) => row.budget_bucket === selectedBlock)
      const avgRows = bucketRows
        .map((row) => asNullableFiniteNumber(row.avg_monthly_amount_12m))
        .filter((value): value is number => value != null)
      const averageAmount12m = avgRows.length > 0
        ? avgRows.reduce((sum, value) => sum + value, 0)
        : null

      const yearMonthValues = yearMonths.map((month) => yearBucketMetrics.byBucketMonth.get(`${selectedBlock}:${month}`)?.actual_amount ?? 0)
      const hasYearValues = yearMonthValues.some((value) => Number.isFinite(value))
      const medianAmount12m = hasYearValues ? median(yearMonthValues) : null
      return { averageAmount12m, medianAmount12m }
    }

    const categoryIdSet = new Set(scopeCategoryIds)
    const scopedRows = rollingStats.filter((row) => categoryIdSet.has(row.category_id))
    const avgRows = scopedRows
      .map((row) => asNullableFiniteNumber(row.avg_monthly_amount_12m))
      .filter((value): value is number => value != null)
    const averageAmount12m = avgRows.length > 0
      ? avgRows.reduce((sum, value) => sum + value, 0)
      : null

    let medianAmount12m: number | null = null
    if (scopeCategoryIds.length === 1) {
      medianAmount12m = asNullableFiniteNumber(rollingStatsByCategoryId.get(scopeCategoryIds[0])?.median_monthly_amount_12m)
    } else {
      const selectedCategoryIdSet = new Set(scopeCategoryIds)
      const monthlyTotals = new Map<number, number>()
      for (const month of yearMonths) monthlyTotals.set(month, 0)
      for (const row of yearDataset?.analyticsRows ?? []) {
        if (!selectedCategoryIdSet.has(row.category_id)) continue
        monthlyTotals.set(row.period_month, (monthlyTotals.get(row.period_month) ?? 0) + Number(row.amount_total ?? 0))
      }
      medianAmount12m = median(yearMonths.map((month) => monthlyTotals.get(month) ?? 0))
    }

    return { averageAmount12m, medianAmount12m }
  }, [
    analysisType,
    rollingStats,
    rollingStatsByCategoryId,
    scopeCategoryIds,
    selectedBlock,
    yearBucketMetrics.byBucketMonth,
    yearDataset?.analyticsRows,
    yearMonths,
  ])

  const { data: transactionCount = 0 } = useQuery({
    queryKey: ['budget-metrics-transaction-count', range.startDate, range.endDate, scopeCategoryIds.join(',')],
    enabled: scopeCategoryIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { count, error } = await budgetDb
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('is_hidden', false)
        .gte('transaction_date', range.startDate)
        .lte('transaction_date', range.endDate)
        .in('category_id', scopeCategoryIds)

      if (error) throw new Error(`transactions count query failed: ${error.message}`)
      return count ?? 0
    },
  })

  const metricsState = useMemo(() => {
    if (analysisType === 'bloc' && isBudgetBucketId(selectedBlock)) {
      const selectedTotals = periodBucketMetrics.byBucket.get(selectedBlock) ?? {
        actualAmount: 0,
        budgetAmount: 0,
        varianceAmount: 0,
        variancePct: null,
      }
      const monthValues = selectedMonths.map((month) => periodBucketMetrics.byBucketMonth.get(`${selectedBlock}:${month}`)?.actual_amount ?? 0)
      const averageAmountComputed = monthValues.length ? monthValues.reduce((sum, value) => sum + value, 0) / monthValues.length : 0
      const medianAmountComputed = median(monthValues)
      const rankedBuckets = ALLOWED_BUCKETS
        .map((bucket) => ({ bucket, amount: periodBucketMetrics.byBucket.get(bucket)?.actualAmount ?? 0 }))
        .sort((a, b) => b.amount - a.amount)
      const rankIndex = rankedBuckets.findIndex((entry) => entry.bucket === selectedBlock)

      return {
        actualAmount: selectedTotals.actualAmount,
        budgetAmount: selectedTotals.budgetAmount,
        deltaPct: selectedTotals.variancePct == null ? 0 : selectedTotals.variancePct * 100,
        deltaPctRaw: selectedTotals.variancePct,
        averageAmount: rollingScopeStats.averageAmount12m ?? averageAmountComputed,
        medianAmount: rollingScopeStats.medianAmount12m ?? medianAmountComputed,
        rank: rankIndex >= 0 ? `#${rankIndex + 1}` : '—',
      }
    }

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
    const averageAmountComputed = monthValues.length ? monthValues.reduce((sum, value) => sum + value, 0) / monthValues.length : 0
    const medianAmountComputed = median(monthValues)
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
    } else if (selectedCategoryId && selectedCategoryId !== ALL_CATEGORIES_ID) {
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
      deltaPctRaw: budgetAmount > 0 ? deltaPct / 100 : null,
      averageAmount: rollingScopeStats.averageAmount12m ?? averageAmountComputed,
      medianAmount: rollingScopeStats.medianAmount12m ?? medianAmountComputed,
      rank: rank > 0 ? `#${rank}` : '—',
    }
  }, [
    rollingScopeStats.averageAmount12m,
    rollingScopeStats.medianAmount12m,
    periodBucketMetrics,
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

  const yearlySeries = useMemo(() => {
    if (analysisType === 'bloc' && isBudgetBucketId(selectedBlock)) {
      const rows = yearMonths.map((month) => {
        const metric = yearBucketMetrics.byBucketMonth.get(`${selectedBlock}:${month}`)
        return {
          month,
          monthLabel: MONTH_LABELS_SHORT[month - 1] ?? `M${month}`,
          amount: metric?.actual_amount ?? 0,
          budget: metric?.budget_amount ?? 0,
          avg12m: rollingScopeStats.averageAmount12m,
          median12m: rollingScopeStats.medianAmount12m,
        }
      })

      const budgetTarget = rows.length ? rows.reduce((sum, row) => sum + row.budget, 0) / rows.length : 0
      return { rows, budgetTarget }
    }

    const analyticsRows = yearDataset?.analyticsRows ?? []
    const budgetRows = yearDataset?.budgetRows ?? []
    const periodRows = yearDataset?.periodRows ?? []
    const selectedCategoryIdSet = new Set(scopeCategoryIds)
    const monthActualMap = new Map<number, number>()
    const monthBudgetMap = new Map<number, number>()

    for (const month of yearMonths) {
      monthActualMap.set(month, 0)
      monthBudgetMap.set(month, 0)
    }

    for (const row of analyticsRows) {
      if (!selectedCategoryIdSet.has(row.category_id)) continue
      monthActualMap.set(row.period_month, (monthActualMap.get(row.period_month) ?? 0) + Number(row.amount_total ?? 0))
    }

    const periodMonthById = new Map(periodRows.map((row) => [row.id, row.period_month]))
    for (const row of budgetRows) {
      if (!row.category_id || !selectedCategoryIdSet.has(row.category_id)) continue
      const month = periodMonthById.get(row.period_id)
      if (!month) continue
      monthBudgetMap.set(month, (monthBudgetMap.get(month) ?? 0) + Number(row.amount ?? 0))
    }

    const rows = yearMonths.map((month) => ({
      month,
      monthLabel: MONTH_LABELS_SHORT[month - 1] ?? `M${month}`,
      amount: monthActualMap.get(month) ?? 0,
      budget: monthBudgetMap.get(month) ?? 0,
      avg12m: rollingScopeStats.averageAmount12m,
      median12m: rollingScopeStats.medianAmount12m,
    }))

    const budgetTarget = rows.length ? rows.reduce((sum, row) => sum + row.budget, 0) / rows.length : 0
    return { rows, budgetTarget }
  }, [
    analysisType,
    rollingScopeStats.averageAmount12m,
    rollingScopeStats.medianAmount12m,
    selectedBlock,
    yearBucketMetrics.byBucketMonth,
    yearDataset,
    scopeCategoryIds,
    yearMonths,
  ])

  const currentItemLabel = analysisType === 'bloc'
    ? (BUCKET_LABELS[selectedBlock] ?? selectedBlock)
    : (selectedCategoryId === ALL_CATEGORIES_ID ? 'Toutes catégories' : (categoryNameById.get(selectedCategoryId) ?? 'Catégorie'))

  const histogramYAxisDomain = useMemo(() => {
    const highestDisplayedValue = Math.max(
      0,
      ...yearlySeries.rows.map((row) => Number(row.amount ?? 0)),
      Number(yearlySeries.budgetTarget ?? 0),
      Number(rollingScopeStats.averageAmount12m ?? 0),
      Number(rollingScopeStats.medianAmount12m ?? 0),
    )

    if (!Number.isFinite(highestDisplayedValue) || highestDisplayedValue <= 0) {
      return { min: 0, max: 1000 }
    }

    const step = getNiceStep(highestDisplayedValue / 5)
    const max = highestDisplayedValue + (step * 0.5)

    return { min: 0, max }
  }, [
    rollingScopeStats.averageAmount12m,
    rollingScopeStats.medianAmount12m,
    yearlySeries.budgetTarget,
    yearlySeries.rows,
  ])

  const periodLabelSuffix = FULL_MONTH_LABEL_BY_SHORT[selectedPeriod] ?? selectedPeriod

  const metrics = [
    { label: `Réel ${periodLabelSuffix}`, value: fmtCurrencyCompact(metricsState.actualAmount), color: 'var(--neutral-900)' },
    { label: `Budget ${periodLabelSuffix}`, value: fmtCurrencyCompact(metricsState.budgetAmount), color: 'var(--neutral-900)' },
    {
      label: `Ecart réel/budget ${periodLabelSuffix}`,
      value: metricsState.deltaPctRaw == null ? '—' : fmtPercentCompact(metricsState.deltaPct),
      color: metricsState.deltaPctRaw == null ? 'var(--neutral-500)' : metricsState.deltaPct > 0 ? 'var(--color-error)' : 'var(--color-success)',
    },
    { label: 'Montant moyen (12 mois)', value: fmtCurrencyCompact(metricsState.averageAmount), color: 'var(--neutral-900)' },
    { label: 'Médiane (12 mois)', value: fmtCurrencyCompact(metricsState.medianAmount), color: 'var(--neutral-900)' },
    { label: `Nbre d'opérations ${periodLabelSuffix}`, value: String(transactionCount), color: 'var(--neutral-900)' },
    { label: 'Rang', value: metricsState.rank, color: 'var(--neutral-900)' },
  ]

  const renderHistoryTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean
    payload?: Array<{ payload?: { amount?: number; budget?: number; avg12m?: number | null; median12m?: number | null } }>
    label?: string
  }) => {
    if (!active || !payload?.length) return null
    const row = payload[0]?.payload
    if (!row) return null
    const monthLabelFull = label ? (FULL_MONTH_LABEL_BY_SHORT[label] ?? label) : 'Mois'

    return (
      <div
        style={{
          background: 'var(--neutral-0)',
          border: '1px solid var(--neutral-150)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)',
          padding: '8px 10px',
          display: 'grid',
          gap: 4,
          width: 'fit-content',
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: 'var(--neutral-900)', fontWeight: 800 }}>{monthLabelFull}</p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-900)' }}>Réel: <strong>{fmtCurrencyCompact(Number(row.amount ?? 0))}</strong></p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-900)' }}>
          Budget 26: <strong>{fmtCurrencyCompact(Number(row.budget ?? 0))}</strong>
        </p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-900)' }}>
          Moy. 12m: <strong>{row.avg12m == null ? '—' : fmtCurrencyCompact(Number(row.avg12m))}</strong>
        </p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-900)' }}>
          Méd. 12m: <strong>{row.median12m == null ? '—' : fmtCurrencyCompact(Number(row.median12m))}</strong>
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: compactMobile ? 'var(--space-2)' : 'var(--space-3)', padding: hideParameterRow ? '0' : '0 var(--space-6)', marginTop: hideParameterRow ? 0 : 'var(--space-4)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
        {!hideParameterRow ? (
          <>
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
                  onSelect={analysisType === 'bloc' ? (id) => setSelectedBlock(id) : setSelectedCategoryId}
                />
              </div>
              <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--neutral-200)', background: 'var(--neutral-100)', padding: 'var(--space-3) var(--space-2)', minHeight: 66, display: 'grid', placeItems: 'center' }}>
                <Selector
                  label="Période"
                  value={selectedPeriod}
                  options={periods.map((periodOption) => ({ id: periodOption, label: periodOption }))}
                  onSelect={setSelectedPeriod}
                />
              </div>
            </div>
          </>
        ) : null}

        {selectedRevenueSavingsUnavailable ? (
          <p style={{ margin: '0 0 var(--space-2)', fontSize: 11, color: 'var(--neutral-500)', textAlign: 'center' }}>
            Données Revenus / Épargne non disponibles pour cette vue.
          </p>
        ) : null}

        {displayMode === 'graphique' ? (
          <div style={{ margin: compactMobile ? 'var(--space-1) var(--space-3) var(--space-3)' : 'var(--space-1) var(--space-5) var(--space-4)', display: 'grid', gap: 8 }}>
            <div style={{ width: '100%', height: compactMobile ? 234 : 252 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearlySeries.rows} margin={{ top: 8, right: 4, left: -10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-150)" vertical={false} />
                  <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--neutral-500)' }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'var(--neutral-500)' }}
                    tickFormatter={(value) => fmtCurrencyCompact(Number(value))}
                    width={68}
                    domain={[histogramYAxisDomain.min, histogramYAxisDomain.max]}
                    tickCount={5}
                  />
                  <Tooltip content={renderHistoryTooltip} />
                  <ReferenceLine y={yearlySeries.budgetTarget} stroke={HISTOGRAM_BUDGET_LINE_COLOR} strokeWidth={2} />
                  {rollingScopeStats.averageAmount12m != null ? (
                    <ReferenceLine y={rollingScopeStats.averageAmount12m} stroke={HISTOGRAM_AVG12_LINE_COLOR} strokeWidth={2} strokeDasharray="4 4" />
                  ) : null}
                  {rollingScopeStats.medianAmount12m != null ? (
                    <ReferenceLine y={rollingScopeStats.medianAmount12m} stroke={HISTOGRAM_MEDIAN12_LINE_COLOR} strokeWidth={2} strokeDasharray="4 4" />
                  ) : null}
                  <Bar dataKey="amount" fill={histogramBarColor} radius={[6, 6, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'nowrap',
                  overflowX: 'auto',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                  fontSize: 9,
                  color: 'var(--neutral-500)',
                  fontFamily: 'var(--font-mono)',
                  paddingBottom: 2,
                }}
              >
                {HISTORIQUE_LEGEND.map((item) => (
                  <span key={item.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                    <span>{item.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-1)', maxWidth: compactMobile ? 300 : 340, margin: '0 auto', width: '100%' }}
          >
            {metrics.map((metric) => (
              <div key={metric.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'baseline', gap: 'var(--space-2)', padding: '6px 0', borderBottom: '1px solid var(--neutral-100)' }}>
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
        )}
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
