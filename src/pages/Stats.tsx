import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { getCurrentPeriod, getMonthLabel } from '@/lib/utils'
import { StatsBudgetAnalyticsPanel } from '@/features/budget/components/StatsBudgetAnalyticsPanel'
import { useBudgetSummaries } from '@/hooks/useBudgets'
import { PageHeader } from '@/components/layout/PageHeader'
import { HeroSection } from '@/components/layout/HeroSection'
import { lockDocumentScroll } from '@/lib/scrollLock'
import analyticsIcon from '@/assets/icons_app/analytics.png'
import optimisationIcon from '@/assets/icons_app/optimisation.png'
import epargneIcon from '@/assets/icons_app/epargne.png'

const optimizationTableColumns = 'minmax(0,1.2fr) minmax(0,0.62fr) minmax(0,0.84fr) minmax(0,0.84fr)'
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

function formatMoneyInteger(amount: number): string {
  if (!Number.isFinite(amount)) return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(0)

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.floor(amount))
}

export function Stats() {
  const { year, month } = getCurrentPeriod()
  const { data: summaries } = useBudgetSummaries(year, month)
  const [activeTabId, setActiveTabId] = useState<StatsTabId>('analytics')
  const [showTabModal, setShowTabModal] = useState(false)

  const monthBudget = summaries?.reduce((sum, row) => sum + Number(row.budget_amount), 0) ?? 0
  const monthSpent = summaries?.reduce((sum, row) => sum + Number(row.spent_amount), 0) ?? 0
  const monthRemaining = monthBudget - monthSpent
  const activeTab = useMemo(
    () => STATS_TABS.find((tab) => tab.id === activeTabId) ?? STATS_TABS[0],
    [activeTabId],
  )
  const optimizationScenarios = useMemo(() => {
    const candidates = (summaries ?? [])
      .map((row) => ({
        id: row.category.id,
        name: row.category.name,
        value: Number(row.spent_amount ?? 0),
      }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    const reductionPercents = [5, 8, 10, 12, 15]
    return candidates.map((entry, idx) => {
      const reduction = reductionPercents[idx] ?? 10
      const monthlyImpact = (entry.value * reduction) / 100
      return {
        id: entry.id,
        name: entry.name,
        reduction,
        monthlyImpact,
        sixMonthImpact: monthlyImpact * 6,
      }
    })
  }, [summaries])
  const handleToggleTabModal = useCallback(() => {
    setShowTabModal((current) => !current)
  }, [])
  const handleSelectTab = useCallback((tabId: StatsTabId) => {
    setActiveTabId(tabId)
    setShowTabModal(false)
  }, [])

  useEffect(() => {
    if (!showTabModal) return
    return lockDocumentScroll()
  }, [showTabModal])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom-offset))' }}>
      <PageHeader
        title="Stats"
        rightLabel={activeTab.label}
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

      {activeTab.id === 'analytics' ? (
        <>
          <HeroSection
            bgColor="var(--color-success)"
            value={formatMoneyInteger(monthRemaining)}
            subtitle={`Reste ce mois · ${getMonthLabel(year, month)}`}
          />

          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '0 var(--space-6)' }}>
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <StatsBudgetAnalyticsPanel year={year} />
            </div>
          </motion.section>
        </>
      ) : null}

      {activeTab.id === 'optimisation' ? (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ width: '100%', maxWidth: 600, margin: '0 auto', padding: '0 var(--space-4)' }}>
          <div style={{ width: '100%' }}>
            <div style={{ width: '96%', margin: '0 auto', borderBottom: '1px solid var(--neutral-200)', display: 'grid', gridTemplateColumns: optimizationTableColumns, gap: 'var(--space-1)', padding: 'var(--space-2) 0' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'left' }}>Enveloppe</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'center' }}>Scénario</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' }}>Fin de mois</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' }}>6 mois</span>
            </div>

            {optimizationScenarios.length === 0 ? (
              <div style={{ padding: 'var(--space-6) 0', color: 'var(--neutral-400)', fontSize: 13 }}>Aucune donnée disponible</div>
            ) : optimizationScenarios.map((scenario) => (
              <div key={scenario.id} style={{ width: '96%', margin: '0 auto', borderBottom: '1px solid var(--neutral-200)', display: 'grid', gridTemplateColumns: optimizationTableColumns, gap: 'var(--space-1)', padding: '10px 0', alignItems: 'center', transition: 'background-color var(--transition-fast)' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--neutral-50)' }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--neutral-800)' }}>{scenario.name}</span>
                <span style={{ fontSize: 12, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)', textAlign: 'center', whiteSpace: 'nowrap' }}>{`-${scenario.reduction}%`}</span>
                <span style={{ fontSize: 12, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap' }}>{`+${formatMoneyInteger(scenario.monthlyImpact)}`}</span>
                <span style={{ fontSize: 12, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap' }}>{`+${formatMoneyInteger(scenario.sixMonthImpact)}`}</span>
              </div>
            ))}
          </div>
        </motion.section>
      ) : null}

      {activeTab.id === 'epargne' ? (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ padding: '0 var(--space-6)' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', minHeight: 220, borderRadius: 'var(--radius-xl)', border: '1px dashed var(--neutral-300)', background: 'color-mix(in oklab, var(--color-success) 6%, var(--neutral-0) 94%)', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--neutral-600)', padding: 'var(--space-6)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)' }}>
              Section épargne en cours de structuration
            </p>
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
