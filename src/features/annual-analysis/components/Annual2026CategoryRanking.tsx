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

  const maxAmount = categories[0]?.monthlyBudget ?? 1

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>

        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>allocation par catégorie</h3>
          <p style={cardSubStyle}>Budget mensuel · Cliquer pour le détail</p>
          
          <div style={{ display: 'grid', gap: 'var(--space-2)', marginTop: 'var(--space-5)' }}>
            {categories.slice(0, 10).map((cat, i) => (
              <RankRow
                key={cat.name}
                cat={cat}
                rank={i + 1}
                maxAmount={maxAmount}
                isExpanded={expandedCat === cat.name}
                onToggle={() => setExpandedCat(expandedCat === cat.name ? null : cat.name)}
              />
            ))}
          </div>
        </div>
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

import { BarChart, Bar, XAxis, ResponsiveContainer, Cell, LabelList } from 'recharts'

export function AnnualProjectionCard({ categories }: { categories: Budget2026CategorySummary[] }) {
  const data = categories.slice(0, 7).map(cat => ({
    name: cat.name,
    amount: cat.monthlyBudget * 12,
    color: cat.color
  }))

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Projection coûts annuels</h3>
          <p style={cardSubStyle}>top 7 postes</p>

          <div style={{ height: 260, width: '100%', marginTop: 'var(--space-6)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 30, right: 0, left: 0, bottom: 40 }}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  interval={0}
                  tick={<CustomTick />}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={32}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                  ))}
                  <LabelList 
                    dataKey="amount" 
                    position="top" 
                    offset={10}
                    formatter={(val: number) => `${Math.round(val).toLocaleString('fr-FR')}€`}
                    style={{ fontSize: 10, fontWeight: 700, fill: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  )
}

function CustomTick(props: any) {
  const { x, y, payload } = props
  const rawValue = payload.value
  // Tronquer si trop long pour éviter le chevauchement (approx 9-10 chars par mot)
  const truncate = (str: string) => str.length > 9 ? str.substring(0, 8) + '…' : str
  const words = rawValue.split(' ').map(truncate)

  return (
    <g transform={`translate(${x},${y + 12})`}>
      {words.map((word: string, i: number) => (
        <text
          key={i}
          x={0}
          y={i * 11}
          textAnchor="middle"
          fill="var(--neutral-500)"
          style={{ fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-sans)' }}
        >
          {word}
        </text>
      ))}
    </g>
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
