/**
 * Annual2026CategoryRanking
 *
 * Classement 2026 — design plus narratif que le 2025 :
 * - Top catégories parentes avec podium visuel (top 3 mis en avant)
 * - Détail sous-catégories par famille (expandable via click)
 * - Accent sur le coût annuel projeté (×12)
 */
import { useState } from 'react'
import type { Budget2026CategorySummary } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { VIZ_PALETTE } from './_constants'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const fmtPct = (r: number) => `${(r * 100).toFixed(1)}%`

type Props = {
  categories: Budget2026CategorySummary[]
}

export function Annual2026CategoryRanking({ categories }: Props) {
  const [expandedCat, setExpandedCat] = useState<string | null>(null)

  const top3 = categories.slice(0, 3)
  const rest = categories.slice(3, 10)
  const maxAmount = categories[0]?.monthlyBudget ?? 1

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>

        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)' }}>
            Classement des postes
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Familles de dépenses · Budget mensuel · Cliquer pour le détail
          </p>
        </div>

        {/* ── Podium top 3 ── */}
        <div style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
            {top3.map((cat, idx) => {
              const heights = [88, 72, 64]
              const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32']

              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setExpandedCat(expandedCat === cat.name ? null : cat.name)}
                  style={{
                    border: 'none', background: 'transparent', padding: 0,
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{
                    background: `color-mix(in oklab, ${cat.color} 10%, var(--neutral-0) 90%)`,
                    border: expandedCat === cat.name
                      ? `2px solid ${cat.color}`
                      : `1px solid color-mix(in oklab, ${cat.color} 25%, var(--neutral-150) 75%)`,
                    borderRadius: 'var(--radius-xl)',
                    padding: 'var(--space-3)',
                    minHeight: heights[idx],
                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                    gap: 4,
                    transition: 'border-color 0.2s',
                  }}>
                    {/* Médaille */}
                    <span style={{
                      fontSize: 16, fontWeight: 900, fontFamily: 'var(--font-mono)',
                      color: medalColors[idx],
                      lineHeight: 1,
                    }}>
                      #{idx + 1}
                    </span>

                    <p style={{
                      margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-700)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {cat.name}
                    </p>
                    <p style={{
                      margin: 0, fontSize: idx === 0 ? 15 : 13, fontWeight: 800,
                      fontFamily: 'var(--font-mono)', color: cat.color, lineHeight: 1.1,
                    }}>
                      {fmt(cat.monthlyBudget)}
                    </p>
                    <p style={{ margin: 0, fontSize: 9, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}>
                      {fmtPct(cat.pctOfTotal)} · {fmt(cat.monthlyBudget * 12)}/an
                    </p>
                  </div>

                  {/* Détail expandable */}
                  {expandedCat === cat.name ? (
                    <div style={{
                      marginTop: 'var(--space-2)',
                      background: 'var(--neutral-50)',
                      borderRadius: 'var(--radius-lg)',
                      border: `1px solid ${cat.color}30`,
                      padding: 'var(--space-3)',
                      display: 'grid', gap: 'var(--space-2)',
                    }}>
                      {cat.lines.map((line) => (
                        <div key={line.category_name} style={{
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'baseline', gap: 8,
                        }}>
                          <span style={{ fontSize: 10, color: 'var(--neutral-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {line.category_name}
                          </span>
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--neutral-800)', fontWeight: 600, flexShrink: 0 }}>
                            {fmt(line.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Reste du classement ── */}
        {rest.length > 0 ? (
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Postes suivants
            </h3>
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              {rest.map((cat, i) => (
                <RankRow
                  key={cat.name}
                  cat={cat}
                  rank={i + 4}
                  maxAmount={maxAmount}
                  isExpanded={expandedCat === cat.name}
                  onToggle={() => setExpandedCat(expandedCat === cat.name ? null : cat.name)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* ── Insight coût annuel ── */}
        <AnnualProjectionCard categories={categories.slice(0, 5)} />
      </div>
    </section>
  )
}

// ── Rank Row ──────────────────────────────────────────────────────────────────

function RankRow({
  cat, rank, maxAmount, isExpanded, onToggle,
}: {
  cat: Budget2026CategorySummary
  rank: number
  maxAmount: number
  isExpanded: boolean
  onToggle: () => void
}) {
  const barPct = maxAmount > 0 ? (cat.monthlyBudget / maxAmount) * 100 : 0
  const color = VIZ_PALETTE[(rank - 1) % VIZ_PALETTE.length] ?? '#B0BEC5'

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', width: '100%', textAlign: 'left' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr auto auto', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
            {rank}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cat.name}
          </span>
          <span style={{ fontSize: 11, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap' }}>
            {fmtPct(cat.pctOfTotal)}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', textAlign: 'right', whiteSpace: 'nowrap', minWidth: 66 }}>
            {fmt(cat.monthlyBudget)}
          </span>
        </div>
        <div style={{ marginTop: 5, marginLeft: 32, height: 3, borderRadius: 2, background: 'var(--neutral-100)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${barPct.toFixed(1)}%`, background: color, borderRadius: 2 }} />
        </div>
      </button>

      {isExpanded ? (
        <div style={{
          marginTop: 'var(--space-2)', marginLeft: 32,
          background: 'var(--neutral-50)', borderRadius: 'var(--radius-lg)',
          border: `1px solid ${color}30`,
          padding: 'var(--space-2) var(--space-3)',
          display: 'grid', gap: 'var(--space-1)',
        }}>
          {cat.lines.map((line) => (
            <div key={line.category_name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--neutral-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {line.category_name}
              </span>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--neutral-700)', flexShrink: 0 }}>
                {fmt(line.amount)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ── Annual projection card ────────────────────────────────────────────────────

function AnnualProjectionCard({ categories }: { categories: Budget2026CategorySummary[] }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(91,87,245,0.06) 0%, rgba(76,201,240,0.06) 100%)',
      borderRadius: 'var(--radius-2xl)',
      border: '1px solid color-mix(in oklab, var(--primary-600) 15%, var(--neutral-150) 85%)',
      padding: 'var(--space-5)',
    }}>
      <h3 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--primary-600)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        Projection coût annuel — top postes
      </h3>
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        {categories.map((cat) => (
          <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--neutral-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cat.name}
              </span>
            </div>
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                {fmt(cat.monthlyBudget * 12)}
              </span>
              <span style={{ fontSize: 10, color: 'var(--neutral-400)', marginLeft: 4 }}>/an</span>
            </div>
          </div>
        ))}
      </div>
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
