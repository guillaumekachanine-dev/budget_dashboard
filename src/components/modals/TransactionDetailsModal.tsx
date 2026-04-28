import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { formatCurrencyRounded } from '@/lib/utils'
import type { Category, Transaction } from '@/lib/types'
import { CategoryIcon } from '@/components/ui/CategoryIcon'

interface TransactionDetailsModalProps {
  transaction: Transaction | null
  categories?: Category[]
  onClose: () => void
}

function displayTxnLabel(tx: Transaction): string {
  return (tx.normalized_label ?? tx.raw_label ?? 'Opération').trim() || 'Opération'
}

function flowTypeLabel(flowType: string): string {
  if (flowType === 'income') return 'Revenus'
  if (flowType === 'expense') return 'Dépenses'
  if (flowType === 'transfer') return 'Transferts internes'
  return flowType
}

function budgetBehaviorLabel(value: string): string {
  if (value === 'fixed') return 'Fixe'
  if (value === 'variable') return 'Variable'
  if (value === 'excluded') return 'Exclu'
  return value || '—'
}

function shareRatioLabel(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const pct = Math.round(Number(value) * 100)
  if (pct === 100) return 'Personnel (100%)'
  if (pct === 0) return 'Non imputable (0%)'
  return `Personnel (${pct}%)`
}

function signedAmount(tx: Transaction): number {
  const amount = Number(tx.amount) || 0
  if (tx.flow_type === 'income') return amount
  if (tx.flow_type === 'expense') return -amount
  if (tx.direction === 'transfer_in') return amount
  if (tx.direction === 'transfer_out') return -amount
  return amount
}

function formatLongDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatMoneyInteger(amount: number): string {
  if (!Number.isFinite(amount)) return formatCurrencyRounded(0)
  return formatCurrencyRounded(Math.floor(amount))
}

export function TransactionDetailsModal({ transaction, categories = [], onClose }: TransactionDetailsModalProps) {
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const modalRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!transaction) return

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
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, transaction])

  const details = useMemo(() => {
    if (!transaction) return null

    const ownCategory = transaction.category ?? (transaction.category_id ? categoryById.get(transaction.category_id) : undefined)
    const parentCategory = ownCategory?.parent_id ? categoryById.get(ownCategory.parent_id) ?? null : null

    const categoryName = parentCategory ? parentCategory.name : ownCategory?.name ?? '—'
    const subCategoryName = parentCategory ? ownCategory?.name ?? '—' : '—'
    const iconCategoryName = parentCategory?.name ?? ownCategory?.name ?? flowTypeLabel(transaction.flow_type)

    return {
      amount: signedAmount(transaction),
      label: displayTxnLabel(transaction),
      flowTypeText: flowTypeLabel(transaction.flow_type),
      categoryName,
      subCategoryName,
      iconCategoryName,
      rows: [
        { key: 'Date', value: formatLongDate(transaction.transaction_date) },
        { key: 'Marchand', value: transaction.merchant_name ?? '—' },
        { key: 'Type', value: flowTypeLabel(transaction.flow_type) },
        { key: 'Catégorie', value: categoryName },
        { key: 'Sous-catégorie', value: subCategoryName },
        { key: 'Fixe/variable', value: budgetBehaviorLabel(transaction.budget_behavior) },
        { key: 'Compte', value: transaction.account?.name ?? '—' },
        { key: 'Imputabilité', value: shareRatioLabel(transaction.personal_share_ratio ?? null) },
      ],
    }
  }, [categoryById, transaction])

  return (
    <AnimatePresence>
      {transaction && details ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(0,0,0,0.4)',
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 101,
              display: 'grid',
              placeItems: 'center',
              padding: 'var(--space-4)',
            }}
          >
            <div
              ref={modalRef}
              className="txn-details-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="transaction-details-modal-title"
              style={{
                width: '100%',
                maxHeight: 'min(86dvh, 760px)',
                background: 'var(--neutral-0)',
                border: '1px solid var(--neutral-200)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                padding: 'var(--space-6)',
                display: 'grid',
                gridTemplateRows: 'auto minmax(0, 1fr)',
                gap: 'var(--space-5)',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
                <h2
                  id="transaction-details-modal-title"
                  style={{
                    margin: 0,
                    fontSize: 'var(--font-size-md)',
                    fontWeight: 'var(--font-weight-bold)',
                    color: 'var(--neutral-900)',
                  }}
                >
                  Détail opération
                </h2>

                <button
                  ref={closeRef}
                  type="button"
                  aria-label="Fermer"
                  onClick={onClose}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--neutral-200)',
                    background: 'var(--neutral-0)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--neutral-600)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--neutral-100)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--neutral-0)'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div
                style={{
                  minHeight: 0,
                  overflowY: 'auto',
                  display: 'grid',
                  gridTemplateRows: 'minmax(0, 1fr) auto',
                  gap: 'var(--space-5)',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    alignContent: 'center',
                    justifyItems: 'center',
                    textAlign: 'center',
                    gap: 'var(--space-2)',
                    minHeight: 220,
                  }}
                >
                  <CategoryIcon
                    categoryName={details.iconCategoryName}
                    size={96}
                    fallback="●"
                    style={{ borderRadius: 'var(--radius-full)', overflow: 'hidden' }}
                  />

                  <p
                    style={{
                      margin: 0,
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--neutral-500)',
                    }}
                  >
                    {details.flowTypeText}
                  </p>

                  <p
                    style={{
                      margin: 0,
                      fontSize: 'var(--font-size-4xl)',
                      fontWeight: 'var(--font-weight-extrabold)',
                      lineHeight: 'var(--line-height-tight)',
                      color: details.amount >= 0 ? 'var(--color-success)' : 'var(--color-error)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {formatMoneyInteger(details.amount)}
                  </p>

                  <p
                    style={{
                      margin: 0,
                      fontSize: 'var(--font-size-md)',
                      fontWeight: 'var(--font-weight-medium)',
                      lineHeight: 'var(--line-height-snug)',
                      color: 'var(--neutral-700)',
                      maxWidth: '100%',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {details.label}
                  </p>
                </div>

                <div
                  style={{
                    border: '1px solid var(--neutral-200)',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--neutral-50)',
                    overflow: 'hidden',
                  }}
                >
                  {details.rows.map((row, idx) => (
                    <div
                      key={row.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-3) var(--space-4)',
                        borderBottom: idx === details.rows.length - 1 ? 'none' : '1px solid var(--neutral-200)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 'var(--font-weight-medium)',
                          color: 'var(--neutral-600)',
                        }}
                      >
                        {row.key}
                      </span>

                      <span
                        style={{
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 'var(--font-weight-bold)',
                          color: 'var(--neutral-900)',
                          textAlign: 'right',
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          <style>{`
            .txn-details-dialog {
              max-width: 500px;
            }

            @media (min-width: 768px) {
              .txn-details-dialog {
                max-width: 600px;
              }
            }
          `}</style>
        </>
      ) : null}
    </AnimatePresence>
  )
}
