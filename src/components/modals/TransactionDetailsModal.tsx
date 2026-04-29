import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrencyRounded, getCategoryColor } from '@/lib/utils'
import type { Category, Transaction } from '@/lib/types'

interface TransactionDetailsModalProps {
  transaction: Transaction | null
  categories?: Category[]
  transactionList?: Transaction[]
  onNavigate?: (transaction: Transaction) => void
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

export function TransactionDetailsModal({
  transaction,
  categories = [],
  transactionList = [],
  onNavigate,
  onClose,
}: TransactionDetailsModalProps) {
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
    const colorSourceCategory = parentCategory ?? ownCategory ?? null
    const colorIndex = colorSourceCategory ? Math.max(categories.findIndex((c) => c.id === colorSourceCategory.id), 0) : 0

    return {
      amount: signedAmount(transaction),
      label: displayTxnLabel(transaction),
      flowTypeText: flowTypeLabel(transaction.flow_type),
      dateText: formatLongDate(transaction.transaction_date),
      categoryName,
      subCategoryName,
      heroColor: getCategoryColor(colorSourceCategory?.color_token ?? null, colorIndex),
      rows: [
        { key: 'Catégorie', value: categoryName },
        { key: 'Sous-catégorie', value: subCategoryName },
        { key: 'Fixe/variable', value: budgetBehaviorLabel(transaction.budget_behavior) },
        { key: 'Compte', value: transaction.account?.name ?? '—' },
        { key: 'Imputabilité', value: shareRatioLabel(transaction.personal_share_ratio ?? null) },
      ],
    }
  }, [categories, categoryById, transaction])

  const sequence = useMemo(() => transactionList, [transactionList])
  const currentIndex = useMemo(() => {
    if (!transaction || !sequence.length) return -1
    return sequence.findIndex((item) => item.id === transaction.id)
  }, [sequence, transaction])
  const previousTxn = currentIndex > 0 ? sequence[currentIndex - 1] : null
  const nextTxn = currentIndex >= 0 && currentIndex < sequence.length - 1 ? sequence[currentIndex + 1] : null

  const handleNavigate = (target: Transaction | null) => {
    if (!target || !onNavigate) return
    onNavigate(target)
  }

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
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--space-3)' }}>
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
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-5)',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    minHeight: 290,
                    borderRadius: 'var(--radius-lg)',
                    background: details.heroColor,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '48px 1fr 48px',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-4) var(--space-4) 0',
                      position: 'relative',
                      zIndex: 2,
                    }}
                  >
                    <button
                      type="button"
                      aria-label="Opération précédente"
                      onClick={() => handleNavigate(previousTxn)}
                      disabled={!previousTxn}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid rgba(255,255,255,0.32)',
                        background: previousTxn ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                        color: previousTxn ? 'var(--neutral-0)' : 'rgba(255,255,255,0.52)',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: previousTxn ? 'pointer' : 'not-allowed',
                        justifySelf: 'start',
                      }}
                    >
                      <ChevronLeft size={18} />
                    </button>

                    <h2
                      id="transaction-details-modal-title"
                      style={{
                        margin: 0,
                        textAlign: 'center',
                        fontSize: 'var(--font-size-md)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--neutral-0)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {details.dateText}
                    </h2>

                    <button
                      type="button"
                      aria-label="Opération suivante"
                      onClick={() => handleNavigate(nextTxn)}
                      disabled={!nextTxn}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid rgba(255,255,255,0.32)',
                        background: nextTxn ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                        color: nextTxn ? 'var(--neutral-0)' : 'rgba(255,255,255,0.52)',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: nextTxn ? 'pointer' : 'not-allowed',
                        justifySelf: 'end',
                      }}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: '50%',
                      bottom: -220,
                      width: '190%',
                      height: 360,
                      transform: 'translateX(-50%)',
                      borderRadius: '50%',
                      background: 'var(--neutral-50)',
                    }}
                  />
                </div>

                <div
                  style={{
                    marginTop: '-178px',
                    position: 'relative',
                    zIndex: 2,
                    display: 'grid',
                    gap: 'var(--space-4)',
                    padding: '0 var(--space-2) var(--space-2)',
                  }}
                >
                  <div style={{ textAlign: 'center', display: 'grid', gap: 'var(--space-1)' }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 800,
                        color: '#fff',
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

                  <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  {details.rows.map((row, idx) => (
                    <div
                      key={`${row.key}-${idx}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 'var(--space-4)',
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
