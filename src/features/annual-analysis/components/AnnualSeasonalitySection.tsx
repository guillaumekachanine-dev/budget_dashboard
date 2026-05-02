import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Annual2025InsightRow, MonthlyProfilePoint } from '@/features/annual-analysis/types'
import { formatCurrency } from '@/features/stats/utils/statsReferenceSelectors'
import { CHART_TOOLTIP_STYLE, getMonthShortLabel } from './_constants'

type Props = {
  insightByKey: Record<string, Annual2025InsightRow>
  monthlyProfile: MonthlyProfilePoint[]
}

export function AnnualSeasonalitySection({ insightByKey, monthlyProfile }: Props) {
  const peakInsight = insightByKey['peak_month']
  const lowInsight = insightByKey['low_month']
  const spreadInsight = insightByKey['seasonality_spread']

  const hasSummary = peakInsight ?? lowInsight ?? spreadInsight
  const hasChart = monthlyProfile.length > 0

  if (!hasSummary && !hasChart) return null

  const chartData = monthlyProfile.map((point) => ({
    label: getMonthShortLabel(point.period_month),
    expense: point.expense_total,
    income: point.income_total,
    savings: point.savings_capacity,
    net: point.net_cashflow,
  }))

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>
        <h2 style={styles.sectionTitle}>Saisonnalité 2025</h2>

        {/* 3 cartes synthèse */}
        {hasSummary ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
            {peakInsight ? (
              <SeasonalityBadge
                label="Mois le plus dépensier"
                value={peakInsight.value_text ?? '—'}
                amount={peakInsight.value_numeric}
                accent="var(--color-error)"
                bg="color-mix(in oklab, var(--color-error) 7%, var(--neutral-0) 93%)"
              />
            ) : null}
            {lowInsight ? (
              <SeasonalityBadge
                label="Mois le plus calme"
                value={lowInsight.value_text ?? '—'}
                amount={lowInsight.value_numeric}
                accent="var(--color-success)"
                bg="color-mix(in oklab, var(--color-success) 7%, var(--neutral-0) 93%)"
              />
            ) : null}
            {spreadInsight ? (
              <SeasonalityBadge
                label="Amplitude annuelle"
                value={spreadInsight.value_text ?? (spreadInsight.value_numeric != null ? formatCurrency(spreadInsight.value_numeric) : '—')}
                amount={null}
                accent="var(--color-warning)"
                bg="color-mix(in oklab, var(--color-warning) 10%, var(--neutral-0) 90%)"
              />
            ) : null}
          </div>
        ) : null}

        {/* Courbe mensuelle */}
        {hasChart ? (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Évolution mensuelle 2025</h3>
            <p style={styles.cardSubtitle}>Revenus, dépenses, épargne et net cashflow mois par mois.</p>
            <div style={{ marginTop: 'var(--space-4)' }}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECECF4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#8F8FA8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#8F8FA8' }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Line
                    type="monotone"
                    dataKey="expense"
                    name="Dépenses"
                    stroke="#FC5A5A"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Revenus"
                    stroke="#2ED47A"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="savings"
                    name="Épargne"
                    stroke="#FFAB2E"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="net"
                    name="Net cashflow"
                    stroke="#5B57F5"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="4 3"
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function SeasonalityBadge({
  label,
  value,
  amount,
  accent,
  bg,
}: {
  label: string
  value: string
  amount: number | null
  accent: string
  bg: string
}) {
  return (
    <div style={{
      background: bg,
      borderRadius: 'var(--radius-xl)',
      border: `1px solid ${accent}`,
      borderTopWidth: 3,
      padding: 'var(--space-4)',
    }}>
      <p style={{
        margin: 0,
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-semibold)',
        color: accent,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label}
      </p>
      <p style={{
        margin: '6px 0 0',
        fontSize: 'var(--font-size-md)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--neutral-900)',
        lineHeight: 1.2,
      }}>
        {value}
      </p>
      {amount != null ? (
        <p style={{
          margin: '4px 0 0',
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-mono)',
          color: 'var(--neutral-600)',
          fontWeight: 'var(--font-weight-semibold)',
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
    padding: 'var(--space-4)',
  } as React.CSSProperties,
  cardTitle: {
    margin: 0,
    fontSize: 'var(--font-size-md)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--neutral-900)',
  } as React.CSSProperties,
  cardSubtitle: {
    margin: '3px 0 0',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--neutral-500)',
  } as React.CSSProperties,
}
