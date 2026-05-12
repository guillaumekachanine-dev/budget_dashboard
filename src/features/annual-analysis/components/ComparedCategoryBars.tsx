import { useMemo, useState } from 'react'
import { LayoutGrid, PieChart as PieChartIcon } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { useCategories } from '@/hooks/useCategories'
import { formatCurrencyRounded as fmt, getCategoryColor } from '@/lib/utils'
import type { ComparedCategoryMetric } from '@/features/annual-analysis/types.compared'

type Props = {
  metrics: ComparedCategoryMetric[]
}

const MAX_VISIBLE = 7
type CategoryViewMode = 'bars' | 'donuts'

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
}

function normalizeCategoryLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function ComparedCategoryBars({ metrics }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [viewMode, setViewMode] = useState<CategoryViewMode>('bars')
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

  const maxVal   = Math.max(...metrics.flatMap((m) => [m.total_2025, m.total_2026]))
  const shown    = expanded ? metrics : metrics.slice(0, MAX_VISIBLE)
  const hasMore  = metrics.length > MAX_VISIBLE
  const categorySeries = useMemo(() => (
    metrics.map((metric, index) => {
      const visual = categoryVisualByName.get(normalizeCategoryLabel(metric.parent_category_name))
      return {
        name: metric.parent_category_name,
        total2025: metric.total_2025,
        total2026: metric.total_2026,
        color: visual?.color ?? getCategoryColor(null, index),
      }
    })
  ), [metrics, categoryVisualByName])
  const donut2025 = useMemo<DonutEntry[]>(
    () => categorySeries
      .filter((entry) => entry.total2025 > 0)
      .map((entry) => ({ id: entry.name, name: entry.name, value: entry.total2025, color: entry.color }))
      .sort((a, b) => b.value - a.value),
    [categorySeries],
  )
  const donut2026 = useMemo<DonutEntry[]>(
    () => categorySeries
      .filter((entry) => entry.total2026 > 0)
      .map((entry) => ({ id: entry.name, name: entry.name, value: entry.total2026, color: entry.color }))
      .sort((a, b) => b.value - a.value),
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

  if (metrics.length === 0) return null

  return (
    <div style={{
      background: 'var(--neutral-0)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-card)',
      border: '1px solid var(--neutral-150)',
      padding: 'var(--space-5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'grid', gap: 'var(--space-2)', minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-600)', whiteSpace: 'nowrap' }}>
            Dépenses par catégorie
          </p>
          {viewMode === 'bars' ? (
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              {[{ label: '2025', color: 'var(--neutral-300)' }, { label: '2026', color: 'var(--neutral-700)' }].map(({ label, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                </div>
              ))}
            </div>
          ) : null}
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

      {viewMode === 'bars' ? (
        <>
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {shown.map((m, index) => (
              <CategoryRow
                key={m.parent_category_name}
                metric={m}
                maxVal={maxVal}
                visual={categoryVisualByName.get(normalizeCategoryLabel(m.parent_category_name))}
                colorIndex={index}
              />
            ))}
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                display: 'block',
                marginTop: 'var(--space-3)',
                width: '100%',
                background: 'var(--neutral-50)',
                border: '1px solid var(--neutral-200)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2)',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--neutral-500)',
                cursor: 'pointer',
              }}
            >
              {expanded ? 'Réduire ↑' : `Voir ${metrics.length - MAX_VISIBLE} de plus ↓`}
            </button>
          )}
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', alignItems: 'start' }}>
          <DonutCard yearLabel="2025" total={total2025} data={donut2025} />
          <DonutCard yearLabel="2026" total={total2026} data={donut2026} />
        </div>
      )}
    </div>
  )
}

function DonutCard({
  yearLabel,
  total,
  data,
}: {
  yearLabel: '2025' | '2026'
  total: number
  data: DonutEntry[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(data[0]?.id ?? null)
  const topFive = useMemo(() => data.slice(0, 5), [data])
  const selected = useMemo(() => data.find((entry) => entry.id === selectedId) ?? null, [data, selectedId])
  const selectedPct = selected && total > 0 ? (selected.value / total) * 100 : null

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
              formatter={(value: number) => fmt(value)}
              labelFormatter={(label) => String(label)}
              contentStyle={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)', boxShadow: 'var(--shadow-sm)' }}
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
        {selected ? (
          <div style={{ display: 'grid', gap: 2, justifyItems: 'center', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--neutral-900)', lineHeight: 1.2 }}>
              {selected.name}
            </p>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--neutral-600)', lineHeight: 1.2, fontFamily: 'var(--font-mono)' }}>
              {fmt(selected.value)}{selectedPct != null ? ` (${Math.round(selectedPct)}%)` : ''}
            </p>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 10, color: 'var(--neutral-500)' }}>Clique une section pour voir le détail</p>
        )}
      </div>

      <div style={{ display: 'grid', gap: 5, padding: '0 var(--space-1)' }}>
        {topFive.map((entry) => {
          const pct = total > 0 ? (entry.value / total) * 100 : 0
          const active = selectedId === entry.id
          return (
            <button
              key={`${yearLabel}-legend-${entry.id}`}
              type="button"
              onClick={() => setSelectedId(entry.id)}
              style={{
                border: 'none',
                background: 'transparent',
                padding: 0,
                display: 'grid',
                gridTemplateColumns: '8px minmax(0,1fr) auto',
                alignItems: 'center',
                gap: 6,
                textAlign: 'left',
                cursor: 'pointer',
                opacity: selectedId == null || active ? 1 : 0.58,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, background: entry.color, display: 'inline-block' }} />
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

function CategoryRow({
  metric,
  maxVal,
  visual,
  colorIndex,
}: {
  metric: ComparedCategoryMetric
  maxVal: number
  visual?: { iconKey: string | null; color: string }
  colorIndex: number
}) {
  const { parent_category_name, total_2025, total_2026, delta_eur, delta_pct } = metric
  const pct2025 = maxVal > 0 ? (total_2025 / maxVal) * 100 : 0
  const pct2026 = maxVal > 0 ? (total_2026 / maxVal) * 100 : 0
  const bar2026Color = visual?.color ?? getCategoryColor(null, colorIndex)

  const isUp      = delta_eur > 0
  const deltaColor = delta_eur === 0
    ? 'var(--neutral-400)'
    : isUp ? 'var(--color-error)' : 'var(--color-success)'    // dépenses : hausse = mauvais

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <CategoryIcon
            iconKey={visual?.iconKey ?? parent_category_name}
            label={parent_category_name}
            size={14}
            style={{ flexShrink: 0 }}
          />
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {parent_category_name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}>
            {fmt(total_2025)}
          </span>
          <span style={{ fontSize: 9, color: 'var(--neutral-300)' }}>→</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-800)', fontFamily: 'var(--font-mono)' }}>
            {fmt(total_2026)}
          </span>
          {delta_pct != null && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: deltaColor,
              background: delta_eur === 0
                ? 'var(--neutral-100)'
                : isUp
                  ? 'color-mix(in oklab, var(--color-error) 10%, var(--neutral-0) 90%)'
                  : 'color-mix(in oklab, var(--color-success) 10%, var(--neutral-0) 90%)',
              borderRadius: 'var(--radius-full)',
              padding: '1px 5px',
            }}>
              {isUp ? '+' : ''}{delta_pct.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* Double barre */}
      <div style={{ display: 'grid', gap: 2 }}>
        <div style={{ height: 5, borderRadius: 3, background: 'var(--neutral-100)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct2025}%`, background: 'var(--neutral-300)', borderRadius: 3, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ height: 5, borderRadius: 3, background: 'var(--neutral-100)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct2026}%`, background: bar2026Color, borderRadius: 3, transition: 'width 0.4s ease' }} />
        </div>
      </div>
    </div>
  )
}
