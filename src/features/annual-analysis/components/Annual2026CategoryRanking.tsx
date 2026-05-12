import { useMemo, useState, type CSSProperties } from 'react'
import { CalendarDays, LayoutGrid, X } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList } from 'recharts'
import type { Budget2026CategorySummary } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { useAnnual2026Analysis } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { VIZ_PALETTE, MONTH_LABELS_SHORT } from './_constants'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const fmtPct = (r: number) => `${(r * 100).toFixed(1)}%`

type Props = {
  categories: Budget2026CategorySummary[]
}

type ProjectionViewMode = 'category' | 'year'

type CategoryProjectionPoint = {
  name: string
  amount: number
  realisticAmount: number
  color: string
  isSelected: boolean
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

export function AnnualProjectionCard({ categories, bare = false }: { categories: Budget2026CategorySummary[]; bare?: boolean }) {
  const [viewMode, setViewMode] = useState<ProjectionViewMode>('category')
  const [selectedBarIdx, setSelectedBarIdx] = useState<number | null>(null)
  const [showListeModal, setShowListeModal] = useState(false)

  // Slice to top 7 for the chart, stable reference for domainMax
  const top7 = useMemo(() => categories.slice(0, 7), [categories])

  const domainMax = useMemo(() => {
    if (top7.length === 0) return 10_000
    const maxBudget = Math.max(...top7.map((c) => c.annualBudget))
    const maxRealistic = Math.max(...top7.map((c) => c.realisticAnnual))
    return Math.max(maxBudget, maxRealistic) * 1.2
  }, [top7])

  // isSelected embedded in data so recharts re-renders bars on selection change
  const categoryData = useMemo<CategoryProjectionPoint[]>(
    () => top7.map((cat, i) => ({
      name: cat.name,
      amount: cat.annualBudget,
      realisticAmount: cat.realisticAnnual,
      color: cat.color,
      isSelected: i === selectedBarIdx,
    })),
    [top7, selectedBarIdx],
  )

  const annualMonthlyProjection = useMemo<YearProjectionPoint[]>(() => {
    const monthlyTotal = categories.reduce((total, cat) => total + Number(cat.monthlyBudget ?? 0), 0)
    const currentMonthIndex = Math.max(0, Math.min(11, new Date().getMonth()))

    return MONTH_LABELS_SHORT
      .slice(currentMonthIndex)
      .map((label, idx) => ({
        name: label,
        amount: Math.round(monthlyTotal * (1 + idx * 0.015)),
      }))
  }, [categories])

  const selectedCat = selectedBarIdx != null ? (categories[selectedBarIdx] ?? null) : null

  const toggle = (
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
  )

  const chart = (
    <div style={{ height: 260, width: '100%' }}>
      {viewMode === 'category' ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={categoryData} margin={{ top: 50, right: 0, left: 0, bottom: 40 }}>
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={<CustomTick />}
            />
            <YAxis domain={[0, domainMax]} hide />
            <Bar
              dataKey="amount"
              barSize={32}
              isAnimationActive={false}
              shape={(props: unknown) => <CustomBarShape {...(props as CustomBarShapeProps)} />}
              onClick={(_: unknown, index: number) => {
                setSelectedBarIdx((prev) => (prev === index ? null : index))
              }}
              cursor="pointer"
            >
              <LabelList
                dataKey="amount"
                position="top"
                offset={8}
                formatter={(val: number) => `${Math.round(val).toLocaleString('fr-FR')}€`}
                style={{ fontSize: 10, fontWeight: 700, fill: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}
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
  )

  const hint = viewMode === 'year' ? (
    <p style={projectionHintStyle}>
      Vue provisoire : projection indicative basée sur le budget mensuel total.
    </p>
  ) : null

  // Click tooltip card
  const selectedCard = selectedCat != null && viewMode === 'category' ? (
    <div style={{ ...selectedCardStyle, borderColor: `${selectedCat.color}30` }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--neutral-800)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: selectedCat.color, display: 'inline-block', flexShrink: 0 }} />
        {selectedCat.name}
      </div>
      <div style={{ display: 'grid', gap: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--neutral-500)' }}>Estimation budget</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-900)' }}>
            {fmt(selectedCat.annualBudget)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--neutral-500)' }}>Estimation consommation</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-900)' }}>
            {selectedCat.realisticAnnual > 0 ? fmt(selectedCat.realisticAnnual) : '—'}
          </span>
        </div>
        {selectedCat.realisticAnnual > 0 && selectedCat.annualBudget > 0 && (() => {
          const ecart = (selectedCat.realisticAnnual - selectedCat.annualBudget) / selectedCat.annualBudget
          const isOver = ecart > 0
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--neutral-500)' }}>Écart</span>
              <span style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: isOver ? 'var(--negative)' : 'var(--positive)',
              }}>
                {isOver ? '+' : ''}{(ecart * 100).toFixed(1)}%
              </span>
            </div>
          )
        })()}
      </div>
    </div>
  ) : null

  const topRight = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      {toggle}
      {viewMode === 'category' && (
        <button type="button" onClick={() => setShowListeModal(true)} style={listeBtnStyle}>
          liste
        </button>
      )}
    </div>
  )

  const modal = showListeModal ? (
    <div style={modalOverlayStyle} onClick={() => setShowListeModal(false)}>
      <div style={modalSheetStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--neutral-900)' }}>
              Toutes les catégories
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Estimation annuelle (budget × 12)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowListeModal(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-400)', padding: 4, lineHeight: 0 }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ display: 'grid', gap: 0 }}>
          {categories.map((cat) => (
            <div
              key={cat.name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '9px 0',
                borderBottom: '1px solid var(--neutral-100)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--neutral-800)' }}>{cat.name}</span>
              </div>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-900)' }}>
                {fmt(cat.annualBudget)}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0 2px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-700)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</span>
            <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-900)' }}>
              {fmt(categories.reduce((s, c) => s + c.annualBudget, 0))}
            </span>
          </div>
        </div>
      </div>
    </div>
  ) : null

  if (bare) {
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{topRight}</div>
        {chart}
        {selectedCard}
        {hint}
        {modal}
      </>
    )
  }

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
            {topRight}
          </div>
          <div style={{ marginTop: 'var(--space-6)' }}>{chart}</div>
          {selectedCard}
          {hint}
        </div>
      </div>
      {modal}
    </section>
  )
}

export function AnnualProjectionSectionConnected() {
  const { categories } = useAnnual2026Analysis()
  if (categories.length === 0) return null
  return <AnnualProjectionCard categories={categories} bare />
}

// ── Custom bar shape ──────────────────────────────────────────────────────────

type CustomBarShapeProps = {
  x?: number
  y?: number
  width?: number
  height?: number
  amount?: number       // raw data field (same name as dataKey — recharts passes all data fields)
  realisticAmount?: number
  color?: string
  isSelected?: boolean
}

function CustomBarShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  amount = 0,
  realisticAmount = 0,
  color = 'var(--neutral-400)',
  isSelected = false,
}: CustomBarShapeProps) {
  if (height <= 0 || amount <= 0 || width <= 0) return null

  const bottom = y + height
  const hasRealistic = realisticAmount > 0
  // pixel_per_unit = height / amount (consistent across all bars in a linear scale)
  const realisticY = hasRealistic ? bottom - (realisticAmount / amount) * height : null
  const isBelow = hasRealistic && realisticAmount <= amount
  const isAbove = hasRealistic && realisticAmount > amount

  return (
    <g>
      {/* Main solid bar */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={isSelected ? 1 : 0.75}
        rx={4}
        ry={4}
      />

      {/* Selection ring */}
      {isSelected && (
        <rect
          x={x - 2}
          y={y - 2}
          width={width + 4}
          height={height + 4}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeOpacity={0.45}
          rx={5}
          ry={5}
        />
      )}

      {/* Realistic < budget: horizontal white line inside the bar */}
      {isBelow && realisticY != null && (
        <line
          x1={x + 4}
          y1={realisticY}
          x2={x + width - 4}
          y2={realisticY}
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      )}

      {/* Realistic > budget: dashed extension above the bar */}
      {isAbove && realisticY != null && (
        <rect
          x={x + 3}
          y={realisticY}
          width={width - 6}
          height={Math.max(0, y - realisticY)}
          fill={color}
          fillOpacity={0.14}
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeOpacity={0.7}
          rx={3}
          ry={3}
        />
      )}
    </g>
  )
}

// ── Tick ──────────────────────────────────────────────────────────────────────

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

const selectedCardStyle: CSSProperties = {
  marginTop: 'var(--space-3)',
  padding: 'var(--space-3)',
  background: 'var(--neutral-50)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--neutral-150)',
}

const listeBtnStyle: CSSProperties = {
  background: 'none',
  border: '1px solid var(--neutral-200)',
  borderRadius: 'var(--radius-full)',
  padding: '4px 12px',
  fontSize: 11,
  color: 'var(--neutral-500)',
  cursor: 'pointer',
  fontWeight: 600,
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.04em',
}

const modalOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.38)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'flex-end',
}

const modalSheetStyle: CSSProperties = {
  background: 'var(--neutral-0)',
  borderRadius: '20px 20px 0 0',
  width: '100%',
  maxHeight: '75vh',
  overflowY: 'auto',
  padding: 'var(--space-5)',
  paddingBottom: 'calc(var(--space-5) + env(safe-area-inset-bottom, 0px))',
}
