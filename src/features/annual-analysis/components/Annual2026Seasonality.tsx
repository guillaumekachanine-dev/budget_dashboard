/**
 * Annual2026Seasonality
 *
 * Saisonnalité YTD 2026 (Jan–Mai).
 * Angle : chart à barres empilées (buckets) par mois + ligne "besoin total"
 * → plus informatif que le area chart 2025, montre la décomposition structurelle
 * + une section "cadence mensuelle" avec 3 KPIs narratifs.
 */
import {
  Bar,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyBudget2026Point } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { BUCKET_COLORS, BUCKET_LABELS, BUCKET_ORDER, CHART_TOOLTIP_STYLE } from './_constants'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

type Props = {
  monthlyProfile: MonthlyBudget2026Point[]
}

export function Annual2026Seasonality({ monthlyProfile }: Props) {
  if (monthlyProfile.length === 0) return null

  // Buckets présents dans les données
  const activeBuckets = BUCKET_ORDER.filter((key) =>
    monthlyProfile.some((p) => (p.buckets[key] ?? 0) > 0),
  )

  // Données pour le chart
  const chartData = monthlyProfile.map((p) => ({
    label: p.monthLabel,
    totalNeed: p.totalNeed,
    ...Object.fromEntries(activeBuckets.map((key) => [key, p.buckets[key] ?? 0])),
  }))

  // Statistiques cadence
  const totals = monthlyProfile.map((p) => p.totalExpenseBudget)
  const maxMonth = monthlyProfile.reduce((m, p) => p.totalExpenseBudget > m.totalExpenseBudget ? p : m, monthlyProfile[0]!)
  const minMonth = monthlyProfile.reduce((m, p) => p.totalExpenseBudget < m.totalExpenseBudget ? p : m, monthlyProfile[0]!)
  const avgExpense = totals.reduce((s, v) => s + v, 0) / totals.length
  const spread = maxMonth.totalExpenseBudget - minMonth.totalExpenseBudget

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>

        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)' }}>
            Saisonnalité 2026 YTD
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Décomposition mensuelle · Jan – Mai · Budget planifié
          </p>
        </div>

        {/* ── Cadence KPIs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
          <SeasonKpi label="Mois le plus chargé" value={maxMonth.monthLabel} amount={maxMonth.totalExpenseBudget} color="#FC5A5A" />
          <SeasonKpi label="Mois le plus calme" value={minMonth.monthLabel} amount={minMonth.totalExpenseBudget} color="#2ED47A" />
          <SeasonKpi label="Amplitude YTD" value={fmt(spread)} amount={null} color="#FFAB2E" />
        </div>

        {/* ── Chart ── */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Décomposition budget par mois</h3>
          <p style={cardSubStyle}>Buckets empilés · Ligne = besoin total (dépenses + épargne)</p>

          <div style={{ marginTop: 'var(--space-5)' }}>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-100)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}
                  axisLine={false} tickLine={false}
                  width={42}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: number, name: string) => {
                    const label = name === 'totalNeed' ? 'Besoin total' : (BUCKET_LABELS[name] ?? name)
                    return [fmt(value), label]
                  }}
                  cursor={{ fill: 'rgba(91,87,245,0.04)' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10, paddingTop: 14, fontFamily: 'var(--font-mono)', color: 'var(--neutral-500)' }}
                  iconType="circle" iconSize={6}
                  formatter={(value: string) => value === 'totalNeed' ? 'Besoin total' : (BUCKET_LABELS[value] ?? value)}
                />

                {/* Barres empilées */}
                {activeBuckets.map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="budget"
                    fill={BUCKET_COLORS[key] ?? '#B0BEC5'}
                    radius={key === activeBuckets[activeBuckets.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}

                {/* Ligne besoin total */}
                <Line
                  type="monotone"
                  dataKey="totalNeed"
                  stroke="#1A1730"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={{ fill: '#1A1730', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Tableau mensuel synthétique ── */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Vue mensuelle synthétique</h3>
          <p style={cardSubStyle}>Budget dépenses · Épargne · Besoin total</p>

          <div style={{ marginTop: 'var(--space-4)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Mois</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Dépenses</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Épargne</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Besoin total</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>vs moy.</th>
                </tr>
              </thead>
              <tbody>
                {monthlyProfile.map((p) => {
                  const delta = p.totalExpenseBudget - avgExpense
                  const isAbove = delta > 0
                  return (
                    <tr key={p.month} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 600, color: 'var(--neutral-700)' }}>{p.monthLabel}</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--neutral-900)' }}>
                        {fmt(p.totalExpenseBudget)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#2ED47A' }}>
                        {fmt(500)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-900)' }}>
                        {fmt(p.totalNeed)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', color: isAbove ? '#FC5A5A' : '#2ED47A', fontWeight: 600 }}>
                        {isAbove ? '+' : ''}{fmt(delta)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Season KPI ────────────────────────────────────────────────────────────────

function SeasonKpi({ label, value, amount, color }: { label: string; value: string; amount: number | null; color: string }) {
  return (
    <div style={{
      background: `color-mix(in oklab, ${color} 6%, var(--neutral-0) 94%)`,
      borderRadius: 'var(--radius-xl)',
      border: `1px solid color-mix(in oklab, ${color} 20%, transparent 80%)`,
      borderTopWidth: 3, borderTopColor: color,
      padding: 'var(--space-3)',
    }}>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--neutral-900)', lineHeight: 1.2 }}>
        {value}
      </p>
      {amount != null ? (
        <p style={{ margin: '2px 0 0', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--neutral-500)', fontWeight: 600 }}>
          {fmt(amount)}
        </p>
      ) : null}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--neutral-0)',
  borderRadius: 'var(--radius-2xl)',
  boxShadow: 'var(--shadow-card)',
  border: '1px solid var(--neutral-150)',
  padding: 'var(--space-5)',
}

const cardTitleStyle: React.CSSProperties = {
  margin: 0, fontSize: 'var(--font-size-base)',
  fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)',
}

const cardSubStyle: React.CSSProperties = {
  margin: '3px 0 0', fontSize: 'var(--font-size-xs)',
  color: 'var(--neutral-400)', textTransform: 'uppercase',
  letterSpacing: '0.05em', fontWeight: 600,
}

const thStyle: React.CSSProperties = {
  padding: '8px 4px', textAlign: 'left', fontSize: 10,
  fontWeight: 700, color: 'var(--neutral-500)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '2px solid var(--neutral-150)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '9px 4px', fontSize: 12, color: 'var(--neutral-700)',
  verticalAlign: 'middle',
}
