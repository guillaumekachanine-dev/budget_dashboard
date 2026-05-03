import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, ArrowLeft, Pencil, Check as CheckIcon, AlertCircle } from 'lucide-react'
import { formatCurrencyRounded, getCategoryColor } from '@/lib/utils'
import type { Category, Transaction, FlowType, BudgetBehavior } from '@/lib/types'
import { useUpdateTransaction, useDeleteTransaction } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useState } from 'react'
import { CategoryPickerModal, ALL_CATEGORY_TOKEN } from './AddTransactionModal'

interface TransactionDetailsModalProps {
  transaction: Transaction | null
  categories?: Category[]
  transactionList?: Transaction[]
  onNavigate?: (transaction: Transaction) => void
  onBack?: () => void
  onClose: () => void
  showEditControls?: boolean
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
  onBack,
  onClose,
  showEditControls = false,
}: TransactionDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const [editLabel, setEditLabel] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editFlowType, setEditFlowType] = useState<FlowType>('expense')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editAccountId, setEditAccountId] = useState('')
  const [editBudgetBehavior, setEditBudgetBehavior] = useState<BudgetBehavior>('variable')
  const [editShareRatio, setEditShareRatio] = useState('')

  const [pickerMode, setPickerMode] = useState<'none' | 'category' | 'subcategory'>('none')
  const [pickerClosing, setPickerClosing] = useState<'none' | 'category' | 'subcategory'>('none')
  const [flipSubId, setFlipSubId] = useState<string | null>(null)

  const { data: accountsData } = useAccounts()
  const principalAccount = accountsData?.find(a => !a.name.toLowerCase().includes('joint'))
  const jointAccount = accountsData?.find(a => a.name.toLowerCase().includes('joint'))

  const updateMutation = useUpdateTransaction()
  const deleteMutation = useDeleteTransaction()
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const modalRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  const hasHierarchy = useMemo(
    () => (categories ?? []).some((category) => category.parent_id !== null),
    [categories],
  )

  const rootCategories = useMemo(() => {
    const list = categories ?? []
    if (!hasHierarchy) return list
    return list.filter((category) => category.parent_id === null)
  }, [categories, hasHierarchy])

  const editCategoryObj = editCategoryId ? categoryById.get(editCategoryId) : null
  const editRootCategoryId = editCategoryObj?.parent_id || editCategoryObj?.id || ''
  const editSubCategoryId = editCategoryObj?.parent_id ? editCategoryObj.id : ''

  const subCategories = useMemo(() => {
    if (!editRootCategoryId) return []
    const list = categories ?? []
    if (!hasHierarchy) return list.filter((category) => category.id === editRootCategoryId)
    return list.filter((category) => category.parent_id === editRootCategoryId)
  }, [categories, hasHierarchy, editRootCategoryId])

  const handleCategorySelect = (id: string) => {
    if (id === ALL_CATEGORY_TOKEN) {
      setEditCategoryId('')
      setPickerMode('none')
      setPickerClosing('none')
      return
    }

    setEditCategoryId(id)

    if (!hasHierarchy) {
      setPickerMode('none')
      setPickerClosing('none')
      return
    }

    setPickerClosing('category')
    window.setTimeout(() => {
      setPickerMode('subcategory')
      setPickerClosing('none')
    }, 280)
  }

  const handleSubCategorySelect = (id: string) => {
    setFlipSubId(id)
    setPickerClosing('subcategory')

    window.setTimeout(() => {
      setEditCategoryId(id)
      setPickerMode('none')
      setPickerClosing('none')
      setFlipSubId(null)
    }, 420)
  }

  useEffect(() => {
    if (!transaction) return

    setEditLabel(transaction.normalized_label ?? transaction.raw_label ?? '')
    setEditAmount(String(transaction.amount))
    setEditDate(transaction.transaction_date)
    setEditFlowType(transaction.flow_type)
    setEditCategoryId(transaction.category_id ?? '')
    setEditAccountId(transaction.account_id ?? '')
    setEditBudgetBehavior(transaction.budget_behavior)
    setEditShareRatio(String(transaction.personal_share_ratio ?? 1))
    setIsEditing(false)
    setShowDeleteConfirm(false)

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
    <>
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
              zIndex: 250,
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
              zIndex: 251,
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
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {onBack && !isEditing ? (
                    <button
                      type="button"
                      aria-label="Retour à la liste des opérations"
                      onClick={onBack}
                      style={{
                        minWidth: 'var(--touch-target-min)',
                        minHeight: 'var(--touch-target-min)',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--neutral-300)',
                        background: 'var(--neutral-50)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--neutral-900)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--neutral-200)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--neutral-50)'
                      }}
                    >
                      <ArrowLeft size={16} />
                    </button>
                  ) : null}

                  {showEditControls && !isEditing && (
                    <button
                      type="button"
                      aria-label="Modifier l'opération"
                      onClick={() => setIsEditing(true)}
                      style={{
                        minWidth: 'var(--touch-target-min)',
                        minHeight: 'var(--touch-target-min)',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--neutral-300)',
                        background: 'var(--neutral-50)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--neutral-900)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--neutral-200)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--neutral-50)'
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                  ) || (isEditing && (
                    <button
                      type="button"
                      aria-label="Annuler l'édition"
                      onClick={() => setIsEditing(false)}
                      style={{
                        padding: '0 var(--space-4)',
                        height: 'var(--touch-target-min)',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--neutral-300)',
                        background: 'var(--neutral-50)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--neutral-900)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 'var(--font-weight-bold)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--neutral-200)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--neutral-50)'
                      }}
                    >
                      Annuler
                    </button>
                  ))}
                </div>
                {isEditing ? (
                  <button
                    type="button"
                    aria-label="Enregistrer les modifications"
                    onClick={() => {
                      if (!transaction) return
                      updateMutation.mutate({
                        id: transaction.id,
                        updates: {
                          normalized_label: editLabel,
                          amount: Number(editAmount),
                          transaction_date: editDate,
                          flow_type: editFlowType,
                          category_id: editCategoryId || null,
                          account_id: editAccountId,
                          budget_behavior: editBudgetBehavior,
                          personal_share_ratio: Number(editShareRatio),
                        },
                      }, {
                        onSuccess: () => setIsEditing(false)
                      })
                    }}
                    style={{
                      minWidth: 'var(--touch-target-min)',
                      minHeight: 'var(--touch-target-min)',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--primary-300)',
                      background: 'var(--primary-600)',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#fff',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--primary-700)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--primary-600)'
                    }}
                  >
                    <CheckIcon size={16} />
                  </button>
                ) : (
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
                      transition: 'all var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--neutral-200)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--neutral-50)'
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
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
                        minWidth: 'var(--touch-target-min)',
                        minHeight: 'var(--touch-target-min)',
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
                        display: 'flex',
                        justifyContent: 'center',
                      }}
                    >
                      {isEditing ? (
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            borderRadius: 'var(--radius-md)',
                            color: '#fff',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 'bold',
                            padding: '2px 8px',
                            textAlign: 'center',
                            outline: 'none',
                          }}
                        />
                      ) : details.dateText}
                    </h2>

                    <button
                      type="button"
                      aria-label="Opération suivante"
                      onClick={() => handleNavigate(nextTxn)}
                      disabled={!nextTxn}
                      style={{
                        minWidth: 'var(--touch-target-min)',
                        minHeight: 'var(--touch-target-min)',
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
                      onClick={() => {
                        if (!isEditing) return
                        const types: FlowType[] = ['expense', 'income', 'transfer', 'savings']
                        const next = types[(types.indexOf(editFlowType) + 1) % types.length]
                        setEditFlowType(next)
                      }}
                      style={{
                        margin: 0,
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 800,
                        color: '#fff',
                        cursor: isEditing ? 'pointer' : 'default',
                        padding: isEditing ? '2px 8px' : '0',
                        borderRadius: 'var(--radius-sm)',
                        background: isEditing ? 'rgba(255,255,255,0.1)' : 'transparent',
                        border: isEditing ? '1px solid rgba(255,255,255,0.3)' : 'none',
                      }}
                    >
                      {isEditing ? flowTypeLabel(editFlowType) : details.flowTypeText}
                    </p>

                    {isEditing ? (
                      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 'var(--font-size-4xl)',
                            fontWeight: 'var(--font-weight-extrabold)',
                            color: details.amount >= 0 ? 'var(--color-success)' : 'var(--color-error)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              borderBottom: '2px solid currentColor',
                              color: 'inherit',
                              fontSize: 'inherit',
                              fontWeight: 'inherit',
                              fontFamily: 'inherit',
                              width: '100%',
                              textAlign: 'center',
                              outline: 'none',
                              padding: '0 var(--space-2)',
                            }}
                          />
                        </p>
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          placeholder="Libellé"
                          style={{
                            margin: '0 auto',
                            fontSize: 'var(--font-size-md)',
                            fontWeight: 'var(--font-weight-medium)',
                            color: 'var(--neutral-700)',
                            textAlign: 'center',
                            background: 'var(--neutral-100)',
                            border: '1px solid var(--neutral-300)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-1) var(--space-3)',
                            width: '90%',
                            outline: 'none',
                          }}
                        />
                      </div>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>

                  <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    {isEditing ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--neutral-600)' }}>Catégorie</span>
                          <button
                            type="button"
                            onClick={() => {
                              setPickerMode('category')
                              setPickerClosing('none')
                            }}
                            style={{ 
                              fontSize: 'var(--font-size-sm)', 
                              fontWeight: 'var(--font-weight-bold)', 
                              color: 'var(--neutral-900)', 
                              border: '1px solid var(--neutral-200)', 
                              borderRadius: 'var(--radius-sm)', 
                              padding: '2px 8px',
                              background: 'var(--neutral-50)',
                              cursor: 'pointer',
                              maxWidth: '180px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {editCategoryObj ? editCategoryObj.name : '—'}
                          </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--neutral-600)' }}>Fixe/variable</span>
                          <button
                            type="button"
                            onClick={() => {
                              const behaviors: BudgetBehavior[] = ['variable', 'fixed', 'excluded']
                              const next = behaviors[(behaviors.indexOf(editBudgetBehavior) + 1) % behaviors.length]
                              setEditBudgetBehavior(next)
                            }}
                            style={{ 
                              fontSize: 'var(--font-size-sm)', 
                              fontWeight: 'var(--font-weight-bold)', 
                              color: 'var(--neutral-900)', 
                              border: '1px solid var(--neutral-200)', 
                              borderRadius: 'var(--radius-sm)', 
                              padding: '2px 8px',
                              background: 'var(--neutral-50)',
                              cursor: 'pointer',
                              maxWidth: '180px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {budgetBehaviorLabel(editBudgetBehavior)}
                          </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--neutral-600)' }}>Compte</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (!principalAccount || !jointAccount) return
                              setEditAccountId(editAccountId === principalAccount.id ? jointAccount.id : principalAccount.id)
                            }}
                            style={{ 
                              fontSize: 'var(--font-size-sm)', 
                              fontWeight: 'var(--font-weight-bold)', 
                              color: 'var(--neutral-900)', 
                              border: '1px solid var(--neutral-200)', 
                              borderRadius: 'var(--radius-sm)', 
                              padding: '2px 8px',
                              background: 'var(--neutral-50)',
                              cursor: 'pointer',
                              maxWidth: '180px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {editAccountId === jointAccount?.id ? 'Compte joint' : 'Compte principal'}
                          </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--neutral-600)' }}>Imputabilité</span>
                          <button
                            type="button"
                            onClick={() => {
                              const ratios = ['1', '0.5', '0']
                              const next = ratios[(ratios.indexOf(editShareRatio) + 1) % ratios.length]
                              setEditShareRatio(next)
                            }}
                            style={{ 
                              fontSize: 'var(--font-size-sm)', 
                              fontWeight: 'var(--font-weight-bold)', 
                              color: 'var(--neutral-900)', 
                              border: '1px solid var(--neutral-200)', 
                              borderRadius: 'var(--radius-sm)', 
                              padding: '2px 8px',
                              background: 'var(--neutral-50)',
                              cursor: 'pointer',
                              minWidth: 40,
                              textAlign: 'center',
                              maxWidth: '180px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {editShareRatio}
                          </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-4)' }}>
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(true)}
                            style={{
                              border: '2px solid var(--color-error)',
                              background: 'transparent',
                              color: 'var(--color-error)',
                              borderRadius: 'var(--radius-md)',
                              padding: 'var(--space-2) var(--space-6)',
                              fontSize: 'var(--font-size-sm)',
                              fontWeight: 'var(--font-weight-bold)',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--color-error)'
                              e.currentTarget.style.color = '#fff'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.color = 'var(--color-error)'
                            }}
                          >
                            Supprimer
                          </button>
                        </div>
                      </>
                    ) : (
                      details.rows.map((row, idx) => (
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
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>

    <AnimatePresence>
      {showDeleteConfirm && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteConfirm(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 300,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(2px)',
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 301,
              width: 'min(90%, 400px)',
              background: 'var(--neutral-0)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-xl)',
              textAlign: 'center',
              display: 'grid',
              gap: 'var(--space-4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-error-light, #fee2e2)', display: 'grid', placeItems: 'center', color: 'var(--color-error)' }}>
                <AlertCircle size={24} />
              </div>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)' }}>Confirmer la suppression</h3>
              <p style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-600)' }}>Êtes-vous sûr de vouloir supprimer cette opération ? Cette action est irréversible.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--neutral-200)',
                  background: 'var(--neutral-100)',
                  color: 'var(--neutral-700)',
                  fontWeight: 'var(--font-weight-semibold)',
                  cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!transaction) return
                  deleteMutation.mutate(transaction.id, {
                    onSuccess: () => {
                      setShowDeleteConfirm(false)
                      setIsEditing(false)
                      onClose()
                    }
                  })
                }}
                style={{
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'var(--color-error)',
                  color: '#fff',
                  fontWeight: 'var(--font-weight-semibold)',
                  cursor: 'pointer',
                }}
              >
                Supprimer
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    <CategoryPickerModal
      open={pickerMode === 'category'}
      mode="category"
      title="Sélectionner une catégorie"
      items={rootCategories}
      selectedId={editRootCategoryId}
      closing={pickerClosing === 'category'}
      onClose={() => {
        setPickerMode('none')
        setPickerClosing('none')
      }}
      onSelect={handleCategorySelect}
    />

    <CategoryPickerModal
      open={pickerMode === 'subcategory'}
      mode="subcategory"
      title="Sélectionner une sous-catégorie"
      items={subCategories}
      selectedId={editSubCategoryId}
      closing={pickerClosing === 'subcategory'}
      flipId={flipSubId}
      onClose={() => {
        setPickerMode('none')
        setPickerClosing('none')
        setFlipSubId(null)
      }}
      onSelect={handleSubCategorySelect}
    />

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
  )
}
