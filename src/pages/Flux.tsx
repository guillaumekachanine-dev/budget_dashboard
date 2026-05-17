import { useEffect, useMemo, useRef, useState, useDeferredValue, Fragment } from 'react'
import type { CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ArrowLeft, Search, Check, ArrowUp } from 'lucide-react'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { useAuth } from '@/hooks/useAuth'
import { usePlannedOperationsForFlow } from '@/hooks/usePlannedOperations'
import { formatCurrency, getTxLabel, todayIso } from '@/lib/utils'
import { Button, Input } from '@/components'
import { PageHeader } from '@/components/layout/PageHeader'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { TransactionDetailsModal } from '@/components/modals/TransactionDetailsModal'
import { AddPlannedOperationModal } from '@/components/modals/AddPlannedOperationModal'
import categoriesHeaderIcon from '@/assets/icons/app/categories1.webp'
import type {
  FlowType,
  PlannedOperationFlowItem,
  Transaction,
} from '@/lib/types'
import { lockDocumentScroll } from '@/lib/scrollLock'
import planifierOperationIcon from '@/assets/icons/app/planifier_operation.webp'

type FlowFilter = 'all' | 'income' | 'expense' | 'transfer' | 'savings' | 'planned'
type PeriodFilter = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all'
type PeriodMode = 'current' | 'rolling' | 'future'
type QuickParamPicker = 'type' | 'period' | 'modalite' | 'fixed' | 'account' | null
type PlannedModalityFilter = 'all' | 'done' | 'upcoming'

const HEADER_CATEGORY_ORDER = [
  'alimentation',
  'achats-divers',
  'sorties',
  'famille-enfant',
  'logement',
  'business',
  'transport',
  'voyages',
  'sante',
  'abonnements',
  'taxes-frais',
] as const

function normalizeCategoryName(value?: string | null): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function headerCategoryOrderKey(name: string): string | null {
  const normalized = normalizeCategoryName(name)
  if (normalized.includes('alimentation')) return 'alimentation'
  if (normalized.includes('achats') && normalized.includes('divers')) return 'achats-divers'
  if (normalized.includes('sorties')) return 'sorties'
  if (normalized.includes('famille') && normalized.includes('enfant')) return 'famille-enfant'
  if (normalized.includes('logement')) return 'logement'
  if (normalized.includes('business')) return 'business'
  if (normalized.includes('transport')) return 'transport'
  if (normalized.includes('voyages')) return 'voyages'
  if (normalized.includes('sante')) return 'sante'
  if (normalized.includes('abonn')) return 'abonnements'
  if ((normalized.includes('taxes') && normalized.includes('frais')) || (normalized.includes('frais') && normalized.includes('impot'))) {
    return 'taxes-frais'
  }
  return null
}

function headerCategoryLabel(name: string): string {
  const key = headerCategoryOrderKey(name)
  if (key === 'famille-enfant') return 'Famille/enfant'
  if (key === 'abonnements') return 'Abonn.'
  if (key === 'taxes-frais') return 'Taxes/frais'
  return name
}

function capitalizeFirst(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return value
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`
}

const FRENCH_MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function formatMonthLabel(dateKey: string): string {
  const year = parseInt(dateKey.slice(0, 4), 10)
  const month = parseInt(dateKey.slice(5, 7), 10) - 1
  return `${FRENCH_MONTHS[month]} ${year}`
}

const FLOW_OPTIONS: Array<{ value: FlowFilter; label: string; hasSeparator?: boolean }> = [
  { value: 'all', label: 'Toutes' },
  { value: 'planned', label: 'Planifiées', hasSeparator: true },
  { value: 'expense', label: 'Dépenses' },
  { value: 'income', label: 'Revenus' },
  { value: 'transfer', label: 'Transferts' },
  { value: 'savings', label: 'Épargne' },
]

const PERIOD_OPTIONS: Array<{ value: PeriodFilter; label: string }> = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Annee' },
  { value: 'all', label: 'Tout' },
]

function startOfIsoDay(d: Date): string {
  const dt = new Date(d)
  dt.setHours(0, 0, 0, 0)
  return dt.toISOString().slice(0, 10)
}

function startOfIsoMonth(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function endOfIsoMonth(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
}

function startOfIsoQuarter(d: Date): string {
  const qMonth = Math.floor(d.getMonth() / 3) * 3
  return new Date(d.getFullYear(), qMonth, 1).toISOString().slice(0, 10)
}

function startOfIsoYear(d: Date): string {
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10)
}

function endOfIsoYear(d: Date): string {
  return new Date(d.getFullYear(), 11, 31).toISOString().slice(0, 10)
}

function periodToRange(period: PeriodFilter, mode: PeriodMode): { startDate?: string; endDate?: string } {
  const now = new Date()

  if (mode === 'future') {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const start = startOfIsoDay(tomorrow)
    
    switch (period) {
      case 'day': return { startDate: start, endDate: start }
      case 'week': {
        const end = new Date(tomorrow)
        end.setDate(tomorrow.getDate() + 6)
        return { startDate: start, endDate: startOfIsoDay(end) }
      }
      case 'month': {
        const end = new Date(tomorrow)
        end.setDate(tomorrow.getDate() + 29)
        return { startDate: start, endDate: startOfIsoDay(end) }
      }
      case 'quarter': {
        const end = new Date(tomorrow)
        end.setDate(tomorrow.getDate() + 89)
        return { startDate: start, endDate: startOfIsoDay(end) }
      }
      case 'year': {
        const end = new Date(tomorrow)
        end.setDate(tomorrow.getDate() + 364)
        return { startDate: start, endDate: startOfIsoDay(end) }
      }
      case 'all': return {}
    }
  }

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

function formatMoneyNoDecimals(amount: number): string {
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
  }).format(Math.round(amount))
}

function resultNoun(flow: FlowFilter): string {
  if (flow === 'expense') return 'dépenses'
  if (flow === 'income') return 'revenus'
  if (flow === 'transfer') return 'transferts internes'
  if (flow === 'planned') return 'opérations planifiées'
  return 'opérations'
}

function getTodayDateKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toDateKey(value?: string | null): string {
  if (!value) return ''
  return value.slice(0, 10)
}

function signedPlannedAmount(item: PlannedOperationFlowItem): number {
  const raw = Number(item.planned_personal_amount) || 0
  const absolute = Math.abs(raw)
  const flow = item.flow_type

  if (flow === 'income') return absolute
  if (flow === 'transfer') return 0
  if (flow === 'expense' || flow === 'savings') {
    return -absolute
  }

  return raw
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

type FilterDropdownOption = {
  value: string
  label: string
  hasSeparator?: boolean
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
  heroTone = false,
  fitContent = false,
  hideLabel = false,
  largeValue = false,
  disabled = false,
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
  heroTone?: boolean
  fitContent?: boolean
  hideLabel?: boolean
  largeValue?: boolean
  disabled?: boolean
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
      if (disabled) return
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
    <div ref={wrapperRef} style={{ position: 'relative', minHeight: heroTone ? 34 : 58 }}>
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
        onClick={disabled ? undefined : onToggle}
        onKeyDown={onTriggerKeyDown}
        disabled={disabled}
        whileHover={heroTone ? undefined : { scale: 1.05 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        style={{
          width: '100%',
          minHeight: heroTone ? 34 : 58,
          border: heroTone
            ? 'none'
            : `1px solid ${isOpen ? 'var(--primary-500)' : 'var(--neutral-200)'}`,
          borderRadius: heroTone ? 0 : 'var(--radius-md)',
          background: heroTone
            ? 'transparent'
            : (isOpen ? 'var(--primary-50)' : 'var(--neutral-0)'),
          color: heroTone
            ? 'var(--neutral-0)'
            : (isOpen ? 'var(--primary-700)' : 'var(--neutral-700)'),
          padding: heroTone ? 0 : 'var(--space-3) var(--space-4)',
          cursor: 'pointer',
          opacity: disabled ? 0.55 : 1,
          transition: 'all var(--transition-fast)',
          boxShadow: heroTone ? 'none' : (isOpen ? 'var(--shadow-md)' : 'none'),
          display: 'grid',
          gap: heroTone ? 2 : 'var(--space-2)',
          justifyItems: 'start',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'grid', textAlign: 'left', gap: 2, minWidth: 0 }}>
          {!hideLabel && (
            <span
              style={{
                fontSize: heroTone ? 9 : 'var(--font-size-xs)',
                opacity: heroTone ? 0.68 : 0.72,
                color: heroTone ? 'rgba(255,255,255,0.88)' : 'inherit',
                fontWeight: 'var(--font-weight-semibold)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {label}
              <ChevronDown
                size={12}
                style={{
                  transform: isOpen && !disabled ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform var(--transition-fast)',
                  color: heroTone ? 'rgba(255,255,255,0.88)' : 'inherit',
                  flexShrink: 0,
                }}
              />
            </span>
          )}
          <span
            style={{
              fontSize: hideLabel
                ? (heroTone ? 14 : 'var(--font-size-sm)')
                : (heroTone ? (largeValue ? 14 : 13) : (compactValue ? 'var(--font-size-xs)' : 'var(--font-size-sm)')),
              fontWeight: heroTone ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
              fontFamily: heroTone ? 'var(--font-mono)' : 'inherit',
              color: heroTone ? 'var(--neutral-0)' : 'inherit',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {value}
              {hideLabel && (
                <ChevronDown
                  size={12}
                  style={{
                    transform: isOpen && !disabled ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform var(--transition-fast)',
                    color: heroTone ? 'rgba(255,255,255,0.88)' : 'inherit',
                    flexShrink: 0,
                }}
              />
            )}
          </span>
        </span>
      </motion.button>

      <AnimatePresence>
        {isOpen && !disabled ? (
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
              zIndex: 220,
              background: 'var(--neutral-0)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              padding: 'var(--space-3)',
              width: fitContent ? 'max-content' : '100%',
              minWidth: fitContent ? 132 : '100%',
              maxWidth: fitContent ? 260 : '100%',
              maxHeight: 300,
              overflowY: 'auto',
              transformOrigin: 'top center',
              display: 'grid',
              gap: 'var(--space-2)',
            }}
            className="flux-filter-dropdown-scroll"
          >
            {headerContent ? <div style={{ paddingBottom: 'var(--space-1)' }}>{headerContent}</div> : null}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {options.map((opt, index) => (
                <Fragment key={opt.value}>
                  <motion.button
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
                      padding: '6px 8px',
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
                  {opt.hasSeparator && (
                    <div style={{ height: 1, background: 'var(--neutral-200)', margin: '4px 0' }} />
                  )}
                </Fragment>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export function Flux() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  // useDeferredValue defers the expensive filteredTransactions recomputation until
  // the browser is idle — keeps the input responsive on every keystroke
  const deferredSearch = useDeferredValue(search)
  const [showSearchInput, setShowSearchInput] = useState(false)
  const [flow, setFlow] = useState<FlowFilter>('all')
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
  const [budgetFilter, setBudgetFilter] = useState<'all' | 'fixed' | 'variable'>('all')
  const [accountFilter, setAccountFilter] = useState<'all' | 'joint' | 'perso'>('all')
  const [detailsTxn, setDetailsTxn] = useState<Transaction | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  const [draftFlow, setDraftFlow] = useState<FlowFilter>('all')
  const [draftPeriod, setDraftPeriod] = useState<PeriodFilter>('month')
  const [draftPeriodMode, setDraftPeriodMode] = useState<PeriodMode>('current')
  const [draftBudgetFilter, setDraftBudgetFilter] = useState<'all' | 'fixed' | 'variable'>('all')
  const [draftAccountFilter, setDraftAccountFilter] = useState<'all' | 'joint' | 'perso'>('all')
  const [draftSelectedParentCategoryId, setDraftSelectedParentCategoryId] = useState<string | null>(null)
  const [draftSelectedCategoryId, setDraftSelectedCategoryId] = useState<string | null>(null)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [showPeriodMiniModal, setShowPeriodMiniModal] = useState(false)
  const [quickParamPicker, setQuickParamPicker] = useState<QuickParamPicker>(null)
  const [showPlannedOperationModal, setShowPlannedOperationModal] = useState(false)
  const [plannedModalityFilter, setPlannedModalityFilter] = useState<PlannedModalityFilter>('all')
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(max-width: 768px)').matches
  })

  const activeFlowTypeForCategory = showAdvancedSheet ? draftFlow : flow
  const categoryFlowType = activeFlowTypeForCategory === 'income'
    ? 'income'
    : activeFlowTypeForCategory === 'savings'
      ? 'savings'
      : 'expense'
  const { data: flowCategories } = useCategories(categoryFlowType)

  const rootCategories = useMemo(() => (flowCategories ?? []).filter((c) => c.parent_id === null), [flowCategories])
  const subCategories = useMemo(() => (flowCategories ?? []).filter((c) => c.parent_id !== null), [flowCategories])
  const parentById = useMemo(() => new Map((rootCategories ?? []).map((c) => [c.id, c])), [rootCategories])
  const categoryById = useMemo(() => new Map((flowCategories ?? []).map((c) => [c.id, c])), [flowCategories])
  const orderedHeaderRootCategories = useMemo(() => {
    const byOrderKey = new Map<string, (typeof rootCategories)[number]>()
    for (const category of rootCategories) {
      const key = headerCategoryOrderKey(category.name)
      if (key && !byOrderKey.has(key)) byOrderKey.set(key, category)
    }
    return HEADER_CATEGORY_ORDER
      .map((key) => byOrderKey.get(key) ?? null)
      .filter((category): category is (typeof rootCategories)[number] => category !== null)
  }, [rootCategories])

  const isPlannedMode = flow === 'planned'
  const isSavingsMode = flow === 'savings'
  const todayDateKey = getTodayDateKey()
  const range = useMemo(() => periodToRange(period, periodMode), [period, periodMode])
  const flowTypeFilter: FlowType | undefined = flow === 'all' || flow === 'planned' ? undefined : (flow as FlowType)

  const categoryIdsFilter = useMemo(() => {
    if (!selectedCategoryId && !selectedParentCategoryId) return undefined
    if (selectedCategoryId) return [selectedCategoryId]
    const children = subCategories.filter((c) => c.parent_id === selectedParentCategoryId).map((c) => c.id)
    return selectedParentCategoryId ? [selectedParentCategoryId, ...children] : undefined
  }, [selectedCategoryId, selectedParentCategoryId, subCategories])

  const { data: txns, isLoading: isTransactionsLoading } = useTransactions({
    ...range,
    flowType: flowTypeFilter,
    categoryIds: categoryIdsFilter,
  }, {
    enabled: !isPlannedMode,
  })

  const plannedModeStartDate = useMemo(() => {
    const now = new Date()
    return period === 'year' ? startOfIsoYear(now) : startOfIsoMonth(now)
  }, [period])
  const plannedModeEndDate = useMemo(() => {
    const now = new Date()
    return period === 'year' ? endOfIsoYear(now) : endOfIsoMonth(now)
  }, [period])

  const generalModePlannedStartDate = useMemo(() => startOfIsoMonth(new Date()), [])
  const generalModePlannedEndDate = useMemo(() => {
    const now = new Date()
    const monthEnd = endOfIsoMonth(now)
    if (isSavingsMode) return monthEnd
    return monthEnd < todayDateKey ? monthEnd : todayDateKey
  }, [isSavingsMode, todayDateKey])

  const isGeneralMonthView = !isPlannedMode && period === 'month' && periodMode === 'current'

  const {
    data: plannedGeneralDoneOperations = [],
    isLoading: isGeneralPlannedLoading,
    error: generalPlannedError,
  } = usePlannedOperationsForFlow({
    userId: user?.id,
    startDate: generalModePlannedStartDate,
    endDate: generalModePlannedEndDate,
    includePast: true,
    includeFuture: isSavingsMode,
    flowType: isSavingsMode ? 'savings' : 'all',
    categoryIds: categoryIdsFilter,
    enabled: isGeneralMonthView,
    mode: 'general',
    ascending: false,
  })

  const {
    data: plannedModeOperations = [],
    isLoading: isPlannedModeLoading,
    error: plannedModeError,
  } = usePlannedOperationsForFlow({
    userId: user?.id,
    startDate: plannedModeStartDate,
    endDate: plannedModeEndDate,
    includePast: true,
    includeFuture: true,
    flowType: 'all',
    categoryIds: categoryIdsFilter,
    enabled: isPlannedMode,
    mode: 'planned',
    ascending: true,
  })

  const filteredTransactions = useMemo(() => {
    let list = (txns ?? []) as Transaction[]

    if (excludeRecurring) list = list.filter((t) => !t.is_recurring)
    if (budgetFilter === 'fixed') list = list.filter((t) => t.budget_behavior === 'fixed')
    if (budgetFilter === 'variable') list = list.filter((t) => t.budget_behavior === 'variable' || t.budget_behavior === null)
    if (accountFilter === 'joint') list = list.filter((t) => t.account?.name?.toLowerCase().includes('joint') ?? false)
    if (accountFilter === 'perso') list = list.filter((t) => !(t.account?.name?.toLowerCase().includes('joint') ?? false))

    if (deferredSearch.trim()) {
      const q = deferredSearch.trim().toLowerCase()
      list = list.filter((t) => getTxLabel(t).toLowerCase().includes(q))
    }

    return list
  }, [txns, excludeRecurring, budgetFilter, accountFilter, deferredSearch])

  const generalPlannedRows = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    return plannedGeneralDoneOperations.filter((operation) => {
      if (!q) return true
      const text = (operation.label ?? operation.category_name ?? '').toLowerCase()
      return text.includes(q)
    })
  }, [plannedGeneralDoneOperations, deferredSearch])

  const plannedOperationsForList = useMemo(() => {
    let list = plannedModeOperations

    if (plannedModalityFilter === 'done') list = list.filter((operation) => operation.planned_status === 'done')
    if (plannedModalityFilter === 'upcoming') list = list.filter((operation) => operation.planned_status === 'upcoming')

    if (deferredSearch.trim()) {
      const q = deferredSearch.trim().toLowerCase()
      list = list.filter((operation) => {
        const text = `${operation.label ?? ''} ${operation.category_name ?? ''}`.toLowerCase()
        return text.includes(q)
      })
    }

    return [...list].sort((a, b) => toDateKey(a.planned_date).localeCompare(toDateKey(b.planned_date)))
  }, [plannedModeOperations, plannedModalityFilter, deferredSearch])

  const plannedDoneSection = useMemo(
    () => plannedOperationsForList.filter((operation) => operation.planned_status === 'done'),
    [plannedOperationsForList],
  )
  const plannedUpcomingSection = useMemo(
    () => plannedOperationsForList.filter((operation) => operation.planned_status === 'upcoming'),
    [plannedOperationsForList],
  )

  const plannedDoneTotal = useMemo(
    () => plannedModeOperations.filter((operation) => operation.planned_status === 'done').reduce((sum, operation) => sum + signedPlannedAmount(operation), 0),
    [plannedModeOperations],
  )
  const plannedUpcomingTotal = useMemo(
    () => plannedModeOperations.filter((operation) => operation.planned_status === 'upcoming').reduce((sum, operation) => sum + signedPlannedAmount(operation), 0),
    [plannedModeOperations],
  )
  const plannedTotal = plannedDoneTotal + plannedUpcomingTotal

  const generalMergedRows = useMemo(() => {
    type TimelineRow =
      | { source: 'transaction'; id: string; dateKey: string; transaction: Transaction }
      | { source: 'planned_operation'; id: string; dateKey: string; planned: PlannedOperationFlowItem }

    const transactionRows: TimelineRow[] = filteredTransactions.map((transaction) => ({
      source: 'transaction',
      id: transaction.id,
      dateKey: toDateKey(transaction.transaction_date),
      transaction,
    }))

    const plannedRows: TimelineRow[] = generalPlannedRows.map((planned) => ({
      source: 'planned_operation',
      id: `planned-${planned.id}`,
      dateKey: toDateKey(planned.planned_date),
      planned,
    }))

    return [...transactionRows, ...plannedRows].sort((a, b) => b.dateKey.localeCompare(a.dateKey))
  }, [filteredTransactions, generalPlannedRows])

  const generalTotalAmount = useMemo(() => {
    const transactionsSum = filteredTransactions.reduce((sum, transaction) => sum + signedAmount(transaction), 0)
    const plannedSum = generalPlannedRows.reduce((sum, operation) => sum + signedPlannedAmount(operation), 0)
    return transactionsSum + plannedSum
  }, [filteredTransactions, generalPlannedRows])

  const heroMainAmount = isPlannedMode ? plannedDoneTotal : generalTotalAmount
  const listHeaderAmount = isPlannedMode ? plannedTotal : generalTotalAmount
  const operationsSummaryCount = isPlannedMode ? plannedOperationsForList.length : generalMergedRows.length
  const isListLoading = isPlannedMode ? isPlannedModeLoading : isTransactionsLoading
  const plannedLoadError = isPlannedMode ? plannedModeError : generalPlannedError
  const renderPlannedDate = (date: string, tone: 'default' | 'done' | 'upcoming' = 'default') => (
    <span
      style={{
        position: 'relative',
        fontSize: 12,
        fontWeight: 700,
        color:
          tone === 'done'
            ? 'var(--color-success)'
            : tone === 'upcoming'
              ? 'var(--primary-700)'
              : 'var(--neutral-600)',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: -2,
          bottom: -2,
          left: -6,
          right: -3,
          border:
            tone === 'done'
              ? '1px solid color-mix(in oklab, var(--color-success) 44%, var(--neutral-200) 56%)'
              : tone === 'upcoming'
                ? '1px solid color-mix(in oklab, var(--primary-500) 34%, var(--neutral-200) 66%)'
                : '1px solid color-mix(in oklab, var(--primary-400) 28%, var(--neutral-300) 72%)',
          borderRadius: 'var(--radius-pill)',
          pointerEvents: 'none',
        }}
      />
      <span style={{ position: 'relative', zIndex: 1 }}>{formatDateLabel(date)}</span>
    </span>
  )

  useEffect(() => {
    if (detailsTxn) {
      const updated = filteredTransactions.find((t) => t.id === detailsTxn.id)
      if (updated && updated !== detailsTxn) {
        setDetailsTxn(updated)
      }
    }
  }, [filteredTransactions, detailsTxn])

  const typeLabel = FLOW_OPTIONS.find((o) => o.value === flow)?.label ?? 'Depenses'
  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? 'Mois'

  const selectedChildren = useMemo(
    () => (selectedParentCategoryId ? subCategories.filter((c) => c.parent_id === selectedParentCategoryId) : []),
    [selectedParentCategoryId, subCategories],
  )

  const draftSelectedChildren = useMemo(
    () => (draftSelectedParentCategoryId ? subCategories.filter((c) => c.parent_id === draftSelectedParentCategoryId) : []),
    [draftSelectedParentCategoryId, subCategories],
  )

  useEffect(() => {
    setSelectedParentCategoryId(null)
    setSelectedCategoryId(null)
    setCategoryStage('parents')
    if (flow === 'planned') {
      setPlannedModalityFilter('all')
    }
  }, [flow])

  useEffect(() => {
    if (flow !== 'planned') return
    if (period === 'month' || period === 'year') return
    setPeriod('month')
  }, [flow, period])

  useEffect(() => {
    if (isPlannedMode) return
    if (periodMode === 'future') {
      setPeriodMode('current')
    }
  }, [isPlannedMode, periodMode])

  useEffect(() => {
    if (!isPlannedMode) return
    if (quickParamPicker === 'fixed' || quickParamPicker === 'account') {
      setQuickParamPicker(null)
    }
  }, [isPlannedMode, quickParamPicker])

  useEffect(() => {
    if (!showAdvancedSheet) return
    setDraftSelectedParentCategoryId(null)
    setDraftSelectedCategoryId(null)
    setCategoryStage('parents')
  }, [draftFlow, showAdvancedSheet])

  useEffect(() => {
    if (draftFlow !== 'planned') return
    if (draftPeriod !== 'month' && draftPeriod !== 'year') {
      setDraftPeriod('month')
    }
    if (draftPeriodMode !== 'current') {
      setDraftPeriodMode('current')
    }
  }, [draftFlow, draftPeriod, draftPeriodMode])

  const anySheetOpen = showTypeSheet || showPeriodSheet || showCategorySheet || showHeaderCategorySheet || showAdvancedSheet

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 220)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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

  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategoryId) return categoryById.get(selectedCategoryId)?.name ?? 'Catégorie'
    if (selectedParentCategoryId) return parentById.get(selectedParentCategoryId)?.name ?? 'Catégorie'
    return 'Toutes catégories'
  }, [categoryById, parentById, selectedCategoryId, selectedParentCategoryId])
  const selectedCategoryHeaderLabel = useMemo(
    () => capitalizeFirst(selectedCategoryLabel),
    [selectedCategoryLabel],
  )
  const selectedCategoryIconKey = useMemo(() => {
    if (selectedCategoryId) return categoryById.get(selectedCategoryId)?.icon_key ?? null
    if (selectedParentCategoryId) return parentById.get(selectedParentCategoryId)?.icon_key ?? null
    return null
  }, [categoryById, parentById, selectedCategoryId, selectedParentCategoryId])

  const operationsSummaryLabel = useMemo(
    () => `${operationsSummaryCount} ${resultNoun(flow)}`,
    [operationsSummaryCount, flow],
  )
  const cardTypeValue = useMemo(() => {
    if (typeLabel.toLowerCase() === 'depenses') return 'Dépenses'
    return typeLabel
  }, [typeLabel])
  const cardPeriodValue = useMemo(() => {
    if (period === 'day') return 'Jour'
    if (period === 'week') return 'Semaine'
    if (period === 'month') return 'Mois'
    if (period === 'year') {
      const endIso = range.endDate ?? todayIso()
      const year = new Date(endIso + 'T00:00:00').getFullYear()
      return Number.isFinite(year) ? String(year) : String(new Date().getFullYear())
    }
    return periodLabel === 'Annee' ? String(new Date().getFullYear()) : periodLabel
  }, [period, periodLabel, range.endDate])
  const cardBudgetValue = budgetFilter === 'all' ? 'Tout' : (budgetFilter === 'fixed' ? 'Fixe' : 'Variable')
  const cardAccountValue = accountFilter === 'all' ? 'Tout' : (accountFilter === 'joint' ? 'Joint' : 'Perso')
  const isTransferType = flow === 'transfer'
  const selectedPeriodHeader = useMemo(() => {
    if (isPlannedMode) {
      return {
        startLabel: formatDateLabel(plannedModeStartDate),
        endLabel: formatDateLabel(plannedModeEndDate),
        text: `Du ${formatDateLabel(plannedModeStartDate)} au ${formatDateLabel(plannedModeEndDate)}`,
      }
    }

    const endIso = range.endDate ?? (filteredTransactions.length ? filteredTransactions[0].transaction_date : todayIso())
    const inferredStart = filteredTransactions.length ? filteredTransactions[filteredTransactions.length - 1].transaction_date : endIso
    const startIso = range.startDate ?? inferredStart

    return {
      startLabel: formatDateLabel(startIso),
      endLabel: formatDateLabel(endIso),
      text: `Du ${formatDateLabel(startIso)} au ${formatDateLabel(endIso)}`,
    }
  }, [isPlannedMode, plannedModeEndDate, plannedModeStartDate, range.endDate, range.startDate, filteredTransactions])

  const draftTypeLabel = FLOW_OPTIONS.find((o) => o.value === draftFlow)?.label ?? 'Depenses'
  const draftPeriodLabel = PERIOD_OPTIONS.find((o) => o.value === draftPeriod)?.label ?? 'Mois'
  const categorySheetInParameters = showAdvancedSheet
  const activeSelectedChildren = categorySheetInParameters ? draftSelectedChildren : selectedChildren
  const draftCategoryLabel = useMemo(() => {
    if (draftSelectedCategoryId) return categoryById.get(draftSelectedCategoryId)?.name ?? 'Categorie'
    if (draftSelectedParentCategoryId) return parentById.get(draftSelectedParentCategoryId)?.name ?? 'Categorie'
    return 'Toutes categories'
  }, [categoryById, draftSelectedCategoryId, draftSelectedParentCategoryId, parentById])
  const draftCategoryIconKey = useMemo(() => {
    if (draftSelectedCategoryId) return categoryById.get(draftSelectedCategoryId)?.icon_key ?? null
    if (draftSelectedParentCategoryId) return parentById.get(draftSelectedParentCategoryId)?.icon_key ?? null
    return null
  }, [categoryById, draftSelectedCategoryId, draftSelectedParentCategoryId, parentById])

  const closeQuickPicker = () => {
    setQuickParamPicker(null)
  }

  const applyParameters = () => {
    setFlow(draftFlow)
    setPeriod(draftPeriod)
    setPeriodMode(draftPeriodMode)
    setBudgetFilter(draftBudgetFilter)
    setAccountFilter(draftAccountFilter)
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <PageHeader
        title="Flux"
        rightSlot={(
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-size-md)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'color-mix(in oklab, var(--neutral-0) 94%, var(--primary-100) 6%)',
              whiteSpace: 'nowrap',
              textTransform: 'none',
            }}
          >
            {selectedCategoryHeaderLabel}
          </p>
        )}
        contentOffsetY={3}
        actionIcon={
          selectedCategoryId || selectedParentCategoryId
            ? <CategoryIcon iconKey={selectedCategoryIconKey} label={selectedCategoryLabel} size={30} />
            : <img src={categoriesHeaderIcon} alt="" width={30} height={30} style={{ display: 'block', objectFit: 'contain' }} aria-hidden="true" />
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
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, color-mix(in oklab, var(--color-warning) 88%, #000 12%) 0%, color-mix(in oklab, var(--color-warning) 70%, #000 30%) 58%, color-mix(in oklab, var(--color-warning) 52%, #000 48%) 100%)',
              borderRadius: 'var(--radius-2xl)',
              padding: 'var(--space-5)',
              boxShadow: 'var(--shadow-card)',
              position: 'relative',
              overflow: 'visible',
            }}
          >
            <span style={{ position: 'absolute', right: -8, top: -12, fontSize: 88, fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.06)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none', letterSpacing: '-0.04em' }}>
              FLUX
            </span>

            {!isPlannedMode ? (
              <button
                type="button"
                aria-label="Planifier une opération"
                title="Planifier une opération"
                onClick={() => setShowPlannedOperationModal(true)}
                style={{
                  position: 'absolute',
                  top: 'var(--space-2)',
                  right: 'var(--space-2)',
                  border: 'none',
                  background: 'transparent',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  width: 68,
                  height: 68,
                  zIndex: 2,
                }}
              >
                <img
                  src={planifierOperationIcon}
                  alt=""
                  width={64}
                  height={64}
                  loading="lazy"
                  decoding="async"
                  style={{ display: 'block', objectFit: 'contain' }}
                  aria-hidden="true"
                />
              </button>
            ) : null}

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                {selectedPeriodHeader.text}
              </p>
            </div>

            {isPlannedMode ? (
              <div style={{ margin: '2px 0 0', minHeight: 50, display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '100%', display: 'inline-flex', alignItems: 'baseline', justifyContent: 'center', gap: 'clamp(30px, 12vw, 88px)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 20, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'rgba(204,255,228,0.95)', lineHeight: 1.05 }}>
                      {formatMoneyNoDecimals(plannedDoneTotal)}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.76)', lineHeight: 1 }}>
                      passées
                    </span>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.76)', lineHeight: 1 }}>
                      À venir
                    </span>
                    <span style={{ fontSize: 20, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'rgba(224,230,255,0.96)', lineHeight: 1.05 }}>
                      {formatMoneyNoDecimals(plannedUpcomingTotal)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ margin: '2px 0 0', fontSize: 'clamp(28px, 8vw, 40px)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-0)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                {formatMoneyInteger(heroMainAmount)}
              </p>
            )}

            <div style={{ marginTop: 0 }}>
              <div style={{ display: 'inline-flex' }}>
                <FilterDropdown
                  id="type"
                  label="Type"
                  value={cardTypeValue}
                  compactValue={isTransferType}
                  isOpen={quickParamPicker === 'type'}
                  showMobileOverlay={isMobileViewport}
                  onToggle={() => setQuickParamPicker((current) => (current === 'type' ? null : 'type'))}
                  onClose={closeQuickPicker}
                  heroTone
                  fitContent
                  hideLabel
                  largeValue
                  options={FLOW_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                    hasSeparator: opt.hasSeparator || opt.value === 'all',
                    selected: flow === opt.value,
                    onSelect: () => {
                      setFlow(opt.value)
                      closeQuickPicker()
                    },
                  }))}
                />
              </div>
            </div>

            <div style={{ margin: 'var(--space-4) 0 var(--space-3)', height: 1, background: 'rgba(255,255,255,0.16)' }} />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isPlannedMode ? 'max-content max-content 1fr auto' : 'repeat(4, minmax(0, 1fr))',
                gap: 'var(--space-3)',
                alignItems: 'end',
              }}
            >
                <div>
                  <FilterDropdown
                    id="period"
                    label="Période"
                    value={cardPeriodValue}
                    isOpen={quickParamPicker === 'period'}
                    showMobileOverlay={isMobileViewport}
                    onToggle={() => setQuickParamPicker((current) => (current === 'period' ? null : 'period'))}
                    onClose={closeQuickPicker}
                    heroTone
                    fitContent
                    options={(isPlannedMode
                      ? [
                          { value: 'month', label: 'Mois' },
                          { value: 'year', label: 'Année' },
                        ]
                      : [
                          { value: 'all', label: 'Toute', hasSeparator: true },
                          { value: 'day', label: 'Jour' },
                          { value: 'week', label: 'Semaine' },
                          { value: 'month', label: 'Mois' },
                          { value: 'year', label: 'Année' },
                        ]).map((option) => ({
                      value: option.value,
                      label: option.label,
                      hasSeparator: 'hasSeparator' in option ? option.hasSeparator : false,
                      selected: period === option.value,
                      onSelect: () => {
                        setPeriod(option.value as PeriodFilter)
                        closeQuickPicker()
                      },
                    }))}
                  />
                </div>

                <div>
                  <FilterDropdown
                    id="modalite"
                    label={isPlannedMode ? 'Statut' : 'Modalité'}
                    value={isPlannedMode
                      ? (plannedModalityFilter === 'done' ? 'Passées' : plannedModalityFilter === 'upcoming' ? 'À venir' : 'Toutes')
                      : (periodMode === 'rolling' ? 'Glissant' : 'Fixe')}
                    isOpen={quickParamPicker === 'modalite'}
                    showMobileOverlay={isMobileViewport}
                    onToggle={() => setQuickParamPicker((current) => (current === 'modalite' ? null : 'modalite'))}
                    onClose={closeQuickPicker}
                    heroTone
                    fitContent
                    options={isPlannedMode
                      ? [
                          {
                            value: 'all',
                            label: 'Toutes',
                            hasSeparator: true,
                            selected: plannedModalityFilter === 'all',
                            onSelect: () => {
                              setPlannedModalityFilter('all')
                              closeQuickPicker()
                            },
                          },
                          {
                            value: 'done',
                            label: 'Passées',
                            selected: plannedModalityFilter === 'done',
                            onSelect: () => {
                              setPlannedModalityFilter('done')
                              closeQuickPicker()
                            },
                          },
                          {
                            value: 'upcoming',
                            label: 'À venir',
                            selected: plannedModalityFilter === 'upcoming',
                            onSelect: () => {
                              setPlannedModalityFilter('upcoming')
                              closeQuickPicker()
                            },
                          },
                        ]
                      : [
                          {
                            value: 'current',
                            label: 'Fixe',
                            selected: periodMode === 'current',
                            onSelect: () => {
                              setPeriodMode('current')
                              closeQuickPicker()
                            },
                          },
                          {
                            value: 'rolling',
                            label: 'Glissant',
                            selected: periodMode === 'rolling',
                            onSelect: () => {
                              setPeriodMode('rolling')
                              closeQuickPicker()
                            },
                          },
                        ]}
                  />
                </div>

                {!isPlannedMode ? (
                  <div>
                    <FilterDropdown
                      id="fixed"
                      label="Budget"
                      value={cardBudgetValue}
                      isOpen={quickParamPicker === 'fixed'}
                      showMobileOverlay={isMobileViewport}
                      onToggle={() => setQuickParamPicker((current) => (current === 'fixed' ? null : 'fixed'))}
                      onClose={closeQuickPicker}
                      heroTone
                      fitContent
                      options={[
                        {
                          value: 'all',
                          label: 'Tout',
                          hasSeparator: true,
                          selected: budgetFilter === 'all',
                          onSelect: () => {
                            setBudgetFilter('all')
                            closeQuickPicker()
                          },
                        },
                        {
                          value: 'variable',
                          label: 'Variable',
                          selected: budgetFilter === 'variable',
                          onSelect: () => {
                            setBudgetFilter('variable')
                            closeQuickPicker()
                          },
                        },
                        {
                          value: 'fixed',
                          label: 'Fixe',
                          selected: budgetFilter === 'fixed',
                          onSelect: () => {
                            setBudgetFilter('fixed')
                            closeQuickPicker()
                          },
                        },
                      ]}
                    />
                  </div>
                ) : null}

                {!isPlannedMode ? (
                  <div>
                    <FilterDropdown
                      id="account"
                      label="Compte"
                      value={cardAccountValue}
                      isOpen={quickParamPicker === 'account'}
                      showMobileOverlay={isMobileViewport}
                      onToggle={() => setQuickParamPicker((current) => (current === 'account' ? null : 'account'))}
                      onClose={closeQuickPicker}
                      heroTone
                      fitContent
                      options={[
                        {
                          value: 'all',
                          label: 'Tout',
                          hasSeparator: true,
                          selected: accountFilter === 'all',
                          onSelect: () => {
                            setAccountFilter('all')
                            closeQuickPicker()
                          },
                        },
                        {
                          value: 'perso',
                          label: 'Perso',
                          selected: accountFilter === 'perso',
                          onSelect: () => {
                            setAccountFilter('perso')
                            closeQuickPicker()
                          },
                        },
                        {
                          value: 'joint',
                          label: 'Joint',
                          selected: accountFilter === 'joint',
                          onSelect: () => {
                            setAccountFilter('joint')
                            closeQuickPicker()
                          },
                        },
                      ]}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label="Ajouter opération planifiée"
                    title="Ajouter opération planifiée"
                    onClick={() => setShowPlannedOperationModal(true)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0,
                      width: 56,
                      height: 56,
                      justifySelf: 'end',
                    }}
                  >
                    <img
                      src={planifierOperationIcon}
                      alt=""
                      width={54}
                      height={54}
                      loading="lazy"
                      decoding="async"
                      style={{ display: 'block', objectFit: 'contain' }}
                      aria-hidden="true"
                    />
                  </button>
                )}

            </div>
          </div>
        </div>
      </motion.section>

      <section>
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'var(--neutral-0)',
              borderBottom: '1px solid var(--neutral-200)',
              padding: 'var(--space-3) var(--space-6) 10px',
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
              <button
                type="button"
                aria-label={showSearchInput ? 'Masquer la recherche' : 'Afficher la recherche'}
                onClick={() => {
                  setShowSearchInput((current) => {
                    if (current) setSearch('')
                    return !current
                  })
                }}
                style={{
                  border: '1px solid var(--neutral-200)',
                  background: showSearchInput ? 'var(--neutral-100)' : 'var(--neutral-0)',
                  width: 24,
                  height: 24,
                  borderRadius: 'var(--radius-full)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--neutral-700)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Search size={12} />
              </button>
            </div>
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: listHeaderAmount > 0 ? 'var(--color-success)' : listHeaderAmount < 0 ? 'var(--color-error)' : 'var(--neutral-700)',
                whiteSpace: 'nowrap',
              }}
            >
              {formatCurrency(listHeaderAmount)}
            </span>
          </div>

        {showSearchInput ? (
          <div style={{ padding: 'var(--space-3) var(--space-6) 0' }}>
            <Input
              type="search"
              placeholder="Recherche"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search size={14} />}
              size="md"
              autoFocus
            />
          </div>
        ) : null}

        {isListLoading ? (
          <div style={{ color: 'var(--neutral-400)', textAlign: 'center', padding: 'var(--space-12)' }}>Chargement…</div>
        ) : isPlannedMode && plannedLoadError ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: 'var(--neutral-500)', textAlign: 'center', padding: 'var(--space-12)' }}>
            Impossible de charger les opérations planifiées.
          </motion.div>
        ) : isPlannedMode ? (
          plannedOperationsForList.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: 'var(--neutral-400)', textAlign: 'center', padding: 'var(--space-12)' }}>
              Aucune opération planifiée sur cette période.
            </motion.div>
          ) : (
            <div style={{ display: 'grid' }}>
              {plannedDoneSection.length > 0 ? (
                <div style={{ borderBottom: plannedUpcomingSection.length > 0 ? '1px solid var(--neutral-150)' : 'none' }}>
                  <div style={{ padding: 'var(--space-3) var(--space-6) var(--space-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Effectuées
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-600)' }}>
                      {plannedDoneSection.length}
                    </span>
                  </div>
                  {plannedDoneSection.map((operation) => {
                    const amount = signedPlannedAmount(operation)
                    return (
                      <div
                        key={`planned-done-${operation.id}`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '42px 1fr auto',
                          alignItems: 'center',
                          gap: 8,
                          padding: '7px var(--space-6)',
                        }}
                      >
                        {renderPlannedDate(operation.planned_date, 'done')}
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: 'var(--neutral-700)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {operation.label ?? operation.category_name ?? 'Opération planifiée'}
                        </span>
                        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              fontFamily: 'var(--font-mono)',
                              textAlign: 'right',
                              whiteSpace: 'nowrap',
                              color: amount > 0 ? 'var(--color-success)' : amount < 0 ? 'var(--color-error)' : 'var(--neutral-700)',
                            }}
                          >
                            {formatCurrency(amount)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {plannedUpcomingSection.length > 0 ? (
                <div>
                  <div style={{ padding: 'var(--space-3) var(--space-6) var(--space-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary-600)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      À venir
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-600)' }}>
                      {plannedUpcomingSection.length}
                    </span>
                  </div>
                  {plannedUpcomingSection.map((operation) => {
                    const amount = signedPlannedAmount(operation)
                    return (
                      <div
                        key={`planned-upcoming-${operation.id}`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '42px 1fr auto',
                          alignItems: 'center',
                          gap: 8,
                          padding: '7px var(--space-6)',
                          opacity: 0.84,
                          background: 'color-mix(in oklab, var(--primary-50) 28%, var(--neutral-0) 72%)',
                        }}
                      >
                        {renderPlannedDate(operation.planned_date, 'upcoming')}
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: 'var(--neutral-700)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {operation.label ?? operation.category_name ?? 'Opération planifiée'}
                        </span>
                        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              fontFamily: 'var(--font-mono)',
                              textAlign: 'right',
                              whiteSpace: 'nowrap',
                              color: amount > 0 ? 'var(--color-success)' : amount < 0 ? 'var(--color-error)' : 'var(--neutral-700)',
                            }}
                          >
                            {formatCurrency(amount)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        ) : generalMergedRows.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: 'var(--neutral-400)', textAlign: 'center', padding: 'var(--space-12)' }}>
            Aucune operation
          </motion.div>
        ) : (
          <div>
            {generalMergedRows.map((row, index) => {
              const prevRow = index > 0 ? generalMergedRows[index - 1] : null
              const prevKey = prevRow?.dateKey ?? null
              const curYear = row.dateKey.slice(0, 4)
              const curMonth = row.dateKey.slice(0, 7)
              const prevYear = prevKey?.slice(0, 4) ?? null
              const prevMonth = prevKey?.slice(0, 7) ?? null
              const yearChanged = prevYear !== null && prevYear !== curYear
              const monthChanged = prevMonth !== null && prevMonth !== curMonth
              const hasSeparator = yearChanged || monthChanged

              const separators = (
                <>
                  {yearChanged && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px var(--space-6) 3px',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 13,
                          fontWeight: 700,
                          color: 'var(--neutral-600)',
                          letterSpacing: '0.06em',
                          fontFamily: 'var(--font-mono)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span style={{ fontSize: 12, color: 'var(--neutral-500)', lineHeight: 1 }}>▶</span>
                        {curYear}
                      </span>
                      <div style={{ flex: 1, height: 1.5, background: 'var(--neutral-400)' }} />
                    </div>
                  )}
                  {monthChanged && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: yearChanged ? '2px var(--space-6) 3px' : '10px var(--space-6) 3px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--neutral-500)',
                          letterSpacing: '0.01em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatMonthLabel(row.dateKey)}
                      </span>
                      <div style={{ flex: 1, height: 1, background: 'var(--neutral-300)' }} />
                    </div>
                  )}
                </>
              )

              if (row.source === 'transaction') {
                const transaction = row.transaction
                const label = getTxLabel(transaction)
                const category = displayTxnCategoryName(transaction)
                const amount = signedAmount(transaction)
                const isJoint = transaction.account?.name?.toLowerCase().includes('joint') ?? false

                return (
                  <Fragment key={row.id}>
                    {separators}
                    <button
                      type="button"
                      onClick={() => setDetailsTxn(transaction)}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        display: 'grid',
                        gridTemplateColumns: '42px 26px 1fr auto',
                        alignItems: 'center',
                        gap: 8,
                        padding: hasSeparator ? '9px var(--space-6) 7px' : '7px var(--space-6)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background-color var(--transition-fast)',
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.backgroundColor = 'var(--neutral-50)'
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: isJoint ? '#C9A26A' : 'var(--neutral-600)', whiteSpace: 'nowrap' }}>
                        {formatDateLabel(transaction.transaction_date)}
                      </span>
                      <span style={{
                        width: 26, height: 26,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <CategoryIcon iconKey={transaction.category?.icon_key ?? null} label={category} size={24} />
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
                  </Fragment>
                )
              }

              const planned = row.planned
              const amount = signedPlannedAmount(planned)
              const categoryName = planned.category_name ?? planned.parent_category_name ?? 'Planifiée'
              const iconKey = planned.category_id ? categoryById.get(planned.category_id)?.icon_key ?? null : null

              return (
                <Fragment key={row.id}>
                  {separators}
                  <div
                    style={{
                      width: '100%',
                      background: 'transparent',
                      display: 'grid',
                      gridTemplateColumns: '42px 26px 1fr auto',
                      alignItems: 'center',
                      gap: 8,
                      padding: hasSeparator ? '9px var(--space-6) 7px' : '7px var(--space-6)',
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-600)', whiteSpace: 'nowrap' }}>
                      {formatDateLabel(planned.planned_date)}
                    </span>
                    <span style={{
                      width: 26, height: 26,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <img src={planifierOperationIcon} alt="" style={{ width: 24, height: 24, objectFit: 'contain', transform: 'scale(2)' }} />
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
                      {planned.label ?? categoryName}
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
                  </div>
                </Fragment>
              )
            })}
            {!isPlannedMode && isGeneralPlannedLoading ? (
              <div
                style={{
                  padding: 'var(--space-3) var(--space-6)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--neutral-500)',
                  borderBottom: '1px solid var(--neutral-200)',
                  background: 'var(--neutral-50)',
                }}
              >
                Chargement des opérations planifiées…
              </div>
            ) : null}
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
          {(isPlannedMode
            ? PERIOD_OPTIONS.filter((opt) => opt.value === 'month' || opt.value === 'year')
            : PERIOD_OPTIONS).map((opt) => {
            const supportsMode = !isPlannedMode && ['week', 'month', 'quarter', 'year'].includes(opt.value)
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
                left: 'var(--space-3)',
                right: 'var(--space-3)',
                top: 0,
                zIndex: 61,
                width: 'auto',
                maxWidth: 420,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: '0 0 var(--radius-2xl) var(--radius-2xl)',
                padding: 'calc(var(--safe-top-offset) + var(--space-2)) var(--space-5) var(--space-5)',
                maxHeight: '72dvh',
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
                <div style={{ display: 'grid' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 'var(--space-2) var(--space-2)' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedParentCategoryId(null)
                        setSelectedCategoryId(null)
                        setShowHeaderCategorySheet(false)
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: '5px 4px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer',
                      }}
                    >
                      <CategoryIcon iconKey="toutes_categories" label="Toutes catégories" size={32} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-700)', maxWidth: '100%', lineHeight: 1.08, textAlign: 'center' }}>Toutes</span>
                    </button>
                    {orderedHeaderRootCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedParentCategoryId(cat.id)
                        setSelectedCategoryId(null)
                        setShowHeaderCategorySheet(false)
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: '5px 4px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer',
                      }}
                    >
                      <CategoryIcon iconKey={cat.icon_key} label={cat.name} size={32} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-700)', maxWidth: '100%', whiteSpace: 'normal', lineHeight: 1.08, textAlign: 'center' }}>{headerCategoryLabel(cat.name)}</span>
                    </button>
                    ))}
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
                          <CategoryIcon iconKey={cat.icon_key} label={cat.name} size={30} />
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
                          <CategoryIcon iconKey="toutes_categories" label="Toutes catégories" size={24} />
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
                          <CategoryIcon iconKey={sub.icon_key} label={sub.name} size={30} />
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
                      ? <CategoryIcon iconKey="toutes_categories" label="Toutes catégories" size={50} />
                      : <CategoryIcon iconKey={draftCategoryIconKey} label={draftCategoryLabel} size={50} />}
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

                    <div
                      style={{
                        border: '1px solid var(--neutral-200)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-3)',
                        background: 'var(--neutral-50)',
                        opacity: draftFlow === 'planned' ? 0.45 : 1,
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Fixe / variable</p>
                      <div style={{ marginTop: 'var(--space-2)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                        {(['all', 'variable', 'fixed'] as const).map(val => {
                          const label = val === 'all' ? 'Tout' : (val === 'fixed' ? 'Fixe' : 'Variable');
                          const isSelected = draftBudgetFilter === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => {
                                if (draftFlow === 'planned') return
                                setDraftBudgetFilter(val)
                              }}
                              disabled={draftFlow === 'planned'}
                              style={{
                                padding: '6px 0',
                                fontSize: 11,
                                fontWeight: 700,
                                background: isSelected ? 'var(--primary-500)' : '#fff',
                                color: isSelected ? '#fff' : 'var(--neutral-700)',
                                border: isSelected ? '1px solid var(--primary-500)' : '1px solid var(--neutral-200)',
                                borderRadius: 'var(--radius-sm)',
                                cursor: draftFlow === 'planned' ? 'default' : 'pointer'
                              }}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div
                      style={{
                        border: '1px solid var(--neutral-200)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-3)',
                        background: 'var(--neutral-50)',
                        opacity: draftFlow === 'planned' ? 0.45 : 1,
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Compte</p>
                      <div style={{ marginTop: 'var(--space-2)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                        {(['all', 'perso', 'joint'] as const).map(val => {
                          const label = val === 'all' ? 'Tout' : (val === 'joint' ? 'Joint' : 'Perso');
                          const isSelected = draftAccountFilter === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => {
                                if (draftFlow === 'planned') return
                                setDraftAccountFilter(val)
                              }}
                              disabled={draftFlow === 'planned'}
                              style={{
                                padding: '6px 0',
                                fontSize: 11,
                                fontWeight: 700,
                                background: isSelected ? 'var(--primary-500)' : '#fff',
                                color: isSelected ? '#fff' : 'var(--neutral-700)',
                                border: isSelected ? '1px solid var(--primary-500)' : '1px solid var(--neutral-200)',
                                borderRadius: 'var(--radius-sm)',
                                cursor: draftFlow === 'planned' ? 'default' : 'pointer'
                              }}
                            >
                              {label}
                            </button>
                          )
                      })}
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
                      {draftFlow !== 'planned' ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <SegmentedToggle
                            left="Fixe"
                            right="Glissant"
                            value={draftPeriodMode === 'current' ? 'left' : 'right'}
                            onChange={(next) => setDraftPeriodMode(next === 'left' ? 'current' : 'rolling')}
                          />
                        </div>
                      ) : null}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 'var(--space-2)' }}>
                        {(draftFlow === 'planned'
                          ? [
                              { value: 'month', label: 'Mois' },
                              { value: 'year', label: 'Année' },
                            ]
                          : [
                              { value: 'day', label: 'Jour' },
                              { value: 'week', label: 'Semaine' },
                              { value: 'month', label: 'Mois' },
                              { value: 'year', label: 'Année' },
                            ]).map((option) => (
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
        transactionList={filteredTransactions}
        onNavigate={setDetailsTxn}
        onClose={() => setDetailsTxn(null)}
        showEditControls={true}
      />

      <AddPlannedOperationModal
        open={showPlannedOperationModal}
        onClose={() => setShowPlannedOperationModal(false)}
      />

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            key="scroll-top"
            type="button"
            aria-label="Revenir en haut"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.12, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              position: 'fixed',
              bottom: 'calc(var(--nav-height) + 16px)',
              right: 16,
              zIndex: 200,
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: 'var(--primary-600)',
              color: 'var(--neutral-0)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(91,87,245,0.35)',
              cursor: 'pointer',
            }}
            whileTap={{ scale: 0.9 }}
          >
            <ArrowUp size={20} strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
