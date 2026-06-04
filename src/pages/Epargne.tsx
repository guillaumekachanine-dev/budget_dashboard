import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import {
  DetailModal,
  DetailModalRow,
  DetailModalSeparator,
} from '@/components'
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
import { useSavingsAnalytics } from '@/features/savings/hooks/useSavingsAnalytics'
import type { SavingsObjectiveMonthRow } from '@/features/savings/hooks/useSavingsObjective2026Details'
import { useSavingsEvolutionFiveYears } from '@/features/savings/hooks/useSavingsEvolutionFiveYears'
import { useSavingsObjective2026Details } from '@/features/savings/hooks/useSavingsObjective2026Details'
import type { SavingsTransferYtdRow } from '@/features/savings/hooks/useSavingsTransfersYtd'
import { useSavingsTransfersYtd } from '@/features/savings/hooks/useSavingsTransfersYtd'
import { StatsOptimizationsTab } from '@/features/stats/components/StatsOptimizationsTab'
import { useOptimizationCapacity } from '@/features/stats/hooks/useOptimizationCapacity'
import { getBudgetLinesForPeriod } from '@/features/budget/api/getBudgetLinesForPeriod'
import { useBudgetPagePayload } from '@/features/budget/hooks/useBudgetPagePayload'
import { useAuth } from '@/hooks/useAuth'
import { useCanonicalPeriod, generateOptimizationPeriodOptions } from '@/lib/period'

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
  onClick?: () => void
  ariaLabel?: string
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

const PLANNED_SAVINGS_2026 = 9800
const OPTIMIZATION_ANNUAL_GAIN_MONTHS = 6
const PLANNED_SAVINGS_PCT_2026 = 17.8

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
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            aria-label={item.ariaLabel ?? item.label}
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
              cursor: item.onClick ? 'pointer' : 'default',
              transition: 'box-shadow var(--transition-base), transform var(--transition-base)',
              boxShadow: item.onClick ? '0 1px 0 rgba(13,13,31,0.06)' : 'none',
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
                    ? 'var(--color-positive-text)'
                    : item.detailTone === 'negative'
                      ? 'var(--color-negative-text)'
                      : 'var(--neutral-500)',
                }}
              >
                {item.detail}
              </p>
            ) : null}
          </button>
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
            background: '#0E7490',
            transition: 'width 480ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>
      <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', columnGap: 'var(--space-3)' }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--neutral-500)', textAlign: 'left', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
          0
        </p>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--neutral-500)', textAlign: 'center', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
          {formatKpiCurrency(progress.currentAmount)}{' '}
          <span style={{ color: '#0E7490' }}>({formatKpiPercent(safePct)})</span>
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
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'color-mix(in oklab, var(--color-positive-text) 80%, var(--neutral-700) 20%)', fontFamily: 'var(--font-mono)' }}>
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
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'color-mix(in oklab, var(--color-warning-text) 80%, var(--neutral-700) 20%)', fontFamily: 'var(--font-mono)' }}>
              {placementsSharePct > 0 ? `${Math.round(placementsSharePct)}%` : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SavingsYtdDetailModal({
  transfers,
  totalAmount,
  onClose,
}: {
  transfers: SavingsTransferYtdRow[]
  totalAmount: number
  onClose: () => void
}) {
  return (
    <DetailModal
      open
      onClose={onClose}
      title="Transactions réalisées YTD"
      accentColor="var(--color-warning)"
    >
      {transfers.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
          Aucun virement d’épargne réalisé.
        </p>
      ) : (
        <>
          {transfers.map((row) => (
            <DetailModalRow
              key={row.id}
              label={`${row.transactionDate.slice(0, 5)} · Virement ${row.sourceAccount} → ${row.destination}`}
              value={formatKpiCurrency(row.personalAmount)}
            />
          ))}
          <DetailModalSeparator />
          <DetailModalRow
            label="Total"
            value={formatKpiCurrency(totalAmount)}
            variant="total"
          />
        </>
      )}
    </DetailModal>
  )
}

function SavingsObjective2026DetailModal({
  pastRows,
  futureRows,
  totalUpdatedObjective,
  onClose,
}: {
  pastRows: SavingsObjectiveMonthRow[]
  futureRows: SavingsObjectiveMonthRow[]
  totalUpdatedObjective: number
  onClose: () => void
}) {
  const renderSection = (title: string, rows: SavingsObjectiveMonthRow[]) => (
    <div style={{ display: 'grid', gap: 4 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'var(--neutral-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </p>
      <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {rows.map((row) => (
          <div key={row.monthId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 'var(--space-2)', alignItems: 'center', padding: '9px var(--space-3)', borderTop: '1px solid var(--neutral-200)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', fontWeight: 600 }}>{row.monthLabel}</span>
            <span style={{ fontSize: 10, color: row.isPast ? 'var(--primary-600)' : 'var(--neutral-600)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {row.typeLabel}
            </span>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {formatKpiCurrency(row.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(13,13,31,0.52)' }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Détail objectif 2026"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        onClick={(event) => event.stopPropagation()}
        style={{
          position: 'fixed',
          left: 'var(--page-gutter)',
          right: 'var(--page-gutter)',
          top: '12vh',
          bottom: '10vh',
          zIndex: 91,
          maxWidth: 520,
          margin: '0 auto',
          background: 'var(--neutral-0)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--neutral-200)',
          boxShadow: '0 16px 48px rgba(13,13,31,0.24)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 800 }}>
            Détail objectif 2026
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{ border: 'none', background: 'var(--neutral-100)', color: 'var(--neutral-600)', width: 30, height: 30, borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
          {renderSection('Mois passés', pastRows)}
          {renderSection('À venir', futureRows)}
          <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', background: 'var(--neutral-100)', padding: '10px var(--space-3)', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 700 }}>
              Total objectif 2026 actualisé
            </span>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
              {formatKpiCurrency(totalUpdatedObjective)}
            </span>
          </div>
        </div>
      </motion.div>
    </>
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
  const { currentYear, currentMonthKey, lastClosedMonth } = useCanonicalPeriod()
  const optimizationPeriodOptions = useMemo(
    () => generateOptimizationPeriodOptions(currentYear, lastClosedMonth),
    [currentYear, lastClosedMonth],
  )
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
  const optimizationCapacity = useOptimizationCapacity(currentYear)
  const savingsAnalytics = useSavingsAnalytics(currentYear)
  const savingsEvolution = useSavingsEvolutionFiveYears()
  const { data: savingsTransfersYtd } = useSavingsTransfersYtd(user?.id, currentYear)
  const objective2026Details = useSavingsObjective2026Details(user?.id)

  const [activeTabId, setActiveTabId] = useState<StatsTabId>('epargne')
  const [planningKpiModal, setPlanningKpiModal] = useState<'ytd' | 'objective' | null>(null)
  const [optimizationPeriodId, setOptimizationPeriodId] = useState<string>(currentMonthKey)
  const [showTabModal, setShowTabModal] = useState(false)
  const [performanceViewMode, setPerformanceViewMode] = useState<PerformanceViewMode>('performance')
  const hasAppliedDefaultPeriodRef = useRef(false)
  const hasManualOptimizationPeriodSelection = useRef(false)

  // Quand le mois bascule automatiquement (PWA en veille), resynchronise
  // la période des Optimisations vers le nouveau mois courant —
  // uniquement si l'utilisateur n'a pas fait de sélection manuelle.
  useEffect(() => {
    if (!hasManualOptimizationPeriodSelection.current) {
      setOptimizationPeriodId(currentMonthKey)
    }
  }, [currentMonthKey])

  const activeTab = useMemo(
    () => STATS_TABS.find((tab) => tab.id === activeTabId) ?? STATS_TABS[0],
    [activeTabId],
  )
  const optimizationPeriod = useMemo(
    () => optimizationPeriodOptions.find((option) => option.id === optimizationPeriodId) ?? optimizationPeriodOptions[0]!,
    [optimizationPeriodId, optimizationPeriodOptions],
  )
  const optimizationSelectedMonth = useMemo<number | null>(() => {
    if (optimizationPeriod.mode !== 'month') return null
    const monthRaw = optimizationPeriod.id.slice(-2)
    const month = Number(monthRaw)
    if (!Number.isFinite(month) || month < 1 || month > 12) return null
    return month
  }, [optimizationPeriod.id, optimizationPeriod.mode])

  const { data: optimizationBudgetLines } = useQuery({
    queryKey: ['optimization-period-budget-lines', currentYear, optimizationSelectedMonth],
    enabled: optimizationSelectedMonth != null,
    queryFn: async () => {
      if (optimizationSelectedMonth == null) return []
      const result = await getBudgetLinesForPeriod({ year: currentYear, month: optimizationSelectedMonth })
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
    periodYear: currentYear,
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

  const objective2026Actualized = objective2026Details.totalUpdatedObjective

  const planningKpis = useMemo<KpiTileItem[]>(() => {
    const epargneYtd = Number(savingsTransfersYtd?.totalAmount ?? 0)

    return [
      {
        label: 'Épargne YTD',
        value: formatKpiCurrency(epargneYtd),
        onClick: () => setPlanningKpiModal('ytd'),
        ariaLabel: 'Afficher le détail épargne YTD',
        tone: 'neutral',
        backgroundColor: 'var(--color-warning)',
        borderColor: 'color-mix(in oklab, var(--color-warning) 78%, var(--neutral-300) 22%)',
        labelColor: '#fff',
        valueColor: '#fff',
      },
      {
        label: 'Objectif 2026',
        value: formatKpiCurrency(objective2026Actualized),
        onClick: () => setPlanningKpiModal('objective'),
        ariaLabel: 'Afficher le détail objectif 2026',
        tone: 'warning',
        backgroundColor: '#0E7490',
        borderColor: 'color-mix(in oklab, #0E7490 72%, var(--neutral-300) 28%)',
        labelColor: '#FCD34D',
        valueColor: '#FCD34D',
      },
    ]
  }, [objective2026Actualized, savingsTransfersYtd?.totalAmount])

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

  useEffect(() => {
    if (!planningKpiModal) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPlanningKpiModal(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [planningKpiModal])

  useEffect(() => {
    if (activeTabId !== 'planning_2026') setPlanningKpiModal(null)
  }, [activeTabId])

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
            {/* Period selector navigation row identical to Budgets page style */}
            <div style={{ padding: '0 var(--page-gutter)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', marginTop: 0, marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  onClick={() => {
                    hasManualOptimizationPeriodSelection.current = true
                    const currentIdx = optimizationPeriodOptions.findIndex((o) => o.id === optimizationPeriodId)
                    if (currentIdx > 0) {
                      setOptimizationPeriodId(optimizationPeriodOptions[currentIdx - 1].id)
                    }
                  }}
                  disabled={optimizationPeriodId === optimizationPeriodOptions[0].id}
                  aria-label="Période précédente"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    width: 24,
                    height: 24,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: optimizationPeriodId !== optimizationPeriodOptions[0].id ? 'pointer' : 'not-allowed',
                    opacity: optimizationPeriodId !== optimizationPeriodOptions[0].id ? 1 : 0.5,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 0,
                      height: 0,
                      borderTop: '5px solid transparent',
                      borderBottom: '5px solid transparent',
                      borderRight: '7px solid var(--neutral-600)',
                      marginLeft: -1,
                    }}
                  />
                </button>

                <span
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 700,
                    color: 'var(--neutral-700)',
                    letterSpacing: '0.01em',
                    userSelect: 'none',
                  }}
                >
                  {optimizationPeriod.label}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    hasManualOptimizationPeriodSelection.current = true
                    const currentIdx = optimizationPeriodOptions.findIndex((o) => o.id === optimizationPeriodId)
                    if (currentIdx < optimizationPeriodOptions.length - 1) {
                      setOptimizationPeriodId(optimizationPeriodOptions[currentIdx + 1].id)
                    }
                  }}
                  disabled={optimizationPeriodId === optimizationPeriodOptions[optimizationPeriodOptions.length - 1].id}
                  aria-label="Période suivante"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    width: 24,
                    height: 24,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: optimizationPeriodId !== optimizationPeriodOptions[optimizationPeriodOptions.length - 1].id ? 'pointer' : 'not-allowed',
                    opacity: optimizationPeriodId !== optimizationPeriodOptions[optimizationPeriodOptions.length - 1].id ? 1 : 0.5,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 0,
                      height: 0,
                      borderTop: '5px solid transparent',
                      borderBottom: '5px solid transparent',
                      borderLeft: '7px solid var(--neutral-600)',
                      marginRight: -1,
                    }}
                  />
                </button>
              </div>
            </div>

            <StatsOptimizationsTab
              monthlyBudgetByCategory={optimizationMonthlyBudgetByCategory}
              monthlyActualByCategory={optimizationMonthlyActualByCategory}
              selectedMonth={optimizationSelectedMonth}
              selectedYear={currentYear}
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
        {activeTab.id === 'planning_2026' && planningKpiModal === 'ytd' ? (
          <SavingsYtdDetailModal
            transfers={savingsTransfersYtd?.transfers ?? []}
            totalAmount={Number(savingsTransfersYtd?.totalAmount ?? 0)}
            onClose={() => setPlanningKpiModal(null)}
          />
        ) : null}
        {activeTab.id === 'planning_2026' && planningKpiModal === 'objective' ? (
          <SavingsObjective2026DetailModal
            pastRows={objective2026Details.pastRows}
            futureRows={objective2026Details.futureRows}
            totalUpdatedObjective={objective2026Details.totalUpdatedObjective}
            onClose={() => setPlanningKpiModal(null)}
          />
        ) : null}
      </AnimatePresence>

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
                padding: 'calc(var(--header-height) + var(--space-4)) var(--space-4) var(--space-3)',
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
                        position: 'relative',
                        overflow: 'hidden',
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
                      <img
                        src={tab.iconSrc}
                        alt=""
                        aria-hidden="true"
                        width={46}
                        height={46}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 46,
                          height: 46,
                          objectFit: 'contain',
                          opacity: isActive ? 0.38 : 0.18,
                          pointerEvents: 'none',
                          userSelect: 'none',
                          transition: 'opacity 150ms ease',
                        }}
                        loading="lazy"
                        decoding="async"
                      />
                      <span style={{ position: 'relative', fontSize: 11, lineHeight: 1.2, fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-semibold)', color: isActive ? 'var(--primary-600)' : 'var(--neutral-700)', textAlign: 'center', whiteSpace: 'nowrap' }}>
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
