import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, RotateCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { HeaderPeriodMenu } from '@/components/layout/HeaderPeriodMenu'
import { lockDocumentScroll } from '@/lib/scrollLock'
import analyticsIcon from '@/assets/icons/app/analytics.png'
import optimisationIcon from '@/assets/icons/app/optimisation.png'
import epargneIcon from '@/assets/icons/app/epargne.png'
import { useStatsReferenceData } from '@/features/stats/hooks/useStatsReferenceData'
import { Annual2025Tab } from '@/features/annual-analysis/components/Annual2025Tab'
import { Annual2026Tab } from '@/features/annual-analysis/components/Annual2026Tab'
import { Annual2026Optimization } from '@/features/annual-analysis/components/Annual2026Optimization'
import { useAnnual2026Analysis } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { StatsTotalNeedCard } from '@/features/stats/components/StatsTotalNeedCard'
import { StatsSavingsCard } from '@/features/stats/components/StatsSavingsCard'
import { refreshBudgetAnalytics } from '@/features/budget/api/refreshBudgetAnalytics'
import type { StatsSelectedPeriod } from '@/features/stats/types'

type StatsTabId = 'analytics_2026' | 'analytics_2025' | 'optimisation' | 'epargne'
type StatsTabConfig = {
  id: StatsTabId
  label: string
  iconSrc: string
}

const STATS_TABS: StatsTabConfig[] = [
  { id: 'analytics_2026', label: 'Analytics\n2026', iconSrc: analyticsIcon },
  { id: 'analytics_2025', label: 'Analytics\n2025', iconSrc: analyticsIcon },
  { id: 'optimisation', label: 'optimisation', iconSrc: optimisationIcon },
  { id: 'epargne', label: 'épargne', iconSrc: epargneIcon },
]

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

  const [activeTabId, setActiveTabId] = useState<StatsTabId>('analytics_2026')
  const [showTabModal, setShowTabModal] = useState(false)
  const [showHeaderPeriodMenu, setShowHeaderPeriodMenu] = useState(false)
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
    void (async () => {
      if (storeUserId) await refreshBudgetAnalytics(storeUserId).catch(() => {})
      await hydrateStatsReferenceData({ force: true }).catch(() => {})
    })()
  }, [hydrateStatsReferenceData, storeUserId])

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

  const lastUpdateText = (() => {
    if (!snapshot?.loadedAt) return 'Jamais mis à jour'
    const date = new Date(snapshot.loadedAt)
    if (Number.isNaN(date.getTime())) return 'Jamais mis à jour'
    return `Mis à jour le ${date.toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
  })()

  const lastUpdateHeaderText = (() => {
    if (!snapshot?.loadedAt) return 'Jamais mis à jour'
    const date = new Date(snapshot.loadedAt)
    if (Number.isNaN(date.getTime())) return 'Jamais mis à jour'

    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')

    return `Dernière actualisation : ${day}/${month} à ${hours}:${minutes}`
  })()

  const monthButtonLabel = selectedPeriod?.label ?? 'Mois'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom-offset))' }}>
      <PageHeader
        title="Analytics"
        rightSlot={(activeTabId === 'analytics_2025' || activeTabId === 'analytics_2026') ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', transform: 'translateY(4px)' }}>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              aria-label="Actualiser les données"
              style={{
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '4px 10px',
                background: 'rgba(255, 255, 255, 0.15)',
                color: 'var(--neutral-0)',
                fontSize: '11px',
                fontWeight: 'var(--font-weight-semibold)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all var(--transition-base)',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
              }}
            >
              <RotateCw size={11} style={{ transition: 'transform var(--transition-base)', transform: loading ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              {loading ? 'Chargement' : 'Actualiser'}
            </button>
            <p style={{ margin: 0, fontSize: '9px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 'var(--font-weight-medium)', textAlign: 'right', whiteSpace: 'nowrap' }}>
              {activeTabId === 'analytics_2025' ? lastUpdateHeaderText : lastUpdateText}
            </p>
          </div>
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
        headerSubtitle={(activeTabId === 'analytics_2025' || activeTabId === 'analytics_2026') ? null : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', maxWidth: 600, margin: '0 auto', width: '100%' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', fontWeight: 'var(--font-weight-medium)' }}>
              {lastUpdateText}
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              aria-label="Actualiser les données"
              style={{
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '6px 12px',
                background: 'color-mix(in oklab, var(--primary-600) 12%, var(--neutral-0) 88%)',
                color: 'var(--primary-600)',
                fontSize: '12px',
                fontWeight: 'var(--font-weight-semibold)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all var(--transition-base)',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
              }}
            >
              <RotateCw size={13} style={{ transition: 'transform var(--transition-base)', transform: loading ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              {loading ? 'Chargement' : 'Actualiser'}
            </button>
          </div>
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

      {activeTab.id === 'analytics_2026' ? (
        <Annual2026Tab />
      ) : null}

      {activeTab.id === 'optimisation' ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          {annual2026.optimizations.length > 0 && annual2026.summary ? (
            <Annual2026Optimization
              scenarios={annual2026.optimizations}
              totalMonthlyBudget={annual2026.summary.totalMonthlyBudget}
              totalSavings={annual2026.summary.totalSavingsBudget}
            />
          ) : (
            <section style={{ padding: '0 var(--space-6)' }}>
              <div style={{ maxWidth: 600, margin: '0 auto', minHeight: 160, borderRadius: 'var(--radius-xl)', border: '1px dashed var(--neutral-300)', background: 'var(--neutral-0)', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--neutral-500)', padding: 'var(--space-6)' }}>
                Aucun scénario d’optimisation disponible.
              </div>
            </section>
          )}
        </motion.div>
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
