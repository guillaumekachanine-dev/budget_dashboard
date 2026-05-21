import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
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
  { id: 'planning_2026', label: 'Planning 2026', iconSrc: planning2026Icon },
  { id: 'performance', label: 'Performance', iconSrc: performanceIcon },
  { id: 'optimisation', label: 'Optimisation', iconSrc: optimisationIcon },
]

type PerformanceViewMode = 'performance' | 'capital_investi'

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
  const {
    snapshot,
    loading,
    isHydrated,
    storeUserId,
    hydrateStatsReferenceData,
    resetSelectedPeriodToDefault,
  } = useStatsReferenceData()
  const annual2026 = useAnnual2026Analysis()

  const [activeTabId, setActiveTabId] = useState<StatsTabId>('epargne')
  const [showTabModal, setShowTabModal] = useState(false)
  const [performanceViewMode, setPerformanceViewMode] = useState<PerformanceViewMode>('performance')
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
      </AnimatePresence>
    </div>
  )
}
