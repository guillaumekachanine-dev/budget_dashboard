import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { PageHeader } from '@/components/layout/PageHeader'
import { lockDocumentScroll } from '@/lib/scrollLock'
import optimisationIcon from '@/assets/icons/app/epargne_optimisation.webp'
import planning2026Icon from '@/assets/icons/app/epargne_planning_2026.webp'
import performanceIcon from '@/assets/icons/app/epargne_performance.webp'
import epargneIcon from '@/assets/icons/app/epargne_accueil.webp'
import type { SavingsCurrentSummary } from '@/features/savings/types'
import { useStatsReferenceData } from '@/features/stats/hooks/useStatsReferenceData'
import { useAnnual2026Analysis } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { SavingsAllocationDonut } from '@/features/savings/components/SavingsAllocationDonut'
import { SavingsEvolutionFiveYearsChart } from '@/features/savings/components/SavingsEvolutionFiveYearsChart'
import { SavingsPlanning2026Section } from '@/features/savings/components/SavingsPlanning2026Section'
import { SavingsPortfoliosListSection } from '@/features/savings/components/SavingsPortfoliosListSection'
import { useSavingsActualsByMonth } from '@/features/savings/hooks/useSavingsActualsByMonth'
import { useSavingsAnalytics } from '@/features/savings/hooks/useSavingsAnalytics'
import { useSavingsEvolutionFiveYears } from '@/features/savings/hooks/useSavingsEvolutionFiveYears'
import { useSavingsPlanningMonthDetails } from '@/features/savings/hooks/useSavingsPlanningMonthDetails'
import { StatsOptimizationsTab } from '@/features/stats/components/StatsOptimizationsTab'
import { useOptimizationCapacity } from '@/features/stats/hooks/useOptimizationCapacity'
import { getBudgetLinesForPeriod } from '@/features/budget/api/getBudgetLinesForPeriod'
import { useBudgetPagePayload } from '@/features/budget/hooks/useBudgetPagePayload'
import { useAuth } from '@/hooks/useAuth'

type StatsTabId = 'epargne' | 'planning_2026' | 'performance' | 'optimisation'
type StatsTabConfig = {
  id: StatsTabId
  label: string
  iconSrc: string
}
const STATS_TABS: StatsTabConfig[] = [
  { id: 'epargne', label: 'Épargne', iconSrc: epargneIcon },
  { id: 'planning_2026', label: 'Planning', iconSrc: planning2026Icon },
  { id: 'performance', label: 'Performance', iconSrc: performanceIcon },
  { id: 'optimisation', label: 'Optimisation', iconSrc: optimisationIcon },
]

type PerformanceViewMode = 'performance' | 'capital_investi'
type KpiTone = 'neutral' | 'warning' | 'primary'

type KpiTileItem = {
  label: string
  value: string
  tone: KpiTone
  detail?: string
  detailTone?: 'neutral' | 'positive' | 'negative'
  backgroundColor?: string
  borderColor?: string
  labelColor?: string
  valueColor?: string
  labelFontSize?: number
  labelLetterSpacing?: string
  labelNoWrap?: boolean
}

type PlanningProgress = {
  currentAmount: number
  targetAmount: number
  progressionPct: number
}

type OptimizationPeriodId =
  | '2026-05'
  | '2026-06'
  | '2026-07'
  | '2026-08'
  | '2026-09'
  | '2026-10'
  | '2026-11'
  | '2026-12'
  | '2026-full'

type OptimizationPeriodOption = {
  id: OptimizationPeriodId
  label: string
  shortLabel: string
  mode: 'month' | 'year'
}

const PLANNED_SAVINGS_2026 = 9800
const PLANNING_MONTHS_2026 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
const DEFAULT_MONTHLY_OBJECTIVES_2026: Record<number, number> = {
  1: 1200,
  2: 1000,
  3: 1000,
  4: 1000,
  5: 1000,
  6: 800,
  7: 500,
  8: 600,
  9: 1000,
  10: 1200,
  11: 1000,
  12: 700,
}
const OPTIMIZATION_YEAR = 2026
const OPTIMIZATION_ANNUAL_GAIN_MONTHS = 6
const PLANNED_SAVINGS_PCT_2026 = 17.8
const OPTIMIZATION_PERIOD_OPTIONS: OptimizationPeriodOption[] = [
  { id: '2026-05', label: 'Mai 2026', shortLabel: 'Mai 26', mode: 'month' },
  { id: '2026-06', label: 'Juin 2026', shortLabel: 'Juin 26', mode: 'month' },
  { id: '2026-07', label: 'Juillet 2026', shortLabel: 'Juil 26', mode: 'month' },
  { id: '2026-08', label: 'Août 2026', shortLabel: 'Août 26', mode: 'month' },
  { id: '2026-09', label: 'Septembre 2026', shortLabel: 'Sep 26', mode: 'month' },
  { id: '2026-10', label: 'Octobre 2026', shortLabel: 'Oct 26', mode: 'month' },
  { id: '2026-11', label: 'Novembre 2026', shortLabel: 'Nov 26', mode: 'month' },
  { id: '2026-12', label: 'Décembre 2026', shortLabel: 'Déc 26', mode: 'month' },
  { id: '2026-full', label: 'année 2026', shortLabel: '2026', mode: 'year' },
]

function formatKpiCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatKpiPercent(value: number | null | undefined, options?: { signed?: boolean }): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = options?.signed && value > 0 ? '+' : ''
  return `${sign}${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`
}


function resolveKpiTileStyle(tone: KpiTone): React.CSSProperties {
  if (tone === 'warning') {
    return {
      background: 'color-mix(in oklab, var(--color-warning) 10%, var(--neutral-0) 90%)',
      border: '1.5px solid color-mix(in oklab, var(--color-warning) 72%, var(--neutral-200) 28%)',
    }
  }

  if (tone === 'primary') {
    return {
      background: 'color-mix(in oklab, var(--primary-500) 10%, var(--neutral-0) 90%)',
      border: '1.5px solid color-mix(in oklab, var(--primary-500) 72%, var(--neutral-200) 28%)',
    }
  }

  return {
    background: 'var(--neutral-0)',
    border: '1.5px solid var(--neutral-200)',
  }
}

function KpiTilesRow({ items }: { items: KpiTileItem[] }) {
  return (
    <div style={{ padding: '0 var(--page-gutter)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, items.length)}, minmax(0, 1fr))`, gap: 'var(--space-2)' }}>
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              ...resolveKpiTileStyle(item.tone),
              ...(item.backgroundColor ? { background: item.backgroundColor } : null),
              ...(item.borderColor ? { border: `1.5px solid ${item.borderColor}` } : null),
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-3)',
              minHeight: 58,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: item.labelFontSize ?? 9, fontWeight: 700, color: item.labelColor ?? 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: item.labelLetterSpacing ?? '0.06em', lineHeight: 1.2, whiteSpace: item.labelNoWrap ? 'nowrap' : 'normal' }}>
              {item.label}
            </p>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: item.valueColor ?? 'var(--neutral-900)', lineHeight: 1 }}>
              {item.value}
            </p>
            {item.detail ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color: item.detailTone === 'positive'
                    ? 'var(--color-positive)'
                    : item.detailTone === 'negative'
                      ? 'var(--color-negative)'
                      : 'var(--neutral-500)',
                }}
              >
                {item.detail}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function PlanningProgressBar({ progress }: { progress: PlanningProgress }) {
  const safePct = Number.isFinite(progress.progressionPct) ? Math.max(0, Math.min(100, progress.progressionPct)) : 0

  return (
    <div style={{ padding: '0 var(--page-gutter)' }}>
      <div style={{ height: 6, borderRadius: 'var(--radius-full)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${safePct}%`,
            background: 'linear-gradient(90deg, var(--color-warning) 0%, color-mix(in oklab, var(--color-warning) 65%, var(--primary-500) 35%) 100%)',
            transition: 'width 480ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>
      <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', columnGap: 'var(--space-3)' }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--neutral-500)', textAlign: 'left', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
          {formatKpiPercent(safePct)}
        </p>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--neutral-500)', textAlign: 'center', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
          {formatKpiCurrency(progress.currentAmount)}
        </p>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--neutral-500)', textAlign: 'right', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
          {formatKpiCurrency(progress.targetAmount)}
        </p>
      </div>
    </div>
  )
}

function SavingsBreakdownBar({ currentSummary }: { currentSummary: SavingsCurrentSummary | null | undefined }) {
  const livretsSharePct = Number(currentSummary?.livrets_share_pct ?? 0)
  const placementsSharePct = Number(currentSummary?.placements_share_pct ?? 0)

  return (
    <div style={{ padding: '0 var(--page-gutter)' }}>
      <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--neutral-150)', overflow: 'hidden', background: 'var(--neutral-0)' }}>
        {/* Barre proportionnelle */}
        <div style={{ height: 5, display: 'flex' }}>
          <div style={{ width: `${livretsSharePct}%`, background: 'var(--color-positive)', transition: 'width 600ms cubic-bezier(0.22, 1, 0.36, 1)' }} />
          <div style={{ flex: 1, background: 'var(--color-warning)' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr' }}>
          {/* Livrets */}
          <div style={{ padding: '10px var(--space-3)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-positive)', flexShrink: 0 }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Livrets
              </span>
            </div>
            <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--neutral-900)' }}>
              {formatKpiCurrency(currentSummary?.livrets_total)}
            </p>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'color-mix(in oklab, var(--color-positive) 80%, var(--neutral-700) 20%)', fontFamily: 'var(--font-mono)' }}>
              {livretsSharePct > 0 ? `${Math.round(livretsSharePct)}%` : '—'}
            </p>
          </div>

          {/* Séparateur vertical */}
          <div style={{ background: 'var(--neutral-100)', margin: 'var(--space-2) 0' }} />

          {/* Placements */}
          <div style={{ padding: '10px var(--space-3)', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Placements
              </span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-warning)', flexShrink: 0 }} />
            </div>
            <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--neutral-900)' }}>
              {formatKpiCurrency(currentSummary?.placements_total)}
            </p>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'color-mix(in oklab, var(--color-warning) 80%, var(--neutral-700) 20%)', fontFamily: 'var(--font-mono)' }}>
              {placementsSharePct > 0 ? `${Math.round(placementsSharePct)}%` : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function performanceToggleBtnStyle(active: boolean): React.CSSProperties {
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

export function Epargne() {
  const currentYear = new Date().getFullYear()
  const { user } = useAuth()
  const {
    snapshot,
    loading,
    isHydrated,
    storeUserId,
    hydrateStatsReferenceData,
    resetSelectedPeriodToDefault,
  } = useStatsReferenceData()
  const annual2026 = useAnnual2026Analysis()
  const optimizationCapacity = useOptimizationCapacity(OPTIMIZATION_YEAR)
  const savingsAnalytics = useSavingsAnalytics(currentYear)
  const savingsEvolution = useSavingsEvolutionFiveYears()
  const { byMonth: savingsActualsByMonth } = useSavingsActualsByMonth(user?.id, 2026)
  const { data: planningMonthDetails = [] } = useSavingsPlanningMonthDetails(user?.id, 2026)

  const [activeTabId, setActiveTabId] = useState<StatsTabId>('epargne')
  const [optimizationPeriodId, setOptimizationPeriodId] = useState<OptimizationPeriodId>('2026-05')
  const [showTabModal, setShowTabModal] = useState(false)
  const [performanceViewMode, setPerformanceViewMode] = useState<PerformanceViewMode>('performance')
  const hasAppliedDefaultPeriodRef = useRef(false)

  const activeTab = useMemo(
    () => STATS_TABS.find((tab) => tab.id === activeTabId) ?? STATS_TABS[0],
    [activeTabId],
  )
  const optimizationPeriod = useMemo(
    () => OPTIMIZATION_PERIOD_OPTIONS.find((option) => option.id === optimizationPeriodId) ?? OPTIMIZATION_PERIOD_OPTIONS[0],
    [optimizationPeriodId],
  )
  const optimizationSelectedMonth = useMemo<number | null>(() => {
    if (optimizationPeriod.mode !== 'month') return null
    const monthRaw = optimizationPeriod.id.slice(-2)
    const month = Number(monthRaw)
    if (!Number.isFinite(month) || month < 1 || month > 12) return null
    return month
  }, [optimizationPeriod.id, optimizationPeriod.mode])

  const { data: optimizationBudgetLines } = useQuery({
    queryKey: ['optimization-period-budget-lines', OPTIMIZATION_YEAR, optimizationSelectedMonth],
    enabled: optimizationSelectedMonth != null,
    queryFn: async () => {
      if (optimizationSelectedMonth == null) return []
      const result = await getBudgetLinesForPeriod({ year: OPTIMIZATION_YEAR, month: optimizationSelectedMonth })
      return result.categoryLines
    },
    staleTime: 1000 * 60 * 10,
  })

  const optimizationMonthlyBudgetByCategory = useMemo(() => {
    const normalize = (value: string | null | undefined) => (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()

    const byCategory = new Map<string, number>()
    for (const line of optimizationBudgetLines ?? []) {
      const key = normalize(line.category_name)
      if (!key) continue
      byCategory.set(key, Number(line.amount ?? 0))
    }
    return byCategory
  }, [optimizationBudgetLines])
  const optimizationBudgetPayloadQuery = useBudgetPagePayload({
    periodYear: OPTIMIZATION_YEAR,
    periodMonth: optimizationSelectedMonth ?? 12,
    monthsBack: 6,
  })
  const optimizationMonthlyActualByCategory = useMemo(() => {
    const normalize = (value: string | null | undefined) => (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()

    const byCategory = new Map<string, number>()
    const rows = optimizationBudgetPayloadQuery.data?.by_category ?? []
    for (const row of rows) {
      const key = normalize(row.category_name)
      if (!key) continue
      byCategory.set(key, Number(row.actual_amount ?? 0))
    }
    return byCategory
  }, [optimizationBudgetPayloadQuery.data?.by_category])

  const objective2026Actualized = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYearNow = now.getFullYear()
    const isPastPlanningMonth = (periodMonth: number) => {
      if (currentYearNow > 2026) return true
      if (currentYearNow < 2026) return false
      return periodMonth < currentMonth
    }

    const objectiveByMonth: Record<number, number> = { ...DEFAULT_MONTHLY_OBJECTIVES_2026 }
    for (const row of planningMonthDetails) {
      objectiveByMonth[row.period_month] = Number(row.monthly_objective_amount ?? 0)
    }

    // Objectif 2026 actualisé = réel des mois clôturés + objectifs des mois non clôturés.
    return PLANNING_MONTHS_2026.reduce((sum, month) => {
      if (isPastPlanningMonth(month)) {
        return sum + Number(savingsActualsByMonth[month]?.actual_savings_amount_eur ?? 0)
      }
      return sum + Number(objectiveByMonth[month] ?? 0)
    }, 0)
  }, [planningMonthDetails, savingsActualsByMonth])

  const planningKpis = useMemo<KpiTileItem[]>(() => {
    const monthlyMetrics = savingsAnalytics.data?.monthlyMetrics ?? []
    const latestYtdRow = [...monthlyMetrics]
      .reverse()
      .find((row) => row.ytd_saved_amount != null)
    const epargneYtd = latestYtdRow?.ytd_saved_amount
      ?? monthlyMetrics.reduce((sum, row) => sum + Number(row.saved_amount ?? 0), 0)

    return [
      {
        label: 'Épargne YTD',
        value: formatKpiCurrency(epargneYtd),
        tone: 'neutral',
        backgroundColor: 'var(--color-warning)',
        borderColor: 'color-mix(in oklab, var(--color-warning) 78%, var(--neutral-300) 22%)',
        labelColor: '#fff',
        valueColor: '#fff',
      },
      {
        label: 'Objectif 2026',
        value: formatKpiCurrency(objective2026Actualized),
        tone: 'warning',
        backgroundColor: '#0E7490',
        borderColor: 'color-mix(in oklab, #0E7490 72%, var(--neutral-300) 28%)',
        labelColor: '#FCD34D',
        valueColor: '#FCD34D',
      },
    ]
  }, [objective2026Actualized, savingsAnalytics.data?.monthlyMetrics])

  const optimizationAnnualObjective = useMemo(() => {
    const listedLevers = (optimizationCapacity.data?.optimization_levers ?? []).slice(0, 8)
    return listedLevers.reduce((sum, lever) => {
      const monthlyOptimization = Number(lever.realistic_monthly_gain ?? 0)
      if (!Number.isFinite(monthlyOptimization)) return sum
      return sum + (monthlyOptimization * OPTIMIZATION_ANNUAL_GAIN_MONTHS)
    }, 0)
  }, [optimizationCapacity.data?.optimization_levers])

  const annualHorizon = useMemo(() => {
    if (!annual2026.summary) return null

    const potentialAnnual = optimizationAnnualObjective
    const plannedAnnual = PLANNED_SAVINGS_2026
    const projectedAnnual = plannedAnnual + potentialAnnual
    const plannedShare = projectedAnnual > 0 ? (plannedAnnual / projectedAnnual) * 100 : 0
    const potentialShare = projectedAnnual > 0 ? (potentialAnnual / projectedAnnual) * 100 : 0
    const revenueReference = plannedAnnual / (PLANNED_SAVINGS_PCT_2026 / 100)
    const finalObjectivePct = revenueReference > 0 ? (projectedAnnual / revenueReference) * 100 : 0

    return {
      plannedAnnual,
      potentialAnnual,
      projectedAnnual,
      plannedShare,
      potentialShare,
      finalObjectivePct,
    }
  }, [annual2026.summary, optimizationAnnualObjective])

  const planningProgress = useMemo<PlanningProgress>(() => {
    const monthlyMetrics = savingsAnalytics.data?.monthlyMetrics ?? []
    const latestYtdRow = [...monthlyMetrics]
      .reverse()
      .find((row) => row.ytd_saved_amount != null)
    const currentAmount = latestYtdRow?.ytd_saved_amount
      ?? monthlyMetrics.reduce((sum, row) => sum + Number(row.saved_amount ?? 0), 0)
    const targetAmount = PLANNED_SAVINGS_2026
    const progressionPct = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0
    return { currentAmount, targetAmount, progressionPct }
  }, [savingsAnalytics.data?.monthlyMetrics])

  const performanceKpis = useMemo<KpiTileItem[]>(() => {
    const payload = savingsEvolution.data
    const totalCurrentSavings = Number(savingsAnalytics.data?.currentSummary?.total_savings ?? 0)
    if (!payload) {
      return [
        {
          label: 'Capital investi',
          value: '—',
          tone: 'neutral',
          backgroundColor: '#C2410C',
          borderColor: 'color-mix(in oklab, #C2410C 74%, var(--neutral-300) 26%)',
          labelColor: '#fff',
          valueColor: '#fff',
        },
        {
          label: 'Valeur actuelle',
          value: '—',
          tone: 'primary',
          backgroundColor: '#1D4ED8',
          borderColor: 'color-mix(in oklab, #1D4ED8 74%, var(--neutral-300) 26%)',
          labelColor: '#FCD34D',
          valueColor: '#FCD34D',
          labelFontSize: 8,
          labelLetterSpacing: '0.04em',
          labelNoWrap: true,
        },
        {
          label: 'Rend.moyen',
          value: '—',
          tone: 'warning',
          backgroundColor: '#059669',
          borderColor: 'color-mix(in oklab, #059669 74%, var(--neutral-300) 26%)',
          labelColor: '#FCD34D',
          valueColor: '#FCD34D',
        },
      ]
    }

    const { rows, series, yearly_account_metrics: yearlyMetrics } = payload
    const rowForYear = [...rows].sort((a, b) => Number(b.year) - Number(a.year))[0] ?? null

    if (!rowForYear) {
      return [
        {
          label: 'Capital investi',
          value: '—',
          tone: 'neutral',
          backgroundColor: '#C2410C',
          borderColor: 'color-mix(in oklab, #C2410C 74%, var(--neutral-300) 26%)',
          labelColor: '#fff',
          valueColor: '#fff',
        },
        {
          label: 'Valeur actuelle',
          value: '—',
          tone: 'primary',
          backgroundColor: '#1D4ED8',
          borderColor: 'color-mix(in oklab, #1D4ED8 74%, var(--neutral-300) 26%)',
          labelColor: '#FCD34D',
          valueColor: '#FCD34D',
          labelFontSize: 8,
          labelLetterSpacing: '0.04em',
          labelNoWrap: true,
        },
        {
          label: 'Rend.moyen',
          value: '—',
          tone: 'warning',
          backgroundColor: '#059669',
          borderColor: 'color-mix(in oklab, #059669 74%, var(--neutral-300) 26%)',
          labelColor: '#FCD34D',
          valueColor: '#FCD34D',
        },
      ]
    }

    const capitalInvestiFromOperations = payload.operation_events.reduce((sum, event) => {
      if (event.nature !== 'virement' || event.amount <= 0) return sum
      return sum + event.amount
    }, 0)
    const capitalInvestiFromMetrics = Object.values(yearlyMetrics).reduce((sum, metric) => {
      const saved = Number(metric.total_saved_amount ?? 0)
      return sum + (Number.isFinite(saved) && saved > 0 ? saved : 0)
    }, 0)
    const capitalInvesti = capitalInvestiFromOperations > 0 ? capitalInvestiFromOperations : capitalInvestiFromMetrics

    const totalCurrentSavingsFromRows = series.reduce((sum, entry) => {
      const amount = Number(rowForYear[entry.key] ?? 0)
      return sum + (Number.isFinite(amount) ? amount : 0)
    }, 0)
    const totalSavingsCurrent = totalCurrentSavings > 0 ? totalCurrentSavings : totalCurrentSavingsFromRows
    const evolutionPct = capitalInvesti > 0 ? ((totalSavingsCurrent - capitalInvesti) / capitalInvesti) * 100 : null

    return [
      {
        label: 'Capital placé',
        value: formatKpiCurrency(capitalInvesti),
        tone: 'neutral',
        backgroundColor: '#C2410C',
        borderColor: 'color-mix(in oklab, #C2410C 74%, var(--neutral-300) 26%)',
        labelColor: '#fff',
        valueColor: '#fff',
      },
      {
        label: 'Valeur actuelle',
        value: formatKpiCurrency(totalSavingsCurrent),
        tone: 'primary',
        backgroundColor: '#1D4ED8',
        borderColor: 'color-mix(in oklab, #1D4ED8 74%, var(--neutral-300) 26%)',
        labelColor: '#FCD34D',
        valueColor: '#FCD34D',
        labelFontSize: 8,
        labelLetterSpacing: '0.04em',
        labelNoWrap: true,
      },
      {
        label: 'Rend.moyen',
        value: formatKpiPercent(evolutionPct, { signed: true }),
        tone: 'warning',
        backgroundColor: '#059669',
        borderColor: 'color-mix(in oklab, #059669 74%, var(--neutral-300) 26%)',
        labelColor: '#FCD34D',
        valueColor: '#FCD34D',
      },
    ]
  }, [savingsAnalytics.data?.currentSummary?.total_savings, savingsEvolution.data])

  const performanceOverviewKpis = useMemo(
    () => performanceKpis.map((item) => ({ label: item.label, value: item.value })),
    [performanceKpis],
  )

  const handleToggleTabModal = useCallback(() => {
    setShowTabModal((current) => !current)
  }, [])

  const handleSelectTab = useCallback((tabId: StatsTabId) => {
    setActiveTabId(tabId)
    setShowTabModal(false)
  }, [])

  useEffect(() => {
    if (loading) return
    if (isHydrated && snapshot) return

    void hydrateStatsReferenceData().catch(() => {
      // l'erreur est exposée dans le store
    })
  }, [hydrateStatsReferenceData, isHydrated, loading, snapshot])

  useEffect(() => {
    if (loading) return
    if (!isHydrated || !snapshot) return
    if (hasAppliedDefaultPeriodRef.current) return
    hasAppliedDefaultPeriodRef.current = true

    void resetSelectedPeriodToDefault(storeUserId ?? undefined).catch(() => {
      // l'erreur est exposée dans le store
    })
  }, [isHydrated, loading, resetSelectedPeriodToDefault, snapshot, storeUserId])

  useEffect(() => {
    if (!showTabModal) return
    return lockDocumentScroll()
  }, [showTabModal])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <PageHeader
        title={activeTab.label}
        actionIcon={(
          <img
            src={activeTab.iconSrc}
            alt={activeTab.label}
            width={34}
            height={34}
            style={{ width: 34, height: 34, objectFit: 'contain' }}
            loading="lazy"
            decoding="async"
          />
        )}
        actionAriaLabel="Choisir un onglet stats"
        onActionClick={handleToggleTabModal}
      />

      {(() => {
        const currentIdx = STATS_TABS.findIndex((tab) => tab.id === activeTabId)
        const prevTab = STATS_TABS[(currentIdx - 1 + STATS_TABS.length) % STATS_TABS.length]
        const nextTab = STATS_TABS[(currentIdx + 1) % STATS_TABS.length]
        const triangleBase = { width: 0, height: 0, flexShrink: 0 } as const
        const triLeft = { ...triangleBase, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: '7px solid var(--neutral-350, #c4c4d4)' }
        const triRight = { ...triangleBase, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '7px solid var(--neutral-350, #c4c4d4)' }
        const btnBase = {
          border: 'none',
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          minHeight: 'var(--touch-target-min)',
        } as const

        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            alignItems: 'center',
            paddingLeft: 'var(--page-gutter)',
            paddingRight: 'var(--page-gutter)',
            marginTop: '-8px',
          }}>
            <button
              type="button"
              onClick={() => setActiveTabId(prevTab.id)}
              aria-label={`Aller à ${prevTab.label}`}
              style={btnBase}
            >
              <div style={triLeft} />
              <img src={prevTab.iconSrc} alt={prevTab.label} width={22} height={22} loading="lazy" decoding="async" style={{ objectFit: 'contain', opacity: 0.7 }} />
            </button>
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--neutral-900)', letterSpacing: '-0.01em', textAlign: 'center' }}>
              {activeTab.label}
            </h2>
            <button
              type="button"
              onClick={() => setActiveTabId(nextTab.id)}
              aria-label={`Aller à ${nextTab.label}`}
              style={btnBase}
            >
              <img src={nextTab.iconSrc} alt={nextTab.label} width={22} height={22} loading="lazy" decoding="async" style={{ objectFit: 'contain', opacity: 0.7 }} />
              <div style={triRight} />
            </button>
          </div>
        )
      })()}

      {activeTab.id === 'optimisation' ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            {/* Period chip strip */}
            <div
              style={{
                overflowX: 'auto',
                overflowY: 'hidden',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                paddingLeft: 'var(--page-gutter)',
                paddingRight: 'var(--page-gutter)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {OPTIMIZATION_PERIOD_OPTIONS.flatMap((option) => {
                const isActive = option.id === optimizationPeriodId
                const elements = []
                if (option.mode === 'year') {
                  elements.push(
                    <div
                      key={`sep-${option.id}`}
                      aria-hidden="true"
                      style={{ width: 1, height: 20, background: 'var(--neutral-200)', flexShrink: 0 }}
                    />
                  )
                }
                elements.push(
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setOptimizationPeriodId(option.id)}
                    aria-pressed={isActive}
                    style={{
                      flexShrink: 0,
                      border: isActive ? '2px solid var(--primary-500)' : '1.5px solid var(--neutral-200)',
                      background: isActive ? 'var(--primary-500)' : 'var(--neutral-0)',
                      color: isActive ? '#fff' : 'var(--neutral-700)',
                      borderRadius: 'var(--radius-full)',
                      padding: '0 14px',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      minHeight: 36,
                      transition: 'all var(--transition-base)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {option.shortLabel}
                  </button>
                )
                return elements
              })}
            </div>

            <StatsOptimizationsTab
              monthlyBudgetByCategory={optimizationMonthlyBudgetByCategory}
              monthlyActualByCategory={optimizationMonthlyActualByCategory}
              selectedMonth={optimizationSelectedMonth}
              selectedYear={OPTIMIZATION_YEAR}
              annualHorizon={annualHorizon}
            />
          </div>
        </motion.div>
      ) : null}

      {activeTab.id === 'epargne' ? (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'calc(var(--space-2) * -1)' }}>
          <SavingsAllocationDonut middleSlot={<SavingsBreakdownBar currentSummary={savingsAnalytics.data?.currentSummary} />} />
        </motion.section>
      ) : null}

      {activeTab.id === 'planning_2026' ? (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ display: 'grid', gap: 'var(--space-6)' }}>
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <KpiTilesRow items={planningKpis} />
            <PlanningProgressBar progress={planningProgress} />
          </div>
          <SavingsPlanning2026Section />
        </motion.section>
      ) : null}

      {activeTab.id === 'performance' ? (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ display: 'grid', gap: 'var(--space-6)' }}>
          <div style={{ padding: '0 var(--page-gutter)', display: 'flex', justifyContent: 'center', marginBottom: 'calc(var(--space-2) * -1)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', background: 'var(--neutral-100)', borderRadius: 'var(--radius-md)', padding: '3px', width: 260 }}>
              <button
                type="button"
                onClick={() => setPerformanceViewMode('performance')}
                style={{ ...performanceToggleBtnStyle(performanceViewMode === 'performance'), textAlign: 'center', textTransform: 'capitalize' }}
              >
                performance
              </button>
              <button
                type="button"
                onClick={() => setPerformanceViewMode('capital_investi')}
                style={{ ...performanceToggleBtnStyle(performanceViewMode === 'capital_investi'), textAlign: 'center', textTransform: 'capitalize' }}
              >
                capital investi
              </button>
            </div>
          </div>

          <div style={performanceViewMode === 'performance' ? { marginTop: 'var(--space-4)' } : undefined}>
            {performanceViewMode === 'performance'
              ? <SavingsPortfoliosListSection />
              : <SavingsEvolutionFiveYearsChart overviewKpis={performanceOverviewKpis} />}
          </div>
        </motion.section>
      ) : null}

      <AnimatePresence>
        {showTabModal ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTabModal(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Sélectionner un onglet stats"
              initial={{ y: '-100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 330 }}
              onClick={(event) => event.stopPropagation()}
              style={{
                position: 'fixed',
                left: 'var(--space-3)',
                right: 'var(--space-3)',
                top: 0,
                zIndex: 61,
                width: 'auto',
                maxWidth: 430,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: '0 0 var(--radius-2xl) var(--radius-2xl)',
                padding: 'calc(64px + var(--safe-top) + var(--space-4)) var(--space-4) var(--space-3)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div style={{ width: 28, height: 3, borderRadius: 'var(--radius-full)', background: 'var(--neutral-300)', margin: '0 auto var(--space-2)' }} />

              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STATS_TABS.length}, minmax(0, 1fr))`, gap: 'var(--space-2)' }}>
                {STATS_TABS.map((tab) => {
                  const isActive = tab.id === activeTab.id

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleSelectTab(tab.id)}
                      style={{
                        border: `1.5px solid ${isActive ? 'var(--primary-300)' : 'var(--neutral-150)'}`,
                        background: isActive ? 'color-mix(in oklab, var(--primary-500) 8%, var(--neutral-0) 92%)' : 'var(--neutral-50)',
                        borderRadius: 'var(--radius-md)',
                        padding: '6px var(--space-2)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 'var(--touch-target-min)',
                        transition: 'background 150ms ease, border-color 150ms ease',
                      }}
                    >
                      <span style={{ fontSize: 11, lineHeight: 1.2, fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-semibold)', color: isActive ? 'var(--primary-600)' : 'var(--neutral-700)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {tab.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
