import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAccounts } from '@/hooks/useAccounts'
import { useAuth } from '@/hooks/useAuth'
import { useCategories } from '@/hooks/useCategories'
import { useAddPlannedOperation } from '@/hooks/usePlannedOperations'
import {
  ALL_CATEGORY_TOKEN,
  CategoryPickerModal,
} from '@/components/modals/AddTransactionModal'
import type {
  PlannedOperationBudgetImpact,
  PlannedOperationFlowType,
  PlannedOperationInsert,
} from '@/lib/types'
import { todayIso } from '@/lib/utils'

type AddPlannedOperationModalProps = {
  open: boolean
  onClose: () => void
}

type PickerMode = 'none' | 'category' | 'subcategory'
type AccountMode = 'personal' | 'joint'

type FormValues = {
  date: string
  flowType: PlannedOperationFlowType
  amount: string
  label: string
  categoryId: string
  subCategoryId: string
  accountId: string
  accountMode: AccountMode
  personalShareRatio: number
  budgetImpact: PlannedOperationBudgetImpact
  isRecurringMonthly: boolean
}

type FormErrors = Partial<Record<'date' | 'amount' | 'label' | 'accountId' | 'personalShareRatio' | 'submit', string>>

const FLOW_OPTIONS: Array<{ value: PlannedOperationFlowType; label: string }> = [
  { value: 'expense', label: 'Dépense planifiée' },
  { value: 'income', label: 'Revenu planifié' },
  { value: 'savings', label: 'Épargne planifiée' },
  { value: 'transfer', label: 'Transfert planifié' },
]
const TRANSFER_SUBCATEGORY_NAMES = ['Virement épargne', 'Virement investissement', 'Épargne projet'] as const

function normalizeText(value?: string | null): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const BUDGET_IMPACT_LABELS: Record<PlannedOperationBudgetImpact, string> = {
  already_budgeted: 'Déjà budgétisée',
  additional_commitment: 'Additionnel',
  informational: 'Informatif uniquement',
}

function createDefaultFormValues(): FormValues {
  return {
    date: todayIso(),
    flowType: 'expense',
    amount: '',
    label: '',
    categoryId: '',
    subCategoryId: '',
    accountId: '',
    accountMode: 'personal',
    personalShareRatio: 1,
    budgetImpact: 'already_budgeted',
    isRecurringMonthly: false,
  }
}

function parseMoney(value: string): number | null {
  const normalized = value.replace(/\s/g, '').replace('€', '').replace(/,/g, '.').trim()
  const sanitized = normalized.replace(/[^\d.-]/g, '')
  if (!sanitized) return null

  const parsed = Number(sanitized)
  if (!Number.isFinite(parsed) || parsed === 0) return null

  return Math.round(Math.abs(parsed) * 100) / 100
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function isValidDate(value: string): boolean {
  if (!value) return false
  return !Number.isNaN(Date.parse(value))
}

function formatLongDate(value: string): string {
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function readFormattedAmount(value: string, focused: boolean): string {
  if (focused) return value
  const parsed = parseMoney(value)
  if (parsed == null) return ''
  return formatMoney(parsed)
}

function toAmountInputValue(value: string): string {
  return value.replace(/\s/g, '').replace('€', '').replace(/,/g, '.').replace(/[^\d.-]/g, '')
}

function shareRatioLabel(personalShareRatio: number): string {
  if (personalShareRatio <= 0) return 'Non (0%)'
  if (personalShareRatio <= 0.5) return 'Partagé (50%)'
  return 'Personnel (100%)'
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p
      className="m-0 mt-[var(--space-1)] text-[var(--font-size-xs)] text-[var(--color-error)]"
      style={{ lineHeight: 'var(--line-height-snug)' }}
      role="alert"
    >
      {message}
    </p>
  )
}

function SettingsRow({
  label,
  value,
  onClick,
  disabled = false,
}: {
  label: string
  value: string
  onClick?: () => void
  disabled?: boolean
}) {
  const interactive = Boolean(onClick) && !disabled
  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-[var(--space-3)] border-none bg-transparent px-[var(--space-3)] py-[var(--space-2)] text-left"
      style={{
        cursor: interactive ? 'pointer' : 'default',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        className="text-[var(--font-size-base)] font-[var(--font-weight-medium)] text-[var(--neutral-700)]"
        style={{ lineHeight: 'var(--line-height-tight)' }}
      >
        {label}
      </span>
      <span
        className="text-[var(--font-size-base)] font-[var(--font-weight-bold)] text-[var(--neutral-900)]"
        style={{ lineHeight: 'var(--line-height-tight)' }}
      >
        {value}
      </span>
    </button>
  )
}

function FlowTypePill({
  value,
  onChange,
}: {
  value: PlannedOperationFlowType
  onChange: (next: PlannedOperationFlowType) => void
}) {
  const label = FLOW_OPTIONS.find((option) => option.value === value)?.label ?? FLOW_OPTIONS[0].label
  const borderColor =
    value === 'expense'
      ? 'color-mix(in oklab, var(--color-error) 52%, white 48%)'
      : value === 'income'
        ? 'color-mix(in oklab, var(--color-success) 52%, white 48%)'
        : value === 'savings'
          ? '#FFD700'
          : 'rgba(255,255,255,0.8)'

  return (
    <button
      type="button"
      onClick={() => {
        const currentIndex = FLOW_OPTIONS.findIndex((option) => option.value === value)
        const nextIndex = (currentIndex + 1) % FLOW_OPTIONS.length
        const nextValue = FLOW_OPTIONS[nextIndex]?.value ?? FLOW_OPTIONS[0].value
        onChange(nextValue)
      }}
      style={{
        width: 'auto',
        border: `2px solid ${borderColor}`,
        borderRadius: 'var(--radius-full)',
        background: 'rgba(255,255,255,0.16)',
        color: 'var(--neutral-0)',
        fontSize: 'var(--font-size-sm)',
        fontWeight: 800,
        padding: '10px 18px',
        cursor: 'pointer',
        textAlign: 'center',
        letterSpacing: '0.01em',
        lineHeight: 'var(--line-height-tight)',
        whiteSpace: 'nowrap',
      }}
      aria-label={`Type d'opération planifiée: ${label}. Cliquer pour changer.`}
    >
      {label}
    </button>
  )
}

export function AddPlannedOperationModal({ open, onClose }: AddPlannedOperationModalProps) {
  const { user } = useAuth()
  const { data: accounts } = useAccounts()
  const { mutateAsync: addPlannedOperation, isPending } = useAddPlannedOperation()

  const [values, setValues] = useState<FormValues>(() => createDefaultFormValues())
  const [errors, setErrors] = useState<FormErrors>({})
  const [pickerMode, setPickerMode] = useState<PickerMode>('none')
  const [pickerClosing, setPickerClosing] = useState<PickerMode>('none')
  const [flipSubId, setFlipSubId] = useState<string | null>(null)
  const [amountFocused, setAmountFocused] = useState(false)

  const amountRef = useRef<HTMLInputElement | null>(null)
  const dateRef = useRef<HTMLInputElement | null>(null)

  const flowTypeForCategoryQuery = values.flowType === 'transfer' ? 'transfer' : values.flowType
  const { data: categories } = useCategories(flowTypeForCategoryQuery)
  const { data: allCategories } = useCategories()

  const hasHierarchy = useMemo(
    () => (categories ?? []).some((category) => category.parent_id !== null),
    [categories],
  )

  const rootCategories = useMemo(() => {
    const list = categories ?? []
    if (!hasHierarchy) return list
    return list.filter((category) => category.parent_id === null)
  }, [categories, hasHierarchy])

  const directSubcategoryRoot = useMemo(() => {
    if (values.flowType !== 'income' && values.flowType !== 'transfer' && values.flowType !== 'savings') return null
    if (!hasHierarchy || rootCategories.length !== 1) return null
    return rootCategories[0] ?? null
  }, [hasHierarchy, rootCategories, values.flowType])

  const subCategories = useMemo(() => {
    if (values.flowType === 'transfer') {
      const preferred = (allCategories ?? []).filter((category) => {
        const normalizedName = normalizeText(category.name)
        const normalizedIconKey = normalizeText(category.icon_key)
        const isVirementEpargne = normalizedName.includes('virement') && normalizedName.includes('epargne')
        const isVirementInvestissement = normalizedName.includes('virement') && normalizedName.includes('investissement')
        const isEpargneProjet = normalizedName.includes('epargne') && normalizedName.includes('projet')
        const byIconAlias = ['epargne virement', 'epargne investissement', 'epargne projet'].some((token) =>
          normalizedIconKey.includes(token),
        )

        return isVirementEpargne || isVirementInvestissement || isEpargneProjet || byIconAlias
      })

      const transferList = categories ?? []
      const transferChildren = transferList.filter((category) => category.parent_id !== null)
      const transferFlowList = transferChildren.length > 0 ? transferChildren : transferList
      const mergedById = new Map<string, (typeof transferList)[number]>()
      ;[...transferFlowList, ...preferred].forEach((category) => mergedById.set(category.id, category))

      const preferredOrder = TRANSFER_SUBCATEGORY_NAMES.map((label) => normalizeText(label))
      const merged = Array.from(mergedById.values()).sort((a, b) => {
        const aNorm = normalizeText(a.name)
        const bNorm = normalizeText(b.name)
        const aIndex = preferredOrder.findIndex((token) => aNorm.includes(token))
        const bIndex = preferredOrder.findIndex((token) => bNorm.includes(token))
        if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name, 'fr')
        if (aIndex === -1) return 1
        if (bIndex === -1) return -1
        return aIndex - bIndex
      })

      const filteredTransfer = merged.filter((category) => {
        const normalizedName = normalizeText(category.name)
        const normalizedIconKey = normalizeText(category.icon_key)
        const isVirementEpargne = normalizedName.includes('virement') && normalizedName.includes('epargne')
        const isEpargneProjet = normalizedName.includes('epargne') && normalizedName.includes('projet')
        const byIconAlias = normalizedIconKey.includes('epargne virement') || normalizedIconKey.includes('epargne projet')
        return !isVirementEpargne && !isEpargneProjet && !byIconAlias
      })

      if (filteredTransfer.length > 0) return filteredTransfer
    }

    if (!values.categoryId) return []
    const list = categories ?? []
    if (!hasHierarchy) return list.filter((category) => category.id === values.categoryId)
    return list.filter((category) => category.parent_id === values.categoryId)
  }, [allCategories, categories, hasHierarchy, values.categoryId, values.flowType])

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((category) => [category.id, category])),
    [categories],
  )

  const selectedCategory = values.categoryId ? categoryById.get(values.categoryId) ?? null : null
  const selectedSubCategory = values.subCategoryId ? categoryById.get(values.subCategoryId) ?? null : null

  const categoryLabel = selectedSubCategory?.name ?? selectedCategory?.name ?? (values.flowType === 'transfer' ? 'Optionnelle (transfert)' : 'Choisir')
  const pickerItemLabel = useCallback((name: string) => {
    if (name.trim().toLowerCase() === 'remboursement') return 'Rembours.'
    return name
  }, [])

  const amountDisplay = useMemo(
    () => readFormattedAmount(values.amount, amountFocused),
    [amountFocused, values.amount],
  )

  const personalAccount = useMemo(() => {
    if (!accounts?.length) return null
    const withoutJoint = accounts.filter((account) => !/joint/i.test(account.name))
    return (
      withoutJoint.find((account) => account.account_type === 'checking')
      ?? withoutJoint[0]
      ?? accounts.find((account) => account.account_type === 'checking')
      ?? accounts[0]
    )
  }, [accounts])

  const jointAccount = useMemo(() => {
    if (!accounts?.length) return null
    return accounts.find((account) => /joint/i.test(account.name)) ?? null
  }, [accounts])

  const canUseJoint = Boolean(jointAccount)

  const canSubmit = useMemo(() => {
    const parsedAmount = parseMoney(values.amount)
    const hasValidRatio = values.personalShareRatio >= 0 && values.personalShareRatio <= 1
    return Boolean(
      values.label.trim()
      && isValidDate(values.date)
      && parsedAmount && parsedAmount > 0
      && values.flowType
      && values.accountId
      && hasValidRatio,
    )
  }, [values])

  const closeAndReset = useCallback(() => {
    setValues(createDefaultFormValues())
    setErrors({})
    setPickerMode('none')
    setPickerClosing('none')
    setFlipSubId(null)
    setAmountFocused(false)
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const timeout = window.setTimeout(() => amountRef.current?.focus(), 70)
    return () => window.clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (!accounts?.length || values.accountId) return
    const initialAccount = personalAccount ?? accounts[0]
    if (!initialAccount) return
    setValues((current) => ({ ...current, accountId: initialAccount.id, accountMode: 'personal' }))
  }, [accounts, personalAccount, values.accountId])

  useEffect(() => {
    if (values.flowType === 'expense') {
      setValues((current) => ({
        ...current,
        budgetImpact: 'already_budgeted',
        personalShareRatio: 1,
      }))
      return
    }

    if (values.flowType === 'savings') {
      setValues((current) => ({
        ...current,
        budgetImpact: 'already_budgeted',
        personalShareRatio: 1,
      }))
      return
    }

    if (values.flowType === 'transfer') {
      setValues((current) => ({
        ...current,
        budgetImpact: 'informational',
        personalShareRatio: 0,
      }))
      return
    }

    setValues((current) => ({
      ...current,
      budgetImpact: 'informational',
      personalShareRatio: 1,
    }))
  }, [values.flowType])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()

      if (pickerMode !== 'none') {
        setPickerMode('none')
        setPickerClosing('none')
        setFlipSubId(null)
        return
      }

      closeAndReset()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [closeAndReset, open, pickerMode])

  const clearFieldError = (field: keyof FormErrors) => {
    setErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleCategorySelect = (id: string) => {
    if (id === ALL_CATEGORY_TOKEN) {
      setValues((current) => ({ ...current, categoryId: '', subCategoryId: '' }))
      setPickerMode('none')
      setPickerClosing('none')
      return
    }

    setValues((current) => ({ ...current, categoryId: id, subCategoryId: '' }))

    if (!hasHierarchy) {
      setValues((current) => ({ ...current, subCategoryId: id }))
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
      const subCategory = categoryById.get(id) ?? null
      setValues((current) => ({
        ...current,
        subCategoryId: id,
        categoryId: current.categoryId || subCategory?.parent_id || id,
      }))
      setPickerMode('none')
      setPickerClosing('none')
      setFlipSubId(null)
      amountRef.current?.focus()
    }, 420)
  }

  const handleSubCategoryBackToCategory = () => {
    setPickerClosing('subcategory')
    setFlipSubId(null)
    window.setTimeout(() => {
      setPickerMode('category')
      setPickerClosing('none')
    }, 280)
  }

  const handleAccountModeToggle = () => {
    if (!canUseJoint) return
    const nextMode: AccountMode = values.accountMode === 'personal' ? 'joint' : 'personal'
    const nextAccount = nextMode === 'joint' ? jointAccount : personalAccount

    setValues((current) => ({
      ...current,
      accountMode: nextMode,
      accountId: nextAccount?.id ?? current.accountId,
    }))
    clearFieldError('accountId')
  }

  const handleShareRatioToggle = () => {
    const current = values.personalShareRatio
    const next = current >= 1 ? 0.5 : current >= 0.5 ? 0 : 1
    setValues((prev) => ({ ...prev, personalShareRatio: next }))
    clearFieldError('personalShareRatio')
  }

  const handleBudgetImpactToggle = () => {
    const order: PlannedOperationBudgetImpact[] = [
      'already_budgeted',
      'additional_commitment',
      'informational',
    ]
    const currentIndex = order.indexOf(values.budgetImpact)
    const next = order[(currentIndex + 1) % order.length]
    setValues((current) => ({ ...current, budgetImpact: next }))
  }

  const validate = (): boolean => {
    const nextErrors: FormErrors = {}

    if (!values.label.trim()) {
      nextErrors.label = 'Le libellé est obligatoire.'
    }

    if (!isValidDate(values.date)) {
      nextErrors.date = 'Veuillez choisir une date valide.'
    }

    const parsedAmount = parseMoney(values.amount)
    if (parsedAmount == null || parsedAmount <= 0) {
      nextErrors.amount = 'Le montant doit être supérieur à 0.'
    }

    if (!values.accountId) {
      nextErrors.accountId = 'Sélectionnez un compte.'
    }

    if (values.personalShareRatio < 0 || values.personalShareRatio > 1) {
      nextErrors.personalShareRatio = 'La part personnelle doit être entre 0 et 1.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const onSubmit = async () => {
    if (!user) return
    if (!validate()) return

    const parsedAmount = parseMoney(values.amount)
    if (parsedAmount == null) return

    const recurringDayRaw = values.isRecurringMonthly
      ? new Date(`${values.date}T00:00:00`).getDate()
      : null
    const recurringDay = recurringDayRaw != null && Number.isFinite(recurringDayRaw) ? recurringDayRaw : null
    const recurrenceStartDate = values.isRecurringMonthly ? values.date : null
    const recurrenceEndDate = values.isRecurringMonthly
      ? `${values.date.slice(0, 4)}-12-31`
      : null

    const payload: PlannedOperationInsert = {
      user_id: user.id,
      account_id: values.accountId || null,
      category_id: values.flowType === 'transfer'
        ? null
        : (values.subCategoryId || values.categoryId || null),
      merchant_name: null,
      label: values.label.trim(),
      planned_date: values.date,
      planned_amount: parsedAmount,
      currency: 'EUR',
      flow_type: values.flowType,
      status: 'planned',
      budget_impact: values.flowType === 'expense' || values.flowType === 'savings'
        ? values.budgetImpact
        : 'informational',
      personal_share_ratio: values.personalShareRatio,
      matched_transaction_id: null,
      notes: null,
      is_recurring: values.isRecurringMonthly,
      recurrence_frequency: values.isRecurringMonthly ? 'monthly' : 'none',
      recurrence_day_of_month: recurringDay,
      recurrence_start_date: recurrenceStartDate,
      recurrence_end_date: recurrenceEndDate,
    }

    try {
      await addPlannedOperation(payload)
      closeAndReset()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la planification de l\'opération.'
      setErrors((current) => ({ ...current, submit: message }))
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0"
            style={{ background: 'rgba(17,24,39,0.42)', zIndex: 140 }}
            onClick={closeAndReset}
          />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-planned-operation-modal-title"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-[500px] overflow-hidden rounded-t-[var(--radius-xl)] bg-[var(--neutral-0)] shadow-[var(--shadow-lg)]"
            style={{ zIndex: 141, maxHeight: '81dvh' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex max-h-[81dvh] flex-col">
              <header
                className="relative overflow-hidden px-[var(--space-6)]"
                style={{
                  minHeight: 176,
                  paddingTop: 'var(--space-5)',
                  background: 'linear-gradient(135deg, color-mix(in oklab, var(--viz-a) 82%, #000 18%) 0%, color-mix(in oklab, var(--viz-b) 76%, #000 24%) 100%)',
                }}
              >
                <h2 id="add-planned-operation-modal-title" className="sr-only">
                  Planifier une opération
                </h2>

                <button
                  type="button"
                  aria-label="Fermer"
                  onClick={closeAndReset}
                  className="absolute right-[var(--space-3)] top-[var(--space-3)] inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] border-none bg-[rgba(255,255,255,0.18)] text-[var(--neutral-0)]"
                >
                  <X size={20} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const pickerInput = dateRef.current as (HTMLInputElement & { showPicker?: () => void }) | null
                    if (pickerInput?.showPicker) pickerInput.showPicker()
                    else dateRef.current?.focus()
                  }}
                  className="absolute left-1/2 -translate-x-1/2 border-none bg-transparent p-0 text-[var(--neutral-0)]"
                  style={{ top: 'calc(var(--space-5) + 4px)' }}
                >
                  <span
                    className="block text-center text-[var(--font-size-2xl)] font-[var(--font-weight-extrabold)]"
                    style={{ lineHeight: 'var(--line-height-tight)', textTransform: 'capitalize' }}
                  >
                    {formatLongDate(values.date)}
                  </span>
                </button>

                <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 74 }}>
                  <FlowTypePill
                    value={values.flowType}
                    onChange={(next) => {
                      setValues((current) => ({ ...current, flowType: next }))
                    }}
                  />
                </div>

                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: -178,
                    width: '190%',
                    height: 224,
                    transform: 'translateX(-50%)',
                    borderRadius: '50%',
                    background: 'var(--neutral-0)',
                  }}
                />
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -1,
                    height: 8,
                    background: 'var(--neutral-0)',
                    zIndex: 0,
                  }}
                />

                <input
                  id="planned-operation-date"
                  type="date"
                  ref={dateRef}
                  value={values.date}
                  onChange={(event) => {
                    setValues((current) => ({ ...current, date: event.target.value }))
                    clearFieldError('date')
                  }}
                  className="sr-only"
                />
              </header>

              <div className="modal-main-scroll flex-1 overflow-y-auto pb-[var(--space-4)] pt-0">
                <section className="relative z-[2] px-[var(--space-6)]" style={{ marginTop: '-4px' }} aria-labelledby="planned-amount-input-label">
                  <p id="planned-amount-input-label" className="sr-only">
                    Montant planifié
                  </p>

                  <div className="flex flex-col items-center">
                    <input
                      ref={amountRef}
                      id="planned-operation-amount"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      autoFocus
                      value={amountDisplay}
                      onFocus={() => {
                        setAmountFocused(true)
                        setValues((current) => ({ ...current, amount: toAmountInputValue(current.amount) }))
                      }}
                      onBlur={() => {
                        setAmountFocused(false)
                        const parsed = parseMoney(values.amount)
                        setValues((current) => ({ ...current, amount: parsed == null ? '' : String(parsed) }))
                      }}
                      onChange={(event) => {
                        setValues((current) => ({
                          ...current,
                          amount: event.target.value.replace(/[^\d.,-]/g, ''),
                        }))
                        clearFieldError('amount')
                      }}
                      placeholder="0 €"
                      className="w-full border-none bg-transparent px-0 py-[var(--space-2)] text-center text-[var(--font-size-kpi)] font-[var(--font-weight-extrabold)] text-[var(--primary-700)] outline-none placeholder:text-[var(--neutral-300)]"
                      style={{
                        lineHeight: 'var(--line-height-tight)',
                        transform: amountFocused ? 'scale(1.015)' : 'scale(1)',
                        transition: 'transform var(--transition-fast)',
                      }}
                      aria-invalid={Boolean(errors.amount)}
                    />
                  </div>

                  <FieldError message={errors.amount} />
                </section>

                <div className="mt-[var(--space-1)] px-[var(--space-6)]">
                  <Input
                    id="planned-operation-label"
                    type="text"
                    value={values.label}
                    onChange={(event) => {
                      setValues((current) => ({ ...current, label: event.target.value }))
                      clearFieldError('label')
                    }}
                    placeholder="libellé de l'opération"
                    aria-label="Libellé de l'opération"
                    className="rounded-[var(--radius-md)] border-[var(--neutral-200)] px-[var(--space-4)] py-[var(--space-3)] text-center text-[var(--font-size-lg)] font-[var(--font-weight-semibold)] placeholder:text-[var(--neutral-500)] placeholder:opacity-100"
                  />
                  <FieldError message={errors.label} />
                </div>

                <div className="mt-[var(--space-3)]">
                  <section className="mx-[var(--space-6)]">
                    <div className="divide-y divide-[var(--neutral-200)] border-t border-[var(--neutral-200)]">
                      <SettingsRow
                        label="Catégorie"
                        value={categoryLabel}
                        onClick={() => {
                          if (values.flowType === 'transfer') {
                            setPickerMode('subcategory')
                            setPickerClosing('none')
                            return
                          }

                          if (values.flowType === 'savings') {
                            const savingsRoot = directSubcategoryRoot ?? rootCategories[0] ?? null
                            if (savingsRoot) {
                              setValues((current) => ({ ...current, categoryId: savingsRoot.id, subCategoryId: '' }))
                            }
                            setPickerMode('subcategory')
                            setPickerClosing('none')
                            return
                          }

                          if (directSubcategoryRoot) {
                            setValues((current) => ({ ...current, categoryId: directSubcategoryRoot.id, subCategoryId: '' }))
                            setPickerMode('subcategory')
                            setPickerClosing('none')
                            return
                          }

                          setPickerMode('category')
                          setPickerClosing('none')
                        }}
                      />
                      <SettingsRow
                        label="Compte"
                        value={values.accountMode === 'joint' ? 'Compte joint' : 'Compte perso'}
                        onClick={handleAccountModeToggle}
                        disabled={!canUseJoint}
                      />
                      <SettingsRow
                        label="Part personnelle"
                        value={shareRatioLabel(values.personalShareRatio)}
                        onClick={handleShareRatioToggle}
                      />
                      <SettingsRow
                        label="Récurrent mensuel"
                        value={values.isRecurringMonthly ? 'Oui' : 'Non'}
                        onClick={() => {
                          setValues((current) => ({ ...current, isRecurringMonthly: !current.isRecurringMonthly }))
                        }}
                      />
                      {values.flowType === 'expense' || values.flowType === 'savings' ? (
                        <SettingsRow
                          label="Impact budget"
                          value={BUDGET_IMPACT_LABELS[values.budgetImpact]}
                          onClick={handleBudgetImpactToggle}
                        />
                      ) : (
                        <SettingsRow
                          label="Impact budget"
                          value={BUDGET_IMPACT_LABELS.informational}
                          disabled
                        />
                      )}
                    </div>
                  </section>

                  <div className="px-[var(--space-6)]">
                    <FieldError message={errors.accountId} />
                    <FieldError message={errors.personalShareRatio} />
                    <FieldError message={errors.date} />
                    {errors.submit ? (
                      <p className="m-0 mt-[var(--space-2)] text-[var(--font-size-xs)] text-[var(--color-error)]" role="alert">
                        {errors.submit}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <footer className="border-t border-[var(--neutral-200)] bg-[var(--neutral-50)] px-[var(--space-6)] py-[var(--space-2)]">
                <div className="flex items-center justify-between gap-[var(--space-3)]">
                  <Button type="button" variant="outline" size="sm" className="rounded-[var(--radius-md)]" onClick={closeAndReset}>
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="rounded-[var(--radius-md)]"
                    disabled={!canSubmit}
                    loading={isPending}
                    onClick={onSubmit}
                  >
                    Planifier
                  </Button>
                </div>
              </footer>
            </div>
          </motion.section>

          <CategoryPickerModal
            open={pickerMode === 'category'}
            mode="category"
            title="Sélectionner une catégorie"
            items={rootCategories}
            selectedId={values.categoryId}
            closing={pickerClosing === 'category'}
            showAllOption={values.flowType !== 'expense'}
            getItemDisplayLabel={(item) => pickerItemLabel(item.name)}
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
            selectedId={values.subCategoryId}
            closing={pickerClosing === 'subcategory'}
            flipId={flipSubId}
            getItemDisplayLabel={(item) => pickerItemLabel(item.name)}
            onBackgroundClick={handleSubCategoryBackToCategory}
            onClose={() => {
              setPickerMode('none')
              setPickerClosing('none')
              setFlipSubId(null)
            }}
            onSelect={handleSubCategorySelect}
          />

          <style>{`
            .modal-main-scroll,
            .modal-picker-scroll {
              scrollbar-width: thin;
              scrollbar-color: var(--neutral-300) var(--neutral-100);
            }

            .modal-main-scroll::-webkit-scrollbar,
            .modal-picker-scroll::-webkit-scrollbar {
              width: 6px;
            }

            .modal-main-scroll::-webkit-scrollbar-track,
            .modal-picker-scroll::-webkit-scrollbar-track {
              background: var(--neutral-100);
              border-radius: var(--radius-pill);
            }

            .modal-main-scroll::-webkit-scrollbar-thumb,
            .modal-picker-scroll::-webkit-scrollbar-thumb {
              background: var(--neutral-300);
              border-radius: var(--radius-pill);
            }
          `}</style>
        </>
      ) : null}
    </AnimatePresence>
  )
}
