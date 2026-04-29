import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { useAccounts } from '@/hooks/useAccounts'
import { useAuth } from '@/hooks/useAuth'
import { useCategories } from '@/hooks/useCategories'
import { useAddTransaction } from '@/hooks/useTransactions'
import type { BudgetBehavior, Category, Direction, RecurrenceFrequency } from '@/lib/types'

interface AddTransactionModalProps {
  open: boolean
  onClose: () => void
}

type PickerMode = 'none' | 'category' | 'subcategory'
type TransactionType = 'expense' | 'income' | 'transfer'

type AccountMode = 'personal' | 'joint'

type FormValues = {
  date: string
  transactionType: TransactionType
  amount: string
  description: string
  categoryId: string
  subCategoryId: string
  accountId: string
  accountMode: AccountMode
  budgetBehavior: BudgetBehavior
  isRecurring: boolean
  recurrenceFrequency: RecurrenceFrequency
  personalShareRatio: number
}

type AmountInputProps = {
  value: string
  focused: boolean
  error?: string
  inputRef: React.RefObject<HTMLInputElement | null>
  onFocus: () => void
  onBlur: () => void
  onChange: (next: string) => void
}

type CategoryPickerModalProps = {
  open: boolean
  mode: 'category' | 'subcategory'
  title: string
  items: Category[]
  selectedId: string
  closing: boolean
  flipId?: string | null
  onSelect: (id: string) => void
  onClose: () => void
}

type SettingsListProps = {
  categoryLabel: string
  behavior: BudgetBehavior
  isRecurring: boolean
  accountMode: AccountMode
  canUseJoint: boolean
  onCategoryClick: () => void
  onBehaviorToggle: () => void
  onRecurringToggle: () => void
  onAccountModeToggle: () => void
}

const ALL_CATEGORY_TOKEN = '__all__'
const TRANSACTION_ORDER: TransactionType[] = ['expense', 'income', 'transfer']
const TRANSACTION_LABEL: Record<TransactionType, string> = {
  expense: 'Dépense',
  income: 'Revenu',
  transfer: 'Transfert',
}
const DIRECTION_BY_TYPE: Record<TransactionType, Direction> = {
  expense: 'expense',
  income: 'income',
  transfer: 'transfer_out',
}

function createDefaultFormValues(): FormValues {
  return {
    date: todayIso(),
    transactionType: 'expense',
    amount: '',
    description: '',
    categoryId: '',
    subCategoryId: '',
    accountId: '',
    accountMode: 'personal',
    budgetBehavior: 'variable',
    isRecurring: false,
    recurrenceFrequency: 'monthly',
    personalShareRatio: 1,
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function parseMoney(value: string): number | null {
  const sanitized = value.replace(/\s/g, '').replace('€', '').replace(/,/g, '.').trim()
  const parsed = Number(sanitized)
  if (!Number.isFinite(parsed)) return null
  const floored = Math.floor(parsed)
  if (floored <= 0) return null
  return floored
}

function formatMoneyInteger(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.floor(amount))
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
  return formatMoneyInteger(parsed)
}

function budgetBehaviorLabel(value: BudgetBehavior): string {
  if (value === 'fixed') return 'Fixe'
  return 'Variable'
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

function AmountInput({ value, focused, error, inputRef, onFocus, onBlur, onChange }: AmountInputProps) {
  return (
    <section className="px-[var(--space-6)]" style={{ marginTop: '-6px' }} aria-labelledby="amount-input-label">
      <p id="amount-input-label" className="sr-only">
        Montant
      </p>

      <div className="flex flex-col items-center">
        <input
          ref={inputRef}
          id="transaction-amount"
          type={focused ? 'tel' : 'text'}
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.,]/g, ''))}
          placeholder="0 €"
          className="w-full border-none bg-transparent px-0 py-[var(--space-2)] text-center text-[var(--font-size-kpi)] font-[var(--font-weight-extrabold)] text-[var(--primary-700)] outline-none placeholder:text-[var(--neutral-300)]"
          style={{
            lineHeight: 'var(--line-height-tight)',
            transform: focused ? 'scale(1.015)' : 'scale(1)',
            transition: 'transform var(--transition-fast)',
          }}
          aria-invalid={Boolean(error)}
        />
      </div>

      <FieldError message={error} />
    </section>
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
      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-[var(--space-3)] border-none bg-transparent px-[var(--space-3)] py-[var(--space-3)] text-left"
      style={{
        cursor: interactive ? 'pointer' : 'default',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        className="text-[var(--font-size-lg)] font-[var(--font-weight-medium)] text-[var(--neutral-700)]"
        style={{ lineHeight: 'var(--line-height-tight)' }}
      >
        {label}
      </span>
      <span
        className="text-[var(--font-size-lg)] font-[var(--font-weight-bold)] text-[var(--neutral-900)]"
        style={{ lineHeight: 'var(--line-height-tight)' }}
      >
        {value}
      </span>
    </button>
  )
}

function SettingsList({
  categoryLabel,
  behavior,
  isRecurring,
  accountMode,
  canUseJoint,
  onCategoryClick,
  onBehaviorToggle,
  onRecurringToggle,
  onAccountModeToggle,
}: SettingsListProps) {
  return (
    <section className="mx-[var(--space-6)]">
      <div className="divide-y divide-[var(--neutral-200)] border-t border-[var(--neutral-200)]">
        <SettingsRow label="Catégorie" value={categoryLabel} onClick={onCategoryClick} />
        <SettingsRow label="Fixe/variable" value={budgetBehaviorLabel(behavior)} onClick={onBehaviorToggle} />
        <SettingsRow label="Récurrence" value={isRecurring ? 'OUI' : 'NON'} onClick={onRecurringToggle} />
        <SettingsRow
          label="Compte"
          value={accountMode === 'joint' ? 'Compte joint' : 'Compte perso'}
          onClick={onAccountModeToggle}
          disabled={!canUseJoint}
        />
        <SettingsRow label="Imputabilité" value="Personnel (100%)" />
      </div>
    </section>
  )
}

function CategoryPickerModal({
  open,
  mode,
  title,
  items,
  selectedId,
  closing,
  flipId,
  onSelect,
  onClose,
}: CategoryPickerModalProps) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!items.length) return

    let nextIndex = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = Math.min(index + 1, items.length - 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = Math.max(index - 1, 0)
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = items.length - 1
    } else {
      return
    }

    event.preventDefault()
    optionRefs.current[nextIndex]?.focus()
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
            style={{ background: 'rgba(13,13,31,0.45)', zIndex: mode === 'subcategory' ? 131 : 121 }}
            onClick={onClose}
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%', opacity: 0 }}
            animate={closing ? { y: '100%', opacity: 0 } : { y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 330 }}
            className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-[420px] bg-[var(--neutral-0)] shadow-[var(--shadow-lg)]"
            style={{
              zIndex: mode === 'subcategory' ? 132 : 122,
              borderRadius: 'var(--radius-2xl) var(--radius-2xl) 0 0',
              padding: 'var(--space-4) var(--space-6) calc(var(--space-6) + var(--safe-bottom-offset))',
              maxHeight: '72dvh',
              overflow: 'hidden',
            }}
          >
            <div className="modal-picker-scroll" style={{ overflowY: 'auto' }}>
              <div style={{ display: 'grid', gap: 'var(--space-4)' }} role="listbox" aria-label={title}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
                {items.map((item, index) => {
                  const selected = item.id === selectedId
                  const flipping = mode === 'subcategory' && item.id === flipId
                  return (
                    <motion.button
                      key={item.id}
                      ref={(node) => {
                        optionRefs.current[index] = node
                      }}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => onSelect(item.id)}
                      onKeyDown={(event) => handleKeyDown(event, index)}
                      whileHover={flipping ? undefined : { scale: 1.07 }}
                      whileTap={flipping ? undefined : { scale: 0.98 }}
                      animate={
                        mode === 'subcategory'
                          ? {
                              rotateY: flipping ? 180 : 0,
                              opacity: flipping ? 0 : 1,
                            }
                          : undefined
                      }
                      transition={
                        mode === 'subcategory'
                          ? { duration: 0.4, ease: [0.68, -0.55, 0.265, 1.55] }
                          : { duration: 0.15, ease: 'easeOut' }
                      }
                      className="flex flex-col items-center gap-[var(--space-2)] rounded-[var(--radius-lg)] border px-[var(--space-2)] py-[var(--space-3)]"
                      style={{
                        borderColor: selected ? 'var(--primary-500)' : 'var(--neutral-200)',
                        borderWidth: selected ? 3 : 1,
                        background: 'var(--neutral-0)',
                        transformStyle: 'preserve-3d',
                        padding: '10px 8px',
                        cursor: 'pointer',
                        transition: 'border-color var(--transition-fast), transform var(--transition-fast)',
                      }}
                    >
                      <CategoryIcon categoryName={item.name} size={30} />
                    </motion.button>
                  )
                })}
                </div>

                {mode === 'category' ? (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => onSelect(ALL_CATEGORY_TOKEN)}
                      style={{
                        border: '1px solid var(--neutral-200)',
                        background: 'var(--neutral-0)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '10px 8px',
                        minWidth: 88,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--neutral-100)', display: 'grid', placeItems: 'center' }}>
                        <CategoryIcon categoryName="Toutes catégories" size={24} fallback="💰" />
                      </div>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}

export function AddTransactionModal({ open, onClose }: AddTransactionModalProps) {
  const { user } = useAuth()
  const { data: accounts } = useAccounts()
  const { mutateAsync: addTransaction, isPending } = useAddTransaction()

  const [pickerMode, setPickerMode] = useState<PickerMode>('none')
  const [pickerClosing, setPickerClosing] = useState<PickerMode>('none')
  const [flipSubId, setFlipSubId] = useState<string | null>(null)
  const [amountFocused, setAmountFocused] = useState(false)

  const amountRef = useRef<HTMLInputElement | null>(null)
  const dateRef = useRef<HTMLInputElement | null>(null)

  const {
    register,
    watch,
    setValue,
    reset,
    clearErrors,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: createDefaultFormValues(),
    mode: 'onSubmit',
  })

  const dateRegister = register('date')
  const values = watch()

  const { data: categories } = useCategories(values.transactionType)

  const hasHierarchy = useMemo(
    () => (categories ?? []).some((category) => category.parent_id !== null),
    [categories],
  )

  const rootCategories = useMemo(() => {
    const list = categories ?? []
    if (!hasHierarchy) return list
    return list.filter((category) => category.parent_id === null)
  }, [categories, hasHierarchy])

  const subCategories = useMemo(() => {
    if (!values.categoryId) return []
    const list = categories ?? []
    if (!hasHierarchy) return list.filter((category) => category.id === values.categoryId)
    return list.filter((category) => category.parent_id === values.categoryId)
  }, [categories, hasHierarchy, values.categoryId])

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((category) => [category.id, category])),
    [categories],
  )

  const selectedCategory = values.categoryId ? categoryById.get(values.categoryId) ?? null : null
  const selectedSubCategory = values.subCategoryId ? categoryById.get(values.subCategoryId) ?? null : null

  const categoryLabel = selectedSubCategory?.name ?? selectedCategory?.name ?? 'Choisir'

  const amountDisplay = useMemo(() => readFormattedAmount(values.amount, amountFocused), [amountFocused, values.amount])

  const personalAccount = useMemo(() => {
    if (!accounts?.length) return null
    const withoutJoint = accounts.filter((account) => !/joint/i.test(account.name))
    return (
      withoutJoint.find((account) => account.account_type === 'checking') ??
      withoutJoint[0] ??
      accounts.find((account) => account.account_type === 'checking') ??
      accounts[0]
    )
  }, [accounts])

  const jointAccount = useMemo(() => {
    if (!accounts?.length) return null
    return accounts.find((account) => /joint/i.test(account.name)) ?? null
  }, [accounts])

  const canUseJoint = Boolean(jointAccount)

  const canSubmit = useMemo(() => {
    return Boolean(parseMoney(values.amount) && values.categoryId && values.accountId && isValidDate(values.date))
  }, [values.amount, values.categoryId, values.accountId, values.date])

  const closeAndReset = useCallback(() => {
    reset(createDefaultFormValues())
    setPickerMode('none')
    setPickerClosing('none')
    setFlipSubId(null)
    setAmountFocused(false)
    onClose()
  }, [onClose, reset])

  useEffect(() => {
    if (!open) return
    const timeout = window.setTimeout(() => amountRef.current?.focus(), 70)
    return () => window.clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (!accounts?.length || values.accountId) return
    const initialAccount = personalAccount ?? accounts[0]
    if (!initialAccount) return
    setValue('accountId', initialAccount.id)
    setValue('accountMode', 'personal')
  }, [accounts, personalAccount, setValue, values.accountId])

  useEffect(() => {
    setValue('categoryId', '')
    setValue('subCategoryId', '')
    clearErrors('categoryId')
  }, [clearErrors, setValue, values.transactionType])

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

  const handleCategorySelect = (id: string) => {
    if (id === ALL_CATEGORY_TOKEN) {
      setValue('categoryId', '')
      setValue('subCategoryId', '')
      setPickerMode('none')
      setPickerClosing('none')
      return
    }

    setValue('categoryId', id)
    setValue('subCategoryId', '')
    clearErrors('categoryId')

    if (!hasHierarchy) {
      setValue('subCategoryId', id)
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
      setValue('subCategoryId', id)
      setPickerMode('none')
      setPickerClosing('none')
      setFlipSubId(null)
      amountRef.current?.focus()
    }, 420)
  }

  const handleBehaviorToggle = () => {
    setValue('budgetBehavior', values.budgetBehavior === 'fixed' ? 'variable' : 'fixed')
  }

  const handleRecurringToggle = () => {
    setValue('isRecurring', !values.isRecurring)
  }

  const handleAccountModeToggle = () => {
    if (!canUseJoint) return
    const nextMode: AccountMode = values.accountMode === 'personal' ? 'joint' : 'personal'
    setValue('accountMode', nextMode)
    const nextAccount = nextMode === 'joint' ? jointAccount : personalAccount
    if (nextAccount) setValue('accountId', nextAccount.id)
  }

  const handleTransactionTypeCycle = () => {
    const index = TRANSACTION_ORDER.indexOf(values.transactionType)
    const nextType = TRANSACTION_ORDER[(index + 1) % TRANSACTION_ORDER.length]
    setValue('transactionType', nextType)
  }

  const onSubmit = async (formValues: FormValues) => {
    if (!user) return

    if (!isValidDate(formValues.date)) {
      setError('date', { message: 'Veuillez choisir une date valide.' })
      return
    }

    const parsedAmount = parseMoney(formValues.amount)
    if (parsedAmount == null) {
      setError('amount', { message: 'Le montant doit être supérieur à 0.' })
      return
    }

    if (!formValues.categoryId) {
      setError('categoryId', { message: 'Sélectionnez une catégorie.' })
      return
    }

    if (!formValues.accountId) {
      setError('accountId', { message: 'Sélectionnez un compte.' })
      return
    }

    await addTransaction({
      user_id: user.id,
      account_id: formValues.accountId,
      category_id: formValues.subCategoryId || formValues.categoryId,
      income_source_id: null,
      import_batch_id: null,
      staging_row_id: null,
      transaction_date: formValues.date,
      amount: parsedAmount,
      currency: 'EUR',
      direction: DIRECTION_BY_TYPE[formValues.transactionType],
      flow_type: formValues.transactionType,
      personal_share_ratio: formValues.personalShareRatio,
      budget_behavior: formValues.budgetBehavior,
      raw_label: formValues.description || null,
      normalized_label: formValues.description || null,
      merchant_name: null,
      external_id: null,
      is_recurring: formValues.isRecurring,
      is_verified: true,
      is_hidden: false,
      notes: null,
      meta: formValues.isRecurring ? { recurrence_frequency: formValues.recurrenceFrequency } : null,
    })

    closeAndReset()
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
            style={{ background: 'rgba(17,24,39,0.42)', zIndex: 100 }}
            onClick={closeAndReset}
          />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-transaction-modal-title"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-[500px] overflow-hidden rounded-t-[var(--radius-xl)] bg-[var(--neutral-0)] shadow-[var(--shadow-lg)]"
            style={{ zIndex: 101, maxHeight: '88dvh' }}
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmit(onSubmit)} className="flex max-h-[88dvh] flex-col">
              <input type="hidden" {...register('amount')} />
              <input type="hidden" {...register('transactionType')} />
              <input type="hidden" {...register('categoryId')} />
              <input type="hidden" {...register('subCategoryId')} />
              <input type="hidden" {...register('accountId')} />
              <input type="hidden" {...register('accountMode')} />
              <input type="hidden" {...register('budgetBehavior')} />
              <input type="hidden" {...register('isRecurring')} />
              <input type="hidden" {...register('recurrenceFrequency')} />
              <input type="hidden" {...register('personalShareRatio', { valueAsNumber: true })} />

              <header
                className="relative overflow-hidden bg-[var(--primary-500)] px-[var(--space-6)]"
                style={{
                  minHeight: 208,
                  paddingTop: 'var(--space-5)',
                }}
              >
                <h2 id="add-transaction-modal-title" className="sr-only">
                  Nouvelle opération
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
                  className="absolute left-1/2 top-[var(--space-5)] -translate-x-1/2 border-none bg-transparent p-0 text-[var(--neutral-0)]"
                >
                  <span
                    className="block text-center text-[var(--font-size-2xl)] font-[var(--font-weight-extrabold)]"
                    style={{ lineHeight: 'var(--line-height-tight)', textTransform: 'capitalize' }}
                  >
                    {formatLongDate(values.date)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleTransactionTypeCycle}
                  className="absolute left-1/2 top-[64px] -translate-x-1/2 border-none bg-transparent p-0 text-[var(--neutral-0)]"
                >
                  <span
                    className="block text-center text-[var(--font-size-lg)] font-[var(--font-weight-bold)]"
                    style={{ lineHeight: 'var(--line-height-tight)' }}
                  >
                    {TRANSACTION_LABEL[values.transactionType]}
                  </span>
                </button>

                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: -176,
                    width: '190%',
                    height: 260,
                    transform: 'translateX(-50%)',
                    borderRadius: '50%',
                    background: 'var(--neutral-0)',
                  }}
                />

                <input
                  id="transaction-date"
                  type="date"
                  {...dateRegister}
                  ref={(node) => {
                    dateRef.current = node
                    dateRegister.ref(node)
                  }}
                  value={values.date}
                  onChange={(event) => {
                    setValue('date', event.target.value)
                    clearErrors('date')
                  }}
                  className="sr-only"
                />
              </header>

              <div className="modal-main-scroll flex-1 overflow-y-auto pb-[var(--space-4)] pt-[var(--space-1)]">
                <AmountInput
                  value={amountDisplay}
                  focused={amountFocused}
                  error={errors.amount?.message}
                  inputRef={amountRef}
                  onFocus={() => {
                    setAmountFocused(true)
                    const parsed = parseMoney(values.amount)
                    setValue('amount', parsed == null ? values.amount : String(parsed))
                  }}
                  onBlur={() => {
                    setAmountFocused(false)
                    const parsed = parseMoney(values.amount)
                    setValue('amount', parsed == null ? '' : String(parsed))
                  }}
                  onChange={(next) => {
                    setValue('amount', next)
                    clearErrors('amount')
                  }}
                />

                <div className="mt-[var(--space-1)] px-[var(--space-6)]">
                  <Input
                    id="transaction-description"
                    type="text"
                    value={values.description}
                    onChange={(event) => setValue('description', event.target.value)}
                    placeholder="libellé de l'opération"
                    aria-label="Libellé de l'opération"
                    className="rounded-[var(--radius-md)] border-[var(--neutral-200)] px-[var(--space-4)] py-[var(--space-3)] text-center text-[var(--font-size-lg)] font-[var(--font-weight-semibold)] placeholder:text-[var(--neutral-500)] placeholder:opacity-100"
                  />
                </div>

                <div className="mt-[var(--space-3)]">
                  <SettingsList
                    categoryLabel={categoryLabel}
                    behavior={values.budgetBehavior}
                    isRecurring={values.isRecurring}
                    accountMode={values.accountMode}
                    canUseJoint={canUseJoint}
                    onCategoryClick={() => {
                      setPickerMode('category')
                      setPickerClosing('none')
                    }}
                    onBehaviorToggle={handleBehaviorToggle}
                    onRecurringToggle={handleRecurringToggle}
                    onAccountModeToggle={handleAccountModeToggle}
                  />
                  <div className="px-[var(--space-6)]">
                    <FieldError message={errors.categoryId?.message} />
                    <FieldError message={errors.accountId?.message} />
                    <FieldError message={errors.date?.message} />
                  </div>
                </div>
              </div>

              <footer className="border-t border-[var(--neutral-200)] bg-[var(--neutral-50)] px-[var(--space-6)] py-[var(--space-3)]">
                <div className="flex items-center justify-between gap-[var(--space-3)]">
                  <Button type="button" variant="outline" size="md" className="rounded-[var(--radius-md)]" onClick={closeAndReset}>
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    className="rounded-[var(--radius-md)]"
                    disabled={!canSubmit}
                    loading={isPending}
                  >
                    Ajouter
                  </Button>
                </div>
              </footer>
            </form>
          </motion.section>

          <CategoryPickerModal
            open={pickerMode === 'category'}
            mode="category"
            title="Sélectionner une catégorie"
            items={rootCategories}
            selectedId={values.categoryId}
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
            selectedId={values.subCategoryId}
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
