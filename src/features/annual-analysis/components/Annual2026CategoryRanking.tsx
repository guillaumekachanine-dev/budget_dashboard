/**
 * Annual2026CategoryRanking
 *
 * Classement 2026 — design plus narratif que le 2025 :
 * - Top catégories parentes avec podium visuel (top 3 mis en avant)
 * - Détail sous-catégories par famille (expandable via click)
 * - Accent sur le coût annuel projeté (×12)
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { CalendarDays, LayoutGrid } from 'lucide-react'
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell, LabelList } from 'recharts'
import type { Budget2026CategorySummary } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { VIZ_PALETTE } from './_constants'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const fmtPct = (r: number) => `${(r * 100).toFixed(1)}%`

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

type Props = {
  categories: Budget2026CategorySummary[]
}

type ProjectionViewMode = 'category' | 'year'

type CategoryProjectionPoint = {
  name: string
  amount: number
  color: string
}

type YearProjectionPoint = {
  name: string
  amount: number
}

export function Annual2026CategoryRanking({ categories }: Props) {
  const [expandedCat, setExpandedCat] = useState<string | null>(null)

  const maxAmount = categories[0]?.monthlyBudget ?? 1

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>allocation par catégorie</h3>
          <p style={cardSubStyle}>Budget mensuel</p>

          {/* Barre stacked (même design que "allocation par bloc") */}
          <div style={{
            marginTop: 'var(--space-5)',
            display: 'flex',
            height: 18,
            borderRadius: 9,
            overflow: 'hidden',
            gap: 2,
          }}>
            {categories.map((cat) => (
              <div
                key={`share-${cat.name}`}
                title={`${cat.name} — ${fmtPct(cat.pctOfTotal)} — ${fmt(cat.monthlyBudget)}/mois`}
                style={{
                  flex: cat.pctOfTotal,
                  background: cat.color,
                  minWidth: cat.pctOfTotal > 0.02 ? 3 : 0,
                  transition: 'flex 0.5s ease',
                  position: 'relative',
                }}
              />
            ))}
          </div>

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
        <div style={{ display: 'grid', gridTemplateColumns: '14px 1fr auto auto auto', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: 'var(--font-mono)', textAlign: 'left' }}>
            {rank}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cat.name}
          </span>
          <span style={{ fontSize: 10, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
            {cat.lines.length} poste{cat.lines.length > 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 11, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap' }}>
            {fmtPct(cat.pctOfTotal)}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', textAlign: 'right', whiteSpace: 'nowrap', minWidth: 66 }}>
            {fmt(cat.monthlyBudget)}
          </span>
        </div>
        <div style={{ marginTop: 5, marginLeft: 0, height: 3, borderRadius: 2, background: 'var(--neutral-100)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${barPct.toFixed(1)}%`, background: color, borderRadius: 2 }} />
        </div>
      </button>

      {isExpanded ? (
        <div style={{
          marginTop: 'var(--space-2)', marginLeft: 0,
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

export function AnnualProjectionCard({ categories }: { categories: Budget2026CategorySummary[] }) {
  const [viewMode, setViewMode] = useState<ProjectionViewMode>('category')

  const categoryData = useMemo<CategoryProjectionPoint[]>(
    () => categories.slice(0, 7).map((cat) => ({
      name: cat.name,
      amount: cat.monthlyBudget * 12,
      color: cat.color,
    })),
    [categories],
  )

  const annualMonthlyProjection = useMemo<YearProjectionPoint[]>(() => {
    const monthlyTotal = categories.reduce((total, cat) => total + Number(cat.monthlyBudget ?? 0), 0)
    const currentMonthIndex = Math.max(0, Math.min(11, new Date().getMonth()))

    return MONTH_LABELS
      .slice(currentMonthIndex)
      .map((label, idx) => ({
        name: label,
        amount: Math.round(monthlyTotal * (1 + idx * 0.015)),
      }))
  }, [categories])

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <div>
              <h3 style={cardTitleStyle}>Projection coûts annuels</h3>
              <p style={cardSubStyle}>
                {viewMode === 'category' ? 'top 7 postes' : 'projection mensuelle totale'}
              </p>
            </div>

            <div style={switchStyle} role="tablist" aria-label="Mode de projection">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'category'}
                onClick={() => setViewMode('category')}
                style={{
                  ...switchButtonStyle,
                  ...(viewMode === 'category' ? switchButtonActiveStyle : null),
                }}
              >
                <LayoutGrid size={14} color={viewMode === 'category' ? 'var(--primary-600)' : 'var(--neutral-500)'} />
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'year'}
                onClick={() => setViewMode('year')}
                style={{
                  ...switchButtonStyle,
                  ...(viewMode === 'year' ? switchButtonActiveStyle : null),
                }}
              >
                <CalendarDays size={14} color={viewMode === 'year' ? 'var(--primary-600)' : 'var(--neutral-500)'} />
              </button>
            </div>
          </div>

          <div style={{ height: 260, width: '100%', marginTop: 'var(--space-6)' }}>
            {viewMode === 'category' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 30, right: 0, left: 0, bottom: 40 }}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    tick={<CustomTick />}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={32}>
                    {categoryData.map((entry, index) => (
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
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={annualMonthlyProjection} margin={{ top: 30, right: 0, left: 0, bottom: 12 }}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'var(--neutral-500)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={28} fill="var(--primary-500)" fillOpacity={0.85}>
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
            )}
          </div>

          {viewMode === 'year' ? (
            <p style={projectionHintStyle}>
              Vue provisoire: projection indicative basée sur le budget mensuel total. Le raccordement data sera branché ensuite.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

type CustomTickProps = {
  x?: number
  y?: number
  payload?: {
    value?: string
  }
}

function CustomTick({ x = 0, y = 0, payload }: CustomTickProps) {
  const rawValue = payload?.value ?? ''
  const truncate = (str: string) => (str.length > 9 ? `${str.substring(0, 8)}…` : str)
  const words = rawValue.split(' ').map(truncate)

  return (
    <g transform={`translate(${x},${y + 12})`}>
      {words.map((word, i) => (
        <text
          key={`${word}-${i}`}
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

const cardStyle: CSSProperties = {
  background: 'var(--neutral-0)',
  borderRadius: 'var(--radius-2xl)',
  boxShadow: 'var(--shadow-card)',
  border: '1px solid var(--neutral-150)',
  padding: 'var(--space-5)',
}

const cardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--font-size-base)',
  fontWeight: 'var(--font-weight-bold)',
  color: 'var(--neutral-900)',
}

const cardSubStyle: CSSProperties = {
  margin: '3px 0 0',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--neutral-400)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 600,
}

const switchStyle: CSSProperties = {
  display: 'flex',
  background: 'var(--neutral-100)',
  borderRadius: 'var(--radius-lg)',
  padding: 2,
  gap: 2,
}

const switchButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: '6px 9px',
  borderRadius: 'calc(var(--radius-lg) - 2px)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s',
}

const switchButtonActiveStyle: CSSProperties = {
  background: 'var(--neutral-0)',
  boxShadow: 'var(--shadow-sm)',
}

const projectionHintStyle: CSSProperties = {
  margin: 'var(--space-2) 0 0',
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--neutral-500)',
}
