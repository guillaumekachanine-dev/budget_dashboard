import { useState, useMemo, useEffect, useRef, useCallback, type PointerEvent as ReactPointerEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, ChevronDown, ArrowLeft, ArrowDown, ArrowUp } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
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
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { formatCurrencyRounded } from '@/lib/utils'
import { debugBudgetSupabaseConnection } from '@/debug/debugBudgetSupabase'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/lib/types'
import type { BudgetLineWithCategory, BudgetPeriodOption } from '@/features/budget/types'
import { getBudgetPeriods } from '@/features/budget/api/getBudgetPeriods'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { TransactionDetailsModal } from '@/components/modals/TransactionDetailsModal'
import { PageHeader } from '@/components/layout/PageHeader'
import { HeaderPeriodMenu } from '@/components/layout/HeaderPeriodMenu'
import { Button } from '@/components'
import { useBudgetPagePayload } from '@/features/budget/hooks/useBudgetPagePayload'
import { BudgetSummaryCards } from '@/features/budget/components/BudgetSummaryCards'
import { BudgetParentGroups } from '@/features/budget/components/BudgetParentGroups'
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

const MONTHS_FR_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const VIZ_TOKENS = ['var(--viz-a)', 'var(--viz-b)', 'var(--viz-c)', 'var(--viz-d)', 'var(--viz-e)'] as const
const BUDGET_BLOCKS: Array<{ id: BudgetBlockId; label: string; color: string }> = [
  { id: 'fixe', label: 'Fixe', color: 'var(--primary-500)' },
  { id: 'variable_essentiel', label: 'Variable essentiel', color: 'var(--color-success)' },
  { id: 'discretionnaire', label: 'Discrétionnaire', color: 'var(--color-error)' },
  { id: 'epargne', label: 'Épargne', color: 'var(--color-warning)' },
  { id: 'cagnotte', label: 'Cagnotte', color: 'var(--viz-e)' },
]

const BLOCK_PROGRESS_COLORS: Record<BudgetBlockId, string> = {
  fixe: '#5B57F5',
  variable_essentiel: '#2ED47A',
  epargne: '#FFAB2E',
  discretionnaire: '#FC5A5A',
  cagnotte: '#4A4A62',
}

function accentFromLabel(label: string | null | undefined): string {
  const safeLabel = typeof label === 'string' && label.trim().length > 0 ? label : 'categorie'
  const key = safeLabel.trim().toLowerCase()
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
  categoryName: string
  categoryColor: string
  categoryAmount: number
  transactions: Transaction[]
  loading: boolean
  onSelectTransaction: (transaction: Transaction) => void
}

function SubCategoryTransactionsModal({
  open,
  onClose,
  categoryName,
  categoryColor,
  categoryAmount,
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
            style={{ position: 'fixed', inset: 0, zIndex: 240, background: 'rgba(13,13,31,0.56)' }}
          />
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 241,
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
            <div style={{ padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', background: categoryColor }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--neutral-0)' }}>{categoryName} - {formatMoney(categoryAmount)}</p>
              <button type="button" onClick={onClose} style={{ border: 'none', background: 'rgba(255,255,255,0.2)', color: 'var(--neutral-0)', width: 32, height: 32, minWidth: 32, minHeight: 32, borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label="Fermer">
                <X size={20} />
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
  const now = new Date()
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth()
  const nowDay = now.getDate()
  // Jours 1-3 du mois : on bascule par défaut sur le mois précédent
  const isGracePeriod = nowDay <= 3
  const defaultPeriodYear = isGracePeriod ? (nowMonth === 0 ? nowYear - 1 : nowYear) : nowYear
  const defaultPeriodMonth = isGracePeriod ? (nowMonth === 0 ? 12 : nowMonth) : nowMonth + 1
  const [searchParams, setSearchParams] = useSearchParams()

  const [periodKey, setPeriodKey] = useState<PeriodKey>('mois')
  const [selectedPeriodYear, setSelectedPeriodYear] = useState(defaultPeriodYear)
  const [selectedPeriodMonth, setSelectedPeriodMonth] = useState(defaultPeriodMonth)
  const [availableBudgetPeriods, setAvailableBudgetPeriods] = useState<BudgetPeriodOption[]>([])
  const [dataDisplayMode, setDataDisplayMode] = useState<DataDisplayMode>('reel')
  const selectedCat = searchParams.get('category') ?? 'all'
  const searchParamsKey = searchParams.toString()
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
  const [showConfiguredBudgetPanel, setShowConfiguredBudgetPanel] = useState(false)
  const {
    data: budgetPayload,
    loading: configuredBudgetLoading,
    error: configuredBudgetError,
    reload: reloadConfiguredBudget,
  } = useBudgetPagePayload({
    periodYear: selectedPeriodYear,
    periodMonth: selectedPeriodMonth,
    monthsBack: 6,
  })
  const payloadByBucket = useMemo(
    () => (Array.isArray(budgetPayload?.by_bucket) ? budgetPayload.by_bucket : []),
    [budgetPayload],
  )
  const payloadByParentCategory = useMemo(
    () => (Array.isArray(budgetPayload?.by_parent_category) ? budgetPayload.by_parent_category : []),
    [budgetPayload],
  )
  const payloadByCategory = useMemo(
    () => (Array.isArray(budgetPayload?.by_category) ? budgetPayload.by_category : []),
    [budgetPayload],
  )
  const payloadHistory = useMemo(
    () => (Array.isArray(budgetPayload?.history_last_6m) ? budgetPayload.history_last_6m : []),
    [budgetPayload],
  )
  const debugRanRef = useRef(false)
  const donutTooltipRef = useRef<HTMLDivElement | null>(null)
  const donutAreaRef = useRef<HTMLDivElement | null>(null)
  const [donutAreaSize, setDonutAreaSize] = useState({ width: 0, height: 0 })
  const dragStartXRef = useRef<number | null>(null)
  const dragDeltaXRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const hasAppliedDefaultParamsRef = useRef(false)
  const topSectionRef = useRef<HTMLElement | null>(null)
  const lowerSectionTitleRef = useRef<HTMLHeadingElement | null>(null)

  const setSelectedCat = useCallback((nextCategoryId: string) => {
    const nextParams = new URLSearchParams(searchParams)
    if (nextCategoryId === 'all') nextParams.delete('category')
    else nextParams.set('category', nextCategoryId)
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (hasAppliedDefaultParamsRef.current) return
    hasAppliedDefaultParamsRef.current = true

    setPeriodKey('mois')
    setSelectedPeriodYear(defaultPeriodYear)
    setSelectedPeriodMonth(defaultPeriodMonth)
    setDataDisplayMode('reel')
    setActiveSlide(0)

    if (searchParamsKey.includes('category=')) {
      const nextParams = new URLSearchParams(searchParamsKey)
      nextParams.delete('category')
      setSearchParams(nextParams, { replace: true })
    }
  }, [defaultPeriodMonth, defaultPeriodYear, searchParamsKey, setSearchParams])

  useEffect(() => {
    let active = true

    const loadBudgetPeriods = async () => {
      try {
        const periods = await getBudgetPeriods()
        if (!active) return

        setAvailableBudgetPeriods(periods)
        if (!periods.length) return

        const hasCurrentSelection = periods.some(
          (period) => period.period_year === defaultPeriodYear && period.period_month === defaultPeriodMonth,
        )

        if (!hasCurrentSelection) {
          setSelectedPeriodYear(periods[0].period_year)
          setSelectedPeriodMonth(periods[0].period_month)
        }
      } catch {
        if (!active) return
        setAvailableBudgetPeriods([])
      }
    }

    void loadBudgetPeriods()

    return () => {
      active = false
    }
  }, [nowMonth, nowYear])

  const handleHeaderTitleReset = useCallback(() => {
    setSelectedCat('all')
    setPeriodKey('mois')
    setSelectedPeriodYear(defaultPeriodYear)
    setSelectedPeriodMonth(defaultPeriodMonth)
    setShowHeaderPeriodMenu(false)
    setShowCatSheet(false)
  }, [defaultPeriodMonth, defaultPeriodYear, setSelectedCat])

  const smoothScrollToY = useCallback((targetY: number, duration = 760) => {
    const startY = window.scrollY
    const distance = targetY - startY
    if (Math.abs(distance) < 2) return

    const startTime = performance.now()
    const easeInOutCubic = (t: number) => {
      if (t < 0.5) return 4 * t * t * t
      return 1 - Math.pow(-2 * t + 2, 3) / 2
    }

    const step = (nowTs: number) => {
      const elapsed = nowTs - startTime
      const progress = Math.min(1, elapsed / duration)
      const eased = easeInOutCubic(progress)
      window.scrollTo(0, startY + distance * eased)
      if (progress < 1) window.requestAnimationFrame(step)
    }

    window.requestAnimationFrame(step)
  }, [])

  const resolveTopOffset = useCallback(() => {
    const rawHeader = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim()
    const headerPx = Number.parseFloat(rawHeader || '0')
    return Number.isFinite(headerPx) ? headerPx + 10 : 78
  }, [])

  const scrollToLowerSection = useCallback(() => {
    const target = lowerSectionTitleRef.current
    if (!target) return
    const y = target.getBoundingClientRect().top + window.scrollY - resolveTopOffset()
    smoothScrollToY(Math.max(0, y))
  }, [resolveTopOffset, smoothScrollToY])

  const scrollToTopSection = useCallback(() => {
    const target = topSectionRef.current
    if (!target) return
    const y = target.getBoundingClientRect().top + window.scrollY - resolveTopOffset()
    smoothScrollToY(Math.max(0, y))
  }, [resolveTopOffset, smoothScrollToY])

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

  useEffect(() => {
    if (selectedCat !== 'all') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
  }, [selectedCat])

  const configuredBudgetPeriod = useMemo(() => {
    if (!budgetPayload) return null

    const selectedPeriod = budgetPayload.selected_period
    return {
      id: '',
      period_year: Number(selectedPeriod?.period_year ?? selectedPeriodYear),
      period_month: Number(selectedPeriod?.period_month ?? selectedPeriodMonth),
      label: selectedPeriod?.label ?? formatPeriodLabel(selectedPeriodYear, selectedPeriodMonth),
      starts_on: '',
      ends_on: '',
    }
  }, [budgetPayload, selectedPeriodMonth, selectedPeriodYear])

  const configuredBudgetCategoryLines = useMemo<BudgetLineWithCategory[]>(() => {
    if (!budgetPayload) return []
    const periodYear = Number(budgetPayload.selected_period?.period_year ?? selectedPeriodYear)
    const periodMonth = Number(budgetPayload.selected_period?.period_month ?? selectedPeriodMonth)

    return payloadByCategory.map((row) => ({
      id: `${row.category_id}:${periodYear}-${periodMonth}`,
      period_id: '',
      category_id: row.category_id,
      budget_kind: 'category' as const,
      amount: Number(row.budget_amount ?? 0),
      currency: 'EUR',
      notes: null,
      category_name: row.category_name,
      parent_category_id: row.parent_category_id,
      parent_category_name: row.parent_category_name,
      budget_bucket: row.budget_bucket,
      budget_method: null,
      decision_status: null,
      final_budget_monthly_eur: null,
      manual_budget_monthly_eur: null,
      recommendation_comment: null,
    }))
  }, [payloadByCategory, budgetPayload, selectedPeriodMonth, selectedPeriodYear])

  const configuredBudgetParentCategoryLines = useMemo<BudgetLineWithCategory[]>(() => {
    if (!budgetPayload) return []
    const periodYear = Number(budgetPayload.selected_period?.period_year ?? selectedPeriodYear)
    const periodMonth = Number(budgetPayload.selected_period?.period_month ?? selectedPeriodMonth)

    return payloadByParentCategory.map((row) => ({
      id: `${row.parent_category_id}:${periodYear}-${periodMonth}`,
      period_id: '',
      category_id: row.parent_category_id,
      budget_kind: 'category' as const,
      amount: Number(row.budget_amount ?? 0),
      currency: 'EUR',
      notes: null,
      category_name: row.parent_category_name,
      parent_category_id: null,
      parent_category_name: null,
      budget_bucket: '',
      budget_method: null,
      decision_status: null,
      final_budget_monthly_eur: null,
      manual_budget_monthly_eur: null,
      recommendation_comment: null,
    }))
  }, [payloadByParentCategory, budgetPayload, selectedPeriodMonth, selectedPeriodYear])

  const configuredBudgetSummary = useMemo(() => {
    const byBucket = new Map(payloadByBucket.map((row) => [row.budget_bucket, Number(row.budget_amount ?? 0)]))
    const totalBudgetMonthly = Number(budgetPayload?.summary.budget_total_reference ?? 0)

    return {
      totalBudgetMonthly,
      globalVariableBudget: 0,
      socleFixeBudget: byBucket.get('socle_fixe') ?? 0,
      variableEssentielleBudget: byBucket.get('variable_essentielle') ?? 0,
      provisionBudget: byBucket.get('provision') ?? 0,
      discretionnaireBudget: byBucket.get('discretionnaire') ?? 0,
      cagnotteProjetBudget: byBucket.get('cagnotte_projet') ?? 0,
      horsPilotageBudget: byBucket.get('hors_pilotage') ?? 0,
    }
  }, [budgetPayload, payloadByBucket])

  const configuredBudgetParentGroups = useMemo(() => {
    if (!budgetPayload) return []
    return payloadByParentCategory.map((parentRow) => ({
      parentCategoryId: parentRow.parent_category_id,
      parentCategoryName: parentRow.parent_category_name,
      totalAmount: Number(parentRow.budget_amount ?? 0),
      lines: configuredBudgetCategoryLines.filter((line) => (
        (line.parent_category_id ?? line.category_id) === parentRow.parent_category_id
      )),
    }))
  }, [payloadByParentCategory, configuredBudgetCategoryLines])

  const configuredBudgetActuals = useMemo(() => {
    if (!budgetPayload) return null
    return {
      monthlyMetrics: null,
      categoryActuals: payloadByCategory.map((row) => ({
        category_id: row.category_id,
        category_name: row.category_name,
        parent_category_id: row.parent_category_id,
        parent_category_name: row.parent_category_name,
        amount_total: Number(row.actual_amount ?? 0),
      })),
      parentCategoryActuals: payloadByParentCategory.map((row) => ({
        category_id: row.parent_category_id,
        category_name: row.parent_category_name,
        parent_category_id: null,
        parent_category_name: null,
        amount_total: Number(row.actual_amount ?? 0),
      })),
      totalActualExpense: Number(budgetPayload.summary.actual_total_to_date ?? 0),
    }
  }, [budgetPayload, payloadByCategory, payloadByParentCategory])

  const configuredBudgetHasActuals = useMemo(() => {
    if (!configuredBudgetActuals) return false
    if (configuredBudgetActuals.totalActualExpense > 0) return true
    return configuredBudgetActuals.categoryActuals.some((row) => Number(row.amount_total ?? 0) > 0)
  }, [configuredBudgetActuals])

  const summaries = useMemo(() => {
    if (!budgetPayload) return []
    return payloadByCategory.map((row) => ({
      category: {
        id: row.category_id,
        parent_id: row.parent_category_id,
        name: row.category_name,
      },
      budget_amount: Number(row.budget_amount ?? 0),
    }))
  }, [budgetPayload, payloadByCategory])

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

  const range = useMemo(
    () => getPeriodRange(periodKey, selectedPeriodYear, selectedPeriodMonth),
    [periodKey, selectedPeriodYear, selectedPeriodMonth],
  )

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

  const subCategoryModalIds = useMemo(() => {
    if (!selectedSubCategory) return undefined
    const ids = [selectedSubCategory.id]
    expenseSubCategories.forEach((c) => {
      if (c.parent_id === selectedSubCategory.id) ids.push(c.id)
    })
    return ids
  }, [selectedSubCategory, expenseSubCategories])

  const { data: subCategoryTransactions, isLoading: loadingSubCategoryTransactions } = useTransactions({
    ...range,
    flowType: 'expense',
    categoryIds: subCategoryModalIds,
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
    if (selectedCat === 'all') {
      return Number(budgetPayload?.summary.actual_total_to_date ?? 0)
    }

    const txs = periodTxns ?? []
    if (!txs.length) return 0
    return txs.reduce((sum, tx) => sum + Number(tx.amount), 0)
  }, [budgetPayload, periodTxns, selectedCat])

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
  const categoryBlockLabel = useMemo(() => {
    const bucketLabel = formatBudgetBucketLabel(dominantCategoryBudgetLine?.budget_bucket)
    return bucketLabel.toLowerCase()
  }, [dominantCategoryBudgetLine?.budget_bucket])
  const budgetByCategoryId = useMemo(
    () =>
      (summaries ?? []).reduce<Map<string, number>>((acc, summary) => {
        acc.set(summary.category.id, (acc.get(summary.category.id) ?? 0) + Number(summary.budget_amount))
        return acc
      }, new Map<string, number>()),
    [summaries],
  )

  const monthlyHistory = useMemo<MonthlyBucket[]>(() => {
    const base = payloadHistory.map((row) => {
      const monthIndex = Math.max(0, Math.min(11, Number(row.period_month) - 1))
      const amount = Number(row.actual_total ?? 0)
      const budget = Number(row.budget_total ?? 0)
      const isCurrent = Number(row.period_year) === selectedPeriodYear && Number(row.period_month) === selectedPeriodMonth

      return {
        month: MONTHS_FR_SHORT[monthIndex],
        amount,
        budget,
        isCurrent,
      }
    })

    return base.map((row, idx) => {
      if (idx === 0) return { ...row, evolutionPct: null }
      const prev = base[idx - 1].amount
      if (prev <= 0) return { ...row, evolutionPct: null }
      return { ...row, evolutionPct: ((row.amount - prev) / prev) * 100 }
    })
  }, [payloadHistory, selectedPeriodYear, selectedPeriodMonth])

  const realPieData = useMemo<PieDatum[]>(() => {
    if (!budgetPayload) return []

    if (selectedCat === 'all') {
      return payloadByParentCategory
        .map((row) => ({
          id: row.parent_category_id,
          name: row.parent_category_name,
          value: Number(row.actual_amount ?? 0),
          color: accentFromLabel(row.parent_category_name),
        }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value)
    }

    return payloadByCategory
      .filter((row) => row.parent_category_id === selectedCat || row.category_id === selectedCat)
      .map((row) => ({
        id: row.category_id,
        name: row.category_name,
        value: Number(row.actual_amount ?? 0),
        color: accentFromLabel(row.category_name),
      }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [payloadByCategory, payloadByParentCategory, selectedCat])

  const budgetPieData = useMemo<PieDatum[]>(() => {
    if (!budgetPayload) return []

    if (selectedCat === 'all') {
      return payloadByParentCategory
        .map((row) => ({
          id: row.parent_category_id,
          name: row.parent_category_name,
          value: Number(row.budget_amount ?? 0),
          color: accentFromLabel(row.parent_category_name),
        }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value)
    }

    return payloadByCategory
      .filter((row) => row.parent_category_id === selectedCat || row.category_id === selectedCat)
      .map((row) => ({
        id: row.category_id,
        name: row.category_name,
        value: Number(row.budget_amount ?? 0),
        color: accentFromLabel(row.category_name),
      }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [payloadByCategory, payloadByParentCategory, selectedCat])
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

    if (selectedCat === 'all' && budgetPayload) {
      for (const bucketRow of payloadByBucket) {
        const blockId = mapBudgetBucketToBlock(bucketRow.budget_bucket)
        if (!blockId) continue

        const target = initial.get(blockId)
        if (!target) continue

        target.budgetAmount += Number(bucketRow.budget_amount ?? 0)
        target.actualAmount += Number(bucketRow.actual_amount ?? 0)
        target.lines = payloadByCategory
          .filter((row) => row.budget_bucket === bucketRow.budget_bucket)
          .map((row) => ({
            id: row.category_id,
            categoryName: row.category_name,
            parentCategoryName: row.parent_category_name,
            budgetAmount: Number(row.budget_amount ?? 0),
            actualAmount: Number(row.actual_amount ?? 0),
          }))
      }
    }

    const isVisibleLine = (categoryId: string | null, parentCategoryId: string | null): boolean => {
      if (selectedCat === 'all') return true
      if (!categoryId) return false
      return categoryId === selectedCat || parentCategoryId === selectedCat
    }

    for (const line of selectedCat === 'all' ? [] : configuredBudgetCategoryLines) {
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
  }, [budgetPayload, payloadByBucket, payloadByCategory, configuredBudgetCategoryLines, selectedCat, periodSpentByCategory, dataDisplayMode])

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

  const configuredPeriodLabel = configuredBudgetPeriod
    ? formatPeriodLabel(
      configuredBudgetPeriod.period_year,
      configuredBudgetPeriod.period_month,
      configuredBudgetPeriod.label,
    )
    : 'Aucune période'
  const headerPeriodLabel = periodKey === 'annee'
    ? `Année ${selectedPeriodYear}`
    : formatPeriodLabel(selectedPeriodYear, selectedPeriodMonth)
  const headerPeriodOptions = useMemo(() => {
    const monthOptions = availableBudgetPeriods
      .filter((period) => {
        if (period.period_year < nowYear) return true
        if (period.period_year === nowYear) return period.period_month <= (nowMonth + 1)
        return false
      })
      .map((period) => ({
        key: `period-${period.period_year}-${period.period_month}`,
        label: formatPeriodLabel(period.period_year, period.period_month, period.label),
        active: periodKey === 'mois'
          && selectedPeriodYear === period.period_year
          && selectedPeriodMonth === period.period_month,
        onSelect: () => {
          setPeriodKey('mois')
          setSelectedPeriodYear(period.period_year)
          setSelectedPeriodMonth(period.period_month)
        },
      }))

    const yearOption = {
      key: `year-${selectedPeriodYear}`,
      label: `année ${selectedPeriodYear}`,
      active: periodKey === 'annee',
      showDividerBefore: true,
      onSelect: () => {
        setPeriodKey('annee')
      },
    }

    return [...monthOptions, yearOption]
  }, [availableBudgetPeriods, periodKey, selectedPeriodMonth, selectedPeriodYear])

  const showExtendedSlides = selectedCat === 'all'
  const isCategoryMode = selectedCat !== 'all'
  const slideCount = showExtendedSlides ? 3 : 2
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
  }, [dataDisplayMode, periodKey, selectedPeriodYear, selectedPeriodMonth, selectedCat])

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: isCategoryMode ? 'var(--space-6)' : 'var(--space-5)', paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom-offset))' }}>
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

      {showExtendedSlides ? (
        <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ padding: '0 var(--space-6)' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', minHeight: 112, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--space-2)', alignItems: 'center' }}>
            {showRealBudgetToggle ? (
              <>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={() => setDataDisplayMode('reel')}
                style={{
                  border: '1px solid var(--neutral-200)',
                  background: dataDisplayMode === 'reel' ? 'var(--primary-50)' : 'var(--neutral-0)',
                  color: dataDisplayMode === 'reel' ? 'var(--primary-600)' : 'var(--neutral-600)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-2) var(--space-3)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  textAlign: 'center',
                  minWidth: 140,
                  minHeight: 48
                }}
              >
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, lineHeight: 1 }}>Réel</span>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)', lineHeight: 1.2 }}>
                  {formatMoney(selectedPeriodSpent).replace(/\s+€/, '€')}
                </span>
              </button>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)', fontWeight: 700, flexShrink: 0 }}>-</span>
              <button
                type="button"
                onClick={() => setDataDisplayMode('budget')}
                style={{
                  border: '1px solid var(--neutral-200)',
                  background: dataDisplayMode === 'budget' ? 'var(--primary-50)' : 'var(--neutral-0)',
                  color: dataDisplayMode === 'budget' ? 'var(--primary-600)' : 'var(--neutral-600)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-2) var(--space-3)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  textAlign: 'center',
                  minWidth: 140,
                  minHeight: 48
                }}
              >
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, lineHeight: 1 }}>Budget</span>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)', lineHeight: 1.2 }}>
                  {formatMoney(totalMonthlyBudget).replace(/\s+€/, '€')}
                </span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', width: '100%', maxWidth: 'calc(2 * 140px + var(--space-2) + 16px)' }}>
              <div style={{ height: 8, background: 'var(--neutral-200)', borderRadius: 'var(--radius-full)', overflow: 'hidden', position: 'relative', width: '100%' }}>
                <div
                  style={{
                    height: '100%',
                    background: totalMonthlyBudget > 0 && selectedPeriodSpent <= totalMonthlyBudget
                      ? 'var(--color-success)'
                      : 'var(--color-error)',
                    width: `${totalMonthlyBudget > 0 ? (selectedPeriodSpent / totalMonthlyBudget) * 100 : 0}%`,
                    transition: 'width 300ms ease'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-600)' }}>
                  Progression
                </span>
                <span style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: totalMonthlyBudget > 0 && selectedPeriodSpent <= totalMonthlyBudget ? 'var(--color-success)' : 'var(--color-error)'
                }}>
                  {totalMonthlyBudget > 0 ? `${((selectedPeriodSpent / totalMonthlyBudget) * 100).toFixed(0)}%` : '0%'}
                </span>
              </div>
            </div>
              </>
            ) : activeSlide === 2 ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                <div
                  style={{
                    border: '1px solid var(--neutral-200)',
                    background: 'var(--neutral-0)',
                    color: 'var(--neutral-600)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2) var(--space-3)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    textAlign: 'center',
                    minWidth: 140,
                    minHeight: 56
                  }}
                >
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, lineHeight: 1 }}>Montant moyen</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)', lineHeight: 1.2 }}>
                    {formatMoney(sixMonthAverageAmount).replace(/\s+€/, '€')}
                  </span>
                </div>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)', fontWeight: 700, flexShrink: 0 }}>-</span>
                <div
                  style={{
                    border: '1px solid var(--neutral-200)',
                    background: 'var(--neutral-0)',
                    color: 'var(--neutral-600)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2) var(--space-3)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    textAlign: 'center',
                    minWidth: 140,
                    minHeight: 56
                  }}
                >
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, lineHeight: 1 }}>Écart moyen</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: sixMonthAverageGapPct == null ? 'var(--neutral-500)' : sixMonthAverageGapPct > 0 ? 'var(--color-error)' : 'var(--color-success)', lineHeight: 1.2 }}>
                    {sixMonthAverageGapPct == null ? '—' : formatPercentSigned(sixMonthAverageGapPct)}
                  </span>
                </div>
              </div>
            ) : (
              <div aria-hidden="true" style={{ width: '100%', height: 80 }} />
            )}
          </div>
        </motion.section>
      ) : null}

      {isCategoryMode ? (
        <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ padding: '0 var(--space-6)' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{ minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  onClick={() => setSelectedCat('all')}
                  aria-label="Retour"
                  style={{
                    border: 'none',
                    background: accentFromLabel(selectedCatInfo?.name),
                    color: 'var(--neutral-0)',
                    width: 20,
                    height: 20,
                    minWidth: 20,
                    minHeight: 20,
                    borderRadius: 'var(--radius-full)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  <ArrowLeft size={13} />
                </button>
                <div style={{ minWidth: 0, display: 'inline-flex', alignItems: 'baseline', gap: 'var(--space-1)' }}>
                  <p style={{ margin: 0, minWidth: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.1 }}>
                    {selectedCatInfo?.name ?? '—'}
                  </p>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)', fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1 }}>
                    - {categoryBlockLabel}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ border: `1px solid ${accentFromLabel(selectedCatInfo?.name)}`, borderRadius: 'var(--radius-lg)', background: 'var(--neutral-0)', padding: 'var(--space-2) var(--space-3)', display: 'grid', gap: 'var(--space-1)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 'var(--space-2) var(--space-3)' }}>
                <div style={{ minWidth: 0, display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 2 }}>
                  <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700 }}>Budget</p>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--neutral-900)', fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1.3 }}>
                    {formatMoney(categoryMonthlyBudget)} <span style={{ color: 'var(--neutral-500)' }}>({toleranceByBucket(dominantCategoryBudgetLine?.budget_bucket)})</span>
                  </p>
                </div>
                <div style={{ minWidth: 0, display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 2 }}>
                  <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700 }}>Rang</p>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--neutral-900)', fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1.3 }}>
                    {categoryRanking ? `${categoryRanking.index}/${categoryRanking.total}` : '—'}
                  </p>
                </div>
                <div aria-hidden="true" style={{ minHeight: 30 }} />
                <div aria-hidden="true" style={{ minHeight: 30 }} />
              </div>
            </div>
          </div>
        </motion.section>
      ) : null}

      {isCategoryMode ? (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ width: '100%', maxWidth: 600, margin: '0 auto', marginTop: 'var(--space-3)', padding: '0 var(--space-5)', display: 'grid', gap: 'var(--space-4)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
            Historique 6 mois
          </h3>
          <div style={{ height: 220 }}>
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
                  {monthlyHistory.map((entry, i) => <Cell key={`history-${i}`} fill={accentFromLabel(selectedCatInfo?.name)} fillOpacity={entry.isCurrent ? 1 : 0.62} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 'var(--space-2)' }}>
            <div style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48, display: 'grid', justifyItems: 'center', alignContent: 'center', textAlign: 'center', gap: 2 }}>
              <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>Moyenne dépenses</span>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-800)' }}>{formatMoney(sixMonthAverageAmount).replace(/\s+€/, '€')}</span>
            </div>
            <div style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48, display: 'grid', justifyItems: 'center', alignContent: 'center', textAlign: 'center', gap: 2 }}>
              <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>Écart moyen</span>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: sixMonthAverageGapPct == null ? 'var(--neutral-500)' : sixMonthAverageGapPct > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>{sixMonthAverageGapPct == null ? '—' : formatPercentSigned(sixMonthAverageGapPct)}</span>
            </div>
            <div style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48 }} />
          </div>

          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
            Répartition par sous-catégorie
          </h3>

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
        </motion.section>
      ) : (
      <motion.section ref={topSectionRef} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ display: 'grid', gap: '6px', justifyItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 600, overflow: 'hidden', position: 'relative', touchAction: 'pan-y' }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={endSwipe} onPointerCancel={endSwipe} onPointerLeave={() => { if (isDragging) endSwipe() }}>
          <div style={{ display: 'flex', width: `${slideCount * 100}%`, transform: `translateX(-${(100 / slideCount) * activeSlide}%)`, transition: 'transform 300ms ease' }}>
            <div style={{ width: `${100 / slideCount}%`, flexShrink: 0, display: 'grid', gap: 'var(--space-1)' }}>
              {selectedCat === 'all' ? (
                <div ref={donutAreaRef} style={{ position: 'relative', height: 336 }}>
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
                        const id = String(payload?.id ?? '')
                        const name = String(payload?.name ?? 'Catégorie')
                        const value = Number(payload?.value ?? 0)
                        const color = String(payload?.color ?? 'var(--primary-500)')
                        setSelectedDonutSlice({ id, name, value, color })
                        if (id) {
                          setSelectedSubCategory({
                            id,
                            name,
                            parentCategoryName: null,
                            currentMonthAmount: value,
                            previousMonthAmount: 0,
                            threeMonthAvg: 0,
                            trend: 'equal',
                          })
                        }
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
                            {dataDisplayMode === 'budget' ? 'budgétés' : 'dépensés'}
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
              <div style={{ width: `${100 / slideCount}%`, flexShrink: 0, display: 'grid', gap: 'var(--space-2)' }}>
                <div style={{ height: 356, transform: 'translateY(-24px)' }}>
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
                      <ReferenceLine
                        y={historyBudgetTarget}
                        stroke="var(--color-error)"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        label={{
                          value: formatMoney(historyBudgetTarget),
                          position: 'insideLeft',
                          fill: 'var(--color-error)',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      />
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
            ) : null}
          </div>
        </div>

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

        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', padding: '0 var(--space-4)' }}>
          <button
            type="button"
            onClick={scrollToLowerSection}
            aria-label="Aller aux listes budgets"
            style={{
              width: 38,
              height: 38,
              minWidth: 38,
              minHeight: 38,
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--neutral-200)',
              background: 'var(--neutral-0)',
              color: 'var(--neutral-700)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-card)',
              transition: 'transform var(--transition-fast), background var(--transition-fast)',
            }}
          >
            <ArrowDown size={16} />
          </button>
        </div>
      </motion.section>
      )}

      {selectedCat === 'all' ? (
        <AnimatePresence mode="wait">
          {activeSlide === 0 && configuredBudgetPeriod ? (
            <motion.section key="slide0-list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }} style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <h3 ref={lowerSectionTitleRef} style={{ margin: '0 var(--space-5)', fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                Listes budgets
              </h3>
              <BudgetCategoryList
                lines={configuredBudgetParentCategoryLines}
                actualCategoryMetrics={configuredBudgetActuals?.parentCategoryActuals ?? []}
                hasActuals={configuredBudgetHasActuals}
                onLineClick={(line) => {
                  if (!line.category_id) return
                  setSelectedCat(line.category_id)
                }}
              />
              <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', padding: '0 var(--space-5)' }}>
                <button
                  type="button"
                  onClick={scrollToTopSection}
                  aria-label="Revenir au carrousel"
                  style={{
                    width: 38,
                    height: 38,
                    minWidth: 38,
                    minHeight: 38,
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--neutral-200)',
                    background: 'var(--neutral-0)',
                    color: 'var(--neutral-700)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <ArrowUp size={16} />
                </button>
              </div>
            </motion.section>
          ) : activeSlide === 1 && blockRows.length > 0 ? (
            <motion.section key="slide1-list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }} style={{ display: 'grid', gap: 'var(--space-6)', padding: '0 var(--space-5)' }}>
              <h3 ref={lowerSectionTitleRef} style={{ margin: '0 0 0 0', fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                Répartition par blocs
              </h3>
              <div style={{ display: 'grid', gap: 'var(--space-8)' }}>
              {blockRows.map((row) => {
                const budgetAmount = Number(row.budgetAmount ?? 0)
                const actualAmount = Number(row.actualAmount ?? 0)
                const consumptionRatio = budgetAmount > 0 ? actualAmount / budgetAmount : 0
                const progressPct = Math.min(100, Math.round(consumptionRatio * 100))
                const variance = budgetAmount - actualAmount
                const isOverBudget = variance < 0
                return (
                  <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 'var(--space-5)', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 'var(--radius-full)',
                          border: '1px dashed var(--neutral-300)',
                          background: 'var(--neutral-100)',
                          color: 'var(--neutral-500)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        ICON
                      </span>
                    </div>

                    <div style={{ display: 'grid', gap: 'var(--space-2)', minWidth: 0 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--space-4)', alignItems: 'center' }}>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', fontWeight: 'var(--font-weight-bold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {`Socle ${row.label.toLowerCase()}`}
                        </p>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                          {formatMoney(budgetAmount)}
                        </p>
                      </div>

                      <div style={{ width: '100%', height: 'var(--space-2)', borderRadius: 'var(--radius-pill)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${progressPct}%`,
                            height: '100%',
                            borderRadius: 'var(--radius-pill)',
                            background: BLOCK_PROGRESS_COLORS[row.id],
                            transition: 'width var(--transition-base)',
                          }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--space-4)', alignItems: 'center' }}>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>
                          {formatMoney(actualAmount)} <span style={{ color: 'var(--neutral-500)' }}>({progressPct}%)</span>
                        </p>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: isOverBudget ? 'var(--color-error)' : 'var(--neutral-500)', fontFamily: 'var(--font-mono)', fontWeight: isOverBudget ? 700 : 400, flexShrink: 0 }}>
                          {isOverBudget ? `Dépassement ${formatMoney(Math.abs(variance))}` : `Restant ${formatMoney(variance)}`}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
              </div>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={scrollToTopSection}
                  aria-label="Revenir au carrousel"
                  style={{
                    width: 38,
                    height: 38,
                    minWidth: 38,
                    minHeight: 38,
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--neutral-200)',
                    background: 'var(--neutral-0)',
                    color: 'var(--neutral-700)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <ArrowUp size={16} />
                </button>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
      ) : null}

      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }} style={{ width: '100%', maxWidth: 600, margin: '0 auto', padding: 'var(--space-4) var(--space-4) 0', display: 'grid', gap: 'var(--space-4)' }}>
        <button
          type="button"
          onClick={() => setShowConfiguredBudgetPanel((current) => !current)}
          aria-expanded={showConfiguredBudgetPanel}
          aria-controls="configured-budget-panel"
          style={{ border: 'none', background: 'transparent', width: '100%', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', textAlign: 'left' }}
        >
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--neutral-500)' }}>
            Pilotage budget configuré
          </p>
          <span style={{ flex: 1, height: 1, background: 'var(--neutral-200)' }} />
          <ChevronDown
            size={16}
            style={{
              color: 'var(--neutral-600)',
              transform: showConfiguredBudgetPanel ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform var(--transition-base)',
              flexShrink: 0,
            }}
          />
        </button>

        <AnimatePresence initial={false}>
          {showConfiguredBudgetPanel ? (
            <motion.div
              id="configured-budget-panel"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'grid', gap: 'var(--space-4)' }}
            >
              <div style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--neutral-200)', padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Période budgétaire
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-md)', color: 'var(--neutral-900)', fontWeight: 800 }}>
                    {configuredPeriodLabel}
                  </p>
                </div>

                {configuredBudgetLoading ? (
                  <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
                    Chargement du payload Budgets…
                  </p>
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

              {configuredBudgetPeriod ? (
                <>
                  <BudgetSummaryCards summary={configuredBudgetSummary} />
                  <BudgetParentGroups groups={configuredBudgetParentGroups} />
                </>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.section>

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
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 231,
                display: 'grid',
                placeItems: 'center',
                padding: 'var(--space-4)',
                pointerEvents: 'none',
              }}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={`Détail du bloc ${selectedBlock.label}`}
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
                <div style={{ padding: 'var(--space-3) var(--space-5)', background: selectedBlock.color, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--neutral-0)' }}>
                      Bloc <span style={{ fontFamily: 'var(--font-mono)' }}>"{selectedBlock.label}"</span> - {formatMoney(dataDisplayMode === 'budget' ? selectedBlock.budgetAmount : selectedBlock.actualAmount)}
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.72)' }}>
                      {dataDisplayMode === 'budget' ? 'Vue budget' : 'Vue réel'}
                    </p>
                  </div>
                  <button type="button" onClick={() => setSelectedBlockId(null)} style={{ border: 'none', background: 'rgba(255,255,255,0.2)', color: 'var(--neutral-0)', width: 32, height: 32, minWidth: 32, minHeight: 32, borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }} aria-label="Fermer">
                    <X size={20} />
                  </button>
                </div>
                <div style={{ maxHeight: 'calc(min(82dvh, 100dvh - var(--space-8)) - 66px)', overflowY: 'auto' }}>
                  {selectedBlock.lines.length === 0 ? (
                    <p style={{ margin: 0, padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)' }}>
                      Aucune ligne disponible
                    </p>
                  ) : (
                    selectedBlock.lines.map((line) => {
                      const displayedAmount = dataDisplayMode === 'budget' ? line.budgetAmount : line.actualAmount
                      const secondaryAmount = dataDisplayMode === 'budget' ? line.actualAmount : line.budgetAmount
                      return (
                        <div
                          key={line.id}
                          onClick={() => {
                            setSelectedSubCategory({
                              id: line.id,
                              name: line.categoryName,
                              parentCategoryName: line.parentCategoryName,
                              currentMonthAmount: displayedAmount,
                              previousMonthAmount: 0,
                              threeMonthAvg: 0,
                              trend: 'equal',
                            })
                          }}
                          style={{
                            borderBottom: '1px solid var(--neutral-200)',
                            padding: 'var(--space-2) var(--space-5)',
                            display: 'grid',
                            gap: '2px',
                            cursor: 'pointer',
                            background: 'transparent',
                            transition: 'background var(--transition-fast)',
                          }}
                          onMouseEnter={(e) => {
                            const el = e.currentTarget as HTMLDivElement
                            el.style.background = 'rgba(91, 87, 245, 0.06)'
                          }}
                          onMouseLeave={(e) => {
                            const el = e.currentTarget as HTMLDivElement
                            el.style.background = 'transparent'
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedSubCategory({
                                id: line.id,
                                name: line.categoryName,
                                parentCategoryName: line.parentCategoryName,
                                currentMonthAmount: displayedAmount,
                                previousMonthAmount: 0,
                                threeMonthAvg: 0,
                                trend: 'equal',
                              })
                            }
                          }}
                        >
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
            </div>
          </>
        ) : null}
      </AnimatePresence>

      <SubCategoryTransactionsModal open={Boolean(selectedSubCategory)} onClose={() => { setSelectedSubCategory(null); setSubCategoryToReopen(null); setPendingTransaction(null); setSubCategoryTransactionSequence([]); setSelectedDonutSlice(null) }} categoryName={selectedSubCategory?.name ?? ''} categoryColor={selectedDonutSlice?.color ?? 'var(--primary-500)'} categoryAmount={selectedSubCategory?.currentMonthAmount ?? 0} transactions={subCategoryTransactions ?? []} loading={loadingSubCategoryTransactions} onSelectTransaction={handleSelectTransactionFromSubCategory} />

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
