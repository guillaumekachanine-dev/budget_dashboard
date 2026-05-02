import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Annual2025InsightRow, MonthlyProfilePoint } from '@/features/annual-analysis/types'
import { formatCurrencyRounded as formatCurrency } from '@/lib/utils'
import { CHART_TOOLTIP_STYLE, getMonthShortLabel } from './_constants'

type Props = {
  insightByKey: Record<string, Annual2025InsightRow>
  monthlyProfile: MonthlyProfilePoint[]
}

const SERIES = [
  { key: 'expense',  name: 'Dépenses',     color: '#FC5A5A', gradId: 'gExp',  dashed: false },
  { key: 'income',   name: 'Revenus',      color: '#2ED47A', gradId: 'gInc',  dashed: false },
  { key: 'savings',  name: 'Épargne',      color: '#FFAB2E', gradId: 'gSav',  dashed: false },
  { key: 'net',      name: 'Net cashflow', color: '#5B57F5', gradId: 'gNet',  dashed: true  },
]

export function AnnualSeasonalitySection({ insightByKey, monthlyProfile }: Props) {
  const peakInsight    = insightByKey['peak_month']
  const lowInsight     = insightByKey['low_month']
  const spreadInsight  = insightByKey['seasonality_spread']

  const hasSummary = peakInsight ?? lowInsight ?? spreadInsight
  const hasChart   = monthlyProfile.length > 0

  if (!hasSummary && !hasChart) return null

  const chartData = monthlyProfile.map((point) => ({
    label:   getMonthShortLabel(point.period_month),
    expense: point.expense_total,
    income:  point.income_total,
    savings: point.savings_capacity,
    net:     point.net_cashflow,
  }))

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>
        <h2 style={styles.sectionTitle}>Saisonnalité 2025</h2>

        {hasSummary ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
            {peakInsight ? (
              <SeasonCard
                label="Pic de dépenses"
                value={peakInsight.value_text ?? '—'}
                amount={peakInsight.value_numeric}
                accentColor="#FC5A5A"
              />
            ) : null}
            {lowInsight ? (
              <SeasonCard
                label="Mois le plus calme"
                value={lowInsight.value_text ?? '—'}
                amount={lowInsight.value_numeric}
                accentColor="#2ED47A"
              />
            ) : null}
            {spreadInsight ? (
              <SeasonCard
                label="Amplitude"
                value={
                  spreadInsight.value_text ??
                  (spreadInsight.value_numeric != null ? formatCurrency(spreadInsight.value_numeric) : '—')
                }
                amount={null}
                accentColor="#FFAB2E"
              />
            ) : null}
          </div>
        ) : null}

        {hasChart ? (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Profil mensuel 2025</h3>
            <p style={styles.cardSubtitle}>Revenus · Dépenses · Épargne · Net cashflow</p>
            <div style={{ marginTop: 'var(--space-5)' }}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                  <defs>
                    {SERIES.map((s) => (
                      <linearGradient key={s.gradId} id={s.gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={s.color} stopOpacity={s.dashed ? 0.06 : 0.18} />
                        <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--neutral-100)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    cursor={{ stroke: 'var(--neutral-200)', strokeWidth: 1 }}
                  />
                  <Legend
                    wrapperStyle={{
                      fontSize: 10,
                      paddingTop: 14,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--neutral-500)',
                    }}
                    iconType="circle"
                    iconSize={7}
                  />

                  {SERIES.map((s) => (
                    <Area
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.name}
                      stroke={s.color}
                      strokeWidth={s.dashed ? 1.5 : 2}
                      strokeDasharray={s.dashed ? '5 3' : undefined}
                      fill={`url(#${s.gradId})`}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function SeasonCard({
  label,
  value,
  amount,
  accentColor,
}: {
  label: string
  value: string
  amount: number | null
  accentColor: string
}) {
  return (
    <div style={{
      background: `color-mix(in oklab, ${accentColor} 6%, var(--neutral-0) 94%)`,
      borderRadius: 'var(--radius-xl)',
      border: `1px solid color-mix(in oklab, ${accentColor} 20%, transparent 80%)`,
      borderTopWidth: 3,
      borderTopColor: accentColor,
      padding: 'var(--space-3)',
    }}>
      <p style={{
        margin: 0,
        fontSize: 10,
        fontWeight: 700,
        color: accentColor,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {label}
      </p>
      <p style={{
        margin: '6px 0 0',
        fontSize: 'var(--font-size-base)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--neutral-900)',
        lineHeight: 1.2,
      }}>
        {value}
      </p>
      {amount != null ? (
        <p style={{
          margin: '3px 0 0',
          fontSize: 'var(--font-size-xs)',
          fontFamily: 'var(--font-mono)',
          color: 'var(--neutral-500)',
          fontWeight: 600,
        }}>
          {formatCurrency(amount)}
        </p>
      ) : null}
    </div>
  )
}

const styles = {
  sectionTitle: {
    margin: 0,
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--neutral-900)',
  } as React.CSSProperties,
  card: {
    background: 'var(--neutral-0)',
    borderRadius: 'var(--radius-2xl)',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--neutral-150)',
    padding: 'var(--space-5)',
  } as React.CSSProperties,
  cardTitle: {
    margin: 0,
    fontSize: 'var(--font-size-base)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--neutral-900)',
  } as React.CSSProperties,
  cardSubtitle: {
    margin: '4px 0 0',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--neutral-400)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontWeight: 600,
  } as React.CSSProperties,
}
