import { useEffect, useMemo, useState, useDeferredValue, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Search, ArrowUp, Settings2, X } from 'lucide-react'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { useAuth } from '@/hooks/useAuth'
import { usePlannedOperationsForFlow } from '@/hooks/usePlannedOperations'
import { formatCurrencyRounded, getTxLabel, todayIso } from '@/lib/utils'
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
type PeriodFilter = 'day' | 'week' | 'month' | 'year_2026' | 'year_2025' | 'all'
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
  { value: 'planned', label: 'Récurrentes' },
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

function periodToRange(period: PeriodFilter): { startDate?: string; endDate?: string } {
  const now = new Date()

  switch (period) {
    case 'day': {
      const start = startOfIsoDay(now)
      return { startDate: start, endDate: todayIso() }
    }
    case 'week': {
      const day = now.getDay() === 0 ? 6 : now.getDay() - 1
      const monday = new Date(now)
      monday.setDate(now.getDate() - day)
      return { startDate: startOfIsoDay(monday), endDate: todayIso() }
    }
    case 'month': {
      return { startDate: startOfIsoMonth(now), endDate: todayIso() }
    }
    case 'year_2026':
      return { startDate: '2026-01-01', endDate: '2026-12-31' }
    case 'year_2025':
      return { startDate: '2025-01-01', endDate: '2025-12-31' }
    case 'all':
      return {}
    default: {
      return {}
    }
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

function resultNoun(flow: FlowFilter): string {
  if (flow === 'expense') return 'dépenses'
  if (flow === 'income') return 'revenus'
  if (flow === 'transfer') return 'transferts internes'
  if (flow === 'planned') return 'opérations récurrentes'
  return 'opérations'
}

function formatRowAmount(amount: number, flowType: string | null, rawAmount: number): string {
  if (flowType === 'transfer' || flowType === 'savings') {
    return `(${formatCurrencyRounded(Math.abs(rawAmount))})`
  }
  if (amount > 0) {
    return `+${formatCurrencyRounded(amount)}`
  }
  return formatCurrencyRounded(amount)
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
  if (flow === 'transfer' || flow === 'savings') return 0
  if (flow === 'expense') {
    return -absolute
  }

  return raw
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

  const [showHeaderCategorySheet, setShowHeaderCategorySheet] = useState(false)
  const [showAdvancedSheet, setShowAdvancedSheet] = useState(false)

  const [selectedParentCategoryId, setSelectedParentCategoryId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const [excludeRecurring] = useState(false)
  const [accountFilter, setAccountFilter] = useState<'all' | 'joint' | 'perso'>('all')
  const [detailsTxn, setDetailsTxn] = useState<Transaction | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  const [draftFlow, setDraftFlow] = useState<FlowFilter>('all')
  const [draftPeriod, setDraftPeriod] = useState<PeriodFilter>('month')
  const [draftAccountFilter, setDraftAccountFilter] = useState<'all' | 'joint' | 'perso'>('all')
  const [draftSelectedParentCategoryId, setDraftSelectedParentCategoryId] = useState<string | null>(null)
  const [draftSelectedCategoryId, setDraftSelectedCategoryId] = useState<string | null>(null)
  const [showParametersCategoryModal, setShowParametersCategoryModal] = useState(false)
  const [showPlannedOperationModal, setShowPlannedOperationModal] = useState(false)
  const [plannedModalityFilter, setPlannedModalityFilter] = useState<PlannedModalityFilter>('all')

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

  const isPlannedMode = false
  const isSavingsMode = flow === 'savings'
  const todayDateKey = getTodayDateKey()
  const range = useMemo(() => periodToRange(period), [period])
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
    if (period === 'year_2025') return '2025-01-01'
    if (period === 'year_2026') return '2026-01-01'
    return startOfIsoMonth(new Date())
  }, [period])
  const plannedModeEndDate = useMemo(() => {
    if (period === 'year_2025') return '2025-12-31'
    if (period === 'year_2026') return '2026-12-31'
    return endOfIsoMonth(new Date())
  }, [period])

  const generalModePlannedStartDate = useMemo(() => startOfIsoMonth(new Date()), [])
  const generalModePlannedEndDate = useMemo(() => {
    const now = new Date()
    const monthEnd = endOfIsoMonth(now)
    if (isSavingsMode) return monthEnd
    return monthEnd < todayDateKey ? monthEnd : todayDateKey
  }, [isSavingsMode, todayDateKey])

  const isGeneralMonthView = !isPlannedMode && period === 'month'

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
    if (flow === 'planned') list = list.filter((t) => t.is_recurring)
    if (accountFilter === 'joint') list = list.filter((t) => t.account?.name?.toLowerCase().includes('joint') ?? false)
    if (accountFilter === 'perso') list = list.filter((t) => !(t.account?.name?.toLowerCase().includes('joint') ?? false))

    if (deferredSearch.trim()) {
      const q = deferredSearch.trim().toLowerCase()
      list = list.filter((t) => getTxLabel(t).toLowerCase().includes(q))
    }

    return list
  }, [txns, excludeRecurring, flow, accountFilter, deferredSearch])

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
    // Option A : seules les transactions réelles entrent dans le total.
    // Les planifiées sont un overlay informatif, pas des montants comptabilisés.
    return filteredTransactions.reduce((sum, transaction) => sum + signedAmount(transaction), 0)
  }, [filteredTransactions])

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

  useEffect(() => {
    setSelectedParentCategoryId(null)
    setSelectedCategoryId(null)
    if (flow === 'planned') {
      setPlannedModalityFilter('all')
    }
  }, [flow])

  useEffect(() => {
    if (flow !== 'planned') return
    if (period === 'month' || period === 'year_2026' || period === 'year_2025') return
    setPeriod('month')
  }, [flow, period])

  useEffect(() => {
    if (!showAdvancedSheet) return
  }, [showAdvancedSheet])

  useEffect(() => {
    if (draftFlow !== 'planned') return
    if (draftPeriod !== 'month' && draftPeriod !== 'year_2026' && draftPeriod !== 'year_2025') {
      setDraftPeriod('month')
    }
  }, [draftFlow, draftPeriod])

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
  const listResultsLabel = useMemo(
    () => `Du ${selectedPeriodHeader.startLabel} au ${selectedPeriodHeader.endLabel} - ${operationsSummaryLabel}`,
    [operationsSummaryLabel, selectedPeriodHeader.endLabel, selectedPeriodHeader.startLabel],
  )

  const applyParameters = () => {
    setFlow(draftFlow)
    setPeriod(draftPeriod)
    setAccountFilter(draftAccountFilter)
    setSelectedParentCategoryId(draftSelectedParentCategoryId)
    setSelectedCategoryId(draftSelectedCategoryId)
    setShowParametersCategoryModal(false)
    setShowAdvancedSheet(false)
  }

  const closeParametersModal = () => {
    setDraftFlow(flow)
    setDraftPeriod(period)
    setDraftAccountFilter(accountFilter)
    setDraftSelectedParentCategoryId(selectedParentCategoryId)
    setDraftSelectedCategoryId(selectedCategoryId)
    setShowParametersCategoryModal(false)
    setShowAdvancedSheet(false)
  }

  const openParametersModal = () => {
    setDraftFlow(flow)
    setDraftPeriod(period)
    setDraftAccountFilter(accountFilter)
    setDraftSelectedParentCategoryId(selectedParentCategoryId)
    setDraftSelectedCategoryId(selectedCategoryId)
    setShowParametersCategoryModal(false)
    setShowAdvancedSheet(true)
  }

  const resetDraftParametersToDefaults = () => {
    setDraftFlow('all')
    setDraftPeriod('month')
    setDraftAccountFilter('all')
    setDraftSelectedParentCategoryId(null)
    setDraftSelectedCategoryId(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <PageHeader
        title="Flux"
        contentOffsetY={3}
        actionIcon={
          selectedCategoryId || selectedParentCategoryId
            ? <CategoryIcon iconKey={selectedCategoryIconKey} label={selectedCategoryLabel} size={30} />
            : <img src={categoriesHeaderIcon} alt="" width={30} height={30} style={{ display: 'block', objectFit: 'contain' }} aria-hidden="true" />
        }
        actionAriaLabel="Choisir une catégorie"
        onActionClick={() => setShowHeaderCategorySheet((current) => !current)}
        rightSlot={
          <button
            type="button"
            aria-label="Nouvelle opération planifiée"
            onClick={() => setShowPlannedOperationModal(true)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-full)',
              border: '1.5px solid color-mix(in oklab, var(--neutral-0) 40%, transparent 60%)',
              background: 'color-mix(in oklab, var(--neutral-0) 14%, transparent 86%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <img src={planifierOperationIcon} alt="" width={20} height={20} style={{ display: 'block', objectFit: 'contain' }} aria-hidden="true" />
          </button>
        }
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
              padding: 'var(--space-3) var(--space-5) var(--space-3)',
              boxShadow: 'var(--shadow-card)',
              position: 'relative',
              overflow: 'hidden',
              minHeight: 'clamp(80px, 18vw, 102px)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                position: 'absolute',
                right: -14,
                top: -12,
                fontSize: 88,
                fontWeight: 900,
                fontFamily: 'var(--font-mono)',
                color: 'rgba(255,255,255,0.08)',
                lineHeight: 1,
                userSelect: 'none',
                pointerEvents: 'none',
                letterSpacing: '-0.04em',
                textTransform: 'uppercase',
              }}
            >
              flux
            </span>

            <div
              style={{
                position: 'absolute',
                top: -76,
                right: -58,
                width: 210,
                height: 210,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 56%, transparent 76%)',
                pointerEvents: 'none',
              }}
            />

            <button
              type="button"
              aria-label="Ouvrir les paramètres"
              title="Paramètres"
              onClick={openParametersModal}
              style={{
                position: 'absolute',
                top: '50%',
                right: 'var(--space-4)',
                transform: 'translateY(-50%)',
                border: '1px solid rgba(255,255,255,0.38)',
                background: 'rgba(255,255,255,0.12)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-full)',
                zIndex: 2,
              }}
            >
              <Settings2 size={16} color="var(--neutral-0)" strokeWidth={2.2} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 'clamp(30px, 8.6vw, 44px)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-0)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                {formatMoneyInteger(heroMainAmount)}
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      <section>
          <div
            style={{
              position: 'sticky',
              top: 'var(--safe-top, 0px)',
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
                              color: (operation.flow_type === 'transfer' || operation.flow_type === 'savings') ? 'var(--neutral-700)' : amount > 0 ? 'var(--color-success)' : amount < 0 ? 'var(--color-error)' : 'var(--neutral-700)',
                            }}
                          >
                            {formatRowAmount(amount, operation.flow_type, Number(operation.planned_personal_amount) || 0)}
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
                              color: (operation.flow_type === 'transfer' || operation.flow_type === 'savings') ? 'var(--neutral-700)' : amount > 0 ? 'var(--color-success)' : amount < 0 ? 'var(--color-error)' : 'var(--neutral-700)',
                            }}
                          >
                            {formatRowAmount(amount, operation.flow_type, Number(operation.planned_personal_amount) || 0)}
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
              const curMonth = row.dateKey.slice(0, 7)
              const prevMonth = prevKey?.slice(0, 7) ?? null
              const monthChanged = prevMonth !== curMonth
              const hasSeparator = monthChanged

              let monthRowsSum = 0
              if (monthChanged) {
                let j = index
                while (j < generalMergedRows.length && generalMergedRows[j].dateKey.slice(0, 7) === curMonth) {
                  const r = generalMergedRows[j]
                  const amt = r.source === 'transaction' ? signedAmount(r.transaction) : signedPlannedAmount(r.planned)
                  monthRowsSum += amt
                  j++
                }
              }

              const separators = monthChanged && (
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
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--neutral-500)',
                      letterSpacing: '0.01em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatCurrencyRounded(monthRowsSum)}
                  </span>
                </div>
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
                          color: (transaction.flow_type === 'transfer' || transaction.flow_type === 'savings') ? 'var(--neutral-700)' : amount > 0 ? 'var(--color-success)' : amount < 0 ? 'var(--color-error)' : 'var(--neutral-700)',
                        }}
                      >
                        {formatRowAmount(amount, transaction.flow_type, Number(transaction.amount) || 0)}
                      </span>
                    </button>
                  </Fragment>
                )
              }

              const planned = row.planned
              const amount = signedPlannedAmount(planned)
              const categoryName = planned.category_name ?? planned.parent_category_name ?? 'Planifiée'

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
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-600)', whiteSpace: 'nowrap' }}>
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
                        color: (planned.flow_type === 'transfer' || planned.flow_type === 'savings') ? 'var(--neutral-700)' : amount > 0 ? 'var(--color-success)' : amount < 0 ? 'var(--color-error)' : 'var(--neutral-700)',
                      }}
                    >
                      {formatRowAmount(amount, planned.flow_type, Number(planned.planned_personal_amount) || 0)}
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
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-900)', textAlign: 'center' }}>Paramètres</p>

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
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)' }}>Type d’opération</span>
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
                <button
                  type="button"
                  onClick={resetDraftParametersToDefaults}
                  style={{
                    border: '1px solid var(--neutral-300)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--neutral-100)',
                    color: 'var(--neutral-800)',
                    fontSize: 11,
                    fontWeight: 700,
                    width: '100%',
                    height: 36,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  réinitialiser
                </button>
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
