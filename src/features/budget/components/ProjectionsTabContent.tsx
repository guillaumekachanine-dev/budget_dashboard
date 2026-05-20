import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useAnnual2026Analysis } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { useAnnualProjectionOverview2026 } from '@/features/annual-analysis/hooks/useAnnualProjectionOverview2026'
import { useBudgetRevenueAnalytics } from '@/features/budget/hooks/useBudgetRevenueAnalytics'
import { AnnualProjectionSectionConnected, type ProjectionViewMode } from '@/features/annual-analysis/components/AnnualCostProjection2026'
import { formatCurrencyRounded as fmt } from '@/lib/utils'
import { getMonthShortLabel, MONTH_LABELS_SHORT } from '@/features/annual-analysis/components/_constants'
import type { BudgetRevenueAnalytics } from '@/features/budget/types'
import { useBudgetRevenueSources2026 } from '@/features/budget/hooks/useBudgetRevenueSources2026'

// ─── Types ────────────────────────────────────────────────────────────────────

type DisplayMode = 'depenses' | 'revenus'
type CostProjectionSlide = 'categories' | 'global'

const CYAN = '#0EA5C3'

type CalcStep = { label: string; value: number | null }

type CalcModalConfig = {
  title: string
  subtitle: string
  steps: CalcStep[]
  totalLabel: string
  totalValue: number | null
  note: string
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DarkToggle({ mode, onChange }: { mode: DisplayMode; onChange: (m: DisplayMode) => void }) {
  function btn(active: boolean): React.CSSProperties {
    return {
      border: active ? '1.5px solid rgba(255,255,255,0.30)' : '1.5px solid transparent',
      background: active ? 'rgba(255,255,255,0.16)' : 'transparent',
      color: active ? '#fff' : 'rgba(255,255,255,0.45)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-2) var(--space-4)',
      fontSize: 'var(--font-size-sm)',
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all var(--transition-base)',
      minHeight: 34,
      textAlign: 'center' as const,
    }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 3,
      background: 'rgba(255,255,255,0.07)',
      borderRadius: 'var(--radius-md)',
      padding: '3px',
      width: 224,
    }}>
      <button type="button" onClick={() => onChange('depenses')} style={btn(mode === 'depenses')}>Dépenses</button>
      <button type="button" onClick={() => onChange('revenus')} style={btn(mode === 'revenus')}>Revenus</button>
    </div>
  )
}

function DarkSlideToggle({ slide, onChange }: { slide: CostProjectionSlide; onChange: (s: CostProjectionSlide) => void }) {
  function btn(active: boolean): React.CSSProperties {
    return {
      border: active ? '1.5px solid var(--neutral-800)' : '1.5px solid var(--neutral-300)',
      background: active ? 'var(--neutral-800)' : 'var(--neutral-0)',
      color: active ? 'var(--neutral-0)' : 'var(--neutral-700)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-2) var(--space-4)',
      fontSize: 'var(--font-size-sm)',
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all var(--transition-base)',
      minHeight: 34,
      textAlign: 'center' as const,
    }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 3,
      background: 'var(--neutral-100)',
      borderRadius: 'var(--radius-md)',
      padding: '3px',
      width: 224,
    }}>
      <button type="button" onClick={() => onChange('categories')} style={btn(slide === 'categories')}>Catégories</button>
      <button type="button" onClick={() => onChange('global')} style={btn(slide === 'global')}>Global</button>
    </div>
  )
}

function DarkKpiCard({
  accentColor,
  cardBg,
  borderColor,
  title,
  subAmount,
  subLabel,
  amount,
  caption,
  onClick,
}: {
  accentColor: string
  cardBg: string
  borderColor: string
  title: string
  subAmount?: number | null
  subLabel?: string
  amount: number | null
  caption: string
  onClick?: () => void
}) {
  const TAG = onClick ? 'button' : 'div'
  return (
    <TAG
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        background: cardBg,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3)',
        border: `1px solid ${borderColor}`,
        textAlign: 'left' as const,
        width: '100%',
        cursor: onClick ? 'pointer' : undefined,
        transition: 'filter 140ms ease',
      } as React.CSSProperties}
    >
      <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.07em', lineHeight: 1.2 }}>
        {title}
      </p>
      {subAmount != null && subLabel ? (
        <p style={{ margin: '0 0 2px', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.42)' }}>
          {fmt(subAmount)} {subLabel}
        </p>
      ) : null}
      <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-base)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#FFFFFF', lineHeight: 1 }}>
        {amount != null ? fmt(amount) : '—'}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>
        {caption}
      </p>
    </TAG>
  )
}

function SummaryRow({
  label,
  amount,
  pct,
  positiveIsGood = false,
}: {
  label: string
  amount: number | null
  pct: number | null
  positiveIsGood?: boolean
}) {
  const isGood = pct == null ? null : (positiveIsGood ? pct > 0 : pct < 0)
  const amountColor = '#fff'
  const pillText = isGood == null ? null : isGood ? 'rgba(46,212,122,0.9)' : 'rgba(252,90,90,0.85)'
  const pillBg = isGood == null ? null : isGood ? 'rgba(46,212,122,0.12)' : 'rgba(252,90,90,0.12)'
  const arrow = pct == null ? '' : pct > 0 ? '▲' : '▼'

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: amountColor, whiteSpace: 'nowrap' }}>
          {amount != null ? fmt(amount) : '—'}
        </span>
        {pct != null && pillText && pillBg ? (
          <span style={{ fontSize: 10, fontWeight: 700, color: pillText, background: pillBg, borderRadius: 'var(--radius-full)', padding: '2px 7px', whiteSpace: 'nowrap' }}>
            {arrow} {Math.abs(pct).toFixed(1)}%
          </span>
        ) : null}
      </div>
    </div>
  )
}

function CalcModal({ config, onClose }: { config: CalcModalConfig | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {config && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(13,13,31,0.52)' }}
          />
          <motion.div
            key="modal"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: 'var(--page-gutter)',
              right: 'var(--page-gutter)',
              top: '25vh',
              zIndex: 81,
              maxWidth: 340,
              margin: '0 auto',
              background: 'var(--neutral-0)',
              borderRadius: 'var(--radius-2xl)',
              padding: 'var(--space-5)',
              boxShadow: '0 12px 48px rgba(13,13,31,0.22)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 'var(--space-1)' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--neutral-900)', lineHeight: 1.2 }}>
                {config.title}
              </h3>
              <button
                type="button"
                onClick={onClose}
                style={{ border: 'none', background: 'var(--neutral-100)', color: 'var(--neutral-600)', width: 30, height: 30, borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <X size={13} />
              </button>
            </div>
            <p style={{ margin: '0 0 var(--space-3)', fontSize: 11, color: 'var(--neutral-500)', fontWeight: 500, lineHeight: 1.3 }}>
              {config.subtitle}
            </p>
            <div style={{ height: 2, background: 'linear-gradient(90deg, var(--primary-400) 0%, var(--primary-200) 100%)', borderRadius: 2, marginBottom: 'var(--space-3)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              {config.steps.map((step, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 'var(--radius-full)', border: '1.5px solid var(--primary-300)', color: 'var(--primary-600)', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {idx + 1}
                  </span>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--neutral-700)', fontWeight: 500, lineHeight: 1.3 }}>{step.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-800)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                    {step.value != null ? fmt(step.value) : '—'}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ height: 1, borderTop: '1.5px dashed var(--neutral-200)', marginBottom: 'var(--space-3)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-4)' }}>
              <span style={{ width: 20, textAlign: 'center', fontSize: 14, fontWeight: 800, color: CYAN, flexShrink: 0 }}>=</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)' }}>{config.totalLabel}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: CYAN, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                {config.totalValue != null ? fmt(config.totalValue) : '—'}
              </span>
            </div>
            <p style={{ margin: '0 0 var(--space-4)', fontSize: 11, color: 'var(--neutral-500)', lineHeight: 1.5 }}>{config.note}</p>
            <button type="button" onClick={onClose} style={{ width: '100%', padding: '12px var(--space-4)', background: 'color-mix(in oklab, var(--primary-300) 55%, var(--neutral-0) 45%)', border: 'none', borderRadius: 'var(--radius-xl)', color: 'var(--neutral-900)', fontSize: 'var(--font-size-sm)', fontWeight: 700, cursor: 'pointer' }}>
              Fermer
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Revenue 2026 histogram ───────────────────────────────────────────────────

const REV_GREEN = '#2ED47A'
const REV_GREENS = ['#0C5D39', '#167A4B', '#1F955B', '#2DB26E', '#4BC684', '#6FD69D', '#94E3B7', '#B9EED1']

interface Rev2026Point {
  month: string
  value: number
  isProjected: boolean
}

function RevBarShape(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: Rev2026Point
  [key: string]: unknown
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props
  const h = Math.max(0, height)
  if (h === 0) return null
  if (!payload?.isProjected) {
    return <rect x={x} y={y} width={width} height={h} fill={REV_GREEN} rx={3} ry={3} />
  }
  return (
    <rect
      x={x + 1}
      y={y}
      width={Math.max(0, width - 2)}
      height={h}
      fill="rgba(46,212,122,0.15)"
      stroke={REV_GREEN}
      strokeWidth={1.5}
      strokeDasharray="5 3"
      rx={3}
      ry={3}
    />
  )
}

function RevenueSection2026({
  revenueData,
  ytdMonths,
}: {
  revenueData: BudgetRevenueAnalytics | null
  ytdMonths: number
}) {
  const [revSlide, setRevSlide] = useState(0)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const { data: rawSources } = useBudgetRevenueSources2026()

  // ── Histogram data ────────────────────────────────────────────────────────
  const series2026 = revenueData?.monthlySeries.filter(p => p.month_start.startsWith('2026')) ?? []
  const currentMonthRevenue = series2026.length > 0 ? series2026[series2026.length - 1].revenue_amount : 0
  const avg2526 = revenueData?.avgMonthlyRevenue2025_2026 ?? 0
  const avg6m = revenueData?.avgMonthlyRevenueLast6M ?? 0
  const projectedValue = avg6m > 0 ? avg6m : avg2526

  const chartData: Rev2026Point[] = MONTH_LABELS_SHORT.map((label, idx) => {
    const m = idx + 1
    const isProjected = m > ytdMonths
    const actual = series2026.find(p => parseInt(p.month_start.slice(5, 7), 10) === m)
    return {
      month: label,
      value: isProjected ? projectedValue : (actual?.revenue_amount ?? 0),
      isProjected,
    }
  })

  const maxVal = Math.max(...chartData.map(d => d.value), 1000)
  const yMax = Math.ceil(maxVal / 500) * 500 + 500

  // ── Donut data (2026 only) ────────────────────────────────────────────────
  const donutData = rawSources.map((s, i) => ({
    ...s,
    color: REV_GREENS[i % REV_GREENS.length],
  }))
  const donutTotal = donutData.reduce((sum, d) => sum + d.value, 0)
  const selectedSource = selectedSourceId
    ? (donutData.find(d => d.id === selectedSourceId) ?? null)
    : null

  const SLIDE_TITLES = ['Revenus 2026', 'Sources de revenus 2026'] as const

  function handleSlide(idx: number) {
    setRevSlide(idx)
    setSelectedSourceId(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

      {/* ── 3 KPI tiles — always above carousel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
        {([
          { label: 'Mois en cours', value: currentMonthRevenue },
          { label: 'Moy. 2025-26', value: avg2526 },
          { label: 'Moy. 6 mois', value: avg6m },
        ] as { label: string; value: number }[]).map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: 'var(--neutral-0)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-3)',
              minHeight: 48,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              alignItems: 'flex-start',
            }}
          >
            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.2 }}>
              {label}
            </p>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1 }}>
              {fmt(value)}
            </p>
          </div>
        ))}
      </div>

      {/* ── Carousel card ── */}
      <div style={{
        background: 'var(--neutral-0)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
      }}>
        {/* Card header — title + conditional legend */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-700)', letterSpacing: '-0.01em' }}>
            {SLIDE_TITLES[revSlide]}
          </p>
          {revSlide === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--neutral-500)' }}>
                <span style={{ display: 'inline-block', width: 10, height: 8, background: REV_GREEN, borderRadius: 2 }} />
                Réel
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--neutral-500)' }}>
                <span style={{ display: 'inline-block', width: 10, height: 8, background: 'rgba(46,212,122,0.15)', border: `1.5px dashed ${REV_GREEN}`, borderRadius: 2, boxSizing: 'border-box' as const }} />
                Projeté
              </span>
            </div>
          ) : null}
        </div>

        {/* Slides container */}
        <div style={{ overflow: 'hidden', height: 220 }}>
          <div style={{
            display: 'flex',
            width: '200%',
            height: '100%',
            transform: `translateX(-${50 * revSlide}%)`,
            transition: 'transform 300ms ease',
          }}>

            {/* ── Slide 0: Monthly histogram ── */}
            <div style={{ width: '50%', flexShrink: 0, height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap="30%">
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 9, fill: '#9090a8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide domain={[0, yMax]} />
                  <Bar
                    dataKey="value"
                    shape={<RevBarShape />}
                    maxBarSize={24}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ── Slide 1: Sources donut (2026 only) ── */}
            <div style={{ width: '50%', flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Pie area */}
              <div style={{ height: 148, flexShrink: 0, position: 'relative', display: 'grid', placeItems: 'center' }}>
                {selectedSource ? (
                  <div style={{
                    position: 'absolute',
                    top: 2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    maxWidth: '86%',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--neutral-200)',
                    background: 'var(--neutral-0)',
                    boxShadow: 'var(--shadow-card)',
                    padding: '4px 8px',
                    display: 'grid',
                    justifyItems: 'center',
                    gap: 1,
                    zIndex: 1,
                  }}>
                    <span style={{ fontSize: 10, lineHeight: 1.2, color: 'var(--neutral-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                      {selectedSource.name}
                    </span>
                    <span style={{ fontSize: 11, lineHeight: 1.2, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      {fmt(selectedSource.value)}
                    </span>
                  </div>
                ) : null}
                <ResponsiveContainer width="100%" height={148}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="56%"
                      innerRadius={44}
                      outerRadius={72}
                      paddingAngle={2}
                      onClick={(slice: unknown) => {
                        const s = slice as { id?: string; payload?: { id?: string } } | null
                        const inner = (s?.payload ?? s) as { id?: string } | null
                        const id = inner?.id ?? null
                        setSelectedSourceId(prev => prev === id ? null : id)
                      }}
                    >
                      {donutData.map((entry) => (
                        <Cell
                          key={entry.id}
                          fill={entry.color}
                          fillOpacity={selectedSourceId && selectedSourceId !== entry.id ? 0.55 : 0.96}
                          stroke={selectedSourceId === entry.id ? 'var(--neutral-900)' : 'var(--neutral-0)'}
                          strokeWidth={selectedSourceId === entry.id ? 2 : 1}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend grid */}
              <div style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 6,
                alignContent: 'start',
              }}>
                {donutData.map((entry) => (
                  <button
                    key={`${entry.id}-legend`}
                    type="button"
                    onClick={() => setSelectedSourceId(prev => prev === entry.id ? null : entry.id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      display: 'grid',
                      gridTemplateColumns: '10px minmax(0, 1fr)',
                      gap: 6,
                      alignItems: 'center',
                      textAlign: 'left',
                      cursor: 'pointer',
                      opacity: selectedSourceId && selectedSourceId !== entry.id ? 0.6 : 1,
                    }}
                  >
                    <span style={{
                      width: 10,
                      height: 10,
                      borderRadius: 'var(--radius-full)',
                      background: entry.color,
                      border: '1px solid color-mix(in oklab, var(--neutral-900) 18%, transparent)',
                      flexShrink: 0,
                      display: 'block',
                    }} />
                    <span style={{
                      minWidth: 0,
                      fontSize: 10,
                      lineHeight: 1.2,
                      color: 'var(--neutral-700)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontWeight: 700,
                    }}>
                      {`${entry.name} (${donutTotal > 0 ? Math.round((entry.value / donutTotal) * 100) : 0}%)`}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── Dot slide selector (matches bloc revenus pattern) ── */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-2)', marginTop: 8 }}>
          {([0, 1] as const).map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSlide(idx)}
              aria-label={`Slide ${idx + 1} sur 2`}
              style={{
                minWidth: 'var(--touch-target-min)',
                minHeight: 'var(--touch-target-min)',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                padding: 0,
                background: 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all var(--transition-base)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'block',
                  width: idx === revSlide ? 14 : 8,
                  height: idx === revSlide ? 14 : 8,
                  borderRadius: 'var(--radius-full)',
                  background: idx === revSlide ? 'var(--primary-500)' : 'var(--neutral-300)',
                  transition: 'all var(--transition-base)',
                }}
              />
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectionsTabContent() {
  const [mode, setMode] = useState<DisplayMode>('depenses')
  const [costProjectionSlide, setCostProjectionSlide] = useState<CostProjectionSlide>('categories')
  const [activeModal, setActiveModal] = useState<CalcModalConfig | null>(null)
  const [projMonth, setProjMonth] = useState<number | null>(null) // null = full year 2026
  const [showPeriodModal, setShowPeriodModal] = useState(false)

  const { summary, categories } = useAnnual2026Analysis()
  const { data: projection } = useAnnualProjectionOverview2026(2026)
  const { data: revenueData } = useBudgetRevenueAnalytics()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const ytdMonths = summary?.ytdMonths ?? Math.min(now.getMonth() + 1, 12)
  const remainingMonths = 12 - ytdMonths
  const currentMonthLabel = getMonthShortLabel(ytdMonths)

  // ── Dépenses ────────────────────────────────────────────────────────────────

  const consumedYtd = useMemo(
    () => categories.reduce((sum, cat) => sum + cat.ytdActual, 0),
    [categories],
  )
  const budgetYtd = summary?.ytdBudgetTotal ?? 0
  const annualBudget = summary ? summary.totalMonthlyBudget * 12 : 0
  const projectedTotal = projection?.projectedTotalExpensesAmount ?? null
  const avgMonthlyConsumed = ytdMonths > 0 ? consumedYtd / ytdMonths : 0
  const projectedFromAvg = consumedYtd + avgMonthlyConsumed * remainingMonths

  const gapYtdPct = budgetYtd > 0 ? ((consumedYtd - budgetYtd) / budgetYtd) * 100 : null
  const gapAnnualPct = projectedTotal != null && annualBudget > 0
    ? ((projectedTotal - annualBudget) / annualBudget) * 100
    : null

  // ── Revenus ─────────────────────────────────────────────────────────────────

  const revenueMetrics = useMemo(() => {
    if (!revenueData) {
      return {
        ytdRevenue: null, avgMonthly6m: null, scenario1: null, scenario2: null,
        gapRevYtdVs2025Pct: null, gapS2Vs2025TotalPct: null, ytd2025SamePeriod: null,
      }
    }

    const series2026 = revenueData.monthlySeries.filter(p => p.month_start.startsWith('2026'))
    const series2025 = revenueData.monthlySeries.filter(p => p.month_start.startsWith('2025'))

    const ytd = series2026.reduce((sum, p) => sum + p.revenue_amount, 0)
    const avg = revenueData.avgMonthlyRevenueLast6M
    const s1 = projection?.projectedRevenueAmount ?? null
    const s2 = ytd > 0 && ytdMonths > 0 ? ytd + (ytd / ytdMonths) * remainingMonths : null

    const ytd2025SamePeriod = series2025.slice(0, ytdMonths).reduce((sum, p) => sum + p.revenue_amount, 0)
    const total2025Revenue = series2025.reduce((sum, p) => sum + p.revenue_amount, 0)

    const gapRevYtdVs2025Pct = ytd2025SamePeriod > 0 ? ((ytd - ytd2025SamePeriod) / ytd2025SamePeriod) * 100 : null
    const gapS2Vs2025TotalPct = s2 != null && total2025Revenue > 0 ? ((s2 - total2025Revenue) / total2025Revenue) * 100 : null

    return { ytdRevenue: ytd, avgMonthly6m: avg, scenario1: s1, scenario2: s2, gapRevYtdVs2025Pct, gapS2Vs2025TotalPct, ytd2025SamePeriod }
  }, [revenueData, projection, ytdMonths, remainingMonths])

  const { ytdRevenue, avgMonthly6m, scenario1, scenario2, gapRevYtdVs2025Pct, gapS2Vs2025TotalPct, ytd2025SamePeriod } = revenueMetrics
  const legacyProjectionViewMode: ProjectionViewMode = costProjectionSlide === 'categories' ? 'category' : 'year'

  // ── Modal configs ────────────────────────────────────────────────────────────

  const MODAL_CONSOMME: CalcModalConfig = {
    title: 'Consommé YTD · 2026',
    subtitle: `Dépenses réelles Jan–${currentMonthLabel} (${ytdMonths} mois)`,
    steps: [
      { label: `Dépenses réelles Jan–${currentMonthLabel}`, value: consumedYtd },
      { label: 'Mois écoulés', value: ytdMonths },
      { label: 'Moyenne mensuelle réelle', value: avgMonthlyConsumed },
    ],
    totalLabel: 'Total consommé YTD',
    totalValue: consumedYtd,
    note: 'Somme des dépenses réelles sur tous les mois écoulés depuis le 1er janvier 2026, toutes catégories confondues.',
  }

  const MODAL_BUDGET_YTD: CalcModalConfig = {
    title: 'Budget YTD · 2026',
    subtitle: `Budget mensuel 2026 × ${ytdMonths} mois écoulés`,
    steps: [
      { label: 'Budget mensuel 2026', value: summary?.totalMonthlyBudget ?? null },
      { label: `× ${ytdMonths} mois écoulés (Jan–${currentMonthLabel})`, value: budgetYtd },
    ],
    totalLabel: 'Budget théorique YTD',
    totalValue: budgetYtd,
    note: 'Budget théorique cumulé sur les mois écoulés. Compare le rythme réel au plan budgétaire mensuel.',
  }

  const MODAL_PROJECTION: CalcModalConfig = {
    title: 'Projection fin 2026',
    subtitle: `YTD réel + rythme moyen × ${remainingMonths} mois restants`,
    steps: [
      { label: `Consommé réel Jan–${currentMonthLabel} (${ytdMonths} mois)`, value: consumedYtd },
      { label: 'Moyenne mensuelle réelle', value: avgMonthlyConsumed },
      { label: `Projection ${remainingMonths} mois restants`, value: avgMonthlyConsumed * remainingMonths },
    ],
    totalLabel: 'Projection fin d\'année',
    totalValue: projectedTotal ?? projectedFromAvg,
    note: 'Projection basée sur le rythme de dépenses réel. La vue SQL peut utiliser une médiane pour neutraliser les mois exceptionnels.',
  }

  const MODAL_BUDGET_ANNUEL: CalcModalConfig = {
    title: 'Budget annuel 2026',
    subtitle: 'Budget mensuel 2026 × 12 mois',
    steps: [
      { label: 'Budget mensuel 2026', value: summary?.totalMonthlyBudget ?? null },
      { label: '× 12 mois', value: annualBudget },
    ],
    totalLabel: 'Budget annuel 2026',
    totalValue: annualBudget,
    note: 'Enveloppe budgétaire totale prévue pour l\'année 2026, calculée sur la base du budget mensuel défini.',
  }

  const MODAL_REVENUS_YTD: CalcModalConfig = {
    title: 'Revenus YTD · 2026',
    subtitle: `Revenus encaissés Jan–${currentMonthLabel} (${ytdMonths} mois)`,
    steps: [
      { label: `Revenus réels Jan–${currentMonthLabel}`, value: ytdRevenue },
      { label: `Revenus 2025 même période (${ytdMonths} mois)`, value: ytd2025SamePeriod },
      { label: 'Écart vs 2025', value: ytdRevenue != null && ytd2025SamePeriod != null ? ytdRevenue - ytd2025SamePeriod : null },
    ],
    totalLabel: 'Total revenus YTD',
    totalValue: ytdRevenue,
    note: 'Somme des revenus encaissés depuis le 1er janvier 2026, comparée à la même période en 2025.',
  }

  const MODAL_MOY_REVENUS: CalcModalConfig = {
    title: 'Moyenne mensuelle des revenus',
    subtitle: 'Moyenne calculée sur les 6 derniers mois',
    steps: [
      { label: 'Revenus cumulés (6 derniers mois)', value: avgMonthly6m != null ? avgMonthly6m * 6 : null },
      { label: 'Nombre de mois', value: 6 },
      { label: 'Moyenne mensuelle résultante', value: avgMonthly6m },
    ],
    totalLabel: 'Moyenne mensuelle (6M)',
    totalValue: avgMonthly6m,
    note: 'Moyenne des 6 derniers mois de revenus pour lisser les mois atypiques (bonus exceptionnels, etc.).',
  }

  const MODAL_SCENARIO1: CalcModalConfig = {
    title: 'Scénario 1 — Revenus projetés',
    subtitle: 'Projection annuelle via vue SQL',
    steps: [
      { label: `Revenus Jan–${currentMonthLabel} (${ytdMonths} mois)`, value: ytdRevenue },
      { label: `Projection ${remainingMonths} mois restants (SQL)`, value: scenario1 != null && ytdRevenue != null ? scenario1 - ytdRevenue : null },
    ],
    totalLabel: 'Revenus projetés fin 2026',
    totalValue: scenario1,
    note: 'Projection basée sur la vue SQL. Peut utiliser la médiane ou un rythme 6M pour estimer les mois restants.',
  }

  const MODAL_SCENARIO2: CalcModalConfig = {
    title: 'Scénario 2 — Projection haute',
    subtitle: 'Extrapolation pure du rythme YTD 2026',
    steps: [
      { label: `Revenus YTD réels (${ytdMonths} mois)`, value: ytdRevenue },
      { label: `Moyenne YTD (÷ ${ytdMonths} mois)`, value: ytdRevenue != null && ytdMonths > 0 ? ytdRevenue / ytdMonths : null },
      { label: `× ${remainingMonths} mois restants`, value: ytdRevenue != null && ytdMonths > 0 ? (ytdRevenue / ytdMonths) * remainingMonths : null },
    ],
    totalLabel: 'Projection haute fin 2026',
    totalValue: scenario2,
    note: 'Projection optimiste basée uniquement sur le rythme YTD 2026, sans correction ni régression.',
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const MONTHS_FR_FULL_PROJ = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const periodLabel = projMonth === null ? '2026' : `${MONTHS_FR_FULL_PROJ[projMonth - 1]} 26`

  function toggleBtnStyle(active: boolean): React.CSSProperties {
    return {
      border: active ? '2px solid var(--neutral-900)' : '1px solid var(--neutral-200)',
      background: active ? 'var(--primary-50)' : 'var(--neutral-0)',
      color: active ? 'var(--primary-700)' : 'var(--neutral-600)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-2) var(--space-4)',
      fontSize: 'var(--font-size-sm)',
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all var(--transition-base)',
      minHeight: 36,
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── period picker modal ── */}
      <AnimatePresence>
        {showPeriodModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPeriodModal(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Sélectionner une période"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: 'var(--page-gutter)',
                right: 'var(--page-gutter)',
                top: '25vh',
                zIndex: 61,
                maxWidth: 320,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-2xl)',
                padding: 'var(--space-4)',
                boxShadow: '0 8px 40px rgba(13,13,31,0.18)',
              }}
            >
              {/* Full year option */}
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <button
                  type="button"
                  onClick={() => { setProjMonth(null); setShowPeriodModal(false) }}
                  style={{
                    width: '100%',
                    padding: '8px var(--space-3)',
                    border: projMonth === null ? '2px solid var(--primary-600)' : '1px solid var(--neutral-200)',
                    borderRadius: 'var(--radius-md)',
                    background: projMonth === null ? 'color-mix(in oklab, var(--primary-600) 10%, var(--neutral-0) 90%)' : 'var(--neutral-50)',
                    color: projMonth === null ? 'var(--primary-600)' : 'var(--neutral-700)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all var(--transition-base)',
                    textAlign: 'center',
                  } as React.CSSProperties}
                >
                  2026 — Année complète
                </button>
              </div>
              {/* Month grid: 4 × 3 — past months disabled */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {MONTH_LABELS_SHORT.map((lbl, idx) => {
                  const m = idx + 1
                  const disabled = m < currentMonth
                  const isSelected = projMonth === m
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={disabled}
                      onClick={() => { setProjMonth(m); setShowPeriodModal(false) }}
                      style={{
                        padding: '7px 4px',
                        border: isSelected ? '2px solid var(--primary-600)' : '1px solid var(--neutral-200)',
                        borderRadius: 'var(--radius-sm)',
                        background: isSelected ? 'color-mix(in oklab, var(--primary-600) 12%, var(--neutral-0) 88%)' : 'var(--neutral-50)',
                        color: disabled ? 'var(--neutral-300)' : isSelected ? 'var(--primary-600)' : 'var(--neutral-800)',
                        fontSize: 11,
                        fontWeight: isSelected ? 700 : 500,
                        cursor: disabled ? 'default' : 'pointer',
                        transition: 'all var(--transition-base)',
                      }}
                    >
                      {lbl}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div style={{ padding: '0 var(--page-gutter)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {/* ── period + mode controls (mirrors EnveloppesTab layout) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={() => setShowPeriodModal(true)}
            aria-label="Choisir une période"
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              textAlign: 'center',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
              color: 'var(--neutral-700)',
              letterSpacing: '0.01em',
            }}
          >
            {periodLabel}
            <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid var(--neutral-400)', marginTop: 1, flexShrink: 0 }} />
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', background: 'var(--neutral-100)', borderRadius: 'var(--radius-md)', padding: '3px', width: 224 }}>
            <button type="button" onClick={() => setMode('revenus')} style={{ ...toggleBtnStyle(mode === 'revenus'), textAlign: 'center' }}>Revenus</button>
            <button type="button" onClick={() => setMode('depenses')} style={{ ...toggleBtnStyle(mode === 'depenses'), textAlign: 'center' }}>Dépenses</button>
          </div>
        </div>

        {/* ── Revenue 2026 KPIs + histogram — revenus mode only ── */}
        {mode === 'revenus' && (
          <RevenueSection2026 revenueData={revenueData} ytdMonths={ytdMonths} />
        )}

        {/* Dark navy container — same design language as "projections annuelles comparées" */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1c4a 0%, #2d2a6e 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-5)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}>
        {/* Subtle radial glow */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 80% 20%, rgba(91,87,245,0.25) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* 2×2 card grid */}
        {mode === 'depenses' ? (
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <DarkKpiCard
              accentColor="rgba(252,90,90,0.9)"
              cardBg="rgba(252,90,90,0.10)"
              borderColor="rgba(252,90,90,0.20)"
              title="2026 · Consommé YTD"
              amount={consumedYtd}
              caption={`Jan–${currentMonthLabel} · ${ytdMonths} mois`}
              onClick={() => setActiveModal(MODAL_CONSOMME)}
            />
            <DarkKpiCard
              accentColor="rgba(91,87,245,0.9)"
              cardBg="rgba(91,87,245,0.10)"
              borderColor="rgba(91,87,245,0.22)"
              title="2026 · Budget YTD"
              amount={budgetYtd}
              caption={`objectif ${ytdMonths} mois`}
              onClick={() => setActiveModal(MODAL_BUDGET_YTD)}
            />
            <DarkKpiCard
              accentColor="rgba(255,171,46,0.9)"
              cardBg="rgba(255,171,46,0.10)"
              borderColor="rgba(255,171,46,0.22)"
              title="2026 · Projection"
              subAmount={consumedYtd}
              subLabel="YTD"
              amount={projectedTotal ?? projectedFromAvg}
              caption="projeté fin d'année"
              onClick={() => setActiveModal(MODAL_PROJECTION)}
            />
            <DarkKpiCard
              accentColor="rgba(76,201,240,0.9)"
              cardBg="rgba(76,201,240,0.10)"
              borderColor="rgba(76,201,240,0.22)"
              title="2026 · Budget Annuel"
              subAmount={summary?.totalMonthlyBudget ?? null}
              subLabel="/mois"
              amount={annualBudget}
              caption="enveloppe annuelle"
              onClick={() => setActiveModal(MODAL_BUDGET_ANNUEL)}
            />
          </div>
        ) : (
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <DarkKpiCard
              accentColor="rgba(99,241,171,0.95)"
              cardBg="rgba(46,212,122,0.12)"
              borderColor="rgba(99,241,171,0.22)"
              title="2026 · Revenus YTD"
              subAmount={ytd2025SamePeriod}
              subLabel="en 2025"
              amount={ytdRevenue}
              caption={`Jan–${currentMonthLabel} · ${ytdMonths} mois`}
              onClick={() => setActiveModal(MODAL_REVENUS_YTD)}
            />
            <DarkKpiCard
              accentColor="rgba(255,171,46,0.9)"
              cardBg="rgba(255,171,46,0.10)"
              borderColor="rgba(255,171,46,0.20)"
              title="2026 · Moy. mensuelle"
              amount={avgMonthly6m}
              caption="6 derniers mois"
              onClick={() => setActiveModal(MODAL_MOY_REVENUS)}
            />
            <DarkKpiCard
              accentColor="rgba(76,201,240,0.9)"
              cardBg="rgba(76,201,240,0.11)"
              borderColor="rgba(76,201,240,0.20)"
              title="2026 · Scénario 1"
              subAmount={ytdRevenue}
              subLabel="YTD"
              amount={scenario1}
              caption="projection SQL"
              onClick={() => setActiveModal(MODAL_SCENARIO1)}
            />
            <DarkKpiCard
              accentColor="rgba(180,140,255,0.9)"
              cardBg="rgba(150,120,230,0.10)"
              borderColor="rgba(180,140,255,0.20)"
              title="2026 · Scénario 2"
              subAmount={ytdRevenue}
              subLabel="YTD"
              amount={scenario2}
              caption="rythme YTD · optimiste"
              onClick={() => setActiveModal(MODAL_SCENARIO2)}
            />
          </div>
        )}

        {/* Summary rows — separated by a divider line, same pattern as ComparedVelocityCard */}
        <div style={{
          position: 'relative',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          paddingTop: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {mode === 'depenses' ? (
            <>
              <SummaryRow
                label="Dépenses YTD 2026"
                amount={consumedYtd}
                pct={gapYtdPct}
                positiveIsGood={false}
              />
              <SummaryRow
                label="Projection dépenses 2026"
                amount={projectedTotal ?? projectedFromAvg}
                pct={gapAnnualPct}
                positiveIsGood={false}
              />
            </>
          ) : (
            <>
              <SummaryRow
                label="Revenus YTD 2026"
                amount={ytdRevenue}
                pct={gapRevYtdVs2025Pct}
                positiveIsGood={true}
              />
              <SummaryRow
                label="Projection haute revenus 2026"
                amount={scenario2}
                pct={gapS2Vs2025TotalPct}
                positiveIsGood={true}
              />
            </>
          )}
        </div>
      </div>

      <h2 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--neutral-900)', letterSpacing: '-0.01em' }}>
        Projection coûts annuels
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <DarkSlideToggle slide={costProjectionSlide} onChange={setCostProjectionSlide} />
        </div>

        <AnnualProjectionSectionConnected
          viewMode={legacyProjectionViewMode}
          hideModeToggle
        />
      </div>

        <CalcModal config={activeModal} onClose={() => setActiveModal(null)} />
      </div>
    </>
  )
}
