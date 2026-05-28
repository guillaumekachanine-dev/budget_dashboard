import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Tag, Zap, Landmark, UserCheck, AlignLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { useAccounts } from '@/hooks/useAccounts'
import { useAuth } from '@/hooks/useAuth'
import { useCategories } from '@/hooks/useCategories'
import { useAddTransaction } from '@/hooks/useTransactions'
import { formatCurrencyAdaptive, getCategoryColor, todayIso } from '@/lib/utils'
import type { BudgetBehavior, Category, Direction, RecurrenceFrequency } from '@/lib/types'

interface AddTransactionModalProps {
  open: boolean
  onClose: () => void
}

type PickerMode = 'none' | 'category' | 'subcategory'
type TransactionType = 'expense' | 'income' | 'transfer' | 'savings'

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
  onSubmitEditing: () => void
  onFocus: () => void
  onBlur: () => void
  onChange: (next: string) => void
  cockpit?: boolean
}

export type CategoryPickerModalProps = {
  open: boolean
  mode: 'category' | 'subcategory'
  title: string
  items: Category[]
  selectedId: string
  closing: boolean
  showAllOption?: boolean
  flipId?: string | null
  onSelect: (id: string) => void
  onClose: () => void
  onBackgroundClick?: () => void
  getItemDisplayLabel?: (item: Category) => string
  iconTreatment?: 'default' | 'croppedCircle'
}

type SettingsListProps = {
  categoryLabel: string
  behavior: BudgetBehavior
  accountMode: AccountMode
  canUseJoint: boolean
  imputability: string
  compactMobile?: boolean
  accentColor?: string
  onCategoryClick: () => void
  onBehaviorToggle: () => void
  onAccountModeToggle: () => void
  onImputabilityToggle: () => void
}

export const ALL_CATEGORY_TOKEN = '__all__'
const TRANSFER_SUBCATEGORY_NAMES = ['Virement épargne', 'Virement investissement', 'Épargne projet'] as const
const SAVINGS_SUBCATEGORY_NAMES = ['Virement épargne', 'Placement', 'Investissement', 'Épargne projet', 'Intérêts'] as const
const EXPENSE_ROOT_CATEGORY_ORDER = [
  'logement',
  'alimentation',
  'achats divers',
  'sorties',
  'famille enfant',
  'voyages',
  'transport',
  'business',
  'abonnements',
  'sante',
  'taxes frais',
] as const

function normalizeText(value?: string | null): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function orderExpenseRootCategories(items: Category[]): Category[] {
  if (!items.length) return items
  const remaining = [...items]
  const ordered: Category[] = []

  for (const token of EXPENSE_ROOT_CATEGORY_ORDER) {
    const index = remaining.findIndex((category) => normalizeText(category.name).includes(token))
    if (index >= 0) {
      const [matched] = remaining.splice(index, 1)
      if (matched) ordered.push(matched)
    }
  }

  return [...ordered, ...remaining]
}
const TRANSACTION_ORDER: TransactionType[] = ['expense', 'income', 'transfer', 'savings']
const TRANSACTION_LABEL: Record<TransactionType, string> = {
  expense: 'Dépense',
  income: 'Revenu',
  transfer: 'Transfert',
  savings: 'Épargne',
}
const DIRECTION_BY_TYPE: Record<TransactionType, Direction> = {
  expense: 'expense',
  income: 'income',
  transfer: 'transfer_out',
  savings: 'savings',
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

function parseMoney(value: string): number | null {
  const normalized = value.replace(/\s/g, '').replace('€', '').replace(/,/g, '.').trim()
  const sanitized = normalized.replace(/[^\d.]/g, '')
  if (!sanitized) return null
  const parts = sanitized.split('.')
  if (parts.length > 2) return null
  const [integerPart = '', decimalPart = ''] = parts
  const rebuilt = decimalPart ? `${integerPart}.${decimalPart.slice(0, 2)}` : integerPart
  const parsed = Number(rebuilt)
  if (!Number.isFinite(parsed)) return null
  if (parsed <= 0) return null
  return Math.round(parsed * 100) / 100
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
  return formatCurrencyAdaptive(parsed)
}

function toAmountInputValue(value: string): string {
  return value.replace(/\s/g, '').replace('€', '').replace(/,/g, '.').replace(/[^\d.]/g, '')
}

function imputabilityLabel(personalShareRatio: number): string {
  if (personalShareRatio <= 0) return 'Non (0%)'
  if (personalShareRatio <= 0.5) return 'Partagé (50%)'
  return 'Personnel (100%)'
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

function AmountInput({ value, focused, error, inputRef, onSubmitEditing, onFocus, onBlur, onChange, cockpit }: AmountInputProps) {
  return (
    <section
      className="relative px-[var(--space-5)]"
      style={{ zIndex: 999, isolation: 'isolate' }}
      aria-labelledby="amount-input-label"
    >
      <p id="amount-input-label" className="sr-only">
        Montant
      </p>

      <div className="flex flex-col items-center">
        <input
          ref={inputRef}
          id="transaction-amount"
          type="text"
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          autoFocus
          value={value}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            onSubmitEditing()
          }}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.,]/g, ''))}
          placeholder="0 €"
          className={`w-full border-none bg-transparent px-0 py-[var(--space-2)] text-center text-[var(--font-size-kpi)] font-[var(--font-weight-extrabold)] outline-none ${cockpit ? 'text-white placeholder:text-[rgba(255,255,255,0.65)]' : 'text-[var(--primary-700)] placeholder:text-[var(--neutral-300)]'}`}
          style={{
            lineHeight: 'var(--line-height-tight)',
            transform: focused ? 'scale(1.015)' : 'scale(1)',
            transition: 'transform var(--transition-fast)',
            textShadow: cockpit ? '0 1px 8px rgba(0,0,0,0.18)' : undefined,
          }}
          aria-invalid={Boolean(error)}
        />
      </div>

      {!cockpit && <FieldError message={error} />}
    </section>
  )
}

function SettingsRow({
  icon,
  label,
  value,
  accentColor,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accentColor?: string
  onClick?: () => void
  disabled?: boolean
}) {
  const interactive = Boolean(onClick) && !disabled
  const isEmpty = value === 'Choisir'
  const accent = accentColor ?? 'var(--primary-600)'
  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        border: '1.5px solid var(--neutral-200)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--neutral-0)',
        padding: '10px 14px',
        cursor: interactive ? 'pointer' : 'default',
        textAlign: 'left',
        opacity: disabled ? 0.45 : 1,
        minHeight: 52,
        boxShadow: '0 1px 4px rgba(28,28,58,0.05)',
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: `color-mix(in srgb, ${accent} 12%, transparent)`,
          border: `1.5px solid color-mix(in srgb, ${accent} 22%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: accent,
        }}
      >
        {icon}
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 'var(--font-size-sm)',
          fontWeight: 600,
          color: 'var(--neutral-500)',
          lineHeight: 'var(--line-height-tight)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          fontSize: 'var(--font-size-sm)',
          fontWeight: 800,
          color: isEmpty ? 'var(--neutral-400)' : 'var(--neutral-900)',
          background: isEmpty ? 'var(--neutral-100)' : 'var(--neutral-50)',
          border: '1.5px solid var(--neutral-200)',
          borderRadius: 8,
          padding: '4px 10px',
          maxWidth: '56%',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          lineHeight: 'var(--line-height-tight)',
        }}
      >
        {value}
        {interactive && (
          <span style={{ opacity: 0.35, fontSize: 15, lineHeight: 1, marginLeft: 1 }}>›</span>
        )}
      </span>
    </button>
  )
}

function SettingsList({
  categoryLabel,
  behavior,
  accountMode,
  canUseJoint,
  imputability,
  accentColor,
  onCategoryClick,
  onBehaviorToggle,
  onAccountModeToggle,
  onImputabilityToggle,
}: SettingsListProps) {
  return (
    <section style={{ margin: '0 var(--space-5)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SettingsRow
        icon={<Tag size={15} strokeWidth={2.2} />}
        label="Catégorie"
        value={categoryLabel}
        accentColor={accentColor}
        onClick={onCategoryClick}
      />
      <SettingsRow
        icon={<Zap size={15} strokeWidth={2.2} />}
        label="Fixe / Variable"
        value={budgetBehaviorLabel(behavior)}
        accentColor={accentColor}
        onClick={onBehaviorToggle}
      />
      <SettingsRow
        icon={<Landmark size={15} strokeWidth={2.2} />}
        label="Compte"
        value={accountMode === 'joint' ? 'Compte joint' : 'Compte perso'}
        accentColor={accentColor}
        onClick={onAccountModeToggle}
        disabled={!canUseJoint}
      />
      <SettingsRow
        icon={<UserCheck size={15} strokeWidth={2.2} />}
        label="Imputabilité"
        value={imputability}
        accentColor={accentColor}
        onClick={onImputabilityToggle}
      />
    </section>
  )
}

export function CategoryPickerModal({
  open,
  mode,
  title,
  items,
  selectedId,
  closing,
  showAllOption = true,
  flipId,
  onSelect,
  onClose,
  onBackgroundClick,
  getItemDisplayLabel,
  iconTreatment = 'default',
}: CategoryPickerModalProps) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const displayItems = useMemo(
    () =>
      mode === 'category' && showAllOption
        ? ([{ id: ALL_CATEGORY_TOKEN, name: 'Toutes catégories', icon_key: 'toutes_categories' } as Category, ...items])
        : items,
    [items, mode, showAllOption],
  )

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!displayItems.length) return

    let nextIndex = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = Math.min(index + 1, displayItems.length - 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = Math.max(index - 1, 0)
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = displayItems.length - 1
    } else {
      return
    }

    event.preventDefault()
    optionRefs.current[nextIndex]?.focus()
  }

  const handlePanelClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (mode !== 'subcategory' || !onBackgroundClick) return
    const target = event.target as HTMLElement | null
    if (!target) return
    if (target.closest('[data-picker-option="true"]')) return
    onBackgroundClick()
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
            style={{ background: 'rgba(13,13,31,0.45)', zIndex: mode === 'subcategory' ? 401 : 400 }}
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
              zIndex: mode === 'subcategory' ? 402 : 401,
              borderRadius: 'var(--radius-2xl) var(--radius-2xl) 0 0',
              padding: 'var(--space-4) var(--space-6) calc(var(--space-6) + var(--safe-bottom-offset))',
              maxHeight: '72dvh',
              overflow: 'hidden',
            }}
            onClick={handlePanelClick}
          >
            <div className="modal-picker-scroll" style={{ overflowY: 'auto' }}>
              <div style={{ display: 'grid', gap: 'var(--space-2)' }} role="listbox" aria-label={title}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
                    gap: 6,
                    alignContent: 'start',
                    minHeight: mode === 'subcategory' ? 'calc(2 * 68px + 6px)' : undefined,
                  }}
                >
                {displayItems.map((item, index) => {
                  const selected = item.id === selectedId || (item.id === ALL_CATEGORY_TOKEN && selectedId === '')
                  const flipping = mode === 'subcategory' && item.id === flipId
                  const itemLabel = getItemDisplayLabel ? getItemDisplayLabel(item) : item.name
                  const iconStyle: CSSProperties | undefined =
                    iconTreatment === 'croppedCircle'
                      ? {
                          borderRadius: '50%',
                          clipPath: 'circle(50%)',
                          border: '0.75px solid var(--neutral-700)',
                          boxSizing: 'border-box',
                          objectFit: 'cover',
                          transform: 'scale(1.16)',
                          transformOrigin: 'center',
                        }
                      : undefined
                  return (
                    <motion.button
                      key={item.id}
                      data-picker-option="true"
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
                      className="flex flex-col items-center gap-[var(--space-1)] border-none bg-transparent px-0 py-[var(--space-1)]"
                      style={{
                        transformStyle: 'preserve-3d',
                        padding: '4px 2px',
                        cursor: 'pointer',
                        opacity: selected ? 1 : 0.92,
                        transition: 'opacity var(--transition-fast), transform var(--transition-fast)',
                      }}
                    >
                      <CategoryIcon iconKey={item.icon_key} label={item.name} size={30} style={iconStyle} />
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: selected ? 800 : 700,
                          color: selected ? 'var(--primary-700)' : 'var(--neutral-700)',
                          lineHeight: 1.05,
                          textAlign: 'center',
                          maxWidth: '100%',
                          whiteSpace: 'normal',
                        }}
                      >
                        {itemLabel}
                      </span>
                    </motion.button>
                  )
                })}
                </div>
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
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(max-width: 768px)').matches
  })
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)
  /** Décalage vertical du visual viewport (iOS peut scroller le viewport vers le bas) */
  const [viewportOffsetTop, setViewportOffsetTop] = useState(0)

  const amountRef = useRef<HTMLInputElement | null>(null)
  const descriptionRef = useRef<HTMLInputElement | null>(null)
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
    if (values.transactionType !== 'income' && values.transactionType !== 'transfer' && values.transactionType !== 'savings') return null
    if (!hasHierarchy || rootCategories.length !== 1) return null
    return rootCategories[0] ?? null
  }, [hasHierarchy, rootCategories, values.transactionType])

  const orderedRootCategories = useMemo(() => (
    values.transactionType === 'expense'
      ? orderExpenseRootCategories(rootCategories)
      : rootCategories
  ), [rootCategories, values.transactionType])

  const savingsRootCategory = useMemo(() => {
    if (values.transactionType !== 'savings') return null
    const list = categories ?? []
    const rootList = hasHierarchy ? list.filter((category) => category.parent_id === null) : list
    const byName = rootList.find((category) => normalizeText(category.name).includes('epargne')) ?? null
    if (byName) return byName
    return rootList[0] ?? null
  }, [categories, hasHierarchy, values.transactionType])

  const subCategories = useMemo(() => {
    if (values.transactionType === 'transfer') {
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
      const mergedById = new Map<string, Category>()
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

      if (merged.length > 0) return merged
    }

    if (values.transactionType === 'savings') {
      const savingsList = categories ?? []
      const root = savingsRootCategory ?? directSubcategoryRoot
      const savingsChildren = root
        ? savingsList.filter((category) => category.parent_id === root.id)
        : savingsList.filter((category) => category.parent_id !== null)

      const source = savingsChildren.length > 0 ? savingsChildren : savingsList
      const allowedSavings = source.filter((category) => {
        const normalizedName = normalizeText(category.name)
        const normalizedIconKey = normalizeText(category.icon_key)
        const isVirementEpargne = normalizedName.includes('virement') && normalizedName.includes('epargne')
        const isPlacement = normalizedName.includes('placement') || normalizedIconKey.includes('epargne placement')
        const isInvestissement = normalizedName.includes('investissement') || normalizedIconKey.includes('epargne investissement')
        const isEpargneProjet = (normalizedName.includes('epargne') && normalizedName.includes('projet')) || normalizedIconKey.includes('epargne projet')
        const isInterets = normalizedName.includes('interet')
        return isVirementEpargne || isPlacement || isInvestissement || isEpargneProjet || isInterets
      })

      const savingsOrder = SAVINGS_SUBCATEGORY_NAMES.map((label) => normalizeText(label))
      const orderedSavings = allowedSavings.sort((a, b) => {
        const aNorm = normalizeText(a.name)
        const bNorm = normalizeText(b.name)
        const aIndex = savingsOrder.findIndex((token) => aNorm.includes(token))
        const bIndex = savingsOrder.findIndex((token) => bNorm.includes(token))
        if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name, 'fr')
        if (aIndex === -1) return 1
        if (bIndex === -1) return -1
        return aIndex - bIndex
      })

      if (orderedSavings.length > 0) return orderedSavings
      return savingsChildren
    }

    if (!values.categoryId) return []
    const list = categories ?? []
    if (!hasHierarchy) return list.filter((category) => category.id === values.categoryId)
    return list.filter((category) => category.parent_id === values.categoryId)
  }, [allCategories, categories, directSubcategoryRoot, hasHierarchy, savingsRootCategory, values.categoryId, values.transactionType])

  const categoryById = useMemo(
    () => new Map((categories ?? []).map((category) => [category.id, category])),
    [categories],
  )

  const selectedCategory = values.categoryId ? categoryById.get(values.categoryId) ?? null : null
  const selectedSubCategory = values.subCategoryId ? categoryById.get(values.subCategoryId) ?? null : null

  const categoryLabel = selectedSubCategory?.name ?? selectedCategory?.name ?? 'Choisir'
  const headerBackgroundColor = useMemo(() => {
    if (values.transactionType === 'expense') return 'linear-gradient(135deg, #FC5A5A 0%, #FF8065 100%)'
    if (values.transactionType === 'income') return 'linear-gradient(135deg, #2ED47A 0%, #17A855 100%)'
    if (values.transactionType === 'savings') return 'linear-gradient(135deg, #5B57F5 0%, #9C6BFF 100%)'
    return 'linear-gradient(135deg, #FFAB2E 0%, #FF8C30 100%)'
  }, [values.transactionType])
  const typeAccentColor = useMemo(() => {
    if (values.transactionType === 'expense') return '#FC5A5A'
    if (values.transactionType === 'income') return '#2ED47A'
    if (values.transactionType === 'savings') return '#5B57F5'
    return '#FFAB2E'
  }, [values.transactionType])
  const transactionPillBorderColor = 'rgba(255,255,255,0.38)'

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
    return Boolean(parseMoney(values.amount) && (values.categoryId || values.subCategoryId) && values.accountId && isValidDate(values.date))
  }, [values.amount, values.categoryId, values.subCategoryId, values.accountId, values.date])
  const mobileWithoutKeyboard = isMobileViewport && !keyboardVisible
  const modalMaxHeight = useMemo(() => {
    const fullHeight = typeof window !== 'undefined' ? window.innerHeight : 720
    if (isMobileViewport && keyboardVisible && viewportHeight) {
      // Clavier ouvert : remplir le visual viewport (moins un tout petit margin)
      return `${Math.max(120, viewportHeight - 16)}px`
    }
    // Sans clavier : laisser une marge confortable pour que le backdrop soit visible
    const margin = isMobileViewport ? 48 : 80
    return `${Math.max(200, fullHeight - margin)}px`
  }, [isMobileViewport, keyboardVisible, viewportHeight])

  const focusDescriptionInput = useCallback(() => {
    amountRef.current?.blur()
    window.setTimeout(() => {
      descriptionRef.current?.focus()
    }, 40)
  }, [])

  const closeDescriptionInput = useCallback(() => {
    descriptionRef.current?.blur()
  }, [])

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
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(max-width: 768px)')
    const onChange = (event: MediaQueryListEvent) => setIsMobileViewport(event.matches)
    setIsMobileViewport(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!open || !isMobileViewport || typeof window === 'undefined') {
      setKeyboardVisible(false)
      setViewportHeight(null)
      return
    }
    const viewport = window.visualViewport
    if (!viewport) {
      setViewportHeight(window.innerHeight)
      return
    }

    const updateKeyboardState = () => {
      const keyboardDelta = window.innerHeight - viewport.height
      setKeyboardVisible(keyboardDelta > 140)
      setViewportHeight(viewport.height)
      setViewportOffsetTop(Math.round(viewport.offsetTop))
    }

    updateKeyboardState()
    viewport.addEventListener('resize', updateKeyboardState)
    viewport.addEventListener('scroll', updateKeyboardState)
    return () => {
      viewport.removeEventListener('resize', updateKeyboardState)
      viewport.removeEventListener('scroll', updateKeyboardState)
    }
  }, [isMobileViewport, open])

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
      const subCategory = categoryById.get(id) ?? null
      setValue('subCategoryId', id)
      if (!values.categoryId) {
        setValue('categoryId', subCategory?.parent_id ?? id)
      }
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

  const handleBehaviorToggle = () => {
    setValue('budgetBehavior', values.budgetBehavior === 'fixed' ? 'variable' : 'fixed')
  }

  const handleAccountModeToggle = () => {
    if (!canUseJoint) return
    const nextMode: AccountMode = values.accountMode === 'personal' ? 'joint' : 'personal'
    setValue('accountMode', nextMode)
    setValue('personalShareRatio', nextMode === 'joint' ? 0.5 : 1)
    const nextAccount = nextMode === 'joint' ? jointAccount : personalAccount
    if (nextAccount) setValue('accountId', nextAccount.id)
  }

  const handleTransactionTypeCycle = () => {
    const index = TRANSACTION_ORDER.indexOf(values.transactionType)
    const nextType = TRANSACTION_ORDER[(index + 1) % TRANSACTION_ORDER.length]
    setValue('transactionType', nextType)
  }

  const handleImputabilityToggle = () => {
    const current = values.personalShareRatio
    const next = current >= 1 ? 0.5 : current >= 0.5 ? 0 : 1
    setValue('personalShareRatio', next)
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

    if (!formValues.categoryId && !formValues.subCategoryId) {
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

          {/*
           * Wrapper de centrage — flexbox sans conflit avec les transforms Framer Motion.
           * Quand le clavier est visible, on s'ancre sur le visual viewport (height +
           * offsetTop) pour que la modale reste entièrement visible au-dessus du clavier.
           * pointer-events:none laisse les clics passer au backdrop derrière.
           */}
          <div
            style={{
              position: 'fixed',
              top: (isMobileViewport && keyboardVisible) ? viewportOffsetTop : 0,
              left: 0,
              right: 0,
              // Clavier ouvert → hauteur = visual viewport ; sinon → jusqu'en bas
              ...((isMobileViewport && keyboardVisible && viewportHeight)
                ? { height: `${viewportHeight}px` }
                : { bottom: 0 }),
              zIndex: 101,
              display: 'flex',
              // Clavier ouvert → contenu depuis le haut ; sinon → centré
              alignItems: (isMobileViewport && keyboardVisible) ? 'flex-start' : 'center',
              justifyContent: 'center',
              padding: isMobileViewport
                ? (keyboardVisible ? 'var(--space-2)' : 'var(--space-6) var(--space-2) var(--space-2)')
                : 'var(--space-6)',
              pointerEvents: 'none',
            }}
          >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-transaction-modal-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="w-[min(500px,100%)] overflow-hidden rounded-[var(--radius-xl)] bg-[var(--neutral-0)] shadow-[var(--shadow-lg)]"
            style={{
              maxHeight: modalMaxHeight,
              // Clavier ouvert → 100% du wrapper pour que flex-1 interne scrolle correctement
              // Sans clavier mobile → auto (la modale épouse son contenu jusqu'à maxHeight)
              // Desktop → min(82dvh, 100%) pour rester dans les bounds du wrapper
              height: (isMobileViewport && keyboardVisible)
                ? '100%'
                : isMobileViewport
                  ? 'auto'
                  : 'min(82dvh, 100%)',
              pointerEvents: 'auto',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmit(onSubmit)} className={`flex max-h-full flex-col ${mobileWithoutKeyboard ? '' : 'h-full'}`}>
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
                className="relative overflow-hidden"
                style={{
                  minHeight: keyboardVisible ? (isMobileViewport ? 168 : 182) : (isMobileViewport ? 200 : 216),
                  paddingTop: 'var(--space-4)',
                  paddingBottom: 'var(--space-2)',
                  background: headerBackgroundColor,
                  borderBottom: 'none',
                  boxShadow: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <h2 id="add-transaction-modal-title" className="sr-only">
                  Nouvelle opération
                </h2>

                {/* Close button */}
                <button
                  type="button"
                  aria-label="Fermer"
                  onClick={closeAndReset}
                  className="absolute right-[var(--space-3)] top-[var(--space-3)] inline-flex items-center justify-center rounded-[var(--radius-pill)] border-none bg-[rgba(255,255,255,0.18)] text-[var(--neutral-0)]"
                  style={{
                    width: isMobileViewport ? 38 : 44,
                    height: isMobileViewport ? 38 : 44,
                  }}
                >
                  <X size={isMobileViewport ? 18 : 20} />
                </button>

                {/* Type pill + date secondaire — centrés */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    paddingTop: 2,
                  }}
                >
                  <button
                    type="button"
                    onClick={handleTransactionTypeCycle}
                    className="border-none text-[var(--neutral-0)]"
                    style={{
                      border: `2px solid ${transactionPillBorderColor}`,
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(255,255,255,0.18)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 800,
                      padding: '8px 18px',
                      cursor: 'pointer',
                      letterSpacing: '0.01em',
                      lineHeight: 'var(--line-height-tight)',
                      whiteSpace: 'nowrap',
                    }}
                    aria-label={`Type d'opération: ${TRANSACTION_LABEL[values.transactionType]}. Cliquer pour changer.`}
                  >
                    {TRANSACTION_LABEL[values.transactionType]}
                  </button>

                  {/* Date — clickable via input overlay invisible */}
                  <div className="relative text-[var(--neutral-0)]" style={{ zIndex: 40 }}>
                    <span
                      className="block text-center"
                      style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        opacity: 0.78,
                        lineHeight: 'var(--line-height-tight)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {formatLongDate(values.date)}
                    </span>
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
                      aria-label="Date de l'opération"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0.001,
                        width: '100%',
                        height: '100%',
                        cursor: 'pointer',
                        zIndex: 41,
                        WebkitAppearance: 'none',
                        appearance: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Montant — ancré en bas du header, texte blanc */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '100%' }}>
                  <AmountInput
                    cockpit
                    value={amountDisplay}
                    focused={amountFocused}
                    error={errors.amount?.message}
                    inputRef={amountRef}
                    onSubmitEditing={focusDescriptionInput}
                    onFocus={() => {
                      setAmountFocused(true)
                      setValue('amount', toAmountInputValue(values.amount))
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
                </div>

              </header>

              <div
                className={`modal-main-scroll overflow-y-auto pt-0 ${mobileWithoutKeyboard ? 'pb-0' : 'flex-1 pb-[var(--space-4)]'}`}
                style={{ position: 'relative', zIndex: 20 }}
              >

                <div style={{ padding: '12px var(--space-5) 0' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      border: '1.5px solid var(--neutral-200)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--neutral-0)',
                      padding: '10px 14px',
                      boxShadow: '0 1px 4px rgba(28,28,58,0.05)',
                    }}
                  >
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: `color-mix(in srgb, ${typeAccentColor} 12%, transparent)`,
                        border: `1.5px solid color-mix(in srgb, ${typeAccentColor} 22%, transparent)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: typeAccentColor,
                      }}
                    >
                      <AlignLeft size={15} strokeWidth={2.2} />
                    </span>
                    <input
                      ref={descriptionRef}
                      id="transaction-description"
                      type="text"
                      enterKeyHint="done"
                      value={values.description}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return
                        event.preventDefault()
                        closeDescriptionInput()
                      }}
                      onChange={(event) => setValue('description', event.target.value)}
                      placeholder="Libellé de l'opération"
                      aria-label="Libellé de l'opération"
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        color: 'var(--neutral-900)',
                        lineHeight: 'var(--line-height-tight)',
                      }}
                    />
                  </div>
                </div>

                <div className="mt-[var(--space-3)]">
                  <SettingsList
                    categoryLabel={categoryLabel}
                    behavior={values.budgetBehavior}
                    accountMode={values.accountMode}
                    canUseJoint={canUseJoint}
                    imputability={imputabilityLabel(values.personalShareRatio)}
                    compactMobile={isMobileViewport}
                    accentColor={typeAccentColor}
                    onCategoryClick={() => {
                      if (values.transactionType === 'transfer') {
                        setPickerMode('subcategory')
                        setPickerClosing('none')
                        return
                      }

                      if (values.transactionType === 'savings') {
                        const savingsRoot = savingsRootCategory ?? directSubcategoryRoot ?? rootCategories[0] ?? null
                        if (savingsRoot) {
                          setValue('categoryId', savingsRoot.id)
                          setValue('subCategoryId', '')
                        }
                        setPickerMode('subcategory')
                        setPickerClosing('none')
                        return
                      }

                      if (directSubcategoryRoot) {
                        setValue('categoryId', directSubcategoryRoot.id)
                        setValue('subCategoryId', '')
                        clearErrors('categoryId')
                        setPickerMode('subcategory')
                        setPickerClosing('none')
                        return
                      }

                      setPickerMode('category')
                      setPickerClosing('none')
                    }}
                    onBehaviorToggle={handleBehaviorToggle}
                    onAccountModeToggle={handleAccountModeToggle}
                    onImputabilityToggle={handleImputabilityToggle}
                  />
                  <div className="px-[var(--space-6)]">
                    <FieldError message={errors.amount?.message} />
                    <FieldError message={errors.categoryId?.message} />
                    <FieldError message={errors.accountId?.message} />
                    <FieldError message={errors.date?.message} />
                  </div>
                </div>
              </div>

              <footer className="sticky bottom-0 z-30 border-t border-[var(--neutral-200)] bg-[var(--neutral-50)] px-[var(--space-6)]" style={{ paddingTop: isMobileViewport ? 'var(--space-1)' : 'var(--space-2)', paddingBottom: isMobileViewport ? 'var(--space-1)' : 'var(--space-2)' }}>
                <div className="flex items-center justify-between gap-[var(--space-3)]">
                  <Button type="button" variant="outline" size="sm" className="rounded-[var(--radius-md)]" style={{ height: isMobileViewport ? 34 : 38, minHeight: isMobileViewport ? 34 : 38 }} onClick={closeAndReset}>
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="rounded-[var(--radius-md)] text-[var(--neutral-0)] hover:brightness-95 active:brightness-90"
                    style={{ height: isMobileViewport ? 34 : 38, minHeight: isMobileViewport ? 34 : 38, background: typeAccentColor, borderColor: typeAccentColor }}
                    disabled={!canSubmit}
                    loading={isPending}
                  >
                    Ajouter
                  </Button>
                </div>
              </footer>
            </form>
          </motion.section>
          </div>{/* /centering wrapper */}

          <CategoryPickerModal
            open={pickerMode === 'category'}
            mode="category"
            title="Sélectionner une catégorie"
            items={orderedRootCategories}
            selectedId={values.categoryId}
            closing={pickerClosing === 'category'}
            showAllOption={values.transactionType !== 'expense'}
            onClose={() => {
              setPickerMode('none')
              setPickerClosing('none')
            }}
            iconTreatment="default"
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
            onBackgroundClick={handleSubCategoryBackToCategory}
            onClose={() => {
              setPickerMode('none')
              setPickerClosing('none')
              setFlipSubId(null)
            }}
            iconTreatment="default"
            onSelect={handleSubCategorySelect}
            getItemDisplayLabel={(item) => {
              if (values.transactionType === 'income' && item.name.trim().toLowerCase() === 'remboursement') {
                return 'Rembours.'
              }
              if (item.name.trim().toLowerCase() === 'investissement') {
                return 'Invest.'
              }
              return item.name
            }}
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
