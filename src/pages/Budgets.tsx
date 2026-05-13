import { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect, type PointerEvent as ReactPointerEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown, ArrowLeft, ArrowDown, ArrowUp, LayoutGrid, CalendarDays } from 'lucide-react'
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
import { useQuery } from '@tanstack/react-query'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { formatCurrencyFloored, formatCategoryModalLabel, todayIso, getTxLabel } from '@/lib/utils'
import { budgetDb } from '@/lib/supabaseBudget'
import type { FlowType, Transaction } from '@/lib/types'
import type { BudgetLineWithCategory } from '@/features/budget/types'
import { getBudgetPeriods } from '@/features/budget/api/getBudgetPeriods'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { TransactionDetailsModal } from '@/components/modals/TransactionDetailsModal'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components'
import { useBudgetPagePayload } from '@/features/budget/hooks/useBudgetPagePayload'
import { useBudgetRevenueAnalytics } from '@/features/budget/hooks/useBudgetRevenueAnalytics'
import { useCategoryRolling12mStats } from '@/features/budget/hooks/useCategoryRolling12mStats'
import { BudgetCategoryList } from '@/features/budget/components/BudgetCategoryList'
import { formatPeriodLabel } from '@/features/budget/utils/budgetSelectors'
import {
  Annual2026BlockMetrics,
  type MetricsScopeSelection,
} from '@/features/annual-analysis/components/Annual2026BlockMetrics'
import { MonthlyFlowsAnalysisCard } from '@/features/annual-analysis/components/Annual2026MonthlyTable'
import { AnnualProjectionSectionConnected } from '@/features/annual-analysis/components/AnnualCostProjection2026'
import { BUCKET_LABELS, BUCKET_ORDER, PILOTAGE_BUCKET_ORDER, MONTH_LABELS_SHORT } from '@/features/annual-analysis/components/_constants'
import blockFixeIcon from '@/assets/icons/blocks/fixe.png'
import blockVariableIcon from '@/assets/icons/blocks/variable.png'
import blockDiscretionnaireIcon from '@/assets/icons/blocks/discretionnaire.png'
import blockEpargneIcon from '@/assets/icons/blocks/epargne.png'
import blockProvisionsIcon from '@/assets/icons/blocks/provisions.png'
import blockRevenusIcon from '@/assets/icons/blocks/revenus.png'
import budgetsPeriodIcon from '@/assets/icons/app/budgets_period.png'

type PeriodKey = 'mois' | 'annee'
type DataDisplayMode = 'reel' | 'budget'
type SubCatTrend = 'up' | 'down' | 'equal'
type BudgetYtdSlideView = 'kpi' | 'history' | 'monthly_flows_table' | 'monthly_flows_chart'

interface MonthlyBucket {
  month: string
  monthStart: string
  amount: number
  chartAmount?: number
  isScaleOverflow?: boolean
  isScaleBreakMonth?: boolean
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

type BudgetBlockId = 'socle_fixe' | 'variable_essentielle' | 'discretionnaire' | 'epargne' | 'provision' | 'cagnotte'
const REVENUE_BLOCK_PAGE_ID = 'revenu' as const
const ALL_CATEGORIES_SCOPE_ID = 'all_categories' as const
type BlockPageId = BudgetBlockId | typeof REVENUE_BLOCK_PAGE_ID
const REVENUE_HISTORY_Y_AXIS_MAX = 15000

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
  iconKey: string | null
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

interface RevenueSourceDonutDatum {
  id: string
  name: string
  parentName: string | null
  value: number
  transactionCount: number
  color: string
}

interface PieSegmentCallout {
  id: string
  text: string
  color: string
  pillX: number
  pillY: number
  pillWidth: number
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

interface HistoryWindowMonth {
  key: string
  monthLabel: string
  monthStart: string
  periodYear: number
  periodMonth: number
}

function formatPercentSigned(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function formatThousandsTick(value: number): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return '0'
  return `${Math.round(numeric / 1000)}k`
}

function formatTxDateDayMonth(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '--/--'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function formatMonthYearFrench(monthStart: string | null | undefined): string {
  if (!monthStart) return '—'
  const d = new Date(`${monthStart.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return d
    .toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    .replace('.', '')
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

function monthKey(periodYear: number, periodMonth: number): string {
  return `${periodYear}-${pad2(periodMonth)}`
}

function normalizeCategoryToken(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function getSavingsSubCategoryRank(name: string): number {
  const token = normalizeCategoryToken(name)
  if (token.includes('virement') && token.includes('epargne')) return 0
  if (token.includes('investissement')) return 1
  if (token.includes('placement')) return 2
  if (token.includes('projet')) return 3
  if (token.includes('interet')) return 4
  return 99
}

function buildHistoryWindow(periodYear: number, periodMonth: number, monthsBack: number): HistoryWindowMonth[] {
  const safeMonthsBack = Math.max(1, monthsBack)
  const months: HistoryWindowMonth[] = []

  for (let offset = safeMonthsBack - 1; offset >= 0; offset -= 1) {
    const date = new Date(periodYear, periodMonth - 1 - offset, 1)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    months.push({
      key: monthKey(year, month),
      monthLabel: MONTH_LABELS_SHORT[month - 1],
      monthStart: `${year}-${pad2(month)}-01`,
      periodYear: year,
      periodMonth: month,
    })
  }

  return months
}

function getPeriodRange(
  key: PeriodKey,
  selectedYear: number,
  selectedMonth: number,
): { startDate: string; endDate: string } {
  const now = new Date()
  const today = todayIso()

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

function formatMonthYearShort(month: number, year: number): string {
  const monthLabel = MONTHS_FR_FULL[Math.max(0, Math.min(11, month - 1))] ?? 'Mois'
  const shortYear = String(year).slice(-2)
  return `${monthLabel} ${shortYear}`
}

const MONTHS_FR_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const VIZ_TOKENS = ['var(--viz-a)', 'var(--viz-b)', 'var(--viz-c)', 'var(--viz-d)', 'var(--viz-e)'] as const
const BUDGET_BLOCKS: Array<{ id: BudgetBlockId; label: string; color: string }> = [
  { id: 'socle_fixe', label: 'Fixe', color: 'var(--primary-500)' },
  { id: 'variable_essentielle', label: 'Variable essentielle', color: 'var(--color-success)' },
  { id: 'discretionnaire', label: 'Discrétionnaire', color: 'var(--color-error)' },
  { id: 'epargne', label: 'Épargne', color: 'var(--color-warning)' },
  { id: 'provision', label: 'Provision', color: 'var(--viz-d)' },
]

const BLOCK_LIST_ORDER: BudgetBlockId[] = [
  'discretionnaire',
  'socle_fixe',
  'variable_essentielle',
  'provision',
  'epargne',
]

const BLOCK_PROGRESS_COLORS: Record<BudgetBlockId, string> = {
  socle_fixe: '#5B57F5',
  variable_essentielle: '#2ED47A',
  epargne: '#FFAB2E',
  provision: '#6C63FF',
  discretionnaire: '#FC5A5A',
  cagnotte: '#4A4A62',
}

const BLOCK_ICON_SRC: Record<BudgetBlockId, string> = {
  socle_fixe: blockFixeIcon,
  variable_essentielle: blockVariableIcon,
  discretionnaire: blockDiscretionnaireIcon,
  epargne: blockEpargneIcon,
  provision: blockProvisionsIcon,
  cagnotte: blockProvisionsIcon,
}

const BUCKET_SCOPE_ICON_SRC: Record<string, string> = {
  socle_fixe: blockFixeIcon,
  variable_essentielle: blockVariableIcon,
  provision: blockProvisionsIcon,
  discretionnaire: blockDiscretionnaireIcon,
  epargne: blockEpargneIcon,
  revenu: blockRevenusIcon,
  cagnotte_projet: blockEpargneIcon,
}

const SLIDE_THREE_SCOPE_COLORS: Record<string, string> = {
  revenu: 'var(--color-success)',
  socle_fixe: 'var(--primary-500)',
  variable_essentielle: '#4CC9F0',
  discretionnaire: 'var(--color-error)',
  provision: 'var(--viz-d)',
  epargne: 'var(--color-warning)',
  hors_pilotage: 'var(--neutral-400)',
}

function accentFromLabel(label: string | null | undefined): string {
  const safeLabel = typeof label === 'string' && label.trim().length > 0 ? label : 'categorie'
  const key = safeLabel.trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash << 5) - hash + key.charCodeAt(i)
  return VIZ_TOKENS[Math.abs(hash) % VIZ_TOKENS.length]
}

function mapBudgetBucketToBlock(bucket: string | null | undefined): BudgetBlockId | null {
  switch (bucket) {
    case 'socle_fixe':
      return 'socle_fixe'
    case 'variable_essentielle':
      return 'variable_essentielle'
    case 'discretionnaire':
      return 'discretionnaire'
    case 'provision':
      return 'provision'
    case 'epargne':
      return 'epargne'
    default:
      return null
  }
}

function formatBudgetBucketLabel(bucket: string | null | undefined): string {
  if (!bucket) return 'Non classé'
  if (bucket === 'socle_fixe') return 'Fixe'
  if (bucket === 'variable_essentielle') return 'Variable essentielle'
  if (bucket === 'discretionnaire') return 'Discrétionnaire'
  if (bucket === 'cagnotte_projet') return 'Cagnotte projet'
  if (bucket === 'provision') return 'Provision'
  if (bucket === 'epargne') return 'Épargne'
  if (bucket === 'hors_pilotage') return 'Hors pilotage'
  return bucket
}

function truncateCalloutLabel(value: string, maxLength = 14): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(1, maxLength - 1)).trim()}…`
}

function formatCalloutLabel(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  if (normalized === 'variable essentielle') return 'Variable'
  if (normalized === 'discretionnaire') return 'Discret.'
  return value
}

function buildSegmentCallouts(
  items: PieDatum[],
  total: number,
  size: { width: number; height: number },
  options: { maxVisible?: number; cyRatio?: number; outerRadius?: number } = {},
): PieSegmentCallout[] {
  if (total <= 0 || !items.length || size.width <= 0 || size.height <= 0) return []

  const maxVisible = options.maxVisible ?? 5
  const cyRatio = options.cyRatio ?? 0.46
  const outerRadius = options.outerRadius ?? 124
  const entries = items.filter((item) => (item.value / total) > 0.10).slice(0, maxVisible)
  const cx = size.width * 0.5
  const cy = size.height * cyRatio
  const anchorRadius = outerRadius - 4
  const outsideOffset = Math.max(6, Math.min(10, size.width * 0.025))
  const margin = 8
  const radian = Math.PI / 180
  const pillHeight = 20
  const verticalGap = 4

  let cumulativeRatio = 0

  const raw = entries.map((entry) => {
    const ratio = entry.value / total
    const pct = Math.max(1, Math.round(ratio * 100))
    const rawLabel = `${truncateCalloutLabel(formatCalloutLabel(entry.name))} ${pct}%`
    const textWidth = Math.max(48, rawLabel.length * 6.1)
    const pillWidth = textWidth + 16

    const midAngle = 90 - (cumulativeRatio + ratio / 2) * 360
    cumulativeRatio += ratio

    const cos = Math.cos(-midAngle * radian)
    const sin = Math.sin(-midAngle * radian)
    const anchorX = cx + anchorRadius * cos
    const anchorY = cy + anchorRadius * sin
    const isRightSide = anchorX >= cx
    const pillXRaw = isRightSide
      ? anchorX + outsideOffset
      : anchorX - pillWidth - outsideOffset
    const pillX = Math.max(margin, Math.min(pillXRaw, size.width - pillWidth - margin))
    const pillY = Math.max(margin, Math.min(anchorY - pillHeight / 2, size.height - pillHeight - margin))

    return {
      id: entry.id,
      text: rawLabel,
      color: entry.color,
      pillX,
      pillY,
      pillWidth,
      side: isRightSide ? 'right' : 'left' as const,
    }
  })

  const adjustStack = (itemsToAdjust: Array<(typeof raw)[number]>) => {
    const ordered = [...itemsToAdjust].sort((a, b) => a.pillY - b.pillY)
    for (let i = 1; i < ordered.length; i += 1) {
      const prev = ordered[i - 1]
      const current = ordered[i]
      const minY = prev.pillY + pillHeight + verticalGap
      if (current.pillY < minY) current.pillY = minY
    }
    for (let i = ordered.length - 2; i >= 0; i -= 1) {
      const next = ordered[i + 1]
      const current = ordered[i]
      const maxY = next.pillY - pillHeight - verticalGap
      if (current.pillY > maxY) current.pillY = maxY
    }
    for (const item of ordered) {
      item.pillY = Math.max(margin, Math.min(item.pillY, size.height - pillHeight - margin))
    }
  }

  adjustStack(raw.filter((item) => item.side === 'left'))
  adjustStack(raw.filter((item) => item.side === 'right'))

  return raw.map(({ side: _side, ...item }) => item)
}

function BarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload?: MonthlyBucket }> }) {
  if (!active || !payload?.length) return null
  const amount = Number(payload[0]?.payload?.amount ?? payload[0]?.value ?? 0)
  const budget = Number(payload[0]?.payload?.budget ?? 0)
  const gapPct = budget > 0 ? ((amount - budget) / budget) * 100 : null
  return (
    <div style={{ background: 'var(--primary-600)', borderRadius: 'var(--radius-md)', padding: '6px 11px', boxShadow: 'var(--shadow-md)', display: 'grid', gap: 2 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--neutral-0)', textAlign: 'center' }}>
        {formatCurrencyFloored(amount)}
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
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--neutral-0)' }}>{categoryName} - {formatCurrencyFloored(categoryAmount)}</p>
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
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--neutral-800)' }}>{getTxLabel(tx)}</span>
                    <span style={{ fontSize: 13, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{formatCurrencyFloored(Number(tx.amount))}</span>
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
  const { data: availableBudgetPeriods = [] } = useQuery({
    queryKey: ['budget-periods'],
    queryFn: getBudgetPeriods,
    staleTime: 5 * 60_000,
  })
  const [dataDisplayMode, setDataDisplayMode] = useState<DataDisplayMode>('reel')
  const selectedCat = searchParams.get('category') ?? 'all'
  const selectedBlockQuery = searchParams.get('block')
  const selectedBlockPageId = useMemo<BlockPageId | null>(() => {
    if (!selectedBlockQuery) return null
    if (selectedBlockQuery === REVENUE_BLOCK_PAGE_ID) return REVENUE_BLOCK_PAGE_ID
    return BUDGET_BLOCKS.some((block) => block.id === selectedBlockQuery)
      ? (selectedBlockQuery as BudgetBlockId)
      : null
  }, [selectedBlockQuery])
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
  const [revenueGraphSlide, setRevenueGraphSlide] = useState(0)
  const [revenueSourceView, setRevenueSourceView] = useState<'list' | 'donut'>('list')
  const [selectedRevenueSourceId, setSelectedRevenueSourceId] = useState<string | null>(null)
  const [activeSlide, setActiveSlide] = useState(0)
  const [slideThreeScopeSelection, setSlideThreeScopeSelection] = useState<MetricsScopeSelection>({
    kind: 'categorie',
    id: ALL_CATEGORIES_SCOPE_ID,
  })
  const [showSlideThreeScopeSheet, setShowSlideThreeScopeSheet] = useState(false)
  const [slideThreePeriod, setSlideThreePeriod] = useState('2026')
  const [selectedYtdSlideView, setSelectedYtdSlideView] = useState<BudgetYtdSlideView>('kpi')
  const [showYtdSlideViewMenu, setShowYtdSlideViewMenu] = useState(false)
  const [showSlideThreePeriodMenu, setShowSlideThreePeriodMenu] = useState(false)
  const {
    data: budgetPayload,
  } = useBudgetPagePayload({
    periodYear: selectedPeriodYear,
    periodMonth: selectedPeriodMonth,
    monthsBack: 6,
  })
  const {
    loading: revenueAnalyticsLoading,
    error: revenueAnalyticsError,
    data: revenueAnalytics,
  } = useBudgetRevenueAnalytics(selectedPeriodYear, selectedPeriodMonth)
  const payloadByBucket = useMemo(() => {
    const rows = Array.isArray(budgetPayload?.by_bucket) ? budgetPayload.by_bucket : []
    return rows.reduce<Record<string, (typeof rows)[number]>>((acc, row) => {
      const key = String(row?.budget_bucket ?? '')
      if (!key) return acc
      acc[key] = row
      return acc
    }, {})
  }, [budgetPayload])

  useEffect(() => {
    if (!import.meta.env.DEV || !budgetPayload) return
    console.log('[Budget Mapping Check] by_bucket keys', Object.keys(payloadByBucket))
    console.log('[Budget Mapping Check] epargne', payloadByBucket.epargne)
    console.log('[Budget Mapping Check] provision', payloadByBucket.provision)
  }, [budgetPayload, payloadByBucket])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    console.log('[BudgetRevenueAnalytics]', revenueAnalytics)
  }, [revenueAnalytics])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    console.log('[BudgetYTD] selected slide view', {
      selectedYtdSlideView,
      slideThreeScopeSelection,
      slideThreePeriod,
      activeSlide,
    })
  }, [activeSlide, selectedYtdSlideView, slideThreePeriod, slideThreeScopeSelection])

  const visibleBudgetBuckets = useMemo(
    () => PILOTAGE_BUCKET_ORDER.map((bucket) => ({
      bucket,
      label: BUCKET_LABELS[bucket],
      data: payloadByBucket[bucket],
    })),
    [payloadByBucket],
  )
  const payloadByParentCategory = useMemo(
    () => (Array.isArray(budgetPayload?.by_parent_category) ? budgetPayload.by_parent_category : []),
    [budgetPayload],
  )
  const payloadByCategory = useMemo(
    () => (Array.isArray(budgetPayload?.by_category) ? budgetPayload.by_category : []),
    [budgetPayload],
  )
  const donutTooltipRef = useRef<HTMLDivElement | null>(null)
  const categoryDonutRef = useRef<HTMLDivElement | null>(null)
  const blockDonutRef = useRef<HTMLDivElement | null>(null)
  const [categoryDonutSize, setCategoryDonutSize] = useState({ width: 0, height: 0 })
  const [blockDonutSize, setBlockDonutSize] = useState({ width: 0, height: 0 })
  const dragStartXRef = useRef<number | null>(null)
  const dragDeltaXRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const topSectionRef = useRef<HTMLElement | null>(null)
  const categoriesSectionRef = useRef<HTMLElement | null>(null)
  const blocksSectionTitleRef = useRef<HTMLHeadingElement | null>(null)
  const projectionSectionTitleRef = useRef<HTMLHeadingElement | null>(null)
  const smoothScrollFrameRef = useRef<number | null>(null)
  const topTravelSnapTimeoutRef = useRef<number | null>(null)
  const shouldFocusCategoriesSectionRef = useRef(false)
  const shouldFocusBlocksSectionRef = useRef(false)
  const [viewportWidth, setViewportWidth] = useState<number>(() => (typeof window === 'undefined' ? 1024 : window.innerWidth))

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isCompactMobile = viewportWidth <= 360
  const slideHeaderHorizontalPadding = isCompactMobile ? 'var(--space-4)' : 'var(--space-6)'
  const slideThreeParamCardWidth = isCompactMobile ? 132 : 140

  const setSelectedCat = useCallback((nextCategoryId: string) => {
    const nextParams = new URLSearchParams(searchParamsKey)
    if (nextCategoryId === 'all') nextParams.delete('category')
    else nextParams.set('category', nextCategoryId)
    nextParams.delete('block')
    setSearchParams(nextParams, { replace: true })
  }, [searchParamsKey, setSearchParams])

  const setSelectedBlockPage = useCallback((nextBlockId: BlockPageId | null) => {
    const nextParams = new URLSearchParams(searchParamsKey)
    if (nextBlockId) {
      nextParams.set('block', nextBlockId)
      nextParams.delete('category')
    } else {
      nextParams.delete('block')
    }
    setSearchParams(nextParams, { replace: true })
  }, [searchParamsKey, setSearchParams])

  useEffect(() => {
    setPeriodKey('mois')
    setSelectedPeriodYear(defaultPeriodYear)
    setSelectedPeriodMonth(defaultPeriodMonth)
    setDataDisplayMode('reel')
    setActiveSlide(0)

    if (searchParamsKey.includes('category=') || searchParamsKey.includes('block=')) {
      const nextParams = new URLSearchParams(searchParamsKey)
      nextParams.delete('category')
      nextParams.delete('block')
      setSearchParams(nextParams, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!availableBudgetPeriods.length) return
    const hasCurrentSelection = availableBudgetPeriods.some(
      (p) => p.period_year === defaultPeriodYear && p.period_month === defaultPeriodMonth,
    )
    if (!hasCurrentSelection) {
      setSelectedPeriodYear(availableBudgetPeriods[0].period_year)
      setSelectedPeriodMonth(availableBudgetPeriods[0].period_month)
    }
  }, [availableBudgetPeriods, defaultPeriodYear, defaultPeriodMonth])

  const handleHeaderTitleReset = useCallback(() => {
    setSelectedCat('all')
    setSelectedBlockPage(null)
    setPeriodKey('mois')
    setSelectedPeriodYear(defaultPeriodYear)
    setSelectedPeriodMonth(defaultPeriodMonth)
    setShowHeaderPeriodMenu(false)
    setShowCatSheet(false)
  }, [defaultPeriodMonth, defaultPeriodYear, setSelectedBlockPage, setSelectedCat])

  const cancelSmoothScroll = useCallback(() => {
    if (smoothScrollFrameRef.current == null) return
    window.cancelAnimationFrame(smoothScrollFrameRef.current)
    smoothScrollFrameRef.current = null
  }, [])

  const cancelTopTravelSnap = useCallback(() => {
    if (topTravelSnapTimeoutRef.current == null) return
    window.clearTimeout(topTravelSnapTimeoutRef.current)
    topTravelSnapTimeoutRef.current = null
  }, [])

  const scrollViewportToTop = useCallback(() => {
    cancelSmoothScroll()
    cancelTopTravelSnap()
    const scroller = document.scrollingElement as HTMLElement | null
    if (scroller) scroller.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (scroller) scroller.scrollTo({ top: 0, left: 0, behavior: 'auto' })
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      })
    })
  }, [cancelSmoothScroll, cancelTopTravelSnap])

  const smoothScrollToY = useCallback((targetY: number, duration = 760) => {
    cancelSmoothScroll()
    const scroller = document.scrollingElement as HTMLElement | null
    const startY = scroller?.scrollTop ?? window.scrollY
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
      const nextY = startY + distance * eased
      if (scroller) scroller.scrollTo({ top: nextY, left: 0, behavior: 'auto' })
      else window.scrollTo(0, nextY)
      if (progress < 1) {
        smoothScrollFrameRef.current = window.requestAnimationFrame(step)
      } else {
        smoothScrollFrameRef.current = null
      }
    }

    smoothScrollFrameRef.current = window.requestAnimationFrame(step)
  }, [cancelSmoothScroll])

  const resolveTopOffset = useCallback(() => {
    const rawHeader = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim()
    const headerPx = Number.parseFloat(rawHeader || '0')
    return Number.isFinite(headerPx) ? headerPx + 10 : 78
  }, [])

  const scrollToLowerSection = useCallback(() => {
    const target = activeSlide === 0
      ? categoriesSectionRef.current
      : activeSlide === 1
        ? blocksSectionTitleRef.current
        : activeSlide === 2
          ? projectionSectionTitleRef.current
          : null
    if (!target) return
    const y = target.getBoundingClientRect().top + window.scrollY - resolveTopOffset()
    smoothScrollToY(Math.max(0, y))
  }, [activeSlide, resolveTopOffset, smoothScrollToY])

  const scrollToTopSection = useCallback(() => {
    const scroller = document.scrollingElement as HTMLElement | null
    const startY = scroller?.scrollTop ?? window.scrollY
    if (startY <= 1) {
      scrollViewportToTop()
      return
    }
    cancelTopTravelSnap()
    const duration = Math.max(900, Math.min(1550, Math.round(startY * 0.65)))
    smoothScrollToY(0, duration)
    topTravelSnapTimeoutRef.current = window.setTimeout(() => {
      scrollViewportToTop()
      topTravelSnapTimeoutRef.current = null
    }, duration + 90)
  }, [cancelTopTravelSnap, scrollViewportToTop, smoothScrollToY])

  const scrollToCategoriesSectionTop = useCallback(() => {
    const target = categoriesSectionRef.current
    if (!target) return false
    const rawHeader = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim()
    const headerPx = Number.parseFloat(rawHeader || '0')
    const breathingMargin = 12
    const effectiveHeaderOffset = Number.isFinite(headerPx) ? headerPx + breathingMargin : 80
    const y = target.getBoundingClientRect().top + window.scrollY - effectiveHeaderOffset
    cancelSmoothScroll()
    const targetY = Math.max(0, y)
    const scroller = document.scrollingElement as HTMLElement | null
    if (scroller) scroller.scrollTo({ top: targetY, left: 0, behavior: 'auto' })
    window.scrollTo({ top: targetY, left: 0, behavior: 'auto' })
    window.requestAnimationFrame(() => {
      if (scroller) scroller.scrollTo({ top: targetY, left: 0, behavior: 'auto' })
      window.scrollTo({ top: targetY, left: 0, behavior: 'auto' })
    })
    return true
  }, [cancelSmoothScroll])

  const scrollToBlocksSectionTop = useCallback(() => {
    const target = blocksSectionTitleRef.current
    if (!target) return false
    const rawHeader = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim()
    const headerPx = Number.parseFloat(rawHeader || '0')
    const breathingMargin = 12
    const effectiveHeaderOffset = Number.isFinite(headerPx) ? headerPx + breathingMargin : 80
    const y = target.getBoundingClientRect().top + window.scrollY - effectiveHeaderOffset
    cancelSmoothScroll()
    const targetY = Math.max(0, y)
    const scroller = document.scrollingElement as HTMLElement | null
    if (scroller) scroller.scrollTo({ top: targetY, left: 0, behavior: 'auto' })
    window.scrollTo({ top: targetY, left: 0, behavior: 'auto' })
    window.requestAnimationFrame(() => {
      if (scroller) scroller.scrollTo({ top: targetY, left: 0, behavior: 'auto' })
      window.scrollTo({ top: targetY, left: 0, behavior: 'auto' })
    })
    return true
  }, [cancelSmoothScroll])

  useEffect(() => () => {
    cancelSmoothScroll()
    cancelTopTravelSnap()
  }, [cancelSmoothScroll, cancelTopTravelSnap])

  useEffect(() => {
    const categoryElement = categoryDonutRef.current
    const blockElement = blockDonutRef.current
    if (!categoryElement && !blockElement) return

    const updateCategorySize = () => {
      if (!categoryElement) return
      const rect = categoryElement.getBoundingClientRect()
      setCategoryDonutSize({ width: rect.width, height: rect.height })
    }
    const updateBlockSize = () => {
      if (!blockElement) return
      const rect = blockElement.getBoundingClientRect()
      setBlockDonutSize({ width: rect.width, height: rect.height })
    }

    updateCategorySize()
    updateBlockSize()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateCategorySize)
      window.addEventListener('resize', updateBlockSize)
      return () => {
        window.removeEventListener('resize', updateCategorySize)
        window.removeEventListener('resize', updateBlockSize)
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      updateCategorySize()
      updateBlockSize()
    })
    if (categoryElement) resizeObserver.observe(categoryElement)
    if (blockElement) resizeObserver.observe(blockElement)
    return () => resizeObserver.disconnect()
  }, [activeSlide])

  useEffect(() => {
    if (selectedCat !== 'all') {
      scrollViewportToTop()
    }
  }, [selectedCat, scrollViewportToTop])

  useLayoutEffect(() => {
    if (selectedCat === 'all') return
    scrollViewportToTop()
    const timeoutIdA = window.setTimeout(() => {
      scrollViewportToTop()
    }, 80)
    const timeoutIdB = window.setTimeout(() => {
      scrollViewportToTop()
    }, 220)
    return () => {
      window.clearTimeout(timeoutIdA)
      window.clearTimeout(timeoutIdB)
    }
  }, [selectedCat, scrollViewportToTop])

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

  useEffect(() => {
    if (!shouldFocusCategoriesSectionRef.current) return
    if (selectedCat !== 'all' || activeSlide !== 0) return

    let cancelled = false

    const tryFocus = (attemptsLeft: number) => {
      if (cancelled || !shouldFocusCategoriesSectionRef.current) return
      const scrolledNow = scrollToCategoriesSectionTop()
      if (scrolledNow) {
        shouldFocusCategoriesSectionRef.current = false
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            void scrollToCategoriesSectionTop()
          })
        })
        return
      }
      if (attemptsLeft <= 0) return
      window.setTimeout(() => {
        tryFocus(attemptsLeft - 1)
      }, 48)
    }

    tryFocus(14)

    return () => {
      cancelled = true
    }
  }, [selectedCat, activeSlide, scrollToCategoriesSectionTop])

  useEffect(() => {
    if (!shouldFocusBlocksSectionRef.current) return
    if (selectedBlockPageId != null || activeSlide !== 1) return

    let cancelled = false

    const tryFocus = (attemptsLeft: number) => {
      if (cancelled || !shouldFocusBlocksSectionRef.current) return
      const scrolledNow = scrollToBlocksSectionTop()
      if (scrolledNow) {
        shouldFocusBlocksSectionRef.current = false
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            void scrollToBlocksSectionTop()
          })
        })
        return
      }
      if (attemptsLeft <= 0) return
      window.setTimeout(() => {
        tryFocus(attemptsLeft - 1)
      }, 48)
    }

    tryFocus(14)

    return () => {
      cancelled = true
    }
  }, [selectedBlockPageId, activeSlide, scrollToBlocksSectionTop])

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
      category_icon_key: null,
      parent_category_id: row.parent_category_id,
      parent_category_name: row.parent_category_name,
      parent_category_icon_key: null,
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
      category_icon_key: null,
      parent_category_id: null,
      parent_category_name: null,
      parent_category_icon_key: null,
      budget_bucket: '',
      budget_method: null,
      decision_status: null,
      final_budget_monthly_eur: null,
      manual_budget_monthly_eur: null,
      recommendation_comment: null,
    }))
  }, [payloadByParentCategory, budgetPayload, selectedPeriodMonth, selectedPeriodYear])

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
        icon_key: null,
      },
      budget_amount: Number(row.budget_amount ?? 0),
    }))
  }, [budgetPayload, payloadByCategory])

  const { data: categories = [], isFetched: categoriesFetched } = useCategories()
  const expenseCategories = useMemo(() => categories.filter((c) => c.flow_type === 'expense'), [categories])
  const rootExpenseCategories = useMemo(() => expenseCategories.filter((c) => c.parent_id === null), [expenseCategories])
  const rootNavigableCategories = useMemo(
    () => categories.filter((c) => c.parent_id === null && (c.flow_type === 'expense' || c.flow_type === 'savings')),
    [categories],
  )
  const childCategories = useMemo(() => categories.filter((c) => c.parent_id !== null), [categories])
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const expenseCategoryIdSet = useMemo(() => new Set(expenseCategories.map((c) => c.id)), [expenseCategories])
  const savingsCategoryIds = useMemo(
    () => categories.filter((c) => c.flow_type === 'savings').map((c) => c.id),
    [categories],
  )
  const epargneRootCategory = useMemo(
    () => categories.find((c) => c.parent_id === null && c.flow_type === 'savings' && normalizeCategoryToken(c.name) === 'epargne') ?? null,
    [categories],
  )
  const epargneSubCategories = useMemo(() => {
    if (!epargneRootCategory) return []
    return childCategories
      .filter((c) => c.parent_id === epargneRootCategory.id)
      .sort((a, b) => {
        const rankDiff = getSavingsSubCategoryRank(a.name) - getSavingsSubCategoryRank(b.name)
        if (rankDiff !== 0) return rankDiff
        return a.name.localeCompare(b.name, 'fr')
      })
  }, [childCategories, epargneRootCategory])
  const slideThreeBlockOptions = useMemo(
    () => BUCKET_ORDER
      .filter((bucketKey) => bucketKey !== 'hors_pilotage')
      .map((bucketKey) => ({
        id: bucketKey,
        label: BUCKET_LABELS[bucketKey] ?? bucketKey,
        iconSrc: BUCKET_SCOPE_ICON_SRC[bucketKey] ?? blockProvisionsIcon,
      })),
    [],
  )
  const slideThreeSelectedScopeMeta = useMemo(() => {
    if (slideThreeScopeSelection.kind === 'bloc') {
      return {
        label: BUCKET_LABELS[slideThreeScopeSelection.id] ?? slideThreeScopeSelection.id,
        iconType: 'block' as const,
        iconSrc: BUCKET_SCOPE_ICON_SRC[slideThreeScopeSelection.id] ?? blockProvisionsIcon,
        iconKey: null as string | null,
        color: SLIDE_THREE_SCOPE_COLORS[slideThreeScopeSelection.id] ?? 'var(--primary-500)',
      }
    }
    if (slideThreeScopeSelection.id === ALL_CATEGORIES_SCOPE_ID) {
      return {
        label: 'Toutes catégories',
        iconType: 'category' as const,
        iconSrc: null as string | null,
        iconKey: 'toutes_categories',
        color: 'var(--primary-500)',
      }
    }
    const category = categoryById.get(slideThreeScopeSelection.id) ?? null
    const categoryPayload = payloadByCategory.find((row) => row.category_id === slideThreeScopeSelection.id)
    const scopeColor = categoryPayload?.budget_bucket
      ? (SLIDE_THREE_SCOPE_COLORS[categoryPayload.budget_bucket] ?? accentFromLabel(category?.name))
      : accentFromLabel(category?.name)
    return {
      label: category?.name ?? 'Catégorie',
      iconType: 'category' as const,
      iconSrc: null as string | null,
      iconKey: category?.icon_key ?? null,
      color: scopeColor,
    }
  }, [categoryById, payloadByCategory, slideThreeScopeSelection])
  const slideThreePeriods = useMemo(() => ['2026', ...MONTHS_FR_FULL.slice(0, 5)], [])

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
    childCategories.forEach((c) => {
      if (c.parent_id === selectedCat) ids.push(c.id)
    })
    return ids
  }, [childCategories, selectedCat])

  const selectedRootCategoryId = useMemo(() => {
    if (selectedCat === 'all') return null
    let current = categoryById.get(selectedCat) ?? null
    if (!current) return selectedCat
    while (current?.parent_id) {
      current = categoryById.get(current.parent_id) ?? null
    }
    return current?.id ?? selectedCat
  }, [categoryById, selectedCat])

  const selectedRootCategory = useMemo(
    () => (selectedRootCategoryId ? categoryById.get(selectedRootCategoryId) ?? null : null),
    [categoryById, selectedRootCategoryId],
  )

  const isSavingsCategoryMode = useMemo(() => {
    if (selectedCat === 'all') return false
    if (!selectedRootCategory) return false
    if (selectedRootCategory.flow_type === 'savings') return true
    return normalizeCategoryToken(selectedRootCategory.name) === 'epargne'
  }, [selectedCat, selectedRootCategory])

  const selectedCategoryFlowType: FlowType = isSavingsCategoryMode ? 'savings' : 'expense'
  const historyWindowMonths = useMemo(
    () => buildHistoryWindow(selectedPeriodYear, selectedPeriodMonth, 6),
    [selectedPeriodYear, selectedPeriodMonth],
  )
  const historyRange = useMemo(() => {
    if (!historyWindowMonths.length) return null
    const first = historyWindowMonths[0]
    const last = historyWindowMonths[historyWindowMonths.length - 1]
    const endDateObj = new Date(last.periodYear, last.periodMonth, 0)
    const endDate = `${endDateObj.getFullYear()}-${pad2(endDateObj.getMonth() + 1)}-${pad2(endDateObj.getDate())}`
    return {
      startDate: first.monthStart,
      endDate,
    }
  }, [historyWindowMonths])
  const selectedCategoryHistoryIds = useMemo(() => {
    if (selectedCategoryIds) return selectedCategoryIds
    if (selectedCat !== 'all') return [selectedCat]

    const excludedRootNames = new Set(['revenus', 'transferts', 'epargne'])
    const childrenCountByParentId = new Map<string, number>()
    for (const category of categories) {
      if (!category.parent_id) continue
      childrenCountByParentId.set(category.parent_id, (childrenCountByParentId.get(category.parent_id) ?? 0) + 1)
    }

    const allowedRootIds = new Set(
      rootExpenseCategories
        .filter((root) => !excludedRootNames.has(normalizeCategoryToken(root.name)))
        .map((root) => root.id),
    )

    return categories
      .filter((category) => {
        if (category.parent_id) return allowedRootIds.has(category.parent_id)
        return allowedRootIds.has(category.id) && (childrenCountByParentId.get(category.id) ?? 0) === 0
      })
      .map((category) => category.id)
  }, [selectedCategoryIds, selectedCat, categories, rootExpenseCategories])

  const { data: periodTxns } = useTransactions({
    ...range,
    flowType: selectedCategoryFlowType,
    categoryIds: selectedCategoryIds,
  })

  const { data: periodSavingsTxns = [] } = useTransactions({
    ...range,
    flowType: 'savings',
    categoryIds: savingsCategoryIds.length > 0 ? savingsCategoryIds : undefined,
    debugSource: 'Budgets:periodSavings',
  }, {
    enabled: savingsCategoryIds.length > 0,
  })

  const { data: historySavingsTxns = [] } = useTransactions({
    startDate: historyRange?.startDate,
    endDate: historyRange?.endDate,
    flowType: 'savings',
    categoryIds: savingsCategoryIds.length > 0 ? savingsCategoryIds : undefined,
    debugSource: 'Budgets:historySavings',
  }, {
    enabled: Boolean(historyRange) && savingsCategoryIds.length > 0,
  })

  const subCategoryModalIds = useMemo(() => {
    if (!selectedSubCategory) return undefined
    const ids = [selectedSubCategory.id]
    childCategories.forEach((c) => {
      if (c.parent_id === selectedSubCategory.id) ids.push(c.id)
    })
    return ids
  }, [selectedSubCategory, childCategories])

  const selectedSubCategoryFlowType: FlowType = useMemo(() => {
    if (!selectedSubCategory) return 'expense'
    return categoryById.get(selectedSubCategory.id)?.flow_type === 'savings' ? 'savings' : 'expense'
  }, [categoryById, selectedSubCategory])

  const { data: subCategoryTransactions, isLoading: loadingSubCategoryTransactions } = useTransactions({
    ...range,
    flowType: selectedSubCategoryFlowType,
    categoryIds: subCategoryModalIds,
    debugSource: 'Budgets:subCategoryTransactions',
  }, {
    enabled: Boolean(selectedSubCategory),
  })

  const totalMonthlyBudget = useMemo(() => {
    if (!summaries?.length) return 0
    if (selectedCat === 'all') {
      return summaries.reduce((sum, summary) => (
        expenseCategoryIdSet.has(summary.category.id) ? sum + summary.budget_amount : sum
      ), 0)
    }
    return summaries.find((s) => s.category.id === selectedCat)?.budget_amount ?? 0
  }, [summaries, selectedCat, expenseCategoryIdSet])

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
  const { data: categoryHistoryRaw = [] } = useQuery({
    queryKey: ['budgets', 'category-history', selectedCat, selectedPeriodYear, selectedPeriodMonth, selectedCategoryHistoryIds],
    enabled: selectedCategoryHistoryIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      if (!historyWindowMonths.length || selectedCategoryHistoryIds.length === 0) return []

      const startMonth = historyWindowMonths[0].monthStart
      const endMonth = historyWindowMonths[historyWindowMonths.length - 1].monthStart

      const { data, error } = await budgetDb
        .from('v_monthly_category_actuals_clean' as never)
        .select('period_year, period_month, actual_amount, category_id')
        .in('category_id', selectedCategoryHistoryIds)
        .gte('month_start', startMonth)
        .lte('month_start', endMonth)

      if (error) throw new Error(`category history query failed: ${error.message}`)
      return (data ?? []) as Array<{ period_year: number; period_month: number; actual_amount: number | null }>
    },
  })
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

  const categoryMonthlyHistory = useMemo<MonthlyBucket[]>(() => {
    const actualByMonthKey = new Map<string, number>()

    for (const row of categoryHistoryRaw) {
      const periodYear = Number(row.period_year)
      const periodMonth = Number(row.period_month)
      if (!Number.isFinite(periodYear) || !Number.isFinite(periodMonth)) continue
      const key = monthKey(periodYear, periodMonth)
      actualByMonthKey.set(key, (actualByMonthKey.get(key) ?? 0) + Number(row.actual_amount ?? 0))
    }

    const base = historyWindowMonths.map((monthRow) => {
      const amount = actualByMonthKey.get(monthRow.key) ?? 0
      return {
        month: monthRow.monthLabel,
        monthStart: monthRow.monthStart,
        amount,
        budget: categoryMonthlyBudget,
        isCurrent: monthRow.periodYear === selectedPeriodYear && monthRow.periodMonth === selectedPeriodMonth,
      }
    })

    return base.map((row, idx) => {
      if (idx === 0) return { ...row, evolutionPct: null }
      const prev = base[idx - 1].amount
      if (prev <= 0) return { ...row, evolutionPct: null }
      return { ...row, evolutionPct: ((row.amount - prev) / prev) * 100 }
    })
  }, [categoryHistoryRaw, historyWindowMonths, categoryMonthlyBudget, selectedPeriodYear, selectedPeriodMonth])
  const monthlyHistory = categoryMonthlyHistory

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

  const pieTotal = useMemo(() => pieData.reduce((sum, item) => sum + item.value, 0), [pieData])
  const categorySegmentCallouts = useMemo<PieSegmentCallout[]>(
    () => buildSegmentCallouts(pieData, pieTotal, categoryDonutSize, { maxVisible: 5, cyRatio: 0.46, outerRadius: 124 }),
    [pieData, pieTotal, categoryDonutSize],
  )
  const budgetAmountByCategoryFromPayload = useMemo(
    () => new Map(payloadByCategory.map((row) => [row.category_id, Number(row.budget_amount ?? 0)])),
    [payloadByCategory],
  )
  const listSubCategoryRows = useMemo<SubCategoryTrendItem[]>(() => {
    if (selectedCat === 'all') return []
    const txs = periodTxns ?? []
    if (!childCategories.length) return []
    const isEpargneCategoryPage = Boolean(epargneRootCategory && selectedCat === epargneRootCategory.id)

    const totalsBySubCategory = txs.reduce<Map<string, number>>((acc, tx) => {
      if (!tx.category_id) return acc
      acc.set(tx.category_id, (acc.get(tx.category_id) ?? 0) + Number(tx.amount))
      return acc
    }, new Map<string, number>())

    const visibleSubCategories = isEpargneCategoryPage
      ? epargneSubCategories
      : childCategories.filter((subCat) => subCat.parent_id === selectedCat)

    const rows = visibleSubCategories
      .map((subCat) => ({
        id: subCat.id,
        name: subCat.name,
        iconKey: subCat.icon_key ?? null,
        parentCategoryName: subCat.parent_id ? categoryById.get(subCat.parent_id)?.name ?? null : null,
        currentMonthAmount: totalsBySubCategory.get(subCat.id) ?? 0,
        previousMonthAmount: 0,
        threeMonthAvg: 0,
        trend: 'equal' as SubCatTrend,
      }))

    const filteredRows = isEpargneCategoryPage
      ? rows
      : rows.filter((row) => row.currentMonthAmount > 0 || (budgetByCategoryId.get(row.id) ?? 0) > 0)

    return filteredRows.sort((a, b) => {
      if (isEpargneCategoryPage) {
        const rankDiff = getSavingsSubCategoryRank(a.name) - getSavingsSubCategoryRank(b.name)
        if (rankDiff !== 0) return rankDiff
      }
      return b.currentMonthAmount - a.currentMonthAmount
    })
  }, [periodTxns, childCategories, epargneSubCategories, epargneRootCategory, selectedCat, categoryById, budgetByCategoryId])

  const categoryBarRows = useMemo<CategoryBarRow[]>(() => {
    if (selectedCat === 'all') return []
    const isEpargneCategoryPage = Boolean(epargneRootCategory && selectedCat === epargneRootCategory.id)

    const baseRows = listSubCategoryRows
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
    const filteredRows = isEpargneCategoryPage
      ? baseRows
      : baseRows.filter((row) => row.actualAmount > 0 || row.budgetAmount > 0)

    return filteredRows.sort((a, b) => {
      if (isEpargneCategoryPage) {
        const rankDiff = getSavingsSubCategoryRank(a.name) - getSavingsSubCategoryRank(b.name)
        if (rankDiff !== 0) return rankDiff
      }
      return b.displayAmount - a.displayAmount
    })
  }, [selectedCat, listSubCategoryRows, budgetByCategoryId, epargneRootCategory])
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

  const periodSavingsByCategory = useMemo(() => {
    return periodSavingsTxns.reduce<Map<string, number>>((acc, tx) => {
      if (!tx.category_id) return acc
      acc.set(tx.category_id, (acc.get(tx.category_id) ?? 0) + Number(tx.amount))
      return acc
    }, new Map<string, number>())
  }, [periodSavingsTxns])

  const historySavingsByMonthKey = useMemo(() => {
    return historySavingsTxns.reduce<Map<string, number>>((acc, tx) => {
      const date = tx.transaction_date?.slice(0, 10)
      if (!date) return acc
      const parsed = new Date(`${date}T00:00:00`)
      if (Number.isNaN(parsed.getTime())) return acc
      const key = monthKey(parsed.getFullYear(), parsed.getMonth() + 1)
      acc.set(key, (acc.get(key) ?? 0) + Number(tx.amount))
      return acc
    }, new Map<string, number>())
  }, [historySavingsTxns])

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
	      for (const bucketEntry of visibleBudgetBuckets) {
          const bucketRow = bucketEntry.data
          if (!bucketRow) continue
	        const primaryBlockId = mapBudgetBucketToBlock(bucketRow.budget_bucket)
	        if (!primaryBlockId) continue
          
          const target = initial.get(primaryBlockId)
          if (target) {
            target.budgetAmount = Number(bucketRow.budget_amount ?? 0)
            target.actualAmount = Number(bucketRow.actual_amount ?? 0)
            target.lines = payloadByCategory
              .filter((row) => row.budget_bucket === bucketRow.budget_bucket)
              .map((row) => ({
                id: row.category_id,
                categoryName: row.category_name,
                parentCategoryName: row.parent_category_name,
                budgetAmount: Number(row.budget_amount ?? 0),
                actualAmount: Number(row.actual_amount ?? 0),
              }))

            if (primaryBlockId === 'epargne') {
              const savingsLineSource = epargneSubCategories.length > 0
                ? epargneSubCategories
                : target.lines
                  .map((line) => categoryById.get(line.id))
                  .filter((line): line is NonNullable<typeof line> => Boolean(line))
                  .sort((a, b) => {
                    const rankDiff = getSavingsSubCategoryRank(a.name) - getSavingsSubCategoryRank(b.name)
                    if (rankDiff !== 0) return rankDiff
                    return a.name.localeCompare(b.name, 'fr')
                  })

              target.lines = savingsLineSource.map((subCategory) => ({
                id: subCategory.id,
                categoryName: subCategory.name,
                parentCategoryName: subCategory.parent_id ? categoryById.get(subCategory.parent_id)?.name ?? null : null,
                budgetAmount: budgetAmountByCategoryFromPayload.get(subCategory.id) ?? 0,
                actualAmount: periodSavingsByCategory.get(subCategory.id) ?? 0,
              }))
              target.budgetAmount = target.lines.reduce((sum, line) => sum + line.budgetAmount, 0)
              target.actualAmount = target.lines.reduce((sum, line) => sum + line.actualAmount, 0)
            }
          }
	      }
	    }

    const isVisibleLine = (categoryId: string | null, parentCategoryId: string | null): boolean => {
      if (selectedCat === 'all') return true
      if (!categoryId) return false
      return categoryId === selectedCat || parentCategoryId === selectedCat
    }

	    for (const line of selectedCat === 'all' ? [] : configuredBudgetCategoryLines) {
	      if (!isVisibleLine(line.category_id, line.parent_category_id)) continue
	      const primaryBlockId = mapBudgetBucketToBlock(line.budget_bucket)
	      if (!primaryBlockId) continue
        
        const target = initial.get(primaryBlockId)
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
  }, [budgetPayload, visibleBudgetBuckets, payloadByCategory, configuredBudgetCategoryLines, selectedCat, periodSpentByCategory, periodSavingsByCategory, dataDisplayMode, epargneSubCategories, categoryById, budgetAmountByCategoryFromPayload])

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
  const blockSegmentCallouts = useMemo<PieSegmentCallout[]>(
    () => buildSegmentCallouts(blockPieData, blockDonutTotal, blockDonutSize, { maxVisible: 5, cyRatio: 0.46, outerRadius: 120 }),
    [blockPieData, blockDonutTotal, blockDonutSize],
  )
  const blockRowsForList = useMemo(() => {
    const rank = new Map<BudgetBlockId, number>(BLOCK_LIST_ORDER.map((id, index) => [id, index]))
    return [...blockRows].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99))
  }, [blockRows])
  const revenueHistoryRows = useMemo(
    () => [...(revenueAnalytics?.monthlySeries ?? [])].sort((a, b) => b.month_start.localeCompare(a.month_start)),
    [revenueAnalytics],
  )
  const monthlyCommitmentsTarget = useMemo(
    () => visibleBudgetBuckets.reduce((sum, bucket) => sum + Number(bucket.data?.budget_amount ?? 0), 0),
    [visibleBudgetBuckets],
  )
  const selectedMonthRevenueAmount = Number(revenueAnalytics?.selectedMonthRevenue ?? 0)
  const revenueCoverageRatio = monthlyCommitmentsTarget > 0 ? selectedMonthRevenueAmount / monthlyCommitmentsTarget : 0
  const revenueCoveragePctRounded = Math.round(revenueCoverageRatio * 100)
  const revenueProgressPct = Math.min(100, Math.max(0, revenueCoveragePctRounded))
  const revenueSurplusPct = monthlyCommitmentsTarget > 0
    ? ((selectedMonthRevenueAmount - monthlyCommitmentsTarget) / monthlyCommitmentsTarget) * 100
    : null
  const isRevenueAboveTarget = selectedMonthRevenueAmount > monthlyCommitmentsTarget && monthlyCommitmentsTarget > 0
  const selectedBlock = useMemo(
    () => (selectedBlockId ? blockRows.find((row) => row.id === selectedBlockId) ?? null : null),
    [selectedBlockId, blockRows],
  )
  const selectedBlockPage = useMemo(
    () => (selectedBlockPageId ? blockRows.find((row) => row.id === selectedBlockPageId) ?? null : null),
    [selectedBlockPageId, blockRows],
  )
  const isRevenueBlockPage = selectedBlockPageId === REVENUE_BLOCK_PAGE_ID
  const revenueGraphSlideCount = 3
  const revenueSlideTitles = [
    'Historique des revenus mensuels 25-26',
    'Historique des opérations 25-26',
    'Dernières opérations YTD',
  ] as const
  const revenueActiveSlideTitle = revenueSlideTitles[revenueGraphSlide] ?? revenueSlideTitles[0]
  const revenuePageColor = 'var(--color-success)'
  const revenueTableHeaderBackground = `color-mix(in oklab, ${revenuePageColor} 30%, var(--neutral-0) 70%)`
  const revenueListHeaderBackground = `color-mix(in oklab, ${revenuePageColor} 30%, var(--neutral-0) 70%)`
  const categoryListHeaderBackground = `color-mix(in oklab, ${accentFromLabel(selectedCatInfo?.name)} 22%, var(--neutral-0) 78%)`
  const blockListHeaderBackground = `color-mix(in oklab, ${selectedBlockPage?.color ?? 'var(--primary-500)'} 22%, var(--neutral-0) 78%)`
  const revenueMonthlyHistory = useMemo<MonthlyBucket[]>(() => {
    const series = [...(revenueAnalytics?.monthlySeries ?? [])].sort((a, b) => a.month_start.localeCompare(b.month_start))
    const base = series.map((row) => {
      const date = new Date(`${row.month_start}T00:00:00`)
      const periodYear = Number.isNaN(date.getTime()) ? selectedPeriodYear : date.getFullYear()
      const periodMonth = Number.isNaN(date.getTime()) ? selectedPeriodMonth : date.getMonth() + 1
      const amount = Number(row.revenue_amount ?? 0)
      const isScaleOverflow = amount > REVENUE_HISTORY_Y_AXIS_MAX
      return {
        month: MONTH_LABELS_SHORT[Math.max(0, Math.min(11, periodMonth - 1))] ?? '--',
        monthStart: row.month_start,
        amount,
        chartAmount: Math.min(amount, REVENUE_HISTORY_Y_AXIS_MAX),
        isScaleOverflow,
        isScaleBreakMonth: isScaleOverflow && periodYear === 2025 && periodMonth === 1,
        budget: 0,
        isCurrent: periodYear === selectedPeriodYear && periodMonth === selectedPeriodMonth,
      }
    })

    return base.map((row, idx) => {
      if (idx === 0) return { ...row, evolutionPct: null }
      const prev = base[idx - 1].amount
      if (prev <= 0) return { ...row, evolutionPct: null }
      return { ...row, evolutionPct: ((row.amount - prev) / prev) * 100 }
    })
  }, [revenueAnalytics, selectedPeriodMonth, selectedPeriodYear])
  const revenueSourceMaxAmount = useMemo(
    () => (revenueAnalytics?.bySource ?? []).reduce((max, row) => Math.max(max, Number(row.total_amount ?? 0)), 0),
    [revenueAnalytics],
  )
  const revenueSourceGreenPalette = useMemo(
    () => ([
      '#0C5D39',
      '#167A4B',
      '#1F955B',
      '#2DB26E',
      '#4BC684',
      '#6FD69D',
      '#94E3B7',
      '#B9EED1',
    ]),
    [],
  )
  const revenueSourceDonutData = useMemo<RevenueSourceDonutDatum[]>(
    () => (revenueAnalytics?.bySource ?? [])
      .map((source, index) => {
        const value = Number(source.total_amount ?? 0)
        return {
          id: `${source.source_name}-${source.parent_source_name ?? 'none'}-${index}`,
          name: source.source_name,
          parentName: source.parent_source_name ?? null,
          value,
          transactionCount: Number(source.transaction_count ?? 0),
          color: revenueSourceGreenPalette[index % revenueSourceGreenPalette.length],
        }
      })
      .filter((item) => item.value > 0),
    [revenueAnalytics, revenueSourceGreenPalette],
  )
  const selectedRevenueSource = useMemo(() => {
    if (!revenueSourceDonutData.length) return null
    if (!selectedRevenueSourceId) return null
    return revenueSourceDonutData.find((row) => row.id === selectedRevenueSourceId) ?? null
  }, [revenueSourceDonutData, selectedRevenueSourceId])
  const revenueSourceDonutTotal = useMemo(
    () => revenueSourceDonutData.reduce((sum, row) => sum + row.value, 0),
    [revenueSourceDonutData],
  )

  useEffect(() => {
    if (isRevenueBlockPage) return
    setRevenueGraphSlide(0)
    setRevenueSourceView('list')
  }, [isRevenueBlockPage])

  useEffect(() => {
    if (!isRevenueBlockPage) return
    if (!revenueSourceDonutData.length) {
      setSelectedRevenueSourceId(null)
      return
    }
    if (selectedRevenueSourceId && revenueSourceDonutData.some((row) => row.id === selectedRevenueSourceId)) return
    setSelectedRevenueSourceId(null)
  }, [isRevenueBlockPage, revenueSourceDonutData, selectedRevenueSourceId])

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
        showDividerBefore: false,
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

  const isExpenseBlockPage = selectedBlockPage != null
  const isBlockMode = isExpenseBlockPage || isRevenueBlockPage
  const isCategoryMode = selectedCat !== 'all' && !isBlockMode
  const isRootMode = selectedCat === 'all' && !isBlockMode
  const showExtendedSlides = isRootMode
  const slideCount = showExtendedSlides ? 3 : 2
  const showRealBudgetToggle = showExtendedSlides && activeSlide < 2
  const isSlideThreeMetricsMode = showExtendedSlides && activeSlide === 2
  const isSlideOneOrTwoMode = showExtendedSlides && activeSlide < 2
  const shouldLoadRolling12mStats = isSlideThreeMetricsMode
    && (selectedYtdSlideView === 'kpi' || selectedYtdSlideView === 'history')
  const { data: categoryRolling12mStats = [] } = useCategoryRolling12mStats(shouldLoadRolling12mStats)
  const ytdSlideViewLabel: Record<BudgetYtdSlideView, string> = {
    kpi: 'KPI',
    history: 'Historique',
    monthly_flows_table: 'Flux mensuels',
    monthly_flows_chart: 'Graphique flux',
  }
  const ytdSlideViewOptions: Array<{ id: BudgetYtdSlideView; label: string }> = [
    { id: 'kpi', label: 'KPI' },
    { id: 'history', label: 'Historique' },
    { id: 'monthly_flows_table', label: 'Flux mensuels' },
    { id: 'monthly_flows_chart', label: 'Graphique flux' },
  ]
  const isSlideThreeMonthlyFlowsView = isSlideThreeMetricsMode
    && (selectedYtdSlideView === 'monthly_flows_table' || selectedYtdSlideView === 'monthly_flows_chart')
  const slideThreeLockedPeriodLabel = '2026 YTD'
  const ytdSlideHeading = selectedYtdSlideView === 'kpi'
    ? ''
    : selectedYtdSlideView === 'history'
      ? 'Historique'
      : selectedYtdSlideView === 'monthly_flows_table'
        ? 'Flux mensuels'
        : 'Graphique flux'
  const ytdScopeLabel = slideThreeSelectedScopeMeta.label
    ? `${slideThreeSelectedScopeMeta.label.charAt(0).toUpperCase()}${slideThreeSelectedScopeMeta.label.slice(1)}`
    : '—'
  const slideThreeMonthlyBudget = useMemo(() => {
    if (!isSlideThreeMonthlyFlowsView) return null
    if (slideThreeScopeSelection.kind === 'bloc') {
      return payloadByBucket[slideThreeScopeSelection.id]?.budget_amount ?? null
    }
    if (slideThreeScopeSelection.kind === 'categorie' && slideThreeScopeSelection.id !== ALL_CATEGORIES_SCOPE_ID) {
      return payloadByParentCategory.find((r) => r.parent_category_id === slideThreeScopeSelection.id)?.budget_amount ?? null
    }
    return null
  }, [isSlideThreeMonthlyFlowsView, slideThreeScopeSelection, payloadByBucket, payloadByParentCategory])
  const slideThreeBaseYear = useMemo(() => {
    const yearOption = slideThreePeriods.find((periodOption) => /^\d{4}$/.test(periodOption))
    return yearOption ? Number(yearOption) : selectedPeriodYear
  }, [selectedPeriodYear, slideThreePeriods])
  const headerPeriodLabel = useMemo(() => {
    if (isSlideThreeMetricsMode) {
      if (isSlideThreeMonthlyFlowsView) return slideThreeLockedPeriodLabel
      if (/^\d{4}$/.test(slideThreePeriod)) return `Année ${slideThreePeriod}`
      const shortYear = String(slideThreeBaseYear).slice(-2)
      return `${slideThreePeriod} ${shortYear}`
    }
    if (periodKey === 'annee') return `Année ${selectedPeriodYear}`
    return formatMonthYearShort(selectedPeriodMonth, selectedPeriodYear)
  }, [
    isSlideThreeMetricsMode,
    isSlideThreeMonthlyFlowsView,
    periodKey,
    selectedPeriodMonth,
    selectedPeriodYear,
    slideThreeLockedPeriodLabel,
    slideThreeBaseYear,
    slideThreePeriod,
  ])
  const canJumpToCategoriesSection = isRootMode && activeSlide === 0 && Boolean(configuredBudgetPeriod)
  const canJumpToBlocksSection = isRootMode && activeSlide === 1 && blockRows.length > 0
  const canJumpToProjectionSection = isSlideThreeMetricsMode
  const showSectionTravelShortcuts = canJumpToCategoriesSection || canJumpToBlocksSection || canJumpToProjectionSection
  const goToSlide = (index: number) => setActiveSlide(((index % slideCount) + slideCount) % slideCount)
  const goNextSlide = () => goToSlide(activeSlide + 1)
  const goPrevSlide = () => goToSlide(activeSlide - 1)

  useEffect(() => {
    setActiveSlide((current) => Math.min(current, slideCount - 1))
  }, [slideCount])

  useEffect(() => {
    if (isSlideOneOrTwoMode) return
    setShowHeaderPeriodMenu(false)
  }, [isSlideOneOrTwoMode])

  useEffect(() => {
    if (isSlideThreeMetricsMode) return
    setShowYtdSlideViewMenu(false)
    setShowSlideThreePeriodMenu(false)
  }, [isSlideThreeMetricsMode])

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
    if (!isBlockMode) return
    setSelectedBlockId(null)
  }, [isBlockMode])

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
  const historyBudgetTarget = Math.max(0, Number(selectedCat === 'all' ? totalMonthlyBudget : categoryMonthlyBudget))
  const blockPageHistory = useMemo(() => {
    if (!selectedBlockPage) return []

    if (selectedBlockPage.id === 'epargne') {
      const base = historyWindowMonths.map((monthRow) => {
        const amount = historySavingsByMonthKey.get(monthRow.key) ?? 0
        return {
          month: monthRow.monthLabel,
          monthStart: monthRow.monthStart,
          amount,
          budget: Math.max(0, Number(selectedBlockPage.budgetAmount ?? 0)),
          isCurrent: monthRow.periodYear === selectedPeriodYear && monthRow.periodMonth === selectedPeriodMonth,
        }
      })

      return base.map((row, idx) => {
        if (idx === 0) return { ...row, evolutionPct: null }
        const prev = base[idx - 1].amount
        if (prev <= 0) return { ...row, evolutionPct: null }
        return { ...row, evolutionPct: ((row.amount - prev) / prev) * 100 }
      })
    }

    const budgetRatio = totalMonthlyBudget > 0 ? selectedBlockPage.budgetAmount / totalMonthlyBudget : 0
    const actualRatio = selectedPeriodSpent > 0 ? selectedBlockPage.actualAmount / selectedPeriodSpent : 0

    return monthlyHistory.map((row) => ({
      ...row,
      amount: Math.max(0, row.amount * actualRatio),
      budget: Math.max(0, row.budget * budgetRatio),
    }))
  }, [historySavingsByMonthKey, historyWindowMonths, monthlyHistory, selectedBlockPage, selectedPeriodMonth, selectedPeriodSpent, selectedPeriodYear, totalMonthlyBudget])
  const blockPageSixMonthAverage = useMemo(() => {
    if (!blockPageHistory.length) return 0
    return blockPageHistory.reduce((sum, row) => sum + row.amount, 0) / blockPageHistory.length
  }, [blockPageHistory])
  const blockPageSixMonthGapPct = useMemo(() => {
    const rows = blockPageHistory.filter((row) => row.budget > 0)
    if (!rows.length) return null
    const total = rows.reduce((sum, row) => sum + ((row.amount - row.budget) / row.budget) * 100, 0)
    return total / rows.length
  }, [blockPageHistory])
  const blockPageLineMaxAmount = useMemo(() => {
    if (!selectedBlockPage) return 0
    return selectedBlockPage.lines.reduce((max, line) => {
      const displayedAmount = dataDisplayMode === 'budget' ? line.budgetAmount : line.actualAmount
      return Math.max(max, displayedAmount)
    }, 0)
  }, [dataDisplayMode, selectedBlockPage])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: (isCategoryMode || isBlockMode) ? 'var(--space-6)' : 'var(--space-5)' }}>
      <PageHeader
        title="Budgets"
        titleAriaLabel="Réinitialiser sur toutes catégories et période actuelle"
        onTitleClick={handleHeaderTitleReset}
        actionIcon={
          isSlideOneOrTwoMode
            ? (
              <img
                src={budgetsPeriodIcon}
                alt="Icône période budgets"
                width={30}
                height={30}
                loading="lazy"
                decoding="async"
                style={{ display: 'block', objectFit: 'contain' }}
              />
              )
            : isSlideThreeMetricsMode
            ? (
              slideThreeSelectedScopeMeta.iconType === 'block'
                ? (
                  <img
                    src={slideThreeSelectedScopeMeta.iconSrc ?? blockProvisionsIcon}
                    alt={`Icône ${slideThreeSelectedScopeMeta.label}`}
                    width={28}
                    height={28}
                    loading="lazy"
                    decoding="async"
                    style={{ display: 'block', objectFit: 'contain' }}
                  />
                  )
                : <CategoryIcon iconKey={slideThreeSelectedScopeMeta.iconKey} label={slideThreeSelectedScopeMeta.label} size={28} />
            )
            : isRevenueBlockPage
            ? (
              <img
                src={blockRevenusIcon}
                alt="Icône bloc Revenus"
                width={28}
                height={28}
                loading="lazy"
                decoding="async"
                style={{ display: 'block', objectFit: 'contain' }}
              />
              )
            : isExpenseBlockPage && selectedBlockPage
            ? (
              <img
                src={BLOCK_ICON_SRC[selectedBlockPage.id]}
                alt={`Icône bloc ${selectedBlockPage.label}`}
                width={28}
                height={28}
                loading="lazy"
                decoding="async"
                style={{ display: 'block', objectFit: 'contain' }}
              />
              )
            : selectedCat === 'all'
              ? (
                <img
                  src={budgetsPeriodIcon}
                  alt="Icône période budgets"
                  width={26}
                  height={26}
                  loading="lazy"
                  decoding="async"
                  style={{ display: 'block', objectFit: 'contain' }}
                />
                )
              : <CategoryIcon iconKey={selectedCatInfo?.icon_key} label={selectedCatInfo?.name} size={28} />
        }
        actionAriaLabel={isSlideOneOrTwoMode ? 'Choisir une période' : (isSlideThreeMetricsMode ? 'Choisir un bloc ou une catégorie' : 'Choisir une catégorie')}
        onActionClick={() => {
          if (isSlideOneOrTwoMode) {
            setShowCatSheet(false)
            setShowSlideThreeScopeSheet(false)
            setShowHeaderPeriodMenu((current) => !current)
            return
          }
          setShowHeaderPeriodMenu(false)
          if (isSlideThreeMetricsMode) {
            setShowCatSheet(false)
            setShowSlideThreeScopeSheet((current) => !current)
            return
          }
          setShowSlideThreeScopeSheet(false)
          setShowCatSheet((current) => !current)
        }}
        rightLabel={headerPeriodLabel}
      />
      {showHeaderPeriodMenu && isSlideOneOrTwoMode ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 160,
            background: 'rgba(10, 12, 22, 0.18)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            paddingTop: 'calc(var(--safe-top) + 68px)',
            paddingLeft: 'var(--page-gutter)',
            paddingRight: 'var(--page-gutter)',
          }}
          onClick={() => setShowHeaderPeriodMenu(false)}
        >
          <motion.div
            role="menu"
            aria-label="Choisir une période Budgets"
            initial={{ opacity: 0, y: -8, scaleY: 0.9 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -8, scaleY: 0.9 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              width: 'fit-content',
              minWidth: 0,
              maxWidth: 'calc(100vw - 2 * var(--page-gutter))',
              maxHeight: 'min(68vh, 520px)',
              overflowY: 'auto',
              background: 'var(--neutral-0)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-card)',
              padding: 'var(--space-2)',
              display: 'grid',
              gap: 2,
              transformOrigin: 'top center',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {headerPeriodOptions.map((option) => (
              <div key={option.key}>
                {option.showDividerBefore ? (
                  <div style={{ height: 1, background: 'var(--neutral-200)', margin: 'var(--space-1) 0' }} />
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    option.onSelect()
                    setShowHeaderPeriodMenu(false)
                  }}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    background: option.active ? 'var(--primary-50)' : 'transparent',
                    color: option.active ? 'var(--primary-700)' : 'var(--neutral-800)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: option.active ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    padding: 'var(--space-2) var(--space-3)',
                    cursor: 'pointer',
                  }}
                >
                  {option.label}
                </button>
              </div>
            ))}
          </motion.div>
        </div>
      ) : null}

      {showExtendedSlides ? (
        <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ padding: `0 ${slideHeaderHorizontalPadding}` }}>
          <div style={{ maxWidth: 600, margin: '0 auto', minHeight: 112, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--space-2)', alignItems: 'center' }}>
            {showRealBudgetToggle ? (
              <>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={() => setDataDisplayMode('reel')}
                style={{
                  border: dataDisplayMode === 'reel' ? '2px solid var(--neutral-900)' : '1px solid var(--neutral-200)',
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
                  {formatCurrencyFloored(selectedPeriodSpent).replace(/\s+€/, '€')}
                </span>
              </button>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)', fontWeight: 700, flexShrink: 0 }}>-</span>
              <button
                type="button"
                onClick={() => setDataDisplayMode('budget')}
                style={{
                  border: dataDisplayMode === 'budget' ? '2px solid var(--neutral-900)' : '1px solid var(--neutral-200)',
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
                  {formatCurrencyFloored(totalMonthlyBudget).replace(/\s+€/, '€')}
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
              <div style={{ display: 'grid', gap: 'var(--space-2)', justifyItems: 'center', position: 'relative' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowYtdSlideViewMenu((current) => !current)
                      setShowSlideThreePeriodMenu(false)
                    }}
                    aria-label="Choisir le contenu de la slide Analyse"
                    aria-haspopup="menu"
                    aria-expanded={showYtdSlideViewMenu}
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
                      minWidth: slideThreeParamCardWidth,
                      width: slideThreeParamCardWidth,
                      minHeight: 48,
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'inherit', lineHeight: 1.1, color: 'var(--neutral-700)', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'capitalize' }}>
                      {ytdSlideViewLabel[selectedYtdSlideView]}
                    </span>
                    <ChevronDown size={14} color="var(--neutral-500)" style={{ position: 'absolute', right: 8, top: '50%', transform: `translateY(-50%) rotate(${showYtdSlideViewMenu ? 180 : 0}deg)`, transition: 'transform var(--transition-fast)' }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isSlideThreeMonthlyFlowsView) return
                      setShowSlideThreePeriodMenu((current) => !current)
                      setShowYtdSlideViewMenu(false)
                    }}
                    aria-label="Choisir une période"
                    aria-haspopup="menu"
                    aria-expanded={showSlideThreePeriodMenu}
                    disabled={isSlideThreeMonthlyFlowsView}
                    style={{
                      border: '1px solid var(--neutral-200)',
                      background: isSlideThreeMonthlyFlowsView ? 'var(--neutral-100)' : 'var(--neutral-0)',
                      color: isSlideThreeMonthlyFlowsView ? 'var(--neutral-400)' : 'var(--neutral-600)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-2) var(--space-3)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      textAlign: 'center',
                      minWidth: slideThreeParamCardWidth,
                      width: slideThreeParamCardWidth,
                      minHeight: 48,
                      cursor: isSlideThreeMonthlyFlowsView ? 'not-allowed' : 'pointer',
                      position: 'relative',
                      opacity: isSlideThreeMonthlyFlowsView ? 0.9 : 1,
                    }}
                  >
                    {isSlideThreeMonthlyFlowsView ? (
                      <span
                        style={{
                          color: 'var(--neutral-500)',
                          fontSize: '13px',
                          fontWeight: 700,
                          fontFamily: 'inherit',
                          lineHeight: 1.1,
                          width: '100%',
                          textAlign: 'center',
                          paddingRight: 12,
                          paddingLeft: 8,
                          WebkitTextSizeAdjust: '100%',
                        }}
                      >
                        {slideThreeLockedPeriodLabel}
                      </span>
                    ) : (
                      <span
                        style={{
                          color: 'var(--neutral-700)',
                          fontSize: '13px',
                          fontWeight: 700,
                          fontFamily: 'inherit',
                          lineHeight: 1.1,
                          width: '100%',
                          textAlign: 'center',
                          paddingRight: 12,
                          paddingLeft: 8,
                          WebkitTextSizeAdjust: '100%',
                        }}
                      >
                        {slideThreePeriod}
                      </span>
                    )}
                    <ChevronDown size={14} color="var(--neutral-500)" style={{ position: 'absolute', right: 8, top: '50%', transform: `translateY(-50%) rotate(${showSlideThreePeriodMenu ? 180 : 0}deg)`, transition: 'transform var(--transition-fast)' }} />
                  </button>
                </div>
                {(showYtdSlideViewMenu || showSlideThreePeriodMenu) ? (
                  <>
                    <div
                      onClick={() => {
                        setShowYtdSlideViewMenu(false)
                        setShowSlideThreePeriodMenu(false)
                      }}
                      style={{ position: 'fixed', inset: 0, zIndex: 120 }}
                    />
                    {showYtdSlideViewMenu ? (
                      <div
                        role="menu"
                        aria-label="Choisir un contenu pour la slide Analyse"
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + var(--space-2))',
                          left: 0,
                          zIndex: 130,
                          minWidth: 196,
                          background: 'var(--neutral-0)',
                          border: '1px solid var(--neutral-200)',
                          borderRadius: 'var(--radius-lg)',
                          boxShadow: 'var(--shadow-card)',
                          padding: 'var(--space-2)',
                          display: 'grid',
                          gap: 2,
                        }}
                      >
                        {ytdSlideViewOptions.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              setSelectedYtdSlideView(option.id)
                              setShowYtdSlideViewMenu(false)
                            }}
                            style={{
                              width: '100%',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              background: selectedYtdSlideView === option.id ? 'var(--primary-50)' : 'transparent',
                              color: selectedYtdSlideView === option.id ? 'var(--primary-700)' : 'var(--neutral-800)',
                              fontSize: 'var(--font-size-sm)',
                              fontWeight: selectedYtdSlideView === option.id ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
                              textAlign: 'left',
                              padding: 'var(--space-2) var(--space-3)',
                              cursor: 'pointer',
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {showSlideThreePeriodMenu && !isSlideThreeMonthlyFlowsView ? (
                      <div
                        role="menu"
                        aria-label="Choisir une période pour la slide Analyse"
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + var(--space-2))',
                          right: 0,
                          zIndex: 130,
                          minWidth: 196,
                          background: 'var(--neutral-0)',
                          border: '1px solid var(--neutral-200)',
                          borderRadius: 'var(--radius-lg)',
                          boxShadow: 'var(--shadow-card)',
                          padding: 'var(--space-2)',
                          display: 'grid',
                          gap: 2,
                        }}
                      >
                        {slideThreePeriods.map((periodOption) => (
                          <button
                            key={periodOption}
                            type="button"
                            onClick={() => {
                              setSlideThreePeriod(periodOption)
                              setShowSlideThreePeriodMenu(false)
                            }}
                            style={{
                              width: '100%',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              background: slideThreePeriod === periodOption ? 'var(--primary-50)' : 'transparent',
                              color: slideThreePeriod === periodOption ? 'var(--primary-700)' : 'var(--neutral-800)',
                              fontSize: 'var(--font-size-sm)',
                              fontWeight: slideThreePeriod === periodOption ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
                              textAlign: 'left',
                              padding: 'var(--space-2) var(--space-3)',
                              cursor: 'pointer',
                            }}
                          >
                            {periodOption}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : (
              <div aria-hidden="true" style={{ width: '100%', height: 80 }} />
            )}
          </div>
        </motion.section>
      ) : null}

      {isExpenseBlockPage && selectedBlockPage ? (
        <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ padding: '0 var(--space-6)' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                <div style={{ minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      shouldFocusBlocksSectionRef.current = true
                      setSelectedBlockPage(null)
                      setActiveSlide(1)
                    }}
                    aria-label="Retour"
                    style={{
                      border: 'none',
                      background: selectedBlockPage.color,
                      color: 'var(--neutral-0)',
                      width: 24,
                      height: 24,
                      minWidth: 24,
                      minHeight: 24,
                      borderRadius: 'var(--radius-full)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <div style={{ minWidth: 0, display: 'inline-flex', alignItems: 'baseline', gap: 'var(--space-1)' }}>
                    <p style={{ margin: 0, minWidth: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.1 }}>
                      {`Socle ${selectedBlockPage.label}`}
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)', fontWeight: 800, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {`${selectedBlockPage.lines.length} cat.`}
                </span>
              </div>

              <div style={{ marginTop: 'var(--space-2)', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 'var(--space-2)' }}>
                <div style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48, display: 'grid', justifyItems: 'center', alignContent: 'center', textAlign: 'center', gap: 2 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>Budget</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-800)', whiteSpace: 'nowrap' }}>
                    {formatCurrencyFloored(selectedBlockPage.budgetAmount).replace(/\s+€/, '€')}
                  </span>
                </div>
                <div style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48, display: 'grid', justifyItems: 'center', alignContent: 'center', textAlign: 'center', gap: 2 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>Moyenne (6M)</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-800)' }}>{formatCurrencyFloored(blockPageSixMonthAverage).replace(/\s+€/, '€')}</span>
                </div>
                <div style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48, display: 'grid', justifyItems: 'center', alignContent: 'center', textAlign: 'center', gap: 2 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>Écart moyen</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: blockPageSixMonthGapPct == null ? 'var(--neutral-500)' : blockPageSixMonthGapPct > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>{blockPageSixMonthGapPct == null ? '—' : formatPercentSigned(blockPageSixMonthGapPct)}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      ) : null}

      {isExpenseBlockPage && selectedBlockPage ? (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ width: '100%', maxWidth: 600, margin: '0 auto', marginTop: 'var(--space-3)', padding: '0 var(--space-5)', display: 'grid', gap: 'var(--space-5)' }}>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={blockPageHistory} barCategoryGap="18%" margin={{ top: 8, right: 44, left: -8, bottom: 4 }}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--neutral-500)' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--neutral-500)' }} tickFormatter={(value) => formatCurrencyFloored(Number(value))} width={68} />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(67,97,238,0.08)' }} />
                <ReferenceLine y={Math.max(0, Number(selectedBlockPage.budgetAmount ?? 0))} stroke="var(--color-warning)" strokeWidth={2} strokeDasharray="4 4" label={{ value: 'Budget mensuel', position: 'right', fill: 'var(--neutral-600)', fontSize: 11 }} />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={46}>
                  <LabelList dataKey="amount" position="top" offset={8} content={(props: unknown) => {
                    const { x, y, width, payload } = (props ?? {}) as LabelListContentProps
                    const item = payload
                    if (!item || item.isCurrent || x == null || y == null || width == null) return null
                    return <text x={Number(x) + Number(width) / 2} y={Number(y) - 6} textAnchor="middle" fill="var(--neutral-900)" fontSize={12} fontWeight={700}>{formatCurrencyFloored(item.amount)}</text>
                  }} />
                  {blockPageHistory.map((entry, i) => <Cell key={`block-history-${i}`} fill={selectedBlockPage.color} fillOpacity={entry.isCurrent ? 1 : 0.62} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div
            style={{
              height: 336,
              border: '1px solid var(--neutral-200)',
              borderRadius: 'var(--radius-xl)',
              background: 'color-mix(in oklab, var(--neutral-0) 92%, var(--neutral-100) 8%)',
              padding: 'var(--space-3)',
              display: 'grid',
              gridTemplateRows: 'auto 1fr',
              gap: 'var(--space-2)',
            }}
          >
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 700, background: blockListHeaderBackground, borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)' }}>
              Répartition par sous-catégories
            </p>
            <div style={{ minHeight: 0, overflowY: 'auto', display: 'grid', alignContent: 'start', gap: 'var(--space-2)', paddingTop: 'var(--space-1)' }}>
              {selectedBlockPage.lines.length === 0 ? (
                <div style={{ height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--neutral-400)', fontSize: 'var(--font-size-sm)' }}>
                  Aucune sous-catégorie active sur cette période
                </div>
              ) : (
                selectedBlockPage.lines.map((line) => {
                  const displayedAmount = dataDisplayMode === 'budget' ? line.budgetAmount : line.actualAmount
                  const secondaryAmount = dataDisplayMode === 'budget' ? line.actualAmount : line.budgetAmount
                  const barWidth = blockPageLineMaxAmount > 0 ? (displayedAmount / blockPageLineMaxAmount) * 100 : 0
                  const iconKey = categoryById.get(line.id)?.icon_key ?? null
                  return (
                    <button
                      key={line.id}
                      type="button"
                      onClick={() => setSelectedSubCategory({
                        id: line.id,
                        name: line.categoryName,
                        iconKey,
                        parentCategoryName: line.parentCategoryName,
                        currentMonthAmount: line.actualAmount,
                        previousMonthAmount: 0,
                        threeMonthAvg: 0,
                        trend: 'equal',
                      })}
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
                        <CategoryIcon iconKey={iconKey} label={line.categoryName} size={16} />
                        <span style={{ minWidth: 0, fontSize: 12, lineHeight: 1.3, color: 'var(--neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {line.categoryName}
                        </span>
                      </span>
                      <span style={{ display: 'grid', gap: 2 }}>
                        <span style={{ width: '100%', height: 11, borderRadius: 'var(--radius-full)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                          <span
                            style={{
                              width: `${displayedAmount <= 0 ? 0 : Math.max(6, Math.min(barWidth, 100))}%`,
                              height: '100%',
                              display: 'block',
                              borderRadius: 'var(--radius-full)',
                              background: selectedBlockPage.color,
                            }}
                          />
                        </span>
                        <span style={{ fontSize: 10, lineHeight: 1.25, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                          {`${formatCurrencyFloored(displayedAmount)} · ${dataDisplayMode === 'budget' ? `Réel ${formatCurrencyFloored(secondaryAmount)}` : `Budget ${formatCurrencyFloored(secondaryAmount)}`}`}
                        </span>
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </motion.section>
      ) : null}

      {isRevenueBlockPage ? (
        <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ padding: '0 var(--space-6)' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                <div style={{ minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBlockPage(null)
                      setActiveSlide(1)
                      scrollViewportToTop()
                    }}
                    aria-label="Retour"
                    style={{
                      border: 'none',
                      background: revenuePageColor,
                      color: 'var(--neutral-0)',
                      width: 24,
                      height: 24,
                      minWidth: 24,
                      minHeight: 24,
                      borderRadius: 'var(--radius-full)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <div style={{ minWidth: 0, display: 'inline-flex', alignItems: 'baseline', gap: 'var(--space-1)' }}>
                    <p style={{ margin: 0, minWidth: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.1 }}>
                      Socle revenus
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 'var(--space-2)', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 'var(--space-2)' }}>
                <div style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48, display: 'grid', justifyItems: 'center', alignContent: 'center', textAlign: 'center', gap: 2 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>Mois en cours</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-800)', whiteSpace: 'nowrap' }}>
                    {formatCurrencyFloored(revenueAnalytics?.selectedMonthRevenue ?? 0).replace(/\s+€/, '€')}
                  </span>
                </div>
                <div style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48, display: 'grid', justifyItems: 'center', alignContent: 'center', textAlign: 'center', gap: 2 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>Moyenne 25-26</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-800)' }}>
                    {formatCurrencyFloored(revenueAnalytics?.avgMonthlyRevenue2025_2026 ?? 0).replace(/\s+€/, '€')}
                  </span>
                </div>
                <div style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48, display: 'grid', justifyItems: 'center', alignContent: 'center', textAlign: 'center', gap: 2 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>Moyenne (6M)</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-800)' }}>
                    {formatCurrencyFloored(revenueAnalytics?.avgMonthlyRevenueLast6M ?? 0).replace(/\s+€/, '€')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      ) : null}

      {isRevenueBlockPage ? (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ width: '100%', maxWidth: 600, margin: '0 auto', marginTop: 'var(--space-4)', padding: '0 var(--space-5)', display: 'grid', gap: 'var(--space-5)' }}>
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 700 }}>
              {revenueActiveSlideTitle}
            </p>
            <div style={{ height: 220, minHeight: 220, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex',
                  width: `${revenueGraphSlideCount * 100}%`,
                  transform: `translateX(-${(100 / revenueGraphSlideCount) * revenueGraphSlide}%)`,
                  transition: 'transform 300ms ease',
                }}
              >
                <div style={{ width: `${100 / revenueGraphSlideCount}%`, flexShrink: 0, height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueMonthlyHistory} barCategoryGap="18%" margin={{ top: 18, right: 30, left: -8, bottom: 4 }}>
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--neutral-500)' }} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: 'var(--neutral-500)', dx: -6 }}
                        tickFormatter={(value) => formatThousandsTick(Number(value))}
                        domain={[0, REVENUE_HISTORY_Y_AXIS_MAX]}
                        ticks={[0, 5000, 10000, 15000]}
                        width={44}
                      />
                      <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(67,97,238,0.08)' }} />
                      <ReferenceLine
                        y={REVENUE_HISTORY_Y_AXIS_MAX}
                        stroke="var(--neutral-300)"
                        strokeDasharray="3 4"
                        ifOverflow="extendDomain"
                      />
                      <Bar
                        dataKey="chartAmount"
                        radius={[8, 8, 0, 0]}
                        maxBarSize={46}
                        style={{ cursor: 'pointer' }}
                      >
                        <LabelList dataKey="amount" position="top" offset={8} content={(props: unknown) => {
                          const { x, y, width, payload } = (props ?? {}) as LabelListContentProps
                          const item = payload
                          if (!item || x == null || y == null || width == null) return null

                          if (item.isScaleBreakMonth) {
                            const xPos = Number(x)
                            const yPos = Number(y)
                            const w = Number(width)
                            const capWidth = Math.max(12, w - 10)
                            const capX = xPos + (w - capWidth) / 2
                            const capY = yPos + 3
                            return (
                              <g>
                                <rect
                                  x={capX}
                                  y={capY}
                                  width={capWidth}
                                  height={7}
                                  rx={3}
                                  fill="rgba(255,255,255,0.16)"
                                  stroke="var(--color-warning)"
                                  strokeWidth={1.5}
                                  strokeDasharray="2 2"
                                />
                              </g>
                            )
                          }

                          const xCenter = Number(x) + Number(width) / 2
                          if (item.isCurrent || item.isScaleOverflow) return null
                          return (
                            <text
                              x={xCenter}
                              y={Number(y) - 6}
                              textAnchor="middle"
                              fill="var(--neutral-900)"
                              fontSize={12}
                              fontWeight={700}
                            >
                              {formatCurrencyFloored(item.amount)}
                            </text>
                          )
                        }} />
                        {revenueMonthlyHistory.map((entry, i) => (
                          <Cell
                            key={`revenue-history-${i}`}
                            fill={revenuePageColor}
                            fillOpacity={entry.isCurrent ? 1 : 0.62}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ width: `${100 / revenueGraphSlideCount}%`, flexShrink: 0, height: 220 }}>
                  <div style={{ height: '100%', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 92px 62px', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: revenueTableHeaderBackground, fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-800)', fontWeight: 700 }}>
                      <span>Mois</span>
                      <span style={{ justifySelf: 'start', paddingLeft: 'var(--space-2)' }}>Montant</span>
                      <span style={{ justifySelf: 'center', textAlign: 'center', width: '100%' }}>Entrées</span>
                    </div>
                    <div style={{ minHeight: 0, overflowY: 'auto' }}>
                      {revenueHistoryRows.length ? revenueHistoryRows.map((row) => (
                        <div key={row.month_start} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 92px 62px', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderTop: '1px solid var(--neutral-200)', alignItems: 'center' }}>
                          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)', fontWeight: 600 }}>
                            {formatMonthYearFrench(row.month_start)}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 700, justifySelf: 'start', paddingLeft: 'var(--space-2)' }}>
                            {formatCurrencyFloored(row.revenue_amount)}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-600)', fontFamily: 'var(--font-mono)', justifySelf: 'center', textAlign: 'center', width: '100%' }}>
                            {row.transaction_count.toLocaleString('fr-FR')}
                          </span>
                        </div>
                      )) : (
                        <p style={{ margin: 0, padding: 'var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>—</p>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ width: `${100 / revenueGraphSlideCount}%`, flexShrink: 0, height: 220 }}>
                  <div style={{ height: '100%', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) auto', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: revenueTableHeaderBackground, fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-800)', fontWeight: 700 }}>
                      <span>Date</span>
                      <span style={{ paddingLeft: 'var(--space-1)' }}>Libellé / catégorie</span>
                      <span>Montant</span>
                    </div>
                    <div style={{ minHeight: 0, overflowY: 'auto' }}>
                      {revenueAnalytics?.lastTransactions.length ? revenueAnalytics.lastTransactions.map((tx) => (
                        <div key={tx.id} style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) auto', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderTop: '1px solid var(--neutral-200)', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>
                            {formatTxDateDayMonth(tx.transaction_date)}
                          </span>
                          <span style={{ minWidth: 0, display: 'grid', gap: 1 }}>
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {tx.label || '—'}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--neutral-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {tx.category_name ?? '—'}
                            </span>
                          </span>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                            {formatCurrencyFloored(tx.pilotage_amount)}
                          </span>
                        </div>
                      )) : (
                        <p style={{ margin: 0, padding: 'var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>—</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-2)' }}>
              {Array.from({ length: revenueGraphSlideCount }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setRevenueGraphSlide(idx)}
                  aria-label={`Aller à la slide revenus ${idx + 1}`}
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
                      width: idx === revenueGraphSlide ? 14 : 8,
                      height: idx === revenueGraphSlide ? 14 : 8,
                      borderRadius: 'var(--radius-full)',
                      background: idx === revenueGraphSlide ? 'var(--primary-500)' : 'var(--neutral-300)',
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              height: 336,
              border: '1px solid var(--neutral-200)',
              borderRadius: 'var(--radius-xl)',
              background: 'color-mix(in oklab, var(--neutral-0) 92%, var(--neutral-100) 8%)',
              padding: 'var(--space-3)',
              display: 'grid',
              gridTemplateRows: 'auto 1fr',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ minHeight: 34, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', background: revenueListHeaderBackground, borderRadius: 'var(--radius-md)', padding: 'var(--space-1) var(--space-2)' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', lineHeight: 1.2, color: 'var(--neutral-900)', fontWeight: 700 }}>
                Sources de revenus
              </p>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  border: '1px solid var(--neutral-200)',
                  background: 'var(--neutral-100)',
                  borderRadius: 'var(--radius-full)',
                  padding: 2,
                }}
              >
                <button
                  type="button"
                  onClick={() => setRevenueSourceView('list')}
                  aria-label="Afficher les sources en liste"
                  style={{
                    width: 26,
                    height: 26,
                    minWidth: 26,
                    minHeight: 26,
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    background: revenueSourceView === 'list' ? 'var(--neutral-0)' : 'transparent',
                    color: revenueSourceView === 'list' ? 'var(--primary-500)' : 'var(--neutral-500)',
                    boxShadow: revenueSourceView === 'list' ? 'var(--shadow-card)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <LayoutGrid size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setRevenueSourceView('donut')}
                  aria-label="Afficher les sources en donut"
                  style={{
                    width: 26,
                    height: 26,
                    minWidth: 26,
                    minHeight: 26,
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    background: revenueSourceView === 'donut' ? 'var(--neutral-0)' : 'transparent',
                    color: revenueSourceView === 'donut' ? 'var(--primary-500)' : 'var(--neutral-500)',
                    boxShadow: revenueSourceView === 'donut' ? 'var(--shadow-card)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <CalendarDays size={13} />
                </button>
              </div>
            </div>
            <div style={{ minHeight: 0, overflowY: revenueSourceView === 'list' ? 'auto' : 'hidden', display: 'grid', alignContent: 'start', gap: 'var(--space-2)' }}>
              {revenueAnalyticsLoading ? (
                <div style={{ height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--neutral-400)', fontSize: 'var(--font-size-sm)' }}>
                  Chargement des revenus…
                </div>
              ) : revenueAnalyticsError ? (
                <div style={{ height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--color-error)', fontSize: 'var(--font-size-sm)' }}>
                  {revenueAnalyticsError.message}
                </div>
              ) : !(revenueAnalytics?.bySource.length) ? (
                <div style={{ height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--neutral-400)', fontSize: 'var(--font-size-sm)' }}>
                  Aucune source de revenus active sur cette période
                </div>
              ) : revenueSourceView === 'donut' ? (
                <div style={{ minHeight: 0, height: '100%', display: 'grid', gridTemplateRows: '204px minmax(0,1fr)', gap: 'var(--space-2)' }}>
                  <div style={{ minHeight: 204, height: 204, position: 'relative', display: 'grid', placeItems: 'center' }}>
                    {selectedRevenueSource ? (
                      <div style={{ position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)', maxWidth: '92%', borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', boxShadow: 'var(--shadow-card)', padding: '4px 8px', display: 'grid', justifyItems: 'center', gap: 1, zIndex: 1 }}>
                        <span style={{ fontSize: 10, lineHeight: 1.2, color: 'var(--neutral-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                          {selectedRevenueSource.name}
                        </span>
                        <span style={{ fontSize: 11, lineHeight: 1.2, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                          {formatCurrencyFloored(selectedRevenueSource.value)}
                        </span>
                      </div>
                    ) : null}
                    <div style={{ width: '100%', height: 204, maxWidth: 272 }}>
                      <ResponsiveContainer width="100%" height={204}>
                        <PieChart>
                          <Pie
                            data={revenueSourceDonutData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="56%"
                            innerRadius={50}
                            outerRadius={84}
                            paddingAngle={2}
                            onClick={(slice: unknown) => {
                              const payload = extractPiePayload(slice) as Partial<RevenueSourceDonutDatum> | null
                              if (!payload?.id) return
                              setSelectedRevenueSourceId(payload.id)
                            }}
                          >
                            {revenueSourceDonutData.map((entry) => (
                              <Cell
                                key={entry.id}
                                fill={entry.color}
                                fillOpacity={selectedRevenueSourceId && selectedRevenueSourceId !== entry.id ? 0.55 : 0.96}
                                stroke={selectedRevenueSourceId === entry.id ? 'var(--neutral-900)' : 'var(--neutral-0)'}
                                strokeWidth={selectedRevenueSourceId === entry.id ? 2 : 1}
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div style={{ minHeight: 0, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 6, alignContent: 'start' }}>
                    {revenueSourceDonutData.map((entry) => (
                        <button
                          key={`${entry.id}-legend`}
                          type="button"
                          onClick={() => setSelectedRevenueSourceId(entry.id)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            padding: 0,
                            display: 'grid',
                            gridTemplateColumns: '10px minmax(0,1fr)',
                            gap: 6,
                            alignItems: 'center',
                            textAlign: 'left',
                            cursor: 'pointer',
                            opacity: selectedRevenueSourceId && selectedRevenueSourceId !== entry.id ? 0.66 : 1,
                          }}
                        >
                          <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: entry.color, border: '1px solid color-mix(in oklab, var(--neutral-900) 18%, transparent)' }} />
                          <span style={{ minWidth: 0, fontSize: 10, lineHeight: 1.2, color: 'var(--neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700 }}>
                            {`${entry.name} (${revenueSourceDonutTotal > 0 ? Math.round((entry.value / revenueSourceDonutTotal) * 100) : 0}%)`}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              ) : (
                revenueAnalytics.bySource.map((source, sourceIndex) => {
                  const displayedAmount = Number(source.total_amount ?? 0)
                  const barWidth = revenueSourceMaxAmount > 0 ? (displayedAmount / revenueSourceMaxAmount) * 100 : 0
                  const normalizedSourceName = normalizeCategoryToken(source.source_name)
                  const matchedCategory = categories.find((category) => normalizeCategoryToken(category.name) === normalizedSourceName) ?? null
                  const iconKey = matchedCategory?.icon_key ?? null
                  const sourceColor = revenueSourceGreenPalette[sourceIndex % revenueSourceGreenPalette.length]
                  return (
                    <div
                      key={`${source.source_name}-${source.parent_source_name ?? 'none'}`}
                      style={{
                        padding: '5px 2px',
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,132px) minmax(0,1fr)',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 0 }}>
                        <CategoryIcon iconKey={iconKey} label={source.source_name} size={16} />
                        <span style={{ minWidth: 0, display: 'grid', gap: 1 }}>
                          <span style={{ minWidth: 0, fontSize: 12, lineHeight: 1.3, color: 'var(--neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700 }}>
                            {source.source_name}
                          </span>
                          <span style={{ minWidth: 0, fontSize: 10, lineHeight: 1.2, color: 'var(--neutral-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {source.parent_source_name ?? '—'}
                          </span>
                        </span>
                      </span>
                      <span style={{ display: 'grid', gap: 2 }}>
                        <span style={{ width: '100%', height: 11, borderRadius: 'var(--radius-full)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                          <span
                            style={{
                              width: `${displayedAmount <= 0 ? 0 : Math.max(6, Math.min(barWidth, 100))}%`,
                              height: '100%',
                              display: 'block',
                              borderRadius: 'var(--radius-full)',
                              background: sourceColor,
                            }}
                          />
                        </span>
                        <span style={{ fontSize: 10, lineHeight: 1.25, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {`${formatCurrencyFloored(displayedAmount)} - ${source.transaction_count} op`}
                        </span>
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        
        </motion.section>
      ) : null}

      {isCategoryMode ? (
        <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ padding: '0 var(--space-6)' }}>
          <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                <div style={{ minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      shouldFocusCategoriesSectionRef.current = true
                      setActiveSlide(0)
                      setSelectedCat('all')
                    }}
                    aria-label="Retour"
                    style={{
                      border: 'none',
                      background: accentFromLabel(selectedCatInfo?.name),
                      color: 'var(--neutral-0)',
                      width: 24,
                      height: 24,
                      minWidth: 24,
                      minHeight: 24,
                      borderRadius: 'var(--radius-full)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0,
                  }}
                >
                  <ArrowLeft size={14} />
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
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)', fontWeight: 800, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {categoryRanking ? `rang ${categoryRanking.index}/${categoryRanking.total}` : '—'}
                </span>
              </div>

              <div style={{ marginTop: 'var(--space-2)', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 'var(--space-2)' }}>
                <div style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48, display: 'grid', justifyItems: 'center', alignContent: 'center', textAlign: 'center', gap: 2 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>Budget</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-800)', whiteSpace: 'nowrap' }}>
                    {formatCurrencyFloored(categoryMonthlyBudget).replace(/\s+€/, '€')}
                  </span>
                </div>
                <div style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48, display: 'grid', justifyItems: 'center', alignContent: 'center', textAlign: 'center', gap: 2 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>Moyenne (6M)</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-800)' }}>{formatCurrencyFloored(sixMonthAverageAmount).replace(/\s+€/, '€')}</span>
                </div>
                <div style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48, display: 'grid', justifyItems: 'center', alignContent: 'center', textAlign: 'center', gap: 2 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>Écart moyen</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: sixMonthAverageGapPct == null ? 'var(--neutral-500)' : sixMonthAverageGapPct > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>{sixMonthAverageGapPct == null ? '—' : formatPercentSigned(sixMonthAverageGapPct)}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      ) : null}

      {isCategoryMode ? (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ width: '100%', maxWidth: 600, margin: '0 auto', marginTop: 'var(--space-3)', padding: '0 var(--space-5)', display: 'grid', gap: 'var(--space-5)' }}>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyHistory} barCategoryGap="18%" margin={{ top: 8, right: 44, left: -8, bottom: 4 }}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--neutral-500)' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--neutral-500)' }} tickFormatter={(value) => formatCurrencyFloored(Number(value))} width={68} />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(67,97,238,0.08)' }} />
                <ReferenceLine y={historyBudgetTarget} stroke="var(--color-warning)" strokeWidth={2} strokeDasharray="4 4" label={{ value: 'Budget mensuel', position: 'right', fill: 'var(--neutral-600)', fontSize: 11 }} />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={46}>
                  <LabelList dataKey="amount" position="top" offset={8} content={(props: unknown) => {
                    const { x, y, width, payload } = (props ?? {}) as LabelListContentProps
                    const item = payload
                    if (!item || item.isCurrent || x == null || y == null || width == null) return null
                    return <text x={Number(x) + Number(width) / 2} y={Number(y) - 6} textAnchor="middle" fill="var(--neutral-900)" fontSize={12} fontWeight={700}>{formatCurrencyFloored(item.amount)}</text>
                  }} />
                  {monthlyHistory.map((entry, i) => <Cell key={`history-${i}`} fill={accentFromLabel(selectedCatInfo?.name)} fillOpacity={entry.isCurrent ? 1 : 0.62} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div
            style={{
              height: 336,
              border: '1px solid var(--neutral-200)',
              borderRadius: 'var(--radius-xl)',
              background: 'color-mix(in oklab, var(--neutral-0) 92%, var(--neutral-100) 8%)',
              padding: 'var(--space-3)',
              display: 'grid',
              gridTemplateRows: 'auto 1fr',
              gap: 'var(--space-2)',
            }}
          >
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 700, background: categoryListHeaderBackground, borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)' }}>
              Répartition par sous-catégories
            </p>
            <div style={{ minHeight: 0, overflowY: 'auto', display: 'grid', alignContent: 'start', gap: 'var(--space-2)', paddingTop: 'var(--space-1)' }}>
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
                        <CategoryIcon iconKey={source.iconKey} label={row.name} size={16} />
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
                          {formatCurrencyFloored(row.displayAmount)}
                        </span>
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </motion.section>
      ) : isRootMode ? (
      <motion.section ref={topSectionRef} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ display: 'grid', gap: '6px', justifyItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 600, overflow: 'hidden', position: 'relative', touchAction: 'pan-y' }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={endSwipe} onPointerCancel={endSwipe} onPointerLeave={() => { if (isDragging) endSwipe() }}>
          <div style={{ display: 'flex', width: `${slideCount * 100}%`, transform: `translateX(-${(100 / slideCount) * activeSlide}%)`, transition: 'transform 300ms ease' }}>
            <div style={{ width: `${100 / slideCount}%`, flexShrink: 0, display: 'grid', gap: 'var(--space-1)' }}>
              {selectedCat === 'all' ? (
                <div ref={categoryDonutRef} style={{ position: 'relative', height: 336 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={80} outerRadius={124} startAngle={90} endAngle={-270} paddingAngle={2} stroke="var(--neutral-0)" strokeWidth={1} onClick={(slice: unknown) => {
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
                            iconKey: categoryById.get(id)?.icon_key ?? null,
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
                  <div style={{ position: 'absolute', top: '46%', left: '50%', transform: 'translate(-50%, -50%)', width: 146, height: 146, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 'var(--space-1)' }}>
                      <span style={{ fontSize: 'clamp(18px, 5.5vw, 28px)', fontWeight: 700, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', lineHeight: 1.05 }}>
                        {formatCurrencyFloored(donutCenterAmount)}
                      </span>
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--neutral-500)', lineHeight: 1.1 }}>
                        {donutCenterLabel}
                      </span>
                    </div>
                  </div>
                  {categorySegmentCallouts.length > 0 ? (
                    <svg
                      width="100%"
                      height="100%"
                      viewBox={`0 0 ${Math.max(categoryDonutSize.width, 1)} ${Math.max(categoryDonutSize.height, 1)}`}
                      style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}
                    >
                      {categorySegmentCallouts.map((callout) => (
                        <g key={`cat-callout-${callout.id}`}>
                          <rect
                            x={callout.pillX}
                            y={callout.pillY}
                            width={callout.pillWidth}
                            height={20}
                            rx={10}
                            ry={10}
                            fill="color-mix(in oklab, var(--neutral-0) 88%, var(--neutral-200) 12%)"
                            stroke="var(--neutral-200)"
                          />
                          <text
                            x={callout.pillX + 6}
                            y={callout.pillY + 13}
                            fill="var(--neutral-700)"
                            fontSize={10}
                            fontWeight={700}
                          >
                            {callout.text}
                          </text>
                        </g>
                      ))}
                    </svg>
                  ) : null}
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
                            <CategoryIcon iconKey={source.iconKey} label={row.name} size={16} />
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
                              {formatCurrencyFloored(row.displayAmount)}
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
                <div ref={blockDonutRef} style={{ position: 'relative', height: 336 }}>
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
                            cy="46%"
                            innerRadius={76}
                            outerRadius={120}
                            startAngle={90}
                            endAngle={-270}
                            paddingAngle={2}
                            stroke="var(--neutral-0)"
                            strokeWidth={1}
                            onClick={(slice: unknown) => {
                              const payload = extractPiePayload(slice)
                              const blockId = String(payload?.id ?? '')
                              if (blockId === 'socle_fixe' || blockId === 'variable_essentielle' || blockId === 'discretionnaire' || blockId === 'epargne' || blockId === 'provision') {
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
                      <div style={{ position: 'absolute', top: '46%', left: '50%', transform: 'translate(-50%, -50%)', width: 146, height: 146, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 'var(--space-1)' }}>
                          <span style={{ fontSize: 'clamp(18px, 5.5vw, 28px)', fontWeight: 700, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', lineHeight: 1.05 }}>
                            {formatCurrencyFloored(blockDonutTotal)}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--neutral-500)', lineHeight: 1.1 }}>
                            {dataDisplayMode === 'budget' ? 'budgétés' : 'dépensés'}
                          </span>
                        </div>
                      </div>
                      {blockSegmentCallouts.length > 0 ? (
                        <svg
                          width="100%"
                          height="100%"
                          viewBox={`0 0 ${Math.max(blockDonutSize.width, 1)} ${Math.max(blockDonutSize.height, 1)}`}
                          style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}
                        >
                          {blockSegmentCallouts.map((callout) => (
                            <g key={`block-callout-${callout.id}`}>
                              <rect
                                x={callout.pillX}
                                y={callout.pillY}
                                width={callout.pillWidth}
                                height={20}
                                rx={10}
                                ry={10}
                                fill="color-mix(in oklab, var(--neutral-0) 88%, var(--neutral-200) 12%)"
                                stroke="var(--neutral-200)"
                              />
                              <text
                                x={callout.pillX + 6}
                                y={callout.pillY + 13}
                                fill="var(--neutral-700)"
                                fontSize={10}
                                fontWeight={700}
                              >
                                {callout.text}
                              </text>
                            </g>
                          ))}
                        </svg>
                      ) : null}
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
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--neutral-500)' }} tickFormatter={(value) => formatCurrencyFloored(Number(value))} width={68} />
                      <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(67,97,238,0.08)' }} />
                      <ReferenceLine y={historyBudgetTarget} stroke="var(--color-warning)" strokeWidth={2} strokeDasharray="4 4" label={{ value: 'Budget mensuel', position: 'right', fill: 'var(--neutral-600)', fontSize: 11 }} />
                      <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={46}>
                        <LabelList dataKey="amount" position="top" offset={8} content={(props: unknown) => {
                          const { x, y, width, payload } = (props ?? {}) as LabelListContentProps
                          const item = payload
                          if (!item || item.isCurrent || x == null || y == null || width == null) return null
                          return <text x={Number(x) + Number(width) / 2} y={Number(y) - 6} textAnchor="middle" fill="var(--neutral-900)" fontSize={12} fontWeight={700}>{formatCurrencyFloored(item.amount)}</text>
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
                      {formatCurrencyFloored(sixMonthAverageAmount)}
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
                <section style={{ padding: '0 var(--space-5)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    {slideThreeSelectedScopeMeta.iconType === 'block' ? (
                      <img
                        src={slideThreeSelectedScopeMeta.iconSrc ?? blockProvisionsIcon}
                        alt={`Icône ${slideThreeSelectedScopeMeta.label}`}
                        width={25}
                        height={25}
                        loading="lazy"
                        decoding="async"
                        style={{ display: 'block', objectFit: 'contain' }}
                      />
                    ) : (
                      <CategoryIcon iconKey={slideThreeSelectedScopeMeta.iconKey} label={slideThreeSelectedScopeMeta.label} size={25} />
                    )}
                    <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                      <span style={{ fontWeight: 800 }}>{ytdScopeLabel}</span>
                      <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}>
                        {isSlideThreeMonthlyFlowsView && slideThreeMonthlyBudget != null
                          ? ` - Budget ${Math.round(slideThreeMonthlyBudget).toLocaleString('fr-FR')}€`
                          : ytdSlideHeading ? ` - ${ytdSlideHeading}` : ''}
                      </span>
                    </h3>
                  </div>
                </section>
                {selectedYtdSlideView === 'kpi' ? (
                  <div style={{ padding: isCompactMobile ? '0 var(--space-2)' : '0 var(--space-4)' }}>
                    <Annual2026BlockMetrics
                      hideParameterRow
                      scopeSelection={slideThreeScopeSelection}
                      visualAccentColor={slideThreeSelectedScopeMeta.color}
                      period={slideThreePeriod}
                      displayMode="tableau"
                      compactMobile={isCompactMobile}
                      rollingStats={categoryRolling12mStats}
                    />
                  </div>
                ) : selectedYtdSlideView === 'history' ? (
                  <Annual2026BlockMetrics
                    hideParameterRow
                    scopeSelection={slideThreeScopeSelection}
                    visualAccentColor={slideThreeSelectedScopeMeta.color}
                    period={slideThreePeriod}
                    displayMode="graphique"
                    compactMobile={isCompactMobile}
                    rollingStats={categoryRolling12mStats}
                  />
                ) : (
                  <div style={{ padding: '0 var(--space-5)', marginTop: 'var(--space-2)' }}>
                    <MonthlyFlowsAnalysisCard
                      year={2026}
                      forcedView={selectedYtdSlideView === 'monthly_flows_chart' ? 'chart' : 'table'}
                      showInternalViewToggle={false}
                      variant="embedded"
                      scopeSelection={slideThreeScopeSelection}
                    />
                  </div>
                )}
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

        {showSectionTravelShortcuts ? (
          <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', padding: '0 var(--space-4)' }}>
            <button
              type="button"
              onClick={scrollToLowerSection}
              aria-label={canJumpToCategoriesSection ? 'Aller à la répartition par catégories' : canJumpToBlocksSection ? 'Aller à la répartition par blocs' : 'Aller à la projection coûts annuels'}
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
        ) : null}
      </motion.section>
      ) : null}

      {isRootMode ? (
        <AnimatePresence mode="wait">
          {activeSlide === 0 && configuredBudgetPeriod ? (
            <motion.section ref={categoriesSectionRef} key="slide0-list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }} style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <BudgetCategoryList
                lines={configuredBudgetParentCategoryLines}
                actualCategoryMetrics={configuredBudgetActuals?.parentCategoryActuals ?? []}
                hasActuals={configuredBudgetHasActuals}
                onLineClick={(line) => {
                  if (!line.category_id) return
                  scrollViewportToTop()
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
              <h3 ref={blocksSectionTitleRef} style={{ margin: '0 0 0 0', fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                Répartition par blocs
              </h3>
              <div style={{ display: 'grid', gap: 'var(--space-8)' }}>
		              {blockRowsForList.map((row) => {
		                const budgetAmount = Number(row.budgetAmount ?? 0)
		                const actualAmount = Number(row.actualAmount ?? 0)
		                const consumptionRatio = budgetAmount > 0 ? actualAmount / budgetAmount : 0
		                const progressPct = Math.min(100, Math.round(consumptionRatio * 100))
		                const variance = budgetAmount - actualAmount
		                const isOverBudget = variance < 0
                  const isSavingsBlock = row.id === 'epargne'
                  const isSavingsPositive = isSavingsBlock && actualAmount > 0
                  const savingsRemainderColor = 'color-mix(in oklab, var(--color-warning) 72%, var(--neutral-900) 28%)'
                  const leftMetricLabel = isSavingsBlock ? 'Épargné' : 'Consommé'
                  const leftMetricColor = isSavingsPositive ? 'var(--color-success)' : 'var(--neutral-700)'
                  const leftMetricPctColor = isSavingsPositive ? 'var(--color-success)' : 'var(--neutral-500)'
                  const rightMetricColor = isSavingsBlock
                    ? (variance !== 0 ? savingsRemainderColor : 'var(--neutral-500)')
                    : (isOverBudget ? 'var(--color-error)' : 'var(--color-success)')
                  const rightMetricText = isSavingsBlock
                    ? `Reste ${formatCurrencyFloored(variance)}`
                    : (isOverBudget ? `Dépass. ${formatCurrencyFloored(Math.abs(variance))}` : `Reste ${formatCurrencyFloored(variance)}`)
                  const blockIconSrc = BLOCK_ICON_SRC[row.id]
		                return (
		                  <button
                      key={row.id}
                      type="button"
                      onClick={() => {
                        setSelectedBlockId(null)
                        setSelectedBlockPage(row.id)
                        scrollViewportToTop()
                      }}
                      style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 'var(--space-5)', minWidth: 0, width: '100%', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                    >
		                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
		                      <span aria-hidden="true" style={{ width: 56, height: 56, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img
                            src={blockIconSrc}
                            alt={`Icône bloc ${row.label}`}
                            width={42}
                            height={42}
                            loading="lazy"
                            decoding="async"
                            style={{ display: 'block', objectFit: 'contain' }}
                          />
	                      </span>
	                    </div>

                    <div style={{ display: 'grid', gap: 'var(--space-2)', minWidth: 0 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--space-4)', alignItems: 'center' }}>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', fontWeight: 'var(--font-weight-bold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {`Socle ${row.label.toLowerCase()}`}
                        </p>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                          {formatCurrencyFloored(budgetAmount)}
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
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: leftMetricColor, fontFamily: 'var(--font-mono)', fontWeight: isSavingsPositive ? 700 : 400 }}>
                          {leftMetricLabel} {formatCurrencyFloored(actualAmount).replace(/\s+€/, '€')} <span style={{ color: leftMetricPctColor }}>({progressPct}%)</span>
                        </p>
		                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: rightMetricColor, fontFamily: 'var(--font-mono)', fontWeight: 700, flexShrink: 0 }}>
		                          {rightMetricText}
		                        </p>
		                      </div>
		                    </div>
			                  </button>
				                )
				              })}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBlockId(null)
                      setSelectedBlockPage(REVENUE_BLOCK_PAGE_ID)
                      scrollViewportToTop()
                    }}
                    style={{
                      marginTop: 'var(--space-3)',
                      paddingTop: 'var(--space-6)',
                      borderTop: '1px solid var(--neutral-300)',
                      display: 'grid',
                      gridTemplateColumns: '56px 1fr',
                      gap: 'var(--space-5)',
                      minWidth: 0,
                      width: '100%',
                      borderLeft: 'none',
                      borderRight: 'none',
                      borderBottom: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      paddingLeft: 0,
                      paddingRight: 0,
                      paddingBottom: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                      <span aria-hidden="true" style={{ width: 56, height: 56, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img
                          src={blockRevenusIcon}
                          alt="Icône bloc Revenus"
                          width={42}
                          height={42}
                          loading="lazy"
                          decoding="async"
                          style={{ display: 'block', objectFit: 'contain' }}
                        />
                      </span>
                    </div>

                    <div style={{ display: 'grid', gap: 'var(--space-2)', minWidth: 0 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--space-4)', alignItems: 'center' }}>
                        <p style={{ margin: 0, minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', fontWeight: 'var(--font-weight-bold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Socle revenus</span>
                          <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Hors enveloppe dépenses
                          </span>
                        </p>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                          {formatCurrencyFloored(revenueAnalytics?.selectedMonthRevenue ?? 0)}
                        </p>
                      </div>

                      <div style={{ width: '100%', height: 'var(--space-2)', borderRadius: 'var(--radius-pill)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${revenueProgressPct}%`,
                            height: '100%',
                            borderRadius: 'var(--radius-pill)',
                            background: isRevenueAboveTarget ? 'var(--color-success)' : 'var(--primary-500)',
                            transition: 'width var(--transition-base)',
                          }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--space-4)', alignItems: 'center' }}>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>
                          {formatCurrencyFloored(selectedMonthRevenueAmount)} <span style={{ color: 'var(--neutral-500)' }}>({revenueCoveragePctRounded}%)</span>
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 'var(--font-size-xs)',
                            color: isRevenueAboveTarget ? 'var(--color-success)' : 'var(--neutral-500)',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: isRevenueAboveTarget ? 700 : 400,
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isRevenueAboveTarget
                            ? `Dépassement +${Math.round(revenueSurplusPct ?? 0)}%`
                            : `Cible ${formatCurrencyFloored(monthlyCommitmentsTarget)}`}
                        </p>
                      </div>
                    </div>
                  </button>
		              </div>
              <div aria-hidden="true" style={{ width: '100%', height: 120 }} />
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
          ) : activeSlide === 2 ? (
            <motion.section key="slide2-projection" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }} style={{ display: 'grid', gap: 'var(--space-6)', padding: '0 var(--space-5)' }}>
              <h3 ref={projectionSectionTitleRef} style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                Projection coûts annuels
              </h3>
              <AnnualProjectionSectionConnected />
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

      <AnimatePresence>
        {selectedBlock && !isBlockMode ? (
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
                      Bloc <span style={{ fontFamily: 'var(--font-mono)' }}>"{selectedBlock.label}"</span> - {formatCurrencyFloored(dataDisplayMode === 'budget' ? selectedBlock.budgetAmount : selectedBlock.actualAmount)}
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
                              iconKey: categoryById.get(line.id)?.icon_key ?? null,
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
                                iconKey: categoryById.get(line.id)?.icon_key ?? null,
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
                              {formatCurrencyFloored(displayedAmount)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--neutral-500)' }}>
                              {line.parentCategoryName ?? 'Autres'}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                              {dataDisplayMode === 'budget' ? `Réel ${formatCurrencyFloored(secondaryAmount)}` : `Budget ${formatCurrencyFloored(secondaryAmount)}`}
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
        {showSlideThreeScopeSheet ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSlideThreeScopeSheet(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 68, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Choisir un bloc ou une catégorie"
              initial={{ y: '-100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 330 }}
              style={{
                position: 'fixed',
                left: 'var(--space-3)',
                right: 'var(--space-3)',
                top: 0,
                zIndex: 69,
                width: 'auto',
                maxWidth: 400,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: '0 0 var(--radius-2xl) var(--radius-2xl)',
                padding: 'calc(var(--safe-top-offset) + var(--space-1)) var(--space-4) var(--space-2)',
                maxHeight: '72dvh',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 'var(--radius-full)', margin: '2px auto var(--space-2)', background: 'var(--neutral-300)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-900)' }}>Bloc ou catégorie</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowSlideThreeScopeSheet(false)} className="h-11 w-11 rounded-full bg-[var(--neutral-100)] px-0">
                  <ChevronDown size={16} />
                </Button>
              </div>

              <div style={{ overflowY: 'auto' }}>
                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <div>
                    <p style={{ margin: '0 0 var(--space-1)', fontSize: 10, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Blocs
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 'var(--space-1)' }}>
                      {slideThreeBlockOptions.map((option) => {
                        const selected = slideThreeScopeSelection.kind === 'bloc' && slideThreeScopeSelection.id === option.id
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              setSlideThreeScopeSelection({ kind: 'bloc', id: option.id })
                              setShowSlideThreeScopeSheet(false)
                            }}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              borderRadius: 'var(--radius-md)',
                              padding: '3px 3px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 2,
                              cursor: 'pointer',
                              opacity: selected ? 1 : 0.92,
                            }}
                          >
                            <div style={{ border: selected ? '2px solid var(--primary-500)' : '2px solid transparent', borderRadius: 'var(--radius-lg)', padding: 2 }}>
                              <img src={option.iconSrc} alt={`Icône ${option.label}`} width={28} height={28} loading="lazy" decoding="async" style={{ display: 'block', objectFit: 'contain' }} />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-700)', textAlign: 'center', lineHeight: 1.05 }}>{option.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ height: 1, background: 'var(--neutral-200)' }} />

                  <div>
                    <p style={{ margin: '0 0 var(--space-1)', fontSize: 10, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Catégories
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 'var(--space-1) var(--space-1)' }}>
                      {(() => {
                        const selectedAll = slideThreeScopeSelection.kind === 'categorie' && slideThreeScopeSelection.id === ALL_CATEGORIES_SCOPE_ID
                        return (
                          <button
                            key={ALL_CATEGORIES_SCOPE_ID}
                            type="button"
                            onClick={() => {
                              setSlideThreeScopeSelection({ kind: 'categorie', id: ALL_CATEGORIES_SCOPE_ID })
                              setShowSlideThreeScopeSheet(false)
                            }}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              padding: '3px 2px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 2,
                              cursor: 'pointer',
                              opacity: selectedAll ? 1 : 0.92,
                            }}
                          >
                            <div style={{ border: selectedAll ? '2px solid var(--primary-500)' : '2px solid transparent', borderRadius: 'var(--radius-lg)', padding: 2 }}>
                              <CategoryIcon iconKey="toutes_categories" label="Toutes catégories" size={32} />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-700)', maxWidth: '100%', whiteSpace: 'pre-line', lineHeight: 1.05, textAlign: 'center' }}>
                              Toutes
                            </span>
                          </button>
                        )
                      })()}
                      {rootNavigableCategories.map((category) => {
                        const selected = slideThreeScopeSelection.kind === 'categorie' && slideThreeScopeSelection.id === category.id
                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => {
                              setSlideThreeScopeSelection({ kind: 'categorie', id: category.id })
                              setShowSlideThreeScopeSheet(false)
                            }}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              padding: '3px 2px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 2,
                              cursor: 'pointer',
                              opacity: selected ? 1 : 0.92,
                            }}
                          >
                            <div style={{ border: selected ? '2px solid var(--primary-500)' : '2px solid transparent', borderRadius: 'var(--radius-lg)', padding: 2 }}>
                              <CategoryIcon iconKey={category.icon_key} label={category.name} size={32} />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-700)', maxWidth: '100%', whiteSpace: 'pre-line', lineHeight: 1.05, textAlign: 'center' }}>
                              {formatCategoryModalLabel(category.name)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 'var(--space-3) var(--space-2)' }}>
                    <button
                      type="button"
                      onClick={() => {
                        scrollViewportToTop()
                        setSelectedCat('all')
                        setShowCatSheet(false)
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: '6px 4px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 5,
                        cursor: 'pointer',
                      }}
                    >
                      <CategoryIcon iconKey="toutes_categories" label="Toutes catégories" size={34} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-700)', maxWidth: '100%', whiteSpace: 'pre-line', lineHeight: 1.15, textAlign: 'center' }}>
                        Toutes
                      </span>
                    </button>

                    {rootNavigableCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          scrollViewportToTop()
                          setSelectedCat(cat.id)
                          setShowCatSheet(false)
                        }}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          padding: '6px 4px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 5,
                          cursor: 'pointer',
                        }}
                      >
                        <CategoryIcon iconKey={cat.icon_key} label={cat.name} size={34} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-700)', maxWidth: '100%', whiteSpace: 'pre-line', lineHeight: 1.15, textAlign: 'center' }}>{formatCategoryModalLabel(cat.name)}</span>
                      </button>
                    ))}
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
