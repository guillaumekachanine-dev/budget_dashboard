import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type {
  AnnualTotalsPayload,
  MonthlyProfilePoint,
  Top5CategoryItem,
} from '@/features/annual-analysis/types'
import { useCategories } from '@/hooks/useCategories'
import { budgetDb } from '@/lib/supabaseBudget'
import type { Category } from '@/lib/types'
import { formatCurrencyRounded as formatCurrency, getCategoryColor } from '@/lib/utils'

type Props = {
  annualTotals: AnnualTotalsPayload | null
  monthlyProfile: MonthlyProfilePoint[]
  top5ParentCategories: Top5CategoryItem[]
  top5LeafCategories: Top5CategoryItem[]
}

type Annual2026YtdMetricRow = {
  period_month: number | null
  amount_total: number | null
  category_id: string | null
  category_name: string | null
  parent_category_id: string | null
  parent_category_name: string | null
}

type RankedKpiRow = {
  id: string
  name: string
  amount: number
  sharePct: number | null
  color: string
}

type Ytd2026KpiData = {
  topParent: RankedKpiRow | null
  topLeaf: RankedKpiRow | null
  avgMonthlyExpense: number | null
  medianMonthlyExpense: number | null
}

type CardFaceData = {
  title: string
  name?: string
  amount: number | null
  detail?: string
  cardColor: string
  emphasizeName?: boolean
  nameAccent?: string
}

function asFiniteNumber(value: unknown): number | null {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[middle - 1] + sorted[middle]) / 2
  return sorted[middle]
}

function normalizeToken(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function fuzzyEquals(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  return a.includes(b) || b.includes(a)
}

function formatSharePercentInt(share: number | null | undefined): string {
  if (share == null || !Number.isFinite(share)) return '—'
  const normalizedPct = share <= 1 ? share * 100 : share
  return `${Math.round(normalizedPct)}%`
}

function findParentCategoryByName(categories: Category[], parentName?: string): Category | null {
  if (!parentName) return null
  const parentToken = normalizeToken(parentName)
  return categories.find((category) => (
    category.parent_id === null && fuzzyEquals(normalizeToken(category.name), parentToken)
  )) ?? null
}

function findLeafCategoryByNames(
  categories: Category[],
  leafName?: string,
  parentName?: string | null,
): Category | null {
  if (!leafName) return null
  const leafToken = normalizeToken(leafName)
  const parentToken = normalizeToken(parentName)
  const categoryById = new Map(categories.map((category) => [category.id, category]))

  const exact = categories.find((category) => {
    if (category.parent_id == null) return false
    if (normalizeToken(category.name) !== leafToken) return false
    if (!parentToken) return true
    const parentCategory = categoryById.get(category.parent_id)
    return normalizeToken(parentCategory?.name) === parentToken
  })
  if (exact) return exact

  return categories.find((category) => (
    category.parent_id != null
    && fuzzyEquals(normalizeToken(category.name), leafToken)
    && (!parentToken || fuzzyEquals(normalizeToken(categoryById.get(category.parent_id)?.name), parentToken))
  )) ?? null
}

async function getAnnual2026YtdMetricRows(): Promise<Annual2026YtdMetricRow[]> {
  const { data, error } = await budgetDb
    .from('analytics_monthly_category_metrics')
    .select('period_month, amount_total, category_id, category_name, parent_category_id, parent_category_name')
    .eq('period_year', 2026)
    .eq('flow_type', 'expense')
    .order('period_month', { ascending: true })

  if (error) throw new Error(`getAnnual2026YtdMetricRows failed: ${error.message}`)
  return (data ?? []) as Annual2026YtdMetricRow[]
}

function buildAnnual2026YtdKpis(rows: Annual2026YtdMetricRow[], categories: Category[]): Ytd2026KpiData {
  if (!rows.length) {
    return {
      topParent: null,
      topLeaf: null,
      avgMonthlyExpense: null,
      medianMonthlyExpense: null,
    }
  }

  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const monthTotals = new Map<number, number>()
  const parentTotals = new Map<string, { id: string; name: string; amount: number }>()
  const leafTotals = new Map<string, { id: string; name: string; parentId: string | null; parentName: string | null; amount: number }>()

  for (const row of rows) {
    const categoryId = row.category_id?.trim() ?? ''
    const amount = Math.abs(asFiniteNumber(row.amount_total) ?? 0)
    const month = Number(row.period_month ?? 0)
    if (!categoryId || amount <= 0 || month <= 0) continue

    const categoryMeta = categoryById.get(categoryId)
    const isLeaf = categoryMeta
      ? categoryMeta.parent_id != null
      : Boolean(row.parent_category_id && row.parent_category_id !== categoryId)
    if (!isLeaf) continue

    monthTotals.set(month, (monthTotals.get(month) ?? 0) + amount)

    const parentId = categoryMeta?.parent_id ?? row.parent_category_id ?? null
    const parentName = parentId
      ? (categoryById.get(parentId)?.name ?? row.parent_category_name ?? 'Catégorie')
      : (row.parent_category_name ?? 'Catégorie')
    const parentKey = parentId ?? normalizeToken(parentName) ?? 'unknown_parent'
    const parentEntry = parentTotals.get(parentKey) ?? { id: parentId ?? parentKey, name: parentName, amount: 0 }
    parentEntry.amount += amount
    parentTotals.set(parentKey, parentEntry)

    const leafEntry = leafTotals.get(categoryId) ?? {
      id: categoryId,
      name: categoryMeta?.name ?? row.category_name ?? 'Sous-catégorie',
      parentId,
      parentName: parentName ?? null,
      amount: 0,
    }
    leafEntry.amount += amount
    leafTotals.set(categoryId, leafEntry)
  }

  const totalYtd = [...monthTotals.values()].reduce((sum, value) => sum + value, 0)
  const monthValues = [...monthTotals.values()]
  const avgMonthlyExpense = monthValues.length > 0 ? totalYtd / monthValues.length : null
  const medianMonthlyExpense = computeMedian(monthValues)

  const topParentEntry = [...parentTotals.values()].sort((a, b) => b.amount - a.amount)[0]
  const topLeafEntry = [...leafTotals.values()].sort((a, b) => b.amount - a.amount)[0]

  const topParent: RankedKpiRow | null = topParentEntry
      ? {
        id: topParentEntry.id,
        name: topParentEntry.name,
        amount: topParentEntry.amount,
        sharePct: totalYtd > 0 ? topParentEntry.amount / totalYtd : null,
        color: getCategoryColor(categoryById.get(topParentEntry.id)?.color_token ?? null, 0),
      }
    : null

  const topLeafCategory = topLeafEntry ? categoryById.get(topLeafEntry.id) ?? null : null
  const topLeaf: RankedKpiRow | null = topLeafEntry
      ? {
        id: topLeafEntry.id,
        name: topLeafEntry.name,
        amount: topLeafEntry.amount,
        sharePct: totalYtd > 0 ? topLeafEntry.amount / totalYtd : null,
        color: getCategoryColor(topLeafCategory?.color_token ?? null, 1),
      }
    : null

  return {
    topParent,
    topLeaf,
    avgMonthlyExpense,
    medianMonthlyExpense,
  }
}

export function AnnualKeyInsightsGrid({
  annualTotals,
  monthlyProfile,
  top5ParentCategories,
  top5LeafCategories,
}: Props) {
  const { data: categories = [] } = useCategories()
  const [flippedByCard, setFlippedByCard] = useState<Record<string, boolean>>({})

  const { data: ytd2026Rows = [] } = useQuery({
    queryKey: ['annual-2026-ytd-kpi-cards'],
    queryFn: getAnnual2026YtdMetricRows,
    staleTime: 15 * 60_000,
  })

  const ytd2026 = useMemo(() => buildAnnual2026YtdKpis(ytd2026Rows, categories), [ytd2026Rows, categories])

  const topParentCategory = top5ParentCategories[0]
  const topLeafCategory = top5LeafCategories[0]
  const averageMonthlyExpense2025 = asFiniteNumber(annualTotals?.avg_monthly_expense)
  const monthlyExpenses2025 = monthlyProfile
    .map((item) => asFiniteNumber(item.expense_total))
    .filter((value): value is number => value != null)
  const medianMonthlyExpense2025 = computeMedian(monthlyExpenses2025)

  const parentMeta2025 = useMemo(() => (
    findParentCategoryByName(categories, topParentCategory?.category_name)
  ), [categories, topParentCategory?.category_name])
  const leafMeta2025 = useMemo(() => (
    findLeafCategoryByNames(categories, topLeafCategory?.category_name, topLeafCategory?.parent_category_name)
  ), [categories, topLeafCategory?.category_name, topLeafCategory?.parent_category_name])

  const frontCards: Array<{ id: string; face: CardFaceData }> = [
    {
      id: 'top-parent',
      face: {
        title: 'Catégorie #1',
        name: topParentCategory?.category_name ?? '—',
        amount: topParentCategory?.amount ?? null,
        detail: `${formatSharePercentInt(topParentCategory?.pct)} du budget 2025`,
        cardColor: getCategoryColor(parentMeta2025?.color_token ?? null, 0),
        emphasizeName: true,
        nameAccent: 'var(--primary-700)',
      },
    },
    {
      id: 'top-leaf',
      face: {
        title: 'Poste #1',
        name: topLeafCategory?.category_name ?? '—',
        amount: topLeafCategory?.amount ?? null,
        detail: `${formatSharePercentInt(topLeafCategory?.pct)} du budget 2025`,
        cardColor: getCategoryColor(leafMeta2025?.color_token ?? null, 1),
        emphasizeName: true,
        nameAccent: 'var(--color-error)',
      },
    },
    {
      id: 'avg-month',
      face: {
        title: 'Moyenne/mois',
        name: 'Dépenses',
        amount: averageMonthlyExpense2025,
        cardColor: 'var(--primary-500)',
      },
    },
    {
      id: 'median',
      face: {
        title: 'Médiane 2025',
        name: 'Dépenses',
        amount: medianMonthlyExpense2025,
        cardColor: 'var(--color-warning)',
      },
    },
  ]

  const backById: Record<string, CardFaceData> = {
    'top-parent': {
      title: 'Catégorie #1 YTD',
      name: ytd2026.topParent?.name ?? '—',
      amount: ytd2026.topParent?.amount ?? null,
      detail: `${formatSharePercentInt(ytd2026.topParent?.sharePct)} du budget YTD 2026`,
      cardColor: ytd2026.topParent?.color ?? 'var(--primary-500)',
      emphasizeName: true,
      nameAccent: 'var(--primary-700)',
    },
    'top-leaf': {
      title: 'Poste #1 YTD',
      name: ytd2026.topLeaf?.name ?? '—',
      amount: ytd2026.topLeaf?.amount ?? null,
      detail: `${formatSharePercentInt(ytd2026.topLeaf?.sharePct)} du budget YTD 2026`,
      cardColor: ytd2026.topLeaf?.color ?? 'var(--color-warning)',
      emphasizeName: true,
      nameAccent: 'var(--color-error)',
    },
    'avg-month': {
      title: 'Moyenne/mois YTD',
      name: 'Dépenses',
      amount: ytd2026.avgMonthlyExpense,
      cardColor: 'var(--primary-500)',
    },
    median: {
      title: 'Médiane 2025 YTD',
      name: 'Dépenses',
      amount: ytd2026.medianMonthlyExpense,
      cardColor: 'var(--color-warning)',
    },
  }

  return (
    <section style={{ padding: '0 var(--space-6)', marginTop: 'var(--space-3)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 'var(--space-3)',
        }}>
          {frontCards.map(({ id, face }) => (
            <FlipInsightCard
              key={id}
              front={face}
              back={backById[id] ?? face}
              flipped={Boolean(flippedByCard[id])}
              onToggle={() => {
                setFlippedByCard((previous) => ({ ...previous, [id]: !previous[id] }))
              }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function FlipInsightCard({
  front,
  back,
  flipped,
  onToggle,
}: {
  front: CardFaceData
  back: CardFaceData
  flipped: boolean
  onToggle: () => void
}) {
  const flipDurationMs = 260

  return (
    <button
      type="button"
      aria-pressed={flipped}
      onClick={onToggle}
      style={{
        width: '100%',
        border: 'none',
        background: 'transparent',
        padding: 0,
        cursor: 'pointer',
        perspective: 900,
      }}
    >
      <span
        style={{
          position: 'relative',
          display: 'block',
          minHeight: 124,
          transformStyle: 'preserve-3d',
          transition: `transform ${flipDurationMs}ms cubic-bezier(0.23, 0.91, 0.3, 1)`,
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        <span style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}>
          <CardFace face={front} visible={!flipped} isBack={false} flipDurationMs={flipDurationMs} />
        </span>
        <span style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          <CardFace face={back} visible={flipped} isBack flipDurationMs={flipDurationMs} />
        </span>
      </span>
    </button>
  )
}

function CardFace({
  face,
  visible,
  isBack,
  flipDurationMs,
}: {
  face: CardFaceData
  visible: boolean
  isBack: boolean
  flipDurationMs: number
}) {
  const hasName = Boolean(face.name)
  const yearText = isBack ? '2026' : '2025'
  const yearBadgeColor = isBack ? '#002FA7' : '#FF9A00'
  const yearTransitionDelay = visible ? Math.round(flipDurationMs * 0.34) : 0

  return (
    <span style={{
      position: 'relative',
      background: `color-mix(in srgb, ${face.cardColor} 40%, transparent)`,
      borderRadius: 'var(--radius-lg)',
      border: `1px solid color-mix(in srgb, ${face.cardColor} 55%, white)`,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      minHeight: 124,
      minWidth: 0,
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      <span style={{
        margin: 0,
        width: '100%',
        minHeight: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        position: 'relative',
        padding: '5px 44px 4px 10px',
        borderRadius: 0,
        background: `linear-gradient(135deg, color-mix(in srgb, ${face.cardColor} 72%, white), color-mix(in srgb, ${face.cardColor} 42%, var(--neutral-0)))`,
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.58),
          inset 0 -1px 0 rgba(0,0,0,0.08),
          0 4px 10px rgba(13,13,31,0.1)
        `,
        borderBottom: `1px solid color-mix(in srgb, ${face.cardColor} 78%, white)`,
        fontSize: 10,
        fontWeight: 800,
        color: 'var(--neutral-900)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        textAlign: 'center',
        lineHeight: 1.2,
      }}>
        <span
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            minWidth: 34,
            height: 16,
            borderRadius: 999,
            padding: '0 8px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: yearBadgeColor,
            color: '#FFFFFF',
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.06em',
            lineHeight: 1,
            boxShadow: '0 1px 4px rgba(13,13,31,0.18), inset 0 1px 0 rgba(255,255,255,0.2)',
            opacity: visible ? 1 : 0,
            transition: `opacity 110ms ease ${yearTransitionDelay}ms`,
          }}
        >
          {yearText}
        </span>
        <span
          style={{
            width: '100%',
            textAlign: 'left',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {face.title}
        </span>
      </span>

      {hasName ? (
        <span style={{
          marginTop: 8,
          display: 'grid',
          justifyItems: 'center',
          minHeight: 19,
          alignContent: 'start',
          padding: '0 10px',
        }}>
          <span style={{
            margin: 0,
            fontSize: face.emphasizeName ? 12 : 10,
            color: face.nameAccent ?? 'var(--neutral-700)',
            fontWeight: face.emphasizeName ? 800 : 'var(--font-weight-semibold)',
            lineHeight: face.emphasizeName ? 1.15 : 1.05,
            textAlign: 'center',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
          {face.name}
          </span>
        </span>
      ) : null}

      <span style={{
        margin: hasName ? '8px 0 0' : '24px 0 0',
        textAlign: 'center',
        fontSize: 'var(--font-size-base)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--neutral-900)',
        fontFamily: 'var(--font-mono)',
        whiteSpace: 'nowrap',
      }}>
        {face.amount != null ? formatCurrency(face.amount) : '—'}
      </span>

      {face.detail ? (
        <span style={{
          margin: '4px 0 0',
          fontSize: 10,
          color: 'var(--neutral-700)',
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}>
          {face.detail}
        </span>
      ) : null}
    </span>
  )
}
