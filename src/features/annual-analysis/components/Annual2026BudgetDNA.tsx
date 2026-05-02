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
  const top8Cats = categories.slice(0, 9)

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>

        {/* Titre section */}
        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)' }}>
            Anatomie du budget
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Structure des dépenses 2026 · {fmt(totalMonthly)} / mois
          </p>
        </div>

        {/* ── 1. Barre d'allocation ── */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Allocation par bloc budgétaire</h3>
          <p style={cardSubStyle}>Chaque euro planifié, réparti par nature de dépense</p>

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

        {/* ── 2. Treemap tiles catégories ── */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Carte des familles de dépenses</h3>
          <p style={cardSubStyle}>Superficie proportionnelle au budget mensuel alloué</p>

          <div style={{
            marginTop: 'var(--space-4)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--space-2)',
          }}>
            {top8Cats.map((cat, i) => (
              <CategoryTile key={cat.name} cat={cat} index={i} />
            ))}
          </div>
        </div>

        {/* ── 3. Rigidité / flexibilité ── */}
        <FlexibilityMeter buckets={buckets} totalMonthly={totalMonthly} />
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

const TILE_OPACITY = [1, 0.92, 0.84, 0.78, 0.72, 0.68, 0.64, 0.60, 0.56]

function CategoryTile({ cat, index }: { cat: Budget2026CategorySummary; index: number }) {
  const opacity = TILE_OPACITY[index] ?? 0.55

  return (
    <div style={{
      background: `color-mix(in oklab, ${cat.color} ${Math.round(opacity * 14)}%, var(--neutral-0) ${100 - Math.round(opacity * 14)}%)`,
      border: `1px solid color-mix(in oklab, ${cat.color} ${Math.round(opacity * 30)}%, transparent)`,
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-3)',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minWidth: 0,
      // La taille est uniforme dans la grid, mais on utilise une typo plus grande
      // pour les tops pour créer une hiérarchie visuelle
    }}>
      <p style={{
        margin: 0,
        fontSize: index < 3 ? 13 : 11,
        fontWeight: 700,
        color: 'var(--neutral-800)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}>
        {cat.name}
      </p>
      <p style={{
        margin: 0,
        fontSize: index < 3 ? 14 : 12,
        fontWeight: 800,
        fontFamily: 'var(--font-mono)',
        color: cat.color,
        lineHeight: 1,
      }}>
        {fmt(cat.monthlyBudget)}
      </p>
      <p style={{
        margin: 0,
        fontSize: 9,
        color: 'var(--neutral-500)',
        fontFamily: 'var(--font-mono)',
      }}>
        {fmtPct(cat.pctOfTotal)}
      </p>
    </div>
  )
}

// ── Flexibility Meter ─────────────────────────────────────────────────────────
// Angle original : on mesure la "rigidité structurelle" du budget

function FlexibilityMeter({ buckets, totalMonthly }: { buckets: Budget2026BucketSummary[]; totalMonthly: number }) {
  const rigidKeys = ['socle_fixe', 'variable_essentielle']
  const flexKeys = ['discretionnaire', 'cagnotte_projet', 'provision']

  const rigidTotal = buckets.filter((b) => rigidKeys.includes(b.key)).reduce((s, b) => s + b.monthlyBudget, 0)
  const flexTotal = buckets.filter((b) => flexKeys.includes((b.key))).reduce((s, b) => s + b.monthlyBudget, 0)
  const rigidPct = totalMonthly > 0 ? (rigidTotal / totalMonthly) * 100 : 0
  const flexPct = totalMonthly > 0 ? (flexTotal / totalMonthly) * 100 : 0

  const rigidityScore = Math.round(rigidPct)
  const scoreLabel = rigidityScore >= 55 ? 'Budget rigide' : rigidityScore >= 40 ? 'Équilibré' : 'Budget flexible'
  const scoreColor = rigidityScore >= 55 ? '#FFAB2E' : rigidityScore >= 40 ? '#5B57F5' : '#2ED47A'

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <div>
          <h3 style={cardTitleStyle}>Indice de rigidité budgétaire</h3>
          <p style={cardSubStyle}>Charges non pilotables vs dépenses activement maîtrisables</p>
        </div>
        <div style={{
          flexShrink: 0,
          background: `color-mix(in oklab, ${scoreColor} 12%, var(--neutral-0) 88%)`,
          border: `1px solid color-mix(in oklab, ${scoreColor} 30%, transparent)`,
          borderRadius: 'var(--radius-lg)',
          padding: '6px 12px',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: scoreColor, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {scoreLabel}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: scoreColor, lineHeight: 1 }}>
            {rigidityScore}%
          </p>
        </div>
      </div>

      {/* Barre bicolore */}
      <div style={{ marginTop: 'var(--space-4)', height: 12, borderRadius: 6, overflow: 'hidden', display: 'flex', gap: 2 }}>
        <div style={{ flex: rigidPct, background: '#FFAB2E', borderRadius: '6px 0 0 6px', minWidth: 0 }} />
        <div style={{ flex: flexPct, background: '#2ED47A', borderRadius: '0 6px 6px 0', minWidth: 0 }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FFAB2E', display: 'block' }} />
          <span style={{ fontSize: 11, color: 'var(--neutral-600)', fontWeight: 500 }}>Rigide · {fmt(rigidTotal)}/mois</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--neutral-600)', fontWeight: 500 }}>Piloté · {fmt(flexTotal)}/mois</span>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#2ED47A', display: 'block' }} />
        </div>
      </div>
    </div>
  )
}

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
