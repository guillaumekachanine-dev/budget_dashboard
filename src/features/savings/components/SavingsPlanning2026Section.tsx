import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { StatsSection } from '@/features/stats/components/ui'

type SavingsMonthMilestone = {
  id: string
  shortLabel: string
  fullLabel: string
}

const MONTH_MILESTONES_2026: SavingsMonthMilestone[] = [
  { id: '2026-01', shortLabel: 'Jan', fullLabel: 'Janvier 2026' },
  { id: '2026-02', shortLabel: 'Fév', fullLabel: 'Février 2026' },
  { id: '2026-03', shortLabel: 'Mar', fullLabel: 'Mars 2026' },
  { id: '2026-04', shortLabel: 'Avr', fullLabel: 'Avril 2026' },
  { id: '2026-05', shortLabel: 'Mai', fullLabel: 'Mai 2026' },
  { id: '2026-06', shortLabel: 'Juin', fullLabel: 'Juin 2026' },
  { id: '2026-07', shortLabel: 'Juil', fullLabel: 'Juillet 2026' },
  { id: '2026-08', shortLabel: 'Août', fullLabel: 'Août 2026' },
  { id: '2026-09', shortLabel: 'Sep', fullLabel: 'Septembre 2026' },
  { id: '2026-10', shortLabel: 'Oct', fullLabel: 'Octobre 2026' },
  { id: '2026-11', shortLabel: 'Nov', fullLabel: 'Novembre 2026' },
  { id: '2026-12', shortLabel: 'Déc', fullLabel: 'Décembre 2026' },
]

function ModalDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-3)' }}>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-500)', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-800)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
        {value}
      </p>
    </div>
  )
}

export function SavingsPlanning2026Section() {
  const [activeMilestone, setActiveMilestone] = useState<SavingsMonthMilestone | null>(null)

  return (
    <>
      <StatsSection>
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-600)' }}>
            Vue annuelle des jalons mensuels. Clique sur un mois pour ouvrir le détail du planning, des virements et de la stratégie.
          </p>

          <div
            style={{
              position: 'relative',
              maxWidth: 560,
              margin: '0 auto',
              display: 'grid',
              rowGap: 7,
              padding: 'var(--space-2) 0',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 6,
                bottom: 6,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 2,
                borderRadius: 'var(--radius-full)',
                background: 'color-mix(in oklab, var(--primary-500) 45%, var(--neutral-200) 55%)',
              }}
            />

            {MONTH_MILESTONES_2026.map((month, index) => {
              const isLeftSide = index % 2 === 0

              return (
                <div
                  key={month.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    columnGap: 0,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--space-2)' }}>
                    {isLeftSide ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setActiveMilestone(month)}
                          style={{
                            border: '1px solid color-mix(in oklab, var(--primary-500) 24%, var(--neutral-200) 76%)',
                            background: 'var(--neutral-0)',
                            borderRadius: 'var(--radius-md)',
                            padding: '5px 10px',
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--neutral-800)',
                            minWidth: 72,
                            cursor: 'pointer',
                          }}
                        >
                          {month.shortLabel}
                        </button>
                        <div
                          aria-hidden="true"
                          style={{
                            width: 26,
                            height: 1,
                            borderRadius: 'var(--radius-full)',
                            background: 'color-mix(in oklab, var(--primary-500) 32%, var(--neutral-200) 68%)',
                          }}
                        />
                      </>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    aria-label={`Ouvrir ${month.fullLabel}`}
                    onClick={() => setActiveMilestone(month)}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 'var(--radius-full)',
                      border: '2px solid var(--primary-500)',
                      background: 'var(--neutral-0)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 'var(--space-2)' }}>
                    {!isLeftSide ? (
                      <>
                        <div
                          aria-hidden="true"
                          style={{
                            width: 26,
                            height: 1,
                            borderRadius: 'var(--radius-full)',
                            background: 'color-mix(in oklab, var(--primary-500) 32%, var(--neutral-200) 68%)',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setActiveMilestone(month)}
                          style={{
                            border: '1px solid color-mix(in oklab, var(--primary-500) 24%, var(--neutral-200) 76%)',
                            background: 'var(--neutral-0)',
                            borderRadius: 'var(--radius-md)',
                            padding: '5px 10px',
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--neutral-800)',
                            minWidth: 72,
                            cursor: 'pointer',
                          }}
                        >
                          {month.shortLabel}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </StatsSection>

      <AnimatePresence>
        {activeMilestone ? (
          <>
            <motion.button
              type="button"
              aria-label="Fermer la modale"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveMilestone(null)}
              style={{
                position: 'fixed',
                inset: 0,
                border: 'none',
                padding: 0,
                margin: 0,
                background: 'rgba(13,13,31,0.52)',
                zIndex: 95,
                cursor: 'pointer',
              }}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`Planning épargne ${activeMilestone.fullLabel}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(560px, calc(100vw - 32px))',
                maxHeight: 'min(80vh, 700px)',
                overflowY: 'auto',
                zIndex: 96,
                background: 'var(--neutral-0)',
                border: '1px solid var(--neutral-200)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: '0 16px 44px rgba(13,13,31,0.24)',
                padding: 'var(--space-4)',
                display: 'grid',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Planning épargne 2026
                  </p>
                  <h3 style={{ margin: '3px 0 0', fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--neutral-900)' }}>
                    {activeMilestone.fullLabel}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveMilestone(null)}
                  style={{
                    border: '1px solid var(--neutral-200)',
                    background: 'var(--neutral-0)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--neutral-700)',
                    cursor: 'pointer',
                    padding: '3px 7px',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Fermer
                </button>
              </div>

              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-800)' }}>Planning du mois</p>
                <ModalDetailRow label="Date prévue" value="À définir" />
                <ModalDetailRow label="Objectif mensuel" value="À définir" />
              </div>

              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-800)' }}>Virements prévus</p>
                <ModalDetailRow label="Compte source" value="À définir" />
                <ModalDetailRow label="Destination" value="À définir" />
                <ModalDetailRow label="Montant" value="À définir" />
              </div>

              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-800)' }}>Stratégie</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-600)', lineHeight: 1.45 }}>
                  Arbitrage mensuel, priorisation des enveloppes (livrets et placements), et règle de redistribution du surplus à préciser.
                </p>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
