import { useState } from 'react'
import { formatCurrencyRounded as fmt } from '@/lib/utils'
import type { ComparedCategoryMetric } from '@/features/annual-analysis/types.compared'

type Props = {
  metrics: ComparedCategoryMetric[]
}

const MAX_VISIBLE = 7

export function ComparedCategoryBars({ metrics }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (metrics.length === 0) return null

  const maxVal   = Math.max(...metrics.flatMap((m) => [m.total_2025, m.total_2026]))
  const shown    = expanded ? metrics : metrics.slice(0, MAX_VISIBLE)
  const hasMore  = metrics.length > MAX_VISIBLE

  return (
    <div style={{
      background: 'var(--neutral-0)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-card)',
      border: '1px solid var(--neutral-150)',
      padding: 'var(--space-5)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-4)' }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-600)' }}>
          Dépenses par catégorie
        </p>
        {/* Légende inline */}
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {[{ label: '2025', color: 'var(--neutral-300)' }, { label: '2026', color: 'var(--primary-500)' }].map(({ label, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        {shown.map((m) => (
          <CategoryRow key={m.parent_category_name} metric={m} maxVal={maxVal} />
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
    </div>
  )
}

function CategoryRow({ metric, maxVal }: { metric: ComparedCategoryMetric; maxVal: number }) {
  const { parent_category_name, total_2025, total_2026, delta_eur, delta_pct } = metric
  const pct2025 = maxVal > 0 ? (total_2025 / maxVal) * 100 : 0
  const pct2026 = maxVal > 0 ? (total_2026 / maxVal) * 100 : 0

  const isUp      = delta_eur > 0
  const deltaColor = delta_eur === 0
    ? 'var(--neutral-400)'
    : isUp ? 'var(--color-error)' : 'var(--color-success)'    // dépenses : hausse = mauvais

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--neutral-700)' }}>
          {parent_category_name}
        </p>
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
          <div style={{ height: '100%', width: `${pct2026}%`, background: 'var(--primary-500)', borderRadius: 3, transition: 'width 0.4s ease' }} />
        </div>
      </div>
    </div>
  )
}
