import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { formatCurrencyRounded } from '@/lib/utils'
import type { FluxOperation } from '@/hooks/useFluxOperations'

type PlannedOperationDetailsModalProps = {
  operation: FluxOperation | null
  onClose: () => void
}

function formatLongDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function flowTypeLabel(flowType: FluxOperation['flow_type']): string {
  if (flowType === 'income') return 'Revenu planifié'
  if (flowType === 'savings') return 'Épargne planifiée'
  if (flowType === 'transfer') return 'Transfert planifié'
  return 'Dépense planifiée'
}

function statusLabel(status: FluxOperation['planned_status']): string {
  if (status === 'done') return 'Effectuée'
  if (status === 'upcoming') return 'À venir'
  return 'Planifiée'
}

export function PlannedOperationDetailsModal({ operation, onClose }: PlannedOperationDetailsModalProps) {
  const details = useMemo(() => {
    if (!operation) return null
    const amount = Math.abs(Number(operation.display_amount ?? operation.budget_accounting_amount ?? 0))
    return {
      title: operation.label ?? operation.category_name ?? 'Opération planifiée',
      category: operation.category_name ?? 'Sans catégorie',
      date: formatLongDate(operation.operation_date),
      amount: formatCurrencyRounded(amount),
      flowType: flowTypeLabel(operation.flow_type),
      status: statusLabel(operation.planned_status),
      notes: operation.notes,
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
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(13,13,31,0.45)' }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Détails de l'opération planifiée"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              left: 'var(--page-gutter)',
              right: 'var(--page-gutter)',
              top: '18vh',
              zIndex: 96,
              maxWidth: 420,
              margin: '0 auto',
              background: 'var(--neutral-0)',
              borderRadius: 'var(--radius-2xl)',
              boxShadow: 'var(--shadow-lg)',
              padding: 'var(--space-4)',
              display: 'grid',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <CategoryIcon iconKey={operation.category_icon_key} label={details.category} size={22} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {details.title}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--neutral-200)',
                  background: 'var(--neutral-100)',
                  color: 'var(--neutral-600)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <div
              style={{
                border: '1px solid var(--neutral-200)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-3)',
                display: 'grid',
                gap: 'var(--space-2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Montant</span>
                <strong style={{ fontSize: 15, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                  {details.amount}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Date</span>
                <span style={{ fontSize: 12, color: 'var(--neutral-800)', textAlign: 'right' }}>{details.date}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Type</span>
                <span style={{ fontSize: 12, color: 'var(--neutral-800)' }}>{details.flowType}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Statut</span>
                <span style={{ fontSize: 12, color: 'var(--neutral-800)' }}>{details.status}</span>
              </div>
              {details.notes ? (
                <div style={{ borderTop: '1px solid var(--neutral-200)', marginTop: 'var(--space-1)', paddingTop: 'var(--space-2)' }}>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-500)', marginBottom: 4 }}>Notes</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-800)', whiteSpace: 'pre-wrap' }}>{details.notes}</p>
                </div>
              ) : null}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
