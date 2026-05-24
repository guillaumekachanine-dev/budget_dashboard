import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ComparedBucketChart } from '@/features/annual-analysis/components/ComparedBucketChart'
import { ComparedCategoryBars } from '@/features/annual-analysis/components/ComparedCategoryBars'
import { useAnnual2025Analysis } from '@/features/annual-analysis/hooks/useAnnual2025Analysis'
import { useAnnual2026Analysis } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { useComparedAnalysis } from '@/features/annual-analysis/hooks/useComparedAnalysis'
import { EXPENSE_BUCKETS } from '@/features/annual-analysis/components/_constants'
import { MonthlyFlowsAnalysisCard } from '@/features/annual-analysis/components/Annual2026MonthlyTable'
import type { YtdFlowSummary } from '@/features/annual-analysis/types.compared'
import { useBudgetRevenueAnalytics } from '@/features/budget/hooks/useBudgetRevenueAnalytics'
import { useSavingsAnalytics } from '@/features/savings/hooks/useSavingsAnalytics'
import { useMonthlyBudgetForecast } from '@/features/savings/hooks/useMonthlyBudgetForecast'
import { budgetDb } from '@/lib/supabaseBudget'

type InsightId = 'savings' | 'income'
type RepartitionInsightId = 'achats-divers' | 'transport'
type AnalyticsDisplayMode = 'analyse' | 'data'
type ExpandableCardId = InsightId | RepartitionInsightId

const REPARTITION_SLIDE_FRAME_HEIGHT = 438
const SECTION_BORDER_WIDTH = '4px'
const DEEP_YELLOW = '#D4AF37'
const STRUCTURAL_SPEND_MONTHLY = 145
const INSIGHT_2026_MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'] as const
const INSIGHT_2026_MONTH_LABELS_FULL = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const
const SCENARIO2_UNEMPLOYMENT_MONTHLY = 3338
const SCENARIO2_SALARY_MONTHLY = 6500
const SCENARIO2_UNEMPLOYMENT_MONTHS = 4
const SCENARIO2_SALARY_MONTHS = 3

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
    titleValue: '+3',
    titleSuffix: 'postes dépenses\nstructurels',
    subtitle: 'de nouvelles catégories structurelles et ponctuelles impactent le budget 2026',
    detailBody:
      "Le transport devient un poste structurel en 2026, avec une hausse régulière sur les premiers mois et un poids plus significatif dans le budget opérationnel.",
    accentColor: '#FC5A5A',
    topDivergences: [
      { category: 'transport', iconKey: 'transport', deltaLabel: 'x8', y2025: 93, y2026: 701, variant: 'paired' },
      { category: 'abonnements', iconKey: 'abonnements', deltaLabel: 'x2,5', y2025: 166, y2026: 428, variant: 'paired' },
      { category: 'famille/enfant', iconKey: 'famille_enfant', deltaLabel: `+${STRUCTURAL_SPEND_MONTHLY}€`, y2025: 0, y2026: STRUCTURAL_SPEND_MONTHLY, variant: 'single' },
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
  { label: 'Capacité brute', y2025: 31321, y2026: 7335 },
  { label: 'Épargne YTD', y2025: 33500, y2026: 4243 },
]

export function BudgetsAnalyticsTab() {
  const [displayMode, setDisplayMode] = useState<AnalyticsDisplayMode>('analyse')
  const [expandedCardId, setExpandedCardId] = useState<ExpandableCardId | null>(null)
  const [expandedBottomSpacing, setExpandedBottomSpacing] = useState(false)
  const [fluxDataView, setFluxDataView] = useState<'table' | 'chart'>('table')
  const [fluxDataYear, setFluxDataYear] = useState<2025 | 2026>(2026)
  const firstRowExpanded = expandedCardId === 'savings' || expandedCardId === 'income'
  const secondRowExpanded = expandedCardId === REPARTITION_INSIGHTS.achatsDivers.id || expandedCardId === REPARTITION_INSIGHTS.transport.id
  const cardsGridRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<Record<ExpandableCardId, HTMLElement | null>>({
    savings: null,
    income: null,
    'achats-divers': null,
    transport: null,
  })
  const pendingScrollIntentRef = useRef<{ cardId: ExpandableCardId; expanding: boolean } | null>(null)
  const scrollAnimationFrameRef = useRef<number | null>(null)

  const runTravelScroll = (targetTop: number, onComplete?: () => void) => {
    if (typeof window === 'undefined') return
    if (scrollAnimationFrameRef.current != null) {
      window.cancelAnimationFrame(scrollAnimationFrameRef.current)
      scrollAnimationFrameRef.current = null
    }

    const startTop = window.scrollY
    const destination = Math.max(0, targetTop)
    const distance = destination - startTop
    if (Math.abs(distance) < 2) {
      onComplete?.()
      return
    }

    const duration = 280
    const start = performance.now()
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)

    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(1, elapsed / duration)
      const eased = easeOutQuart(progress)
      window.scrollTo(0, startTop + distance * eased)
      if (progress < 1) {
        scrollAnimationFrameRef.current = window.requestAnimationFrame(tick)
      } else {
        scrollAnimationFrameRef.current = null
        onComplete?.()
      }
    }

    scrollAnimationFrameRef.current = window.requestAnimationFrame(tick)
  }

  useEffect(() => {
    if (displayMode !== 'analyse') {
      pendingScrollIntentRef.current = null
      return
    }

    const intent = pendingScrollIntentRef.current
    if (!intent) return
    pendingScrollIntentRef.current = null

    let frameA = 0
    let frameB = 0
    const topOffset = 12

    frameA = window.requestAnimationFrame(() => {
      frameB = window.requestAnimationFrame(() => {
        if (intent.expanding) {
          const cardEl = cardRefs.current[intent.cardId]
          if (!cardEl) return
          const targetTop = window.scrollY + cardEl.getBoundingClientRect().top - topOffset
          runTravelScroll(targetTop, () => {
            setExpandedBottomSpacing(true)
          })
          return
        }

        const gridEl = cardsGridRef.current
        if (!gridEl) return
        const targetTop = window.scrollY + gridEl.getBoundingClientRect().top - topOffset
        runTravelScroll(targetTop)
        setExpandedBottomSpacing(false)
      })
    })

    return () => {
      if (frameA) window.cancelAnimationFrame(frameA)
      if (frameB) window.cancelAnimationFrame(frameB)
    }
  }, [displayMode, expandedCardId])

  useEffect(() => () => {
    if (scrollAnimationFrameRef.current != null) {
      window.cancelAnimationFrame(scrollAnimationFrameRef.current)
    }
  }, [])

  const handleCardToggle = (id: ExpandableCardId) => {
    setExpandedCardId((previous) => {
      const next = previous === id ? null : id
      pendingScrollIntentRef.current = { cardId: id, expanding: next === id }
      if (next === id) {
        setExpandedBottomSpacing(false)
      } else {
        setExpandedBottomSpacing(false)
      }
      return next
    })
  }

  return (
    <section style={{ width: '100%', boxSizing: 'border-box', display: 'grid', gap: displayMode === 'analyse' ? 'var(--space-3)' : 'var(--space-6)' }}>
      {/* ── controls: period info + analyse/data selectors ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', padding: '0 var(--page-gutter)', marginBottom: 0 }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', background: 'var(--neutral-100)', borderRadius: 'var(--radius-md)', padding: '3px', width: 224 }}>
          <button type="button" onClick={() => setDisplayMode('analyse')} style={{ ...analyticsDisplayBtnStyle(displayMode === 'analyse'), textAlign: 'center' }}>
            Analyse
          </button>
          <button type="button" onClick={() => setDisplayMode('data')} style={{ ...analyticsDisplayBtnStyle(displayMode === 'data'), textAlign: 'center' }}>
            Data
          </button>
        </div>
      </div>

      {displayMode === 'analyse' ? (
        <>
          <section
            style={{
              padding: '0 var(--space-4) 0 var(--space-1)',
              width: '100%',
              boxSizing: 'border-box',
              display: 'flex',
            }}
          >
            <div style={{ maxWidth: 640, margin: '0 auto', width: '100%', display: 'flex' }}>
              <motion.div
                ref={cardsGridRef}
                layout
                transition={{ type: 'spring', damping: 28, stiffness: 260, mass: 0.7 }}
                style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  columnGap: 6,
                  rowGap: 'var(--space-3)',
                  alignItems: 'stretch',
                  transform: 'translateX(-8px)',
                }}
              >
                <InsightCard
                  cardRef={(node) => { cardRefs.current.savings = node }}
                  titleValue={FLUX_INSIGHTS.savings.titleValue}
                  titleSuffix={FLUX_INSIGHTS.savings.titleSuffix}
                  isExpanded={expandedCardId === 'savings'}
                  onToggle={() => handleCardToggle('savings')}
                />
                <InsightCard
                  cardRef={(node) => { cardRefs.current.income = node }}
                  titleValue={FLUX_INSIGHTS.income.titleValue}
                  titleSuffix={FLUX_INSIGHTS.income.titleSuffix}
                  isExpanded={expandedCardId === 'income'}
                  onToggle={() => handleCardToggle('income')}
                />

                <AnimatePresence mode="wait" initial={false}>
                  {firstRowExpanded ? (
                    <ExpandedInsightPanel
                      key={expandedCardId}
                      insightId={expandedCardId as InsightId}
                    />
                  ) : null}
                </AnimatePresence>

                <RepartitionInsightCard
                  cardRef={(node) => { cardRefs.current['achats-divers'] = node }}
                  titleValue={REPARTITION_INSIGHTS.achatsDivers.titleValue}
                  titleSuffix={REPARTITION_INSIGHTS.achatsDivers.titleSuffix}
                  isExpanded={expandedCardId === REPARTITION_INSIGHTS.achatsDivers.id}
                  onToggle={() => handleCardToggle(REPARTITION_INSIGHTS.achatsDivers.id)}
                />
                <RepartitionInsightCard
                  cardRef={(node) => { cardRefs.current.transport = node }}
                  titleValue={REPARTITION_INSIGHTS.transport.titleValue}
                  titleSuffix={REPARTITION_INSIGHTS.transport.titleSuffix}
                  isExpanded={expandedCardId === REPARTITION_INSIGHTS.transport.id}
                  onToggle={() => handleCardToggle(REPARTITION_INSIGHTS.transport.id)}
                />

                <AnimatePresence mode="wait" initial={false}>
                  {secondRowExpanded ? (
                    <ExpandedRepartitionInsightPanel
                      key={expandedCardId}
                      insightId={expandedCardId as RepartitionInsightId}
                      detailBody={expandedCardId === REPARTITION_INSIGHTS.achatsDivers.id
                        ? REPARTITION_INSIGHTS.achatsDivers.detailBody
                        : REPARTITION_INSIGHTS.transport.detailBody}
                    />
                  ) : null}
                </AnimatePresence>
              </motion.div>
            </div>
          </section>
          <motion.div
            aria-hidden="true"
            initial={false}
            animate={{
              height: expandedCardId && expandedBottomSpacing
                ? 'calc(var(--space-12) + var(--safe-bottom-offset))'
                : '0px',
            }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            style={{ pointerEvents: 'none' }}
          />
        </>
      ) : (
        <>
          <MajorSectionHeading title="Analyse de la répartition" marginTop="0" />

          <RepartitionComparisonSection />

          <section style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 'max(var(--space-4), calc((100% - 800px) / 2 + var(--space-4)))',
                  width: SECTION_BORDER_WIDTH,
                  background: DEEP_YELLOW,
                  borderRadius: 'var(--radius-full)',
                  pointerEvents: 'none',
                  zIndex: 4,
                }}
              />
              <MonthlyFlowsAnalysisCard
                year={fluxDataYear}
                showInternalViewToggle={false}
                useBalanceOutflowView
                headerRightSlot={(
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: 2, borderRadius: 'var(--radius-sm)', background: 'color-mix(in oklab, var(--primary-500) 10%, var(--neutral-0) 90%)', border: '1px solid color-mix(in oklab, var(--primary-500) 16%, var(--neutral-200) 84%)', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setFluxDataYear(2025)}
                      aria-label="Afficher les données flux 2025"
                      aria-pressed={fluxDataYear === 2025}
                      style={{ ...slideNavButtonStyle(fluxDataYear === 2025), borderRadius: 'var(--radius-sm)', padding: '4px 7px', minHeight: 22, fontSize: 8 }}
                    >
                      2025
                    </button>
                    <button
                      type="button"
                      onClick={() => setFluxDataYear(2026)}
                      aria-label="Afficher les données flux 2026"
                      aria-pressed={fluxDataYear === 2026}
                      style={{ ...slideNavButtonStyle(fluxDataYear === 2026), borderRadius: 'var(--radius-sm)', padding: '4px 7px', minHeight: 22, fontSize: 8 }}
                    >
                      2026
                    </button>
                  </div>
                )}
                forcedView={fluxDataView}
                variant="standalone"
              />
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
                  onClick={() => setFluxDataView('table')}
                  aria-label="Afficher la vue Tableau des flux mensuels"
                  aria-pressed={fluxDataView === 'table'}
                  style={slideNavButtonStyle(fluxDataView === 'table')}
                >
                  Tableau
                </button>
                <button
                  type="button"
                  onClick={() => setFluxDataView('chart')}
                  aria-label="Afficher la vue Graphique des flux mensuels"
                  aria-pressed={fluxDataView === 'chart'}
                  style={slideNavButtonStyle(fluxDataView === 'chart')}
                >
                  Graphique
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </section>
  )
}

function InsightCard({
  cardRef,
  titleValue,
  titleSuffix,
  isExpanded,
  onToggle,
}: {
  cardRef?: (node: HTMLElement | null) => void
  titleValue: string
  titleSuffix: string
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <motion.article
      ref={cardRef}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-2)' }}>
        <div style={{ minWidth: 0, display: 'grid', gap: 4, justifyItems: 'end', textAlign: 'right' }}>
          <p style={{ margin: 0, lineHeight: 1, fontSize: 'clamp(22px, 5.2vw, 30px)', fontWeight: 'var(--font-weight-extrabold)', color: isExpanded ? '#FC5A5A' : DEEP_YELLOW, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
            {titleValue}
          </p>
          <p style={{ margin: 0, fontSize: 'clamp(13px, 3.4vw, 16px)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)', letterSpacing: '-0.01em', lineHeight: 1.1, whiteSpace: 'pre-line' }}>
            {titleSuffix}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={isExpanded ? 'Réduire le détail' : 'Déplier le détail'}
          aria-expanded={isExpanded}
          style={{
            width: 28,
            height: 28,
            borderRadius: 0,
            background: 'transparent',
            border: 'none',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--neutral-900)',
            flexShrink: 0,
            cursor: 'pointer',
          }}
        >
          {isExpanded ? (
            <ChevronDown size={20} strokeWidth={2.6} color="var(--neutral-900)" />
          ) : (
            <ChevronRight size={20} strokeWidth={2.6} color="var(--neutral-900)" />
          )}
        </button>
      </div>

    </motion.article>
  )
}

function ExpandedInsightPanel({
  insightId,
}: {
  insightId: InsightId
}) {
  const { loading, error, flows2025, flows2026 } = useComparedAnalysis()
  const { annualTotals } = useAnnual2025Analysis()
  const { summary: annual2026Summary } = useAnnual2026Analysis()
  const { data: revenueData } = useBudgetRevenueAnalytics()
  const { data: savingsAnalyticsData } = useSavingsAnalytics(2026)
  const { data: planningForecastRows } = useMonthlyBudgetForecast(2026)
  const { data: monthlyExpenseBudgets2026 = [] } = useQuery<Array<{ period_month: number | null; budget_amount: number | null }>>({
    queryKey: ['analytics-insight-income-expense-budgets', 2026],
    queryFn: async () => {
      const { data, error: budgetError } = await budgetDb
        .from('v_monthly_bucket_budgets_clean' as never)
        .select('period_month, budget_bucket, budget_amount')
        .eq('period_year', 2026)
        .in('budget_bucket', [...EXPENSE_BUCKETS])
        .order('period_month', { ascending: true })
      if (budgetError) {
        throw new Error(`analytics insight expense budgets: ${budgetError.message}`)
      }
      return (data ?? []) as Array<{ period_month: number | null; budget_amount: number | null }>
    },
    staleTime: 5 * 60_000,
  })

  const income2025Ytd = flows2025?.income_total ?? 0
  const income2026Ytd = flows2026?.income_total ?? 0
  const annualIncome2025 = annualTotals?.income_total_year ?? null
  const observedCutoffMonth = useMemo(
    () => Math.max(0, ...((flows2026?.months ?? []).map((row) => Number(row.period_month ?? 0)).filter((month) => month >= 1 && month <= 12))),
    [flows2026],
  )
  const monthlyRevenue2026 = useMemo(
    () => (revenueData?.monthlySeries ?? []).filter((row) => row.month_start.startsWith('2026-')),
    [revenueData],
  )
  const ytdRevenue2026 = useMemo(
    () => monthlyRevenue2026.reduce((sum, row) => sum + Number(row.revenue_amount ?? 0), 0),
    [monthlyRevenue2026],
  )
  const projectedIncome2026 = ytdRevenue2026
    + SCENARIO2_UNEMPLOYMENT_MONTHLY * SCENARIO2_UNEMPLOYMENT_MONTHS
    + SCENARIO2_SALARY_MONTHLY * SCENARIO2_SALARY_MONTHS
  const projectedIncomeByMonth = useMemo(() => {
    const map = new Map<number, number>()
    const realIncomeByMonth = new Map<number, number>()

    for (const row of monthlyRevenue2026) {
      const month = Number(row.month_start.slice(5, 7))
      if (month >= 1 && month <= 12) {
        realIncomeByMonth.set(month, Number(row.revenue_amount ?? 0))
      }
    }

    const lastRealMonth = Math.max(0, ...realIncomeByMonth.keys())
    const ytdAnchorMonth = Math.max(
      observedCutoffMonth,
      Math.min(12, Number(annual2026Summary?.ytdMonths ?? lastRealMonth)),
    )

    for (let month = 1; month <= ytdAnchorMonth; month += 1) {
      map.set(month, realIncomeByMonth.get(month) ?? 0)
    }

    for (let offset = 1; offset <= SCENARIO2_UNEMPLOYMENT_MONTHS; offset += 1) {
      const month = ytdAnchorMonth + offset
      if (month > 12) break
      map.set(month, SCENARIO2_UNEMPLOYMENT_MONTHLY)
    }

    for (let offset = 1; offset <= SCENARIO2_SALARY_MONTHS; offset += 1) {
      const month = ytdAnchorMonth + SCENARIO2_UNEMPLOYMENT_MONTHS + offset
      if (month > 12) break
      map.set(month, SCENARIO2_SALARY_MONTHLY)
    }

    return map
  }, [annual2026Summary?.ytdMonths, monthlyRevenue2026, observedCutoffMonth])
  const expenseBudgetByMonth = useMemo(() => {
    const map = new Map<number, number>()
    for (const row of monthlyExpenseBudgets2026) {
      const month = Number(row.period_month ?? 0)
      if (!(month >= 1 && month <= 12)) continue
      map.set(month, (map.get(month) ?? 0) + Number(row.budget_amount ?? 0))
    }
    return map
  }, [monthlyExpenseBudgets2026])
  const planningSavingsByMonth = useMemo(() => {
    const map = new Map<number, number>()
    const savingsMetricsByMonth = new Map<number, number>()

    for (const row of savingsAnalyticsData?.monthlyMetrics ?? []) {
      const month = Number(row.period_month ?? 0)
      if (!(month >= 1 && month <= 12)) continue
      const savedAmount = Number(row.saved_amount ?? 0)
      if (Number.isFinite(savedAmount)) {
        savingsMetricsByMonth.set(month, savedAmount)
      }
    }

    const forecastByMonth = new Map<number, number>()
    for (const row of planningForecastRows ?? []) {
      const month = Number(row.period_month ?? 0)
      if (!(month >= 1 && month <= 12)) continue
      forecastByMonth.set(month, Number(row.planned_savings_budget ?? 0))
    }

    for (let month = 1; month <= 12; month += 1) {
      const isPastOrObserved = month <= observedCutoffMonth
      if (isPastOrObserved) {
        const realized = savingsMetricsByMonth.get(month)
        if (realized != null) {
          map.set(month, realized)
          continue
        }
      }

      const planned = forecastByMonth.get(month)
      if (planned != null) {
        map.set(month, planned)
      }
    }

    return map
  }, [observedCutoffMonth, planningForecastRows, savingsAnalyticsData?.monthlyMetrics])

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
        <InsightKpiRow
          items={[
            { label: 'Revenus', value: '-81%', note: 'hors janvier', accent: 'var(--primary-500)' },
            { label: 'Dépenses', value: '+9,3%', note: 'YTD', accent: '#F97316' },
            { label: 'Épargne', value: '-87%', note: 'YTD', accent: '#C74335' },
          ]}
        />
      ) : null}

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
              assuredMonthlyIncome={SCENARIO2_UNEMPLOYMENT_MONTHLY}
              assuredMonths={SCENARIO2_UNEMPLOYMENT_MONTHS}
              salaryMonthlyIncome={SCENARIO2_SALARY_MONTHLY}
              salaryMonths={SCENARIO2_SALARY_MONTHS}
            />
            <IncomeFullYearProjectedChart
              flows2026={flows2026}
              observedCutoffMonth={observedCutoffMonth}
              projectedIncomeByMonth={projectedIncomeByMonth}
              expenseBudgetByMonth={expenseBudgetByMonth}
              plannedSavingsByMonth={planningSavingsByMonth}
            />
          </div>
        )
      ) : null}
    </motion.section>
  )
}

function formatKTick(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs < 1000) return `${Math.round(value)}`
  return `${Math.round(value / 1000)}k`
}

function IncomeFullYearProjectedChart({
  flows2026,
  observedCutoffMonth,
  projectedIncomeByMonth,
  expenseBudgetByMonth,
  plannedSavingsByMonth,
}: {
  flows2026: YtdFlowSummary | null
  observedCutoffMonth: number
  projectedIncomeByMonth: Map<number, number>
  expenseBudgetByMonth: Map<number, number>
  plannedSavingsByMonth: Map<number, number>
}) {
  const realByMonth = useMemo(() => {
    const map = new Map<number, { income: number; expense: number; savings: number }>()
    for (const row of flows2026?.months ?? []) {
      const month = Number(row.period_month ?? 0)
      if (!(month >= 1 && month <= 12)) continue
      map.set(month, {
        income: Number(row.income_total ?? 0),
        expense: Number(row.expense_total ?? 0),
        savings: Number(row.savings_realized_total ?? 0),
      })
    }
    return map
  }, [flows2026])

  const chartData = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = index + 1
        const isPast = month <= observedCutoffMonth
        const isBoundaryMonth = month === observedCutoffMonth
        const real = realByMonth.get(month) ?? null
        const projectedIncome = projectedIncomeByMonth.get(month)
        const projectedSavings = plannedSavingsByMonth.get(month)

        return {
          month,
          label: INSIGHT_2026_MONTH_LABELS[index],
          labelFull: INSIGHT_2026_MONTH_LABELS_FULL[index],
          period: isPast ? 'past' : 'future',
          incomePast: isPast ? (real?.income ?? null) : null,
          incomeFuture: !isPast ? (projectedIncome ?? null) : (isBoundaryMonth ? (real?.income ?? null) : null),
          expensePast: isPast ? (real?.expense ?? null) : null,
          expenseFuture: !isPast ? (expenseBudgetByMonth.get(month) ?? null) : (isBoundaryMonth ? (real?.expense ?? null) : null),
          savingsPast: isPast ? (real?.savings ?? null) : null,
          savingsFuture: !isPast ? (projectedSavings ?? null) : (isBoundaryMonth ? (real?.savings ?? null) : null),
        }
      }),
    [expenseBudgetByMonth, observedCutoffMonth, plannedSavingsByMonth, projectedIncomeByMonth, realByMonth],
  )

  const chartMinY = 0
  const chartMaxY = useMemo(() => {
    const maxValue = chartData.reduce((acc, row) => {
      const rowMax = Math.max(
        row.incomePast ?? 0,
        row.incomeFuture ?? 0,
        row.expensePast ?? 0,
        row.expenseFuture ?? 0,
        row.savingsPast ?? 0,
        row.savingsFuture ?? 0,
      )
      return Math.max(acc, rowMax)
    }, 0)
    return Math.max(1000, Math.ceil(maxValue / 1000) * 1000)
  }, [chartData])

  const cutoffLabel = observedCutoffMonth >= 1 && observedCutoffMonth <= 12
    ? INSIGHT_2026_MONTH_LABELS[observedCutoffMonth - 1]
    : null

  return (
    <div
      style={{
        background: 'var(--neutral-0)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-3)',
      }}
    >
      <div style={{ display: 'grid', gap: 3, marginBottom: 'var(--space-2)' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-700)' }}>
          Modélisation mensuelle 2026 · revenus, dépenses, épargne
        </p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="income-past" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2ED47A" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#2ED47A" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expense-past" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FC5A5A" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#FC5A5A" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="savings-past" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFAB2E" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#FFAB2E" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-100)" vertical={false} />
          {cutoffLabel ? (
            <ReferenceLine
              x={cutoffLabel}
              stroke="var(--neutral-400)"
              strokeDasharray="4 3"
              strokeWidth={1}
            />
          ) : null}

          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={(props) => {
              const { x, y, payload } = props as { x: number; y: number; payload: { value: string; payload?: { period?: 'past' | 'future' } } }
              const isFuture = payload.payload?.period === 'future'
              return (
                <text
                  x={x}
                  y={y + 12}
                  textAnchor="middle"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  fill={isFuture ? 'var(--neutral-300)' : 'var(--neutral-500)'}
                >
                  {payload.value}
                </text>
              )
            }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={34}
            domain={[chartMinY, chartMaxY]}
            tickCount={5}
            tick={{ fontSize: 10, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}
            tickFormatter={(value: number) => formatKTick(value)}
          />
          <Tooltip content={<IncomeInsightTooltip />} cursor={{ stroke: 'var(--neutral-200)', strokeWidth: 1 }} />

          <Area type="monotone" dataKey="incomePast" stroke="#2ED47A" strokeWidth={2} fill="url(#income-past)" dot={false} activeDot={{ r: 4 }} connectNulls />
          <Area type="monotone" dataKey="expensePast" stroke="#FC5A5A" strokeWidth={2} fill="url(#expense-past)" dot={false} activeDot={{ r: 4 }} connectNulls />
          <Area type="monotone" dataKey="savingsPast" stroke="#FFAB2E" strokeWidth={2} fill="url(#savings-past)" dot={false} activeDot={{ r: 4 }} connectNulls />

          <Area type="monotone" dataKey="incomeFuture" stroke="#2ED47A" strokeWidth={2} strokeDasharray="5 3" strokeOpacity={0.8} fill="none" dot={false} activeDot={{ r: 4 }} connectNulls />
          <Area type="monotone" dataKey="expenseFuture" stroke="#FC5A5A" strokeWidth={2} strokeDasharray="5 3" strokeOpacity={0.8} fill="none" dot={false} activeDot={{ r: 4 }} connectNulls />
          <Area type="monotone" dataKey="savingsFuture" stroke="#FFAB2E" strokeWidth={2} strokeDasharray="5 3" strokeOpacity={0.8} fill="none" dot={false} activeDot={{ r: 4 }} connectNulls />
        </AreaChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--neutral-500)', fontWeight: 700 }}>
          <span aria-hidden="true" style={{ width: 18, borderTop: '2px solid var(--neutral-600)' }} />
          Réel observé
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--neutral-500)', fontWeight: 700 }}>
          <span aria-hidden="true" style={{ width: 18, borderTop: '2px dashed var(--neutral-600)' }} />
          Projection
        </span>
      </div>
    </div>
  )
}

function IncomeInsightTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    payload?: {
      labelFull?: string
      period?: 'past' | 'future'
      incomePast?: number | null
      incomeFuture?: number | null
      expensePast?: number | null
      expenseFuture?: number | null
      savingsPast?: number | null
      savingsFuture?: number | null
    }
  }>
}) {
  if (!active || !payload || payload.length === 0) return null

  const point = payload[0]?.payload
  if (!point) return null

  const income = point.incomePast ?? point.incomeFuture ?? null
  const expense = point.expensePast ?? point.expenseFuture ?? null
  const savings = point.savingsPast ?? point.savingsFuture ?? null
  const periodLabel = point.period === 'future' ? 'Projection' : 'Réel'

  return (
    <div
      style={{
        background: 'var(--neutral-0)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        padding: '8px 10px',
        minWidth: 190,
        display: 'grid',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-900)' }}>{point.labelFull ?? '—'}</span>
        <span style={{ fontSize: 9, fontWeight: 800, color: point.period === 'future' ? '#EA580C' : 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {periodLabel}
        </span>
      </div>
      <div style={{ display: 'grid', gap: 3 }}>
        <TooltipLine label="Revenus" value={income} color="#2ED47A" />
        <TooltipLine label="Dépenses" value={expense} color="#FC5A5A" />
        <TooltipLine label="Épargne" value={savings} color="#FFAB2E" />
      </div>
    </div>
  )
}

function TooltipLine({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--neutral-700)' }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        {label}
      </span>
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-900)' }}>
        {value == null ? '—' : formatCompactCurrency(value)}
      </span>
    </div>
  )
}

function RepartitionInsightCard({
  cardRef,
  titleValue,
  titleSuffix,
  isExpanded,
  onToggle,
}: {
  cardRef?: (node: HTMLElement | null) => void
  titleValue: string
  titleSuffix: string
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <motion.article
      ref={cardRef}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-2)' }}>
        <div style={{ minWidth: 0, display: 'grid', gap: 4, justifyItems: 'end', textAlign: 'right' }}>
          <p style={{ margin: 0, lineHeight: 1, fontSize: 'clamp(22px, 5.2vw, 30px)', fontWeight: 'var(--font-weight-extrabold)', color: isExpanded ? '#FC5A5A' : DEEP_YELLOW, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
            {titleValue}
          </p>
          <p style={{ margin: 0, fontSize: 'clamp(13px, 3.4vw, 16px)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)', letterSpacing: '-0.01em', lineHeight: 1.1, whiteSpace: 'pre-line' }}>
            {titleSuffix}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={isExpanded ? 'Réduire le détail' : 'Déplier le détail'}
          aria-expanded={isExpanded}
          style={{
            width: 28,
            height: 28,
            borderRadius: 0,
            background: 'transparent',
            border: 'none',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--neutral-900)',
            flexShrink: 0,
            cursor: 'pointer',
          }}
        >
          {isExpanded ? (
            <ChevronDown size={20} strokeWidth={2.6} color="var(--neutral-900)" />
          ) : (
            <ChevronRight size={20} strokeWidth={2.6} color="var(--neutral-900)" />
          )}
        </button>
      </div>

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
      {insightId !== REPARTITION_INSIGHTS.transport.id ? (
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
      ) : (
        <InsightKpiRow
          items={[
            { label: 'Transport', value: 'x8', note: 'YTD', accent: 'var(--primary-500)' },
            { label: 'Abonn.', value: 'x2,5', note: 'YTD', accent: '#F97316' },
            { label: 'Enfant', value: `+${STRUCTURAL_SPEND_MONTHLY}€`, note: 'mensuel', accent: '#FFAB2E' },
          ]}
        />
      )}

      {insightId === REPARTITION_INSIGHTS.achatsDivers.id ? <AchatsDiversExpandedContent /> : null}
      {insightId === REPARTITION_INSIGHTS.transport.id ? <TransportExpandedContent /> : null}
    </motion.section>
  )
}

type InsightKpiItem = {
  label: string
  value: string
  note?: string
  accent: string
}

function InsightKpiRow({ items }: { items: InsightKpiItem[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-3)' }}>
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          style={{
            border: '1px solid var(--neutral-300)',
            borderTop: `2px solid ${item.accent}`,
            borderRadius: 'var(--radius-lg)',
            background: 'var(--neutral-0)',
            padding: '8px var(--space-3)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            minHeight: 58,
          }}
        >
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: item.accent, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {item.label}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1, whiteSpace: 'nowrap' }}>
            {item.value}
          </p>
          {item.note ? <p style={{ margin: '1px 0 0', fontSize: 9, color: 'var(--neutral-500)', lineHeight: 1 }}>{item.note}</p> : null}
        </div>
      ))}
    </div>
  )
}

function TransportExpandedContent() {
  const rows = REPARTITION_INSIGHTS.transport.topDivergences
  const maxValue = Math.max(...rows.flatMap((row) => [row.y2025, row.y2026]), STRUCTURAL_SPEND_MONTHLY, 1)

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
          <LegendDot color="#FFAB2E" label="budget mensuel" />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 'var(--space-2)',
          alignItems: 'end',
          paddingBottom: 'var(--space-2)',
          minWidth: 0,
        }}
      >
        {rows.map((row) => {
          const h2025 = Math.max((row.y2025 / maxValue) * 104, 8)
          const h2026 = Math.max((row.y2026 / maxValue) * 104, 8)

          return (
            <div key={row.category} style={{ minWidth: 0, display: 'grid', gap: 4, justifyItems: 'center' }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#C74335',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1,
                }}
              >
                {row.deltaLabel}
              </span>

              <div style={{ height: 106, display: 'flex', alignItems: 'end', gap: 8, marginTop: 14 }}>
                {row.variant === 'paired' ? (
                  <>
                    <div style={{ position: 'relative', width: 18, height: '100%' }}>
                      <span
                        style={{
                          position: 'absolute',
                          left: '50%',
                          bottom: h2025 + 4,
                          transform: 'translateX(-50%)',
                          fontSize: 8,
                          lineHeight: 1,
                          color: '#5B6070',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatCompactCurrency(row.y2025).replace(/\s*€/u, '€')}
                      </span>
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          bottom: 0,
                          width: 18,
                          height: h2025,
                          borderRadius: '6px 6px 0 0',
                          background: '#5C6276',
                        }}
                      />
                    </div>
                    <div style={{ position: 'relative', width: 18, height: '100%' }}>
                      <span
                        style={{
                          position: 'absolute',
                          left: '50%',
                          bottom: h2026 + 4,
                          transform: 'translateX(-50%)',
                          fontSize: 8,
                          lineHeight: 1,
                          color: '#5B6070',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatCompactCurrency(row.y2026).replace(/\s*€/u, '€')}
                      </span>
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          bottom: 0,
                          width: 18,
                          height: h2026,
                          borderRadius: '6px 6px 0 0',
                          background: '#2ED47A',
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div style={{ position: 'relative', width: 24, height: '100%' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: h2026 + 4,
                        transform: 'translateX(-50%)',
                        fontSize: 8,
                        lineHeight: 1,
                        color: '#5B6070',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatCompactCurrency(row.y2026).replace(/\s*€/u, '€')}
                    </span>
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        bottom: 0,
                        width: 24,
                        height: h2026,
                        borderRadius: '6px 6px 0 0',
                        background: '#FFAB2E',
                      }}
                    />
                  </div>
                )}
              </div>

              <p
                style={{
                  margin: 0,
                  minHeight: 22,
                  textAlign: 'center',
                  fontSize: 10,
                  lineHeight: 1.15,
                  fontWeight: 700,
                  color: '#5B6070',
                  textTransform: 'none',
                }}
              >
                {row.category}
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
          valueFontSize="var(--font-size-base)"
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
          fontSize: 18,
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
          fontSize: valueFontSize ?? 'var(--font-size-lg)',
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
  salaryMonthlyIncome,
  salaryMonths,
}: {
  income2025Ytd: number
  annualIncome2025: number | null
  income2026Ytd: number
  projectedIncome2026: number
  assuredMonthlyIncome: number
  assuredMonths: number
  salaryMonthlyIncome: number
  salaryMonths: number
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
            padding: '8px var(--space-3)',
            textAlign: 'center',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            transition: 'border-color 140ms ease, box-shadow 140ms ease',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 12px rgba(91,87,245,0.14)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none' }}
        >
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--primary-500)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            2025 – Revenus
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1 }}>
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
            padding: '8px var(--space-3)',
            textAlign: 'center',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            transition: 'border-color 140ms ease, box-shadow 140ms ease',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 12px rgba(249,115,22,0.14)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none' }}
        >
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: '#EA580C', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            2026 – Projection
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1 }}>
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
            salaryMonthlyIncome={salaryMonthlyIncome}
            salaryMonths={salaryMonths}
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
  salaryMonthlyIncome,
  salaryMonths,
  projectedIncome2026,
  onClose,
}: {
  incomeYtd2026: number
  assuredMonthlyIncome: number
  assuredMonths: number
  salaryMonthlyIncome: number
  salaryMonths: number
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
          <ModalLine label={`Indemnités chômage (${assuredMonths} mois × ${formatCompactCurrency(assuredMonthlyIncome)})`} value={formatCompactCurrency(assuredMonthlyIncome * assuredMonths)} />
          <ModalLine label={`Salaire + primes (${salaryMonths} mois × ${formatCompactCurrency(salaryMonthlyIncome)})`} value={formatCompactCurrency(salaryMonthlyIncome * salaryMonths)} />
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
                whiteSpace: row.label === 'Capacité brute' ? 'nowrap' : 'normal',
                wordBreak: 'break-word',
                hyphens: 'auto',
              }}>
                {row.label}
              </p>

              {/* Delta badge */}
              <span style={{
                borderRadius: 'var(--radius-full)',
                padding: '2px 6px',
                fontSize: 9,
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

function analyticsDisplayBtnStyle(active: boolean): CSSProperties {
  return {
    border: active ? '2px solid var(--neutral-900)' : '1px solid var(--neutral-200)',
    background: active ? 'var(--primary-50)' : 'var(--neutral-0)',
    color: active ? 'var(--primary-700)' : 'var(--neutral-600)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-2) var(--space-4)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 700,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all var(--transition-base)',
    minHeight: 36,
  }
}

function slideNavButtonStyle(active: boolean): CSSProperties {
  return {
    border: active ? '1px solid color-mix(in oklab, var(--primary-600) 70%, var(--neutral-0) 30%)' : '1px solid transparent',
    background: active ? 'var(--neutral-0)' : 'transparent',
    color: active ? 'var(--primary-700)' : 'var(--neutral-600)',
    borderRadius: 'var(--radius-full)',
    padding: '6px 8px',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'none',
    cursor: 'pointer',
    transition: 'all 160ms ease',
    whiteSpace: 'nowrap',
  }
}
