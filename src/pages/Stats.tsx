import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { HeaderPeriodMenu } from '@/components/layout/HeaderPeriodMenu'
import { lockDocumentScroll } from '@/lib/scrollLock'
import analyticsIcon from '@/assets/icons_app/analytics.png'
import optimisationIcon from '@/assets/icons_app/optimisation.png'
import epargneIcon from '@/assets/icons_app/epargne.png'
import { useStatsReferenceData } from '@/features/stats/hooks/useStatsReferenceData'
import { StatsHeader } from '@/features/stats/components/StatsHeader'
import { StatsTotalNeedCard } from '@/features/stats/components/StatsTotalNeedCard'
import { StatsBudgetBucketsCard } from '@/features/stats/components/StatsBudgetBucketsCard'
import { StatsBudgetVsActualCard } from '@/features/stats/components/StatsBudgetVsActualCard'
import { StatsSavingsCard } from '@/features/stats/components/StatsSavingsCard'
import { StatsMonthlyEvolutionCard } from '@/features/stats/components/StatsMonthlyEvolutionCard'
import type { StatsSelectedPeriod } from '@/features/stats/types'
import { formatCurrency } from '@/features/stats/utils/statsReferenceSelectors'

const optimizationTableColumns = 'minmax(0,1.25fr) minmax(0,0.72fr) minmax(0,0.84fr) minmax(0,0.84fr)'

type StatsTabId = 'analytics' | 'optimisation' | 'epargne'
type StatsTabConfig = {
  id: StatsTabId
  label: string
  iconSrc: string
}

const STATS_TABS: StatsTabConfig[] = [
  { id: 'analytics', label: 'analytics', iconSrc: analyticsIcon },
  { id: 'optimisation', label: 'optimisation', iconSrc: optimisationIcon },
  { id: 'epargne', label: 'épargne', iconSrc: epargneIcon },
]

export function Stats() {
  const {
    snapshot,
    loading,
    error,
    isHydrated,
    storeUserId,
    hydrateStatsReferenceData,
    resetSelectedPeriodToDefault,
    setSelectedPeriod,
  } = useStatsReferenceData()

  const [activeTabId, setActiveTabId] = useState<StatsTabId>('analytics')
  const [showTabModal, setShowTabModal] = useState(false)
  const [showHeaderPeriodMenu, setShowHeaderPeriodMenu] = useState(false)
  const hasAppliedDefaultPeriodRef = useRef(false)

  const activeTab = useMemo(
    () => STATS_TABS.find((tab) => tab.id === activeTabId) ?? STATS_TABS[0],
    [activeTabId],
  )

  const optimizationScenarios = useMemo(() => {
    const rows = snapshot?.budgetBucketVsActual ?? []

    return rows
      .filter((row) => row.actualBudgetBucketEur > row.targetBudgetBucketEur)
      .sort((a, b) => b.deltaBudgetBucketEur - a.deltaBudgetBucketEur)
      .slice(0, 5)
      .map((row, index) => {
        const reductionPercents = [6, 8, 10, 12, 15]
        const reduction = reductionPercents[index] ?? 8
        const monthlyImpact = (row.actualBudgetBucketEur * reduction) / 100

        return {
          id: row.budgetBucket,
          name: row.budgetBucket,
          reduction,
          monthlyImpact,
          sixMonthImpact: monthlyImpact * 6,
        }
      })
  }, [snapshot])

  const handleToggleTabModal = useCallback(() => {
    setShowTabModal((current) => !current)
  }, [])

  const handleSelectTab = useCallback((tabId: StatsTabId) => {
    setActiveTabId(tabId)
    setShowTabModal(false)
  }, [])

  const handleRefresh = useCallback(() => {
    void hydrateStatsReferenceData({ force: true }).catch(() => {
      // l'erreur est exposée dans le store
    })
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom-offset))' }}>
      <PageHeader
        title="Stats"
        rightSlot={(
          <HeaderPeriodMenu
            buttonLabel="Période"
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

      <StatsHeader
        selectedPeriod={selectedPeriod}
        loadedAt={snapshot?.loadedAt ?? null}
        loading={loading}
        error={error}
        onRefresh={handleRefresh}
      />

      {activeTab.id === 'analytics' ? (
        <>
          {snapshot ? (
            <>
              <StatsTotalNeedCard
                totalExpenseBudget={snapshot.budgetSummary.totalExpenseBudget}
                totalSavingsBudget={snapshot.savingsSummary.totalSavingsBudget}
                totalMonthlyNeed={snapshot.totalMonthlyNeed}
              />

              <StatsBudgetBucketsCard budgetSummary={snapshot.budgetSummary} />

              <StatsBudgetVsActualCard
                budgetSummary={snapshot.budgetSummary}
                rows={snapshot.budgetBucketVsActual}
              />

              <StatsSavingsCard
                savingsSummary={snapshot.savingsSummary}
                savingsLines={snapshot.savingsLines}
              />

              <StatsMonthlyEvolutionCard rows={snapshot.monthlyEvolution2026} />
            </>
          ) : (
            <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '0 var(--space-6)' }}>
              <div style={{ maxWidth: 600, margin: '0 auto', minHeight: 160, borderRadius: 'var(--radius-xl)', border: '1px dashed var(--neutral-300)', background: 'var(--neutral-0)', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--neutral-500)', padding: 'var(--space-6)' }}>
                {loading ? 'Chargement du snapshot de référence…' : 'Aucune donnée de référence disponible pour le moment.'}
              </div>
            </motion.section>
          )}
        </>
      ) : null}

      {activeTab.id === 'optimisation' ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          style={{ width: '100%', maxWidth: 600, margin: '0 auto', padding: '0 var(--space-4)' }}
        >
          <div style={{ width: '100%', background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--neutral-150)', padding: 'var(--space-4)' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)' }}>Scénarios d’optimisation</h2>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
              Simulation basée sur les buckets en dépassement ce mois.
            </p>

            <div style={{ width: '100%', borderBottom: '1px solid var(--neutral-200)', display: 'grid', gridTemplateColumns: optimizationTableColumns, gap: 'var(--space-1)', padding: 'var(--space-2) 0', marginTop: 'var(--space-4)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'left' }}>Bucket</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'center' }}>Scénario</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' }}>Fin de mois</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' }}>6 mois</span>
            </div>

            {!snapshot ? (
              <p style={{ margin: 'var(--space-4) 0 0', fontSize: 13, color: 'var(--neutral-400)' }}>
                Snapshot indisponible.
              </p>
            ) : optimizationScenarios.length === 0 ? (
              <p style={{ margin: 'var(--space-4) 0 0', fontSize: 13, color: 'var(--neutral-400)' }}>
                Aucun dépassement bucket détecté pour proposer un scénario.
              </p>
            ) : optimizationScenarios.map((scenario) => (
              <div key={scenario.id} style={{ borderBottom: '1px solid var(--neutral-200)', display: 'grid', gridTemplateColumns: optimizationTableColumns, gap: 'var(--space-1)', padding: '10px 0', alignItems: 'center' }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--neutral-800)' }}>{scenario.name}</span>
                <span style={{ fontSize: 12, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)', textAlign: 'center', whiteSpace: 'nowrap' }}>{`-${scenario.reduction}%`}</span>
                <span style={{ fontSize: 12, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap' }}>{`+${formatCurrency(scenario.monthlyImpact)}`}</span>
                <span style={{ fontSize: 12, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap' }}>{`+${formatCurrency(scenario.sixMonthImpact)}`}</span>
              </div>
            ))}
          </div>
        </motion.section>
      ) : null}

      {activeTab.id === 'epargne' ? (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ display: 'grid', gap: 'var(--space-6)' }}>
          {snapshot ? (
            <>
              <StatsSavingsCard
                savingsSummary={snapshot.savingsSummary}
                savingsLines={snapshot.savingsLines}
              />

              <StatsTotalNeedCard
                totalExpenseBudget={snapshot.budgetSummary.totalExpenseBudget}
                totalSavingsBudget={snapshot.savingsSummary.totalSavingsBudget}
                totalMonthlyNeed={snapshot.totalMonthlyNeed}
              />
            </>
          ) : (
            <div style={{ padding: '0 var(--space-6)' }}>
              <div style={{ maxWidth: 600, margin: '0 auto', minHeight: 220, borderRadius: 'var(--radius-xl)', border: '1px dashed var(--neutral-300)', background: 'color-mix(in oklab, var(--color-success) 6%, var(--neutral-0) 94%)', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--neutral-600)', padding: 'var(--space-6)' }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)' }}>
                  Données d’épargne en cours de chargement
                </p>
              </div>
            </div>
          )}
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
                left: 0,
                right: 0,
                top: 0,
                zIndex: 61,
                width: '100%',
                maxWidth: 430,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: '0 0 var(--radius-2xl) var(--radius-2xl)',
                padding: 'calc(var(--safe-top-offset) + var(--space-2)) var(--space-6) var(--space-6)',
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-5) var(--space-2)' }}>
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
                        width={56}
                        height={56}
                        style={{ width: 56, height: 56, objectFit: 'contain' }}
                        loading="lazy"
                        decoding="async"
                      />
                      <span style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.35, fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)', color: isActive ? 'var(--primary-600)' : 'var(--neutral-700)', textAlign: 'center', textTransform: 'capitalize' }}>
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
