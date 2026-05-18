import type { AnnualTotalsPayload } from '@/features/annual-analysis/types'
import { formatCurrencyRounded as formatCurrency } from '@/lib/utils'

type Props = {
  data: AnnualTotalsPayload
}

export function AnnualOverviewHero({ data }: Props) {
  const savingsRate     = data.income_total_year > 0
    ? Math.round((data.savings_total_year / data.income_total_year) * 100)
    : 0
  const expenseRate     = data.income_total_year > 0
    ? Math.round((data.expense_total_year / data.income_total_year) * 100)
    : 0

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, #3D3AB8 0%, #5B57F5 55%, #7C79FF 100%)',
          borderRadius: 'var(--radius-2xl)',
          padding: 'var(--space-6)',
          boxShadow: '0 8px 32px rgba(91,87,245,0.28)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Watermark */}
          <span style={{
            position: 'absolute',
            right: -8, top: -12,
            fontSize: 88,
            fontWeight: 900,
            fontFamily: 'var(--font-mono)',
            color: 'rgba(255,255,255,0.06)',
            lineHeight: 1,
            userSelect: 'none',
            pointerEvents: 'none',
            letterSpacing: '-0.04em',
          }}>
            2025
          </span>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <p style={{
              margin: 0,
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.55)',
              textTransform: 'uppercase',
              letterSpacing: '0.09em',
            }}>
              Bilan 2025
            </p>
          </div>

          {/* Main amount */}
          <p style={{
            margin: '8px 0 0',
            fontSize: 'clamp(28px, 8vw, 40px)',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            color: '#FFFFFF',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}>
            {formatCurrency(data.expense_total_year)}
          </p>
          <p style={{
            margin: '4px 0 0',
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.68)',
            lineHeight: 1.2,
          }}>
            dépensés
          </p>

          {/* Divider */}
          <div style={{
            margin: 'var(--space-5) 0 var(--space-4)',
            height: 1,
            background: 'rgba(255,255,255,0.14)',
          }} />

          {/* 4 KPIs inline */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
            <KpiItem label="Revenus" value={formatCurrency(data.income_total_year)} />
            <KpiItem label="% dépenses" value={`${expenseRate}%`} />
            <KpiItem label="Épargne" value={formatCurrency(data.savings_total_year)} />
            <KpiItem label="% épargne" value={`${savingsRate}%`} highlight="positive" />
          </div>
        </div>
      </div>
    </section>
  )
}

function KpiItem({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: 'positive' | 'negative'
}) {
  const valueColor = highlight === 'negative'
    ? 'rgba(252,90,90,0.9)'
    : highlight === 'positive'
      ? 'rgba(46,212,122,0.9)'
      : 'rgba(255,255,255,0.92)'

  return (
    <div style={{ minWidth: 0 }}>
      <p style={{
        margin: 0,
        fontSize: 9,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.45)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {label}
      </p>
      <p style={{
        margin: '4px 0 0',
        fontSize: 'var(--font-size-sm)',
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        color: valueColor,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {value}
      </p>
    </div>
  )
}
