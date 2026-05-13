import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, LayoutGrid, X } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList, Cell, ReferenceLine, ReferenceDot } from 'recharts'
import type { MetricsScopeSelection } from '@/features/annual-analysis/components/Annual2026BlockMetrics'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import {
  type CategoryAnnualCostProjection2026,
} from '@/features/annual-analysis/api/getCategoryAnnualCostProjection2026'
import { useCategoryAnnualCostProjection2026 } from '@/features/annual-analysis/hooks/useCategoryAnnualCostProjection2026'
import { VIZ_PALETTE, BUCKET_LABELS, PILOTAGE_BUCKET_ORDER } from '@/features/annual-analysis/components/_constants'
import {
  assertNoNonExpenseBucketsInExpenseTotal,
  isExpenseBucket,
} from '@/features/annual-analysis/components/_constants'
import { useCategories } from '@/hooks/useCategories'
import { formatCurrencyFloored, getCategoryColor } from '@/lib/utils'
import blockFixeIcon from '@/assets/icons/blocks/fixe.png'
import blockVariableIcon from '@/assets/icons/blocks/variable.png'
import blockDiscretionnaireIcon from '@/assets/icons/blocks/discretionnaire.png'
import blockEpargneIcon from '@/assets/icons/blocks/epargne.png'
import blockProvisionsIcon from '@/assets/icons/blocks/provisions.png'

type ProjectionViewMode = 'category' | 'year'

type CategoryProjectionPoint = {
  parentKey: string
  name: string
  theoreticalAnnualAmount: number
  refinedAnnualAmount: number
  color: string
  isSelected: boolean
}

type ParentProjectionGroup = {
  parentKey: string
  parentName: string
  monthsElapsed: number
  remainingMonths: number
  actualYtdAmount: number
  avgMonthlyYtdAmount: number
  projectedAnnualAmount: number
  budgetYtdAmount: number
  budgetAnnualAmount: number
  projectedVsBudgetAmount: number
  projectedVsBudgetPct: number
  children: CategoryAnnualCostProjection2026[]
}

type BlockDeltaBarRow = {
  blockKey: string
  name: string
  deltaAmount: number
  color: string
  iconSrc: string | null
  isTotal: boolean
  isSelected: boolean
}

type DeltaBlockCategoryRow = {
  categoryId: string
  categoryName: string
  iconKey: string | null
  deltaAmount: number
}

type DeltaBlockSummaryRow = {
  blockKey: string
  name: string
  color: string
  iconSrc: string | null
  categoryCount: number
  budgetYtdAmount: number
  projectedAmount: number
  deltaAmount: number
  categories: DeltaBlockCategoryRow[]
}

type AnnualProjectionSectionConnectedProps = {
  scopeSelection?: MetricsScopeSelection
}

const fmtCurrency = (n: number) => formatCurrencyFloored(n)

const fmtPctSigned = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
const fmtPctSignedRounded = (value: number) => `${value > 0 ? '+' : ''}${Math.round(value)}%`

const ALL_CATEGORIES_SCOPE_ID = 'all_categories'
const BLOCK_DELTA_COLORS: Record<string, string> = {
  socle_fixe: 'var(--primary-500)',
  variable_essentielle: 'var(--viz-a)',
  discretionnaire: 'var(--viz-c)',
  provision: 'var(--color-warning)',
  epargne: 'var(--color-success)',
}
const BLOCK_ICON_BY_BUCKET: Record<string, string> = {
  socle_fixe: blockFixeIcon,
  variable_essentielle: blockVariableIcon,
  discretionnaire: blockDiscretionnaireIcon,
  provision: blockProvisionsIcon,
  epargne: blockEpargneIcon,
}

function parentKeyFromName(name: string): string {
  return name.trim().toLocaleLowerCase('fr-FR')
}

function buildParentProjectionGroups(rows: CategoryAnnualCostProjection2026[]): ParentProjectionGroup[] {
  const grouped = new Map<string, ParentProjectionGroup>()

  for (const row of rows) {
    const parentName = (row.parentCategoryName || row.categoryName).trim() || 'Catégorie'
    const parentKey = parentKeyFromName(parentName)
    const existing = grouped.get(parentKey)

    if (!existing) {
      grouped.set(parentKey, {
        parentKey,
        parentName,
        monthsElapsed: Math.max(0, row.monthsElapsed),
        remainingMonths: Math.max(0, row.remainingMonths),
        actualYtdAmount: row.actualYtdAmount,
        avgMonthlyYtdAmount: 0,
        projectedAnnualAmount: row.projectedAnnualAmount,
        budgetYtdAmount: row.budgetYtdAmount,
        budgetAnnualAmount: row.budgetAnnualAmount,
        projectedVsBudgetAmount: 0,
        projectedVsBudgetPct: 0,
        children: [row],
      })
      continue
    }

    existing.monthsElapsed = Math.max(existing.monthsElapsed, row.monthsElapsed)
    existing.remainingMonths = Math.max(existing.remainingMonths, row.remainingMonths)
    existing.actualYtdAmount += row.actualYtdAmount
    existing.projectedAnnualAmount += row.projectedAnnualAmount
    existing.budgetYtdAmount += row.budgetYtdAmount
    existing.budgetAnnualAmount += row.budgetAnnualAmount
    existing.children.push(row)
  }

  return [...grouped.values()]
    .map((group) => {
      const projectedVsBudgetAmount = group.projectedAnnualAmount - group.budgetAnnualAmount
      const projectedVsBudgetPct = group.budgetAnnualAmount > 0
        ? (projectedVsBudgetAmount / group.budgetAnnualAmount) * 100
        : 0

      return {
        ...group,
        avgMonthlyYtdAmount: group.monthsElapsed > 0 ? group.actualYtdAmount / group.monthsElapsed : 0,
        projectedVsBudgetAmount,
        projectedVsBudgetPct,
        children: [...group.children].sort((a, b) => b.projectedAnnualAmount - a.projectedAnnualAmount),
      }
    })
    .sort((a, b) => b.projectedAnnualAmount - a.projectedAnnualAmount)
}

export function AnnualProjectionSectionConnected({
  scopeSelection,
}: AnnualProjectionSectionConnectedProps) {
  const { data: rows, isLoading: isLoadingCategories } = useCategoryAnnualCostProjection2026(scopeSelection, 2026)

  if (isLoadingCategories) {
    return (
      <div style={emptyStateStyle}>
        Chargement de la projection…
      </div>
    )
  }

  if (rows.length === 0) {
    const isBlockScope = scopeSelection?.kind === 'bloc'
    const isSingleCategoryScope =
      scopeSelection?.kind === 'categorie'
      && scopeSelection.id !== ALL_CATEGORIES_SCOPE_ID

    const scopeLabel = isBlockScope
      ? BUCKET_LABELS[scopeSelection.id] ?? scopeSelection.id
      : isSingleCategoryScope
        ? 'cette catégorie'
        : 'ce périmètre'

    return (
      <div style={emptyStateStyle}>
        Aucune donnée de projection disponible pour {scopeLabel}.
      </div>
    )
  }

  return <AnnualCostProjectionCard rows={rows} bare />
}

function AnnualCostProjectionCard({
  rows,
  bare = false,
}: {
  rows: CategoryAnnualCostProjection2026[]
  bare?: boolean
}) {
  const [viewMode, setViewMode] = useState<ProjectionViewMode>('category')
  const [selectedParentKey, setSelectedParentKey] = useState<string | null>(null)
  const [selectedDeltaBlockKey, setSelectedDeltaBlockKey] = useState<string | null>(null)
  const [openedDeltaBreakdownBlockKey, setOpenedDeltaBreakdownBlockKey] = useState<string | null>(null)
  const [showListModal, setShowListModal] = useState(false)
  const [openedParentKey, setOpenedParentKey] = useState<string | null>(null)
  const selectedDetailsAnchorRef = useRef<HTMLDivElement | null>(null)
  const wasDetailsVisibleRef = useRef(false)
  const { data: categories = [] } = useCategories()

  const categoryIconById = useMemo(
    () => new Map(categories.map((cat) => [cat.id, cat.icon_key])),
    [categories],
  )

  const parentIconByName = useMemo(
    () => new Map(
      categories
        .filter((cat) => cat.parent_id === null)
        .map((cat) => [parentKeyFromName(cat.name), cat.icon_key]),
    ),
    [categories],
  )

  const parentHeaderColorByName = useMemo(
    () => new Map(
      categories
        .filter((cat) => cat.parent_id === null)
        .map((cat, index) => [parentKeyFromName(cat.name), getCategoryColor(cat.color_token, index)]),
    ),
    [categories],
  )

  const parentGroups = useMemo(
    () => buildParentProjectionGroups(rows.filter((row) => isExpenseBucket(row.budgetBucket))),
    [rows],
  )

  useEffect(() => {
    const includedBuckets = rows.map((row) => row.budgetBucket)
    const expenseRows = rows.filter((row) => isExpenseBucket(row.budgetBucket))
    const projectedExpenseTotal = expenseRows.reduce((sum, row) => sum + row.projectedAnnualAmount, 0)
    assertNoNonExpenseBucketsInExpenseTotal(expenseRows.map((row) => row.budgetBucket), 'AnnualCostProjection2026:category-view')
    if (import.meta.env.DEV) {
      console.log('[Budgets Slide 3][Audit dépenses] rawData', rows)
      console.log('[Budgets Slide 3][Audit dépenses] buckets included in expenses', [...new Set(expenseRows.map((row) => row.budgetBucket))])
      console.log('[Budgets Slide 3][Audit dépenses] expenseTotal', projectedExpenseTotal)
      console.log('[Budgets Slide 3][Audit dépenses] all buckets in payload', [...new Set(includedBuckets)])
    }
  }, [rows])

  const top5 = useMemo(() => parentGroups.slice(0, 5), [parentGroups])

  const domainMax = useMemo(() => {
    if (top5.length === 0) return 10_000
    const maxProjected = Math.max(...top5.map((c) => c.projectedAnnualAmount))
    const maxTheoretical = Math.max(...top5.map((c) => c.budgetAnnualAmount))
    return Math.max(maxProjected, maxTheoretical) * 1.2
  }, [top5])

  const categoryData = useMemo<CategoryProjectionPoint[]>(
    () => top5.map((row, i) => ({
      parentKey: row.parentKey,
      name: row.parentName,
      theoreticalAnnualAmount: row.budgetAnnualAmount,
      refinedAnnualAmount: row.projectedAnnualAmount,
      color: VIZ_PALETTE[i % VIZ_PALETTE.length] ?? 'var(--neutral-500)',
      isSelected: selectedParentKey === row.parentKey,
    })),
    [top5, selectedParentKey],
  )

  const blockDeltaData = useMemo<BlockDeltaBarRow[]>(() => {
    const sumsByBlock = new Map<string, number>(PILOTAGE_BUCKET_ORDER.map((bucket) => [bucket, 0]))

    for (const row of rows) {
      const bucket = (row.budgetBucket ?? '').trim()
      if (!sumsByBlock.has(bucket)) continue
      sumsByBlock.set(bucket, (sumsByBlock.get(bucket) ?? 0) + Number(row.projectedVsBudgetAmount ?? 0))
    }

    const rowsByBlock = PILOTAGE_BUCKET_ORDER.map((bucket) => ({
      blockKey: bucket,
      name: BUCKET_LABELS[bucket] ?? bucket,
      deltaAmount: sumsByBlock.get(bucket) ?? 0,
      color: BLOCK_DELTA_COLORS[bucket] ?? 'var(--neutral-500)',
      iconSrc: BLOCK_ICON_BY_BUCKET[bucket] ?? null,
      isTotal: false,
      isSelected: selectedDeltaBlockKey === bucket,
    }))
    const totalDeltaAmount = rowsByBlock.reduce((sum, row) => sum + row.deltaAmount, 0)

    return [
      ...rowsByBlock,
      {
        blockKey: 'total',
        name: 'Total',
        deltaAmount: totalDeltaAmount,
        color: 'var(--neutral-0)',
        iconSrc: null,
        isTotal: true,
        isSelected: selectedDeltaBlockKey === 'total',
      },
    ]
  }, [rows, selectedDeltaBlockKey])

  const deltaAxisMax = useMemo(() => {
    const maxAbs = Math.max(...blockDeltaData.map((row) => Math.abs(row.deltaAmount)), 0)
    if (maxAbs <= 0) return 1_000
    const step = 1_000
    return Math.ceil((maxAbs * 1.05) / step) * step
  }, [blockDeltaData])

  const deltaBlockSummaryRows = useMemo<DeltaBlockSummaryRow[]>(() => {
    const seed = new Map(
      PILOTAGE_BUCKET_ORDER.map((bucket) => [
        bucket,
        {
          blockKey: bucket,
          name: BUCKET_LABELS[bucket] ?? bucket,
          color: BLOCK_DELTA_COLORS[bucket] ?? 'var(--neutral-500)',
          iconSrc: BLOCK_ICON_BY_BUCKET[bucket] ?? null,
          budgetYtdAmount: 0,
          projectedAmount: 0,
          deltaAmount: 0,
          categories: new Map<string, DeltaBlockCategoryRow>(),
        },
      ]),
    )

    for (const row of rows) {
      const bucket = (row.budgetBucket ?? '').trim()
      if (!(PILOTAGE_BUCKET_ORDER as readonly string[]).includes(bucket)) continue
      const group = seed.get(bucket as (typeof PILOTAGE_BUCKET_ORDER)[number])
      if (!group) continue

      group.budgetYtdAmount += Number(row.budgetYtdAmount ?? 0)
      group.projectedAmount += Number(row.projectedAnnualAmount ?? 0)
      group.deltaAmount += Number(row.projectedVsBudgetAmount ?? 0)

      const existingCategory = group.categories.get(row.categoryId)
      if (existingCategory) {
        existingCategory.deltaAmount += Number(row.projectedVsBudgetAmount ?? 0)
      } else {
        group.categories.set(row.categoryId, {
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          iconKey: categoryIconById.get(row.categoryId) ?? null,
          deltaAmount: Number(row.projectedVsBudgetAmount ?? 0),
        })
      }
    }

    return PILOTAGE_BUCKET_ORDER.map((bucket) => {
      const group = seed.get(bucket)!
      const categories = [...group.categories.values()].sort((a, b) => Math.abs(b.deltaAmount) - Math.abs(a.deltaAmount))

      return {
        blockKey: group.blockKey,
        name: group.name,
        color: group.color,
        iconSrc: group.iconSrc,
        categoryCount: categories.length,
        budgetYtdAmount: group.budgetYtdAmount,
        projectedAmount: group.projectedAmount,
        deltaAmount: group.deltaAmount,
        categories,
      }
    })
  }, [categoryIconById, rows])

  const selectedRow = useMemo(
    () => parentGroups.find((group) => group.parentKey === selectedParentKey) ?? null,
    [parentGroups, selectedParentKey],
  )

  const openedParentGroup = useMemo(
    () => parentGroups.find((group) => group.parentKey === openedParentKey) ?? null,
    [parentGroups, openedParentKey],
  )

  useEffect(() => {
    if (selectedRow == null) {
      wasDetailsVisibleRef.current = false
      return
    }
    if (viewMode !== 'category') return
    if (wasDetailsVisibleRef.current) return

    wasDetailsVisibleRef.current = true
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth'

    let timeoutId: number | undefined
    const rafId = window.requestAnimationFrame(() => {
      selectedDetailsAnchorRef.current?.scrollIntoView({
        behavior,
        block: 'end',
      })

      timeoutId = window.setTimeout(() => {
        const targetTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
        window.scrollTo({ top: targetTop, behavior })
      }, 180)
    })

    return () => {
      window.cancelAnimationFrame(rafId)
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [selectedRow, viewMode])

  const modeToggle = (
    <div style={switchStyle} role="tablist" aria-label="Mode de projection">
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'category'}
        onClick={() => setViewMode('category')}
        style={{
          ...switchButtonStyle,
          ...(viewMode === 'category' ? switchButtonActiveStyle : null),
        }}
      >
        <LayoutGrid size={14} color={viewMode === 'category' ? 'var(--primary-600)' : 'var(--neutral-500)'} />
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'year'}
        onClick={() => setViewMode('year')}
        style={{
          ...switchButtonStyle,
          ...(viewMode === 'year' ? switchButtonActiveStyle : null),
        }}
      >
        <CalendarDays size={14} color={viewMode === 'year' ? 'var(--primary-600)' : 'var(--neutral-500)'} />
      </button>
    </div>
  )

  const chart = (
    <div style={{ height: 292, width: '100%' }}>
      {viewMode === 'category' ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={categoryData} margin={{ top: 42, right: 0, left: 0, bottom: 28 }}>
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={<CustomTick />}
            />
            <YAxis domain={[0, domainMax]} hide />
            <Bar
              dataKey="theoreticalAnnualAmount"
              barSize={32}
              isAnimationActive={false}
              shape={(props: unknown) => <CustomBarShape {...(props as CustomBarShapeProps)} />}
              onClick={(_: unknown, index: number) => {
                const clickedParentKey = categoryData[index]?.parentKey ?? null
                setSelectedParentKey((prev) => (prev === clickedParentKey ? null : clickedParentKey))
              }}
              cursor="pointer"
            >
              <LabelList
                dataKey="refinedAnnualAmount"
                position="top"
                offset={8}
                formatter={(val: number) => `${Math.round(val).toLocaleString('fr-FR')}€`}
                style={{ fontSize: 10, fontWeight: 700, fill: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={blockDeltaData} margin={{ top: 48, right: 0, left: 0, bottom: 28 }} barCategoryGap="18%">
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={false}
            />
            <YAxis
              hide
              domain={[-deltaAxisMax, deltaAxisMax]}
            />
            <ReferenceLine
              y={0}
              stroke="var(--neutral-400)"
              strokeWidth={1.2}
            />
            {blockDeltaData
              .filter((row) => !row.isTotal && row.iconSrc)
              .map((row) => (
                <ReferenceDot
                  key={`axis-icon-${row.blockKey}`}
                  x={row.name}
                  y={0}
                  ifOverflow="visible"
                  isFront
                  shape={(props: unknown) => {
                    const { cx, cy } = (props ?? {}) as { cx?: number; cy?: number }
                    if (cx == null || cy == null || !row.iconSrc) return <g />
                    const iconSize = 18
                    const iconY = row.deltaAmount >= 0 ? (cy + 3) : (cy - iconSize - 3)
                    return (
                      <image
                        href={row.iconSrc}
                        xlinkHref={row.iconSrc}
                        x={cx - iconSize / 2}
                        y={iconY}
                        width={iconSize}
                        height={iconSize}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    )
                  }}
                />
              ))}
            <Bar
              dataKey="deltaAmount"
              barSize={32}
              maxBarSize={32}
              cursor="pointer"
              onClick={(_: unknown, index: number) => {
                const clicked = blockDeltaData[index]?.blockKey ?? null
                setSelectedDeltaBlockKey((prev) => (prev === clicked ? null : clicked))
              }}
            >
              {blockDeltaData.map((row) => (
                <Cell
                  key={`delta-${row.blockKey}`}
                  fill={row.isTotal ? 'var(--neutral-0)' : row.color}
                  fillOpacity={row.isTotal ? 1 : (row.isSelected || !selectedDeltaBlockKey ? 0.96 : 0.62)}
                  stroke={row.isTotal ? 'var(--color-warning)' : (row.isSelected ? 'var(--neutral-900)' : row.color)}
                  strokeWidth={row.isTotal ? (row.isSelected ? 3 : 2.3) : (row.isSelected ? 1.5 : 0)}
                />
              ))}
              <LabelList
                dataKey="deltaAmount"
                content={(props: unknown) => {
                  const { x, y, width, height, value } = (props ?? {}) as {
                    x?: number
                    y?: number
                    width?: number
                    height?: number
                    value?: number
                  }
                  if (x == null || y == null || width == null || height == null || value == null) return null
                  const numericValue = Number(value)
                  const posY = numericValue >= 0 ? (y - 10) : (y + height + 15)
                  return (
                    <text
                      x={x + width / 2}
                      y={posY}
                      textAnchor="middle"
                      fill="var(--neutral-700)"
                      fontSize={10}
                      fontWeight={700}
                      fontFamily="var(--font-mono)"
                    >
                      {fmtCurrency(numericValue)}
                    </text>
                  )
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )

  const selectedCard = selectedRow && viewMode === 'category'
    ? <ProjectionDetailsCard row={selectedRow} />
    : null
  const yearSummaryCard = viewMode === 'year' ? (
    <DeltaBlockSummaryCard
      rows={deltaBlockSummaryRows}
      onOpenBlockDetails={(blockKey) => setOpenedDeltaBreakdownBlockKey(blockKey)}
    />
  ) : null

  const categoryHeaderControls = viewMode === 'category' ? (
    <div style={categoryInlineControlsStyle}>
      <span style={top5LabelStyle}>Top 5 catégories</span>
      <button type="button" onClick={() => setShowListModal(true)} style={listButtonStyle}>
        <ChevronRight size={12} />
        liste
      </button>
    </div>
  ) : (
    <span style={top5LabelStyle}>Projection écart fin 2026</span>
  )

  const chartTopControls = (
    <div style={chartTopControlsStyle}>
      {categoryHeaderControls}
      {modeToggle}
    </div>
  )

  const modal = showListModal ? (
    <ProjectionListModal
      rows={parentGroups}
      parentIconByName={parentIconByName}
      onOpenParentDetails={(parentKey) => setOpenedParentKey(parentKey)}
      onClose={() => setShowListModal(false)}
    />
  ) : null

  const detailsModal = openedParentGroup ? (
    <ParentCategoryDetailsModal
      group={openedParentGroup}
      headerColor={parentHeaderColorByName.get(openedParentGroup.parentKey) ?? 'var(--primary-600)'}
      categoryIconById={categoryIconById}
      onClose={() => setOpenedParentKey(null)}
    />
  ) : null
  const deltaBreakdownModal = openedDeltaBreakdownBlockKey
    ? (
      <DeltaBreakdownModal
        row={deltaBlockSummaryRows.find((entry) => entry.blockKey === openedDeltaBreakdownBlockKey) ?? null}
        onClose={() => setOpenedDeltaBreakdownBlockKey(null)}
      />
    )
    : null

  if (bare) {
    return (
      <>
        {chartTopControls}
        {chart}
        <div ref={selectedDetailsAnchorRef}>{selectedCard ?? yearSummaryCard}</div>
        {modal}
        {detailsModal}
        {deltaBreakdownModal}
      </>
    )
  }

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <div>
              <h3 style={cardTitleStyle}>Projection coûts annuels</h3>
              <p style={cardSubStyle}>
                {viewMode === 'category' ? 'top 5 catégories projetées' : 'Projection écart fin 2026'}
              </p>
            </div>
            {modeToggle}
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>{chartTopControls}</div>
          <div style={{ marginTop: 'var(--space-2)' }}>{chart}</div>
          <div ref={selectedDetailsAnchorRef}>{selectedCard ?? yearSummaryCard}</div>
        </div>
      </div>
      {modal}
      {detailsModal}
      {deltaBreakdownModal}
    </section>
  )
}

function DeltaBlockSummaryCard({
  rows,
  onOpenBlockDetails,
}: {
  rows: DeltaBlockSummaryRow[]
  onOpenBlockDetails: (blockKey: string) => void
}) {
  const totalDeltaAmount = rows.reduce((sum, row) => sum + row.deltaAmount, 0)
  const totalDeltaPositive = totalDeltaAmount > 0

  return (
    <div style={selectedCardStyle}>
      <div
        style={{
          display: 'grid',
          gap: 0,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '16px minmax(0,1fr) 82px 24px',
            alignItems: 'center',
            columnGap: 7,
            padding: '1px 0 4px',
          }}
        >
          <span style={{ gridColumn: '1 / 3', fontSize: 12, fontWeight: 700, color: 'var(--neutral-800)' }}>
            Ecart net projeté 2026
          </span>
          <span
            style={{
              gridColumn: '3 / 5',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 7px',
              width: 82,
              background: totalDeltaPositive ? 'rgba(252,90,90,0.14)' : 'rgba(46,212,122,0.14)',
              border: `1px solid ${totalDeltaPositive ? 'rgba(252,90,90,0.24)' : 'rgba(46,212,122,0.24)'}`,
              color: totalDeltaPositive ? 'var(--negative)' : 'var(--positive)',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
              justifySelf: 'end',
            }}
          >
            {fmtCurrency(totalDeltaAmount)}
          </span>
        </div>

        {rows.map((row) => {
          const isOverBudget = row.deltaAmount > 0
          const pillColor = isOverBudget ? 'var(--negative)' : 'var(--positive)'
          const categoriesLabel = `${row.categoryCount} cat.`

          return (
            <div
              key={row.blockKey}
              style={{
                display: 'grid',
                gridTemplateColumns: '16px minmax(0,1fr) 82px 24px',
                alignItems: 'center',
                columnGap: 7,
                padding: '3px 0',
              }}
            >
              <img
                src={row.iconSrc ?? blockFixeIcon}
                alt={`Bloc ${row.name}`}
                width={15}
                height={15}
                style={{ width: 15, height: 15, objectFit: 'contain' }}
              />

              <div style={{ minWidth: 0, display: 'inline-flex', alignItems: 'baseline', gap: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--neutral-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--neutral-500)', whiteSpace: 'nowrap' }}>
                  {categoriesLabel}
                </span>
              </div>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  color: pillColor,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                  width: 82,
                }}
              >
                {fmtCurrency(row.deltaAmount)}
              </span>

              <button
                type="button"
                onClick={() => onOpenBlockDetails(row.blockKey)}
                aria-label={`Ouvrir le détail du bloc ${row.name}`}
                style={deltaExpandButtonStyle}
              >
                +
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DeltaBreakdownModal({
  row,
  onClose,
}: {
  row: DeltaBlockSummaryRow | null
  onClose: () => void
}) {
  if (!row) return null
  const netDeltaAmount = row.categories.reduce((sum, category) => sum + category.deltaAmount, 0)

  return (
    <div style={parentDetailOverlayStyle} onClick={onClose}>
      <div style={parentDetailModalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...listModalHeaderStyle, background: row.color }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--neutral-0)' }}>
              {row.name}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.82)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Détail des écarts par poste
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.24)',
              borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
              color: 'var(--neutral-0)',
              padding: 4,
              lineHeight: 0,
            }}
            aria-label={`Fermer le détail du bloc ${row.name}`}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 0 }}>
          {row.categories.map((category) => {
            const isOverBudget = category.deltaAmount > 0
            return (
              <div
                key={category.categoryId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '16px minmax(0,1fr) auto',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 0',
                  borderBottom: '1px solid var(--neutral-100)',
                }}
              >
                <CategoryIcon
                  iconKey={category.iconKey}
                  label={category.categoryName}
                  size={14}
                  style={{ width: 14, height: 14, objectFit: 'contain', display: 'block' }}
                />
                <span style={{ fontSize: 12, color: 'var(--neutral-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {category.categoryName}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: isOverBudget ? 'var(--negative)' : 'var(--positive)',
                  }}
                >
                  {fmtCurrency(category.deltaAmount)}
                </span>
              </div>
            )
          })}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '16px minmax(0,1fr) auto',
              alignItems: 'center',
              gap: 8,
              padding: '8px 0 2px',
            }}
          >
            <span aria-hidden="true" />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#B06A00',
                textTransform: 'uppercase',
              }}
            >
              ÉCART NET PROJETÉ
            </span>
            <span
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: '#B06A00',
              }}
            >
              {fmtCurrency(netDeltaAmount)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProjectionDetailsCard({ row }: { row: ParentProjectionGroup }) {
  const theoreticalProjection = row.budgetAnnualAmount

  const riskOverBudget = row.projectedVsBudgetPct > 0

  return (
    <div style={{ ...selectedCardStyle, borderColor: riskOverBudget ? 'rgba(252,90,90,0.25)' : 'rgba(46,212,122,0.28)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--neutral-800)' }}>
          {row.parentName}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: riskOverBudget ? 'var(--negative)' : 'var(--positive)',
            background: riskOverBudget ? 'rgba(252,90,90,0.1)' : 'rgba(46,212,122,0.12)',
            borderRadius: 'var(--radius-full)',
            padding: '3px 8px',
          }}
        >
          {riskOverBudget ? 'risque dépassement' : 'sous contrôle'}
        </span>
      </div>

      <div style={{ display: 'grid', gap: 5 }}>
        <DetailRow label="consommé YTD" value={fmtCurrency(row.actualYtdAmount)} />
        <DetailRow label="Moy. mensuelle YTD" value={fmtCurrency(row.avgMonthlyYtdAmount)} />
        <DetailRow label="Mois restants" value={`${row.remainingMonths}`} />
        <DetailRow label="budget annuel théorique" value={fmtCurrency(theoreticalProjection)} />
        <DetailRow label="projection closing 2026 (mai)" value={fmtCurrency(row.projectedAnnualAmount)} />
        <DetailRow
          label="Ecart budget/projection"
          value={`${fmtCurrency(row.projectedVsBudgetAmount)} (${fmtPctSigned(row.projectedVsBudgetPct)})`}
          valueColor={riskOverBudget ? 'var(--negative)' : 'var(--positive)'}
        />
      </div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--neutral-500)' }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: valueColor ?? 'var(--neutral-900)' }}>
        {value}
      </span>
    </div>
  )
}

function ProjectionListModal({
  rows,
  parentIconByName,
  onOpenParentDetails,
  onClose,
}: {
  rows: ParentProjectionGroup[]
  parentIconByName: Map<string, string | null>
  onOpenParentDetails: (parentKey: string) => void
  onClose: () => void
}) {
  const hiddenParentKeys = new Set(['revenus', 'epargne', 'épargne', 'transferts'])
  const visibleRows = rows.filter((row) => !hiddenParentKeys.has(parentKeyFromName(row.parentName)))
  const totalProjected = visibleRows.reduce((sum, row) => sum + row.projectedAnnualAmount, 0)
  const statusIconSize = 13

  return (
    <div style={listModalOverlayCenteredStyle} onClick={onClose}>
      <div style={listModalCenteredStyle} onClick={(e) => e.stopPropagation()}>
        <div style={listModalHeaderStyle}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--neutral-0)' }}>
              Détails par catégorie
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.24)',
              borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
              color: 'var(--neutral-0)',
              padding: 4,
              lineHeight: 0,
            }}
            aria-label="Fermer la liste des catégories"
          >
            <X size={20} />
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) auto',
          alignItems: 'center',
          columnGap: 10,
          padding: '5px 0',
          borderBottom: '1px solid var(--neutral-150)',
          background: 'var(--neutral-50)',
          marginBottom: 1,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Catégorie / budget annuel
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            Projection 2026
          </span>
        </div>

        <div style={{ display: 'grid', gap: 0 }}>
          {visibleRows.map((row) => {
            const overBudget = row.projectedVsBudgetPct > 0
            return (
              <button
                key={row.parentKey}
                type="button"
                onClick={() => onOpenParentDetails(row.parentKey)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) auto',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 0',
                  borderBottom: '1px solid var(--neutral-100)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ minWidth: 0, display: 'grid', gap: 3 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr)', alignItems: 'center', gap: 8 }}>
                    <CategoryIcon
                      iconKey={parentIconByName.get(row.parentKey) ?? null}
                      label={row.parentName}
                      size={28}
                      style={{ width: 28, height: 28, display: 'block', objectFit: 'contain' }}
                    />
                    <div style={{ minWidth: 0, display: 'grid', gap: 3 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ fontSize: 13, color: 'var(--neutral-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.parentName}
                        </span>
                        {overBudget ? (
                          <AlertTriangle size={statusIconSize} color="var(--color-warning)" aria-label="Attention risque de dépassement" />
                        ) : (
                          <CheckCircle2 size={statusIconSize} color="var(--color-success)" aria-label="Sous contrôle" />
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>
                        Budget annuel : {fmtCurrency(row.budgetAnnualAmount)}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', justifyItems: 'end', gap: 2 }}>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-900)' }}>
                    {fmtCurrency(row.projectedAnnualAmount)}
                  </span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: overBudget ? 'var(--color-negative)' : 'var(--color-success)' }}>
                    {fmtPctSignedRounded(row.projectedVsBudgetPct)}
                  </span>
                </div>
              </button>
            )
          })}
          <div style={{ ...listModalTotalRowStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0 2px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#C88400', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total projeté</span>
            <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#C88400' }}>
              {fmtCurrency(totalProjected)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ParentCategoryDetailsModal({
  group,
  headerColor,
  categoryIconById,
  onClose,
}: {
  group: ParentProjectionGroup
  headerColor: string
  categoryIconById: Map<string, string | null>
  onClose: () => void
}) {
  const visibleChildren = group.children.filter((child) => (
    parentKeyFromName(child.categoryName) !== parentKeyFromName(group.parentName)
  ))

  return (
    <div style={parentDetailOverlayStyle} onClick={onClose}>
      <div style={parentDetailModalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...listModalHeaderStyle, background: headerColor }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--neutral-0)' }}>
              {group.parentName}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.82)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Détail par sous-catégorie
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.24)',
              borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
              color: 'var(--neutral-0)',
              padding: 4,
              lineHeight: 0,
            }}
            aria-label={`Fermer le détail de ${group.parentName}`}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 0 }}>
          {visibleChildren.map((child) => {
            const overBudget = child.projectedVsBudgetPct > 0
            return (
              <div
                key={child.categoryId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) auto',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 0',
                  borderBottom: '1px solid var(--neutral-100)',
                }}
              >
                <div style={{ minWidth: 0, display: 'grid', gap: 3 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr)', alignItems: 'center', gap: 8 }}>
                    <CategoryIcon
                      iconKey={categoryIconById.get(child.categoryId) ?? null}
                      label={child.categoryName}
                      size={28}
                      style={{ width: 28, height: 28, display: 'block', objectFit: 'contain' }}
                    />
                    <div style={{ minWidth: 0, display: 'grid', gap: 3 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ fontSize: 13, color: 'var(--neutral-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {child.categoryName}
                        </span>
                        {overBudget ? (
                          <AlertTriangle size={13} color="var(--color-warning)" aria-label="Attention risque de dépassement" />
                        ) : (
                          <CheckCircle2 size={13} color="var(--color-success)" aria-label="Sous contrôle" />
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>
                        Budget annuel : {fmtCurrency(child.budgetAnnualAmount)}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', justifyItems: 'end', gap: 2 }}>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-900)' }}>
                    {fmtCurrency(child.projectedAnnualAmount)}
                  </span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: overBudget ? 'var(--color-negative)' : 'var(--color-success)' }}>
                    {fmtPctSignedRounded(child.projectedVsBudgetPct)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

type CustomBarShapeProps = {
  x?: number
  y?: number
  width?: number
  height?: number
  theoreticalAnnualAmount?: number
  refinedAnnualAmount?: number
  color?: string
  isSelected?: boolean
}

function CustomBarShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  theoreticalAnnualAmount = 0,
  refinedAnnualAmount = 0,
  color = 'var(--neutral-400)',
  isSelected = false,
}: CustomBarShapeProps) {
  if (height <= 0 || theoreticalAnnualAmount <= 0 || width <= 0) return null

  const bottom = y + height
  const hasRefined = refinedAnnualAmount > 0
  const isRefinedAbove = hasRefined && refinedAnnualAmount > theoreticalAnnualAmount
  const isRefinedBelow = hasRefined && refinedAnnualAmount < theoreticalAnnualAmount
  const refinedY = hasRefined ? bottom - (refinedAnnualAmount / theoreticalAnnualAmount) * height : null

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={isSelected ? 1 : 0.78}
        rx={4}
        ry={4}
      />

      {isSelected ? (
        <rect
          x={x - 2}
          y={y - 2}
          width={width + 4}
          height={height + 4}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeOpacity={0.45}
          rx={5}
          ry={5}
        />
      ) : null}

      {isRefinedAbove && refinedY != null ? (
        <rect
          x={x + 3}
          y={refinedY}
          width={width - 6}
          height={Math.max(0, y - refinedY)}
          fill={color}
          fillOpacity={0.14}
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeOpacity={0.72}
          rx={3}
          ry={3}
        />
      ) : null}

      {isRefinedBelow && refinedY != null ? (
        <line
          x1={x + 4}
          y1={refinedY}
          x2={x + width - 4}
          y2={refinedY}
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ) : null}
    </g>
  )
}

type CustomTickProps = {
  x?: number
  y?: number
  payload?: {
    value?: string
  }
}

function CustomTick({ x = 0, y = 0, payload }: CustomTickProps) {
  const rawValue = payload?.value ?? ''
  const truncate = (str: string) => (str.length > 9 ? `${str.substring(0, 8)}…` : str)
  const words = rawValue.split(' ').map(truncate)

  return (
    <g transform={`translate(${x},${y + 12})`}>
      {words.map((word, i) => (
        <text
          key={`${word}-${i}`}
          x={0}
          y={i * 11}
          textAnchor="middle"
          fill="var(--neutral-500)"
          style={{ fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-sans)' }}
        >
          {word}
        </text>
      ))}
    </g>
  )
}

const emptyStateStyle: CSSProperties = {
  background: 'var(--neutral-0)',
  borderRadius: 'var(--radius-2xl)',
  border: '1px dashed var(--neutral-300)',
  padding: 'var(--space-5)',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--neutral-500)',
  textAlign: 'center',
}

const cardStyle: CSSProperties = {
  background: 'var(--neutral-0)',
  borderRadius: 'var(--radius-2xl)',
  boxShadow: 'var(--shadow-card)',
  border: '1px solid var(--neutral-150)',
  padding: 'var(--space-5)',
}

const cardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--font-size-base)',
  fontWeight: 'var(--font-weight-bold)',
  color: 'var(--neutral-900)',
}

const cardSubStyle: CSSProperties = {
  margin: '3px 0 0',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--neutral-400)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 600,
}

const switchStyle: CSSProperties = {
  display: 'flex',
  background: 'var(--neutral-100)',
  borderRadius: 'var(--radius-lg)',
  padding: 2,
  gap: 2,
}

const switchButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: '6px 9px',
  borderRadius: 'calc(var(--radius-lg) - 2px)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s',
}

const switchButtonActiveStyle: CSSProperties = {
  background: 'var(--neutral-0)',
  boxShadow: 'var(--shadow-sm)',
}

const listModalHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 'var(--space-3)',
  marginLeft: 'calc(var(--space-5) * -1)',
  marginRight: 'calc(var(--space-5) * -1)',
  marginTop: 'calc(var(--space-5) * -1)',
  padding: 'var(--space-3) var(--space-5)',
  background: 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-500) 64%, var(--viz-a) 100%)',
}

const selectedCardStyle: CSSProperties = {
  marginTop: 'var(--space-2)',
  padding: 'var(--space-3)',
  background: 'var(--neutral-50)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--neutral-150)',
}

const listButtonStyle: CSSProperties = {
  background: 'none',
  border: '1px solid var(--neutral-300)',
  borderRadius: 'var(--radius-full)',
  padding: '4px 9px 4px 7px',
  fontSize: 10,
  color: 'var(--neutral-600)',
  cursor: 'pointer',
  fontWeight: 400,
  fontFamily: 'var(--font-sans)',
  letterSpacing: '0.04em',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
}

const deltaExpandButtonStyle: CSSProperties = {
  width: 24,
  height: 24,
  minWidth: 24,
  minHeight: 24,
  borderRadius: 'var(--radius-full)',
  border: '1px solid var(--neutral-300)',
  background: 'var(--neutral-0)',
  color: 'var(--neutral-700)',
  fontSize: 16,
  lineHeight: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
}

const top5LabelStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--neutral-500)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 700,
  lineHeight: 1,
  transform: 'translateY(1px)',
}

const chartTopControlsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-3)',
}

const categoryInlineControlsStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
}

const listModalOverlayCenteredStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.38)',
  zIndex: 1000,
  display: 'grid',
  placeItems: 'center',
  padding: 'var(--space-4)',
}

const listModalCenteredStyle: CSSProperties = {
  background: 'var(--neutral-0)',
  borderRadius: 'var(--radius-xl)',
  width: 'min(560px, 100%)',
  maxHeight: '84vh',
  overflowY: 'auto',
  boxShadow: 'var(--shadow-lg)',
  padding: 'var(--space-5)',
}

const listModalTotalRowStyle: CSSProperties = {
  marginTop: 'var(--space-1)',
  paddingLeft: 36,
  paddingRight: 'var(--space-2)',
  borderRadius: 'var(--radius-md)',
  background: 'color-mix(in oklab, var(--neutral-200) 32%, var(--neutral-0) 68%)',
}

const parentDetailOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  zIndex: 1010,
  display: 'grid',
  placeItems: 'center',
  padding: 'var(--space-4)',
}

const parentDetailModalStyle: CSSProperties = {
  background: 'var(--neutral-0)',
  borderRadius: 'var(--radius-xl)',
  width: 'min(560px, 100%)',
  maxHeight: '78vh',
  overflowY: 'auto',
  boxShadow: 'var(--shadow-lg)',
  padding: 'var(--space-5)',
}
