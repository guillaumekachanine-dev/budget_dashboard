import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpCircle, Car, ChevronDown, PiggyBank, ShoppingBag } from 'lucide-react'
import { ComparedBucketChart } from '@/features/annual-analysis/components/ComparedBucketChart'
import { ComparedCategoryBars } from '@/features/annual-analysis/components/ComparedCategoryBars'
import { ComparedMonthlyChart } from '@/features/annual-analysis/components/ComparedMonthlyChart'
import { useAnnual2025Analysis } from '@/features/annual-analysis/hooks/useAnnual2025Analysis'
import { useComparedAnalysis } from '@/features/annual-analysis/hooks/useComparedAnalysis'
import { MonthlyFlowsAnalysisCard } from '@/features/annual-analysis/components/Annual2026MonthlyTable'

type ComparisonYear = 2024 | 2025 | 2026
type YearSide = 'left' | 'right'
type InsightId = 'savings' | 'income'
type RepartitionInsightId = 'achats-divers' | 'transport'

const REPARTITION_SLIDE_FRAME_HEIGHT = 438
const SECTION_BORDER_WIDTH = '4px'
const DEEP_YELLOW = '#B8860B'

const YEAR_OPTIONS: Array<{ year: ComparisonYear; disabled?: boolean }> = [
  { year: 2024, disabled: true },
  { year: 2025 },
  { year: 2026 },
]

const FLUX_INSIGHTS = {
  savings: {
    id: 'savings' as const,
    titleValue: '-87%',
    titleSuffix: 'épargne YTD',
    subtitle: "Le ciseau dépenses/revenus a fortement impacté l'épargne début 2026",
    detailBody:
      "La baisse d'épargne provient principalement de la compression des revenus alors que le socle de dépenses reste présent. Ce signal oriente d'abord les actions vers la stabilisation des entrées, avant la réduction fine de dépenses.",
  },
  income: {
    id: 'income' as const,
    titleValue: '÷2',
    titleSuffix: 'revenus 2026',
    subtitle: 'Hors janvier, les revenus ont fait -81% versus 2025',
    detailBody:
      "Le delta est concentré sur février à avril. La comparaison annuelle brute masque cette chute hors pic de janvier. L'analyse des flux mensuels confirme un déficit de revenus récurrents sur la période.",
  },
}

const REPARTITION_INSIGHTS = {
  achatsDivers: {
    id: 'achats-divers' as const,
    titleValue: '−29%',
    titleSuffix: 'achats div.',
    subtitle: "trompe-l'oeil induit par les dépenses exceptionnelles de mars 2025",
    detailBody:
      "La baisse apparente est biaisée par un outlier en mars 2025. À base comparable, le rythme mensuel 2026 sur ce poste reste plus élevé.",
    accentColor: '#FFAB2E',
    metrics: {
      total2025: 4122,
      total2026: 2936,
      exceptional2025: 2213,
      adjustedBase2025: 1909,
      adjustedMonthly2025: 636,
      monthly2026: 734,
      deltaPct: 15,
    },
  },
  transport: {
    id: 'transport' as const,
    titleValue: '×8',
    titleSuffix: 'transport',
    subtitle: 'de nouvelles catégories structurelles et ponctuelles impactent le budget 2026',
    detailBody:
      "Le transport devient un poste structurel en 2026, avec une hausse régulière sur les premiers mois et un poids plus significatif dans le budget opérationnel.",
    accentColor: '#FC5A5A',
    topDivergences: [
      { category: 'transport', deltaPct: 701, y2025: 93, y2026: 701 },
      { category: 'abonnements', deltaPct: 158, y2025: 166, y2026: 428 },
      { category: "retrait d'espèces", deltaPct: 69, y2025: 1410, y2026: 2380 },
    ] as const,
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
  const [expandedRepartitionInsightId, setExpandedRepartitionInsightId] = useState<RepartitionInsightId | null>(null)
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
      {/* ── controls: period info (plain) + year selectors ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', padding: '0 var(--page-gutter)', marginBottom: 'var(--space-3)' }}>
        {/* Period — plain text, no badge */}
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 700,
            color: 'var(--neutral-700)',
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
          }}
        >
          Janvier → Avril (4 mois)
        </span>

        {/* Year selectors — keep dropdown functionality, same visual position as toggles */}
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
            buttonWidth={92}
            buttonHeight={36}
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
            buttonWidth={92}
            buttonHeight={36}
          />
        </div>
      </div>

      <MajorSectionHeading title="Analyse des flux" marginTop="0" />

      <section style={{ padding: '0 var(--space-4)', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <motion.div
            layout
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-2)', alignItems: 'stretch' }}
          >
            <InsightCard
              icon="savings"
              titleValue={FLUX_INSIGHTS.savings.titleValue}
              titleSuffix={FLUX_INSIGHTS.savings.titleSuffix}
              isExpanded={expandedInsightId === 'savings'}
              onToggle={() => setExpandedInsightId((prev) => (prev === 'savings' ? null : 'savings'))}
            />
            <InsightCard
              icon="income"
              titleValue={FLUX_INSIGHTS.income.titleValue}
              titleSuffix={FLUX_INSIGHTS.income.titleSuffix}
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
      </section>

      <MonthlyFlowsAnalysisCard
        year={2026}
        showInternalViewToggle
        variant="standalone"
      />

      <MajorSectionHeading title="Analyse de la répartition" marginTop="0" />

      <section style={{ padding: '0 var(--space-4)', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <motion.div
            layout
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-2)', alignItems: 'stretch' }}
          >
            <RepartitionInsightCard
              icon="shopping"
              titleValue={REPARTITION_INSIGHTS.achatsDivers.titleValue}
              titleSuffix={REPARTITION_INSIGHTS.achatsDivers.titleSuffix}
              isExpanded={expandedRepartitionInsightId === REPARTITION_INSIGHTS.achatsDivers.id}
              onToggle={() => setExpandedRepartitionInsightId((prev) => (
                prev === REPARTITION_INSIGHTS.achatsDivers.id ? null : REPARTITION_INSIGHTS.achatsDivers.id
              ))}
            />
            <RepartitionInsightCard
              icon="transport"
              titleValue={REPARTITION_INSIGHTS.transport.titleValue}
              titleSuffix={REPARTITION_INSIGHTS.transport.titleSuffix}
              isExpanded={expandedRepartitionInsightId === REPARTITION_INSIGHTS.transport.id}
              onToggle={() => setExpandedRepartitionInsightId((prev) => (
                prev === REPARTITION_INSIGHTS.transport.id ? null : REPARTITION_INSIGHTS.transport.id
              ))}
            />

            <AnimatePresence initial={false}>
              {expandedRepartitionInsightId ? (
                <ExpandedRepartitionInsightPanel
                  key={expandedRepartitionInsightId}
                  insightId={expandedRepartitionInsightId}
                  detailBody={expandedRepartitionInsightId === REPARTITION_INSIGHTS.achatsDivers.id
                    ? REPARTITION_INSIGHTS.achatsDivers.detailBody
                    : REPARTITION_INSIGHTS.transport.detailBody}
                />
              ) : null}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      <RepartitionComparisonSection />

    </section>
  )
}

function YearSelector({
  label,
  value,
  open,
  onToggle,
  onSelect,
  buttonWidth = 118,
  buttonHeight = 34,
}: {
  label: string
  value: ComparisonYear
  open: boolean
  onToggle: () => void
  onSelect: (year: ComparisonYear) => void
  buttonWidth?: number
  buttonHeight?: number
}) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={onToggle}
        style={{
          minWidth: buttonWidth,
          height: buttonHeight,
          borderRadius: 'var(--radius-md)',
          border: '1px solid color-mix(in oklab, var(--primary-500) 24%, var(--neutral-200) 76%)',
          background: 'var(--neutral-0)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: '0 var(--space-3)',
        }}
      >
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-800)', lineHeight: 1 }}>
          {value}
        </span>
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
  icon,
  titleValue,
  titleSuffix,
  isExpanded,
  onToggle,
}: {
  icon: 'savings' | 'income'
  titleValue: string
  titleSuffix: string
  isExpanded: boolean
  onToggle: () => void
}) {
  const Icon = icon === 'savings' ? PiggyBank : ArrowUpCircle
  const iconStyle =
    icon === 'savings'
      ? {
          background: 'color-mix(in oklab, #FFAB2E 20%, white 80%)',
          color: '#FFAB2E',
        }
      : {
          background: 'color-mix(in oklab, #7C3AED 20%, white 80%)',
          color: '#7C3AED',
        }

  return (
    <motion.article
      layout
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        border: 'none',
        borderRadius: 0,
        background: 'transparent',
        padding: 'var(--space-2) var(--space-1)',
        textAlign: 'left',
        display: 'grid',
        gap: 'var(--space-1)',
        minHeight: 114,
        height: '100%',
        boxShadow: 'none',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr)', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-full)',
            background: iconStyle.background,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconStyle.color,
            flexShrink: 0,
          }}
        >
          <Icon size={22} strokeWidth={2.2} color={iconStyle.color} />
        </span>
        <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
          <p style={{ margin: 0, lineHeight: 1, fontSize: 'clamp(22px, 5.2vw, 30px)', fontWeight: 'var(--font-weight-extrabold)', color: '#FC5A5A', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
            {titleValue}
          </p>
          <p style={{ margin: 0, fontSize: 'clamp(13px, 3.4vw, 16px)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
            {titleSuffix}
          </p>
        </div>
      </div>

      <div
        aria-hidden="true"
        style={{
          height: 1,
          width: 'calc(100% - 44px - var(--space-2))',
          marginLeft: 'calc(44px + var(--space-2))',
          background: 'var(--neutral-700)',
        }}
      />

      <button
        type="button"
        onClick={onToggle}
        aria-label={isExpanded ? 'Réduire le détail' : 'Déplier le détail'}
        aria-expanded={isExpanded}
        style={{
          border: 'none',
          background: 'transparent',
          padding: '2px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <ChevronDown
          size={24}
          color="var(--neutral-600)"
          style={{
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
  const { annualTotals } = useAnnual2025Analysis()

  const ASSURED_MONTHLY = 3334
  const ASSURED_MONTHS = 7
  const income2025Ytd = flows2025?.income_total ?? 0
  const income2026Ytd = flows2026?.income_total ?? 0
  const annualIncome2025 = annualTotals?.income_total_year ?? null
  const projectedIncome2026 = income2026Ytd + ASSURED_MONTHLY * ASSURED_MONTHS

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
        border: '1px solid var(--neutral-700)',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--neutral-100)',
        padding: 'var(--space-4)',
        display: 'grid',
        gap: 'var(--space-3)',
      }}
    >
      {insightId === 'savings' ? (
        <ul style={{ margin: 0, padding: '0 0 0 var(--space-4)', display: 'grid', gap: 'var(--space-1)' }}>
          {[
            'Compression importante des revenus (-81% hors janvier)',
            'Maintien, et même augmentation des dépenses (+9,3%)',
            'Conséquence : -87% d’épargne sur le début d’année',
          ].map((line) => (
            <li key={line} style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--neutral-900)' }}>
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: 'var(--neutral-900)' }}>
          {detailBody}
        </p>
      )}

      {insightId === 'savings' ? <SavingsInsightKpis /> : null}

      {insightId === 'income' ? (
        loading ? (
          <div style={{
            height: 280,
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-150) 50%, var(--neutral-100) 75%)',
            backgroundSize: '200% 100%',
            animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
          }} />
        ) : error ? (
          <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-900)' }}>Erreur de chargement.</p>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <IncomeProjectionCards
              income2025Ytd={income2025Ytd}
              annualIncome2025={annualIncome2025}
              income2026Ytd={income2026Ytd}
              projectedIncome2026={projectedIncome2026}
              assuredMonthlyIncome={ASSURED_MONTHLY}
              assuredMonths={ASSURED_MONTHS}
            />
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
          </div>
        )
      ) : null}
    </motion.section>
  )
}

function RepartitionInsightCard({
  icon,
  titleValue,
  titleSuffix,
  isExpanded,
  onToggle,
}: {
  icon: 'shopping' | 'transport'
  titleValue: string
  titleSuffix: string
  isExpanded: boolean
  onToggle: () => void
}) {
  const Icon = icon === 'shopping' ? ShoppingBag : Car
  const iconStyle =
    icon === 'shopping'
      ? {
          background: 'color-mix(in oklab, #FFAB2E 20%, white 80%)',
          color: '#FFAB2E',
        }
      : {
          background: 'color-mix(in oklab, #7C3AED 20%, white 80%)',
          color: '#7C3AED',
        }

  return (
    <motion.article
      layout
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        border: 'none',
        borderRadius: 0,
        background: 'transparent',
        padding: 'var(--space-2) var(--space-1)',
        textAlign: 'left',
        display: 'grid',
        gap: 'var(--space-1)',
        minHeight: 114,
        height: '100%',
        boxShadow: 'none',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr)', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-full)',
            background: iconStyle.background,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconStyle.color,
            flexShrink: 0,
          }}
        >
          <Icon size={22} strokeWidth={2.2} color={iconStyle.color} />
        </span>
        <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
          <p style={{ margin: 0, lineHeight: 1, fontSize: 'clamp(22px, 5.2vw, 30px)', fontWeight: 'var(--font-weight-extrabold)', color: '#FC5A5A', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
            {titleValue}
          </p>
          <p style={{ margin: 0, fontSize: 'clamp(13px, 3.4vw, 16px)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
            {titleSuffix}
          </p>
        </div>
      </div>

      <div
        aria-hidden="true"
        style={{
          height: 1,
          width: 'calc(100% - 44px - var(--space-2))',
          marginLeft: 'calc(44px + var(--space-2))',
          background: 'var(--neutral-700)',
        }}
      />

      <button
        type="button"
        onClick={onToggle}
        aria-label={isExpanded ? 'Réduire le détail' : 'Déplier le détail'}
        aria-expanded={isExpanded}
        style={{
          border: 'none',
          background: 'transparent',
          padding: '2px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <ChevronDown
          size={24}
          color="var(--neutral-600)"
          style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 180ms ease',
          }}
        />
      </button>
    </motion.article>
  )
}

function ExpandedRepartitionInsightPanel({
  insightId,
  detailBody,
}: {
  insightId: RepartitionInsightId
  detailBody: string
}) {
  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: -8, scaleY: 0.96 }}
      animate={{ opacity: 1, y: 0, scaleY: 1 }}
      exit={{ opacity: 0, y: -8, scaleY: 0.96 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      style={{
        gridColumn: '1 / -1',
        transformOrigin: 'top center',
        border: '1px solid var(--neutral-700)',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--neutral-100)',
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
          color: 'var(--neutral-900)',
        }}
      >
        {detailBody}
      </p>

      {insightId === REPARTITION_INSIGHTS.achatsDivers.id ? <AchatsDiversExpandedContent /> : null}
      {insightId === REPARTITION_INSIGHTS.transport.id ? <TransportExpandedContent /> : null}
    </motion.section>
  )
}

function TransportExpandedContent() {
  const rows = REPARTITION_INSIGHTS.transport.topDivergences
  const maxValue = Math.max(...rows.flatMap((row) => [row.y2025, row.y2026]), 1)

  return (
    <div
      style={{
        borderRadius: 'var(--radius-xl)',
        background: '#FFFFFF',
        border: '1px solid #D7DAE2',
        boxShadow: '0 1px 2px rgba(19, 28, 45, 0.06)',
        padding: 'var(--space-3)',
        display: 'grid',
        gap: 'var(--space-3)',
      }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 700, color: '#353A4A' }}>
          Top 3 divergences YTD
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LegendDot color="#5C6276" label="2025" />
          <LegendDot color="#2ED47A" label="2026" />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 'var(--space-2)',
          alignItems: 'end',
          minWidth: 0,
        }}
      >
        {rows.map((row) => {
          const h2025 = Math.max((row.y2025 / maxValue) * 124, 8)
          const h2026 = Math.max((row.y2026 / maxValue) * 124, 8)

          return (
            <div key={row.category} style={{ minWidth: 0, display: 'grid', gap: 6, justifyItems: 'center' }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#C74335',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1,
                }}
              >
                +{row.deltaPct}%
              </span>

              <div style={{ height: 130, display: 'flex', alignItems: 'end', gap: 8 }}>
                <span
                  style={{
                    width: 18,
                    height: h2025,
                    borderRadius: '6px 6px 0 0',
                    background: '#5C6276',
                  }}
                />
                <span
                  style={{
                    width: 18,
                    height: h2026,
                    borderRadius: '6px 6px 0 0',
                    background: '#2ED47A',
                  }}
                />
              </div>

              <p
                style={{
                  margin: 0,
                  minHeight: 30,
                  textAlign: 'center',
                  fontSize: 10,
                  lineHeight: 1.25,
                  fontWeight: 700,
                  color: '#5B6070',
                  textTransform: 'none',
                }}
              >
                {row.category}
              </p>

              <p
                style={{
                  margin: 0,
                  textAlign: 'center',
                  fontSize: 11,
                  lineHeight: 1.2,
                  color: '#3F4454',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatCompactCurrency(row.y2025)} / {formatCompactCurrency(row.y2026)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RepartitionComparisonSection() {
  const [activeSlide, setActiveSlide] = useState<0 | 1>(1)
  const {
    loading,
    error,
    fluxMetrics,
    categoryMetrics,
    bucketMetrics,
    categoryRows,
  } = useComparedAnalysis()

  return (
    <section style={{ display: 'grid', gap: 0 }}>
      <div
        style={{
          position: 'relative',
          height: REPARTITION_SLIDE_FRAME_HEIGHT,
          marginTop: 0,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 'max(var(--space-6), calc((100% - 600px) / 2))',
            width: SECTION_BORDER_WIDTH,
            background: DEEP_YELLOW,
            borderRadius: 'var(--radius-full)',
            pointerEvents: 'none',
            zIndex: 4,
          }}
        />
        {loading ? (
          <section style={{ padding: '0 var(--space-6)', width: '100%', boxSizing: 'border-box', overflowX: 'clip', height: '100%' }}>
            <div style={{ maxWidth: 600, margin: '0 auto', height: '100%' }}>
              <div style={{
                height: '100%',
                borderRadius: 'var(--radius-2xl)',
                background: 'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-150) 50%, var(--neutral-100) 75%)',
                backgroundSize: '200% 100%',
                animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
              }} />
            </div>
          </section>
        ) : null}

        {!loading && error ? (
          <section style={{ padding: '0 var(--space-6)', width: '100%', boxSizing: 'border-box', overflowX: 'clip', height: '100%' }}>
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <div style={{
                minHeight: '100%',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-xl)',
                background: 'color-mix(in oklab, var(--color-error) 6%, var(--neutral-0) 94%)',
                border: '1px solid color-mix(in oklab, var(--color-error) 20%, transparent 80%)',
              }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-error)' }}>
                  Erreur de chargement
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>
                  {error}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {!loading && !error ? (
          <>
            <div style={{ position: 'absolute', inset: 0, opacity: activeSlide === 0 ? 1 : 0, pointerEvents: activeSlide === 0 ? 'auto' : 'none' }}>
              <section style={{ padding: '0 var(--space-6)', width: '100%', boxSizing: 'border-box', overflowX: 'clip', height: '100%' }}>
                <div style={{ maxWidth: 600, margin: '0 auto' }}>
                  <ComparedBucketChart metrics={bucketMetrics} fluxMetrics={fluxMetrics} barsOnly />
                </div>
              </section>
            </div>
            <div style={{ position: 'absolute', inset: 0, opacity: activeSlide === 1 ? 1 : 0, pointerEvents: activeSlide === 1 ? 'auto' : 'none' }}>
              <section style={{ padding: '0 var(--space-6)', width: '100%', boxSizing: 'border-box', overflowX: 'clip', height: '100%' }}>
                <div style={{ maxWidth: 600, margin: '0 auto' }}>
                  <ComparedCategoryBars metrics={categoryMetrics} categoryRows={categoryRows} donutOnly />
                </div>
              </section>
            </div>
          </>
        ) : null}
      </div>

      <div style={{ padding: '0 var(--space-6)', marginTop: 'var(--space-3)' }}>
        <div style={{
          maxWidth: 600,
          margin: '0 auto',
          padding: 4,
          borderRadius: 'var(--radius-full)',
          background: 'color-mix(in oklab, var(--primary-500) 10%, var(--neutral-0) 90%)',
          border: '1px solid color-mix(in oklab, var(--primary-500) 16%, var(--neutral-200) 84%)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 4,
        }}>
          <button
            type="button"
            onClick={() => setActiveSlide(1)}
            aria-label="Afficher la slide Répartition par catégorie"
            aria-pressed={activeSlide === 1}
            style={slideNavButtonStyle(activeSlide === 1)}
          >
            Catégories
          </button>
          <button
            type="button"
            onClick={() => setActiveSlide(0)}
            aria-label="Afficher la slide Répartition par bloc"
            aria-pressed={activeSlide === 0}
            style={slideNavButtonStyle(activeSlide === 0)}
          >
            Socles
          </button>
        </div>
      </div>
    </section>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#6A7082', fontSize: 11, fontWeight: 700 }}>
      <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '999px', background: color }} />
      {label}
    </span>
  )
}

function AchatsDiversExpandedContent() {
  const {
    total2025,
    total2026,
    exceptional2025,
    adjustedBase2025,
    adjustedMonthly2025,
    monthly2026,
    deltaPct,
  } = REPARTITION_INSIGHTS.achatsDivers.metrics

  const maxTotal = Math.max(total2025, total2026, 1)
  const width2025Pct = (total2025 / maxTotal) * 100
  const width2026Pct = (total2026 / maxTotal) * 100
  const exceptionalPctWithin2025 = (exceptional2025 / total2025) * 100
  const regularPctWithin2025 = 100 - exceptionalPctWithin2025

  return (
    <div
      style={{
        display: 'grid',
        gap: 'var(--space-3)',
        borderRadius: 'var(--radius-xl)',
        background: '#FFFFFF',
        border: '1px solid #D7DAE2',
        boxShadow: '0 1px 2px rgba(19, 28, 45, 0.06)',
        padding: 'var(--space-3)',
      }}
    >
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <HorizontalBarRow
          label="2025"
          total={total2025}
          widthPct={width2025Pct}
          exceptionalPctWithinBar={exceptionalPctWithin2025}
          regularPctWithinBar={regularPctWithin2025}
        />
        <HorizontalBarRow
          label="2026"
          total={total2026}
          widthPct={width2026Pct}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-2)' }}>
        <KpiTile
          label="Achats div. 2025"
          valueFontSize="var(--font-size-lg)"
          value={formatCompactCurrency(total2025)}
          note="dont 2213€ except."
        />
        <KpiTile
          label="Achats div. 2026"
          value={formatCompactCurrency(total2026)}
          note="janvier-avril"
        />
        <KpiTile
          label="Moy/mois 2025"
          labelAccentLine="Ajusté"
          labelAccentColor="#5B6070"
          value={formatCompactCurrency(adjustedMonthly2025)}
          note={`${formatCompactCurrency(adjustedBase2025)} hors dép.exceptionnelles`}
        />
        <KpiTile
          label="Moy/mois 2026"
          value={formatCompactCurrency(monthly2026)}
          note="vs moyenne ajustée 2025"
          notePrefixInline={`+${deltaPct}%`}
          notePrefixColor="#D13A2A"
          emphasize
        />
      </div>
    </div>
  )
}

function HorizontalBarRow({
  label,
  total,
  widthPct,
  exceptionalPctWithinBar,
  regularPctWithinBar,
}: {
  label: string
  total: number
  widthPct: number
  exceptionalPctWithinBar?: number
  regularPctWithinBar?: number
}) {
  const hasExceptionalSplit = typeof exceptionalPctWithinBar === 'number' && typeof regularPctWithinBar === 'number'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', alignItems: 'center', gap: 'var(--space-2)' }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: '#6B6F80',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {label}
      </span>

      <div
        style={{
          height: 16,
          borderRadius: 'var(--radius-full)',
          background: '#E6E8EF',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${widthPct}%`,
            height: '100%',
            display: 'flex',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
          }}
        >
          {hasExceptionalSplit ? (
            <>
              <span style={{ width: `${regularPctWithinBar}%`, background: '#51576A' }} />
              <span
                style={{
                  width: `${exceptionalPctWithinBar}%`,
                  background: '#D9A43B',
                  borderLeft: '1px solid rgba(255,255,255,0.9)',
                }}
              />
            </>
          ) : (
            <span style={{ width: '100%', background: '#5C6276' }} />
          )}
        </div>
      </div>

      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: '#3F4454',
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
        }}
      >
        {formatCompactCurrency(total)}
      </span>
    </div>
  )
}

function KpiTile({
  label,
  labelAccentLine,
  labelAccentColor,
  headlineBadge,
  headlineBadgeColor,
  valueFontSize,
  value,
  note,
  notePrefixInline,
  notePrefixColor,
  emphasize = false,
}: {
  label: string
  labelAccentLine?: string
  labelAccentColor?: string
  headlineBadge?: string
  headlineBadgeColor?: string
  valueFontSize?: string
  value: string
  note: string
  notePrefixInline?: string
  notePrefixColor?: string
  emphasize?: boolean
}) {
  return (
    <div
      style={{
        border: emphasize ? '1px solid #8A7452' : '1px solid #7A808F',
        borderRadius: 'var(--radius-lg)',
        background: emphasize ? '#F4EBE0' : '#F3F5F9',
        padding: '10px',
        display: 'grid',
        gap: 4,
      }}
    >
      <div style={{ minHeight: 28, display: 'grid', alignContent: 'start', gap: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'none',
            color: '#5B6070',
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.2,
          }}
        >
          {label}
        </p>
        {labelAccentLine ? (
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.03em',
              textTransform: 'none',
              color: labelAccentColor ?? '#5B6070',
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.2,
            }}
          >
            {labelAccentLine}
          </p>
        ) : null}
      </div>
      {headlineBadge ? (
        <p
          style={{
          margin: 0,
          marginTop: 0,
          fontSize: 20,
          fontWeight: 800,
          lineHeight: 1,
          color: headlineBadgeColor ?? '#D13A2A',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '-0.01em',
          }}
        >
          {headlineBadge}
        </p>
      ) : null}
      <p
        style={{
          margin: 0,
          marginTop: 2,
          fontSize: valueFontSize ?? 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-extrabold)',
          color: '#2F3443',
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
      <p
        style={{
          margin: 0,
          minHeight: 30,
          fontSize: 11,
          color: emphasize ? '#7B6749' : '#596074',
          lineHeight: 1.3,
        }}
      >
        {notePrefixInline ? (
          <span style={{ color: notePrefixColor ?? '#D13A2A', fontWeight: 800 }}>
            {notePrefixInline}
          </span>
        ) : null}
        {notePrefixInline ? ' ' : ''}
        {note}
      </p>
    </div>
  )
}

// ─── Income projection cards + modals ─────────────────────────────────────────

function IncomeProjectionCards({
  income2025Ytd,
  annualIncome2025,
  income2026Ytd,
  projectedIncome2026,
  assuredMonthlyIncome,
  assuredMonths,
}: {
  income2025Ytd: number
  annualIncome2025: number | null
  income2026Ytd: number
  projectedIncome2026: number
  assuredMonthlyIncome: number
  assuredMonths: number
}) {
  const [modal, setModal] = useState<'2025' | '2026' | null>(null)
  const incomeYtdDeltaPct = income2025Ytd > 0
    ? ((income2026Ytd - income2025Ytd) / income2025Ytd) * 100
    : null

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        {/* 2025 card */}
        <button
          type="button"
          onClick={() => setModal('2025')}
          style={{
            border: '1px solid var(--neutral-300)',
            borderTop: '2px solid var(--primary-500)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--neutral-0)',
            padding: 'var(--space-3)',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            transition: 'border-color 140ms ease, box-shadow 140ms ease',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 12px rgba(91,87,245,0.14)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none' }}
        >
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--primary-500)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            2025 – Revenus
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--neutral-600)' }}>
            {formatCompactCurrency(income2025Ytd)} encaissés
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1 }}>
            {annualIncome2025 != null ? formatCompactCurrency(annualIncome2025) : '—'}
          </p>
        </button>

        {/* 2026 card */}
        <button
          type="button"
          onClick={() => setModal('2026')}
          style={{
            border: '1px solid var(--neutral-300)',
            borderTop: '2px solid #F97316',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--neutral-0)',
            padding: 'var(--space-3)',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            transition: 'border-color 140ms ease, box-shadow 140ms ease',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 12px rgba(249,115,22,0.14)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none' }}
        >
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: '#EA580C', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            2026 – Projection
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--neutral-600)' }}>
            {formatCompactCurrency(income2026Ytd)} encaissés
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1 }}>
            {formatCompactCurrency(projectedIncome2026)}
          </p>
        </button>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal === '2025' ? (
          <IncomeModal2025
            incomeYtd2025={income2025Ytd}
            incomeAnnual2025={annualIncome2025}
            incomeYtdDeltaPct={incomeYtdDeltaPct}
            onClose={() => setModal(null)}
          />
        ) : modal === '2026' ? (
          <IncomeModal2026
            incomeYtd2026={income2026Ytd}
            assuredMonthlyIncome={assuredMonthlyIncome}
            assuredMonths={assuredMonths}
            projectedIncome2026={projectedIncome2026}
            onClose={() => setModal(null)}
          />
        ) : null}
      </AnimatePresence>
    </>
  )
}

function IncomeModal2025({
  incomeYtd2025,
  incomeAnnual2025,
  incomeYtdDeltaPct,
  onClose,
}: {
  incomeYtd2025: number
  incomeAnnual2025: number | null
  incomeYtdDeltaPct: number | null
  onClose: () => void
}) {
  const deltaText = incomeYtdDeltaPct == null ? '—' : `${incomeYtdDeltaPct > 0 ? '+' : ''}${incomeYtdDeltaPct.toFixed(1)}%`
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,0.6)', backdropFilter: 'blur(4px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-5)' }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', maxWidth: 320, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}
      >
        <div style={{ marginBottom: 'var(--space-4)', borderBottom: '2px solid var(--primary-500)', paddingBottom: 'var(--space-3)' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)' }}>Revenus 2025 — détail</p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--neutral-400)' }}>Rappel des revenus constatés sur l'année 2025</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ModalLine label="Revenus janvier–avril 2025" value={formatCompactCurrency(incomeYtd2025)} />
          <ModalLine label="Revenus constatés fin 2025" value={incomeAnnual2025 != null ? formatCompactCurrency(incomeAnnual2025) : '—'} />
          <ModalLine label="Écart YTD 2025 vs 2026" value={deltaText} />
          <div style={{ borderTop: '1px dashed var(--neutral-200)', margin: '2px 0' }} />
          <ModalLine label="Total revenus 2025" value={incomeAnnual2025 != null ? formatCompactCurrency(incomeAnnual2025) : '—'} bold />
        </div>
        <button type="button" onClick={onClose} style={{ width: '100%', padding: '9px 0', borderRadius: 'var(--radius-full)', border: 'none', background: 'var(--primary-500)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 'var(--space-4)' }}>
          Fermer
        </button>
      </motion.div>
    </motion.div>
  )
}

function IncomeModal2026({
  incomeYtd2026,
  assuredMonthlyIncome,
  assuredMonths,
  projectedIncome2026,
  onClose,
}: {
  incomeYtd2026: number
  assuredMonthlyIncome: number
  assuredMonths: number
  projectedIncome2026: number
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,0.6)', backdropFilter: 'blur(4px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-5)' }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', maxWidth: 320, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}
      >
        <div style={{ marginBottom: 'var(--space-4)', borderBottom: '2px solid #F97316', paddingBottom: 'var(--space-3)' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)' }}>Revenus 2026 — projection</p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--neutral-400)' }}>Encaissés YTD + revenus assurés restants</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ModalLine label="Revenus encaissés YTD 2026" value={formatCompactCurrency(incomeYtd2026)} />
          <ModalLine label={`Revenus assurés (${assuredMonths} mois × ${formatCompactCurrency(assuredMonthlyIncome)})`} value={formatCompactCurrency(assuredMonthlyIncome * assuredMonths)} />
          <div style={{ borderTop: '1px dashed var(--neutral-200)', margin: '2px 0' }} />
          <ModalLine label="Projection fin 2026" value={formatCompactCurrency(projectedIncome2026)} bold />
        </div>
        <button type="button" onClick={onClose} style={{ width: '100%', padding: '9px 0', borderRadius: 'var(--radius-full)', border: 'none', background: '#F97316', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 'var(--space-4)' }}>
          Fermer
        </button>
      </motion.div>
    </motion.div>
  )
}

function ModalLine({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--neutral-600)', lineHeight: 1.3 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: bold ? 800 : 600, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function SavingsInsightKpis() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [hoveredBarId, setHoveredBarId] = useState<string | null>(null)
  const maxValue = Math.max(...SAVINGS_KPI_ROWS.flatMap((row) => [row.y2025, row.y2026]))
  const CHART_H = 148
  const GRIDLINES = [0.25, 0.5, 0.75, 1] as const

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setHoveredBarId(null)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const fmtK = (v: number) =>
    v >= 1000
      ? `${Math.round(v / 1000)}k`
      : `${v}`

  return (
    <div ref={containerRef} style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 12, justifyContent: 'flex-end' }}>
        {([['2025', 'var(--primary-500)'], ['2026', '#F97316']] as const).map(([yr, color]) => (
          <div key={yr} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: 'var(--neutral-600)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{yr}</span>
          </div>
        ))}
      </div>

      {/* 4 metric columns — no min-width, no overflow */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {SAVINGS_KPI_ROWS.map((row) => {
          const deltaPct = row.y2025 !== 0 ? ((row.y2026 - row.y2025) / row.y2025) * 100 : 0
          const deltaPositive = deltaPct >= 0
          const deltaLabel = `${deltaPositive ? '+' : ''}${deltaPct.toFixed(1)}%`
          const deltaColor = deltaPositive ? 'var(--positive-500)' : 'var(--negative-500)'
          const h25 = maxValue > 0 ? Math.max((row.y2025 / maxValue) * CHART_H, 6) : 6
          const h26 = maxValue > 0 ? Math.max((row.y2026 / maxValue) * CHART_H, 6) : 6
          const id25 = `${row.label}-25`
          const id26 = `${row.label}-26`
          const BAR_W = 'clamp(14px, 5vw, 22px)'

          return (
            <div
              key={row.label}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
            >
              {/* ── Chart area with gridlines ── */}
              <div
                style={{
                  width: '100%',
                  height: CHART_H,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: '14%',
                }}
              >
                {/* Background gridlines */}
                {GRIDLINES.map((ratio) => (
                  <div
                    key={ratio}
                    style={{
                      position: 'absolute',
                      bottom: ratio * CHART_H,
                      left: 0,
                      right: 0,
                      height: 1,
                      background: ratio === 1
                        ? 'var(--neutral-300)'
                        : 'var(--neutral-200)',
                      pointerEvents: 'none',
                    }}
                  />
                ))}

                {/* 2025 bar */}
                <button
                  type="button"
                  onMouseEnter={() => setHoveredBarId(id25)}
                  onMouseLeave={() => setHoveredBarId(null)}
                  onClick={() => setHoveredBarId((p) => (p === id25 ? null : id25))}
                  style={{
                    border: 'none',
                    background: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    zIndex: 1,
                  }}
                  aria-label={`Revenus 2025 · ${formatCompactCurrency(row.y2025)}`}
                >
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: hoveredBarId === id25 ? 'var(--primary-600)' : 'var(--neutral-600)',
                    transition: 'color 0.15s',
                    lineHeight: 1,
                  }}>
                    {fmtK(row.y2025)}
                  </span>
                  <span style={{
                    display: 'block',
                    width: BAR_W,
                    height: h25,
                    borderRadius: '4px 4px 0 0',
                    background: hoveredBarId === id25
                      ? 'var(--primary-600)'
                      : 'var(--primary-500)',
                    transition: 'background 0.15s, transform 0.1s',
                    transform: hoveredBarId === id25 ? 'scaleX(1.1)' : 'none',
                    transformOrigin: 'center bottom',
                  }} />
                  <span style={{ fontSize: 8, color: 'var(--neutral-500)', fontWeight: 600, lineHeight: 1 }}>2025</span>
                </button>

                {/* 2026 bar */}
                <button
                  type="button"
                  onMouseEnter={() => setHoveredBarId(id26)}
                  onMouseLeave={() => setHoveredBarId(null)}
                  onClick={() => setHoveredBarId((p) => (p === id26 ? null : id26))}
                  style={{
                    border: 'none',
                    background: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    zIndex: 1,
                  }}
                  aria-label={`2026 · ${formatCompactCurrency(row.y2026)}`}
                >
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: hoveredBarId === id26 ? '#B45309' : 'var(--neutral-600)',
                    transition: 'color 0.15s',
                    lineHeight: 1,
                  }}>
                    {fmtK(row.y2026)}
                  </span>
                  <span style={{
                    display: 'block',
                    width: BAR_W,
                    height: h26,
                    borderRadius: '4px 4px 0 0',
                    background: hoveredBarId === id26
                      ? '#EA580C'
                      : '#F97316',
                    transition: 'background 0.15s, transform 0.1s',
                    transform: hoveredBarId === id26 ? 'scaleX(1.1)' : 'none',
                    transformOrigin: 'center bottom',
                  }} />
                  <span style={{ fontSize: 8, color: 'var(--neutral-500)', fontWeight: 600, lineHeight: 1 }}>2026</span>
                </button>
              </div>

              {/* Metric label — horizontal, wrapping */}
              <p style={{
                margin: 0,
                fontSize: 'clamp(8px, 2.4vw, 10px)',
                lineHeight: 1.25,
                color: 'var(--neutral-700)',
                fontWeight: 600,
                textAlign: 'center',
                wordBreak: 'break-word',
                hyphens: 'auto',
              }}>
                {row.label}
              </p>

              {/* Delta badge */}
              <span style={{
                borderRadius: 'var(--radius-full)',
                padding: '2px 7px',
                fontSize: 10,
                fontWeight: 800,
                color: deltaColor,
                background: `color-mix(in oklab, ${deltaColor} 14%, #FFFFFF 86%)`,
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.4,
              }}>
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

function slideNavButtonStyle(active: boolean): CSSProperties {
  return {
    border: active ? '1px solid color-mix(in oklab, var(--primary-600) 70%, var(--neutral-0) 30%)' : '1px solid transparent',
    background: active ? 'var(--neutral-0)' : 'transparent',
    color: active ? 'var(--primary-700)' : 'var(--neutral-600)',
    borderRadius: 'var(--radius-full)',
    padding: '6px 8px',
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'none',
    cursor: 'pointer',
    transition: 'all 160ms ease',
    whiteSpace: 'nowrap',
  }
}
