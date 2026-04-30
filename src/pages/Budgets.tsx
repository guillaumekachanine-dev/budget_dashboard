import { useState, useMemo, useEffect, useRef, useCallback, type PointerEvent as ReactPointerEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, ChevronDown, ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  PieChart,
  Pie,
  ReferenceLine,
} from 'recharts'
import { useBudgetSummaries } from '@/hooks/useBudgets'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { getCurrentPeriod, formatCurrencyRounded } from '@/lib/utils'
import { debugBudgetSupabaseConnection } from '@/debug/debugBudgetSupabase'
import { supabase } from '@/lib/supabase'
import { readOfflineValue, writeOfflineValue } from '@/lib/offlineStorage'
import type { Transaction } from '@/lib/types'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { TransactionDetailsModal } from '@/components/modals/TransactionDetailsModal'
import { PageHeader } from '@/components/layout/PageHeader'
import { HeaderPeriodMenu } from '@/components/layout/HeaderPeriodMenu'
import { Button } from '@/components'
import { useBudgetPeriod } from '@/features/budget/hooks/useBudgetPeriod'
import { BudgetSummaryCards } from '@/features/budget/components/BudgetSummaryCards'
import { BudgetParentGroups } from '@/features/budget/components/BudgetParentGroups'
import { BudgetVsActualSection } from '@/features/budget/components/BudgetVsActualSection'
import { BudgetCategoryList } from '@/features/budget/components/BudgetCategoryList'
import { formatPeriodLabel } from '@/features/budget/utils/budgetSelectors'

type PeriodKey = 'mois' | 'annee'
type DataDisplayMode = 'reel' | 'budget'
type SubCatTrend = 'up' | 'down' | 'equal'

interface MonthlyBucket {
  month: string
  amount: number
  budget: number
  evolutionPct: number | null
  isCurrent: boolean
}

interface PieDatum {
  id: string
  name: string
  value: number
  color: string
}

type BudgetBlockId = 'fixe' | 'variable_essentiel' | 'discretionnaire' | 'epargne' | 'cagnotte'

interface BudgetBlockLineItem {
  id: string
  categoryName: string
  parentCategoryName: string | null
  budgetAmount: number
  actualAmount: number
}

interface BudgetBlockRow {
  id: BudgetBlockId
  label: string
  color: string
  budgetAmount: number
  actualAmount: number
  lines: BudgetBlockLineItem[]
}

interface SubCategoryTrendItem {
  id: string
  name: string
  parentCategoryName: string | null
  currentMonthAmount: number
  previousMonthAmount: number
  threeMonthAvg: number
  trend: SubCatTrend
}

interface CategoryBarRow {
  id: string
  name: string
  parentCategoryName: string | null
  actualAmount: number
  budgetAmount: number
  displayAmount: number
}

interface DonutCallout {
  id: string
  name: string
  x0: number
  y0: number
  x1: number
  y1: number
  x2: number
  y2: number
  labelX: number
  labelY: number
  textAnchor: 'start' | 'end'
}

type PieInteractionPayload = Partial<PieDatum> & { payload?: Partial<PieDatum> }

interface PieLabelProps {
  payload?: PieDatum
  cx?: number
  cy?: number
  midAngle?: number
  innerRadius?: number
  outerRadius?: number
}

interface LabelListContentProps {
  x?: number
  y?: number
  width?: number
  payload?: MonthlyBucket
}

interface BudgetsUiPrefs {
  periodKey: PeriodKey
  selectedMonth: number
  dataDisplayMode: DataDisplayMode
  activeSlide: number
}

const BUDGETS_UI_PREFS_KEY = 'budget-dashboard:budgets-ui-prefs'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return formatCurrencyRounded(0)
  return formatCurrencyRounded(Math.floor(amount))
}

function formatPercentSigned(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function formatTxDateDayMonth(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '--/--'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function txLabel(tx: Transaction): string {
  return (tx.normalized_label ?? tx.raw_label ?? 'Opération').trim() || 'Opération'
}

function extractPiePayload(slice: unknown): Partial<PieDatum> | null {
  if (!slice || typeof slice !== 'object') return null
  const source = slice as PieInteractionPayload
  if (source.payload && typeof source.payload === 'object') return source.payload
  return source
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function getPeriodRange(
  key: PeriodKey,
  selectedYear: number,
  selectedMonth: number,
): { startDate: string; endDate: string } {
  const now = new Date()
  const today = todayStr()

  if (key === 'annee') {
    return { startDate: `${selectedYear}-01-01`, endDate: today }
  }

  const startDate = `${selectedYear}-${pad2(selectedMonth)}-01`
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1
  if (isCurrentMonth) {
    return { startDate, endDate: today }
  }

  const monthEndDate = new Date(selectedYear, selectedMonth, 0)
  const endDate = `${monthEndDate.getFullYear()}-${pad2(monthEndDate.getMonth() + 1)}-${pad2(monthEndDate.getDate())}`
  return { startDate, endDate }
}

function getPeriodLabel(key: PeriodKey, selectedYear: number, selectedMonth: number): string {
  if (key === 'annee') return `Année ${selectedYear}`
  return formatPeriodLabel(selectedYear, selectedMonth)
}

const MONTHS_FR_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const VIZ_TOKENS = ['var(--viz-a)', 'var(--viz-b)', 'var(--viz-c)', 'var(--viz-d)', 'var(--viz-e)'] as const
const BUDGET_BLOCKS: Array<{ id: BudgetBlockId; label: string; color: string }> = [
  { id: 'fixe', label: 'Fixe', color: 'var(--primary-500)' },
  { id: 'variable_essentiel', label: 'Variable essentiel', color: 'var(--color-success)' },
  { id: 'discretionnaire', label: 'Discrétionnaire', color: 'var(--color-error)' },
  { id: 'epargne', label: 'Épargne', color: 'var(--color-warning)' },
  { id: 'cagnotte', label: 'Cagnotte', color: 'var(--viz-e)' },
]

function accentFromLabel(label: string): string {
  const key = label.trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash << 5) - hash + key.charCodeAt(i)
  return VIZ_TOKENS[Math.abs(hash) % VIZ_TOKENS.length]
}

function mapBudgetBucketToBlock(bucket: string | null | undefined): BudgetBlockId | null {
  if (!bucket) return null
  if (bucket === 'socle_fixe') return 'fixe'
  if (bucket === 'variable_essentielle') return 'variable_essentiel'
  if (bucket === 'discretionnaire') return 'discretionnaire'
  if (bucket === 'cagnotte_projet') return 'cagnotte'
  if (bucket === 'provision') return 'epargne'
  return null
}

function formatBudgetBucketLabel(bucket: string | null | undefined): string {
  if (!bucket) return 'Non classé'
  if (bucket === 'socle_fixe') return 'Fixe'
  if (bucket === 'variable_essentielle') return 'Variable essentielle'
  if (bucket === 'discretionnaire') return 'Discrétionnaire'
  if (bucket === 'cagnotte_projet') return 'Cagnotte projet'
  if (bucket === 'provision') return 'Épargne'
  if (bucket === 'hors_pilotage') return 'Hors pilotage'
  return bucket
}

function toleranceByBucket(bucket: string | null | undefined): string {
  if (bucket === 'socle_fixe') return '±3%'
  if (bucket === 'variable_essentielle') return '±8%'
  if (bucket === 'discretionnaire') return '±12%'
  if (bucket === 'provision') return '±6%'
  if (bucket === 'cagnotte_projet') return '±0%'
  return '±10%'
}

function BarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload?: MonthlyBucket }> }) {
  if (!active || !payload?.length) return null
  const amount = Number(payload[0]?.value ?? 0)
  const budget = Number(payload[0]?.payload?.budget ?? 0)
  const gapPct = budget > 0 ? ((amount - budget) / budget) * 100 : null
  return (
    <div style={{ background: 'var(--primary-600)', borderRadius: 'var(--radius-md)', padding: '6px 11px', boxShadow: 'var(--shadow-md)', display: 'grid', gap: 2 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--neutral-0)', textAlign: 'center' }}>
        {formatMoney(amount)}
      </span>
      {gapPct != null ? (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: gapPct > 0 ? 'var(--color-error)' : 'var(--color-success)', textAlign: 'center' }}>
          {formatPercentSigned(gapPct)}
        </span>
      ) : null}
    </div>
  )
}

interface SubCategoryTransactionsModalProps {
  open: boolean
  onClose: () => void
  title: string
  transactions: Transaction[]
  loading: boolean
  onSelectTransaction: (transaction: Transaction) => void
}

function SubCategoryTransactionsModal({
  open,
  onClose,
  title,
  transactions,
  loading,
  onSelectTransaction,
}: SubCategoryTransactionsModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(13,13,31,0.56)' }}
          />
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 221,
              display: 'grid',
              placeItems: 'center',
              padding: 'var(--space-4)',
              pointerEvents: 'none',
            }}
          >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 30, stiffness: 330 }}
            style={{
              width: 'min(560px, 100%)',
              background: 'var(--neutral-0)',
              borderRadius: 'var(--radius-2xl)',
              maxHeight: 'min(82dvh, calc(100dvh - var(--space-8)))',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--neutral-900)' }}>{title}</p>
              <button type="button" onClick={onClose} style={{ border: 'none', background: 'var(--neutral-100)', color: 'var(--neutral-600)', minWidth: 'var(--touch-target-min)', minHeight: 'var(--touch-target-min)', borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label="Fermer">
                <X size={15} />
              </button>
            </div>
            <div style={{ maxHeight: 'calc(min(82dvh, 100dvh - var(--space-8)) - 66px)', overflowY: 'auto' }}>
              {loading ? (
                <p style={{ margin: 0, padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)' }}>Chargement…</p>
              ) : transactions.length === 0 ? (
                <p style={{ margin: 0, padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)' }}>Aucune opération</p>
              ) : (
                transactions.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => onSelectTransaction(tx)}
                    style={{
                      width: '100%',
                      border: 'none',
                      borderBottom: '1px solid var(--neutral-200)',
                      padding: 'var(--space-3) var(--space-5)',
                      display: 'grid',
                      gridTemplateColumns: '52px minmax(0,1fr) auto',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      background: 'transparent',
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
                    <span style={{ fontSize: 12, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>{formatTxDateDayMonth(tx.transaction_date)}</span>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--neutral-800)' }}>{txLabel(tx)}</span>
                    <span style={{ fontSize: 13, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{formatMoney(Number(tx.amount))}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

export function Budgets() {
  const { year, month } = getCurrentPeriod()
  const now = new Date()
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [periodKey, setPeriodKey] = useState<PeriodKey>('mois')
  const [selectedPeriodMonth, setSelectedPeriodMonth] = useState(nowMonth + 1)
  const [dataDisplayMode, setDataDisplayMode] = useState<DataDisplayMode>('reel')
  const selectedCat = searchParams.get('category') ?? 'all'
  const [showCatSheet, setShowCatSheet] = useState(false)
  const [showHeaderPeriodMenu, setShowHeaderPeriodMenu] = useState(false)
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategoryTrendItem | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [subCategoryTransactionSequence, setSubCategoryTransactionSequence] = useState<Transaction[]>([])
  const [pendingTransaction, setPendingTransaction] = useState<Transaction | null>(null)
  const [subCategoryToReopen, setSubCategoryToReopen] = useState<SubCategoryTrendItem | null>(null)
  const [selectedDonutSlice, setSelectedDonutSlice] = useState<PieDatum | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<BudgetBlockId | null>(null)
  const [activeSlide, setActiveSlide] = useState(0)
  const {
    selectedPeriod: configuredBudgetPeriod,
    availablePeriods: configuredBudgetPeriods,
    loading: configuredBudgetLoading,
    error: configuredBudgetError,
    summary: configuredBudgetSummary,
    categoryLines: configuredBudgetCategoryLines,
    parentGroups: configuredBudgetParentGroups,
    actuals: configuredBudgetActuals,
    hasActuals: configuredBudgetHasActuals,
    setSelectedPeriod: setConfiguredBudgetPeriod,
    reload: reloadConfiguredBudget,
  } = useBudgetPeriod()
  const debugRanRef = useRef(false)
  const donutTooltipRef = useRef<HTMLDivElement | null>(null)
  const donutAreaRef = useRef<HTMLDivElement | null>(null)
  const [donutAreaSize, setDonutAreaSize] = useState({ width: 0, height: 0 })
  const dragStartXRef = useRef<number | null>(null)
  const dragDeltaXRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    let mounted = true
    void readOfflineValue<BudgetsUiPrefs>(BUDGETS_UI_PREFS_KEY).then((prefs) => {
      if (!mounted || !prefs) return
      if (prefs.periodKey === 'mois' || prefs.periodKey === 'annee') {
        setPeriodKey(prefs.periodKey)
      }
      if (prefs.selectedMonth >= 1 && prefs.selectedMonth <= nowMonth + 1) {
        setSelectedPeriodMonth(prefs.selectedMonth)
      }
      if (prefs.dataDisplayMode === 'reel' || prefs.dataDisplayMode === 'budget') {
        setDataDisplayMode(prefs.dataDisplayMode)
      }
      if (Number.isInteger(prefs.activeSlide) && prefs.activeSlide >= 0 && prefs.activeSlide < 4) {
        setActiveSlide(prefs.activeSlide)
      }
    })
    return () => {
      mounted = false
    }
  }, [nowMonth])

  useEffect(() => {
    void writeOfflineValue<BudgetsUiPrefs>(BUDGETS_UI_PREFS_KEY, {
      periodKey,
      selectedMonth: selectedPeriodMonth,
      dataDisplayMode,
      activeSlide,
    })
  }, [periodKey, selectedPeriodMonth, dataDisplayMode, activeSlide])

  const setSelectedCat = useCallback((nextCategoryId: string) => {
    const nextParams = new URLSearchParams(searchParams)
    if (nextCategoryId === 'all') nextParams.delete('category')
    else nextParams.set('category', nextCategoryId)
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const handleHeaderTitleReset = useCallback(() => {
    setSelectedCat('all')
    setPeriodKey('mois')
    setSelectedPeriodMonth(nowMonth + 1)
    setShowHeaderPeriodMenu(false)
    setShowCatSheet(false)
  }, [nowMonth, setSelectedCat])

  useEffect(() => {
    if (import.meta.env.DEV && !debugRanRef.current) {
      debugRanRef.current = true
      void debugBudgetSupabaseConnection(supabase)
    }
  }, [])

  useEffect(() => {
    const element = donutAreaRef.current
    if (!element) return

    const updateSize = () => {
      const rect = element.getBoundingClientRect()
      setDonutAreaSize({ width: rect.width, height: rect.height })
    }

    updateSize()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize)
      return () => window.removeEventListener('resize', updateSize)
    }

    const resizeObserver = new ResizeObserver(() => updateSize())
    resizeObserver.observe(element)
    return () => resizeObserver.disconnect()
  }, [])

  const { data: summaries } = useBudgetSummaries(year, month)
  const { data: categories = [], isFetched: categoriesFetched } = useCategories('expense')
  const rootExpenseCategories = useMemo(() => categories.filter((c) => c.parent_id === null), [categories])
  const expenseSubCategories = useMemo(() => categories.filter((c) => c.parent_id !== null), [categories])
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  useEffect(() => {
    if (selectedCat === 'all' || !categoriesFetched) return
    if (!categoryById.has(selectedCat)) {
      setSelectedCat('all')
    }
  }, [selectedCat, categoryById, categoriesFetched, setSelectedCat])

  const range = useMemo(() => getPeriodRange(periodKey, nowYear, selectedPeriodMonth), [periodKey, nowYear, selectedPeriodMonth])

  const selectedCategoryIds = useMemo(() => {
    if (selectedCat === 'all') return undefined
    const ids = [selectedCat]
    expenseSubCategories.forEach((c) => {
      if (c.parent_id === selectedCat) ids.push(c.id)
    })
    return ids
  }, [expenseSubCategories, selectedCat])

  const { data: periodTxns } = useTransactions({
    ...range,
    flowType: 'expense',
    categoryIds: selectedCategoryIds,
  })

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const { data: currentMonthAllExpenseTxns } = useTransactions({
    startDate: currentMonthStart,
    endDate: todayStr(),
    flowType: 'expense',
  })

  const historyStart = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10)
  const { data: historyTxns } = useTransactions({
    startDate: historyStart,
    endDate: todayStr(),
    flowType: 'expense',
    categoryIds: selectedCategoryIds,
  })

  const { data: subCategoryTransactions, isLoading: loadingSubCategoryTransactions } = useTransactions({
    ...range,
    flowType: 'expense',
    categoryIds: selectedSubCategory ? [selectedSubCategory.id] : undefined,
    debugSource: 'Budgets:subCategoryTransactions',
  }, {
    enabled: Boolean(selectedSubCategory),
  })

  const totalMonthlyBudget = useMemo(() => {
    if (!summaries?.length) return 0
    if (selectedCat === 'all') return summaries.reduce((s, b) => s + b.budget_amount, 0)
    return summaries.find((s) => s.category.id === selectedCat)?.budget_amount ?? 0
  }, [summaries, selectedCat])

  const selectedPeriodSpent = useMemo(() => {
    const txs = periodTxns ?? []
    if (!txs.length) return 0
    return txs.reduce((sum, tx) => sum + Number(tx.amount), 0)
  }, [periodTxns])

  const selectedCatInfo = useMemo(() => categories.find((c) => c.id === selectedCat) ?? null, [categories, selectedCat])
  const categoryBudgetLines = useMemo(() => {
    if (selectedCat === 'all') return []
    return configuredBudgetCategoryLines.filter((line) => (
      line.category_id === selectedCat
      || line.parent_category_id === selectedCat
    ))
  }, [configuredBudgetCategoryLines, selectedCat])
  const dominantCategoryBudgetLine = useMemo(() => {
    if (!categoryBudgetLines.length) return null
    return [...categoryBudgetLines].sort((a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0))[0]
  }, [categoryBudgetLines])
  const categoryMonthlyBudget = useMemo(() => {
    if (selectedCat === 'all') return totalMonthlyBudget
    if (!categoryBudgetLines.length) return 0
    return categoryBudgetLines.reduce((sum, line) => sum + Number(line.amount ?? 0), 0)
  }, [categoryBudgetLines, selectedCat, totalMonthlyBudget])
  const categoryRanking = useMemo(() => {
    if (selectedCat === 'all') return null
    const rootBudgets = new Map<string, number>()
    for (const summary of summaries ?? []) {
      const rootId = summary.category.parent_id ?? summary.category.id
      rootBudgets.set(rootId, (rootBudgets.get(rootId) ?? 0) + Number(summary.budget_amount ?? 0))
    }
    const selectedRootId = selectedCatInfo ? (selectedCatInfo.parent_id ?? selectedCatInfo.id) : selectedCat
    const ranked = [...rootBudgets.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
    const idx = ranked.findIndex((id) => id === selectedRootId)
    if (idx < 0) return null
    return { index: idx + 1, total: ranked.length }
  }, [selectedCat, selectedCatInfo, summaries])
  const categoryMethodLabel = useMemo(() => {
    const method = dominantCategoryBudgetLine?.budget_method
    if (!method) return 'Calcul auto'
    return method.replace(/_/g, ' ')
  }, [dominantCategoryBudgetLine?.budget_method])
  const budgetByCategoryId = useMemo(
    () =>
      (summaries ?? []).reduce<Map<string, number>>((acc, summary) => {
        acc.set(summary.category.id, (acc.get(summary.category.id) ?? 0) + Number(summary.budget_amount))
        return acc
      }, new Map<string, number>()),
    [summaries],
  )

  const monthlyHistory = useMemo<MonthlyBucket[]>(() => {
    const base = [-5, -4, -3, -2, -1, 0].map((offset) => {
      const d = new Date(nowYear, nowMonth + offset, 1)
      const m = d.getMonth()
      const y = d.getFullYear()
      const amount = (historyTxns ?? []).reduce((sum, t) => {
        const txDate = new Date(t.transaction_date)
        if (txDate.getMonth() === m && txDate.getFullYear() === y) return sum + Number(t.amount)
        return sum
      }, 0)
      return { month: MONTHS_FR_SHORT[m], amount, budget: totalMonthlyBudget, isCurrent: offset === 0 }
    })

    return base.map((row, idx) => {
      if (idx === 0) return { ...row, evolutionPct: null }
      const prev = base[idx - 1].amount
      if (prev <= 0) return { ...row, evolutionPct: null }
      return { ...row, evolutionPct: ((row.amount - prev) / prev) * 100 }
    })
  }, [historyTxns, totalMonthlyBudget, nowMonth, nowYear])

  const realPieData = useMemo<PieDatum[]>(() => {
    const txs = periodTxns ?? []
    const amounts = new Map<string, number>()

    txs.forEach((tx) => {
      const categoryId = tx.category_id
      if (!categoryId) return
      const category = categoryById.get(categoryId)
      if (!category) return

      if (selectedCat === 'all') {
        const rootId = category.parent_id ?? category.id
        amounts.set(rootId, (amounts.get(rootId) ?? 0) + Number(tx.amount))
        return
      }

      if (category.parent_id === selectedCat || category.id === selectedCat) {
        amounts.set(category.id, (amounts.get(category.id) ?? 0) + Number(tx.amount))
      }
    })

    return Array.from(amounts.entries())
      .map(([id, value]) => ({
        id,
        name: categoryById.get(id)?.name ?? 'Catégorie',
        value,
        color: accentFromLabel(categoryById.get(id)?.name ?? id),
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [categoryById, periodTxns, selectedCat])
  const budgetPieData = useMemo<PieDatum[]>(() => {
    const budgetByCategory = (summaries ?? []).reduce<Map<string, number>>((acc, summary) => {
      acc.set(summary.category.id, (acc.get(summary.category.id) ?? 0) + Number(summary.budget_amount))
      return acc
    }, new Map<string, number>())

    if (selectedCat === 'all') {
      const budgetByRoot = (summaries ?? []).reduce<Map<string, number>>((acc, summary) => {
        const rootId = summary.category.parent_id ?? summary.category.id
        acc.set(rootId, (acc.get(rootId) ?? 0) + Number(summary.budget_amount))
        return acc
      }, new Map<string, number>())

      return rootExpenseCategories
        .map((rootCategory) => ({
          id: rootCategory.id,
          name: rootCategory.name,
          value: budgetByRoot.get(rootCategory.id) ?? 0,
          color: accentFromLabel(rootCategory.name),
        }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value)
    }

    const selectedCategory = categoryById.get(selectedCat)
    if (!selectedCategory) return []

    const entries = selectedCategory.parent_id
      ? [selectedCategory]
      : expenseSubCategories.filter((subCategory) => subCategory.parent_id === selectedCat)

    return entries
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        value: budgetByCategory.get(entry.id) ?? 0,
        color: accentFromLabel(entry.name),
      }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [summaries, selectedCat, rootExpenseCategories, categoryById, expenseSubCategories])
  const pieData = dataDisplayMode === 'budget' ? budgetPieData : realPieData

  const topFiveCategories = useMemo(() => pieData.slice(0, 5), [pieData])
  const pieTotal = useMemo(() => pieData.reduce((sum, item) => sum + item.value, 0), [pieData])
  const donutTopFiveCallouts = useMemo<DonutCallout[]>(() => {
    if (selectedCat !== 'all' || pieTotal <= 0 || donutAreaSize.width <= 0 || donutAreaSize.height <= 0) return []

    const topIds = new Set(topFiveCategories.map((entry) => entry.id))
    const cx = donutAreaSize.width * 0.5
    const cy = donutAreaSize.height * 0.54
    const outerRadius = 136
    const lineStartRadius = outerRadius + 2
    const lineBendRadius = outerRadius + 16
    const labelOffset = 36
    const radian = Math.PI / 180

    let cumulativeRatio = 0
    const callouts: DonutCallout[] = []

    pieData.forEach((entry) => {
      const ratio = entry.value / pieTotal
      const midAngle = 90 - (cumulativeRatio + ratio / 2) * 360
      cumulativeRatio += ratio

      if (!topIds.has(entry.id)) return

      const cos = Math.cos(-midAngle * radian)
      const sin = Math.sin(-midAngle * radian)
      const x0 = cx + lineStartRadius * cos
      const y0 = cy + lineStartRadius * sin
      const x1 = cx + lineBendRadius * cos
      const y1 = cy + lineBendRadius * sin
      const isRightSide = x1 >= cx
      const x2 = x1 + (isRightSide ? labelOffset : -labelOffset)
      const y2 = y1

      callouts.push({
        id: entry.id,
        name: entry.name,
        x0,
        y0,
        x1,
        y1,
        x2,
        y2,
        labelX: x2 + (isRightSide ? 4 : -4),
        labelY: y2,
        textAnchor: isRightSide ? 'start' : 'end',
      })
    })

    return callouts
  }, [selectedCat, pieTotal, donutAreaSize, topFiveCategories, pieData])
  const listSubCategoryRows = useMemo<SubCategoryTrendItem[]>(() => {
    if (selectedCat === 'all') return []
    const txs = periodTxns ?? []
    if (!expenseSubCategories.length) return []

    const totalsBySubCategory = txs.reduce<Map<string, number>>((acc, tx) => {
      if (!tx.category_id) return acc
      acc.set(tx.category_id, (acc.get(tx.category_id) ?? 0) + Number(tx.amount))
      return acc
    }, new Map<string, number>())

    const visibleSubCategories = expenseSubCategories.filter((subCat) => subCat.parent_id === selectedCat)

    return visibleSubCategories
      .map((subCat) => ({
        id: subCat.id,
        name: subCat.name,
        parentCategoryName: subCat.parent_id ? categoryById.get(subCat.parent_id)?.name ?? null : null,
        currentMonthAmount: totalsBySubCategory.get(subCat.id) ?? 0,
        previousMonthAmount: 0,
        threeMonthAvg: 0,
        trend: 'equal' as SubCatTrend,
      }))
      .filter((row) => row.currentMonthAmount > 0 || (budgetByCategoryId.get(row.id) ?? 0) > 0)
      .sort((a, b) => b.currentMonthAmount - a.currentMonthAmount)
  }, [periodTxns, expenseSubCategories, selectedCat, categoryById, budgetByCategoryId])

  const categoryBarRows = useMemo<CategoryBarRow[]>(() => {
    if (selectedCat === 'all') return []

    const rows = listSubCategoryRows
      .map((row) => {
        const budgetAmount = budgetByCategoryId.get(row.id) ?? 0
        const actualAmount = row.currentMonthAmount
        return {
          id: row.id,
          name: row.name,
          parentCategoryName: row.parentCategoryName,
          actualAmount,
          budgetAmount,
          displayAmount: actualAmount,
        } satisfies CategoryBarRow
      })
      .filter((row) => row.actualAmount > 0 || row.budgetAmount > 0)
      .sort((a, b) => b.displayAmount - a.displayAmount)

    return rows
  }, [selectedCat, listSubCategoryRows, budgetByCategoryId])
  const subCategoryRowById = useMemo(
    () => new Map(listSubCategoryRows.map((row) => [row.id, row])),
    [listSubCategoryRows],
  )
  const budgetProgressRows = useMemo(() => {
    const monthTxs = currentMonthAllExpenseTxns ?? []
    const monthSpentByCategory = monthTxs.reduce<Map<string, number>>((acc, tx) => {
      if (!tx.category_id) return acc
      acc.set(tx.category_id, (acc.get(tx.category_id) ?? 0) + Number(tx.amount))
      return acc
    }, new Map<string, number>())

    const monthSpentByRoot = monthTxs.reduce<Map<string, number>>((acc, tx) => {
      if (!tx.category_id) return acc
      const category = categoryById.get(tx.category_id)
      if (!category) return acc
      const rootId = category.parent_id ?? category.id
      acc.set(rootId, (acc.get(rootId) ?? 0) + Number(tx.amount))
      return acc
    }, new Map<string, number>())

    const budgetByCategory = (summaries ?? []).reduce<Map<string, number>>((acc, summary) => {
      acc.set(summary.category.id, (acc.get(summary.category.id) ?? 0) + Number(summary.budget_amount))
      return acc
    }, new Map<string, number>())

    const budgetByRoot = (summaries ?? []).reduce<Map<string, number>>((acc, summary) => {
      const rootId = summary.category.parent_id ?? summary.category.id
      acc.set(rootId, (acc.get(rootId) ?? 0) + Number(summary.budget_amount))
      return acc
    }, new Map<string, number>())

    const rows = selectedCat === 'all'
      ? rootExpenseCategories.map((rootCategory) => {
        const spent = monthSpentByRoot.get(rootCategory.id) ?? 0
        const budget = budgetByRoot.get(rootCategory.id) ?? 0
        return {
          id: rootCategory.id,
          name: rootCategory.name,
          parentCategoryName: null as string | null,
          spent,
          budget,
          sharePct: totalMonthlyBudget > 0 ? (budget / totalMonthlyBudget) * 100 : 0,
          accent: accentFromLabel(rootCategory.name),
        }
      })
      : (() => {
        const selectedCategory = categoryById.get(selectedCat)
        if (!selectedCategory) return []
        const children = selectedCategory.parent_id
          ? [selectedCategory]
          : expenseSubCategories.filter((subCategory) => subCategory.parent_id === selectedCat)
        const parentBudget = budgetByCategory.get(selectedCat) ?? totalMonthlyBudget
        return children.map((childCategory) => {
          const spent = monthSpentByCategory.get(childCategory.id) ?? 0
          const budget = budgetByCategory.get(childCategory.id) ?? 0
          return {
            id: childCategory.id,
            name: childCategory.name,
            parentCategoryName: childCategory.parent_id ? categoryById.get(childCategory.parent_id)?.name ?? null : null,
            spent,
            budget,
            sharePct: parentBudget > 0 ? (budget / parentBudget) * 100 : 0,
            accent: accentFromLabel(childCategory.name),
          }
        })
      })()

    const filtered = rows
      .filter((row) => row.spent > 0 || row.budget > 0)
      .sort((a, b) => b.spent - a.spent)

    const topFiveIds = new Set(filtered.slice(0, 5).map((row) => row.id))

    return filtered.map((row) => {
      const ratio = row.budget > 0 ? row.spent / row.budget : 0
      const progressPct = row.budget > 0 ? Math.min(ratio * 100, 100) : (row.spent > 0 ? 100 : 0)
      const statusColor = ratio > 1
        ? 'var(--color-error)'
        : ratio >= 0.8
          ? 'var(--color-warning)'
          : 'var(--color-success)'

      return {
        ...row,
        progressPct,
        remaining: row.budget - row.spent,
        statusColor,
        isTopFive: selectedCat === 'all' && topFiveIds.has(row.id),
      }
    })
  }, [currentMonthAllExpenseTxns, categoryById, summaries, selectedCat, rootExpenseCategories, totalMonthlyBudget, expenseSubCategories])

  const periodSpentByCategory = useMemo(() => {
    return (periodTxns ?? []).reduce<Map<string, number>>((acc, tx) => {
      if (!tx.category_id) return acc
      acc.set(tx.category_id, (acc.get(tx.category_id) ?? 0) + Number(tx.amount))
      return acc
    }, new Map<string, number>())
  }, [periodTxns])

  const blockRows = useMemo<BudgetBlockRow[]>(() => {
    const initial = new Map<BudgetBlockId, BudgetBlockRow>()
    BUDGET_BLOCKS.forEach((block) => {
      initial.set(block.id, {
        id: block.id,
        label: block.label,
        color: block.color,
        budgetAmount: 0,
        actualAmount: 0,
        lines: [],
      })
    })

    const isVisibleLine = (categoryId: string | null, parentCategoryId: string | null): boolean => {
      if (selectedCat === 'all') return true
      if (!categoryId) return false
      return categoryId === selectedCat || parentCategoryId === selectedCat
    }

    for (const line of configuredBudgetCategoryLines) {
      if (!isVisibleLine(line.category_id, line.parent_category_id)) continue
      const blockId = mapBudgetBucketToBlock(line.budget_bucket)
      if (!blockId) continue
      const target = initial.get(blockId)
      if (!target) continue

      const budgetAmount = Number(line.amount ?? 0)
      const actualAmount = line.category_id ? (periodSpentByCategory.get(line.category_id) ?? 0) : 0

      target.budgetAmount += budgetAmount
      target.actualAmount += actualAmount
      target.lines.push({
        id: line.id,
        categoryName: line.category_name ?? 'Catégorie',
        parentCategoryName: line.parent_category_name,
        budgetAmount,
        actualAmount,
      })
    }

    return BUDGET_BLOCKS
      .map((block) => initial.get(block.id)!)
      .map((row) => ({
        ...row,
        lines: [...row.lines].sort((a, b) => {
          const amountA = dataDisplayMode === 'budget' ? a.budgetAmount : a.actualAmount
          const amountB = dataDisplayMode === 'budget' ? b.budgetAmount : b.actualAmount
          return amountB - amountA
        }),
      }))
      .filter((row) => row.budgetAmount > 0 || row.actualAmount > 0)
  }, [configuredBudgetCategoryLines, selectedCat, periodSpentByCategory, dataDisplayMode])

  const blockPieData = useMemo<PieDatum[]>(
    () =>
      blockRows
        .map((row) => ({
          id: row.id,
          name: row.label,
          value: dataDisplayMode === 'budget' ? row.budgetAmount : row.actualAmount,
          color: row.color,
        }))
        .filter((row) => row.value > 0),
    [blockRows, dataDisplayMode],
  )
  const blockDonutTotal = useMemo(
    () => blockPieData.reduce((sum, row) => sum + row.value, 0),
    [blockPieData],
  )
  const selectedBlock = useMemo(
    () => (selectedBlockId ? blockRows.find((row) => row.id === selectedBlockId) ?? null : null),
    [selectedBlockId, blockRows],
  )

  const subCategoryModalTitle = selectedSubCategory
    ? `${selectedSubCategory.name} - ${getPeriodLabel(periodKey, nowYear, selectedPeriodMonth)}`
    : ''
  const configuredPeriodLabel = configuredBudgetPeriod
    ? formatPeriodLabel(
      configuredBudgetPeriod.period_year,
      configuredBudgetPeriod.period_month,
      configuredBudgetPeriod.label,
    )
    : 'Aucune période'
  const headerPeriodLabel = periodKey === 'annee'
    ? `Année ${nowYear}`
    : formatPeriodLabel(nowYear, selectedPeriodMonth)
  const elapsedMonths = useMemo(
    () => Array.from({ length: nowMonth + 1 }, (_, index) => nowMonth + 1 - index),
    [nowMonth],
  )

  const handleConfiguredPeriodChange = useCallback((nextPeriodId: string) => {
    const period = configuredBudgetPeriods.find((row) => row.id === nextPeriodId) ?? null
    setConfiguredBudgetPeriod(period)
    if (!period) return
    if (period.period_year !== nowYear) return
    if (period.period_month < 1 || period.period_month > nowMonth + 1) return
    setPeriodKey('mois')
    setSelectedPeriodMonth(period.period_month)
  }, [configuredBudgetPeriods, nowYear, nowMonth, setConfiguredBudgetPeriod])

  const syncConfiguredPeriodForMonth = useCallback((nextMonth: number) => {
    const matched = configuredBudgetPeriods.find(
      (period) => period.period_year === nowYear && period.period_month === nextMonth,
    ) ?? null
    if (matched) setConfiguredBudgetPeriod(matched)
  }, [configuredBudgetPeriods, nowYear, setConfiguredBudgetPeriod])

  const headerPeriodOptions = useMemo(() => {
    const monthOptions = elapsedMonths.map((monthNumber) => ({
      key: `month-${monthNumber}`,
      label: formatPeriodLabel(nowYear, monthNumber),
      active: periodKey === 'mois' && selectedPeriodMonth === monthNumber,
      onSelect: () => {
        setPeriodKey('mois')
        setSelectedPeriodMonth(monthNumber)
        syncConfiguredPeriodForMonth(monthNumber)
      },
    }))

    const yearOption = {
      key: `year-${nowYear}`,
      label: `année ${nowYear}`,
      active: periodKey === 'annee',
      showDividerBefore: true,
      onSelect: () => {
        setPeriodKey('annee')
        const fallbackMonth = Math.max(1, Math.min(nowMonth + 1, selectedPeriodMonth))
        syncConfiguredPeriodForMonth(fallbackMonth)
      },
    }

    return [...monthOptions, yearOption]
  }, [elapsedMonths, nowMonth, nowYear, periodKey, selectedPeriodMonth, syncConfiguredPeriodForMonth])

  useEffect(() => {
    if (!configuredBudgetPeriods.length) return
    syncConfiguredPeriodForMonth(nowMonth + 1)
  }, [configuredBudgetPeriods.length, nowMonth, syncConfiguredPeriodForMonth])

  const showExtendedSlides = selectedCat === 'all'
  const isCategoryMode = selectedCat !== 'all'
  const slideCount = showExtendedSlides ? 3 : 2
  const slideTitles = showExtendedSlides
    ? ([
        'Répartition par catégorie',
        'Répartition par bloc',
        'Évolutions 6 derniers mois',
      ] as const)
    : ([
        'Répartition par sous-catégorie',
        'Évolutions 6 derniers mois',
      ] as const)
  const showRealBudgetToggle = showExtendedSlides && activeSlide < 2
  const goToSlide = (index: number) => setActiveSlide(((index % slideCount) + slideCount) % slideCount)
  const goNextSlide = () => goToSlide(activeSlide + 1)
  const goPrevSlide = () => goToSlide(activeSlide - 1)

  useEffect(() => {
    setActiveSlide((current) => Math.min(current, slideCount - 1))
  }, [slideCount])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return
    dragStartXRef.current = event.clientX
    dragDeltaXRef.current = 0
    setIsDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartXRef.current == null) return
    dragDeltaXRef.current = event.clientX - dragStartXRef.current
  }

  const endSwipe = () => {
    const delta = dragDeltaXRef.current
    dragStartXRef.current = null
    dragDeltaXRef.current = 0
    setIsDragging(false)
    if (Math.abs(delta) < 50) return
    if (delta < 0) goNextSlide()
    else goPrevSlide()
  }

  useEffect(() => {
    if (!selectedDonutSlice) return
    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (donutTooltipRef.current && !donutTooltipRef.current.contains(target)) {
        setSelectedDonutSlice(null)
      }
    }
    document.addEventListener('mousedown', onDocumentMouseDown)
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown)
    }
  }, [selectedDonutSlice])

  useEffect(() => {
    setSelectedDonutSlice(null)
  }, [dataDisplayMode, periodKey, selectedPeriodMonth, selectedCat])

  useEffect(() => {
    if (!selectedBlockId) return
    if (blockRows.some((row) => row.id === selectedBlockId)) return
    setSelectedBlockId(null)
  }, [selectedBlockId, blockRows])

  useEffect(() => {
    if (!pendingTransaction || selectedSubCategory) return
    const timeoutId = window.setTimeout(() => {
      setSelectedTransaction(pendingTransaction)
      setPendingTransaction(null)
    }, 280)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [pendingTransaction, selectedSubCategory])

  const handleSelectTransactionFromSubCategory = (transaction: Transaction) => {
    setSubCategoryTransactionSequence(subCategoryTransactions ?? [])
    if (selectedSubCategory) {
      setSubCategoryToReopen(selectedSubCategory)
      setSelectedSubCategory(null)
    }
    setPendingTransaction(transaction)
  }

  const handleCloseTransactionDetails = () => {
    setSelectedTransaction(null)
    setSubCategoryToReopen(null)
    setSubCategoryTransactionSequence([])
    setPendingTransaction(null)
  }

  const handleBackToSubCategoryList = () => {
    setSelectedTransaction(null)
    if (subCategoryToReopen) {
      const nextSubCategory = subCategoryToReopen
      setSubCategoryToReopen(null)
      window.setTimeout(() => {
        setSelectedSubCategory(nextSubCategory)
      }, 120)
    }
  }

  const selectedSlicePct = selectedDonutSlice && pieTotal > 0 ? (selectedDonutSlice.value / pieTotal) * 100 : 0
  const donutCenterAmount = dataDisplayMode === 'budget' ? totalMonthlyBudget : selectedPeriodSpent
  const donutCenterLabel = dataDisplayMode === 'budget' ? 'budgétés' : 'dépensés'
  const categoryBarMaxAmount = useMemo(
    () => categoryBarRows.reduce((max, row) => Math.max(max, row.displayAmount), 0),
    [categoryBarRows],
  )
  const sixMonthAverageAmount = useMemo(() => {
    if (!monthlyHistory.length) return 0
    return monthlyHistory.reduce((sum, row) => sum + row.amount, 0) / monthlyHistory.length
  }, [monthlyHistory])
  const sixMonthAverageGapPct = useMemo(() => {
    const rows = monthlyHistory.filter((row) => row.budget > 0)
    if (!rows.length) return null
    const total = rows.reduce((sum, row) => sum + ((row.amount - row.budget) / row.budget) * 100, 0)
    return total / rows.length
  }, [monthlyHistory])
  const selectedPeriodGapPct = useMemo(() => {
    if (totalMonthlyBudget <= 0) return null
    return ((selectedPeriodSpent - totalMonthlyBudget) / totalMonthlyBudget) * 100
  }, [selectedPeriodSpent, totalMonthlyBudget])
  const historyBudgetTarget = Math.max(0, Number(totalMonthlyBudget))
  const historyYAxisTicks = useMemo(() => {
    const maxHistory = monthlyHistory.reduce((max, row) => Math.max(max, Number(row.amount ?? 0)), 0)
    const maxValue = Math.max(maxHistory, historyBudgetTarget)
    if (maxValue <= 0) return [0]

    const step = Math.max(100, Math.ceil((maxValue / 4) / 100) * 100)
    const top = Math.ceil(maxValue / step) * step
    const ticks: number[] = []

    for (let value = 0; value <= top; value += step) ticks.push(value)

    if (!ticks.some((value) => Math.abs(value - historyBudgetTarget) < step * 0.04)) {
      ticks.push(historyBudgetTarget)
      ticks.sort((a, b) => a - b)
    }

    return ticks
  }, [historyBudgetTarget, monthlyHistory])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isCategoryMode ? 'var(--space-4)' : 'var(--space-5)', paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom-offset))' }}>
      <PageHeader
        title="Budgets"
        titleAriaLabel="Réinitialiser sur toutes catégories et période actuelle"
        onTitleClick={handleHeaderTitleReset}
        actionIcon={
          selectedCat === 'all'
            ? <Search size={24} />
            : <CategoryIcon categoryName={selectedCatInfo?.name} size={28} fallback="💰" />
        }
        actionAriaLabel="Choisir une catégorie"
        onActionClick={() => {
          setShowHeaderPeriodMenu(false)
          setShowCatSheet((current) => !current)
        }}
        rightSlot={(
          <HeaderPeriodMenu
            buttonLabel={headerPeriodLabel}
            buttonAriaLabel="Choisir une période"
            menuAriaLabel="Choisir une période Budgets"
            open={showHeaderPeriodMenu}
            onOpenChange={setShowHeaderPeriodMenu}
            onBeforeToggle={() => setShowCatSheet(false)}
            options={headerPeriodOptions}
          />
        )}
      />

      {isCategoryMode ? (
        <motion.section initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} style={{ padding: '0 var(--space-6)', marginTop: 'calc(var(--space-2) * -1)' }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Retour"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--neutral-700)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                padding: 0,
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 700,
              }}
            >
              <ArrowLeft size={16} />
              Retour
            </button>
          </div>
        </motion.section>
      ) : null}

      {showRealBudgetToggle ? (
        <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ padding: '0 var(--space-6)' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', justifyItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
              <button type="button" onClick={() => setDataDisplayMode('reel')} style={{ border: '1px solid var(--neutral-200)', background: dataDisplayMode === 'reel' ? 'var(--primary-50)' : 'var(--neutral-0)', color: dataDisplayMode === 'reel' ? 'var(--primary-600)' : 'var(--neutral-600)', fontSize: 'var(--font-size-sm)', fontWeight: 700, borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minWidth: 124, textAlign: 'center', cursor: 'pointer' }}>
                Réel
              </button>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)', fontWeight: 700 }}>-</span>
              <button type="button" onClick={() => setDataDisplayMode('budget')} style={{ border: '1px solid var(--neutral-200)', background: dataDisplayMode === 'budget' ? 'var(--primary-50)' : 'var(--neutral-0)', color: dataDisplayMode === 'budget' ? 'var(--primary-600)' : 'var(--neutral-600)', fontSize: 'var(--font-size-sm)', fontWeight: 700, borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minWidth: 124, textAlign: 'center', cursor: 'pointer' }}>
                Budget
              </button>
            </div>
            {showExtendedSlides ? (
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: selectedPeriodGapPct == null ? 'var(--neutral-500)' : selectedPeriodGapPct > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                {selectedPeriodGapPct == null ? '—' : formatPercentSigned(selectedPeriodGapPct)}
              </p>
            ) : null}
          </div>
        </motion.section>
      ) : null}

      {isCategoryMode ? (
        <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ padding: '0 var(--space-6)' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <p style={{ margin: 0, minWidth: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {`catégorie : ${selectedCatInfo?.name ?? '—'}`}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-700)', fontWeight: 700, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                {categoryRanking ? `Rang ${categoryRanking.index}/${categoryRanking.total}` : 'Rang —'}
              </p>
            </div>
            <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-lg)', background: 'var(--neutral-0)', padding: 'var(--space-2) var(--space-3)', display: 'grid', gap: 'var(--space-1)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 'var(--space-1) var(--space-2)' }}>
                <div style={{ minWidth: 0, display: 'grid', gap: 1 }}>
                  <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700 }}>Bloc</p>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--neutral-900)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                    {formatBudgetBucketLabel(dominantCategoryBudgetLine?.budget_bucket)}
                  </p>
                </div>
                <div style={{ minWidth: 0, display: 'grid', gap: 1 }}>
                  <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700 }}>Budget mensuel</p>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--neutral-900)', fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1.3 }}>
                    {formatMoney(categoryMonthlyBudget)}
                  </p>
                </div>
                <div style={{ minWidth: 0, display: 'grid', gap: 1 }}>
                  <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700 }}>Méthode</p>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--neutral-900)', fontWeight: 700, textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                    {categoryMethodLabel}
                  </p>
                </div>
                <div style={{ minWidth: 0, display: 'grid', gap: 1 }}>
                  <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700 }}>Tolérance</p>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--neutral-900)', fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1.3 }}>
                    {toleranceByBucket(dominantCategoryBudgetLine?.budget_bucket)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      ) : null}

      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ display: 'grid', gap: 'var(--space-2)', justifyItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 600, overflow: 'hidden', position: 'relative', touchAction: 'pan-y' }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={endSwipe} onPointerCancel={endSwipe} onPointerLeave={() => { if (isDragging) endSwipe() }}>
          <div style={{ display: 'flex', width: `${slideCount * 100}%`, transform: `translateX(-${(100 / slideCount) * activeSlide}%)`, transition: 'transform 300ms ease' }}>
            <div style={{ width: `${100 / slideCount}%`, flexShrink: 0, display: 'grid', gap: 'var(--space-1)' }}>
              {selectedCat === 'all' ? (
                <div ref={donutAreaRef} style={{ position: 'relative', height: 336 }}>
                  {selectedDonutSlice ? (
                    <div ref={donutTooltipRef} style={{ position: 'absolute', top: 'var(--space-2)', left: '50%', transform: 'translateX(-50%)', background: 'var(--neutral-0)', border: '1px solid var(--neutral-200)', boxShadow: 'var(--shadow-md)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', zIndex: 3, minWidth: 220, textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-900)' }}>{selectedDonutSlice.name}</p>
                      <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-700)' }}>{`${formatMoney(selectedDonutSlice.value)} · ${selectedSlicePct.toFixed(0)}%`}</p>
                    </div>
                  ) : null}
                  {donutTopFiveCallouts.length > 0 ? (
                    <svg width="100%" height="100%" viewBox={`0 0 ${Math.max(donutAreaSize.width, 1)} ${Math.max(donutAreaSize.height, 1)}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
                      {donutTopFiveCallouts.map((callout) => (
                        <g key={callout.id}>
                          <polyline points={`${callout.x0},${callout.y0} ${callout.x1},${callout.y1} ${callout.x2},${callout.y2}`} fill="none" stroke="var(--neutral-500)" strokeWidth={1.25} strokeDasharray="2.5 2.5" />
                          <text x={callout.labelX} y={callout.labelY} textAnchor={callout.textAnchor} dominantBaseline="central" fill="var(--neutral-700)" fontSize={11} fontWeight={700}>
                            {callout.name}
                          </text>
                        </g>
                      ))}
                    </svg>
                  ) : null}
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="54%" innerRadius={86} outerRadius={136} startAngle={90} endAngle={-270} paddingAngle={2} stroke="var(--neutral-0)" strokeWidth={1} onClick={(slice: unknown) => {
                        const payload = extractPiePayload(slice)
                        setSelectedDonutSlice({
                          id: String(payload?.id ?? 'slice'),
                          name: String(payload?.name ?? 'Catégorie'),
                          value: Number(payload?.value ?? 0),
                          color: String(payload?.color ?? 'var(--primary-500)'),
                        })
                      }} labelLine={false} label={(props: unknown) => {
                        const labelProps = (props ?? {}) as PieLabelProps
                        const payload = labelProps.payload
                        if (!payload || pieTotal <= 0) return null
                        const { cx, cy, midAngle, innerRadius, outerRadius } = labelProps
                        if (typeof cx !== 'number' || typeof cy !== 'number' || typeof midAngle !== 'number' || typeof innerRadius !== 'number' || typeof outerRadius !== 'number') return null
                        const pct = (payload.value / pieTotal) * 100
                        if (pct < 8) return null
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.56
                        const radian = Math.PI / 180
                        const x = cx + radius * Math.cos(-midAngle * radian)
                        const y = cy + radius * Math.sin(-midAngle * radian)
                        return <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="var(--neutral-900)" fontSize={12} fontWeight={700}>{`${pct.toFixed(0)}%`}</text>
                      }}>
                        {pieData.map((entry) => {
                          const active = selectedDonutSlice?.id === entry.id
                          return <Cell key={entry.id} fill={entry.color} fillOpacity={active || !selectedDonutSlice ? 1 : 0.72} stroke={active ? 'var(--neutral-900)' : 'var(--neutral-0)'} strokeWidth={active ? 2 : 1} style={active ? { filter: 'drop-shadow(0 0 8px rgba(67,97,238,0.32)) brightness(1.06)' } : undefined} />
                        })}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', top: '54%', left: '50%', transform: 'translate(-50%, -50%)', width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 'var(--space-1)' }}>
                      <span style={{ fontSize: 'clamp(18px, 5.5vw, 28px)', fontWeight: 700, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', lineHeight: 1.05 }}>
                        {formatMoney(donutCenterAmount)}
                      </span>
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--neutral-500)', lineHeight: 1.1 }}>
                        {donutCenterLabel}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    height: 336,
                    border: '1px solid var(--neutral-200)',
                    borderRadius: 'var(--radius-xl)',
                    background: 'color-mix(in oklab, var(--neutral-0) 92%, var(--neutral-100) 8%)',
                    padding: 'var(--space-3)',
                    display: 'grid',
                    alignContent: 'start',
                    gap: 'var(--space-2)',
                  }}
                >
                  {categoryBarRows.length === 0 ? (
                    <div style={{ height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--neutral-400)', fontSize: 'var(--font-size-sm)' }}>
                      Aucune sous-catégorie active sur cette période
                    </div>
                  ) : (
                    categoryBarRows.map((row) => {
                      const source = subCategoryRowById.get(row.id)
                      if (!source) return null
                      const barWidth = categoryBarMaxAmount > 0 ? (row.displayAmount / categoryBarMaxAmount) * 100 : 0
                      const accent = accentFromLabel(row.name)
                      return (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => setSelectedSubCategory(source)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            padding: '3px 2px',
                            cursor: 'pointer',
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0,122px) minmax(0,1fr)',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 0 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-sm)', background: accent, flexShrink: 0 }} />
                            <span style={{ minWidth: 0, fontSize: 12, lineHeight: 1.3, color: 'var(--neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {row.name}
                            </span>
                          </span>
                          <span style={{ display: 'grid', gap: 2 }}>
                            <span style={{ width: '100%', height: 11, borderRadius: 'var(--radius-full)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                              <span
                                style={{
                                  width: `${row.displayAmount <= 0 ? 0 : Math.max(6, Math.min(barWidth, 100))}%`,
                                  height: '100%',
                                  display: 'block',
                                  borderRadius: 'var(--radius-full)',
                                  background: accent,
                                }}
                              />
                            </span>
                            <span style={{ fontSize: 10, lineHeight: 1.25, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                              {formatMoney(row.displayAmount)}
                            </span>
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {showExtendedSlides ? (
              <div style={{ width: `${100 / slideCount}%`, flexShrink: 0, display: 'grid', gap: 'var(--space-1)' }}>
                <div style={{ position: 'relative', height: 336 }}>
                  {blockPieData.length === 0 ? (
                    <div style={{ height: '100%', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--neutral-300)', background: 'var(--neutral-50)', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--neutral-500)', fontSize: 'var(--font-size-sm)', padding: 'var(--space-6)' }}>
                      Aucune répartition disponible pour cette période.
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={blockPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="54%"
                            innerRadius={82}
                            outerRadius={132}
                            startAngle={90}
                            endAngle={-270}
                            paddingAngle={2}
                            stroke="var(--neutral-0)"
                            strokeWidth={1}
                            onClick={(slice: unknown) => {
                              const payload = extractPiePayload(slice)
                              const blockId = String(payload?.id ?? '')
                              if (blockId === 'fixe' || blockId === 'variable_essentiel' || blockId === 'discretionnaire' || blockId === 'epargne' || blockId === 'cagnotte') {
                                setSelectedBlockId(blockId)
                              }
                            }}
                            labelLine={false}
                            label={(props: unknown) => {
                              const labelProps = (props ?? {}) as PieLabelProps
                              const payload = labelProps.payload
                              if (!payload || blockDonutTotal <= 0) return null
                              const { cx, cy, midAngle, innerRadius, outerRadius } = labelProps
                              if (typeof cx !== 'number' || typeof cy !== 'number' || typeof midAngle !== 'number' || typeof innerRadius !== 'number' || typeof outerRadius !== 'number') return null
                              const pct = (payload.value / blockDonutTotal) * 100
                              if (pct < 8) return null
                              const radius = innerRadius + (outerRadius - innerRadius) * 0.56
                              const radian = Math.PI / 180
                              const x = cx + radius * Math.cos(-midAngle * radian)
                              const y = cy + radius * Math.sin(-midAngle * radian)
                              return <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="var(--neutral-900)" fontSize={12} fontWeight={700}>{`${pct.toFixed(0)}%`}</text>
                            }}
                          >
                            {blockPieData.map((entry) => {
                              const active = selectedBlockId === entry.id
                              return (
                                <Cell
                                  key={entry.id}
                                  fill={entry.color}
                                  fillOpacity={active || !selectedBlockId ? 1 : 0.7}
                                  stroke={active ? 'var(--neutral-900)' : 'var(--neutral-0)'}
                                  strokeWidth={active ? 2 : 1}
                                />
                              )
                            })}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ position: 'absolute', top: '54%', left: '50%', transform: 'translate(-50%, -50%)', width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 'var(--space-1)' }}>
                          <span style={{ fontSize: 'clamp(18px, 5.5vw, 28px)', fontWeight: 700, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', lineHeight: 1.05 }}>
                            {formatMoney(blockDonutTotal)}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--neutral-500)', lineHeight: 1.1 }}>
                            {dataDisplayMode === 'budget' ? 'budgétés par bloc' : 'dépensés par bloc'}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ width: `${100 / slideCount}%`, flexShrink: 0, display: 'grid', gap: 'var(--space-1)' }}>
                <div style={{ height: 332 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyHistory} barCategoryGap="18%" margin={{ top: 8, right: 30, left: 6, bottom: 4 }}>
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--neutral-500)' }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--neutral-500)' }} tickFormatter={(value) => formatMoney(Number(value))} width={68} />
                      <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(67,97,238,0.08)' }} />
                      <ReferenceLine y={totalMonthlyBudget} stroke="var(--color-warning)" strokeWidth={2} strokeDasharray="4 4" label={{ value: 'Budget mensuel', position: 'right', fill: 'var(--neutral-600)', fontSize: 11 }} />
                      <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={46}>
                        <LabelList dataKey="amount" position="top" offset={8} content={(props: unknown) => {
                          const { x, y, width, payload } = (props ?? {}) as LabelListContentProps
                          const item = payload
                          if (!item || item.isCurrent || x == null || y == null || width == null) return null
                          return <text x={Number(x) + Number(width) / 2} y={Number(y) - 6} textAnchor="middle" fill="var(--neutral-900)" fontSize={12} fontWeight={700}>{formatMoney(item.amount)}</text>
                        }} />
                        {monthlyHistory.map((entry, i) => <Cell key={`history-${i}`} fill="var(--primary-500)" fillOpacity={entry.isCurrent ? 1 : 0.62} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 'var(--space-3)', padding: '0 var(--space-2)' }}>
                  <div style={{ display: 'grid', gap: 2 }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Montant moyen mensuel
                    </span>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {formatMoney(sixMonthAverageAmount)}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gap: 2 }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Pourcentage moyen d&apos;écart
                    </span>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: sixMonthAverageGapPct == null ? 'var(--neutral-500)' : sixMonthAverageGapPct > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                      {sixMonthAverageGapPct == null ? '—' : `${sixMonthAverageGapPct > 0 ? '+' : ''}${sixMonthAverageGapPct.toFixed(1)}%`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {showExtendedSlides ? (
              <div style={{ width: `${100 / slideCount}%`, flexShrink: 0, display: 'grid', gap: 'var(--space-3)' }}>
                <div style={{ height: 332 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyHistory} barCategoryGap="18%" margin={{ top: 8, right: 30, left: 6, bottom: 4 }}>
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--neutral-500)' }} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={({ x, y, payload }: { x?: number; y?: number; payload?: { value?: number } }) => {
                          const value = Number(payload?.value ?? 0)
                          const isBudgetTick = Math.abs(value - historyBudgetTarget) < 0.5
                          return (
                            <text
                              x={x ?? 0}
                              y={y ?? 0}
                              dy={3}
                              textAnchor="end"
                              fontSize={11}
                              fill={isBudgetTick ? 'var(--color-error)' : 'var(--neutral-500)'}
                              fontWeight={isBudgetTick ? 700 : 500}
                            >
                              {formatMoney(value)}
                            </text>
                          )
                        }}
                        ticks={historyYAxisTicks}
                        width={68}
                      />
                      <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(67,97,238,0.08)' }} />
                      <ReferenceLine y={historyBudgetTarget} stroke="var(--color-error)" strokeWidth={2} strokeDasharray="4 4" />
                      <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={46}>
                        <LabelList dataKey="amount" position="top" offset={8} content={(props: unknown) => {
                          const { x, y, width, payload } = (props ?? {}) as LabelListContentProps
                          const item = payload
                          if (!item || item.isCurrent || x == null || y == null || width == null) return null
                          return <text x={Number(x) + Number(width) / 2} y={Number(y) - 6} textAnchor="middle" fill="var(--neutral-900)" fontSize={12} fontWeight={700}>{formatMoney(item.amount)}</text>
                        }} />
                        {monthlyHistory.map((entry, i) => <Cell key={`history-${i}`} fill="var(--primary-500)" fillOpacity={entry.isCurrent ? 1 : 0.62} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 'var(--space-3)', padding: '0 var(--space-2)', justifyItems: 'center', textAlign: 'center' }}>
                  <div style={{ display: 'grid', gap: 2 }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Montant moyen
                    </span>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {formatMoney(sixMonthAverageAmount)}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gap: 2 }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Écart moyen
                    </span>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: sixMonthAverageGapPct == null ? 'var(--neutral-500)' : sixMonthAverageGapPct > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                      {sixMonthAverageGapPct == null ? '—' : formatPercentSigned(sixMonthAverageGapPct)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)', fontWeight: 600, textAlign: 'center' }}>
          {slideTitles[activeSlide]}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-2)' }}>
          {Array.from({ length: slideCount }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => goToSlide(idx)}
              aria-label={`Aller au graphique ${idx + 1}`}
              style={{
                minWidth: 'var(--touch-target-min)',
                minHeight: 'var(--touch-target-min)',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                padding: 0,
                background: 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all var(--transition-base)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: idx === activeSlide ? 14 : 8,
                  height: idx === activeSlide ? 14 : 8,
                  borderRadius: 'var(--radius-full)',
                  background: idx === activeSlide ? 'var(--primary-500)' : 'var(--neutral-300)',
                }}
              />
            </button>
          ))}
        </div>
      </motion.section>

      {selectedCat === 'all' ? (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ width: '100%', maxWidth: 600, margin: '0 auto', padding: 'var(--space-4) var(--space-4) 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', paddingBottom: 'var(--space-4)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--neutral-500)' }}>
              {dataDisplayMode === 'budget' ? 'Enveloppes budgétaires par catégorie' : 'Consommé VS restant par catégorie'}
            </p>
            <span style={{ flex: 1, height: 1, background: 'var(--neutral-200)' }} />
          </div>

          {budgetProgressRows.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--neutral-400)', padding: 'var(--space-8) 0' }}>Aucune catégorie à afficher</div>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              {budgetProgressRows.map((row) => {
                const remainingAmount = Math.max(0, row.remaining)
                const displayedRowAmount = dataDisplayMode === 'budget' ? row.budget : row.spent
                const rowProgress = dataDisplayMode === 'budget'
                  ? Math.max(0, Math.min(row.sharePct, 100))
                  : row.progressPct
                const rowTo = `/budgets?category=${row.id}`
                return (
                  <Link
                    key={row.id}
                    to={rowTo}
                    style={{
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'grid',
                      gap: 'var(--space-1)',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--neutral-200)',
                      paddingBottom: 'var(--space-2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--neutral-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.name}
                      </p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--primary-500)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                        {formatMoney(displayedRowAmount)}
                      </p>
                    </div>

                    <div style={{ width: '100%', height: 7, borderRadius: 'var(--radius-pill)', background: 'var(--neutral-200)', overflow: 'hidden' }}>
                      <div style={{ width: `${rowProgress}%`, height: '100%', borderRadius: 'var(--radius-pill)', background: row.accent, transition: 'width var(--transition-base), background-color var(--transition-base)' }} />
                    </div>

                    <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-600)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {dataDisplayMode === 'budget'
                        ? `${row.sharePct.toFixed(0)}% du budget`
                        : `Restant ${formatMoney(remainingAmount)}`}
                    </p>
                  </Link>
                )
              })}
            </div>
          )}
        </motion.section>
      ) : null}

      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }} style={{ width: '100%', maxWidth: 600, margin: '0 auto', padding: 'var(--space-4) var(--space-4) 0', display: 'grid', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', paddingBottom: 'var(--space-2)' }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--neutral-500)' }}>
            Pilotage budget configuré
          </p>
          <span style={{ flex: 1, height: 1, background: 'var(--neutral-200)' }} />
        </div>

        <div style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--neutral-200)', padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Période budgétaire
            </p>
            <p style={{ margin: 0, fontSize: 'var(--font-size-md)', color: 'var(--neutral-900)', fontWeight: 800 }}>
              {configuredPeriodLabel}
            </p>
          </div>

          {configuredBudgetPeriods.length > 1 ? (
            <label style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <span style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Changer de période
              </span>
              <select
                value={configuredBudgetPeriod?.id ?? ''}
                onChange={(event) => handleConfiguredPeriodChange(event.target.value)}
                disabled={configuredBudgetLoading}
                style={{
                  width: '100%',
                  minHeight: 'var(--touch-target-min)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--neutral-200)',
                  background: 'var(--neutral-0)',
                  color: 'var(--neutral-900)',
                  padding: '0 var(--space-4)',
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 700,
                }}
              >
                {configuredBudgetPeriods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {formatPeriodLabel(period.period_year, period.period_month, period.label)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {configuredBudgetError ? (
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-error)', fontWeight: 600 }}>
                {configuredBudgetError}
              </p>
              <div>
                <Button type="button" variant="secondary" size="sm" onClick={() => void reloadConfiguredBudget()}>
                  Réessayer
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </motion.section>

      {configuredBudgetPeriod ? (
        <>
          <BudgetSummaryCards summary={configuredBudgetSummary} />
          <BudgetParentGroups groups={configuredBudgetParentGroups} />
          <BudgetVsActualSection
            summary={configuredBudgetSummary}
            categoryLines={configuredBudgetCategoryLines}
            actuals={configuredBudgetActuals}
            hasActuals={configuredBudgetHasActuals}
          />
          <BudgetCategoryList
            lines={configuredBudgetCategoryLines}
            actualCategoryMetrics={configuredBudgetActuals?.categoryActuals ?? []}
            hasActuals={configuredBudgetHasActuals}
          />
        </>
      ) : null}

      <AnimatePresence>
        {selectedBlock ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBlockId(null)}
              style={{ position: 'fixed', inset: 0, zIndex: 230, background: 'rgba(13,13,31,0.56)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`Détail du bloc ${selectedBlock.label}`}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 330 }}
              style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 231,
                width: '100%',
                maxWidth: 512,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: '24px 24px 0 0',
                maxHeight: '82dvh',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                <div style={{ display: 'grid', gap: 2 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--neutral-900)' }}>
                    {selectedBlock.label}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-500)' }}>
                    {dataDisplayMode === 'budget' ? 'Vue budget' : 'Vue réel'}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedBlockId(null)} style={{ border: 'none', background: 'var(--neutral-100)', color: 'var(--neutral-600)', minWidth: 'var(--touch-target-min)', minHeight: 'var(--touch-target-min)', borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label="Fermer">
                  <X size={15} />
                </button>
              </div>
              <div style={{ maxHeight: 'calc(82dvh - 72px)', overflowY: 'auto' }}>
                {selectedBlock.lines.length === 0 ? (
                  <p style={{ margin: 0, padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)' }}>
                    Aucune ligne disponible
                  </p>
                ) : (
                  selectedBlock.lines.map((line) => {
                    const displayedAmount = dataDisplayMode === 'budget' ? line.budgetAmount : line.actualAmount
                    const secondaryAmount = dataDisplayMode === 'budget' ? line.actualAmount : line.budgetAmount
                    return (
                      <div key={line.id} style={{ borderBottom: '1px solid var(--neutral-200)', padding: 'var(--space-3) var(--space-5)', display: 'grid', gap: 'var(--space-1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--neutral-800)' }}>
                            {line.categoryName}
                          </span>
                          <span style={{ fontSize: 13, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', fontWeight: 700 }}>
                            {formatMoney(displayedAmount)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--neutral-500)' }}>
                            {line.parentCategoryName ?? 'Autres'}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                            {dataDisplayMode === 'budget' ? `Réel ${formatMoney(secondaryAmount)}` : `Budget ${formatMoney(secondaryAmount)}`}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <SubCategoryTransactionsModal open={Boolean(selectedSubCategory)} onClose={() => { setSelectedSubCategory(null); setSubCategoryToReopen(null); setPendingTransaction(null); setSubCategoryTransactionSequence([]) }} title={subCategoryModalTitle} transactions={subCategoryTransactions ?? []} loading={loadingSubCategoryTransactions} onSelectTransaction={handleSelectTransactionFromSubCategory} />

      <TransactionDetailsModal
        transaction={selectedTransaction}
        categories={categories}
        transactionList={subCategoryTransactionSequence}
        onNavigate={setSelectedTransaction}
        onBack={handleBackToSubCategoryList}
        onClose={handleCloseTransactionDetails}
      />

      <AnimatePresence>
        {showCatSheet ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCatSheet(false)}
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
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowCatSheet(false)} className="h-11 w-11 rounded-full bg-[var(--neutral-100)] px-0">
                  <ChevronDown size={16} />
                </Button>
              </div>

              <div style={{ overflowY: 'auto' }}>
                <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
                    {rootExpenseCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedCat(cat.id)
                          setShowCatSheet(false)
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
                        setSelectedCat('all')
                        setShowCatSheet(false)
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .breakdown-kpi-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
      `}</style>
    </div>
  )
}
