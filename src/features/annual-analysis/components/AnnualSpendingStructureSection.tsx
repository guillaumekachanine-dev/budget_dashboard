import type { Annual2025YearlyBucketRow } from '@/features/annual-analysis/types'
import { formatCurrencyRounded as formatCurrency } from '@/lib/utils'
import {
  BUCKET_COLORS,
  BUCKET_LABELS,
  BUCKET_ORDER,
  formatPct,
} from './_constants'

type Props = {
  buckets: Annual2025YearlyBucketRow[]
}

export function AnnualSpendingStructureSection({ buckets }: Props) {
  const orderedBuckets = BUCKET_ORDER as readonly string[]
  const sortedBuckets = [...buckets].sort((a, b) => {
    const ia = orderedBuckets.indexOf(a.budget_bucket)
    const ib = orderedBuckets.indexOf(b.budget_bucket)
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

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2 style={styles.sectionTitle}>Structure des dépenses</h2>
        <div style={{ display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>

          {/* Stacked allocation bar — lecture immédiate des buckets */}
          {bucketChartData.length > 0 ? (
            <BucketAllocationBar data={bucketChartData} />
          ) : null}
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
}
