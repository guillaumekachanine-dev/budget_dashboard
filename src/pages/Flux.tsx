import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ArrowLeft, Search, Check } from 'lucide-react'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { formatCurrency } from '@/lib/utils'
import { Button, Input } from '@/components'
import { PageHeader } from '@/components/layout/PageHeader'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { TransactionDetailsModal } from '@/components/modals/TransactionDetailsModal'
import type { FlowType, Transaction } from '@/lib/types'
import { lockDocumentScroll } from '@/lib/scrollLock'

type FlowFilter = 'all' | 'income' | 'expense' | 'transfer'
type PeriodFilter = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all'
type PeriodMode = 'current' | 'rolling'
type QuickParamPicker = 'type' | 'period' | 'fixed' | 'account' | null

const FLOW_OPTIONS: Array<{ value: FlowFilter; label: string }> = [
  { value: 'all', label: 'Toutes' },
  { value: 'expense', label: 'Depenses' },
  { value: 'income', label: 'Revenus' },
  { value: 'transfer', label: 'Transferts internes' },
]

const PERIOD_OPTIONS: Array<{ value: PeriodFilter; label: string }> = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Annee' },
  { value: 'all', label: 'Tout' },
]

const VIZ_TOKENS = ['var(--viz-a)', 'var(--viz-b)', 'var(--viz-c)', 'var(--viz-d)', 'var(--viz-e)'] as const

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function startOfIsoDay(d: Date): string {
  const dt = new Date(d)
  dt.setHours(0, 0, 0, 0)
  return dt.toISOString().slice(0, 10)
}

function startOfIsoMonth(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function startOfIsoQuarter(d: Date): string {
  const qMonth = Math.floor(d.getMonth() / 3) * 3
  return new Date(d.getFullYear(), qMonth, 1).toISOString().slice(0, 10)
}

function startOfIsoYear(d: Date): string {
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10)
}

function periodToRange(period: PeriodFilter, mode: PeriodMode): { startDate?: string; endDate?: string } {
  const now = new Date()
  switch (period) {
    case 'day': {
      const start = startOfIsoDay(now)
      return { startDate: start, endDate: todayIso() }
    }
    case 'week': {
      if (mode === 'rolling') {
        const start = new Date(now)
        start.setDate(now.getDate() - 5)
        return { startDate: startOfIsoDay(start), endDate: todayIso() }
      }
      const day = now.getDay() === 0 ? 6 : now.getDay() - 1
      const monday = new Date(now)
      monday.setDate(now.getDate() - day)
      return { startDate: startOfIsoDay(monday), endDate: todayIso() }
    }
    case 'month': {
      if (mode === 'rolling') {
        const start = new Date(now)
        start.setDate(now.getDate() - 29)
        return { startDate: startOfIsoDay(start), endDate: todayIso() }
      }
      return { startDate: startOfIsoMonth(now), endDate: todayIso() }
    }
    case 'quarter': {
      if (mode === 'rolling') {
        const start = new Date(now)
        start.setDate(now.getDate() - 89)
        return { startDate: startOfIsoDay(start), endDate: todayIso() }
      }
      return { startDate: startOfIsoQuarter(now), endDate: todayIso() }
    }
    case 'year': {
      if (mode === 'rolling') {
        const start = new Date(now)
        start.setDate(now.getDate() - 364)
        return { startDate: startOfIsoDay(start), endDate: todayIso() }
      }
      return { startDate: startOfIsoYear(now), endDate: todayIso() }
    }
    case 'all':
      return {}
  }
}

function displayTxnLabel(t: Transaction): string {
  return (t.normalized_label ?? t.raw_label ?? 'Operation').trim() || 'Operation'
}

function displayTxnCategoryName(t: Transaction): string {
  return t.category?.name ?? 'Sans categorie'
}

function signedAmount(t: Transaction): number {
  const amount = Number(t.amount) || 0
  if (t.flow_type === 'expense') return -amount
  if (t.flow_type === 'income') return amount
  return 0
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function accentFromCategory(name: string): string {
  const key = name.trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash << 5) - hash + key.charCodeAt(i)
  return VIZ_TOKENS[Math.abs(hash) % VIZ_TOKENS.length]
}

function formatMoneyInteger(amount: number): string {
  if (!Number.isFinite(amount)) return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(0)

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.floor(amount))
}

function resultNoun(flow: FlowFilter): string {
  if (flow === 'expense') return 'dépenses'
  if (flow === 'income') return 'revenus'
  if (flow === 'transfer') return 'transferts internes'
  return 'opérations'
}

function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,13,31,0.45)' }}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 330 }}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 61,
              width: '100%',
              maxWidth: 420,
              margin: '0 auto',
              background: 'var(--neutral-0)',
              borderRadius: '20px 20px 0 0',
              padding: '12px var(--space-6) calc(var(--space-6) + var(--safe-bottom-offset))',
              maxHeight: 'calc(100dvh - 12px)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, margin: '4px auto 12px', background: 'var(--neutral-200)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-900)' }}>{title}</p>
              <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-11 w-11 rounded-full bg-[var(--neutral-100)] px-0">
                <ChevronDown size={16} />
              </Button>
            </div>
            <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' as CSSProperties['WebkitOverflowScrolling'] }}>{children}</div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

function SegmentedToggle({
  left,
  right,
  value,
  onChange,
}: {
  left: string
  right: string
  value: 'left' | 'right'
  onChange: (next: 'left' | 'right') => void
}) {
  return (
    <div style={{ display: 'inline-flex', gap: 2, border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-full)', padding: 2 }}>
      <button
        type="button"
        onClick={() => onChange('left')}
        style={{
          border: 'none',
          borderRadius: 'var(--radius-full)',
          background: value === 'left' ? 'var(--neutral-100)' : 'transparent',
          color: value === 'left' ? 'var(--neutral-900)' : 'var(--neutral-500)',
          fontSize: 11,
          fontWeight: 800,
          padding: '6px 10px',
          cursor: 'pointer',
        }}
      >
        {left}
      </button>
      <button
        type="button"
        onClick={() => onChange('right')}
        style={{
          border: 'none',
          borderRadius: 'var(--radius-full)',
          background: value === 'right' ? 'var(--neutral-100)' : 'transparent',
          color: value === 'right' ? 'var(--neutral-900)' : 'var(--neutral-500)',
          fontSize: 11,
          fontWeight: 800,
          padding: '6px 10px',
          cursor: 'pointer',
        }}
      >
        {right}
      </button>
    </div>
  )
}

function Switch({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 42,
        height: 24,
        borderRadius: 'var(--radius-full)',
        border: value ? '1px solid var(--primary-500)' : '1px solid var(--neutral-200)',
        background: value ? 'var(--primary-500)' : 'var(--neutral-200)',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: value ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left var(--transition-base)',
        }}
      />
    </button>
  )
}

type FilterDropdownOption = {
  value: string
  label: string
  selected: boolean
  onSelect: () => void
}

function FilterDropdown({
  id,
  label,
  value,
  options,
  isOpen,
  showMobileOverlay,
  onToggle,
  onClose,
  headerContent,
  compactValue = false,
}: {
  id: Exclude<QuickParamPicker, null>
  label: string
  value: string
  options: FilterDropdownOption[]
  isOpen: boolean
  showMobileOverlay: boolean
  onToggle: () => void
  onClose: () => void
  headerContent?: React.ReactNode
  compactValue?: boolean
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [focusedIndex, setFocusedIndex] = useState(0)

  useEffect(() => {
    if (!isOpen) return
    const selectedIndex = options.findIndex((opt) => opt.selected)
    setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [isOpen, options])

  useEffect(() => {
    if (!isOpen) return
    const onDocumentPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (!wrapperRef.current?.contains(target)) onClose()
    }
    document.addEventListener('mousedown', onDocumentPointerDown)
    document.addEventListener('touchstart', onDocumentPointerDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDocumentPointerDown)
      document.removeEventListener('touchstart', onDocumentPointerDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const focusTimer = window.setTimeout(() => {
      menuRef.current?.focus()
      optionRefs.current[focusedIndex]?.focus()
    }, 0)
    return () => window.clearTimeout(focusTimer)
  }, [focusedIndex, isOpen])

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle()
    }
  }

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      triggerRef.current?.focus()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setFocusedIndex((current) => (current + 1) % options.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setFocusedIndex((current) => (current - 1 + options.length) % options.length)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const option = options[focusedIndex]
      if (option) option.onSelect()
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative', minHeight: 58 }}>
      {showMobileOverlay ? (
        <AnimatePresence>
          {isOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,0.2)' }}
            />
          ) : null}
        </AnimatePresence>
      ) : null}

      <motion.button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`flux-filter-dropdown-${id}`}
        aria-label={`Filtre ${label}`}
        onClick={onToggle}
        onKeyDown={onTriggerKeyDown}
        whileHover={{ scale: 1.05 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        style={{
          width: '100%',
          minHeight: 58,
          border: `1px solid ${isOpen ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
          borderRadius: 'var(--radius-md)',
          background: isOpen ? 'var(--primary-50)' : 'var(--neutral-0)',
          color: isOpen ? 'var(--primary-700)' : 'var(--neutral-700)',
          padding: 'var(--space-3) var(--space-4)',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
          boxShadow: isOpen ? 'var(--shadow-md)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
        }}
      >
        <span style={{ display: 'grid', textAlign: 'left', gap: 2 }}>
          <span style={{ fontSize: 'var(--font-size-xs)', opacity: 0.72, fontWeight: 'var(--font-weight-semibold)', textTransform: 'uppercase' }}>{label}</span>
          <span
            style={{
              fontSize: compactValue ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              whiteSpace: 'nowrap',
            }}
          >
            {value}
          </span>
        </span>
        <ChevronDown
          size={16}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform var(--transition-fast)',
            flexShrink: 0,
          }}
        />
      </motion.button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            id={`flux-filter-dropdown-${id}`}
            role="listbox"
            tabIndex={-1}
            ref={menuRef}
            onKeyDown={onMenuKeyDown}
            initial={{ opacity: 0, scaleY: 0.8, scaleX: 0.95, y: -8 }}
            animate={{ opacity: 1, scaleY: 1, scaleX: 1, y: 0 }}
            exit={{ opacity: 0, scaleY: 0.9, scaleX: 0.95, y: -4 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 'calc(100% + var(--space-2))',
              left: 0,
              zIndex: 50,
              background: 'var(--neutral-0)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              padding: 'var(--space-3)',
              width: '100%',
              minWidth: '100%',
              maxWidth: '100%',
              maxHeight: 300,
              overflowY: 'auto',
              transformOrigin: 'top center',
              display: 'grid',
              gap: 'var(--space-2)',
            }}
            className="flux-filter-dropdown-scroll"
          >
            {headerContent ? <div style={{ paddingBottom: 'var(--space-1)' }}>{headerContent}</div> : null}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {options.map((opt, index) => (
                <motion.button
                  key={opt.value}
                  ref={(element) => {
                    optionRefs.current[index] = element
                  }}
                  type="button"
                  role="option"
                  aria-selected={opt.selected}
                  onClick={opt.onSelect}
                  whileHover={{ backgroundColor: 'var(--neutral-50)', color: 'var(--primary-500)' }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  style={{
                    border: 'none',
                    borderLeft: opt.selected ? '3px solid var(--primary-500)' : '3px solid transparent',
                    background: opt.selected ? 'var(--primary-50)' : 'transparent',
                    color: opt.selected ? 'var(--primary-700)' : 'var(--neutral-700)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 'var(--space-2) var(--space-2)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: opt.selected ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    outline: focusedIndex === index ? '1px solid var(--primary-300)' : 'none',
                  }}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  <span>{opt.label}</span>
                  {opt.selected ? <Check size={16} color="var(--primary-500)" /> : null}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export function Flux() {
  const [search, setSearch] = useState('')
  const [flow, setFlow] = useState<FlowFilter>('expense')
  const [period, setPeriod] = useState<PeriodFilter>('month')
  const [periodMode, setPeriodMode] = useState<PeriodMode>('current')

  const [showTypeSheet, setShowTypeSheet] = useState(false)
  const [showPeriodSheet, setShowPeriodSheet] = useState(false)
  const [showCategorySheet, setShowCategorySheet] = useState(false)
  const [showHeaderCategorySheet, setShowHeaderCategorySheet] = useState(false)
  const [showAdvancedSheet, setShowAdvancedSheet] = useState(false)

  const [categoryStage, setCategoryStage] = useState<'parents' | 'children'>('parents')
  const [selectedParentCategoryId, setSelectedParentCategoryId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const [excludeRecurring] = useState(false)
  const [onlyFixed, setOnlyFixed] = useState(false)
  const [onlyJoint, setOnlyJoint] = useState(false)
  const [detailsTxn, setDetailsTxn] = useState<Transaction | null>(null)

  const [draftFlow, setDraftFlow] = useState<FlowFilter>('expense')
  const [draftPeriod, setDraftPeriod] = useState<PeriodFilter>('month')
  const [draftPeriodMode, setDraftPeriodMode] = useState<PeriodMode>('current')
  const [draftOnlyFixed, setDraftOnlyFixed] = useState(false)
  const [draftOnlyJoint, setDraftOnlyJoint] = useState(false)
  const [draftSelectedParentCategoryId, setDraftSelectedParentCategoryId] = useState<string | null>(null)
  const [draftSelectedCategoryId, setDraftSelectedCategoryId] = useState<string | null>(null)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [showPeriodMiniModal, setShowPeriodMiniModal] = useState(false)
  const [quickParamPicker, setQuickParamPicker] = useState<QuickParamPicker>(null)
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(max-width: 768px)').matches
  })

  const categoryFlowType = (showAdvancedSheet ? draftFlow : flow) === 'income' ? 'income' : 'expense'
  const { data: flowCategories } = useCategories(categoryFlowType)

  const rootCategories = useMemo(() => (flowCategories ?? []).filter((c) => c.parent_id === null), [flowCategories])
  const subCategories = useMemo(() => (flowCategories ?? []).filter((c) => c.parent_id !== null), [flowCategories])
  const parentById = useMemo(() => new Map((rootCategories ?? []).map((c) => [c.id, c])), [rootCategories])
  const categoryById = useMemo(() => new Map((flowCategories ?? []).map((c) => [c.id, c])), [flowCategories])

  const range = useMemo(() => periodToRange(period, periodMode), [period, periodMode])
  const flowTypeFilter: FlowType | undefined = flow === 'all' ? undefined : (flow as FlowType)

  const categoryIdsFilter = useMemo(() => {
    if (!selectedCategoryId && !selectedParentCategoryId) return undefined
    if (selectedCategoryId) return [selectedCategoryId]
    const children = subCategories.filter((c) => c.parent_id === selectedParentCategoryId).map((c) => c.id)
    return selectedParentCategoryId ? [selectedParentCategoryId, ...children] : undefined
  }, [selectedCategoryId, selectedParentCategoryId, subCategories])

  const { data: txns, isLoading } = useTransactions({
    ...range,
    flowType: flowTypeFilter,
    categoryIds: categoryIdsFilter,
  })

  const filtered = useMemo(() => {
    let list = (txns ?? []) as Transaction[]

    if (excludeRecurring) list = list.filter((t) => !t.is_recurring)
    if (onlyFixed) list = list.filter((t) => t.budget_behavior === 'fixed')
    if (onlyJoint) list = list.filter((t) => t.account?.name?.toLowerCase().includes('joint') ?? false)

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((t) => displayTxnLabel(t).toLowerCase().includes(q))
    }

    return list
  }, [txns, excludeRecurring, onlyFixed, onlyJoint, search])

  const totalAmount = useMemo(() => filtered.reduce((sum, t) => sum + signedAmount(t), 0), [filtered])

  const typeLabel = FLOW_OPTIONS.find((o) => o.value === flow)?.label ?? 'Depenses'
  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? 'Mois'

  const selectedParent = selectedParentCategoryId ? parentById.get(selectedParentCategoryId) ?? null : null
  const selectedChildren = useMemo(
    () => (selectedParentCategoryId ? subCategories.filter((c) => c.parent_id === selectedParentCategoryId) : []),
    [selectedParentCategoryId, subCategories],
  )

  const draftSelectedParent = draftSelectedParentCategoryId ? parentById.get(draftSelectedParentCategoryId) ?? null : null
  const draftSelectedChildren = useMemo(
    () => (draftSelectedParentCategoryId ? subCategories.filter((c) => c.parent_id === draftSelectedParentCategoryId) : []),
    [draftSelectedParentCategoryId, subCategories],
  )

  useEffect(() => {
    setSelectedParentCategoryId(null)
    setSelectedCategoryId(null)
    setCategoryStage('parents')
  }, [flow])

  useEffect(() => {
    if (!showAdvancedSheet) return
    setDraftSelectedParentCategoryId(null)
    setDraftSelectedCategoryId(null)
    setCategoryStage('parents')
  }, [draftFlow, showAdvancedSheet])

  const anySheetOpen = showTypeSheet || showPeriodSheet || showCategorySheet || showHeaderCategorySheet || showAdvancedSheet

  useEffect(() => {
    if (!anySheetOpen) return
    return lockDocumentScroll()
  }, [anySheetOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(max-width: 768px)')
    const onChange = (event: MediaQueryListEvent) => setIsMobileViewport(event.matches)
    setIsMobileViewport(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setQuickParamPicker(null)
    }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [])

  useEffect(() => {
    if (!showAdvancedSheet && !showCategorySheet && !showHeaderCategorySheet) return
    setQuickParamPicker(null)
  }, [showAdvancedSheet, showCategorySheet, showHeaderCategorySheet])

  const filterSummaryMainLabel = useMemo(() => {
    const endIso = range.endDate ?? todayIso()
    const inferredStart = filtered.length ? filtered[filtered.length - 1].transaction_date : endIso
    const startIso = range.startDate ?? inferredStart
    const start = formatDateLabel(startIso)
    const end = formatDateLabel(endIso)
    const flowPart = flow === 'expense'
      ? 'dépenses'
      : flow === 'income'
        ? 'revenus'
        : flow === 'transfer'
          ? 'transferts internes'
          : 'opérations'
    const budgetPart = onlyFixed ? 'fixes' : 'variables'
    const flowPartCapitalized = flowPart.slice(0, 1).toUpperCase() + flowPart.slice(1)
    return `${flowPartCapitalized} ${budgetPart} du ${start} au ${end}`
  }, [filtered, flow, onlyFixed, range.endDate, range.startDate])
  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategoryId) return categoryById.get(selectedCategoryId)?.name ?? 'Catégorie'
    if (selectedParentCategoryId) return parentById.get(selectedParentCategoryId)?.name ?? 'Catégorie'
    return 'Toutes catégories'
  }, [categoryById, parentById, selectedCategoryId, selectedParentCategoryId])

  const operationsSummaryLabel = useMemo(() => `${filtered.length} ${resultNoun(flow)}`, [filtered.length, flow])
  const cardTypeValue = useMemo(() => {
    if (typeLabel.toLowerCase() === 'depenses') return 'Dépenses'
    return typeLabel
  }, [typeLabel])
  const cardPeriodValue = useMemo(() => {
    if (period === 'month') {
      const nowDate = new Date()
      const month = nowDate.toLocaleDateString('fr-FR', { month: 'long' })
      const year = nowDate.getFullYear()
      return `${month.slice(0, 1).toUpperCase() + month.slice(1)} ${year}`
    }
    if (period === 'day') return 'Jour'
    if (period === 'week') return 'Semaine'
    if (period === 'year') return 'Année'
    return periodLabel
  }, [period, periodLabel])
  const cardBudgetValue = onlyFixed ? 'Budget fixe' : 'Budget variable'
  const cardAccountValue = onlyJoint ? 'Compte joint' : 'Compte perso'
  const isTransferType = flow === 'transfer'

  const draftTypeLabel = FLOW_OPTIONS.find((o) => o.value === draftFlow)?.label ?? 'Depenses'
  const draftPeriodLabel = PERIOD_OPTIONS.find((o) => o.value === draftPeriod)?.label ?? 'Mois'
  const categorySheetInParameters = showAdvancedSheet
  const activeSelectedChildren = categorySheetInParameters ? draftSelectedChildren : selectedChildren
  const activeSelectedParent = categorySheetInParameters ? draftSelectedParent : selectedParent
  const draftCategoryLabel = useMemo(() => {
    if (draftSelectedCategoryId) return categoryById.get(draftSelectedCategoryId)?.name ?? 'Categorie'
    if (draftSelectedParentCategoryId) return parentById.get(draftSelectedParentCategoryId)?.name ?? 'Categorie'
    return 'Toutes categories'
  }, [categoryById, draftSelectedCategoryId, draftSelectedParentCategoryId, parentById])

  const closeQuickPicker = () => {
    setQuickParamPicker(null)
  }

  const applyParameters = () => {
    setFlow(draftFlow)
    setPeriod(draftPeriod)
    setPeriodMode(draftPeriodMode)
    setOnlyFixed(draftOnlyFixed)
    setOnlyJoint(draftOnlyJoint)
    setSelectedParentCategoryId(draftSelectedParentCategoryId)
    setSelectedCategoryId(draftSelectedCategoryId)
    setShowTypeMenu(false)
    setShowPeriodMiniModal(false)
    setShowAdvancedSheet(false)
  }

  const closeParametersModal = () => {
    setShowTypeMenu(false)
    setShowPeriodMiniModal(false)
    setShowAdvancedSheet(false)
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom-offset))' }}>
      <PageHeader
        title="Flux"
        rightLabel={selectedCategoryLabel.toLowerCase()}
        actionIcon={
          selectedCategoryId || selectedParentCategoryId
            ? <CategoryIcon categoryName={selectedCategoryLabel} size={30} fallback="💰" />
            : <Search size={24} />
        }
        actionAriaLabel="Choisir une catégorie"
        onActionClick={() => setShowHeaderCategorySheet((current) => !current)}
      />

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ padding: '0 var(--space-6)' }}
      >
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-3)' }}>
          <p
            style={{
              margin: 0,
              textAlign: 'center',
              fontSize: 'var(--font-size-kpi)',
              fontWeight: 'var(--font-weight-extrabold)',
              lineHeight: 'var(--line-height-tight)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--primary-700)',
            }}
          >
            {filtered.length ? formatMoneyInteger(totalAmount) : formatMoneyInteger(0)}
          </p>

          <div
            style={{
              background: 'var(--viz-c)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4) var(--space-6)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              position: 'relative',
            }}
          >
            <div style={{ width: '100%', display: 'grid', justifyItems: 'center', textAlign: 'center', gap: '2px' }}>
              <p
                style={{
                  margin: 0,
                  width: '100%',
                  fontSize: isTransferType ? 'var(--font-size-xs)' : 'var(--font-size-md)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--neutral-0)',
                  opacity: 0.96,
                  whiteSpace: 'nowrap',
                }}
              >
                {filterSummaryMainLabel}
              </p>
            </div>

            <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div style={{ flex: '1 1 calc(50% - var(--space-3))', minWidth: 152 }}>
                <FilterDropdown
                  id="type"
                  label="Type"
                  value={cardTypeValue}
                  compactValue={isTransferType}
                  isOpen={quickParamPicker === 'type'}
                  showMobileOverlay={isMobileViewport}
                  onToggle={() => setQuickParamPicker((current) => (current === 'type' ? null : 'type'))}
                  onClose={closeQuickPicker}
                  options={FLOW_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                    selected: flow === opt.value,
                    onSelect: () => {
                      setFlow(opt.value)
                      closeQuickPicker()
                    },
                  }))}
                />
              </div>

              <div style={{ flex: '1 1 calc(50% - var(--space-3))', minWidth: 152 }}>
                <FilterDropdown
                  id="period"
                  label="Période"
                  value={cardPeriodValue}
                  isOpen={quickParamPicker === 'period'}
                  showMobileOverlay={isMobileViewport}
                  onToggle={() => setQuickParamPicker((current) => (current === 'period' ? null : 'period'))}
                  onClose={closeQuickPicker}
                  headerContent={(
                    <SegmentedToggle
                      left="Fixe"
                      right="Glissant"
                      value={periodMode === 'current' ? 'left' : 'right'}
                      onChange={(next) => setPeriodMode(next === 'left' ? 'current' : 'rolling')}
                    />
                  )}
                  options={[
                    { value: 'day', label: 'Jour' },
                    { value: 'week', label: 'Semaine' },
                    { value: 'month', label: 'Mois' },
                    { value: 'year', label: 'Année' },
                  ].map((option) => ({
                    value: option.value,
                    label: option.label,
                    selected: period === option.value,
                    onSelect: () => {
                      setPeriod(option.value as PeriodFilter)
                      closeQuickPicker()
                    },
                  }))}
                />
              </div>

              <div style={{ flex: '1 1 calc(50% - var(--space-3))', minWidth: 152 }}>
                <FilterDropdown
                  id="fixed"
                  label="Budget"
                  value={cardBudgetValue}
                  isOpen={quickParamPicker === 'fixed'}
                  showMobileOverlay={isMobileViewport}
                  onToggle={() => setQuickParamPicker((current) => (current === 'fixed' ? null : 'fixed'))}
                  onClose={closeQuickPicker}
                  options={[
                    {
                      value: 'variable',
                      label: 'Variable',
                      selected: !onlyFixed,
                      onSelect: () => {
                        setOnlyFixed(false)
                        closeQuickPicker()
                      },
                    },
                    {
                      value: 'fixed',
                      label: 'Fixe',
                      selected: onlyFixed,
                      onSelect: () => {
                        setOnlyFixed(true)
                        closeQuickPicker()
                      },
                    },
                  ]}
                />
              </div>

              <div style={{ flex: '1 1 calc(50% - var(--space-3))', minWidth: 152 }}>
                <FilterDropdown
                  id="account"
                  label="Compte"
                  value={cardAccountValue}
                  isOpen={quickParamPicker === 'account'}
                  showMobileOverlay={isMobileViewport}
                  onToggle={() => setQuickParamPicker((current) => (current === 'account' ? null : 'account'))}
                  onClose={closeQuickPicker}
                  options={[
                    {
                      value: 'perso',
                      label: 'Compte perso',
                      selected: !onlyJoint,
                      onSelect: () => {
                        setOnlyJoint(false)
                        closeQuickPicker()
                      },
                    },
                    {
                      value: 'joint',
                      label: 'Compte joint',
                      selected: onlyJoint,
                      onSelect: () => {
                        setOnlyJoint(true)
                        closeQuickPicker()
                      },
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <section style={{ padding: '0 var(--space-6)', display: 'grid', gap: 'var(--space-4)' }}>
        <Input
          type="search"
          placeholder="Recherche"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={14} />}
          size="md"
        />
      </section>

      <section>
        <div style={{ padding: '0 var(--space-6)' }}>
          <div
            style={{
              borderBottom: '1px solid var(--neutral-200)',
              paddingBottom: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-600)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {operationsSummaryLabel}
              </span>
            </div>
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: totalAmount > 0 ? 'var(--color-success)' : totalAmount < 0 ? 'var(--color-error)' : 'var(--neutral-700)',
                whiteSpace: 'nowrap',
              }}
            >
              {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div style={{ color: 'var(--neutral-400)', textAlign: 'center', padding: 'var(--space-12)' }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: 'var(--neutral-400)', textAlign: 'center', padding: 'var(--space-12)' }}>
            Aucune operation
          </motion.div>
        ) : (
          <div>
            {filtered.map((t) => {
              const label = displayTxnLabel(t)
              const category = displayTxnCategoryName(t)
              const amount = signedAmount(t)
              const accent = accentFromCategory(category)

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDetailsTxn(t)}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderBottom: '1px solid var(--neutral-200)',
                    background: 'transparent',
                    display: 'grid',
                    gridTemplateColumns: '42px 26px 1fr auto',
                    alignItems: 'center',
                    gap: 8,
                    padding: 'var(--space-3) var(--space-6)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--neutral-50)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-600)', whiteSpace: 'nowrap' }}>
                    {formatDateLabel(t.transaction_date)}
                  </span>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      background: accent,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--neutral-0)',
                      fontSize: 8,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {category.slice(0, 1)}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 400,
                      color: 'var(--neutral-700)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 400,
                      fontFamily: 'var(--font-mono)',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      color: amount > 0 ? 'var(--color-success)' : amount < 0 ? 'var(--color-error)' : 'var(--neutral-700)',
                    }}
                  >
                    {formatCurrency(amount)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <Sheet open={showTypeSheet} title="Type" onClose={() => setShowTypeSheet(false)}>
        <div style={{ display: 'grid', gap: 8 }}>
          {FLOW_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={flow === opt.value ? 'secondary' : 'outline'}
              size="md"
              onClick={() => {
                setFlow(opt.value)
                setShowTypeSheet(false)
              }}
              className="w-full justify-start"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </Sheet>

      <Sheet open={showPeriodSheet} title="Periode" onClose={() => setShowPeriodSheet(false)}>
        <div style={{ display: 'grid', gap: 8 }}>
          {PERIOD_OPTIONS.map((opt) => {
            const supportsMode = ['week', 'month', 'quarter', 'year'].includes(opt.value)
            return (
              <div
                key={opt.value}
                style={{
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 'var(--radius-xl)',
                  background: period === opt.value ? 'var(--primary-50)' : 'var(--neutral-0)',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setPeriod(opt.value)
                    setShowPeriodSheet(false)
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 800,
                    color: 'var(--neutral-900)',
                    padding: 0,
                  }}
                >
                  {opt.label}
                </button>
                {supportsMode ? (
                  <SegmentedToggle
                    left="En cours"
                    right="Glissant"
                    value={periodMode === 'current' ? 'left' : 'right'}
                    onChange={(next) => setPeriodMode(next === 'left' ? 'current' : 'rolling')}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      </Sheet>

      <AnimatePresence>
        {showHeaderCategorySheet ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHeaderCategorySheet(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Sélectionner une catégorie"
              initial={{ y: '-100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 330 }}
              style={{
                position: 'fixed',
                left: 0,
                right: 0,
                top: 0,
                zIndex: 61,
                width: '100%',
                maxWidth: 420,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: '0 0 var(--radius-2xl) var(--radius-2xl)',
                padding: 'calc(var(--safe-top-offset) + var(--space-2)) var(--space-6) var(--space-6)',
                maxHeight: '78dvh',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 'var(--radius-full)', margin: '2px auto var(--space-4)', background: 'var(--neutral-300)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-900)' }}>Categorie</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowHeaderCategorySheet(false)} className="h-11 w-11 rounded-full bg-[var(--neutral-100)] px-0">
                  <ChevronDown size={16} />
                </Button>
              </div>

              <div style={{ overflowY: 'auto' }}>
                <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
                  {rootCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedParentCategoryId(cat.id)
                        setSelectedCategoryId(null)
                        setShowHeaderCategorySheet(false)
                      }}
                      style={{
                        border: '1px solid var(--neutral-200)',
                        background: 'var(--neutral-0)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '10px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <CategoryIcon categoryName={cat.name} size={30} fallback={null} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-700)', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.name}</span>
                    </button>
                  ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedParentCategoryId(null)
                        setSelectedCategoryId(null)
                        setShowHeaderCategorySheet(false)
                      }}
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
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-700)' }}>Toutes</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showCategorySheet ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCategorySheet(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 330 }}
              style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 121,
                width: '100%',
                maxWidth: 420,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: '20px 20px 0 0',
                padding: '12px var(--space-6) calc(var(--space-6) + var(--safe-bottom-offset))',
                maxHeight: 'calc(100dvh - 12px)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, margin: '4px auto 12px', background: 'var(--neutral-200)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {categoryStage === 'children' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCategoryStage('parents')
                        if (categorySheetInParameters) setDraftSelectedCategoryId(null)
                        else setSelectedCategoryId(null)
                      }}
                      className="h-11 w-11 rounded-full bg-[var(--neutral-100)] px-0"
                    >
                      <ArrowLeft size={16} />
                    </Button>
                  ) : null}
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-900)' }}>Categorie</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowCategorySheet(false)} className="h-11 w-11 rounded-full bg-[var(--neutral-100)] px-0">
                  <ChevronDown size={16} />
                </Button>
              </div>

              <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' as CSSProperties['WebkitOverflowScrolling'] }}>
                {categoryStage === 'parents' ? (
                  <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
                      {rootCategories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            if (categorySheetInParameters) {
                              setDraftSelectedParentCategoryId(cat.id)
                              setDraftSelectedCategoryId(null)
                            } else {
                              setSelectedParentCategoryId(cat.id)
                              setSelectedCategoryId(null)
                            }
                            setCategoryStage('children')
                          }}
                          style={{
                            border: '1px solid var(--neutral-200)',
                            background: 'var(--neutral-0)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '10px 8px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 6,
                            cursor: 'pointer',
                          }}
                        >
                          <CategoryIcon categoryName={cat.name} size={30} fallback={null} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-700)', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.name}</span>
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (categorySheetInParameters) {
                            setDraftSelectedParentCategoryId(null)
                            setDraftSelectedCategoryId(null)
                          } else {
                            setSelectedParentCategoryId(null)
                            setSelectedCategoryId(null)
                          }
                          setShowCategorySheet(false)
                        }}
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
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-700)' }}>Toutes</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
                      {activeSelectedChildren.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            if (categorySheetInParameters) setDraftSelectedCategoryId(sub.id)
                            else setSelectedCategoryId(sub.id)
                            setShowCategorySheet(false)
                          }}
                          style={{
                            border: '1px solid var(--neutral-200)',
                            background: 'var(--neutral-0)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '10px 8px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 6,
                            cursor: 'pointer',
                          }}
                        >
                          <CategoryIcon categoryName={activeSelectedParent?.name ?? sub.name} size={30} fallback={null} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-700)', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub.name}</span>
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (categorySheetInParameters) setDraftSelectedCategoryId(null)
                          else setSelectedCategoryId(null)
                          setShowCategorySheet(false)
                        }}
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
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--neutral-100)', display: 'grid', placeItems: 'center' }}>↺</div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-700)' }}>Toutes</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showAdvancedSheet ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeParametersModal}
              style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(13,13,31,0.52)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Paramètres de recherche"
              initial={{ y: '-100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              style={{
                position: 'fixed',
                left: 0,
                right: 0,
                top: 0,
                zIndex: 81,
                width: '100%',
                maxWidth: 430,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: '0 0 var(--radius-2xl) var(--radius-2xl)',
                padding: 'calc(var(--safe-top-offset) + var(--space-2)) var(--space-6) var(--space-6)',
                maxHeight: '78dvh',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
                display: 'grid',
                gridTemplateRows: 'auto 1fr auto',
                gap: 'var(--space-4)',
              }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 'var(--radius-full)', margin: '2px auto 2px', background: 'var(--neutral-300)' }} />

              <div style={{ overflowY: 'auto', display: 'grid', alignContent: 'start', gap: 'var(--space-4)' }}>
                <div style={{ display: 'grid', justifyItems: 'center', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    onClick={() => setShowCategorySheet(true)}
                    aria-label="Choisir une catégorie"
                    style={{
                      width: 92,
                      height: 92,
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--neutral-200)',
                      background: 'var(--neutral-50)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    {draftCategoryLabel === 'Toutes categories'
                      ? <CategoryIcon categoryName="Toutes catégories" size={50} fallback="💰" />
                      : <CategoryIcon categoryName={draftCategoryLabel} size={50} fallback="💰" />}
                  </button>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {draftCategoryLabel}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 'var(--space-3)' }}>
                  <div style={{ position: 'relative', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', background: 'var(--neutral-50)' }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Type</p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPeriodMiniModal(false)
                        setShowTypeMenu((current) => !current)
                      }}
                      style={{
                        marginTop: 'var(--space-2)',
                        width: '100%',
                        border: '1px solid var(--neutral-200)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--neutral-0)',
                        color: 'var(--neutral-800)',
                        fontSize: 13,
                        fontWeight: 700,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                    >
                      <span>{draftTypeLabel}</span>
                      <ChevronDown size={14} />
                    </button>
                    <AnimatePresence>
                      {showTypeMenu ? (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% - 4px)',
                            left: 0,
                            right: 0,
                            zIndex: 2,
                            border: '1px solid var(--neutral-200)',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--neutral-0)',
                            boxShadow: 'var(--shadow-md)',
                            overflow: 'hidden',
                          }}
                        >
                          {FLOW_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setDraftFlow(opt.value)
                                setShowTypeMenu(false)
                              }}
                              style={{
                                width: '100%',
                                border: 'none',
                                background: draftFlow === opt.value ? 'var(--primary-50)' : 'var(--neutral-0)',
                                color: draftFlow === opt.value ? 'var(--primary-700)' : 'var(--neutral-700)',
                                fontSize: 13,
                                fontWeight: 700,
                                textAlign: 'left',
                                padding: '10px 12px',
                                cursor: 'pointer',
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>

                  <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', background: 'var(--neutral-50)' }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Période</p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTypeMenu(false)
                        setShowPeriodMiniModal(true)
                      }}
                      style={{
                        marginTop: 'var(--space-2)',
                        width: '100%',
                        border: '1px solid var(--neutral-200)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--neutral-0)',
                        color: 'var(--neutral-800)',
                        fontSize: 13,
                        fontWeight: 700,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                    >
                      <span>{draftPeriodLabel}</span>
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', background: 'var(--neutral-50)' }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Fixe / variable</p>
                    <div style={{ marginTop: 'var(--space-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-700)' }}>{draftOnlyFixed ? 'Fixe' : 'Variable'}</span>
                      <Switch value={draftOnlyFixed} onChange={setDraftOnlyFixed} />
                    </div>
                  </div>

                  <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', background: 'var(--neutral-50)' }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Compte</p>
                    <div style={{ marginTop: 'var(--space-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-700)' }}>{draftOnlyJoint ? 'Joint' : 'Perso'}</span>
                      <Switch value={draftOnlyJoint} onChange={setDraftOnlyJoint} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={applyParameters}
                  style={{
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--primary-500)',
                    color: 'var(--neutral-0)',
                    fontSize: 13,
                    fontWeight: 800,
                    padding: '10px 18px',
                    cursor: 'pointer',
                  }}
                >
                  Appliquer
                </button>
              </div>

              <AnimatePresence>
                {showPeriodMiniModal ? (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowPeriodMiniModal(false)}
                      style={{ position: 'absolute', inset: 0, zIndex: 3, background: 'rgba(13,13,31,0.24)' }}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      style={{
                        position: 'absolute',
                        left: 'var(--space-4)',
                        right: 'var(--space-4)',
                        top: '40%',
                        zIndex: 4,
                        borderRadius: 'var(--radius-xl)',
                        border: '1px solid var(--neutral-200)',
                        background: 'var(--neutral-0)',
                        boxShadow: 'var(--shadow-lg)',
                        padding: 'var(--space-4)',
                        display: 'grid',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <SegmentedToggle
                          left="Fixe"
                          right="Glissant"
                          value={draftPeriodMode === 'current' ? 'left' : 'right'}
                          onChange={(next) => setDraftPeriodMode(next === 'left' ? 'current' : 'rolling')}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 'var(--space-2)' }}>
                        {[
                          { value: 'day', label: 'Jour' },
                          { value: 'week', label: 'Semaine' },
                          { value: 'month', label: 'Mois' },
                          { value: 'year', label: 'Année' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setDraftPeriod(option.value as PeriodFilter)
                              setShowPeriodMiniModal(false)
                            }}
                            style={{
                              border: '1px solid var(--neutral-200)',
                              borderRadius: 'var(--radius-md)',
                              background: draftPeriod === option.value ? 'var(--primary-50)' : 'var(--neutral-0)',
                              color: draftPeriod === option.value ? 'var(--primary-700)' : 'var(--neutral-700)',
                              fontSize: 12,
                              fontWeight: 700,
                              padding: '9px 6px',
                              cursor: 'pointer',
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <style>{`
        .flux-filter-dropdown-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--neutral-300) var(--neutral-100);
        }
        .flux-filter-dropdown-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .flux-filter-dropdown-scroll::-webkit-scrollbar-track {
          background: var(--neutral-100);
          border-radius: var(--radius-pill);
        }
        .flux-filter-dropdown-scroll::-webkit-scrollbar-thumb {
          background: var(--neutral-300);
          border-radius: var(--radius-pill);
        }
      `}</style>

      <TransactionDetailsModal
        transaction={detailsTxn}
        categories={flowCategories ?? []}
        transactionList={filtered}
        onNavigate={setDetailsTxn}
        onClose={() => setDetailsTxn(null)}
      />
    </div>
  )
}
