import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { formatCurrencyRounded } from '@/lib/utils'
import type { FluxOperation } from '@/hooks/useFluxOperations'

interface PlannedOperationDetailsModalProps {
  operation: FluxOperation | null
  onClose: () => void
}

function formatLongDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function flowTypeLabel(flowType: string | null): string {
  if (flowType === 'income') return 'Revenu planifié'
  if (flowType === 'expense') return 'Dépense planifiée'
  if (flowType === 'savings') return 'Épargne planifiée'
  if (flowType === 'transfer') return 'Transfert planifié'
  return 'Opération planifiée'
}

function budgetImpactLabel(value: string | null): string {
  if (value === 'already_budgeted') return 'Déjà budgétisée'
  if (value === 'additional_commitment') return 'Engagement additionnel'
  if (value === 'informational') return 'Informatif uniquement'
  return '—'
}

function recurrenceLabel(operation: FluxOperation): string {
  if (!operation.is_recurring || operation.recurrence_frequency !== 'monthly') return 'Non récurrente'
  const day = operation.recurrence_day_of_month ?? new Date(`${operation.operation_date}T00:00:00`).getDate()
  return `Tous les mois, le ${day}`
}

function shareRatioLabel(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const pct = Math.round(Number(value) * 100)
  if (pct === 100) return 'Personnel (100%)'
  if (pct === 0) return 'Non imputable (0%)'
  return `Personnel (${pct}%)`
}

export function PlannedOperationDetailsModal({ operation, onClose }: PlannedOperationDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!operation) return
    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !modalRef.current) return

      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, operation])

  const details = useMemo(() => {
    if (!operation) return null

    return {
      title: operation.label || 'Opération planifiée',
      amount: Number(operation.display_amount ?? operation.budget_accounting_amount ?? 0),
      dateText: formatLongDate(operation.operation_date),
      flowText: flowTypeLabel(operation.flow_type),
      rows: [
        { key: 'Catégorie', value: operation.parent_category_name ?? operation.category_name ?? '—' },
        { key: 'Sous-catégorie', value: operation.parent_category_name ? operation.category_name ?? '—' : '—' },
        { key: 'Compte', value: operation.account_name ?? '—' },
        { key: 'Bucket', value: operation.budget_bucket ?? '—' },
        { key: 'Impact budget', value: budgetImpactLabel(operation.budget_impact) },
        { key: 'Récurrence', value: recurrenceLabel(operation) },
        { key: 'Imputabilité', value: shareRatioLabel(operation.personal_share_ratio) },
        { key: 'Rapprochement', value: operation.is_matched ? `Oui (${operation.match_type ?? 'lié'})` : 'Non' },
      ],
    }
  }, [operation])

  return (
    <AnimatePresence>
      {operation && details ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(0,0,0,0.4)' }}
          />

          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: 0.2 }}
            style={{ position: 'fixed', inset: 0, zIndex: 251, display: 'grid', placeItems: 'center', padding: 'var(--space-4)' }}
          >
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="planned-operation-details-modal-title"
              style={{
                width: '100%',
                maxWidth: 520,
                maxHeight: 'min(86dvh, 760px)',
                background: 'var(--neutral-0)',
                border: '1px solid var(--neutral-200)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                padding: 'var(--space-6)',
                display: 'grid',
                gap: 'var(--space-5)',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Occurrence planifiée
                </span>
                <button
                  ref={closeRef}
                  type="button"
                  aria-label="Fermer"
                  onClick={onClose}
                  style={{
                    minWidth: 'var(--touch-target-min)',
                    minHeight: 'var(--touch-target-min)',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--neutral-300)',
                    background: 'var(--neutral-50)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--neutral-900)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ minHeight: 0, overflowY: 'auto', display: 'grid', gap: 'var(--space-5)' }}>
                <section style={{ borderRadius: 'var(--radius-lg)', background: 'var(--neutral-900)', color: 'var(--neutral-0)', padding: 'var(--space-6)', display: 'grid', gap: 'var(--space-2)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'rgba(255,255,255,0.72)' }}>
                    {details.flowText} · {details.dateText}
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-4xl)', fontWeight: 900, fontFamily: 'var(--font-mono)', lineHeight: 1.05 }}>
                    *{formatCurrencyRounded(Math.abs(details.amount))}*
                  </p>
                  <h2 id="planned-operation-details-modal-title" style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 800, lineHeight: 1.2 }}>
                    {details.title}
                  </h2>
                  {operation.merchant_name ? (
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'rgba(255,255,255,0.72)' }}>
                      {operation.merchant_name}
                    </p>
                  ) : null}
                </section>

                <section style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  {details.rows.map((row) => (
                    <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--neutral-600)' }}>{row.key}</span>
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--neutral-900)', textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </section>

                {operation.notes ? (
                  <section style={{ borderTop: '1px solid var(--neutral-200)', paddingTop: 'var(--space-4)', display: 'grid', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--neutral-900)' }}>Notes</span>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)', lineHeight: 1.5 }}>{operation.notes}</p>
                  </section>
                ) : null}
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
