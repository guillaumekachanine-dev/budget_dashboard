import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { formatCurrencyFloored } from '@/lib/utils'

export interface BudgetEnvelopeForecastModalData {
  name: string
  realizedAmount: number
  futureFixedAmount: number
  realizedPlusFutureFixedAmount: number
  budgetAmount: number | null
}

interface BudgetEnvelopeForecastModalProps {
  forecast: BudgetEnvelopeForecastModalData | null
  onClose: () => void
}

export function BudgetEnvelopeForecastModal({ forecast, onClose }: BudgetEnvelopeForecastModalProps) {
  const estimatedRemaining = forecast?.budgetAmount != null
    ? forecast.budgetAmount - forecast.realizedPlusFutureFixedAmount
    : null

  return (
    <AnimatePresence>
      {forecast ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 280, background: 'rgba(13,13,31,0.45)' }}
          />
          <div style={{ position: 'fixed', inset: 0, zIndex: 281, display: 'grid', placeItems: 'center', padding: 'var(--space-4)', pointerEvents: 'none' }}>
            <motion.div
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', damping: 30, stiffness: 340 }}
              style={{
                width: 'min(360px, 100%)',
                borderRadius: 'var(--radius-xl)',
                background: 'var(--neutral-0)',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
                pointerEvents: 'auto',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  borderBottom: '1px solid var(--neutral-150)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Prévision Envelope
                  </p>
                  <h3 style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, color: 'var(--neutral-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {forecast.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer la prévision d'enveloppe"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    background: 'var(--neutral-100)',
                    color: 'var(--neutral-600)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-700)' }}>Consommé à date</span>
                  <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                    {formatCurrencyFloored(forecast.realizedAmount)}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-700)' }}>Fixes planifiées à venir</span>
                  <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                    {formatCurrencyFloored(forecast.futureFixedAmount)}
                  </span>
                </div>
                <div style={{ height: 1, background: 'var(--neutral-150)' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-900)' }}>Réalisé + fixes planifiées</span>
                  <span style={{ fontSize: 14, fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--primary-700)' }}>
                    {formatCurrencyFloored(forecast.realizedPlusFutureFixedAmount)}
                  </span>
                </div>
                {forecast.budgetAmount != null ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-700)' }}>Budget prévu</span>
                      <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                        {formatCurrencyFloored(forecast.budgetAmount)}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-700)' }}>Reste estimé</span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          color: (estimatedRemaining ?? 0) < 0 ? 'var(--color-error)' : 'var(--color-success)',
                        }}
                      >
                        {formatCurrencyFloored(estimatedRemaining ?? 0)}
                      </span>
                    </div>
                  </>
                ) : null}
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

