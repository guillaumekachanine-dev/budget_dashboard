import type { AnnualTotalsPayload } from '@/features/annual-analysis/types'
import { formatCurrency } from '@/features/stats/utils/statsReferenceSelectors'

type Props = {
  data: AnnualTotalsPayload
}

type MetricItem = {
  label: string
  value: number
  isNegative?: boolean
  highlight?: boolean
}

export function AnnualOverviewHero({ data }: Props) {
  const secondary: MetricItem[] = [
    { label: 'Revenus 2025', value: data.income_total_year },
    { label: 'Épargne 2025', value: data.savings_total_year },
    { label: 'Net cashflow', value: data.net_cashflow_year, isNegative: data.net_cashflow_year < 0 },
    { label: 'Moy. mensuelle', value: data.avg_monthly_expense },
  ]

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-3)' }}>
        {/* Card principale — dépenses totales */}
        <div style={{
          background: 'var(--primary-500)',
          borderRadius: 'var(--radius-2xl)',
          padding: 'var(--space-5)',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <p style={{
            margin: 0,
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'rgba(255,255,255,0.72)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            Dépenses totales 2025
          </p>
          <p style={{
            margin: '6px 0 0',
            fontSize: 'var(--font-size-4xl)',
            fontWeight: 'var(--font-weight-extrabold)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--neutral-0)',
            lineHeight: 1.1,
          }}>
            {formatCurrency(data.expense_total_year)}
          </p>
        </div>

        {/* Grille 2×2 — métriques secondaires */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          {secondary.map((item) => (
            <MetricCard key={item.label} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
}

function MetricCard({ item }: { item: MetricItem }) {
  const valueColor = item.isNegative
    ? 'var(--color-negative)'
    : item.highlight
      ? 'var(--primary-600)'
      : 'var(--neutral-900)'

  return (
    <div style={{
      background: 'var(--neutral-0)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-card)',
      border: '1px solid var(--neutral-150)',
      padding: 'var(--space-4)',
    }}>
      <p style={{
        margin: 0,
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-medium)',
        color: 'var(--neutral-500)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {item.label}
      </p>
      <p style={{
        margin: '6px 0 0',
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-bold)',
        fontFamily: 'var(--font-mono)',
        color: valueColor,
        lineHeight: 1.15,
      }}>
        {formatCurrency(item.value)}
      </p>
    </div>
  )
}
