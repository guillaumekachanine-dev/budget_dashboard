import type { Annual2026Summary } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'

interface Annual2026YtdMetricsSectionProps {
  summary: Annual2026Summary
  title?: string
}

function SimpleKpi({ label, value, color = 'var(--neutral-900)' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p style={{
        margin: 0,
        fontSize: 8.5,
        fontWeight: 700,
        color: 'var(--neutral-500)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {label}
      </p>
      <p style={{
        margin: '2px 0 0',
        fontSize: 14,
        fontWeight: 800,
        color,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {value}
      </p>
    </div>
  )
}

const fmt2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

export function Annual2026YtdMetricsSection({ summary, title = 'Métriques 2026 - YTD' }: Annual2026YtdMetricsSectionProps) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
      <div style={{ padding: '0 var(--space-6)', marginTop: 'var(--space-2)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{
            margin: 0,
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--neutral-900)',
            letterSpacing: '-0.02em',
          }}>
            {title}
          </h2>
        </div>
      </div>

      <div style={{ padding: '0 var(--space-6)' }}>
        <div style={{
          maxWidth: 600,
          margin: '0 auto',
          background: 'linear-gradient(135deg, var(--neutral-100) 0%, var(--neutral-200) 100%)',
          borderRadius: 'var(--radius-2xl)',
          padding: 'var(--space-5) var(--space-6)',
          border: '1px solid var(--neutral-200)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'var(--space-2)',
        }}>
          <SimpleKpi label="Dépenses YTD" value={fmt2(summary.ytdBudgetTotal)} />
          <SimpleKpi label="Revenus YTD" value="15 420 €" />
          <SimpleKpi label="Épargne YTD" value={fmt2(summary.ytdSavingsTotal)} color="var(--primary-600)" />
          <SimpleKpi label="Réel vs Budget" value="98.2 %" color="var(--color-success)" />
        </div>
      </div>
    </div>
  )
}
