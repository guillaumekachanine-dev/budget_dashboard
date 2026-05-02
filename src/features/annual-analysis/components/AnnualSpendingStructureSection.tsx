import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Annual2025YearlyBucketRow, Annual2025YearlyCategoryRow } from '@/features/annual-analysis/types'
import { formatCurrency } from '@/features/stats/utils/statsReferenceSelectors'
import {
  BUCKET_COLORS,
  BUCKET_LABELS,
  BUCKET_ORDER,
  CHART_TOOLTIP_STYLE,
  VIZ_PALETTE,
} from './_constants'

type Props = {
  buckets: Annual2025YearlyBucketRow[]
  parentCategories: Annual2025YearlyCategoryRow[]
}

export function AnnualSpendingStructureSection({ buckets, parentCategories }: Props) {
  const sortedBuckets = [...buckets].sort((a, b) => {
    const ia = BUCKET_ORDER.indexOf(a.budget_bucket)
    const ib = BUCKET_ORDER.indexOf(b.budget_bucket)
    if (ia === -1 && ib === -1) return b.amount_total_year - a.amount_total_year
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  const bucketChartData = sortedBuckets.map((row) => ({
    name: BUCKET_LABELS[row.budget_bucket] ?? row.budget_bucket,
    value: row.amount_total_year,
    pct: row.share_of_year_expense_pct ?? 0,
    color: BUCKET_COLORS[row.budget_bucket] ?? '#B0BEC5',
  }))

  const categoryChartData = parentCategories.slice(0, 8).map((row, i) => ({
    name: row.category_name,
    value: row.amount_total_year,
    pct: row.share_of_year_expense_pct,
    color: VIZ_PALETTE[i % VIZ_PALETTE.length] ?? '#B0BEC5',
  }))

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2 style={styles.sectionTitle}>Structure des dépenses</h2>
        <div style={{ display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
          <DonutCard title="Par bloc budgétaire" subtitle="Répartition annuelle par bucket" data={bucketChartData} />
          <DonutCard title="Par catégorie" subtitle="Top familles de dépenses 2025" data={categoryChartData} />
        </div>
      </div>
    </section>
  )
}

type DonutEntry = {
  name: string
  value: number
  pct: number
  color: string
}

function DonutCard({ title, subtitle, data }: { title: string; subtitle: string; data: DonutEntry[] }) {
  if (data.length === 0) {
    return (
      <div style={styles.card}>
        <CardHeader title={title} subtitle={subtitle} />
        <p style={styles.empty}>Aucune donnée disponible.</p>
      </div>
    )
  }

  return (
    <div style={styles.card}>
      <CardHeader title={title} subtitle={subtitle} />
      <div style={{ marginTop: 'var(--space-4)', display: 'grid', gap: 'var(--space-4)' }}>
        {/* Donut */}
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={54}
              outerRadius={84}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [formatCurrency(value), name]}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Légende */}
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          {data.map((entry) => (
            <div key={entry.name} style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto auto',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}>
              <span style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: 'var(--radius-xs)',
                background: entry.color,
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--neutral-700)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {entry.name}
              </span>
              <span style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--neutral-400)',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                textAlign: 'right',
              }}>
                {entry.pct.toFixed(1)}%
              </span>
              <span style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--neutral-900)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 'var(--font-weight-semibold)',
                whiteSpace: 'nowrap',
                textAlign: 'right',
                minWidth: 72,
              }}>
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h3 style={styles.cardTitle}>{title}</h3>
      <p style={styles.cardSubtitle}>{subtitle}</p>
    </>
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
  empty: {
    margin: 'var(--space-4) 0 0',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--neutral-400)',
  } as React.CSSProperties,
}
