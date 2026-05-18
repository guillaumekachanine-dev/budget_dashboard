import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { ComparedMonthlyChart } from '@/features/annual-analysis/components/ComparedMonthlyChart'
import { useComparedAnalysis } from '@/features/annual-analysis/hooks/useComparedAnalysis'

type ComparisonYear = 2024 | 2025 | 2026
type YearSide = 'left' | 'right'
type InsightId = 'savings' | 'income'

const YEAR_OPTIONS: Array<{ year: ComparisonYear; disabled?: boolean }> = [
  { year: 2024, disabled: true },
  { year: 2025 },
  { year: 2026 },
]

const FLUX_INSIGHTS = {
  savings: {
    id: 'savings' as const,
    titleValue: '-87%',
    titleSuffix: 'épargne',
    subtitle: "Le ciseau dépenses/revenus a fortement impacté l'épargne début 2026",
    detailBody:
      "La baisse d'épargne provient principalement de la compression des revenus alors que le socle de dépenses reste présent. Ce signal oriente d'abord les actions vers la stabilisation des entrées, avant la réduction fine de dépenses.",
  },
  income: {
    id: 'income' as const,
    titleValue: '-81%',
    titleSuffix: 'revenus',
    subtitle: 'Hors janvier, les revenus ont fait -81% versus 2025',
    detailBody:
      "Le delta est concentré sur février à avril. La comparaison annuelle brute masque cette chute hors pic de janvier. L'analyse des flux mensuels confirme un déficit de revenus récurrents sur la période.",
  },
}

type SavingsKpiRow = {
  label: string
  y2025: number
  y2026: number
}

const SAVINGS_KPI_ROWS: SavingsKpiRow[] = [
  { label: 'Revenus YTD', y2025: 42141, y2026: 19158 },
  { label: 'Dépenses YTD', y2025: 10820, y2026: 11823 },
  { label: 'Capacité épargne brute', y2025: 31321, y2026: 7335 },
  { label: 'Épargne YTD', y2025: 33500, y2026: 4243 },
]

export function BudgetsAnalyticsTab() {
  const [comparisonYears, setComparisonYears] = useState<{ left: ComparisonYear; right: ComparisonYear }>({
    left: 2025,
    right: 2026,
  })
  const [openYearMenu, setOpenYearMenu] = useState<YearSide | null>(null)
  const [expandedInsightId, setExpandedInsightId] = useState<InsightId | null>(null)
  const yearRowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!openYearMenu) return

    const handleOutside = (event: MouseEvent) => {
      if (!yearRowRef.current) return
      if (!yearRowRef.current.contains(event.target as Node)) {
        setOpenYearMenu(null)
      }
    }

    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [openYearMenu])

  const selectYear = (side: YearSide, year: ComparisonYear) => {
    if (year === 2024) return

    setComparisonYears((prev) => {
      const otherSide = side === 'left' ? 'right' : 'left'
      if (prev[otherSide] === year) {
        return {
          left: side === 'left' ? year : prev.left,
          right: side === 'right' ? year : prev.right,
        }
      }

      return side === 'left'
        ? { left: year, right: prev.right }
        : { left: prev.left, right: year }
    })
    setOpenYearMenu(null)
  }

  return (
    <section style={{ width: '100%', boxSizing: 'border-box', display: 'grid', gap: 'var(--space-6)' }}>
      <section style={{ padding: '0 var(--space-6)', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-3)' }}>
          <div
            style={{
              maxWidth: 258,
              margin: '0 auto',
              background:
                'linear-gradient(135deg, color-mix(in oklab, var(--color-warning) 85%, #000 15%) 0%, color-mix(in oklab, var(--color-warning) 68%, #000 32%) 58%, color-mix(in oklab, var(--color-warning) 52%, #000 48%) 100%)',
              padding: '8px var(--space-4)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#fff',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              Janvier -&gt; Avril (4 mois)
            </span>
          </div>

          <div
            ref={yearRowRef}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              position: 'relative',
              zIndex: 8,
            }}
          >
            <YearSelector
              label="Année gauche"
              value={comparisonYears.left}
              open={openYearMenu === 'left'}
              onToggle={() => setOpenYearMenu((prev) => (prev === 'left' ? null : 'left'))}
              onSelect={(year) => selectYear('left', year)}
            />

            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--neutral-500)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                width: 24,
                textAlign: 'center',
              }}
            >
              VS
            </span>

            <YearSelector
              label="Année droite"
              value={comparisonYears.right}
              open={openYearMenu === 'right'}
              onToggle={() => setOpenYearMenu((prev) => (prev === 'right' ? null : 'right'))}
              onSelect={(year) => selectYear('right', year)}
            />
          </div>
        </div>
      </section>

      <MajorSectionHeading title="Analyse des flux" marginTop="0" />

      <section style={{ padding: '0 var(--space-6)', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div
            style={{
              background: 'linear-gradient(140deg, #1A1730 0%, #2D2B6B 45%, #3D3AB8 100%)',
              borderRadius: 'var(--radius-2xl)',
              padding: 'var(--space-4)',
              boxShadow: 'var(--shadow-card)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -72,
                right: -72,
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(91,87,245,0.28) 0%, transparent 72%)',
                pointerEvents: 'none',
              }}
            />

            <p
              style={{
                margin: '0 0 var(--space-3)',
                fontSize: 11,
                fontWeight: 800,
                color: 'rgba(255,255,255,0.74)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Insights
            </p>

            <motion.div
              layout
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-3)', alignItems: 'stretch' }}
            >
              <InsightCard
                titleValue={FLUX_INSIGHTS.savings.titleValue}
                titleSuffix={FLUX_INSIGHTS.savings.titleSuffix}
                subtitle={FLUX_INSIGHTS.savings.subtitle}
                isExpanded={expandedInsightId === 'savings'}
                onToggle={() => setExpandedInsightId((prev) => (prev === 'savings' ? null : 'savings'))}
              />
              <InsightCard
                titleValue={FLUX_INSIGHTS.income.titleValue}
                titleSuffix={FLUX_INSIGHTS.income.titleSuffix}
                subtitle={FLUX_INSIGHTS.income.subtitle}
                isExpanded={expandedInsightId === 'income'}
                onToggle={() => setExpandedInsightId((prev) => (prev === 'income' ? null : 'income'))}
              />

              <AnimatePresence initial={false}>
                {expandedInsightId ? (
                  <ExpandedInsightPanel
                    insightId={expandedInsightId}
                    detailBody={FLUX_INSIGHTS[expandedInsightId].detailBody}
                  />
                ) : null}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </section>
    </section>
  )
}

function YearSelector({
  label,
  value,
  open,
  onToggle,
  onSelect,
}: {
  label: string
  value: ComparisonYear
  open: boolean
  onToggle: () => void
  onSelect: (year: ComparisonYear) => void
}) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={onToggle}
        style={{
          minWidth: 118,
          height: 34,
          borderRadius: 'var(--radius-md)',
          border: '1px solid color-mix(in oklab, var(--primary-500) 24%, var(--neutral-200) 76%)',
          background: 'var(--neutral-0)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          cursor: 'pointer',
          padding: '0 var(--space-3)',
        }}
      >
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-800)', lineHeight: 1 }}>
          {value}
        </span>
        <ChevronDown size={14} color="var(--neutral-600)" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.14 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              minWidth: 118,
              borderRadius: 'var(--radius-md)',
              border: '1px solid color-mix(in oklab, var(--primary-500) 20%, var(--neutral-200) 80%)',
              background: 'var(--neutral-0)',
              boxShadow: 'var(--shadow-card)',
              overflow: 'hidden',
              zIndex: 20,
            }}
          >
            {YEAR_OPTIONS.map((option) => (
              <button
                key={option.year}
                type="button"
                onClick={() => onSelect(option.year)}
                disabled={Boolean(option.disabled)}
                style={yearOptionStyle(option.disabled)}
              >
                {option.year}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function InsightCard({
  titleValue,
  titleSuffix,
  subtitle,
  isExpanded,
  onToggle,
}: {
  titleValue: string
  titleSuffix: string
  subtitle: string
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <motion.article
      layout
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        border: '1px solid rgba(255,255,255,0.22)',
        borderRadius: 'var(--radius-xl)',
        background: 'color-mix(in oklab, #2D2B6B 74%, #FFFFFF 26%)',
        padding: 'var(--space-3)',
        textAlign: 'left',
        display: 'grid',
        gap: 'var(--space-2)',
        minHeight: 122,
        height: '100%',
        boxShadow: isExpanded ? '0 0 0 1px rgba(255,255,255,0.2), 0 12px 24px rgba(13,13,31,0.22)' : 'none',
      }}
    >
      <p style={{ margin: 0, lineHeight: 1.1, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontSize: 'clamp(18px, 5.8vw, 28px)',
            fontWeight: 'var(--font-weight-extrabold)',
            color: '#FC5A5A',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '-0.01em',
          }}
        >
          {titleValue}
        </span>
        <span
          style={{
            fontSize: 'clamp(14px, 4vw, 20px)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--neutral-0)',
            letterSpacing: '-0.01em',
          }}
        >
          {titleSuffix}
        </span>
      </p>

      <p
        style={{
          margin: 0,
          fontSize: 11,
          lineHeight: 1.35,
          color: 'rgba(255,255,255,0.93)',
          fontWeight: 'var(--font-weight-semibold)',
        }}
      >
        {subtitle}
      </p>

      <button
        type="button"
        onClick={onToggle}
        aria-label={isExpanded ? 'Réduire le détail' : 'Déplier le détail'}
        aria-expanded={isExpanded}
        style={{
          marginTop: 'auto',
          border: 'none',
          background: 'transparent',
          padding: '4px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '12px solid rgba(255,255,255,0.95)',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 180ms ease',
          }}
        />
      </button>
    </motion.article>
  )
}

function ExpandedInsightPanel({
  insightId,
  detailBody,
}: {
  insightId: InsightId
  detailBody: string
}) {
  const { loading, error, flows2025, flows2026, fluxMetrics } = useComparedAnalysis()

  return (
    <motion.section
      key={insightId}
      layout
      initial={{ opacity: 0, y: -8, scaleY: 0.96 }}
      animate={{ opacity: 1, y: 0, scaleY: 1 }}
      exit={{ opacity: 0, y: -8, scaleY: 0.96 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      style={{
        gridColumn: '1 / -1',
        transformOrigin: 'top center',
        border: '1px solid rgba(255,255,255,0.22)',
        borderRadius: 'var(--radius-xl)',
        background: 'color-mix(in oklab, #2D2B6B 74%, #FFFFFF 26%)',
        padding: 'var(--space-4)',
        display: 'grid',
        gap: 'var(--space-3)',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          lineHeight: 1.5,
          color: 'rgba(255,255,255,0.9)',
        }}
      >
        {detailBody}
      </p>

      {insightId === 'savings' ? <SavingsInsightKpis /> : null}

      {insightId === 'income' ? (
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          {loading ? (
            <div
              style={{
                height: 220,
                borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(90deg, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.08) 75%)',
                backgroundSize: '200% 100%',
                animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
              }}
            />
          ) : null}

          {!loading && error ? (
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.86)' }}>
              Erreur de chargement du graphique.
            </p>
          ) : null}

          {!loading && !error ? (
            <ComparedMonthlyChart
              flows2025={flows2025}
              flows2026={flows2026}
              fluxMetrics={fluxMetrics}
              minHeight={320}
              mode="insight"
              title="Flux mensuels comparés"
              allowedMetrics={['income', 'savings', 'expense']}
              defaultEnabledMetrics={['income']}
              maxEnabledMetrics={1}
              forceBothYears
            />
          ) : null}
        </div>
      ) : null}
    </motion.section>
  )
}

function SavingsInsightKpis() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [activeBarId, setActiveBarId] = useState<string | null>(null)
  const maxValue = Math.max(...SAVINGS_KPI_ROWS.flatMap((row) => [row.y2025, row.y2026]))
  const chartHeight = 122

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setActiveBarId(null)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  return (
    <div ref={containerRef} style={{ overflowX: 'auto', paddingBottom: 2 }}>
      <div style={{ minWidth: 540, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(112px, 1fr))', gap: 'var(--space-3)' }}>
        {SAVINGS_KPI_ROWS.map((row) => {
          const deltaPct = row.y2025 !== 0 ? ((row.y2026 - row.y2025) / row.y2025) * 100 : 0
          const deltaPositive = deltaPct >= 0
          const deltaLabel = `${deltaPositive ? '+' : ''}${deltaPct.toFixed(1)}%`
          const deltaColor = deltaPositive ? 'var(--positive-500)' : 'var(--negative-500)'
          const y2025Height = maxValue > 0 ? Math.max((row.y2025 / maxValue) * chartHeight, 10) : 10
          const y2026Height = maxValue > 0 ? Math.max((row.y2026 / maxValue) * chartHeight, 10) : 10
          const y2025Id = `${row.label}-2025`
          const y2026Id = `${row.label}-2026`

          return (
            <div
              key={row.label}
              style={{
                display: 'grid',
                gap: 'var(--space-2)',
                alignItems: 'end',
                borderBottom: '1px solid rgba(255,255,255,0.12)',
                paddingBottom: 'var(--space-2)',
              }}
            >
              <div
                style={{
                  minHeight: chartHeight + 30,
                  display: 'flex',
                  alignItems: 'end',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveBarId((prev) => (prev === y2025Id ? null : y2025Id))}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'grid',
                    justifyItems: 'center',
                    gap: 4,
                    position: 'relative',
                  }}
                  aria-label={`${row.label} 2025`}
                >
                  {activeBarId === y2025Id ? (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: y2025Height + 20,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#fff',
                        fontFamily: 'var(--font-mono)',
                        background: 'rgba(10,12,28,0.9)',
                        border: '1px solid rgba(255,255,255,0.25)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '2px 6px',
                        whiteSpace: 'nowrap',
                        zIndex: 2,
                      }}
                    >
                      2025 · {formatCompactCurrency(row.y2025)}
                    </span>
                  ) : null}
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.68)', fontWeight: 700 }}>2025</span>
                  <span
                    style={{
                      width: 22,
                      height: y2025Height,
                      borderRadius: '6px 6px 0 0',
                      background: 'var(--primary-500)',
                    }}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveBarId((prev) => (prev === y2026Id ? null : y2026Id))}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'grid',
                    justifyItems: 'center',
                    gap: 4,
                    position: 'relative',
                  }}
                  aria-label={`${row.label} 2026`}
                >
                  {activeBarId === y2026Id ? (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: y2026Height + 20,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#fff',
                        fontFamily: 'var(--font-mono)',
                        background: 'rgba(10,12,28,0.9)',
                        border: '1px solid rgba(255,255,255,0.25)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '2px 6px',
                        whiteSpace: 'nowrap',
                        zIndex: 2,
                      }}
                    >
                      2026 · {formatCompactCurrency(row.y2026)}
                    </span>
                  ) : null}
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.68)', fontWeight: 700 }}>2026</span>
                  <span
                    style={{
                      width: 22,
                      height: y2026Height,
                      borderRadius: '6px 6px 0 0',
                      background: 'var(--warning-500)',
                    }}
                  />
                </button>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  lineHeight: 1.2,
                  color: 'rgba(255,255,255,0.88)',
                  fontWeight: 'var(--font-weight-semibold)',
                  fontStyle: 'italic',
                  transform: 'rotate(-12deg)',
                  transformOrigin: 'left center',
                  whiteSpace: 'nowrap',
                  minHeight: 28,
                }}
              >
                {row.label}
              </p>

              <span
                style={{
                  justifySelf: 'start',
                  borderRadius: 'var(--radius-full)',
                  padding: '3px 7px',
                  fontSize: 10,
                  fontWeight: 800,
                  color: deltaColor,
                  background: `color-mix(in oklab, ${deltaColor} 14%, #FFFFFF 86%)`,
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {deltaLabel}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function MajorSectionHeading({ title, marginTop }: { title: string; marginTop: string }) {
  return (
    <section style={{ padding: '0 var(--space-6)', marginTop, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-3)' }}>
        <div
          aria-hidden="true"
          style={{
            height: 2,
            width: '100%',
            background: '#121212',
            borderRadius: 'var(--radius-full)',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            aria-hidden="true"
            style={{
              width: 0,
              height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderLeft: '14px solid #121212',
              flexShrink: 0,
            }}
          />
          <h3
            style={{
              margin: 0,
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--neutral-900)',
            }}
          >
            {title}
          </h3>
        </div>
      </div>
    </section>
  )
}

function yearOptionStyle(disabled?: boolean): CSSProperties {
  return {
    width: '100%',
    border: 'none',
    borderBottom: '1px solid var(--neutral-100)',
    background: 'var(--neutral-0)',
    color: disabled ? 'var(--neutral-400)' : 'var(--neutral-800)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-semibold)',
    padding: '8px var(--space-2)',
    textAlign: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }
}
