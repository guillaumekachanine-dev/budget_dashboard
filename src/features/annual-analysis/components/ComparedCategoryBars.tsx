import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, LayoutGrid, PieChart as PieChartIcon, X } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { useCategories } from '@/hooks/useCategories'
import { formatCurrencyRounded as fmt, getCategoryColor } from '@/lib/utils'
import type { ComparedCategoryMetric, YtdCategoryRow } from '@/features/annual-analysis/types.compared'

type Props = {
  metrics: ComparedCategoryMetric[]
  categoryRows: YtdCategoryRow[]
}

const MAX_VISIBLE = 7
type CategoryViewMode = 'bars' | 'donuts'
const CATEGORY_ROW_COLUMNS = 'minmax(0,1fr) 78px 8px 86px'
const CATEGORY_VALUE_COLUMNS_SHIFT_STYLE = { transform: 'translateX(12px)' } as const
const SUBCATEGORY_VALUE_COLUMNS_SHIFT_STYLE = { transform: 'translateX(16px)' } as const
const CATEGORY_SECTION_FIXED_HEIGHT = 438

const switchStyle = {
  display: 'flex',
  background: 'var(--neutral-100)',
  borderRadius: 'var(--radius-lg)',
  padding: 2,
  gap: 2,
} as const

const switchButtonStyle = {
  border: 'none',
  background: 'transparent',
  padding: '6px 9px',
  borderRadius: 'calc(var(--radius-lg) - 2px)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s',
} as const

const switchButtonActiveStyle = {
  background: 'var(--neutral-0)',
  boxShadow: 'var(--shadow-sm)',
} as const

type DonutEntry = {
  id: string
  name: string
  value: number
  color: string
  iconKey: string | null
  rank: number
}
type DonutComparisonSelection = {
  name: string
  value2025: number
  value2026: number
  deltaPct: number | null
}

function normalizeCategoryLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isSavingsCategory(value: string): boolean {
  const normalized = normalizeCategoryLabel(value)
  return normalized === 'epargne' || normalized.startsWith('epargne ')
}

export function ComparedCategoryBars({ metrics, categoryRows }: Props) {
  const [expandedCategoryNameModal, setExpandedCategoryNameModal] = useState<string | null>(null)
  const [isDonutDetailsModalOpen, setIsDonutDetailsModalOpen] = useState(false)
  const [selectedCategoryNameModal, setSelectedCategoryNameModal] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<CategoryViewMode>('bars')
  const [selectedDonutCategoryFromList, setSelectedDonutCategoryFromList] = useState<string | null>(null)
  const { data: categories = [] } = useCategories('expense')
  const categoryVisualByName = useMemo(() => {
    const map = new Map<string, { iconKey: string | null; color: string }>()

    categories.forEach((category, index) => {
      if (category.parent_id != null) return
      map.set(normalizeCategoryLabel(category.name), {
        iconKey: category.icon_key,
        color: getCategoryColor(category.color_token, index),
      })
    })

    categories.forEach((category, index) => {
      const key = normalizeCategoryLabel(category.name)
      if (map.has(key)) return
      map.set(key, {
        iconKey: category.icon_key,
        color: getCategoryColor(category.color_token, index),
      })
    })

    return map
  }, [categories])

  const barMetrics = useMemo(
    () => metrics.filter((metric) => !isSavingsCategory(metric.parent_category_name)),
    [metrics],
  )
  const achatsDiversMetric = useMemo(
    () => barMetrics.find((metric) => normalizeCategoryLabel(metric.parent_category_name) === 'achats divers'),
    [barMetrics],
  )
  const barScaleMax = useMemo(() => {
    if (achatsDiversMetric) {
      return Math.max(achatsDiversMetric.total_2025, achatsDiversMetric.total_2026, 1)
    }
    return Math.max(...barMetrics.flatMap((metric) => [metric.total_2025, metric.total_2026]), 1)
  }, [achatsDiversMetric, barMetrics])
  const shown = barMetrics.slice(0, MAX_VISIBLE)
  const categorySeries = useMemo(() => (
    metrics.map((metric, index) => {
      const visual = categoryVisualByName.get(normalizeCategoryLabel(metric.parent_category_name))
      return {
        name: metric.parent_category_name,
        total2025: metric.total_2025,
        total2026: metric.total_2026,
        color: visual?.color ?? getCategoryColor(null, index),
        iconKey: visual?.iconKey ?? metric.parent_category_name,
      }
    })
  ), [metrics, categoryVisualByName])
  const donut2025 = useMemo<DonutEntry[]>(
    () => {
      const sorted = categorySeries
        .filter((entry) => entry.total2025 > 0)
        .map((entry) => ({
          id: entry.name,
          name: entry.name,
          value: entry.total2025,
          color: entry.color,
          iconKey: entry.iconKey,
        }))
        .sort((a, b) => b.value - a.value)

      return sorted.map((entry, index) => ({ ...entry, rank: index + 1 }))
    },
    [categorySeries],
  )
  const donut2026 = useMemo<DonutEntry[]>(
    () => {
      const sorted = categorySeries
        .filter((entry) => entry.total2026 > 0)
        .map((entry) => ({
          id: entry.name,
          name: entry.name,
          value: entry.total2026,
          color: entry.color,
          iconKey: entry.iconKey,
        }))
        .sort((a, b) => b.value - a.value)

      return sorted.map((entry, index) => ({ ...entry, rank: index + 1 }))
    },
    [categorySeries],
  )
  const total2025 = useMemo(
    () => donut2025.reduce((sum, entry) => sum + entry.value, 0),
    [donut2025],
  )
  const total2026 = useMemo(
    () => donut2026.reduce((sum, entry) => sum + entry.value, 0),
    [donut2026],
  )
  const comparisonValuesByCategory = useMemo(
    () => new Map(categorySeries.map((entry) => [entry.name, { value2025: entry.total2025, value2026: entry.total2026 }])),
    [categorySeries],
  )
  const selectedDonutComparison = useMemo<DonutComparisonSelection | null>(() => {
    if (!selectedDonutCategoryFromList) return null
    const values = comparisonValuesByCategory.get(selectedDonutCategoryFromList)
    if (!values) return null
    const deltaPct = values.value2025 > 0
      ? ((values.value2026 - values.value2025) / values.value2025) * 100
      : null
    return {
      name: selectedDonutCategoryFromList,
      value2025: values.value2025,
      value2026: values.value2026,
      deltaPct,
    }
  }, [comparisonValuesByCategory, selectedDonutCategoryFromList])
  const selectedCategoryMetric = useMemo(
    () => barMetrics.find((metric) => metric.parent_category_name === selectedCategoryNameModal) ?? null,
    [barMetrics, selectedCategoryNameModal],
  )
  const selectedCategoryVisual = useMemo(() => (
    selectedCategoryMetric
      ? categoryVisualByName.get(normalizeCategoryLabel(selectedCategoryMetric.parent_category_name))
      : undefined
  ), [categoryVisualByName, selectedCategoryMetric])
  const subcategoriesByParent = useMemo(() => {
    const grouped = new Map<string, Map<string, { name: string; amount2025: number; amount2026: number }>>()

    for (const row of categoryRows) {
      const parentName = row.parent_category_name ?? row.category_name
      const parentKey = normalizeCategoryLabel(parentName)
      const subKey = normalizeCategoryLabel(row.category_name)

      let parentMap = grouped.get(parentKey)
      if (!parentMap) {
        parentMap = new Map()
        grouped.set(parentKey, parentMap)
      }

      const current = parentMap.get(subKey) ?? { name: row.category_name, amount2025: 0, amount2026: 0 }
      if (row.period_year === 2025) current.amount2025 += Number(row.amount_total ?? 0)
      if (row.period_year === 2026) current.amount2026 += Number(row.amount_total ?? 0)
      parentMap.set(subKey, current)
    }

    const out = new Map<string, Array<{ name: string; amount2025: number; amount2026: number; deltaPct: number | null }>>()
    for (const [parentKey, subMap] of grouped.entries()) {
      const rows = [...subMap.values()]
        .map((entry) => ({
          ...entry,
          deltaPct: entry.amount2025 > 0 ? ((entry.amount2026 - entry.amount2025) / entry.amount2025) * 100 : null,
        }))
        .sort((a, b) => b.amount2026 - a.amount2026)
      out.set(parentKey, rows)
    }

    return out
  }, [categoryRows])
  const selectedCategoryRows = useMemo(() => (
    selectedCategoryMetric
      ? (subcategoriesByParent.get(normalizeCategoryLabel(selectedCategoryMetric.parent_category_name)) ?? [])
      : []
  ), [selectedCategoryMetric, subcategoriesByParent])

  if (metrics.length === 0) return null

  return (
    <div style={{
      background: 'var(--neutral-0)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-card)',
      border: '1px solid var(--neutral-150)',
      padding: 'var(--space-5)',
      height: CATEGORY_SECTION_FIXED_HEIGHT,
      display: 'grid',
      gridTemplateRows: 'auto 1fr',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'grid', gap: 'var(--space-1)', minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-600)', whiteSpace: 'nowrap' }}>
            Dépenses par catégorie
          </p>
        </div>
        <div style={switchStyle} role="tablist" aria-label="Sélecteur d’affichage dépenses par catégorie">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'bars'}
            onClick={() => setViewMode('bars')}
            style={{
              ...switchButtonStyle,
              ...(viewMode === 'bars' ? switchButtonActiveStyle : null),
            }}
          >
            <LayoutGrid size={14} color={viewMode === 'bars' ? 'var(--primary-600)' : 'var(--neutral-500)'} />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'donuts'}
            onClick={() => setViewMode('donuts')}
            style={{
              ...switchButtonStyle,
              ...(viewMode === 'donuts' ? switchButtonActiveStyle : null),
            }}
          >
            <PieChartIcon size={14} color={viewMode === 'donuts' ? 'var(--primary-600)' : 'var(--neutral-500)'} />
          </button>
        </div>
      </div>

      <div style={{ minHeight: 0 }}>
        {viewMode === 'bars' ? (
          <div style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr', rowGap: 'var(--space-3)' }}>
            <div
              aria-hidden
              style={{
                display: 'grid',
                gridTemplateColumns: CATEGORY_ROW_COLUMNS,
                alignItems: 'center',
                marginTop: 2,
              }}
            >
              <span />
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...CATEGORY_VALUE_COLUMNS_SHIFT_STYLE }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                  2025
                </span>
              </span>
              <span style={CATEGORY_VALUE_COLUMNS_SHIFT_STYLE} />
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...CATEGORY_VALUE_COLUMNS_SHIFT_STYLE }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                  2026
                </span>
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', gap: 'var(--space-2)' }}>
              {shown.map((m, index) => (
                <CategoryRow
                  key={m.parent_category_name}
                  metric={m}
                  maxVal={barScaleMax}
                  visual={categoryVisualByName.get(normalizeCategoryLabel(m.parent_category_name))}
                  colorIndex={index}
                  subcategoryRows={subcategoriesByParent.get(normalizeCategoryLabel(m.parent_category_name)) ?? []}
                  isExpanded={false}
                  onToggle={undefined}
                  expandable={false}
                  rowClickable
                  onRowClick={() => setSelectedCategoryNameModal(m.parent_category_name)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr', rowGap: 'var(--space-2)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', alignItems: 'stretch' }}>
              <DonutCard
                yearLabel="2025"
                total={total2025}
                data={donut2025}
                comparisonValues={comparisonValuesByCategory}
                comparedCategoryId={selectedDonutCategoryFromList}
                selectedComparison={selectedDonutComparison}
                onListSelect={(categoryName) => setSelectedDonutCategoryFromList(categoryName)}
                onOpenDetails={(categoryName) => {
                  setSelectedCategoryNameModal(null)
                  setExpandedCategoryNameModal(categoryName)
                  setIsDonutDetailsModalOpen(true)
                }}
              />
              <DonutCard
                yearLabel="2026"
                total={total2026}
                data={donut2026}
                comparisonValues={comparisonValuesByCategory}
                comparedCategoryId={selectedDonutCategoryFromList}
                selectedComparison={selectedDonutComparison}
                onListSelect={(categoryName) => setSelectedDonutCategoryFromList(categoryName)}
                onOpenDetails={(categoryName) => {
                  setSelectedCategoryNameModal(null)
                  setExpandedCategoryNameModal(categoryName)
                  setIsDonutDetailsModalOpen(true)
                }}
              />
            </div>
          </div>
        )}
      </div>

      {selectedCategoryMetric ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Détail catégorie ${selectedCategoryMetric.parent_category_name}`}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3200,
            background: 'rgba(20, 24, 38, 0.58)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
          onClick={() => setSelectedCategoryNameModal(null)}
        >
          <div
            style={{
              width: 'min(760px, 100%)',
              maxHeight: '82vh',
              overflowY: 'auto',
              background: 'var(--neutral-0)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--neutral-200)',
              boxShadow: '0 18px 46px rgba(16, 22, 34, 0.26)',
              padding: 'var(--space-4)',
              display: 'grid',
              gap: 'var(--space-3)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{
              margin: 'calc(var(--space-4) * -1) calc(var(--space-4) * -1) 0',
              background: selectedCategoryVisual?.color ?? '#002FA7',
              color: '#fff',
              padding: '10px var(--space-4)',
              borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
            }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>
                {selectedCategoryMetric.parent_category_name}
              </p>
              <button
                type="button"
                onClick={() => setSelectedCategoryNameModal(null)}
                aria-label="Fermer le détail de catégorie"
                style={{
                  border: '1px solid rgba(255,255,255,0.35)',
                  background: 'rgba(255,255,255,0.12)',
                  color: '#fff',
                  width: 26,
                  height: 26,
                  borderRadius: 'var(--radius-full)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={13} />
              </button>
            </div>

            <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: 'var(--space-2)' }}>
              <span />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8, textAlign: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>2025</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>Var.</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>2026</span>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              {selectedCategoryRows.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-500)' }}>Aucune sous-catégorie disponible.</p>
              ) : selectedCategoryRows.map((row) => {
                const rowVisual = categoryVisualByName.get(normalizeCategoryLabel(row.name))
                const has2025 = row.amount2025 > 0
                const has2026 = row.amount2026 > 0
                const subDeltaColor = row.deltaPct == null
                  ? 'var(--neutral-300)'
                  : row.deltaPct > 0
                    ? 'var(--color-error)'
                    : 'var(--color-success)'

                return (
                  <div
                    key={`${selectedCategoryMetric.parent_category_name}-${row.name}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      alignItems: 'center',
                      columnGap: 'var(--space-3)',
                      minHeight: 28,
                      borderBottom: '1px solid var(--neutral-150)',
                      paddingBottom: 'var(--space-1)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <CategoryIcon
                        iconKey={rowVisual?.iconKey ?? row.name}
                        label={row.name}
                        size={13}
                        style={{ flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.name}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8, textAlign: 'center' }}>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: has2025 ? 'var(--neutral-500)' : 'var(--neutral-300)' }}>
                        {has2025 ? fmt(row.amount2025) : '—'}
                      </span>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: row.deltaPct == null ? 'var(--neutral-300)' : subDeltaColor, fontWeight: 700 }}>
                        {row.deltaPct == null ? '—' : `${row.deltaPct > 0 ? '+' : ''}${Math.round(row.deltaPct)}%`}
                      </span>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: has2026 ? 'var(--neutral-800)' : 'var(--neutral-300)', fontWeight: 700 }}>
                        {has2026 ? fmt(row.amount2026) : '—'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      {isDonutDetailsModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Liste et détail par catégorie"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3200,
            background: 'rgba(20, 24, 38, 0.58)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
          onClick={() => setIsDonutDetailsModalOpen(false)}
        >
          <div
            style={{
              width: 'min(620px, 100%)',
              maxHeight: '82vh',
              overflowY: 'auto',
              background: 'var(--neutral-0)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--neutral-200)',
              boxShadow: '0 18px 46px rgba(16, 22, 34, 0.26)',
              padding: 'var(--space-4)',
              display: 'grid',
              gap: 'var(--space-3)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{
              margin: 'calc(var(--space-4) * -1) calc(var(--space-4) * -1) 0',
              background: '#002FA7',
              color: '#fff',
              padding: '10px var(--space-4)',
              borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
            }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>
                Liste et détail par catégorie
              </p>
              <button
                type="button"
                onClick={() => setIsDonutDetailsModalOpen(false)}
                aria-label="Fermer la liste et détail par catégorie"
                style={{
                  border: '1px solid rgba(255,255,255,0.35)',
                  background: 'rgba(255,255,255,0.12)',
                  color: '#fff',
                  width: 26,
                  height: 26,
                  borderRadius: 'var(--radius-full)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={13} />
              </button>
            </div>

            <div
              aria-hidden
              style={{
                display: 'grid',
                gridTemplateColumns: CATEGORY_ROW_COLUMNS,
                alignItems: 'center',
                marginBottom: 'var(--space-1)',
              }}
            >
              <span />
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...CATEGORY_VALUE_COLUMNS_SHIFT_STYLE }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                  2025
                </span>
              </span>
              <span style={CATEGORY_VALUE_COLUMNS_SHIFT_STYLE} />
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...CATEGORY_VALUE_COLUMNS_SHIFT_STYLE }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                  2026
                </span>
              </span>
            </div>

            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              {barMetrics.map((metric, index) => (
                <CategoryRow
                  key={`full-${metric.parent_category_name}`}
                  metric={metric}
                  maxVal={barScaleMax}
                  visual={categoryVisualByName.get(normalizeCategoryLabel(metric.parent_category_name))}
                  colorIndex={index}
                  subcategoryRows={subcategoriesByParent.get(normalizeCategoryLabel(metric.parent_category_name)) ?? []}
                  isExpanded={expandedCategoryNameModal === metric.parent_category_name}
                  onToggle={() => setExpandedCategoryNameModal((prev) => (prev === metric.parent_category_name ? null : metric.parent_category_name))}
                  expandable
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DonutCard({
  yearLabel,
  total,
  data,
  comparisonValues,
  comparedCategoryId,
  selectedComparison,
  onListSelect,
  onOpenDetails,
}: {
  yearLabel: '2025' | '2026'
  total: number
  data: DonutEntry[]
  comparisonValues: Map<string, { value2025: number; value2026: number }>
  comparedCategoryId: string | null
  selectedComparison: DonutComparisonSelection | null
  onListSelect: (categoryName: string) => void
  onOpenDetails: (categoryName: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(data[0]?.id ?? null)
  const topFive = useMemo(() => data.slice(0, 5), [data])
  const tooltipSurfaceRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (selectedId == null) return

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      const isInsideTooltip = tooltipSurfaceRef.current?.contains(target) ?? false
      if (!isInsideTooltip) setSelectedId(null)
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown)
    }
  }, [selectedId])

  return (
    <div style={{
      display: 'grid',
      gap: 'var(--space-2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 var(--space-1)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: yearLabel === '2025' ? 'var(--neutral-500)' : 'var(--neutral-800)', letterSpacing: '0.05em', textAlign: 'center' }}>
          {yearLabel}
        </span>
      </div>

      <div style={{ height: 166, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={68}
              paddingAngle={1}
              stroke="var(--neutral-0)"
              strokeWidth={1}
              isAnimationActive={false}
              onClick={(_, index) => {
                const clicked = data[index]
                if (!clicked) return
                setSelectedId(clicked.id)
              }}
            >
              {data.map((entry) => (
                <Cell
                  key={`${yearLabel}-${entry.id}`}
                  fill={entry.color}
                  fillOpacity={selectedId == null || selectedId === entry.id ? 1 : 0.35}
                  stroke={selectedId === entry.id ? 'var(--neutral-800)' : 'var(--neutral-0)'}
                  strokeWidth={selectedId === entry.id ? 2 : 1}
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </Pie>
            <Tooltip
              trigger="click"
              content={(
                <DonutTooltip
                  comparisonValues={comparisonValues}
                  selectedId={selectedId}
                  surfaceRef={tooltipSurfaceRef}
                  onClose={() => setSelectedId(null)}
                  onDetail={onOpenDetails}
                />
              )}
              wrapperStyle={{ zIndex: 2600, pointerEvents: 'auto' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>
            {fmt(total)}
          </span>
        </div>
      </div>

      <div style={{ minHeight: 38, padding: '0 var(--space-1)' }}>
        {selectedComparison ? (
          <div style={{ display: 'grid', gap: 2, justifyItems: 'center', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--neutral-900)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selectedComparison.name}
            </p>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--neutral-600)', lineHeight: 1.2, fontFamily: 'var(--font-mono)' }}>
              {yearLabel === '2025'
                ? (selectedComparison.value2025 > 0 ? fmt(selectedComparison.value2025) : '—')
                : (selectedComparison.value2026 > 0 ? fmt(selectedComparison.value2026) : '—')}
            </p>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 10, color: 'var(--neutral-500)', textAlign: 'center' }}>Clique une ligne de liste</p>
        )}
      </div>

      <div style={{ display: 'grid', gap: 5, padding: '0 var(--space-1)', width: 'min(176px, 100%)', justifySelf: 'center' }}>
        {topFive.map((entry) => {
          const pct = total > 0 ? (entry.value / total) * 100 : 0
          const active = comparedCategoryId === entry.id
          return (
            <button
              key={`${yearLabel}-legend-${entry.id}`}
              type="button"
              onClick={() => onListSelect(entry.id)}
              style={{
                border: 'none',
                background: 'transparent',
                padding: 0,
                display: 'grid',
                gridTemplateColumns: '12px minmax(0,0.94fr) 34px',
                alignItems: 'center',
                gap: 4,
                textAlign: 'left',
                cursor: 'pointer',
                opacity: comparedCategoryId == null || active ? 1 : 0.58,
              }}
            >
              <CategoryIcon
                iconKey={entry.iconKey ?? entry.name}
                label={entry.name}
                size={11}
                style={{ flexShrink: 0 }}
              />
              <span style={{ fontSize: 10, color: 'var(--neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {entry.name}
              </span>
              <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>
                {Math.round(pct)}%
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DonutTooltip({
  active,
  payload,
  comparisonValues,
  selectedId,
  surfaceRef,
  onClose,
  onDetail,
}: {
  active?: boolean
  payload?: Array<{ payload?: DonutEntry }>
  comparisonValues: Map<string, { value2025: number; value2026: number }>
  selectedId: string | null
  surfaceRef: { current: HTMLDivElement | null }
  onClose: () => void
  onDetail: (categoryName: string) => void
}) {
  if (!active || !payload?.length) return null
  const entry = payload[0]?.payload
  if (!entry || selectedId == null || entry.id !== selectedId) return null

  const comparison = comparisonValues.get(entry.name)
  const value2025 = comparison?.value2025 ?? 0
  const value2026 = comparison?.value2026 ?? 0
  const delta = value2026 - value2025
  const deltaPct = value2025 > 0 ? ((value2026 - value2025) / value2025) * 100 : null
  const isUp = delta > 0

  const deltaColor = delta === 0 ? 'var(--neutral-400)' : isUp ? '#C0392B' : '#1A7A4A'
  const deltaBg = delta === 0 ? 'var(--neutral-100)' : isUp ? 'rgba(252,90,90,0.10)' : 'rgba(46,212,122,0.12)'

  return (
    <div
      ref={surfaceRef}
      onClick={(event) => event.stopPropagation()}
      style={{
        position: 'relative',
        background: 'var(--neutral-0)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.13)',
        padding: '10px 12px',
        minWidth: 158,
        zIndex: 2600,
        pointerEvents: 'auto',
      }}
    >
      <button
        type="button"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          border: 'none',
          background: 'transparent',
          color: 'var(--neutral-400)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          padding: 0,
        }}
        aria-label="Fermer"
      >
        <X size={11} />
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', columnGap: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, paddingRight: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.35 }}>
            {entry.name}
          </span>
        </div>
        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
          {entry.rank}/12
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-400)' }}>2025</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--neutral-500)' }}>
          {value2025 > 0 ? fmt(value2025) : '—'}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-800)' }}>2026</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-900)' }}>
          {value2026 > 0 ? fmt(value2026) : '—'}
        </span>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        paddingTop: 6,
        borderTop: '1px solid var(--neutral-100)',
        gap: 8,
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-400)', flexShrink: 0 }}>Var.</span>
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: deltaColor,
          background: deltaBg,
          borderRadius: 'var(--radius-full)',
          padding: '2px 6px',
          flexShrink: 0,
          marginLeft: 'auto',
        }}>
          {delta === 0 ? '—' : isUp ? '▲' : '▼'} {deltaPct != null ? `${Math.abs(deltaPct).toFixed(1)}%` : ''}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onDetail(entry.name)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          padding: '5px 8px',
          borderRadius: 'var(--radius-sm)',
          border: '1.5px solid #5B57F5',
          background: 'transparent',
          color: '#5B57F5',
          fontSize: 10,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Détails
        <ChevronRight size={11} strokeWidth={2.5} />
      </button>
    </div>
  )
}

function CategoryRow({
  metric,
  maxVal,
  visual,
  colorIndex,
  subcategoryRows,
  isExpanded,
  onToggle,
  expandable = true,
  rowClickable = false,
  onRowClick,
}: {
  metric: ComparedCategoryMetric
  maxVal: number
  visual?: { iconKey: string | null; color: string }
  colorIndex: number
  subcategoryRows: Array<{ name: string; amount2025: number; amount2026: number; deltaPct: number | null }>
  isExpanded: boolean
  onToggle?: () => void
  expandable?: boolean
  rowClickable?: boolean
  onRowClick?: () => void
}) {
  const { parent_category_name, total_2025, total_2026, delta_eur, delta_pct } = metric
  const pct2025 = maxVal > 0 ? Math.min(100, (total_2025 / maxVal) * 100) : 0
  const pct2026 = maxVal > 0 ? Math.min(100, (total_2026 / maxVal) * 100) : 0
  const bar2026Color = visual?.color ?? getCategoryColor(null, colorIndex)
  const shortPct = Math.min(pct2025, pct2026)
  const longPct = Math.max(pct2025, pct2026)
  const shortRatioInLong = longPct > 0 ? (shortPct / longPct) * 100 : 0
  const extensionRatioInLong = Math.max(0, 100 - shortRatioInLong)
  const shortColor = pct2025 <= pct2026 ? 'var(--neutral-300)' : bar2026Color
  const longColor = pct2025 > pct2026 ? 'var(--neutral-300)' : bar2026Color

  const isUp      = delta_eur > 0
  const deltaColor = delta_eur === 0
    ? 'var(--neutral-400)'
    : isUp ? 'var(--color-error)' : 'var(--color-success)'    // dépenses : hausse = mauvais

  const rowHeader = (
    <>
        <div style={{ display: 'grid', gridTemplateColumns: CATEGORY_ROW_COLUMNS, alignItems: 'baseline', marginBottom: 3, columnGap: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <CategoryIcon
              iconKey={visual?.iconKey ?? parent_category_name}
              label={parent_category_name}
              size={14}
              style={{ flexShrink: 0 }}
            />
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--neutral-700)', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {parent_category_name}
            </p>
          </div>
          <span style={{ fontSize: 10, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', textAlign: 'center', fontVariantNumeric: 'tabular-nums', ...CATEGORY_VALUE_COLUMNS_SHIFT_STYLE }}>
            {fmt(total_2025)}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative', ...CATEGORY_VALUE_COLUMNS_SHIFT_STYLE }}>
            {delta_pct != null ? (
              <span style={{
                position: 'absolute',
                left: '50%',
                top: '26%',
                transform: 'translate(-50%, -50%)',
                fontSize: 9,
                fontWeight: 700,
                color: deltaColor,
                background: delta_eur === 0
                  ? 'var(--neutral-100)'
                  : isUp
                    ? 'color-mix(in oklab, var(--color-error) 10%, var(--neutral-0) 90%)'
                    : 'color-mix(in oklab, var(--color-success) 10%, var(--neutral-0) 90%)',
                borderRadius: 'var(--radius-full)',
                padding: '2px 6px',
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}>
                {isUp ? '+' : ''}{Math.round(delta_pct)}%
              </span>
            ) : null}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-800)', fontFamily: 'var(--font-mono)', textAlign: 'center', fontVariantNumeric: 'tabular-nums', ...CATEGORY_VALUE_COLUMNS_SHIFT_STYLE }}>
            {fmt(total_2026)}
          </span>
        </div>

        {/* Barre fusionnée: segment court puis extension du segment long */}
        <div style={{ height: 5 }}>
          <div style={{ height: '100%', width: `${longPct}%`, display: 'flex', transition: 'width 0.4s ease' }}>
            <div style={{ width: `${shortRatioInLong}%`, background: shortColor, borderRadius: '3px 0 0 3px' }} />
            <div style={{ width: `${extensionRatioInLong}%`, background: longColor, borderRadius: '0 3px 3px 0' }} />
          </div>
        </div>
    </>
  )

  return (
    <div>
      {expandable ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          style={{ border: 'none', background: 'transparent', padding: 0, width: '100%', textAlign: 'left', cursor: 'pointer' }}
        >
          {rowHeader}
        </button>
      ) : rowClickable ? (
        <button
          type="button"
          onClick={onRowClick}
          style={{ border: 'none', background: 'transparent', padding: 0, width: '100%', textAlign: 'left', cursor: 'pointer' }}
        >
          {rowHeader}
        </button>
      ) : (
        <div style={{ padding: 0 }}>
          {rowHeader}
        </div>
      )}

      {expandable && isExpanded ? (
        <div style={{
          marginTop: 'var(--space-2)',
          background: 'var(--neutral-50)',
          borderRadius: 'var(--radius-lg)',
          border: `1px solid color-mix(in oklab, ${bar2026Color} 42%, var(--neutral-0) 58%)`,
          padding: '8px 10px',
          display: 'grid',
          gap: 4,
        }}>
          {subcategoryRows.map((row) => {
            const subDeltaColor = row.deltaPct == null
              ? 'var(--neutral-300)'
              : row.deltaPct > 0
                ? 'var(--color-error)'
                : 'var(--color-success)'
            const has2025 = row.amount2025 > 0
            const has2026 = row.amount2026 > 0

            return (
              <div
                key={`${parent_category_name}-${row.name}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: CATEGORY_ROW_COLUMNS,
                  alignItems: 'baseline',
                  columnGap: 0,
                  minHeight: 16,
                }}
              >
                <span style={{ paddingLeft: 20, fontSize: 10, lineHeight: 1.05, color: 'var(--neutral-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.name}
                </span>
                <span style={{ fontSize: 10, lineHeight: 1.05, fontFamily: 'var(--font-mono)', color: has2025 ? 'var(--neutral-400)' : 'var(--neutral-300)', textAlign: 'center', fontVariantNumeric: 'tabular-nums', ...SUBCATEGORY_VALUE_COLUMNS_SHIFT_STYLE }}>
                  {has2025 ? fmt(row.amount2025) : '-'}
                </span>
                <span style={{ fontSize: 10, lineHeight: 1.05, fontFamily: 'var(--font-mono)', color: row.deltaPct == null ? 'var(--neutral-300)' : subDeltaColor, textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                  {row.deltaPct == null ? '-' : `${row.deltaPct > 0 ? '+' : ''}${Math.round(row.deltaPct)}%`}
                </span>
                <span style={{ fontSize: 10, lineHeight: 1.05, fontFamily: 'var(--font-mono)', color: has2026 ? 'var(--neutral-800)' : 'var(--neutral-300)', textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontWeight: 700, ...SUBCATEGORY_VALUE_COLUMNS_SHIFT_STYLE }}>
                  {has2026 ? fmt(row.amount2026) : '-'}
                </span>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
