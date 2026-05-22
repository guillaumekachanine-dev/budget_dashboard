import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PageHeader } from '@/components/layout/PageHeader'
import { lockDocumentScroll } from '@/lib/scrollLock'
import optimisationIcon from '@/assets/icons/app/epargne_optimisation.png'
import planning2026Icon from '@/assets/icons/app/epargne_planning_2026.png'
import performanceIcon from '@/assets/icons/app/epargne_performance.png'
import epargneIcon from '@/assets/icons/categories/epargne.webp'
import { useStatsReferenceData } from '@/features/stats/hooks/useStatsReferenceData'
import { Annual2026Optimization } from '@/features/annual-analysis/components/Annual2026Optimization'
import { useAnnual2026Analysis } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { SavingsHeroCard } from '@/features/savings/components/SavingsHeroCard'
import { SavingsAllocationDonut } from '@/features/savings/components/SavingsAllocationDonut'
import { SavingsEvolutionFiveYearsChart } from '@/features/savings/components/SavingsEvolutionFiveYearsChart'
import { SavingsPlanning2026Section } from '@/features/savings/components/SavingsPlanning2026Section'
import { SavingsPortfoliosListSection } from '@/features/savings/components/SavingsPortfoliosListSection'
import { useSavingsAnalytics } from '@/features/savings/hooks/useSavingsAnalytics'
import { useSavingsEvolutionFiveYears } from '@/features/savings/hooks/useSavingsEvolutionFiveYears'
import { StatsOptimizationsTab } from '@/features/stats/components/StatsOptimizationsTab'
import { EmptyState, StatsSection } from '@/features/stats/components/ui'

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
}

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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              ...resolveKpiTileStyle(item.tone),
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
            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.2 }}>
              {item.label}
            </p>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1 }}>
              {item.value}
            </p>
          </div>
        ))}
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
  const {
    snapshot,
    loading,
    isHydrated,
    storeUserId,
    hydrateStatsReferenceData,
    resetSelectedPeriodToDefault,
  } = useStatsReferenceData()
  const annual2026 = useAnnual2026Analysis()
  const savingsAnalytics = useSavingsAnalytics(currentYear)
  const savingsEvolution = useSavingsEvolutionFiveYears()

  const [activeTabId, setActiveTabId] = useState<StatsTabId>('epargne')
  const [showTabModal, setShowTabModal] = useState(false)
  const [performanceViewMode, setPerformanceViewMode] = useState<PerformanceViewMode>('performance')
  const hasAppliedDefaultPeriodRef = useRef(false)

  const activeTab = useMemo(
    () => STATS_TABS.find((tab) => tab.id === activeTabId) ?? STATS_TABS[0],
    [activeTabId],
  )

  const planningKpis = useMemo<KpiTileItem[]>(() => {
    const monthlyMetrics = savingsAnalytics.data?.monthlyMetrics ?? []
    const latestYtdRow = [...monthlyMetrics]
      .reverse()
      .find((row) => row.ytd_saved_amount != null)
    const epargneYtd = latestYtdRow?.ytd_saved_amount
      ?? monthlyMetrics.reduce((sum, row) => sum + Number(row.saved_amount ?? 0), 0)

    const objectif2026 = annual2026.summary ? annual2026.summary.totalSavingsBudget * 12 : null
    const progressionPct = objectif2026 && objectif2026 > 0
      ? (epargneYtd / objectif2026) * 100
      : null

    return [
      { label: 'Épargne YTD', value: formatKpiCurrency(epargneYtd), tone: 'neutral' },
      { label: 'Objectif 2026', value: formatKpiCurrency(objectif2026), tone: 'warning' },
      { label: 'Progression', value: formatKpiPercent(progressionPct), tone: 'primary' },
    ]
  }, [annual2026.summary, savingsAnalytics.data?.monthlyMetrics])

  const performanceKpis = useMemo<KpiTileItem[]>(() => {
    const payload = savingsEvolution.data
    if (!payload) {
      return [
        { label: 'Capital investi', value: '—', tone: 'neutral' },
        { label: 'Tx moyen', value: '—', tone: 'warning' },
        { label: 'Plus-value', value: '—', tone: 'primary' },
      ]
    }

    const { rows, series, yearly_account_metrics: yearlyMetrics } = payload
    const yearKey = String(currentYear)
    const rowForYear = rows.find((row) => row.year === yearKey)
      ?? [...rows].sort((a, b) => Number(b.year) - Number(a.year))[0]
      ?? null
    const previousRow = rowForYear
      ? rows.find((row) => row.year === String(Number(rowForYear.year) - 1)) ?? null
      : null

    if (!rowForYear) {
      return [
        { label: 'Capital investi', value: '—', tone: 'neutral' },
        { label: 'Tx moyen', value: '—', tone: 'warning' },
        { label: 'Plus-value', value: '—', tone: 'primary' },
      ]
    }

    const metricYear = rowForYear.year
    let capitalInvesti = 0
    let plusValue = 0

    for (const entry of series) {
      const accountKey = entry.key
      const currentAmount = Number(rowForYear[accountKey] ?? 0)
      const previousAmount = Number(previousRow?.[accountKey] ?? 0)
      const accountMetrics = yearlyMetrics[`${accountKey}::${metricYear}`]
      const totalSavedAmount = Number(accountMetrics?.total_saved_amount ?? 0)
      const performanceAmount = currentAmount - previousAmount - totalSavedAmount

      capitalInvesti += Number.isFinite(totalSavedAmount) ? totalSavedAmount : 0
      plusValue += Number.isFinite(performanceAmount) ? performanceAmount : 0
    }

    const txMoyen = capitalInvesti > 0 ? (plusValue / capitalInvesti) * 100 : null

    return [
      { label: 'Capital investi', value: formatKpiCurrency(capitalInvesti), tone: 'neutral' },
      { label: 'Tx moyen', value: formatKpiPercent(txMoyen, { signed: true }), tone: 'warning' },
      { label: 'Plus-value', value: formatKpiCurrency(plusValue), tone: 'primary' },
    ]
  }, [currentYear, savingsEvolution.data])

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
          <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
            <StatsOptimizationsTab />

            {annual2026.optimizations.length > 0 && annual2026.summary ? (
              <Annual2026Optimization
                scenarios={annual2026.optimizations}
                totalMonthlyBudget={annual2026.summary.totalMonthlyBudget}
                totalSavings={annual2026.summary.totalSavingsBudget}
              />
            ) : (
              <StatsSection>
                <EmptyState message="Aucun scénario d’optimisation disponible." />
              </StatsSection>
            )}
          </div>
        </motion.div>
      ) : null}

      {activeTab.id === 'epargne' ? (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'calc(var(--space-2) * -1)' }}>
          <SavingsHeroCard />
          <SavingsAllocationDonut />
        </motion.section>
      ) : null}

      {activeTab.id === 'planning_2026' ? (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ display: 'grid', gap: 'var(--space-6)' }}>
          <KpiTilesRow items={planningKpis} />
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

          <KpiTilesRow items={performanceKpis} />

          {performanceViewMode === 'performance' ? <SavingsPortfoliosListSection /> : <SavingsEvolutionFiveYearsChart />}
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
