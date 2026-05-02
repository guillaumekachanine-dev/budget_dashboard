import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Annual2025YearlyBucketRow, Annual2025YearlyCategoryRow } from '@/features/annual-analysis/types'
import { formatCurrencyRounded as formatCurrency } from '@/lib/utils'
import {
  BUCKET_COLORS,
  BUCKET_LABELS,
  BUCKET_ORDER,
  CHART_TOOLTIP_STYLE,
  VIZ_PALETTE,
  formatPct,
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
    key:   row.budget_bucket,
    name:  BUCKET_LABELS[row.budget_bucket] ?? row.budget_bucket,
    value: row.amount_total_year,
    pct:   row.share_of_year_expense_pct ?? 0,
    color: BUCKET_COLORS[row.budget_bucket] ?? '#B0BEC5',
  }))

  const categoryChartData = [...parentCategories]
    .sort((a, b) => b.amount_total_year - a.amount_total_year)
    .slice(0, 8)
    .map((row, i) => ({
      key:   row.category_name,
      name:  row.category_name,
      value: row.amount_total_year,
      pct:   row.share_of_year_expense_pct,
      color: VIZ_PALETTE[i % VIZ_PALETTE.length] ?? '#B0BEC5',
    }))

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2 style={styles.sectionTitle}>Structure des dépenses</h2>
        <div style={{ display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>

          {/* Stacked allocation bar — lecture immédiate des buckets */}
          {bucketChartData.length > 0 ? (
            <BucketAllocationBar data={bucketChartData} />
          ) : null}

          <DonutCard
            title="Par bloc budgétaire"
            subtitle="Répartition annuelle par bucket"
            data={bucketChartData}
          />
          <DonutCard
            title="Par famille de dépenses"
            subtitle="Top 8 catégories — 2025"
            data={categoryChartData}
          />
        </div>
      </div>
    </section>
  )
}

// ─── Stacked bar ──────────────────────────────────────────────────────────────

type BarEntry = { key: string; name: string; value: number; pct: number; color: string }

function BucketAllocationBar({ data }: { data: BarEntry[] }) {
  const sorted = [...data].sort((a, b) => b.pct - a.pct)

  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Allocation budgétaire</h3>
      <p style={styles.cardSubtitle}>Répartition de chaque euro dépensé en 2025</p>

      {/* Bar */}
      <div style={{
        marginTop: 'var(--space-4)',
        display: 'flex',
        height: 14,
        borderRadius: 7,
        overflow: 'hidden',
        gap: 1,
      }}>
        {sorted.map((entry) => (
          <div
            key={entry.key}
            title={`${entry.name} — ${formatPct(entry.pct)}%`}
            style={{
              flex: entry.pct,
              background: entry.color,
              minWidth: entry.pct > 0.02 ? 2 : 0,
              transition: 'flex 0.4s ease',
            }}
          />
        ))}
      </div>

      {/* Labels */}
      <div style={{ marginTop: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
        {sorted.map((entry) => (
          <div key={entry.key} style={{
            display: 'grid',
            gridTemplateColumns: '10px 1fr auto auto',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{
              width: 10, height: 10,
              borderRadius: 2,
              background: entry.color,
              display: 'block',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--neutral-700)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {entry.name}
            </span>
            <span style={{
              fontSize: 'var(--font-size-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--neutral-400)',
              whiteSpace: 'nowrap',
              textAlign: 'right',
              minWidth: 36,
            }}>
              {formatPct(entry.pct)}%
            </span>
            <span style={{
              fontSize: 'var(--font-size-xs)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: 'var(--neutral-800)',
              whiteSpace: 'nowrap',
              textAlign: 'right',
              minWidth: 64,
            }}>
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Donut card ───────────────────────────────────────────────────────────────

type DonutEntry = { key: string; name: string; value: number; pct: number; color: string }

function DonutCard({ title, subtitle, data }: { title: string; subtitle: string; data: DonutEntry[] }) {
  if (data.length === 0) {
    return (
      <div style={styles.card}>
        <CardHeader title={title} subtitle={subtitle} />
        <p style={styles.empty}>Aucune donnée disponible.</p>
      </div>
    )
  }

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div style={styles.card}>
      <CardHeader title={title} subtitle={subtitle} />
      <div style={{
        marginTop: 'var(--space-5)',
        display: 'grid',
        gridTemplateColumns: '160px 1fr',
        gap: 'var(--space-5)',
        alignItems: 'center',
      }}>
        {/* Donut */}
        <div style={{ position: 'relative' }}>
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                cx="50%" cy="50%"
                innerRadius={48} outerRadius={72}
                paddingAngle={2}
                startAngle={90} endAngle={-270}
              >
                {data.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 10, color: 'var(--neutral-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              total
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-800)', marginTop: 2 }}>
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* Légende */}
        <div style={{ display: 'grid', gap: 'var(--space-2)', overflow: 'hidden' }}>
          {data.map((entry) => (
            <LegendRow key={entry.key} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  )
}

function LegendRow({ entry }: { entry: DonutEntry }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '8px 1fr auto auto', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: entry.color, flexShrink: 0, display: 'block' }} />
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {entry.name}
      </span>
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', textAlign: 'right', minWidth: 34 }}>
        {formatPct(entry.pct)}%
      </span>
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-800)', fontFamily: 'var(--font-mono)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right', minWidth: 64 }}>
        {formatCurrency(entry.value)}
      </span>
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
    padding: 'var(--space-5)',
  } as React.CSSProperties,
  cardTitle: {
    margin: 0,
    fontSize: 'var(--font-size-base)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--neutral-900)',
  } as React.CSSProperties,
  cardSubtitle: {
    margin: '3px 0 0',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--neutral-400)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontWeight: 600,
  } as React.CSSProperties,
  empty: {
    margin: 'var(--space-4) 0 0',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--neutral-400)',
  } as React.CSSProperties,
}
