import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, RotateCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { HeaderPeriodMenu } from '@/components/layout/HeaderPeriodMenu'
import { lockDocumentScroll } from '@/lib/scrollLock'
import analyticsIcon from '@/assets/icons/app/analytics.webp'
import performanceIcon from '@/assets/icons/app/performance.webp'
import optimisationIcon from '@/assets/icons/app/optimisation.webp'
import epargneIcon from '@/assets/icons/app/epargne.webp'
import { useStatsReferenceData } from '@/features/stats/hooks/useStatsReferenceData'
import { Annual2025Tab } from '@/features/annual-analysis/components/Annual2025Tab'
import { Annual2026Optimization } from '@/features/annual-analysis/components/Annual2026Optimization'
import { useAnnual2026Analysis } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { StatsTotalNeedCard } from '@/features/stats/components/StatsTotalNeedCard'
import { SavingsHeroCard } from '@/features/savings/components/SavingsHeroCard'
import { SavingsAllocationDonut } from '@/features/savings/components/SavingsAllocationDonut'
import { SavingsEvolutionFiveYearsChart } from '@/features/savings/components/SavingsEvolutionFiveYearsChart'
import { FinancialSecurityCard } from '@/features/savings/components/FinancialSecurityCard'
import { SavingsPlanning2026Section } from '@/features/savings/components/SavingsPlanning2026Section'
import { StatsOptimizationsTab } from '@/features/stats/components/StatsOptimizationsTab'
import { InvestmentPerformanceSection } from '@/features/stats/components/InvestmentPerformanceSection'
import type { StatsSelectedPeriod } from '@/features/stats/types'
import { EmptyState, StatsSection } from '@/features/stats/components/ui'

type StatsTabId = 'analytics_2025' | 'performance' | 'optimisation' | 'epargne'
type StatsTabConfig = {
  id: StatsTabId
  label: string
  iconSrc: string
}
const STATS_TABS: StatsTabConfig[] = [
  { id: 'analytics_2025', label: 'Analytics', iconSrc: analyticsIcon },
  { id: 'epargne', label: 'épargne', iconSrc: epargneIcon },
  { id: 'optimisation', label: 'optimisation', iconSrc: optimisationIcon },
  { id: 'performance', label: 'Performance', iconSrc: performanceIcon },
]
function StatsMajorSectionHeading({ title }: { title: string }) {
  return (
    <StatsSection>
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <div
          aria-hidden="true"
          style={{
            height: 2,
            width: '100%',
            background: 'var(--neutral-900)',
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
              borderLeft: '14px solid var(--neutral-900)',
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
    </StatsSection>
  )
}

export function Stats() {
  const {
    snapshot,
    loading,
    isHydrated,
    storeUserId,
    hydrateStatsReferenceData,
    resetSelectedPeriodToDefault,
    setSelectedPeriod,
  } = useStatsReferenceData()
  const annual2026 = useAnnual2026Analysis()

  const [activeTabId, setActiveTabId] = useState<StatsTabId>('analytics_2025')
  const [selectedAnalyticsYear, setSelectedAnalyticsYear] = useState<2024 | 2025>(2025)
  const [showTabModal, setShowTabModal] = useState(false)
  const [showHeaderPeriodMenu, setShowHeaderPeriodMenu] = useState(false)
  const [showYearModal, setShowYearModal] = useState(false)
  const hasAppliedDefaultPeriodRef = useRef(false)

  const activeTab = useMemo(
    () => STATS_TABS.find((tab) => tab.id === activeTabId) ?? STATS_TABS[0],
    [activeTabId],
  )

  const handleToggleTabModal = useCallback(() => {
    setShowTabModal((current) => !current)
  }, [])

  const handleSelectTab = useCallback((tabId: StatsTabId) => {
    setActiveTabId(tabId)
    setShowTabModal(false)
  }, [])

  const handleRefresh = useCallback(() => {
    void hydrateStatsReferenceData({ force: true }).catch(() => {})
  }, [hydrateStatsReferenceData])

  const isPeriodOptionActive = useCallback((option: { period_year: number; period_month: number }, selected: StatsSelectedPeriod | null) => {
    if (!selected) return false
    return selected.period_year === option.period_year && selected.period_month === option.period_month
  }, [])

  const headerPeriodOptions = useMemo(() => {
    const options = snapshot?.availablePeriodOptions ?? []
    return options.map((option) => ({
      key: option.key,
      label: option.label,
      active: isPeriodOptionActive(option, snapshot?.selectedPeriod ?? null),
      showDividerBefore: false,
      onSelect: () => {
        void setSelectedPeriod({
          id: option.id,
          period_year: option.period_year,
          period_month: option.period_month,
          label: option.label,
        }).catch(() => {
          // l'erreur est exposée dans le store
        })
      },
    }))
  }, [isPeriodOptionActive, setSelectedPeriod, snapshot])

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

  const selectedPeriod = snapshot?.selectedPeriod ?? null

  const lastUpdateHeaderText = (() => {
    if (!snapshot?.loadedAt) return 'Jamais mis à jour'
    const date = new Date(snapshot.loadedAt)
    if (Number.isNaN(date.getTime())) return 'Jamais mis à jour'

    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')

    return `Actualisé le ${day}/${month} à ${hours}:${minutes}`
  })()

  const monthButtonLabel = selectedPeriod?.label ?? 'Mois'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <PageHeader
        title="Analytics"
        rightSlot={activeTabId === 'analytics_2025' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', marginTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setShowYearModal(prev => !prev)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-extrabold)',
                  color: 'var(--neutral-0)',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  margin: 0,
                  transition: 'opacity var(--transition-base)',
                }}
              >
                {selectedAnalyticsYear}
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                aria-label="Actualiser les données"
                style={{
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px',
                  width: '24px',
                  height: '24px',
                  background: 'color-mix(in oklab, var(--neutral-0) 20%, var(--primary-600) 80%)',
                  color: 'var(--neutral-0)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  transition: 'all var(--transition-base)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <RotateCw size={12} style={{ transition: 'transform var(--transition-base)', transform: loading ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </button>
            </div>
            <p style={{
              margin: 0,
              fontSize: '9px',
              color: 'color-mix(in oklab, var(--neutral-0) 70%, var(--primary-100) 30%)',
              fontWeight: 'var(--font-weight-medium)',
              lineHeight: 1.2,
              textAlign: 'right',
            }}>
              {lastUpdateHeaderText}
            </p>
          </div>
        ) : activeTabId === 'epargne' ? (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-extrabold)',
              color: 'var(--neutral-0)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            Epargne
          </p>
        ) : (
          <HeaderPeriodMenu
            buttonLabel={monthButtonLabel}
            buttonAriaLabel="Choisir une période Stats"
            menuAriaLabel="Choisir une période Stats"
            open={showHeaderPeriodMenu}
            onOpenChange={setShowHeaderPeriodMenu}
            onBeforeToggle={() => setShowTabModal(false)}
            options={headerPeriodOptions}
          />
        )}
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

      {activeTab.id === 'analytics_2025' ? (
        <Annual2025Tab />
      ) : null}

      {activeTab.id === 'performance' ? (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <InvestmentPerformanceSection />
        </motion.section>
      ) : null}

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
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ display: 'grid', gap: 'var(--space-6)' }}>
          <SavingsHeroCard />
          <StatsMajorSectionHeading title="Planning épargne 2026" />
          <SavingsPlanning2026Section />
          <StatsMajorSectionHeading title="Détails de l'épargne" />
          <SavingsAllocationDonut />
          <SavingsEvolutionFiveYearsChart />
          <FinancialSecurityCard />

          {snapshot ? (
            <StatsTotalNeedCard
              totalExpenseBudget={snapshot.budgetSummary.totalExpenseBudget}
              totalSavingsBudget={snapshot.savingsSummary.totalSavingsBudget}
              totalMonthlyNeed={snapshot.totalMonthlyNeed}
            />
          ) : null}
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
                padding: 'calc(var(--safe-top-offset) + var(--space-2)) var(--space-5) var(--space-5)',
                boxShadow: 'var(--shadow-lg)',
                maxHeight: '78dvh',
                overflowY: 'auto',
              }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 'var(--radius-full)', background: 'var(--neutral-300)', margin: '2px auto var(--space-4)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--neutral-900)' }}>
                  Sélectionner un onglet
                </p>
                <button
                  type="button"
                  aria-label="Fermer"
                  onClick={() => setShowTabModal(false)}
                  style={{
                    border: 'none',
                    background: 'var(--neutral-100)',
                    color: 'var(--neutral-600)',
                    minWidth: 'var(--touch-target-min)',
                    minHeight: 'var(--touch-target-min)',
                    borderRadius: 'var(--radius-full)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--space-3) var(--space-2)' }}>
                {STATS_TABS.map((tab) => {
                  const isActive = tab.id === activeTab.id

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleSelectTab(tab.id)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        cursor: 'pointer',
                        display: 'grid',
                        justifyItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <img
                        src={tab.iconSrc}
                        alt={tab.label}
                        width={34}
                        height={34}
                        style={{ width: 34, height: 34, objectFit: 'contain' }}
                        loading="lazy"
                        decoding="async"
                      />
                      <span style={{ fontSize: 10, lineHeight: 1.2, fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)', color: isActive ? 'var(--primary-600)' : 'var(--neutral-700)', textAlign: 'center', textTransform: 'capitalize', whiteSpace: 'pre-line' }}>
                        {tab.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        ) : null}

        {showYearModal ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowYearModal(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Sélectionner une année"
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
                maxWidth: 340,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: '0 0 var(--radius-2xl) var(--radius-2xl)',
                padding: 'calc(var(--safe-top-offset) + var(--space-2)) var(--space-4) var(--space-4)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 'var(--radius-full)', background: 'var(--neutral-300)', margin: '2px auto var(--space-3)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)' }}>
                  Année
                </p>
                <button
                  type="button"
                  aria-label="Fermer"
                  onClick={() => setShowYearModal(false)}
                  style={{
                    border: 'none',
                    background: 'var(--neutral-100)',
                    color: 'var(--neutral-600)',
                    minWidth: 'var(--touch-target-min)',
                    minHeight: 'var(--touch-target-min)',
                    borderRadius: 'var(--radius-full)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {[2024, 2025].map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setSelectedAnalyticsYear(year as 2024 | 2025)
                      setShowYearModal(false)
                    }}
                    style={{
                      flex: 1,
                      padding: 'var(--space-2) var(--space-3)',
                      border: selectedAnalyticsYear === year ? '2px solid var(--primary-600)' : '1px solid var(--neutral-300)',
                      borderRadius: 'var(--radius-md)',
                      background: selectedAnalyticsYear === year ? 'color-mix(in oklab, var(--primary-600) 10%, var(--neutral-0) 90%)' : 'var(--neutral-50)',
                      color: selectedAnalyticsYear === year ? 'var(--primary-600)' : 'var(--neutral-900)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-bold)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-base)',
                    }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
