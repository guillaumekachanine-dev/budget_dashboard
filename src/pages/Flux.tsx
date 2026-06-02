import { useEffect, useMemo, useState, useDeferredValue, useCallback, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Search, ArrowUp, Settings2, X, RotateCcw, Repeat, Plus } from 'lucide-react'
import { useFluxOperations, type FluxOperation } from '@/hooks/useFluxOperations'
import { useCategories } from '@/hooks/useCategories'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency, formatCurrencyRounded } from '@/lib/utils'
import { Button, Input } from '@/components'
import { PageHeader } from '@/components/layout/PageHeader'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { TransactionDetailsModal } from '@/components/modals/TransactionDetailsModal'
import { AddPlannedOperationModal } from '@/components/modals/AddPlannedOperationModal'
import { PlannedOperationDetailsModal } from '@/components/modals/PlannedOperationDetailsModal'
import fluxActuelIcon from '@/assets/icons/app/flux_actuel.webp'
import type {
  FlowType,
  Transaction,
} from '@/lib/types'
import { lockDocumentScroll } from '@/lib/scrollLock'
type FlowFilter = 'all' | 'income' | 'expense' | 'transfer' | 'savings' | 'planned'
type PeriodFilter = 'day' | 'week' | 'month' | 'year_2026' | 'year_2025' | 'all'

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
  { value: 'expense', label: 'Dépenses' },
  { value: 'income', label: 'Revenus' },
  { value: 'savings', label: 'Epargne' },
  { value: 'transfer', label: 'Transferts' },
]

const PERIOD_OPTIONS: Array<{ value: PeriodFilter; label: string }> = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year_2026', label: '2026' },
  { value: 'year_2025', label: '2025' },
  { value: 'all', label: 'Toutes' },
]



function startOfIsoDay(d: Date): string {
  // Important: do not use toISOString() for business calendar filters.
  // UTC conversion can shift local midnight to the previous day.
  return toLocalIsoDate(d)
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayIso(): string {
  return toLocalIsoDate(new Date())
}

function startOfIsoYear(d: Date): string {
  return toLocalIsoDate(new Date(d.getFullYear(), 0, 1))
}

function endOfIsoYear(d: Date): string {
  return toLocalIsoDate(new Date(d.getFullYear(), 11, 31))
}

function startOfIsoWeek(d: Date): string {
  const dt = new Date(d)
  const day = dt.getDay() === 0 ? 6 : dt.getDay() - 1
  dt.setDate(dt.getDate() - day)
  return toLocalIsoDate(dt)
}

function endOfIsoWeek(d: Date): string {
  const dt = new Date(d)
  const day = dt.getDay() === 0 ? 6 : dt.getDay() - 1
  dt.setDate(dt.getDate() + (6 - day))
  return toLocalIsoDate(dt)
}

function startOfIsoMonth(d: Date): string {
  return toLocalIsoDate(new Date(d.getFullYear(), d.getMonth(), 1))
}

function endOfIsoMonth(d: Date): string {
  return toLocalIsoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

function periodToRange(period: PeriodFilter): { startDate?: string; endDate?: string } {
  const now = new Date()

  switch (period) {
    case 'day': {
      const start = startOfIsoDay(now)
      return { startDate: start, endDate: todayIso() }
    }
    case 'week': {
      return { startDate: startOfIsoWeek(now), endDate: endOfIsoWeek(now) }
    }
    case 'month': {
      return { startDate: startOfIsoMonth(now), endDate: endOfIsoMonth(now) }
    }
    case 'year_2026':
      return {
        startDate: startOfIsoYear(new Date(2026, 0, 1)),
        endDate: endOfIsoYear(new Date(2026, 0, 1)),
      }
    case 'year_2025':
      return {
        startDate: startOfIsoYear(new Date(2025, 0, 1)),
        endDate: endOfIsoYear(new Date(2025, 0, 1)),
      }
    case 'all':
      return {}
    default: {
      return {}
    }
  }
}

function periodToFullRange(period: PeriodFilter): { startDate?: string; endDate?: string } {
  const now = new Date()

  switch (period) {
    case 'day': {
      const today = startOfIsoDay(now)
      return { startDate: today, endDate: today }
    }
    case 'week': {
      return { startDate: startOfIsoWeek(now), endDate: endOfIsoWeek(now) }
    }
    case 'month': {
      return { startDate: startOfIsoMonth(now), endDate: endOfIsoMonth(now) }
    }
    case 'year_2026':
      return {
        startDate: startOfIsoYear(new Date(2026, 0, 1)),
        endDate: endOfIsoYear(new Date(2026, 0, 1)),
      }
    case 'year_2025':
      return {
        startDate: startOfIsoYear(new Date(2025, 0, 1)),
        endDate: endOfIsoYear(new Date(2025, 0, 1)),
      }
    case 'all':
      return {}
    default:
      return {}
  }
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

function resultNoun(flow: FlowFilter): string {
  if (flow === 'expense') return 'dépenses'
  if (flow === 'income') return 'revenus'
  if (flow === 'transfer') return 'transferts internes'
  if (flow === 'planned') return 'opérations récurrentes'
  return 'opérations'
}

function toDateKey(value?: string | null): string {
  if (!value) return ''
  return value.slice(0, 10)
}

function isPastOrToday(isoDate: string, today: string): boolean {
  return isoDate <= today
}

function isRealizedFluxOperation(operation: FluxOperation, today: string): boolean {
  const isPast = isPastOrToday(operation.operation_date, today)
  if (!isPast) return false

  if (operation.operation_kind === 'actual') {
    return operation.is_matched === false
  }

  if (operation.operation_kind === 'planned_occurrence') {
    return operation.is_matched === true
  }

  return false
}

function isFutureFixedPlannedOperation(operation: FluxOperation, today: string): boolean {
  return (
    operation.operation_kind === 'planned_occurrence'
    && operation.is_matched === false
    && operation.operation_date > today
    && operation.budget_behavior === 'fixed'
  )
}

// ─── Module-level style constants ────────────────────────────────────────────
// Created once at module load; each transaction row references the same object
// instead of allocating a new one per render (avoids 300-600 allocs per redraw).

/** Static style for the category icon slot in every row */
const TX_ROW_ICON_STYLE: React.CSSProperties = {
  width: 26,
  height: 26,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

/** Static style for the label/description slot in every row */
const TX_ROW_LABEL_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 400,
  color: 'var(--neutral-700)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

/** Static base for the planned-row amount span (color set inline) */
const TX_ROW_AMOUNT_BASE: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 400,
  fontFamily: 'var(--font-mono)',
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

/** Static base for date text (color set inline for joint accounts) */
const TX_ROW_DATE_BASE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: 'nowrap',
}

// ─────────────────────────────────────────────────────────────────────────────

export function Flux() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  // useDeferredValue keeps typing responsive while server-state query params update.
  const deferredSearch = useDeferredValue(search)
  const [showSearchInput, setShowSearchInput] = useState(false)
  const [flow, setFlow] = useState<FlowFilter>('expense')
  const [period, setPeriod] = useState<PeriodFilter>('month')

  const [showHeaderCategorySheet, setShowHeaderCategorySheet] = useState(false)
  const [showAdvancedSheet, setShowAdvancedSheet] = useState(false)

  const [selectedParentCategoryId, setSelectedParentCategoryId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const [excludeRecurring] = useState(false)
  const [accountFilter, setAccountFilter] = useState<'all' | 'joint' | 'perso'>('all')
  const [includeFutureFixed, setIncludeFutureFixed] = useState(false)
  const [detailsOperation, setDetailsOperation] = useState<FluxOperation | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [showOnlyFixedRecurring, setShowOnlyFixedRecurring] = useState(false)

  const [draftFlow, setDraftFlow] = useState<FlowFilter>('expense')
  const [draftPeriod, setDraftPeriod] = useState<PeriodFilter>('month')
  const [draftAccountFilter, setDraftAccountFilter] = useState<'all' | 'joint' | 'perso'>('all')
  const [draftIncludeFutureFixed, setDraftIncludeFutureFixed] = useState(false)
  const [draftSelectedParentCategoryId, setDraftSelectedParentCategoryId] = useState<string | null>(null)
  const [draftSelectedCategoryId, setDraftSelectedCategoryId] = useState<string | null>(null)
  const [showParametersCategoryModal, setShowParametersCategoryModal] = useState(false)
  const [showPlannedOperationModal, setShowPlannedOperationModal] = useState(false)
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

  const realizedRange = useMemo(() => periodToRange(period), [period])
  const queryRange = useMemo(
    () => (includeFutureFixed || showOnlyFixedRecurring ? periodToFullRange(period) : realizedRange),
    [includeFutureFixed, showOnlyFixedRecurring, period, realizedRange],
  )
  const flowTypeFilter: FlowType | undefined = flow === 'all' || flow === 'planned' ? undefined : (flow as FlowType)

  const categoryIdsFilter = useMemo(() => {
    if (!selectedCategoryId && !selectedParentCategoryId) return undefined
    if (selectedCategoryId) return [selectedCategoryId]
    const children = subCategories.filter((c) => c.parent_id === selectedParentCategoryId).map((c) => c.id)
    return selectedParentCategoryId ? [selectedParentCategoryId, ...children] : undefined
  }, [selectedCategoryId, selectedParentCategoryId, subCategories])
  const budgetFilter = 'all' as const

  const { data: operations = [], isLoading } = useFluxOperations({
    userId: user?.id,
    ...queryRange,
    flowType: flowTypeFilter,
    categoryIds: categoryIdsFilter,
    budgetFilter,
    accountKind: accountFilter,
    search: deferredSearch,
    includeShadowedActuals: false,
  })

  const today = todayIso()

  const visibleOperations = useMemo(
    () => operations.filter((operation) => {
      if (showOnlyFixedRecurring) {
        return operation.operation_kind === 'planned_occurrence' &&
               operation.budget_behavior === 'fixed' &&
               Boolean(operation.is_recurring)
      }
      if (isRealizedFluxOperation(operation, today)) return true
      if (includeFutureFixed && isFutureFixedPlannedOperation(operation, today)) return true
      return false
    }),
    [includeFutureFixed, showOnlyFixedRecurring, operations, today],
  )

  const filtered = useMemo(() => {
    let list = visibleOperations

    if (showOnlyFixedRecurring) {
      return list
    }

    if (excludeRecurring) list = list.filter((operation) => !operation.is_recurring)
    if (flow === 'planned') list = list.filter((operation) => operation.operation_kind === 'planned_occurrence')

    return list
  }, [visibleOperations, excludeRecurring, flow, showOnlyFixedRecurring])

  const generalMergedRows = useMemo(
    () => filtered.map((operation) => ({ id: operation.id, dateKey: toDateKey(operation.operation_date), operation })),
    [filtered],
  )

  const totalAmount = useMemo(
    () => filtered.reduce((sum, operation) => sum + Number(operation.budget_accounting_amount || 0), 0),
    [filtered],
  )

  const heroMainAmount = totalAmount
  const listHeaderAmount = totalAmount
  const operationsSummaryCount = filtered.length
  const isListLoading = isLoading

  useEffect(() => {
    if (detailsOperation) {
      const updated = filtered.find((operation) => operation.id === detailsOperation.id)
      if (updated && updated !== detailsOperation) {
        setDetailsOperation(updated)
      }
    }
  }, [filtered, detailsOperation])

  useEffect(() => {
    setSelectedParentCategoryId(null)
    setSelectedCategoryId(null)
  }, [flow])

  useEffect(() => {
    if (!showAdvancedSheet) return
  }, [showAdvancedSheet])

  const anySheetOpen = showHeaderCategorySheet || showAdvancedSheet || showParametersCategoryModal

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 220)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!anySheetOpen) return
    return lockDocumentScroll()
  }, [anySheetOpen])

  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategoryId) return categoryById.get(selectedCategoryId)?.name ?? 'Catégorie'
    if (selectedParentCategoryId) return parentById.get(selectedParentCategoryId)?.name ?? 'Catégorie'
    return 'Toutes catégories'
  }, [categoryById, parentById, selectedCategoryId, selectedParentCategoryId])
  const selectedCategoryIconKey = useMemo(() => {
    if (selectedCategoryId) return categoryById.get(selectedCategoryId)?.icon_key ?? null
    if (selectedParentCategoryId) return parentById.get(selectedParentCategoryId)?.icon_key ?? null
    return null
  }, [categoryById, parentById, selectedCategoryId, selectedParentCategoryId])
  const draftSelectedCategoryMeta = useMemo(() => {
    if (draftSelectedCategoryId) {
      const category = categoryById.get(draftSelectedCategoryId)
      if (!category) return null
      return {
        label: category.name,
        iconKey: category.icon_key ?? null,
      }
    }
    if (draftSelectedParentCategoryId) {
      const category = parentById.get(draftSelectedParentCategoryId)
      if (!category) return null
      return {
        label: headerCategoryLabel(category.name),
        iconKey: category.icon_key ?? null,
      }
    }
    return null
  }, [categoryById, draftSelectedCategoryId, draftSelectedParentCategoryId, parentById])

  const operationsSummaryLabel = useMemo(
    () => `${operationsSummaryCount} ${resultNoun(flow)}`,
    [operationsSummaryCount, flow],
  )
  const selectedPeriodHeader = useMemo(() => {
    const endIso = queryRange.endDate ?? (filtered.length ? filtered[0].operation_date : todayIso())
    const inferredStart = filtered.length ? filtered[filtered.length - 1].operation_date : endIso
    const startIso = queryRange.startDate ?? inferredStart

    return {
      startLabel: formatDateLabel(startIso),
      endLabel: formatDateLabel(endIso),
      text: `Du ${formatDateLabel(startIso)} au ${formatDateLabel(endIso)}`,
    }
  }, [filtered, queryRange.endDate, queryRange.startDate])
  const listResultsLabel = useMemo(
    () => `Du ${selectedPeriodHeader.startLabel} au ${selectedPeriodHeader.endLabel} - ${operationsSummaryLabel}`,
    [operationsSummaryLabel, selectedPeriodHeader.endLabel, selectedPeriodHeader.startLabel],
  )

  const applyParameters = () => {
    setFlow(draftFlow)
    setPeriod(draftPeriod)
    setAccountFilter(draftAccountFilter)
    setIncludeFutureFixed(draftIncludeFutureFixed)
    setSelectedParentCategoryId(draftSelectedParentCategoryId)
    setSelectedCategoryId(draftSelectedCategoryId)
    setShowParametersCategoryModal(false)
    setShowAdvancedSheet(false)
  }

  const closeParametersModal = () => {
    setDraftFlow(flow)
    setDraftPeriod(period)
    setDraftAccountFilter(accountFilter)
    setDraftIncludeFutureFixed(includeFutureFixed)
    setDraftSelectedParentCategoryId(selectedParentCategoryId)
    setDraftSelectedCategoryId(selectedCategoryId)
    setShowParametersCategoryModal(false)
    setShowAdvancedSheet(false)
  }

  const openParametersModal = () => {
    setDraftFlow(flow)
    setDraftPeriod(period)
    setDraftAccountFilter(accountFilter)
    setDraftIncludeFutureFixed(includeFutureFixed)
    setDraftSelectedParentCategoryId(selectedParentCategoryId)
    setDraftSelectedCategoryId(selectedCategoryId)
    setShowParametersCategoryModal(false)
    setShowAdvancedSheet(true)
  }

  const resetDraftParametersToDefaults = () => {
    setDraftFlow('expense')
    setDraftPeriod('month')
    setDraftAccountFilter('all')
    setDraftIncludeFutureFixed(false)
    setDraftSelectedParentCategoryId(null)
    setDraftSelectedCategoryId(null)
  }

  const handleOpenDetailsOperation = useCallback((operation: FluxOperation) => {
    setDetailsOperation(operation)
  }, [])

  const transactionsForDetails = useMemo(() => {
    return filtered
      .filter((operation) => operation.operation_kind !== 'planned_occurrence')
      .map<Transaction>((operation) => {
        const flowType = operation.flow_type ?? 'expense'
        const rawAmount = Math.abs(Number(operation.display_amount ?? operation.budget_accounting_amount ?? operation.amount ?? 0))
        return {
          id: operation.id,
          user_id: operation.user_id,
          account_id: operation.account_id ?? '00000000-0000-0000-0000-000000000000',
          category_id: operation.category_id,
          income_source_id: null,
          import_batch_id: null,
          staging_row_id: null,
          transaction_date: operation.operation_date,
          amount: rawAmount,
          currency: operation.currency ?? 'EUR',
          personal_share_ratio: operation.personal_share_ratio,
          direction:
            flowType === 'income'
              ? 'income'
              : flowType === 'transfer'
                ? 'transfer_out'
                : flowType === 'savings'
                  ? 'savings'
                  : 'expense',
          flow_type: flowType,
          budget_behavior: (operation.budget_behavior as Transaction['budget_behavior']) ?? 'variable',
          raw_label: operation.label,
          normalized_label: operation.label,
          merchant_name: operation.merchant_name,
          external_id: null,
          is_recurring: Boolean(operation.is_recurring),
          is_verified: true,
          is_hidden: Boolean(operation.is_hidden),
          notes: operation.notes,
          meta: null,
          personal_scope: null,
          created_at: operation.created_at ?? new Date().toISOString(),
          updated_at: operation.updated_at ?? new Date().toISOString(),
          category: operation.category_id ? categoryById.get(operation.category_id) : undefined,
        }
      })
  }, [categoryById, filtered])

  const detailsTxn = useMemo(() => {
    if (!detailsOperation || detailsOperation.operation_kind === 'planned_occurrence') return null
    return transactionsForDetails.find((transaction) => transaction.id === detailsOperation.id) ?? null
  }, [detailsOperation, transactionsForDetails])

  const handleNavigateTransaction = useCallback((transaction: Transaction) => {
    const next = filtered.find(
      (operation) => operation.id === transaction.id && operation.operation_kind !== 'planned_occurrence',
    )
    if (next) setDetailsOperation(next)
  }, [filtered])

  // ─── Memoized list JSX ───────────────────────────────────────────────────
  // Prevents re-diffing all rows when unrelated state (modal open, filter
  // sheet, etc.) changes while `generalMergedRows` stays the same reference.
  const generalRowItems = useMemo(() => generalMergedRows.map((row, index) => {
    const prevRow = index > 0 ? generalMergedRows[index - 1] : null
    const prevKey = prevRow?.dateKey ?? null
    const curMonth = row.dateKey.slice(0, 7)
    const prevMonth = prevKey?.slice(0, 7) ?? null
    const monthChanged = prevMonth !== curMonth
    const hasSeparator = monthChanged

    let monthRowsSum = 0
    if (monthChanged) {
      let j = index
      while (j < generalMergedRows.length && generalMergedRows[j].dateKey.slice(0, 7) === curMonth) {
        const r = generalMergedRows[j]
        const amt = Number(r.operation.budget_accounting_amount ?? 0)
        monthRowsSum += amt
        j++
      }
    }

    const separators = monthChanged && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px var(--space-6) 3px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-500)', letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
          {formatMonthLabel(row.dateKey)}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--neutral-300)' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-500)', letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
          {formatCurrencyRounded(monthRowsSum)}
        </span>
      </div>
    )

    const operation = row.operation
    const label = operation.label ?? 'Opération'
    const category = operation.category_name ?? 'Sans catégorie'
    const amount = Number(operation.display_amount ?? operation.budget_accounting_amount ?? 0)
    const isJoint = operation.account_name?.toLowerCase().includes('joint') ?? false
    const amountColor = (operation.flow_type === 'transfer' || operation.flow_type === 'savings')
      ? 'var(--neutral-700)'
      : amount > 0 ? 'var(--color-success)' : amount < 0 ? 'var(--color-error)' : 'var(--neutral-700)'
    const formattedAmount = operation.operation_kind === 'planned_occurrence'
      ? formatCurrency(Math.abs(amount))
      : formatCurrency(amount)

    return (
      <Fragment key={row.id}>
        {separators}
        <button
          type="button"
          onClick={() => handleOpenDetailsOperation(operation)}
          style={{
            width: '100%', border: 'none', background: 'transparent',
            display: 'grid', gridTemplateColumns: '42px 26px 1fr auto',
            alignItems: 'center', gap: 8, textAlign: 'left', cursor: 'pointer',
            transition: 'background-color var(--transition-fast)',
            padding: hasSeparator ? '9px var(--space-6) 7px' : '7px var(--space-6)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--neutral-50)' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          <span style={{ ...TX_ROW_DATE_BASE, color: isJoint ? '#C9A26A' : 'var(--neutral-600)' }}>
            {formatDateLabel(operation.operation_date)}
          </span>
          <span style={TX_ROW_ICON_STYLE}>
            <CategoryIcon iconKey={operation.category_icon_key} label={category} size={24} />
          </span>
          <span style={TX_ROW_LABEL_STYLE}>{label}</span>
          <span style={{ ...TX_ROW_AMOUNT_BASE, color: amountColor }}>
            {operation.operation_kind === 'planned_occurrence'
              ? <span style={{ fontStyle: 'italic' }}>{formattedAmount}</span>
              : formattedAmount}
          </span>
        </button>
      </Fragment>
    )
  }), [generalMergedRows, handleOpenDetailsOperation])
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <PageHeader
        title="Flux"
        contentOffsetY={3}
        actionIcon={
          selectedCategoryId || selectedParentCategoryId
            ? <CategoryIcon iconKey={selectedCategoryIconKey} label={selectedCategoryLabel} size={30} />
            : <img src={fluxActuelIcon} alt="" width={36} height={36} style={{ display: 'block', objectFit: 'contain' }} aria-hidden="true" />
        }
        actionAriaLabel="Choisir une catégorie"
        onActionClick={() => setShowHeaderCategorySheet((current) => !current)}
      />

      {/* ── Hero compact : montant uniquement ── */}
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
              padding: 'var(--space-3) var(--space-6)',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: 'clamp(28px, 8vw, 40px)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-0)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              {formatMoneyInteger(heroMainAmount)}
            </p>
          </div>
        </div>
      </motion.section>

      {/* ── Boutons d'action centrés ── */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: '-8px' }}>
        <button
          type="button"
          aria-label="Ouvrir les paramètres"
          onClick={showOnlyFixedRecurring ? undefined : openParametersModal}
          disabled={showOnlyFixedRecurring}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 114,
            height: 30,
            gap: 6,
            border: 'none',
            background: showOnlyFixedRecurring ? 'var(--neutral-200)' : 'var(--color-warning)',
            borderRadius: 'var(--radius-full)',
            cursor: showOnlyFixedRecurring ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 600,
            color: showOnlyFixedRecurring ? 'var(--neutral-400)' : 'var(--neutral-0)',
            boxShadow: showOnlyFixedRecurring ? 'none' : '0 2px 8px color-mix(in oklab, var(--color-warning) 40%, transparent 60%)',
            opacity: showOnlyFixedRecurring ? 0.75 : 1,
            transition: 'all var(--transition-base)',
            whiteSpace: 'nowrap',
          }}
        >
          <Settings2 size={13} strokeWidth={2.2} />
          Paramètres
        </button>

        <div
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 114,
            height: 30,
            border: showOnlyFixedRecurring ? 'none' : '1px solid color-mix(in oklab, var(--cat-abonnements) 25%, var(--neutral-300) 75%)',
            background: showOnlyFixedRecurring
              ? 'var(--cat-abonnements)'
              : 'color-mix(in oklab, var(--cat-abonnements) 8%, var(--neutral-50) 92%)',
            borderRadius: 'var(--radius-full)',
            boxShadow: showOnlyFixedRecurring ? '0 2px 8px color-mix(in oklab, var(--cat-abonnements) 40%, transparent 60%)' : 'none',
            transition: 'all var(--transition-base)',
            boxSizing: 'border-box',
          }}
        >
          {/* Icône Répéter à gauche */}
          <button
            type="button"
            aria-label="Afficher uniquement les opérations récurrentes fixes"
            onClick={() => setShowOnlyFixedRecurring((prev) => !prev)}
            style={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: showOnlyFixedRecurring
                ? 'var(--neutral-0)'
                : 'color-mix(in oklab, var(--cat-abonnements) 75%, var(--neutral-700) 25%)',
              padding: 0,
              width: 20,
              height: 20,
            }}
          >
            <Repeat size={13} strokeWidth={2.2} />
          </button>

          {/* Texte centré */}
          <button
            type="button"
            onClick={() => setShowOnlyFixedRecurring((prev) => !prev)}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              color: showOnlyFixedRecurring
                ? 'var(--neutral-0)'
                : 'color-mix(in oklab, var(--cat-abonnements) 75%, var(--neutral-700) 25%)',
              padding: 0,
              height: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Fixes
          </button>

          {/* Bouton Plus à droite */}
          <button
            type="button"
            aria-label="Planifier une nouvelle opération"
            onClick={(e) => {
              e.stopPropagation();
              setShowPlannedOperationModal(true);
            }}
            style={{
              position: 'absolute',
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: 'var(--radius-full)',
              background: showOnlyFixedRecurring
                ? 'rgba(255, 255, 255, 0.2)'
                : 'color-mix(in oklab, var(--cat-abonnements) 15%, var(--neutral-200) 85%)',
              border: 'none',
              cursor: 'pointer',
              color: showOnlyFixedRecurring
                ? 'var(--neutral-0)'
                : 'color-mix(in oklab, var(--cat-abonnements) 75%, var(--neutral-700) 25%)',
              padding: 0,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = showOnlyFixedRecurring
                ? 'rgba(255, 255, 255, 0.35)'
                : 'color-mix(in oklab, var(--cat-abonnements) 28%, var(--neutral-300) 72%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = showOnlyFixedRecurring
                ? 'rgba(255, 255, 255, 0.2)'
                : 'color-mix(in oklab, var(--cat-abonnements) 15%, var(--neutral-200) 85%)';
            }}
          >
            <Plus size={12} strokeWidth={2.5} />
          </button>
        </div>


      </div>

      <section>
          <div
            style={{
              position: 'sticky',
              top: 'var(--header-height)',
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
                {listResultsLabel}
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
            <div style={{ display: 'grid', justifyItems: 'end', gap: 1 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-500)' }}>
                {includeFutureFixed ? 'Réalisé + fixes à venir' : 'Réalisé'}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: listHeaderAmount > 0 ? 'var(--color-success)' : listHeaderAmount < 0 ? 'var(--color-error)' : 'var(--neutral-700)',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatCurrencyRounded(listHeaderAmount)}
              </span>
            </div>
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
        ) : generalMergedRows.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: 'var(--neutral-400)', textAlign: 'center', padding: 'var(--space-12)' }}>
            Aucune operation
          </motion.div>
        ) : (
          <div>
            {generalRowItems}
          </div>
        )}
      </section>

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
        {showAdvancedSheet ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeParametersModal}
              style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Paramètres"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: 'var(--page-gutter)',
                right: 'var(--page-gutter)',
                top: '24vh',
                zIndex: 81,
                maxWidth: 320,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-2xl)',
                padding: 'var(--space-4)',
                boxShadow: '0 8px 40px rgba(13,13,31,0.18)',
                display: 'grid',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-900)' }}>Paramètres</p>
                <button
                  type="button"
                  onClick={resetDraftParametersToDefaults}
                  aria-label="Réinitialiser les paramètres"
                  style={{
                    position: 'absolute',
                    right: 0,
                    width: 28,
                    height: 28,
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--neutral-200)',
                    background: 'var(--neutral-100)',
                    color: 'var(--neutral-500)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background 130ms, color 130ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--neutral-200)'; e.currentTarget.style.color = 'var(--neutral-700)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--neutral-100)'; e.currentTarget.style.color = 'var(--neutral-500)' }}
                >
                  <RotateCcw size={13} strokeWidth={2.4} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowParametersCategoryModal(true)}
                style={{
                  width: '100%',
                  border: draftSelectedCategoryMeta ? '2px solid var(--primary-600)' : '1px solid var(--neutral-200)',
                  borderRadius: 'var(--radius-sm)',
                  background: draftSelectedCategoryMeta ? 'color-mix(in oklab, var(--primary-600) 12%, var(--neutral-0) 88%)' : 'var(--neutral-50)',
                  color: draftSelectedCategoryMeta ? 'var(--primary-600)' : 'var(--neutral-800)',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '9px 8px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all var(--transition-base)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {draftSelectedCategoryMeta ? (
                  <>
                    <CategoryIcon iconKey={draftSelectedCategoryMeta.iconKey} label={draftSelectedCategoryMeta.label} size={18} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{draftSelectedCategoryMeta.label}</span>
                  </>
                ) : (
                  'choisir une catégorie'
                )}
              </button>

              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)' }}>Type d'opérations</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--neutral-200)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                  {FLOW_OPTIONS.map((option) => {
                    const isSelected = draftFlow === option.value
                    const isOverridingDefault = isSelected && option.value !== 'all'
                    return (
                      <button
                        key={`type-${option.value}`}
                        type="button"
                        onClick={() => setDraftFlow(option.value)}
                        style={{
                          padding: '7px 4px',
                          border: isOverridingDefault ? '2px solid var(--primary-600)' : isSelected ? '2px solid var(--neutral-300)' : '1px solid var(--neutral-200)',
                          borderRadius: 'var(--radius-sm)',
                          background: isOverridingDefault ? 'color-mix(in oklab, var(--primary-600) 12%, var(--neutral-0) 88%)' : isSelected ? 'var(--neutral-100)' : 'var(--neutral-50)',
                          color: isOverridingDefault ? 'var(--primary-600)' : 'var(--neutral-800)',
                          fontSize: 11,
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all var(--transition-base)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setDraftIncludeFutureFixed((current) => !current)}
                    style={{
                      padding: '7px 4px',
                      border: draftIncludeFutureFixed ? '2px solid var(--primary-600)' : '1px solid var(--neutral-200)',
                      borderRadius: 'var(--radius-sm)',
                      background: draftIncludeFutureFixed
                        ? 'color-mix(in oklab, var(--primary-600) 12%, var(--neutral-0) 88%)'
                        : 'var(--neutral-50)',
                      color: draftIncludeFutureFixed ? 'var(--primary-600)' : 'var(--neutral-800)',
                      fontSize: 11,
                      fontWeight: draftIncludeFutureFixed ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all var(--transition-base)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Fixes à venir
                  </button>
                  <p
                    style={{
                      gridColumn: '1 / -1',
                      margin: 0,
                      fontSize: 10,
                      fontWeight: 500,
                      color: 'var(--neutral-500)',
                      lineHeight: 1.3,
                    }}
                  >
                    Ajoute les opérations fixes planifiées non encore réalisées sur la période sélectionnée.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)' }}>Période</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--neutral-200)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                  {PERIOD_OPTIONS.map((option) => {
                    const isSelected = draftPeriod === option.value
                    const isOverridingDefault = isSelected && option.value !== 'month'
                    return (
                      <button
                        key={`period-${option.value}`}
                        type="button"
                        onClick={() => setDraftPeriod(option.value)}
                        style={{
                          padding: '7px 4px',
                          border: isOverridingDefault ? '2px solid var(--primary-600)' : isSelected ? '2px solid var(--neutral-300)' : '1px solid var(--neutral-200)',
                          borderRadius: 'var(--radius-sm)',
                          background: isOverridingDefault ? 'color-mix(in oklab, var(--primary-600) 12%, var(--neutral-0) 88%)' : isSelected ? 'var(--neutral-100)' : 'var(--neutral-50)',
                          color: isOverridingDefault ? 'var(--primary-600)' : 'var(--neutral-800)',
                          fontSize: 11,
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all var(--transition-base)',
                        }}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)' }}>Compte</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--neutral-200)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                  {[
                    { value: 'all' as const, label: 'Tous' },
                    { value: 'perso' as const, label: 'Personnel' },
                    { value: 'joint' as const, label: 'Joint' },
                  ].map((option) => {
                    const isSelected = draftAccountFilter === option.value
                    const isOverridingDefault = isSelected && option.value !== 'all'
                    return (
                      <button
                        key={`account-${option.value}`}
                        type="button"
                        onClick={() => setDraftAccountFilter(option.value)}
                        style={{
                          padding: '7px 4px',
                          border: isOverridingDefault ? '2px solid var(--primary-600)' : isSelected ? '2px solid var(--neutral-300)' : '1px solid var(--neutral-200)',
                          borderRadius: 'var(--radius-sm)',
                          background: isOverridingDefault ? 'color-mix(in oklab, var(--primary-600) 12%, var(--neutral-0) 88%)' : isSelected ? 'var(--neutral-100)' : 'var(--neutral-50)',
                          color: isOverridingDefault ? 'var(--primary-600)' : 'var(--neutral-800)',
                          fontSize: 11,
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all var(--transition-base)',
                        }}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>

              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  alignItems: 'center',
                  gap: 8,
                  borderTop: '1px solid var(--neutral-200)',
                  paddingTop: 'var(--space-3)',
                  marginTop: 'var(--space-1)',
                }}
              >
                <button
                  type="button"
                  onClick={closeParametersModal}
                  style={{
                    border: '1px solid color-mix(in oklab, var(--color-warning) 36%, var(--neutral-200) 64%)',
                    borderRadius: 'var(--radius-md)',
                    background: 'color-mix(in oklab, var(--color-warning) 12%, var(--neutral-0) 88%)',
                    color: 'color-mix(in oklab, var(--color-warning) 52%, #5a2700 48%)',
                    fontSize: 11,
                    fontWeight: 700,
                    width: '100%',
                    height: 36,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <div />
                <button
                  type="button"
                  onClick={applyParameters}
                  style={{
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--primary-500)',
                    color: 'var(--neutral-0)',
                    fontSize: 11,
                    fontWeight: 800,
                    width: '100%',
                    height: 36,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                >
                  Valider
                </button>
              </div>
            </motion.div>

            <AnimatePresence>
              {showParametersCategoryModal ? (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ position: 'fixed', inset: 0, zIndex: 82, background: 'rgba(13,13,31,0.32)' }}
                  />
                  <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Choisir une catégorie"
                    initial={{ scale: 0.94, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.94, opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 340 }}
                    onClick={(event) => event.stopPropagation()}
                    style={{
                      position: 'fixed',
                      left: 'var(--page-gutter)',
                      right: 'var(--page-gutter)',
                      top: '22vh',
                      zIndex: 83,
                      maxWidth: 320,
                      margin: '0 auto',
                      background: 'var(--neutral-0)',
                      borderRadius: 'var(--radius-2xl)',
                      padding: 'var(--space-4)',
                      boxShadow: '0 8px 40px rgba(13,13,31,0.18)',
                      display: 'grid',
                      gap: 'var(--space-3)',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                      {orderedHeaderRootCategories.slice(0, 11).map((category) => {
                        const isSelected = draftSelectedParentCategoryId === category.id && draftSelectedCategoryId == null
                        const displayName = headerCategoryLabel(category.name) === 'Famille/enfant' ? 'Famille\nenfant' : headerCategoryLabel(category.name)
                        return (
                          <button
                            key={`params-category-${category.id}`}
                            type="button"
                            onClick={() => {
                              setDraftSelectedParentCategoryId(category.id)
                              setDraftSelectedCategoryId(null)
                              setShowParametersCategoryModal(false)
                            }}
                            style={{
                              border: 'none',
                              borderRadius: 0,
                              background: 'transparent',
                              padding: '6px 4px',
                              display: 'grid',
                              justifyItems: 'center',
                              gap: 4,
                              cursor: 'pointer',
                            }}
                          >
                            <CategoryIcon iconKey={category.icon_key} label={category.name} size={28} />
                            <span style={{ fontSize: 9, fontWeight: isSelected ? 800 : 700, color: isSelected ? 'var(--primary-700)' : 'var(--neutral-700)', textAlign: 'center', lineHeight: 1.08, maxWidth: '100%', whiteSpace: 'pre-line' }}>
                              {displayName}
                            </span>
                          </button>
                        )
                      })}
                      <button
                        type="button"
                        aria-label="Fermer la sélection catégorie"
                        onClick={() => setShowParametersCategoryModal(false)}
                        style={{
                          border: 'none',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--color-error)',
                          color: 'var(--neutral-0)',
                          width: 34,
                          height: 34,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          justifySelf: 'center',
                          alignSelf: 'center',
                        }}
                      >
                        <X size={13} strokeWidth={2.6} />
                      </button>
                    </div>
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>
          </>
        ) : null}
      </AnimatePresence>

      <TransactionDetailsModal
        transaction={detailsTxn}
        categories={flowCategories ?? []}
        transactionList={transactionsForDetails}
        onNavigate={handleNavigateTransaction}
        onClose={() => setDetailsOperation(null)}
        showEditControls={false}
      />

      <PlannedOperationDetailsModal
        operation={detailsOperation?.operation_kind === 'planned_occurrence' ? detailsOperation : null}
        onClose={() => setDetailsOperation(null)}
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
