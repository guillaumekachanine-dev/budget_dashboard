/**
 * Annual2026BudgetDNA
 *
 * Angle original : le "génome budgétaire".
 * On affiche la structure des dépenses non pas sous forme de donut répétitif
 * mais via deux vues complémentaires :
 *  1. Une barre d'allocation animée (bucket level) + légende enrichie
 *  2. Un treemap-style inline par famille de catégories (tiles proportionnelles)
 *
 * Pas de dépendances recharts, tout en CSS pur → 0 overhead.
 */
import type { Budget2026BucketSummary, Budget2026CategorySummary } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const fmtPct = (r: number) => `${(r * 100).toFixed(1)}%`

type Props = {
  buckets: Budget2026BucketSummary[]
  categories: Budget2026CategorySummary[]
  totalMonthly: number
}

export function Annual2026BudgetDNA({ buckets, categories, totalMonthly }: Props) {
  const sortedBuckets = [...buckets].sort((a, b) => b.monthlyBudget - a.monthlyBudget)
  void categories

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>


        {/* ── 1. Barre d'allocation ── */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Allocation par bloc budgétaire</h3>
          <p style={cardSubStyle}>budget mensuel</p>

          {/* Barre stacked */}
          <div style={{
            marginTop: 'var(--space-5)',
            display: 'flex', height: 18,
            borderRadius: 9, overflow: 'hidden', gap: 2,
          }}>
            {sortedBuckets.map((b) => (
              <div
                key={b.key}
                title={`${b.label} — ${fmtPct(b.pctOfTotal)} — ${fmt(b.monthlyBudget)}/mois`}
                style={{
                  flex: b.pctOfTotal,
                  background: b.color,
                  minWidth: b.pctOfTotal > 0.02 ? 3 : 0,
                  transition: 'flex 0.5s ease',
                  position: 'relative',
                }}
              />
            ))}
          </div>

          {/* Légende enrichie */}
          <div style={{ marginTop: 'var(--space-4)', display: 'grid', gap: 'var(--space-2)' }}>
            {sortedBuckets.map((b) => (
              <BucketLegendRow key={b.key} bucket={b} totalMonthly={totalMonthly} />
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}

// ── Bucket Legend Row ─────────────────────────────────────────────────────────

function BucketLegendRow({ bucket, totalMonthly }: { bucket: Budget2026BucketSummary; totalMonthly: number }) {
  const barPct = totalMonthly > 0 ? (bucket.monthlyBudget / totalMonthly) * 100 : 0

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '12px 1fr auto auto auto',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ width: 12, height: 12, borderRadius: 3, background: bucket.color, flexShrink: 0, display: 'block' }} />

        <span style={{ fontSize: 12, color: 'var(--neutral-800)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {bucket.label}
        </span>

        <span style={{ fontSize: 10, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
          {bucket.lineCount} poste{bucket.lineCount > 1 ? 's' : ''}
        </span>

        <span style={{ fontSize: 11, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)', textAlign: 'right', minWidth: 38 }}>
          {fmtPct(bucket.pctOfTotal)}
        </span>

        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-900)', textAlign: 'right', minWidth: 66, whiteSpace: 'nowrap' }}>
          {fmt(bucket.monthlyBudget)}
        </span>
      </div>

      {/* Mini barre inline */}
      <div style={{ marginTop: 4, marginLeft: 20, height: 3, borderRadius: 2, background: 'var(--neutral-100)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${barPct.toFixed(1)}%`, background: bucket.color, borderRadius: 2 }} />
      </div>
    </div>
  )
}

// ── Category Tile ─────────────────────────────────────────────────────────────

// ── Styles partagés ───────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--neutral-0)',
  borderRadius: 'var(--radius-2xl)',
  boxShadow: 'var(--shadow-card)',
  border: '1px solid var(--neutral-150)',
  padding: 'var(--space-5)',
}

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--font-size-base)',
  fontWeight: 'var(--font-weight-bold)',
  color: 'var(--neutral-900)',
}

const cardSubStyle: React.CSSProperties = {
  margin: '3px 0 0',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--neutral-400)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 600,
}
