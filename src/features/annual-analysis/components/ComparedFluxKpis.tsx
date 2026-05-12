import { formatCurrencyRounded as fmt } from '@/lib/utils'
import type { ComparedFluxMetric } from '@/features/annual-analysis/types.compared'

type Props = {
  metrics: ComparedFluxMetric[]
}

const FLUX_KEYS = ['Revenus', 'Dépenses', 'Cashflow net', 'Capacité épar.']

export function ComparedFluxKpis({ metrics }: Props) {
  const shown = metrics.filter((m) => FLUX_KEYS.includes(m.label))

  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      {shown.map((m) => (
        <FluxKpiRow key={m.label} metric={m} />
      ))}
    </div>
  )
}

function FluxKpiRow({ metric }: { metric: ComparedFluxMetric }) {
  const { label, value_2025, value_2026, delta_eur, delta_pct, positive_is } = metric
  const isPositive = positive_is === 'up' ? delta_eur >= 0 : delta_eur <= 0
  const deltaColor = delta_eur === 0
    ? 'var(--neutral-400)'
    : isPositive ? 'var(--color-success)' : 'var(--color-error)'

  const arrow = delta_eur === 0 ? '=' : delta_eur > 0 ? '↑' : '↓'
  const pctLabel = delta_pct != null ? `${Math.abs(delta_pct).toFixed(1)}%` : '—'

  return (
    <div style={{
      background: 'var(--neutral-0)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-card)',
      border: '1px solid var(--neutral-150)',
      padding: 'var(--space-4)',
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr auto',
      alignItems: 'center',
      gap: 'var(--space-3)',
    }}>
      {/* 2025 */}
      <div>
        <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
          2025
        </p>
        <p style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)' }}>
          {fmt(value_2025)}
        </p>
      </div>

      {/* Label + delta */}
      <div style={{ textAlign: 'center', padding: '0 var(--space-1)' }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', marginBottom: 4 }}>
          {label}
        </p>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
          background: delta_eur === 0
            ? 'var(--neutral-100)'
            : isPositive
              ? 'color-mix(in oklab, var(--color-success) 12%, var(--neutral-0) 88%)'
              : 'color-mix(in oklab, var(--color-error) 10%, var(--neutral-0) 90%)',
          borderRadius: 'var(--radius-full)',
          padding: '2px 7px',
          fontSize: 10,
          fontWeight: 700,
          color: deltaColor,
          whiteSpace: 'nowrap',
        }}>
          {arrow} {pctLabel}
        </span>
      </div>

      {/* 2026 */}
      <div style={{ textAlign: 'right' }}>
        <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--primary-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
          2026
        </p>
        <p style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
          {fmt(value_2026)}
        </p>
      </div>

      {/* Delta absolu */}
      <div style={{ textAlign: 'right' }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: deltaColor }}>
          {delta_eur > 0 ? '+' : ''}{fmt(delta_eur)}
        </p>
      </div>
    </div>
  )
}
