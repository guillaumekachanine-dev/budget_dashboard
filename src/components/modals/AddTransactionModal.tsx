import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, ChevronDown, FolderOpen, Layers, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { useAccounts } from '@/hooks/useAccounts'
import { useAuth } from '@/hooks/useAuth'
import { useCategories } from '@/hooks/useCategories'
import { useAddTransaction } from '@/hooks/useTransactions'
import type {
  BudgetBehavior,
  Category,
  Direction,
  FlowType,
  RecurrenceFrequency,
} from '@/lib/types'

interface AddTransactionModalProps {
  open: boolean
  onClose: () => void
}

type TransactionType = 'expense' | 'income' | 'transfer'
type PickerMode = 'none' | 'category' | 'subcategory'
type ClosingMode = 'none' | 'category' | 'subcategory'

type FormErrors = {
  date?: string
  amount?: string
  category?: string
  account?: string
}

type PickerModalProps = {
  open: boolean
  title: string
  items: Category[]
  selectedId: string
  closing: boolean
  mode: 'category' | 'subcategory'
  flipId?: string | null
  onClose: () => void
  onSelect: (id: string) => void
}

type CategorySelectorProps = {
  label: string
  selected: Category | null
  disabled?: boolean
  onClick: () => void
  emptyIcon: 'category' | 'subcategory'
}

type AmountInputProps = {
  value: string
  focused: boolean
  error?: string
  inputRef: React.RefObject<HTMLInputElement | null>
  onFocus: () => void
  onBlur: () => void
  onChange: (value: string) => void
}

type TransactionTypeToggleProps = {
  value: TransactionType
  onChange: (value: TransactionType) => void
}

type AdvancedSettingsProps = {
  open: boolean
  accountId: string
  budgetBehavior: BudgetBehavior
  isRecurring: boolean
  recurrenceFrequency: RecurrenceFrequency
  accounts: Array<{ id: string; name: string; currency: string }>
  accountError?: string
  onToggleOpen: () => void
  onAccountChange: (value: string) => void
  onBehaviorChange: (value: BudgetBehavior) => void
  onRecurringChange: (value: boolean) => void
  onRecurrenceFrequencyChange: (value: RecurrenceFrequency) => void
}

const TYPE_META: Array<{
  key: TransactionType
  label: string
  activeBackground: string
}> = [
  { key: 'expense', label: 'Dépense', activeBackground: 'var(--color-error)' },
  { key: 'income', label: 'Revenus', activeBackground: 'var(--color-success)' },
  { key: 'transfer', label: 'Transfert', activeBackground: 'var(--neutral-500)' },
]

const FLOW_BY_TYPE: Record<TransactionType, FlowType> = {
  expense: 'expense',
  income: 'income',
  transfer: 'transfer',
}

const DIRECTION_BY_TYPE: Record<TransactionType, Direction> = {
  expense: 'expense',
  income: 'income',
  transfer: 'transfer_out',
}

const FALLBACK_VIZ = ['var(--viz-a)', 'var(--viz-b)', 'var(--viz-c)', 'var(--viz-d)', 'var(--viz-e)']

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

function normalizeCategoryColor(category: Category, index: number): string {
  const token = category.color_token
  if (!token) return FALLBACK_VIZ[index % FALLBACK_VIZ.length]
  if (token.startsWith('#')) return token
  if (token.startsWith('var(')) return token
  if (token.startsWith('--')) return `var(${token})`
  return `var(--${token})`
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatMoneyInteger(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.floor(amount))
}

function parseMoney(value: string): number | null {
  const sanitized = value.replace(/\s/g, '').replace(/€/g, '').replace(/,/g, '.')
  const parsed = Number(sanitized)
  if (!Number.isFinite(parsed)) return null
  const floored = Math.floor(parsed)
  if (floored <= 0) return null
  return floored
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

function TransactionTypeToggle({ value, onChange }: TransactionTypeToggleProps) {
  return (
    <div className="px-[var(--space-6)] pb-[var(--space-4)] pt-[var(--space-5)]">
      <div className="flex flex-wrap items-center justify-center gap-[var(--space-2)]">
        {TYPE_META.map((item) => {
          const active = item.key === value
          return (
            <motion.button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              whileHover={active ? { scale: 1.05 } : { scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="rounded-[var(--radius-md)] border px-[var(--space-4)] py-[var(--space-2)] text-[var(--font-size-sm)] font-[var(--font-weight-semibold)]"
              style={{
                borderColor: active ? item.activeBackground : 'var(--neutral-200)',
                background: active ? item.activeBackground : 'var(--neutral-100)',
                color: active ? 'var(--neutral-0)' : 'var(--neutral-700)',
                transition:
                  'color var(--transition-fast), background-color var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast)',
                lineHeight: 'var(--line-height-tight)',
              }}
            >
              {item.label}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

function AmountInput({
  value,
  focused,
  error,
  inputRef,
  onFocus,
  onBlur,
  onChange,
}: AmountInputProps) {
  return (
    <section
      className="mx-[var(--space-6)] mb-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--neutral-50)] px-[var(--space-6)] py-[var(--space-6)]"
      aria-labelledby="amount-input-label"
    >
      <p
        id="amount-input-label"
        className="m-0 mb-[var(--space-2)] text-center text-[var(--font-size-xs)] font-[var(--font-weight-semibold)] text-[var(--neutral-500)]"
        style={{ lineHeight: 'var(--line-height-tight)' }}
      >
        Montant
      </p>

      <div className="mx-auto w-full max-w-[280px]">
        <div className="flex items-end justify-center gap-[var(--space-1)]">
          <input
            ref={inputRef}
            id="transaction-amount"
            type={focused ? 'tel' : 'text'}
            inputMode="numeric"
            value={value}
            onFocus={onFocus}
            onBlur={onBlur}
            onChange={(event) => onChange(event.target.value.replace(/[^\d.,]/g, ''))}
            placeholder="0 €"
            className="w-full border-none bg-transparent text-center text-[var(--font-size-kpi)] font-[var(--font-weight-extrabold)] text-[var(--primary-500)] outline-none placeholder:text-[var(--neutral-300)]"
            style={{ lineHeight: 'var(--line-height-tight)' }}
            aria-invalid={Boolean(error)}
            required
          />
          <span
            className="pb-[var(--space-2)] text-[var(--font-size-lg)] font-[var(--font-weight-bold)] text-[var(--neutral-600)]"
            style={{ lineHeight: 'var(--line-height-tight)' }}
            aria-hidden="true"
          >
            €
          </span>
        </div>

        <div className="relative mt-[var(--space-1)] h-[var(--space-1)] w-full overflow-hidden rounded-[var(--radius-xs)] bg-[var(--neutral-200)]">
          <motion.span
            className="absolute left-0 top-0 h-full bg-[var(--primary-500)]"
            animate={{ width: focused ? '100%' : '72%' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          />
        </div>

        <FieldError message={error} />
      </div>
    </section>
  )
}

function CategorySelector({
  label,
  selected,
  disabled = false,
  onClick,
  emptyIcon,
}: CategorySelectorProps) {
  const icon = emptyIcon === 'category' ? <FolderOpen size={32} /> : <Layers size={32} />

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex aspect-square w-full flex-col items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-lg)] border-2 border-dashed px-[var(--space-4)] py-[var(--space-4)]"
      style={{
        borderColor: selected ? 'var(--primary-500)' : 'var(--neutral-300)',
        background: selected ? 'var(--primary-50)' : 'var(--neutral-50)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition:
          'background-color var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast), opacity var(--transition-fast)',
      }}
      onMouseEnter={(event) => {
        if (disabled) return
        event.currentTarget.style.borderColor = 'var(--primary-500)'
        event.currentTarget.style.background = 'var(--neutral-100)'
        event.currentTarget.style.transform = 'scale(1.02)'
      }}
      onMouseLeave={(event) => {
        if (disabled) return
        event.currentTarget.style.borderColor = selected ? 'var(--primary-500)' : 'var(--neutral-300)'
        event.currentTarget.style.background = selected ? 'var(--primary-50)' : 'var(--neutral-50)'
        event.currentTarget.style.transform = 'scale(1)'
      }}
      aria-label={selected ? `${label} sélectionnée: ${selected.name}` : `Choisir ${label}`}
    >
      {selected ? (
        <>
          <CategoryIcon categoryName={selected.name} size={48} />
          <span
            className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-[var(--font-size-xs)] font-[var(--font-weight-semibold)] text-[var(--neutral-700)]"
            style={{ lineHeight: 'var(--line-height-snug)' }}
          >
            {selected.name}
          </span>
        </>
      ) : (
        <>
          <span className="text-[var(--neutral-400)]">{icon}</span>
          <span
            className="text-center text-[var(--font-size-xs)] font-[var(--font-weight-semibold)] text-[var(--neutral-500)]"
            style={{ lineHeight: 'var(--line-height-snug)' }}
          >
            {label}
          </span>
        </>
      )}
    </button>
  )
}

function PickerModal({
  open,
  title,
  items,
  selectedId,
  closing,
  mode,
  flipId,
  onClose,
  onSelect,
}: PickerModalProps) {
  if (!open) return null

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0"
        style={{
          background: 'rgba(0,0,0,0.3)',
          zIndex: mode === 'subcategory' ? 131 : 121,
        }}
        onClick={onClose}
      />

      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ y: '100%', opacity: 0 }}
        animate={
          closing
            ? mode === 'category'
              ? { y: -20, opacity: 0 }
              : { y: 10, opacity: 0 }
            : { y: 0, opacity: 1 }
        }
        exit={{ y: '100%', opacity: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-[500px] rounded-t-[var(--radius-xl)] bg-[var(--neutral-0)] shadow-[var(--shadow-lg)]"
        style={{
          zIndex: mode === 'subcategory' ? 132 : 122,
          maxHeight: '84dvh',
        }}
      >
        <div className="flex max-h-[84dvh] flex-col overflow-hidden">
          <header className="relative border-b border-[var(--neutral-200)] px-[var(--space-6)] py-[var(--space-5)]">
            <h3
              className="m-0 text-[var(--font-size-md)] font-[var(--font-weight-bold)] text-[var(--neutral-900)]"
              style={{ lineHeight: 'var(--line-height-tight)' }}
            >
              {title}
            </h3>
            <button
              type="button"
              aria-label="Fermer"
              onClick={onClose}
              className="absolute right-[var(--space-5)] top-[var(--space-5)] inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border-none bg-[var(--neutral-100)] text-[var(--neutral-600)]"
              style={{ transition: 'opacity var(--transition-fast)' }}
            >
              <X size={20} />
            </button>
          </header>

          <div className="overflow-y-auto px-[var(--space-6)] py-[var(--space-6)]">
            <div className="grid grid-cols-4 gap-[var(--space-4)]">
              {items.map((item, index) => {
                const selected = item.id === selectedId
                const flipping = mode === 'subcategory' && flipId === item.id
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    whileHover={flipping ? undefined : { scale: 1.08 }}
                    whileTap={flipping ? undefined : { scale: 0.97 }}
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
                        : { duration: 0.15 }
                    }
                    className="flex flex-col items-center gap-[var(--space-2)] rounded-[var(--radius-lg)] border bg-[var(--neutral-0)] px-[var(--space-2)] py-[var(--space-3)]"
                    style={{
                      borderColor: selected ? 'var(--primary-500)' : 'var(--neutral-200)',
                      borderWidth: selected ? 3 : 1,
                      boxShadow: 'var(--shadow-sm)',
                      transformStyle: 'preserve-3d',
                      transition:
                        'border-color var(--transition-fast), background-color var(--transition-fast), box-shadow var(--transition-fast)',
                    }}
                    aria-pressed={selected}
                  >
                    <span
                      className="inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)]"
                      style={{ background: normalizeCategoryColor(item, index) }}
                    >
                      <CategoryIcon categoryName={item.name} size={34} />
                    </span>
                    <span
                      className="text-center text-[var(--font-size-xs)] font-[var(--font-weight-semibold)] text-[var(--neutral-700)]"
                      style={{ lineHeight: 'var(--line-height-snug)' }}
                    >
                      {item.name}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  )
}

function AdvancedSettings({
  open,
  accountId,
  budgetBehavior,
  isRecurring,
  recurrenceFrequency,
  accounts,
  accountError,
  onToggleOpen,
  onAccountChange,
  onBehaviorChange,
  onRecurringChange,
  onRecurrenceFrequencyChange,
}: AdvancedSettingsProps) {
  return (
    <section className="mt-[var(--space-5)] border-t border-[var(--neutral-200)]">
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex w-full items-center justify-between border-none bg-transparent px-[var(--space-6)] py-[var(--space-4)]"
        style={{ transition: 'background-color var(--transition-fast)' }}
        onMouseEnter={(event) => {
          event.currentTarget.style.backgroundColor = 'var(--neutral-50)'
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        <span
          className="text-[var(--font-size-sm)] font-[var(--font-weight-semibold)] text-[var(--neutral-600)]"
          style={{ lineHeight: 'var(--line-height-tight)' }}
        >
          Paramètres avancés
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="text-[var(--neutral-600)]"
        >
          <ChevronDown size={18} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="grid gap-[var(--space-4)] px-[var(--space-6)] pb-[var(--space-4)]">
              <div>
                <label
                  htmlFor="transaction-account"
                  className="mb-[var(--space-1)] block text-[var(--font-size-sm)] font-[var(--font-weight-semibold)] text-[var(--neutral-700)]"
                  style={{ lineHeight: 'var(--line-height-tight)' }}
                >
                  Compte
                </label>
                <select
                  id="transaction-account"
                  value={accountId}
                  onChange={(event) => onAccountChange(event.target.value)}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--neutral-200)] bg-[var(--neutral-0)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--font-size-base)] text-[var(--neutral-700)] outline-none"
                  style={{
                    transition:
                      'border-color var(--transition-fast), box-shadow var(--transition-fast), background-color var(--transition-fast)',
                  }}
                  onFocus={(event) => {
                    event.currentTarget.style.borderColor = 'var(--primary-500)'
                    event.currentTarget.style.boxShadow = '0 0 0 3px rgba(67,97,238,0.1)'
                  }}
                  onBlur={(event) => {
                    event.currentTarget.style.borderColor = 'var(--neutral-200)'
                    event.currentTarget.style.boxShadow = 'none'
                  }}
                  required
                >
                  <option value="">Sélectionner un compte</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {account.currency}
                    </option>
                  ))}
                </select>
                <FieldError message={accountError} />
              </div>

              <div>
                <p
                  className="m-0 mb-[var(--space-1)] text-[var(--font-size-sm)] font-[var(--font-weight-semibold)] text-[var(--neutral-700)]"
                  style={{ lineHeight: 'var(--line-height-tight)' }}
                >
                  Comportement
                </p>
                <div className="flex flex-wrap gap-[var(--space-2)]">
                  {([
                    { key: 'variable', label: 'Variable', color: 'var(--color-warning)' },
                    { key: 'fixed', label: 'Fixe', color: 'var(--color-error)' },
                    { key: 'excluded', label: 'Exclue', color: 'var(--neutral-400)' },
                  ] as const).map((item) => {
                    const active = item.key === budgetBehavior
                    return (
                      <motion.button
                        key={item.key}
                        type="button"
                        onClick={() => onBehaviorChange(item.key)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-2)] text-[var(--font-size-sm)] font-[var(--font-weight-semibold)]"
                        style={{
                          borderColor: active ? item.color : 'var(--neutral-200)',
                          background: active ? item.color : 'var(--neutral-0)',
                          color: active ? 'var(--neutral-0)' : 'var(--neutral-600)',
                          transition:
                            'color var(--transition-fast), background-color var(--transition-fast), border-color var(--transition-fast)',
                        }}
                      >
                        {item.label}
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p
                  className="m-0 mb-[var(--space-1)] text-[var(--font-size-sm)] font-[var(--font-weight-semibold)] text-[var(--neutral-700)]"
                  style={{ lineHeight: 'var(--line-height-tight)' }}
                >
                  Récurrence
                </p>
                <div className="mb-[var(--space-2)] flex gap-[var(--space-2)]">
                  <button
                    type="button"
                    onClick={() => onRecurringChange(false)}
                    className="rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-2)] text-[var(--font-size-sm)] font-[var(--font-weight-semibold)]"
                    style={{
                      borderColor: !isRecurring ? 'var(--primary-500)' : 'var(--neutral-200)',
                      background: !isRecurring ? 'var(--primary-500)' : 'var(--neutral-0)',
                      color: !isRecurring ? 'var(--neutral-0)' : 'var(--neutral-600)',
                      transition:
                        'color var(--transition-fast), background-color var(--transition-fast), border-color var(--transition-fast)',
                    }}
                  >
                    Non
                  </button>
                  <button
                    type="button"
                    onClick={() => onRecurringChange(true)}
                    className="rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-2)] text-[var(--font-size-sm)] font-[var(--font-weight-semibold)]"
                    style={{
                      borderColor: isRecurring ? 'var(--primary-500)' : 'var(--neutral-200)',
                      background: isRecurring ? 'var(--primary-500)' : 'var(--neutral-0)',
                      color: isRecurring ? 'var(--neutral-0)' : 'var(--neutral-600)',
                      transition:
                        'color var(--transition-fast), background-color var(--transition-fast), border-color var(--transition-fast)',
                    }}
                  >
                    Oui
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {isRecurring ? (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      <select
                        value={recurrenceFrequency}
                        onChange={(event) =>
                          onRecurrenceFrequencyChange(event.target.value as RecurrenceFrequency)
                        }
                        className="w-full rounded-[var(--radius-md)] border border-[var(--neutral-200)] bg-[var(--neutral-0)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--font-size-base)] text-[var(--neutral-700)] outline-none"
                      >
                        <option value="monthly">Mensuelle</option>
                        <option value="quarterly">Trimestrielle</option>
                        <option value="yearly">Annuelle</option>
                      </select>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

export function AddTransactionModal({ open, onClose }: AddTransactionModalProps) {
  const { user } = useAuth()
  const { data: accounts } = useAccounts()
  const { mutateAsync: addTransaction, isPending } = useAddTransaction()

  const [transactionType, setTransactionType] = useState<TransactionType>('expense')
  const [date, setDate] = useState(todayIso())
  const [amountRaw, setAmountRaw] = useState('')
  const [amountFocused, setAmountFocused] = useState(false)
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subCategoryId, setSubCategoryId] = useState('')
  const [pickerMode, setPickerMode] = useState<PickerMode>('none')
  const [pickerClosing, setPickerClosing] = useState<ClosingMode>('none')
  const [flipSubId, setFlipSubId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState('')
  const [budgetBehavior, setBudgetBehavior] = useState<BudgetBehavior>('variable')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('monthly')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const amountRef = useRef<HTMLInputElement | null>(null)
  const dateInputRef = useRef<HTMLInputElement | null>(null)

  const { data: categories } = useCategories(FLOW_BY_TYPE[transactionType])

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
    if (!categoryId) return []
    const list = categories ?? []
    if (!hasHierarchy) {
      return list.filter((category) => category.id === categoryId)
    }
    return list.filter((category) => category.parent_id === categoryId)
  }, [categories, categoryId, hasHierarchy])

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((category) => [category.id, category])),
    [categories],
  )

  const selectedCategory = categoryId ? categoryById.get(categoryId) ?? null : null
  const selectedSubCategory = subCategoryId ? categoryById.get(subCategoryId) ?? null : null

  const amountDisplay = useMemo(() => {
    if (amountFocused) return amountRaw
    const parsed = parseMoney(amountRaw)
    if (parsed == null) return ''
    return formatMoneyInteger(parsed).replace('€', '').trim()
  }, [amountFocused, amountRaw])

  const dateDisplay = useMemo(() => formatLongDate(date), [date])

  const canSubmit = useMemo(() => {
    const parsed = parseMoney(amountRaw)
    return Boolean(parsed && categoryId && isValidDate(date) && accountId)
  }, [accountId, amountRaw, categoryId, date])

  const resetForm = useCallback(() => {
    setTransactionType('expense')
    setDate(todayIso())
    setAmountRaw('')
    setAmountFocused(false)
    setDescription('')
    setCategoryId('')
    setSubCategoryId('')
    setPickerMode('none')
    setPickerClosing('none')
    setFlipSubId(null)
    setBudgetBehavior('variable')
    setIsRecurring(false)
    setRecurrenceFrequency('monthly')
    setAdvancedOpen(false)
    setErrors({})
  }, [])

  const closeAll = useCallback(() => {
    resetForm()
    onClose()
  }, [onClose, resetForm])

  useEffect(() => {
    if (accounts?.length && !accountId) {
      const main = accounts.find((account) => account.account_type === 'checking')
      setAccountId(main?.id ?? accounts[0]?.id ?? '')
    }
  }, [accountId, accounts])

  useEffect(() => {
    setCategoryId('')
    setSubCategoryId('')
    setErrors((current) => ({ ...current, category: undefined }))
  }, [transactionType])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => amountRef.current?.focus(), 70)
    return () => window.clearTimeout(timer)
  }, [open])

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

      closeAll()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [closeAll, open, pickerMode])

  const clearError = (field: keyof FormErrors) => {
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const validateForm = (): boolean => {
    const next: FormErrors = {}

    if (!isValidDate(date)) next.date = 'Veuillez choisir une date valide.'
    if (parseMoney(amountRaw) == null) next.amount = 'Le montant doit être supérieur à 0.'
    if (!categoryId) next.category = 'Sélectionnez une catégorie.'
    if (!accountId) next.account = 'Sélectionnez un compte.'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleCategorySelect = (id: string) => {
    setCategoryId(id)
    setSubCategoryId('')
    clearError('category')

    if (!hasHierarchy) {
      setSubCategoryId(id)
      setPickerMode('none')
      return
    }

    setPickerClosing('category')
    window.setTimeout(() => {
      setPickerMode('subcategory')
      setPickerClosing('none')
    }, 300)
  }

  const handleSubCategorySelect = (id: string) => {
    setFlipSubId(id)
    setPickerClosing('subcategory')

    window.setTimeout(() => {
      setSubCategoryId(id)
      setPickerMode('none')
      setPickerClosing('none')
      setFlipSubId(null)
      amountRef.current?.focus()
    }, 420)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return
    if (!validateForm()) return

    const parsedAmount = parseMoney(amountRaw)
    if (parsedAmount == null) return

    await addTransaction({
      user_id: user.id,
      account_id: accountId,
      category_id: subCategoryId || categoryId,
      income_source_id: null,
      import_batch_id: null,
      staging_row_id: null,
      transaction_date: date,
      amount: parsedAmount,
      currency: 'EUR',
      direction: DIRECTION_BY_TYPE[transactionType],
      flow_type: FLOW_BY_TYPE[transactionType],
      budget_behavior: budgetBehavior,
      raw_label: description || null,
      normalized_label: description || null,
      merchant_name: null,
      external_id: null,
      is_recurring: isRecurring,
      is_verified: true,
      is_hidden: false,
      notes: null,
      meta: isRecurring ? { recurrence_frequency: recurrenceFrequency } : null,
    })

    closeAll()
  }

  const openDatePicker = () => {
    const input = dateInputRef.current
    if (!input) return
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void }
    if (typeof pickerInput.showPicker === 'function') {
      pickerInput.showPicker()
      return
    }
    input.focus()
    input.click()
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
            style={{ background: 'rgba(0,0,0,0.5)', zIndex: 100 }}
            onClick={closeAll}
          />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-transaction-modal-title"
            data-testid="add-transaction-modal"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-[500px] overflow-hidden rounded-t-[var(--radius-xl)] bg-[var(--neutral-0)] shadow-[var(--shadow-lg)]"
            style={{ zIndex: 101, maxHeight: '95dvh' }}
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmit} className="flex max-h-[95dvh] flex-col">
              <header
                className="relative overflow-hidden bg-[var(--color-warning)] px-[var(--space-6)] pb-[var(--space-10)] pt-[var(--space-5)]"
                style={{ minHeight: 180 }}
              >
                <h2 id="add-transaction-modal-title" className="sr-only">
                  Ajouter une opération
                </h2>

                <button
                  type="button"
                  aria-label="Fermer"
                  onClick={closeAll}
                  className="absolute right-[var(--space-3)] top-[var(--space-3)] z-[3] inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border-none bg-[rgba(255,255,255,0.16)] text-[var(--neutral-0)]"
                  style={{ transition: 'opacity var(--transition-fast)' }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.opacity = '0.8'
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.opacity = '1'
                  }}
                >
                  <X size={20} />
                </button>

                <div className="relative z-[2] flex items-center justify-center gap-[var(--space-3)] pt-[var(--space-6)]">
                  <p
                    className="m-0 text-center text-[var(--font-size-xl)] font-[var(--font-weight-extrabold)] text-[var(--neutral-0)]"
                    style={{ lineHeight: 'var(--line-height-tight)', textTransform: 'capitalize' }}
                  >
                    {dateDisplay}
                  </p>
                  <button
                    type="button"
                    onClick={openDatePicker}
                    aria-label="Modifier la date"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border-none bg-[rgba(255,255,255,0.18)] text-[var(--neutral-0)]"
                    style={{ transition: 'opacity var(--transition-fast), transform var(--transition-fast)' }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.opacity = '0.85'
                      event.currentTarget.style.transform = 'scale(1.03)'
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.opacity = '1'
                      event.currentTarget.style.transform = 'scale(1)'
                    }}
                  >
                    <CalendarDays size={22} strokeWidth={2.6} />
                  </button>

                  <input
                    ref={dateInputRef}
                    id="transaction-date"
                    type="date"
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value)
                      clearError('date')
                    }}
                    className="sr-only"
                    required
                  />
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
                    background: 'var(--neutral-0)',
                  }}
                />
                <FieldError message={errors.date} />
              </header>

              <div className="overflow-y-auto">
                <TransactionTypeToggle value={transactionType} onChange={setTransactionType} />

                <AmountInput
                  value={amountDisplay}
                  focused={amountFocused}
                  error={errors.amount}
                  inputRef={amountRef}
                  onFocus={() => {
                    setAmountFocused(true)
                    const parsed = parseMoney(amountRaw)
                    setAmountRaw(parsed == null ? amountRaw : String(parsed))
                  }}
                  onBlur={() => {
                    setAmountFocused(false)
                    const parsed = parseMoney(amountRaw)
                    setAmountRaw(parsed == null ? '' : String(parsed))
                  }}
                  onChange={(value) => {
                    setAmountRaw(value)
                    clearError('amount')
                  }}
                />

                <div className="mx-[var(--space-6)] mt-[var(--space-4)]">
                  <Input
                    id="transaction-description"
                    type="text"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Libellé"
                    aria-label="Libellé"
                    className="rounded-[var(--radius-md)] border-[var(--neutral-200)] px-[var(--space-4)] py-[var(--space-3)] text-center text-[var(--font-size-base)] placeholder:text-[var(--neutral-900)] placeholder:opacity-100"
                  />
                </div>

                <div className="mx-[var(--space-6)] mt-[var(--space-5)] grid grid-cols-2 gap-[var(--space-3)]">
                  <CategorySelector
                    label="Catégorie"
                    selected={selectedCategory}
                    onClick={() => {
                      setPickerMode('category')
                      setPickerClosing('none')
                    }}
                    emptyIcon="category"
                  />

                  <CategorySelector
                    label="Sous-catégorie"
                    selected={selectedSubCategory}
                    disabled={!categoryId}
                    onClick={() => {
                      if (!categoryId) return
                      setPickerMode('subcategory')
                      setPickerClosing('none')
                    }}
                    emptyIcon="subcategory"
                  />
                </div>

                <FieldError message={errors.category} />

                <AdvancedSettings
                  open={advancedOpen}
                  accountId={accountId}
                  budgetBehavior={budgetBehavior}
                  isRecurring={isRecurring}
                  recurrenceFrequency={recurrenceFrequency}
                  accounts={(accounts ?? []).map((account) => ({
                    id: account.id,
                    name: account.name,
                    currency: account.currency,
                  }))}
                  accountError={errors.account}
                  onToggleOpen={() => setAdvancedOpen((current) => !current)}
                  onAccountChange={(value) => {
                    setAccountId(value)
                    clearError('account')
                  }}
                  onBehaviorChange={setBudgetBehavior}
                  onRecurringChange={setIsRecurring}
                  onRecurrenceFrequencyChange={setRecurrenceFrequency}
                />
              </div>

              <footer className="sticky bottom-0 mt-auto border-t border-[var(--neutral-200)] bg-[var(--neutral-50)] px-[var(--space-6)] py-[var(--space-4)]">
                <div className="flex items-center justify-between gap-[var(--space-3)]">
                  <Button type="button" variant="outline" size="md" className="rounded-[var(--radius-md)]" onClick={closeAll}>
                    Annuler
                  </Button>
                  <Button type="submit" variant="primary" size="md" className="rounded-[var(--radius-md)]" disabled={!canSubmit} loading={isPending}>
                    Ajouter
                  </Button>
                </div>
              </footer>
            </form>
          </motion.section>

          <AnimatePresence>
            {pickerMode === 'category' ? (
              <PickerModal
                open
                title="Sélectionner une catégorie"
                items={rootCategories}
                selectedId={categoryId}
                mode="category"
                closing={pickerClosing === 'category'}
                onClose={() => {
                  setPickerMode('none')
                  setPickerClosing('none')
                }}
                onSelect={handleCategorySelect}
              />
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {pickerMode === 'subcategory' ? (
              <PickerModal
                open
                title="Sélectionner une sous-catégorie"
                items={subCategories}
                selectedId={subCategoryId}
                mode="subcategory"
                flipId={flipSubId}
                closing={pickerClosing === 'subcategory'}
                onClose={() => {
                  setPickerMode('none')
                  setPickerClosing('none')
                  setFlipSubId(null)
                }}
                onSelect={handleSubCategorySelect}
              />
            ) : null}
          </AnimatePresence>
        </>
      ) : null}
    </AnimatePresence>
  )
}
