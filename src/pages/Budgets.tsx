import { useState, useMemo, useEffect, useRef, useCallback, type PointerEvent as ReactPointerEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, ChevronDown } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
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
import { Button } from '@/components'
import { useBudgetPeriod } from '@/features/budget/hooks/useBudgetPeriod'
import { BudgetSummaryCards } from '@/features/budget/components/BudgetSummaryCards'
import { BudgetParentGroups } from '@/features/budget/components/BudgetParentGroups'
import { BudgetVsActualSection } from '@/features/budget/components/BudgetVsActualSection'
import { BudgetCategoryList } from '@/features/budget/components/BudgetCategoryList'
import { formatPeriodLabel } from '@/features/budget/utils/budgetSelectors'

type PeriodKey = 'mois' | 'annee'
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

interface SubCategoryTrendItem {
  id: string
  name: string
  parentCategoryName: string | null
  currentMonthAmount: number
  previousMonthAmount: number
  threeMonthAvg: number
  trend: SubCatTrend
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

function getPeriodRange(key: PeriodKey): { startDate: string; endDate: string } {
  const now = new Date()
  if (key === 'annee') {
    return { startDate: `${now.getFullYear()}-01-01`, endDate: todayStr() }
  }
  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    endDate: todayStr(),
  }
}

function getPeriodLabel(key: PeriodKey): string {
  const now = new Date()
  if (key === 'annee') return `Année ${now.getFullYear()}`
  return now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

const MONTHS_FR_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const VIZ_TOKENS = ['var(--viz-a)', 'var(--viz-b)', 'var(--viz-c)', 'var(--viz-d)', 'var(--viz-e)'] as const

function accentFromLabel(label: string): string {
  const key = label.trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash << 5) - hash + key.charCodeAt(i)
  return VIZ_TOKENS[Math.abs(hash) % VIZ_TOKENS.length]
}

function BarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--primary-600)', borderRadius: 'var(--radius-md)', padding: '5px 11px', boxShadow: 'var(--shadow-md)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--neutral-0)' }}>
        {formatMoney(payload[0].value)}
      </span>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(13,13,31,0.56)' }} />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 330 }}
            style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 221, width: '100%', maxWidth: 512, margin: '0 auto', background: 'var(--neutral-0)', borderRadius: '24px 24px 0 0', maxHeight: '82dvh', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}
          >
            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--neutral-900)' }}>{title}</p>
              <button type="button" onClick={onClose} style={{ border: 'none', background: 'var(--neutral-100)', color: 'var(--neutral-600)', minWidth: 'var(--touch-target-min)', minHeight: 'var(--touch-target-min)', borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label="Fermer">
                <X size={15} />
              </button>
            </div>
            <div style={{ maxHeight: 'calc(82dvh - 66px)', overflowY: 'auto' }}>
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
  const [searchParams, setSearchParams] = useSearchParams()

  const [periodKey, setPeriodKey] = useState<PeriodKey>('mois')
  const selectedCat = searchParams.get('category') ?? 'all'
  const [showCatSheet, setShowCatSheet] = useState(false)
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategoryTrendItem | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [pendingTransaction, setPendingTransaction] = useState<Transaction | null>(null)
  const [subCategoryToReopen, setSubCategoryToReopen] = useState<SubCategoryTrendItem | null>(null)
  const [selectedDonutSlice, setSelectedDonutSlice] = useState<PieDatum | null>(null)
  const [activeSlide, setActiveSlide] = useState(0)
  const [breakdownMode] = useState<'mois' | 'annee'>('mois')
  const [activeIncomeExpenseSlice, setActiveIncomeExpenseSlice] = useState<string | null>(null)
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
      if (Number.isInteger(prefs.activeSlide) && prefs.activeSlide >= 0 && prefs.activeSlide < 4) {
        setActiveSlide(prefs.activeSlide)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    void writeOfflineValue<BudgetsUiPrefs>(BUDGETS_UI_PREFS_KEY, { periodKey, activeSlide })
  }, [periodKey, activeSlide])

  const setSelectedCat = useCallback((nextCategoryId: string) => {
    const nextParams = new URLSearchParams(searchParams)
    if (nextCategoryId === 'all') nextParams.delete('category')
    else nextParams.set('category', nextCategoryId)
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const handleHeaderTitleReset = useCallback(() => {
    setSelectedCat('all')
    setPeriodKey('mois')
    setShowCatSheet(false)
  }, [setSelectedCat])

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

  const range = useMemo(() => getPeriodRange(periodKey), [periodKey])

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
  const { data: currentMonthIncomeTxns } = useTransactions({
    startDate: currentMonthStart,
    endDate: todayStr(),
    flowType: 'income',
  })

  const historyStart = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10)
  const { data: historyTxns } = useTransactions({
    startDate: historyStart,
    endDate: todayStr(),
    flowType: 'expense',
    categoryIds: selectedCategoryIds,
  })

  const yearStart = `${now.getFullYear()}-01-01`
  const { data: currentYearExpenseTxns } = useTransactions({ startDate: yearStart, endDate: todayStr(), flowType: 'expense' })
  const { data: currentYearIncomeTxns } = useTransactions({ startDate: yearStart, endDate: todayStr(), flowType: 'income' })
  const { data: allExpenseTxns } = useTransactions({ flowType: 'expense' })
  const { data: allIncomeTxns } = useTransactions({ flowType: 'income' })
  const { data: subCategoryTransactions, isLoading: loadingSubCategoryTransactions } = useTransactions({
    ...range,
    flowType: 'expense',
    categoryIds: selectedSubCategory ? [selectedSubCategory.id] : ['__none__'],
  })

  const totalMonthlyBudget = useMemo(() => {
    if (!summaries?.length) return 0
    if (selectedCat === 'all') return summaries.reduce((s, b) => s + b.budget_amount, 0)
    return summaries.find((s) => s.category.id === selectedCat)?.budget_amount ?? 0
  }, [summaries, selectedCat])

  const currentMonthSpent = useMemo(() => {
    const txs = currentMonthAllExpenseTxns ?? []
    if (!txs.length) return 0
    if (!selectedCategoryIds?.length) return txs.reduce((sum, tx) => sum + Number(tx.amount), 0)
    const selectedIds = new Set(selectedCategoryIds)
    return txs.reduce((sum, tx) => {
      if (tx.category_id && selectedIds.has(tx.category_id)) return sum + Number(tx.amount)
      return sum
    }, 0)
  }, [currentMonthAllExpenseTxns, selectedCategoryIds])

  const selectedCatInfo = useMemo(() => categories.find((c) => c.id === selectedCat) ?? null, [categories, selectedCat])

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

  const pieData = useMemo<PieDatum[]>(() => {
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
    if (!txs.length || !expenseSubCategories.length) return []

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
      .filter((row) => row.currentMonthAmount > 0)
      .sort((a, b) => b.currentMonthAmount - a.currentMonthAmount)
  }, [periodTxns, expenseSubCategories, selectedCat, categoryById])
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

  const monthModeLabel = getPeriodLabel('mois')
  const yearModeLabel = getPeriodLabel('annee')
  const subCategoryModalTitle = selectedSubCategory ? `${selectedSubCategory.name} - ${getPeriodLabel(periodKey)}` : ''
  const configuredPeriodLabel = configuredBudgetPeriod
    ? formatPeriodLabel(
      configuredBudgetPeriod.period_year,
      configuredBudgetPeriod.period_month,
      configuredBudgetPeriod.label,
    )
    : 'Aucune période'

  const handleConfiguredPeriodChange = useCallback((nextPeriodId: string) => {
    const period = configuredBudgetPeriods.find((row) => row.id === nextPeriodId) ?? null
    setConfiguredBudgetPeriod(period)
  }, [configuredBudgetPeriods, setConfiguredBudgetPeriod])

  const showExtendedSlides = selectedCat === 'all'
  const slideCount = showExtendedSlides ? 4 : 2
  const slideTitles = showExtendedSlides
    ? ([
        'Répartition par catégorie',
        'Évolutions 6 derniers mois',
        'Revenus / Dépenses / Épargne',
        "Scénarios d'optimisation",
      ] as const)
    : ([
        'Répartition par catégorie',
        'Évolutions 6 derniers mois',
      ] as const)
  const optimizationTableColumns = 'minmax(0,1.2fr) minmax(0,0.62fr) minmax(0,0.84fr) minmax(0,0.84fr)'
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

  const monthIncomeTotal = useMemo(() => (currentMonthIncomeTxns ?? []).reduce((sum, t) => sum + Number(t.amount), 0), [currentMonthIncomeTxns])
  const monthExpenseTotal = useMemo(() => (currentMonthAllExpenseTxns ?? []).reduce((sum, t) => sum + Number(t.amount), 0), [currentMonthAllExpenseTxns])
  const yearIncomeTotal = useMemo(() => (currentYearIncomeTxns ?? []).reduce((sum, t) => sum + Number(t.amount), 0), [currentYearIncomeTxns])
  const yearExpenseTotal = useMemo(() => (currentYearExpenseTxns ?? []).reduce((sum, t) => sum + Number(t.amount), 0), [currentYearExpenseTxns])
  const allIncomeTotal = useMemo(() => (allIncomeTxns ?? []).reduce((sum, t) => sum + Number(t.amount), 0), [allIncomeTxns])
  const allExpenseTotal = useMemo(() => (allExpenseTxns ?? []).reduce((sum, t) => sum + Number(t.amount), 0), [allExpenseTxns])

  const breakdownIncome = breakdownMode === 'mois' ? monthIncomeTotal : yearIncomeTotal
  const breakdownExpense = breakdownMode === 'mois' ? monthExpenseTotal : yearExpenseTotal
  const breakdownSavings = Math.max(0, breakdownIncome - breakdownExpense)
  const budgetPressurePct = breakdownIncome > 0 ? (breakdownExpense / breakdownIncome) * 100 : 0
  const savingsCapacity = monthIncomeTotal - monthExpenseTotal
  const savingsYtd = Math.max(0, yearIncomeTotal - yearExpenseTotal)
  const totalSavings = Math.max(0, allIncomeTotal - allExpenseTotal)

  const incomeExpenseSavingsData = useMemo(
    () => ([
      { id: 'income', name: 'Revenus', value: breakdownIncome, color: 'var(--primary-500)' },
      { id: 'expense', name: 'Dépenses', value: breakdownExpense, color: 'var(--color-error)' },
      { id: 'savings', name: 'Épargne', value: breakdownSavings, color: 'var(--color-success)' },
    ]).filter((entry) => entry.value > 0),
    [breakdownExpense, breakdownIncome, breakdownSavings],
  )

  const optimizationScenarios = useMemo(() => {
    const candidates = topFiveCategories.slice(0, 5)
    const reductionPercents = [5, 8, 10, 12, 15]
    return candidates.map((entry, idx) => {
      const reduction = reductionPercents[idx] ?? 10
      const monthlyImpact = (entry.value * reduction) / 100
      return {
        id: entry.id,
        name: entry.name,
        reduction,
        monthlyImpact,
        sixMonthImpact: monthlyImpact * 6,
      }
    })
  }, [topFiveCategories])

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
    if (selectedSubCategory) {
      setSubCategoryToReopen(selectedSubCategory)
      setSelectedSubCategory(null)
    }
    setPendingTransaction(transaction)
  }

  const handleCloseTransactionDetails = () => {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom-offset))' }}>
      <PageHeader
        title="Budgets"
        titleAriaLabel="Réinitialiser sur toutes catégories et période mois"
        onTitleClick={handleHeaderTitleReset}
        rightLabel={selectedCat === 'all' ? 'toutes catégories' : (selectedCatInfo?.name ?? 'toutes catégories')}
        actionIcon={
          selectedCat === 'all'
            ? <Search size={24} />
            : <CategoryIcon categoryName={selectedCatInfo?.name} size={28} fallback="💰" />
        }
        actionAriaLabel="Choisir une catégorie"
        onActionClick={() => setShowCatSheet((current) => !current)}
      />

      <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ padding: '0 var(--space-6)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', justifyItems: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
            <button type="button" onClick={() => setPeriodKey('mois')} style={{ border: '1px solid var(--neutral-200)', background: periodKey === 'mois' ? 'var(--primary-50)' : 'var(--neutral-0)', color: periodKey === 'mois' ? 'var(--primary-600)' : 'var(--neutral-600)', fontSize: 'var(--font-size-sm)', fontWeight: 700, borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minWidth: 124, textAlign: 'center', cursor: 'pointer' }}>
              {monthModeLabel}
            </button>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)', fontWeight: 700 }}>-</span>
            <button type="button" onClick={() => setPeriodKey('annee')} style={{ border: '1px solid var(--neutral-200)', background: periodKey === 'annee' ? 'var(--primary-50)' : 'var(--neutral-0)', color: periodKey === 'annee' ? 'var(--primary-600)' : 'var(--neutral-600)', fontSize: 'var(--font-size-sm)', fontWeight: 700, borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minWidth: 124, textAlign: 'center', cursor: 'pointer' }}>
              {yearModeLabel}
            </button>
          </div>
        </div>
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ display: 'grid', gap: 'var(--space-2)', justifyItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 600, overflow: 'hidden', position: 'relative', touchAction: 'pan-y' }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={endSwipe} onPointerCancel={endSwipe} onPointerLeave={() => { if (isDragging) endSwipe() }}>
          <div style={{ display: 'flex', width: `${slideCount * 100}%`, transform: `translateX(-${(100 / slideCount) * activeSlide}%)`, transition: 'transform 300ms ease' }}>
            <div style={{ width: `${100 / slideCount}%`, flexShrink: 0, display: 'grid', gap: 'var(--space-1)' }}>
              <div ref={donutAreaRef} style={{ position: 'relative', height: 336 }}>
                {selectedDonutSlice ? (
                  <div ref={donutTooltipRef} style={{ position: 'absolute', top: 'var(--space-2)', left: '50%', transform: 'translateX(-50%)', background: 'var(--neutral-0)', border: '1px solid var(--neutral-200)', boxShadow: 'var(--shadow-md)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', zIndex: 3, minWidth: 220, textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-900)' }}>{selectedDonutSlice.name}</p>
                    <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-700)' }}>{`${formatMoney(selectedDonutSlice.value)} · ${selectedSlicePct.toFixed(0)}%`}</p>
                  </div>
                ) : null}
                {selectedCat === 'all' && donutTopFiveCallouts.length > 0 ? (
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
                      if (selectedCat !== 'all') return null
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
                      {formatMoney(currentMonthSpent)}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--neutral-500)', lineHeight: 1.1 }}>
                      dépensés
                    </span>
                  </div>
                </div>
              </div>
            </div>

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
            </div>

            {showExtendedSlides ? (
              <>
                <div style={{ width: `${100 / slideCount}%`, flexShrink: 0, display: 'grid', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 'var(--space-4)' }}>
                    <div style={{ height: 210 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={incomeExpenseSavingsData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2} onClick={(slice: unknown) => {
                            const payload = extractPiePayload(slice)
                            setActiveIncomeExpenseSlice(String(payload?.id ?? null))
                          }}>
                            {incomeExpenseSavingsData.map((entry) => {
                              const active = activeIncomeExpenseSlice === entry.id
                              return <Cell key={entry.id} fill={entry.color} fillOpacity={active || !activeIncomeExpenseSlice ? 1 : 0.68} style={active ? { filter: 'brightness(1.06)' } : undefined} />
                            })}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="breakdown-kpi-grid" style={{ display: 'grid', gap: 'var(--space-4)', width: '100%', maxWidth: 430, margin: '0 auto', justifyItems: 'center' }}>
                      <div style={{ display: 'grid', gap: 2, textAlign: 'center' }}><span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Pression budgétaire</span><span style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>{`${budgetPressurePct.toFixed(0)}%`}</span></div>
                      <div style={{ display: 'grid', gap: 2, textAlign: 'center' }}><span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Capacité d'épargne</span><span style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: savingsCapacity >= 0 ? 'var(--color-success)' : 'var(--color-error)', fontFamily: 'var(--font-mono)' }}>{formatMoney(savingsCapacity)}</span></div>
                      <div style={{ display: 'grid', gap: 2, textAlign: 'center' }}><span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Épargne année en cours</span><span style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>{formatMoney(savingsYtd)}</span></div>
                      <div style={{ display: 'grid', gap: 2, textAlign: 'center' }}><span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Épargne totale</span><span style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>{formatMoney(totalSavings)}</span></div>
                    </div>
                  </div>
                </div>

                <div style={{ width: `${100 / slideCount}%`, flexShrink: 0, display: 'grid', gap: 'var(--space-1)' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ width: '96%', margin: '0 auto', borderBottom: '1px solid var(--neutral-200)', display: 'grid', gridTemplateColumns: optimizationTableColumns, gap: 'var(--space-1)', padding: 'var(--space-2) 0' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'left' }}>Enveloppe</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'center' }}>Scénario</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' }}>Fin de mois</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' }}>6 mois</span>
                    </div>

                    {optimizationScenarios.length === 0 ? (
                      <div style={{ padding: 'var(--space-6) 0', color: 'var(--neutral-400)', fontSize: 13 }}>Aucune donnée disponible</div>
                    ) : optimizationScenarios.map((scenario) => (
                      <div key={scenario.id} style={{ width: '96%', margin: '0 auto', borderBottom: '1px solid var(--neutral-200)', display: 'grid', gridTemplateColumns: optimizationTableColumns, gap: 'var(--space-1)', padding: '10px 0', alignItems: 'center', transition: 'background-color var(--transition-fast)' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--neutral-50)' }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--neutral-800)' }}>{scenario.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)', textAlign: 'center', whiteSpace: 'nowrap' }}>{`-${scenario.reduction}%`}</span>
                        <span style={{ fontSize: 12, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap' }}>{`+${formatMoney(scenario.monthlyImpact)}`}</span>
                        <span style={{ fontSize: 12, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap' }}>{`+${formatMoney(scenario.sixMonthImpact)}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
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

      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ width: '100%', maxWidth: 600, margin: '0 auto', padding: 'var(--space-4) var(--space-4) 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', paddingBottom: 'var(--space-4)' }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--neutral-500)' }}>
            {selectedCat === 'all' ? 'Consommé VS restant par catégorie' : 'Liste sous-catégories'}
          </p>
          <span style={{ flex: 1, height: 1, background: 'var(--neutral-200)' }} />
        </div>

        {selectedCat === 'all' ? (
          budgetProgressRows.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--neutral-400)', padding: 'var(--space-8) 0' }}>Aucune catégorie à afficher</div>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              {budgetProgressRows.map((row) => {
                const remainingAmount = Math.max(0, row.remaining)
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
                        {formatMoney(row.spent)}
                      </p>
                    </div>

                    <div style={{ width: '100%', height: 7, borderRadius: 'var(--radius-pill)', background: 'var(--neutral-200)', overflow: 'hidden' }}>
                      <div style={{ width: `${row.progressPct}%`, height: '100%', borderRadius: 'var(--radius-pill)', background: row.accent, transition: 'width var(--transition-base), background-color var(--transition-base)' }} />
                    </div>

                    <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-600)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {`Restant ${formatMoney(remainingAmount)}`}
                    </p>
                  </Link>
                )
              })}
            </div>
          )
        ) : (
          listSubCategoryRows.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--neutral-400)', padding: 'var(--space-8) 0' }}>Aucune sous-catégorie sur cette période</div>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
              {listSubCategoryRows.map((row) => (
                <button key={row.id} type="button" onClick={() => setSelectedSubCategory(row)} style={{ width: '100%', borderBottom: '1px solid var(--neutral-200)', background: 'transparent', borderLeft: 'none', borderRight: 'none', borderTop: 'none', padding: 'var(--space-3) 0', display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', textAlign: 'left', transition: 'background-color var(--transition-fast)' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--neutral-50)' }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><CategoryIcon categoryName={row.name} size={18} fallback="💰" /></span>
                  <span style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                    <span style={{ minWidth: 0, fontSize: 13, color: 'var(--neutral-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--color-error)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{formatMoney(row.currentMonthAmount)}</span>
                </button>
              ))}
            </div>
          )
        )}
      </motion.section>

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

      <SubCategoryTransactionsModal open={Boolean(selectedSubCategory)} onClose={() => { setSelectedSubCategory(null); setSubCategoryToReopen(null); setPendingTransaction(null) }} title={subCategoryModalTitle} transactions={subCategoryTransactions ?? []} loading={loadingSubCategoryTransactions} onSelectTransaction={handleSelectTransactionFromSubCategory} />

      <TransactionDetailsModal
        transaction={selectedTransaction}
        categories={categories}
        transactionList={subCategoryTransactions ?? []}
        onNavigate={setSelectedTransaction}
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
