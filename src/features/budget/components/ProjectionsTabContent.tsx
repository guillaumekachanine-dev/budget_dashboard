import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, ReferenceLine } from 'recharts'
import { useAnnual2026Analysis } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { useBudgetRevenueAnalytics } from '@/features/budget/hooks/useBudgetRevenueAnalytics'
import { useAnnualProjectionOverview2026 } from '@/features/annual-analysis/hooks/useAnnualProjectionOverview2026'
import { AnnualProjectionSectionConnected } from '@/features/annual-analysis/components/AnnualCostProjection2026'
import { formatCurrencyRounded as fmt } from '@/lib/utils'
import { getMonthShortLabel, MONTH_LABELS_SHORT } from '@/features/annual-analysis/components/_constants'
import { getMonthlyMetrics } from '@/features/budget/api/getMonthlyMetrics'
import { QK, STALE } from '@/lib/queryKeys'
import type { BudgetRevenueAnalytics, BudgetRevenueTransaction } from '@/features/budget/types'
import { useBudgetRevenueSources2026, type RevenuSource2026 } from '@/features/budget/hooks/useBudgetRevenueSources2026'

// ─── Types ────────────────────────────────────────────────────────────────────

type DisplayMode = 'depenses' | 'revenus'
type ExpenseSlide = 0 | 1
type ExpenseKpiModalKey = 'ytd' | 'gap' | 'projection' | null
type ExpenseMonthlyMetric = { period_month: number; expense_total: number }

interface ExpenseHistoryPoint {
  month: number
  monthLabel: string
  amount: number
  budget: number
  avg12m: number
  median12m: number
}

// ─── Sub-components ───────────────────────────────────────────────────────────


// ─── Revenue 2026 histogram ───────────────────────────────────────────────────

const REV_GREEN = '#2ED47A'
const REV_GREENS = ['#0C5D39', '#167A4B', '#1F955B', '#2DB26E', '#4BC684', '#6FD69D', '#94E3B7', '#B9EED1']
const SCENARIO_1_COLOR = '#D58A83'
const SCENARIO_2_COLOR = '#15A9A1'

/** Map known revenue-source names to semantic colours. Falls back to the green palette. */
function resolveSourceColor(name: string, fallbackIndex: number): string {
  const n = name.toLowerCase()
  if (n.includes('salaire'))                                     return '#F0B429' // doré/or
  if (n.includes('prime'))                                       return '#C8D3DC' // argenté vif
  if (n.includes('remboursement'))                               return '#10B981' // vert émeraude
  if (n.includes('chômage') || n.includes('chomage') || n.includes('indemnité') || n.includes('indemnite')) return '#2E5FD4' // bleu roi
  if (n.includes('autre'))                                       return '#C45A72' // rouge carmin pâle
  return REV_GREENS[fallbackIndex % REV_GREENS.length]
}

function addProjectedAmountToSources(
  sources: RevenuSource2026[],
  matchers: string[],
  amount: number,
  fallbackName: string,
) {
  if (!(amount > 0)) return

  const matcher = (value: string) => matchers.some((token) => value.includes(token))
  const target = sources.find((source) => matcher(source.name.toLowerCase()))
  if (target) {
    target.value += amount
    return
  }

  sources.push({
    id: `${fallbackName.toLowerCase().replace(/\s+/g, '-')}-projection`,
    name: fallbackName,
    parentName: 'Projection',
    value: amount,
  })
}

interface Rev2026Point {
  monthOrder: number
  month: string
  value: number
  isProjected: boolean
  color: string
}

interface RevenueMonthGroup {
  monthKey: string
  monthLabel: string
  total: number
  transactions: BudgetRevenueTransaction[]
}

type RevenueKpiModalKey = 'ytd' | 'scenario1' | 'scenario2' | null
type RevenueDisplayMode = 'real_ytd' | 'scenario1' | 'scenario2'
type RevenueProjectionMode = 'scenario1' | 'scenario2'

interface RevenueKpiModalConfig {
  title: string
  subtitle?: string
  accentColor: string
  lines: Array<{ label: string; value: string }>
  totalLabel: string
  totalValue: string
}

function capitalizeFirst(text: string): string {
  if (!text) return text
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

function formatTxDateDayMonth(value: string): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(date)
}

function formatMonthYearFromKey(monthKey: string): string {
  const date = new Date(`${monthKey}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return monthKey
  return capitalizeFirst(new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date))
}

function RevBarShape(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: Rev2026Point
  [key: string]: unknown
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props
  const fillColor = payload?.color ?? REV_GREEN
  const h = Math.max(0, height)
  if (h === 0) return null
  if (!payload?.isProjected) {
    return <rect x={x} y={y} width={width} height={h} fill={fillColor} rx={3} ry={3} />
  }
  return (
    <rect
      x={x + 1}
      y={y}
      width={Math.max(0, width - 2)}
      height={h}
      fill="color-mix(in oklab, var(--neutral-0) 82%, transparent)"
      stroke={fillColor}
      strokeWidth={1.5}
      strokeDasharray="5 3"
      rx={3}
      ry={3}
    />
  )
}

function RevenueTransactionsYtdModal({
  groups,
  onClose,
}: {
  groups: RevenueMonthGroup[]
  onClose: () => void
}) {
  return (
    <>
      <motion.div
        key="revenues-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(13,13,31,0.52)' }}
      />
      <motion.div
        key="revenues-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Transactions revenus 2026 YTD"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: 'var(--page-gutter)',
          right: 'var(--page-gutter)',
          top: '8vh',
          bottom: '8vh',
          zIndex: 91,
          maxWidth: 640,
          margin: '0 auto',
          background: 'var(--neutral-0)',
          borderRadius: 'var(--radius-2xl)',
          padding: 'var(--space-4)',
          boxShadow: '0 12px 48px rgba(13,13,31,0.22)',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 800, lineHeight: 1.2 }}>
            Transactions revenus 2026 YTD
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'var(--neutral-100)', color: 'var(--neutral-600)', width: 30, height: 30, borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <X size={13} />
          </button>
        </div>
        <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'grid' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) auto', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'color-mix(in oklab, var(--color-success) 30%, var(--neutral-0) 70%)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-800)', fontWeight: 700 }}>
            <span>Date</span>
            <span style={{ paddingLeft: 'var(--space-1)' }}>Libellé / catégorie</span>
            <span>Montant</span>
          </div>
          <div style={{ display: 'grid' }}>
            {groups.length > 0 ? groups.map((group) => (
              <div key={group.monthKey} style={{ display: 'grid' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-2)', borderTop: '1px solid color-mix(in oklab, var(--neutral-700) 55%, transparent)', background: 'color-mix(in oklab, var(--neutral-200) 42%, var(--neutral-0) 58%)', padding: '6px var(--space-3)' }}>
                  <span style={{ fontSize: 10, color: 'var(--neutral-700)', fontWeight: 700, letterSpacing: '0.02em' }}>{group.monthLabel}</span>
                  <span style={{ fontSize: 10, color: 'var(--neutral-800)', fontWeight: 700, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{fmt(group.total)}</span>
                </div>
                {group.transactions.map((tx) => (
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
                      {fmt(tx.pilotage_amount)}
                    </span>
                  </div>
                ))}
              </div>
            )) : (
              <p style={{ margin: 0, padding: 'var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
                Aucune transaction de revenus sur 2026.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
}

function RevenueKpiDetailModal({
  config,
  onClose,
}: {
  config: RevenueKpiModalConfig
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,30,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-5)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--neutral-0)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-5)',
          maxWidth: 340,
          width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ marginBottom: 'var(--space-4)', borderBottom: `2px solid ${config.accentColor}`, paddingBottom: 'var(--space-3)' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)' }}>
            {config.title}
          </p>
          {config.subtitle ? (
            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--neutral-400)' }}>
              {config.subtitle}
            </p>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {config.lines.map((line) => (
            <div key={line.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--neutral-600)', fontWeight: 500 }}>
                {line.label} :
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)', flexShrink: 0 }}>
                {line.value}
              </span>
            </div>
          ))}
          <div style={{ borderTop: '1px dashed var(--neutral-200)', margin: '2px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 14, color: 'var(--neutral-900)', fontWeight: 700 }}>
              {config.totalLabel} :
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: config.accentColor, flexShrink: 0 }}>
              {config.totalValue}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: '9px 0',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: config.accentColor,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            marginTop: 'var(--space-4)',
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  )
}

function RevenueSection2026({
  revenueData,
  ytdMonths,
}: {
  revenueData: BudgetRevenueAnalytics | null
  ytdMonths: number
}) {
  const [revSlide, setRevSlide] = useState(0)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [selectedRevenueBar, setSelectedRevenueBar] = useState<Rev2026Point | null>(null)
  const [showRevenueTransactionsModal, setShowRevenueTransactionsModal] = useState(false)
  const [activeRevenueKpiModal, setActiveRevenueKpiModal] = useState<RevenueKpiModalKey>(null)
  const [histogramProjectionMode, setHistogramProjectionMode] = useState<RevenueProjectionMode>('scenario1')
  const [revenueDisplayMode, setRevenueDisplayMode] = useState<RevenueDisplayMode>('real_ytd')
  const [showRevenueDisplayPicker, setShowRevenueDisplayPicker] = useState(false)
  const { data: rawSources } = useBudgetRevenueSources2026()

  // ── Histogram data ────────────────────────────────────────────────────────
  const series2026 = revenueData?.monthlySeries.filter(p => p.month_start.startsWith('2026')) ?? []
  const guaranteedMonthlyIncome = 3338
  const salaryAndPrimeMonthlyIncome = 6500
  const scenario2UnemploymentMonths = 4
  const scenario2SalaryMonths = 3
  const remainingMonths = Math.max(0, 12 - ytdMonths)
  const ytdRevenue2026 = series2026.reduce((sum, row) => sum + Number(row.revenue_amount ?? 0), 0)
  const projectedScenario1 = ytdRevenue2026 + guaranteedMonthlyIncome * remainingMonths
  const projectedScenario2 = ytdRevenue2026 + guaranteedMonthlyIncome * scenario2UnemploymentMonths + salaryAndPrimeMonthlyIncome * scenario2SalaryMonths
  const assuredStartMonthLabel = MONTH_LABELS_SHORT[Math.max(0, Math.min(11, ytdMonths))] ?? 'juin'
  const assuredPeriodLabel = `${assuredStartMonthLabel.toLowerCase()}-déc. (${remainingMonths} mois)`
  const activeScenarioColor = histogramProjectionMode === 'scenario1' ? SCENARIO_1_COLOR : SCENARIO_2_COLOR

  const projectedRevenueForMonth = (month: number) => {
    if (histogramProjectionMode === 'scenario1') return guaranteedMonthlyIncome
    if (month >= 6 && month <= 9) return guaranteedMonthlyIncome
    if (month >= 10 && month <= 12) return salaryAndPrimeMonthlyIncome
    return 0
  }

  const chartData: Rev2026Point[] = MONTH_LABELS_SHORT.map((label, idx) => {
    const m = idx + 1
    const isProjected = m > ytdMonths
    const actual = series2026.find(p => parseInt(p.month_start.slice(5, 7), 10) === m)
    return {
      monthOrder: m,
      month: label,
      value: isProjected ? projectedRevenueForMonth(m) : (actual?.revenue_amount ?? 0),
      isProjected,
      color: activeScenarioColor,
    }
  })

  const maxVal = Math.max(...chartData.map(d => d.value), 1000)
  const yMax = Math.ceil(maxVal / 500) * 500 + 500

  // ── Donut data (2026 only) ────────────────────────────────────────────────
  const scenarioSourceValues = useMemo(() => {
    const baseSources = rawSources.map((source) => ({ ...source }))

    if (revenueDisplayMode === 'scenario1') {
      addProjectedAmountToSources(
        baseSources,
        ['chômage', 'chomage', 'indemnité', 'indemnite'],
        guaranteedMonthlyIncome * remainingMonths,
        'Indemnités chômage',
      )
    }

    if (revenueDisplayMode === 'scenario2') {
      addProjectedAmountToSources(
        baseSources,
        ['chômage', 'chomage', 'indemnité', 'indemnite'],
        guaranteedMonthlyIncome * scenario2UnemploymentMonths,
        'Indemnités chômage',
      )
      addProjectedAmountToSources(
        baseSources,
        ['salaire', 'prime'],
        salaryAndPrimeMonthlyIncome * scenario2SalaryMonths,
        'Salaire + primes',
      )
    }

    return baseSources
      .filter((source) => source.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [
    guaranteedMonthlyIncome,
    rawSources,
    remainingMonths,
    revenueDisplayMode,
    salaryAndPrimeMonthlyIncome,
    scenario2SalaryMonths,
    scenario2UnemploymentMonths,
  ])

  const donutData = scenarioSourceValues.map((s, i) => ({
    ...s,
    color: resolveSourceColor(s.name, i),
  }))
  const donutTotal = donutData.reduce((sum, d) => sum + d.value, 0)
  const selectedSource = selectedSourceId
    ? (donutData.find(d => d.id === selectedSourceId) ?? null)
    : null
  const allTransactions2026 = useMemo(
    () =>
      (revenueData?.allTransactions ?? [])
        .filter((tx) => tx.transaction_date.startsWith('2026-'))
        .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
    [revenueData],
  )
  const revenueTransactionGroups2026 = useMemo<RevenueMonthGroup[]>(() => {
    const groups: RevenueMonthGroup[] = []

    for (const tx of allTransactions2026) {
      const monthKey = tx.transaction_date.slice(0, 7)
      if (!monthKey) continue

      const lastGroup = groups[groups.length - 1]
      if (!lastGroup || lastGroup.monthKey !== monthKey) {
        groups.push({
          monthKey,
          monthLabel: formatMonthYearFromKey(monthKey),
          total: Number(tx.pilotage_amount ?? 0),
          transactions: [tx],
        })
        continue
      }

      lastGroup.total += Number(tx.pilotage_amount ?? 0)
      lastGroup.transactions.push(tx)
    }

    return groups
  }, [allTransactions2026])

  const SLIDE_TITLES = ['Revenus 2026', 'Sources de revenus 2026'] as const
  const revenueDisplayOptions = {
    real_ytd: { label: 'Réel YTD', color: 'var(--neutral-700)' },
    scenario1: { label: '#1', color: SCENARIO_1_COLOR },
    scenario2: { label: '#2', color: SCENARIO_2_COLOR },
  } as const
  const revenueKpiModalConfig = useMemo<RevenueKpiModalConfig | null>(() => {
    if (!activeRevenueKpiModal) return null

    if (activeRevenueKpiModal === 'ytd') {
      return {
        title: 'détail du calcul - 2026',
        subtitle: 'revenus 2026 YTD',
        accentColor: '#FFAB2E',
        lines: [
          { label: 'revenus encaissés 2026', value: fmt(ytdRevenue2026) },
          { label: 'période couverte', value: `janv.-${getMonthShortLabel(ytdMonths).toLowerCase()} (${ytdMonths} mois)` },
          { label: 'source', value: 'transactions réelles' },
        ],
        totalLabel: 'revenus 2026 YTD',
        totalValue: fmt(ytdRevenue2026),
      }
    }

    if (activeRevenueKpiModal === 'scenario1') {
      return {
        title: 'SCENARIO #1 - détails du calcul',
        accentColor: SCENARIO_1_COLOR,
        lines: [
          { label: 'revenus 2026 YTD', value: fmt(ytdRevenue2026) },
          { label: 'revenus assurés', value: `${fmt(guaranteedMonthlyIncome)}/mois (Chômage)` },
          { label: 'période concernée', value: assuredPeriodLabel },
        ],
        totalLabel: 'Projection #1',
        totalValue: fmt(projectedScenario1),
      }
    }

    return {
      title: 'SCENARIO #2 - détails du calcul',
      accentColor: SCENARIO_2_COLOR,
      lines: [
        { label: 'revenus 2026 YTD', value: fmt(ytdRevenue2026) },
        { label: 'indemnités chômage', value: `${fmt(guaranteedMonthlyIncome)} × ${scenario2UnemploymentMonths}(juin-sept.)` },
        { label: 'salaire + primes', value: `${fmt(salaryAndPrimeMonthlyIncome)} × ${scenario2SalaryMonths} (oct.-déc.)` },
      ],
      totalLabel: 'Projection #2',
      totalValue: fmt(projectedScenario2),
    }
  }, [
    activeRevenueKpiModal,
    assuredPeriodLabel,
    guaranteedMonthlyIncome,
    projectedScenario1,
    projectedScenario2,
    salaryAndPrimeMonthlyIncome,
    scenario2SalaryMonths,
    scenario2UnemploymentMonths,
    ytdMonths,
    ytdRevenue2026,
  ])

  function handleSlide(idx: number) {
    setRevSlide(idx)
    setSelectedSourceId(null)
    setSelectedRevenueBar(null)
    setShowRevenueDisplayPicker(false)
  }

  function handleDisplayModeSelect(mode: RevenueDisplayMode) {
    setRevenueDisplayMode(mode)
    setSelectedSourceId(null)
    setShowRevenueDisplayPicker(false)
  }

  function handleHistogramProjectionToggle() {
    setSelectedRevenueBar(null)
    setHistogramProjectionMode((prev) => (prev === 'scenario1' ? 'scenario2' : 'scenario1'))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

      {/* ── 3 KPI tiles — always above carousel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
        {([
          {
            key: 'ytd' as const,
            label: 'Revenus YTD',
            value: ytdRevenue2026,
            borderColor: 'var(--neutral-200)',
            background: 'var(--neutral-0)',
          },
          {
            key: 'scenario1' as const,
            label: 'Scenario #1',
            value: projectedScenario1,
            borderColor: `color-mix(in oklab, ${SCENARIO_1_COLOR} 70%, var(--neutral-200) 30%)`,
            background: `color-mix(in oklab, ${SCENARIO_1_COLOR} 12%, var(--neutral-0) 88%)`,
          },
          {
            key: 'scenario2' as const,
            label: 'Scenario #2',
            value: projectedScenario2,
            borderColor: `color-mix(in oklab, ${SCENARIO_2_COLOR} 70%, var(--neutral-200) 30%)`,
            background: `color-mix(in oklab, ${SCENARIO_2_COLOR} 12%, var(--neutral-0) 88%)`,
          },
        ]).map(({ key, label, value, borderColor, background }) => (
          <button
            key={label}
            type="button"
            onClick={() => setActiveRevenueKpiModal(key)}
            style={{
              background,
              border: `1.5px solid ${borderColor}`,
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-3)',
              minHeight: 58,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.2 }}>
              {label}
            </p>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1 }}>
              {fmt(value)}
            </p>
          </button>
        ))}
      </div>

      {/* ── Carousel card ── */}
      <div style={{
        background: 'var(--neutral-0)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
      }}>
        {/* Card header — title + conditional legend */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 'var(--space-2)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-700)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              {SLIDE_TITLES[revSlide]}
            </p>
            {revSlide === 0 ? (
              <button
                type="button"
                onClick={() => setShowRevenueTransactionsModal(true)}
                style={{
                  border: '1px solid var(--neutral-300)',
                  background: 'var(--neutral-100)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--neutral-700)',
                  padding: '3px var(--space-2)',
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  cursor: 'pointer',
                }}
              >
                Détails
              </button>
            ) : null}
          </div>
          {revSlide === 0 ? (
            <div style={{ display: 'grid', justifyItems: 'end', gap: 6 }}>
              <button
                type="button"
                onClick={handleHistogramProjectionToggle}
                style={{
                  border: '1px solid var(--neutral-300)',
                  background: 'var(--neutral-100)',
                  borderRadius: 'var(--radius-sm)',
                  color: histogramProjectionMode === 'scenario1' ? SCENARIO_1_COLOR : SCENARIO_2_COLOR,
                  padding: '3px var(--space-2)',
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {histogramProjectionMode === 'scenario1' ? 'Scenario #1' : 'Scenario #2'}
              </button>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--neutral-500)' }}>
                  <span style={{ display: 'inline-block', width: 10, height: 8, background: activeScenarioColor, borderRadius: 2 }} />
                  Réel
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--neutral-500)' }}>
                  <span style={{ display: 'inline-block', width: 10, height: 8, background: 'color-mix(in oklab, var(--neutral-0) 82%, transparent)', border: `1.5px dashed ${activeScenarioColor}`, borderRadius: 2, boxSizing: 'border-box' as const }} />
                  Projeté
                </span>
              </div>
            </div>
          ) : revSlide === 1 ? (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowRevenueDisplayPicker((prev) => !prev)}
                aria-label="Choisir un affichage des sources de revenus"
                style={{
                  border: '1px solid var(--neutral-300)',
                  background: 'var(--neutral-100)',
                  borderRadius: 'var(--radius-sm)',
                  color: revenueDisplayOptions[revenueDisplayMode].color,
                  padding: '3px var(--space-2)',
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <span>
                  {revenueDisplayMode === 'real_ytd'
                    ? 'Réel YTD'
                    : revenueDisplayMode === 'scenario1'
                      ? 'Scenario #1'
                      : 'Scenario #2'}
                </span>
                <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid var(--neutral-400)', marginTop: 1, flexShrink: 0 }} />
              </button>
              <AnimatePresence>
                {showRevenueDisplayPicker ? (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      minWidth: 164,
                      background: 'var(--neutral-0)',
                      border: '1px solid var(--neutral-200)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '0 8px 30px rgba(13,13,31,0.16)',
                      padding: '4px',
                      display: 'grid',
                      gap: 2,
                      zIndex: 3,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleDisplayModeSelect('real_ytd')}
                      style={{
                        width: '100%',
                        padding: '7px var(--space-2)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        background: revenueDisplayMode === 'real_ytd' ? 'var(--neutral-150)' : 'transparent',
                        color: 'var(--neutral-800)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      Réel YTD
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDisplayModeSelect('scenario1')}
                      style={{
                        width: '100%',
                        padding: '7px var(--space-2)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        background: revenueDisplayMode === 'scenario1' ? `color-mix(in oklab, ${SCENARIO_1_COLOR} 16%, var(--neutral-0) 84%)` : 'transparent',
                        color: SCENARIO_1_COLOR,
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      Scenario #1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDisplayModeSelect('scenario2')}
                      style={{
                        width: '100%',
                        padding: '7px var(--space-2)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        background: revenueDisplayMode === 'scenario2' ? `color-mix(in oklab, ${SCENARIO_2_COLOR} 16%, var(--neutral-0) 84%)` : 'transparent',
                        color: SCENARIO_2_COLOR,
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      Scenario #2
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}
        </div>

        {/* Slides container */}
        <div style={{ overflow: 'hidden', height: 290 }}>
          <div style={{
            display: 'flex',
            width: '200%',
            height: '100%',
            transform: `translateX(-${50 * revSlide}%)`,
            transition: 'transform 300ms ease',
          }}>

            {/* ── Slide 0: Monthly histogram ── */}
            <div style={{ width: '50%', flexShrink: 0, height: '100%', position: 'relative' }}>
              {selectedRevenueBar ? (
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    zIndex: 3,
                    background: 'var(--neutral-0)',
                    border: '1px solid var(--neutral-200)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-card)',
                    padding: '10px 12px',
                    minWidth: 156,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedRevenueBar(null)}
                    aria-label="Fermer"
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--neutral-400)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: 0,
                    }}
                  >
                    <X size={11} />
                  </button>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', columnGap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.35, paddingRight: 14 }}>
                      {selectedRevenueBar.month}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      {selectedRevenueBar.monthOrder}/12
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-700)' }}>
                      {selectedRevenueBar.isProjected
                        ? histogramProjectionMode === 'scenario1'
                          ? 'Scenario #1'
                          : 'Scenario #2'
                        : 'Réel 2026'}
                    </span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-900)', whiteSpace: 'nowrap' }}>
                      {fmt(selectedRevenueBar.value)}
                    </span>
                  </div>
                </div>
              ) : null}
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 56, right: 4, bottom: 0, left: 4 }} barCategoryGap="30%">
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 9, fill: '#9090a8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide domain={[0, yMax]} />
                  <Bar
                    dataKey="value"
                    shape={<RevBarShape />}
                    maxBarSize={24}
                    isAnimationActive={false}
                    onClick={(data, index) => {
                      const payload = (data as { payload?: Rev2026Point } | null)?.payload ?? null
                      const fallback = typeof index === 'number' ? chartData[index] ?? null : null
                      const next = payload ?? fallback
                      if (!next) return
                      setSelectedRevenueBar((prev) =>
                        prev && prev.monthOrder === next.monthOrder ? null : next,
                      )
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ── Slide 1: Sources donut (2026 only) ── */}
            <div style={{ width: '50%', flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column', gap: 0, paddingTop: 'var(--space-2)' }}>
              {/* Pie area */}
              <div style={{ height: 188, flexShrink: 0, position: 'relative', display: 'grid', placeItems: 'center' }}>
                {selectedSource ? (
                  <div style={{
                    position: 'absolute',
                    top: 2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    maxWidth: '86%',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--neutral-200)',
                    background: 'var(--neutral-0)',
                    boxShadow: 'var(--shadow-card)',
                    padding: '4px 8px',
                    display: 'grid',
                    justifyItems: 'center',
                    gap: 1,
                    zIndex: 1,
                  }}>
                    <span style={{ fontSize: 10, lineHeight: 1.2, color: 'var(--neutral-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                      {selectedSource.name}
                    </span>
                    <span style={{ fontSize: 11, lineHeight: 1.2, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      {fmt(selectedSource.value)}
                    </span>
                  </div>
                ) : null}
                <ResponsiveContainer width="100%" height={188}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="54%"
                      innerRadius={54}
                      outerRadius={86}
                      paddingAngle={2}
                      onClick={(slice: unknown) => {
                        const s = slice as { id?: string; payload?: { id?: string } } | null
                        const inner = (s?.payload ?? s) as { id?: string } | null
                        const id = inner?.id ?? null
                        setSelectedSourceId(prev => prev === id ? null : id)
                      }}
                    >
                      {donutData.map((entry) => (
                        <Cell
                          key={entry.id}
                          fill={entry.color}
                          fillOpacity={selectedSourceId && selectedSourceId !== entry.id ? 0.55 : 0.96}
                          stroke={selectedSourceId === entry.id ? 'var(--neutral-900)' : 'var(--neutral-0)'}
                          strokeWidth={selectedSourceId === entry.id ? 2 : 1}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div aria-hidden="true" style={{ height: 'var(--space-6)', flexShrink: 0 }} />
              {/* Legend grid */}
              <div style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 6,
                alignContent: 'start',
              }}>
                {donutData.map((entry) => (
                  <button
                    key={`${entry.id}-legend`}
                    type="button"
                    onClick={() => setSelectedSourceId(prev => prev === entry.id ? null : entry.id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      display: 'grid',
                      gridTemplateColumns: '10px minmax(0, 1fr)',
                      gap: 6,
                      alignItems: 'center',
                      textAlign: 'left',
                      cursor: 'pointer',
                      opacity: selectedSourceId && selectedSourceId !== entry.id ? 0.6 : 1,
                    }}
                  >
                    <span style={{
                      width: 10,
                      height: 10,
                      borderRadius: 'var(--radius-full)',
                      background: entry.color,
                      border: '1px solid color-mix(in oklab, var(--neutral-900) 18%, transparent)',
                      flexShrink: 0,
                      display: 'block',
                    }} />
                    <span style={{
                      minWidth: 0,
                      fontSize: 10,
                      lineHeight: 1.2,
                      color: 'var(--neutral-700)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontWeight: 700,
                    }}>
                      {`${entry.name} (${donutTotal > 0 ? Math.round((entry.value / donutTotal) * 100) : 0}%)`}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── Dot slide selector (matches bloc revenus pattern) ── */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-2)', marginTop: 8 }}>
          {([0, 1] as const).map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSlide(idx)}
              aria-label={`Slide ${idx + 1} sur 2`}
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
                  display: 'block',
                  width: idx === revSlide ? 14 : 8,
                  height: idx === revSlide ? 14 : 8,
                  borderRadius: 'var(--radius-full)',
                  background: idx === revSlide ? 'var(--primary-500)' : 'var(--neutral-300)',
                  transition: 'all var(--transition-base)',
                }}
              />
            </button>
          ))}
        </div>

      </div>

      <AnimatePresence>
        {showRevenueTransactionsModal && (
          <RevenueTransactionsYtdModal
            groups={revenueTransactionGroups2026}
            onClose={() => setShowRevenueTransactionsModal(false)}
          />
        )}
      </AnimatePresence>
      {revenueKpiModalConfig ? (
        <RevenueKpiDetailModal
          config={revenueKpiModalConfig}
          onClose={() => setActiveRevenueKpiModal(null)}
        />
      ) : null}
    </div>
  )
}

function formatSignedPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = Math.round(value * 10) / 10
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded.toFixed(1)}%`
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function formatMonthFullFr(month: number): string {
  const date = new Date(2026, Math.max(0, month - 1), 1)
  return new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(date)
}

function ExpenseSection2026({
  ytdExpenseClosedMonths,
  ytdBudgetClosedMonths,
  projectedExpense2026,
  monthlyMetrics,
  completedMonths,
}: {
  ytdExpenseClosedMonths: number
  ytdBudgetClosedMonths: number
  projectedExpense2026: number | null
  monthlyMetrics: ExpenseMonthlyMetric[]
  completedMonths: number
}) {
  const [expenseSlide, setExpenseSlide] = useState<ExpenseSlide>(0)
  const [activeExpenseKpiModal, setActiveExpenseKpiModal] = useState<ExpenseKpiModalKey>(null)
  const [selectedExpenseHistoryBar, setSelectedExpenseHistoryBar] = useState<ExpenseHistoryPoint | null>(null)
  const gapYtdPct = ytdBudgetClosedMonths > 0
    ? ((ytdExpenseClosedMonths - ytdBudgetClosedMonths) / ytdBudgetClosedMonths) * 100
    : null
  const gapColor = gapYtdPct == null
    ? 'var(--neutral-600)'
    : gapYtdPct > 0
      ? 'var(--color-negative)'
      : 'var(--color-positive)'
  const historyBudgetPerMonth = completedMonths > 0 ? ytdBudgetClosedMonths / completedMonths : 0
  const expenseHistoryRows = useMemo<ExpenseHistoryPoint[]>(() => {
    const monthCount = Math.max(1, completedMonths)
    const rows = Array.from({ length: monthCount }, (_, index) => {
      const month = index + 1
      const monthMetric = monthlyMetrics.find((metric) => Number(metric.period_month) === month)
      return {
        month,
        monthLabel: MONTH_LABELS_SHORT[month - 1] ?? `M${month}`,
        amount: Number(monthMetric?.expense_total ?? 0),
        budget: historyBudgetPerMonth,
        avg12m: 0,
        median12m: 0,
      }
    })
    const values = rows.map((row) => row.amount)
    const avg12m = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
    const median12m = median(values)
    return rows.map((row) => ({ ...row, avg12m, median12m }))
  }, [completedMonths, historyBudgetPerMonth, monthlyMetrics])
  const historyAvg12m = expenseHistoryRows[0]?.avg12m ?? 0
  const historyMedian12m = expenseHistoryRows[0]?.median12m ?? 0
  const historyYMax = useMemo(() => {
    const maxVal = Math.max(
      1000,
      ...expenseHistoryRows.map((row) => row.amount),
      historyBudgetPerMonth,
      historyAvg12m,
      historyMedian12m,
    )
    return Math.ceil(maxVal / 500) * 500 + 500
  }, [expenseHistoryRows, historyAvg12m, historyBudgetPerMonth, historyMedian12m])
  const historyLegend = [
    { key: 'budget_2026', label: 'Budget 2026', color: '#EF4444' },
    { key: 'avg_12m', label: 'Moyenne (12M)', color: '#7C4DFF' },
    { key: 'median_12m', label: 'Médiane (12M)', color: '#FFB300' },
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
        <button
          type="button"
          onClick={() => setActiveExpenseKpiModal('ytd')}
          style={{ background: 'var(--neutral-0)', border: '1.5px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 58, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: 'pointer' }}
        >
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.2 }}>
            Dépenses YTD
          </p>
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1 }}>
            {fmt(ytdExpenseClosedMonths)}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setActiveExpenseKpiModal('gap')}
          style={{ background: 'color-mix(in oklab, var(--color-warning) 10%, var(--neutral-0) 90%)', border: '1.5px solid color-mix(in oklab, var(--color-warning) 72%, var(--neutral-200) 28%)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 58, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: 'pointer' }}
        >
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.2 }}>
            écart YTD
          </p>
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: gapColor, lineHeight: 1 }}>
            {formatSignedPercent(gapYtdPct)}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setActiveExpenseKpiModal('projection')}
          style={{ background: 'color-mix(in oklab, var(--primary-500) 10%, var(--neutral-0) 90%)', border: '1.5px solid color-mix(in oklab, var(--primary-500) 72%, var(--neutral-200) 28%)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 58, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: 'pointer' }}
        >
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.2 }}>
            projection 2026
          </p>
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1 }}>
            {projectedExpense2026 != null ? fmt(projectedExpense2026) : '—'}
          </p>
        </button>
      </div>

      <div style={{ background: 'var(--neutral-0)', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
        <AnimatePresence mode="wait" initial={false}>
          {expenseSlide === 0 ? (
            <motion.div
              key="expense-slide-category"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <AnnualProjectionSectionConnected
                viewMode="category"
                hideModeToggle
              />
            </motion.div>
          ) : (
            <motion.div
              key="expense-slide-year"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <AnnualProjectionSectionConnected
                viewMode="year"
                hideModeToggle
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-2)', marginTop: 8 }}>
          {([0, 1] as const).map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setExpenseSlide(idx)}
              aria-label={`Slide dépenses ${idx + 1} sur 2`}
              style={{ minWidth: 'var(--touch-target-min)', minHeight: 'var(--touch-target-min)', borderRadius: 'var(--radius-full)', border: 'none', padding: 0, background: 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all var(--transition-base)' }}
            >
              <span
                aria-hidden="true"
                style={{ display: 'block', width: idx === expenseSlide ? 14 : 8, height: idx === expenseSlide ? 14 : 8, borderRadius: 'var(--radius-full)', background: idx === expenseSlide ? 'var(--primary-500)' : 'var(--neutral-300)', transition: 'all var(--transition-base)' }}
              />
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {activeExpenseKpiModal ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveExpenseKpiModal(null)}
              style={{ position: 'fixed', inset: 0, zIndex: 96, background: 'rgba(13,13,31,0.52)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Détail KPI dépenses"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 97,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-4)',
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 'min(92vw, 760px)',
                  maxHeight: '86vh',
                  overflowY: 'auto',
                  background: 'var(--neutral-0)',
                  borderRadius: 'var(--radius-2xl)',
                  padding: 'var(--space-4)',
                  boxShadow: '0 12px 48px rgba(13,13,31,0.22)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                  <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 800, lineHeight: 1.2 }}>
                    {activeExpenseKpiModal === 'ytd'
                      ? 'Dépenses 2026 YTD'
                      : activeExpenseKpiModal === 'gap'
                        ? 'écart YTD - détail'
                        : 'projection 2026 - détail'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveExpenseKpiModal(null)}
                    style={{ border: 'none', background: 'var(--neutral-100)', color: 'var(--neutral-600)', width: 30, height: 30, borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <X size={13} />
                  </button>
                </div>

                {activeExpenseKpiModal === 'ytd' ? (
                  <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
                    <div style={{ width: '100%', height: 340, position: 'relative' }}>
                      {selectedExpenseHistoryBar ? (
                        <div
                          onClick={(event) => event.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: 8,
                            left: 8,
                            zIndex: 2,
                            background: 'var(--neutral-0)',
                            border: '1px solid var(--neutral-200)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-card)',
                            padding: '10px 12px',
                            minWidth: 160,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedExpenseHistoryBar(null)}
                            aria-label="Fermer"
                            style={{
                              position: 'absolute',
                              top: 6,
                              right: 6,
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--neutral-400)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: 0,
                            }}
                          >
                            <X size={11} />
                          </button>
                          <p style={{ margin: 0, paddingRight: 14, fontSize: 12, color: 'var(--neutral-900)', fontWeight: 800 }}>
                            {formatMonthFullFr(selectedExpenseHistoryBar.month)}
                          </p>
                          <div style={{ display: 'grid', gap: 2, marginTop: 4 }}>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-900)', display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 12, alignItems: 'center' }}>
                              <span>Réel</span>
                              <strong style={{ justifySelf: 'end', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(selectedExpenseHistoryBar.amount)}</strong>
                            </p>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-900)', display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 12, alignItems: 'center' }}>
                              <span>Moy. 12m</span>
                              <strong style={{ justifySelf: 'end', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(selectedExpenseHistoryBar.avg12m)}</strong>
                            </p>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-900)', display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 12, alignItems: 'center' }}>
                              <span>Méd. 12m</span>
                              <strong style={{ justifySelf: 'end', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(selectedExpenseHistoryBar.median12m)}</strong>
                            </p>
                          </div>
                        </div>
                      ) : null}
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={expenseHistoryRows} margin={{ top: 10, right: 6, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-150)" vertical={false} />
                          <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--neutral-500)' }} />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: 'var(--neutral-500)' }}
                            tickFormatter={(value) => fmt(Number(value))}
                            width={68}
                            domain={[0, historyYMax]}
                            tickCount={5}
                          />
                          <ReferenceLine y={historyBudgetPerMonth} stroke="#EF4444" strokeWidth={2} />
                          <ReferenceLine y={historyAvg12m} stroke="#7C4DFF" strokeWidth={2} strokeDasharray="4 4" />
                          <ReferenceLine y={historyMedian12m} stroke="#FFB300" strokeWidth={2} strokeDasharray="4 4" />
                          <Bar
                            dataKey="amount"
                            fill="var(--primary-500)"
                            radius={[8, 8, 0, 0]}
                            maxBarSize={40}
                            onClick={(data, index) => {
                              const payload = (data as { payload?: ExpenseHistoryPoint } | null)?.payload ?? null
                              const fallback = typeof index === 'number' ? expenseHistoryRows[index] ?? null : null
                              const next = payload ?? fallback
                              if (!next) return
                              setSelectedExpenseHistoryBar((prev) =>
                                prev && prev.month === next.month ? null : next,
                              )
                            }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, flexWrap: 'nowrap', fontSize: 9, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)', paddingTop: 2 }}>
                      {historyLegend.map((item) => (
                        <span key={item.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                          <span>{item.label}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : activeExpenseKpiModal === 'gap' ? (
                  <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)' }}>
                      Dépenses réelles YTD (mois révolus): <strong style={{ fontFamily: 'var(--font-mono)' }}>{fmt(ytdExpenseClosedMonths)}</strong>
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)' }}>
                      Budget YTD (mois révolus): <strong style={{ fontFamily: 'var(--font-mono)' }}>{fmt(ytdBudgetClosedMonths)}</strong>
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)' }}>
                      Ecart: <strong style={{ fontFamily: 'var(--font-mono)', color: gapColor }}>{formatSignedPercent(gapYtdPct)}</strong>
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)' }}>
                      Dépenses YTD (mois révolus): <strong style={{ fontFamily: 'var(--font-mono)' }}>{fmt(ytdExpenseClosedMonths)}</strong>
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)' }}>
                      Projection totale fin 2026: <strong style={{ fontFamily: 'var(--font-mono)' }}>{projectedExpense2026 != null ? fmt(projectedExpense2026) : '—'}</strong>
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectionsTabContent() {
  const [mode, setMode] = useState<DisplayMode>('depenses')
  const [projMonth, setProjMonth] = useState<number | null>(null) // null = full year 2026
  const [showPeriodModal, setShowPeriodModal] = useState(false)

  const { summary } = useAnnual2026Analysis()
  const { data: revenueData } = useBudgetRevenueAnalytics()
  const { data: projection } = useAnnualProjectionOverview2026(2026)
  const { data: monthlyMetrics = [] } = useQuery({
    queryKey: [QK.BUDGET_METRICS_YEAR_DATASET, 2026],
    queryFn: () => getMonthlyMetrics(2026),
    staleTime: STALE.ANALYTICS,
  })

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const ytdMonths = summary?.ytdMonths ?? Math.min(now.getMonth() + 1, 12)
  const completedMonths = Math.max(0, currentMonth - 1)
  const ytdExpenseClosedMonths = useMemo(
    () => monthlyMetrics
      .filter((row) => Number(row.period_month) >= 1 && Number(row.period_month) <= completedMonths)
      .reduce((sum, row) => sum + Number(row.expense_total ?? 0), 0),
    [completedMonths, monthlyMetrics],
  )
  const ytdBudgetClosedMonths = (summary?.totalMonthlyBudget ?? 0) * completedMonths

  // ── Helpers ────────────────────────────────────────────────────────────────

  const MONTHS_FR_FULL_PROJ = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const periodLabel = projMonth === null ? '2026' : `${MONTHS_FR_FULL_PROJ[projMonth - 1]} 26`

  function toggleBtnStyle(active: boolean): React.CSSProperties {
    return {
      border: active ? '2px solid var(--neutral-900)' : '1px solid var(--neutral-200)',
      background: active ? 'var(--primary-50)' : 'var(--neutral-0)',
      color: active ? 'var(--primary-700)' : 'var(--neutral-600)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-2) var(--space-4)',
      fontSize: 'var(--font-size-sm)',
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all var(--transition-base)',
      minHeight: 36,
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── period picker modal ── */}
      <AnimatePresence>
        {showPeriodModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPeriodModal(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Sélectionner une période"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: 'var(--page-gutter)',
                right: 'var(--page-gutter)',
                top: '25vh',
                zIndex: 61,
                maxWidth: 320,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-2xl)',
                padding: 'var(--space-4)',
                boxShadow: '0 8px 40px rgba(13,13,31,0.18)',
              }}
            >
              {/* Full year option */}
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <button
                  type="button"
                  onClick={() => { setProjMonth(null); setShowPeriodModal(false) }}
                  style={{
                    width: '100%',
                    padding: '8px var(--space-3)',
                    border: projMonth === null ? '2px solid var(--primary-600)' : '1px solid var(--neutral-200)',
                    borderRadius: 'var(--radius-md)',
                    background: projMonth === null ? 'color-mix(in oklab, var(--primary-600) 10%, var(--neutral-0) 90%)' : 'var(--neutral-50)',
                    color: projMonth === null ? 'var(--primary-600)' : 'var(--neutral-700)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all var(--transition-base)',
                    textAlign: 'center',
                  } as React.CSSProperties}
                >
                  2026 — Année complète
                </button>
              </div>
              {/* Month grid: 4 × 3 — past months disabled */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {MONTH_LABELS_SHORT.map((lbl, idx) => {
                  const m = idx + 1
                  const disabled = m < currentMonth
                  const isSelected = projMonth === m
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={disabled}
                      onClick={() => { setProjMonth(m); setShowPeriodModal(false) }}
                      style={{
                        padding: '7px 4px',
                        border: isSelected ? '2px solid var(--primary-600)' : '1px solid var(--neutral-200)',
                        borderRadius: 'var(--radius-sm)',
                        background: isSelected ? 'color-mix(in oklab, var(--primary-600) 12%, var(--neutral-0) 88%)' : 'var(--neutral-50)',
                        color: disabled ? 'var(--neutral-300)' : isSelected ? 'var(--primary-600)' : 'var(--neutral-800)',
                        fontSize: 11,
                        fontWeight: isSelected ? 700 : 500,
                        cursor: disabled ? 'default' : 'pointer',
                        transition: 'all var(--transition-base)',
                      }}
                    >
                      {lbl}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div style={{ padding: '0 var(--page-gutter)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {/* ── period + mode controls (mirrors EnveloppesTab layout) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={() => setShowPeriodModal(true)}
            aria-label="Choisir une période"
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              textAlign: 'center',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
              color: 'var(--neutral-700)',
              letterSpacing: '0.01em',
            }}
          >
            {periodLabel}
            <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid var(--neutral-400)', marginTop: 1, flexShrink: 0 }} />
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', background: 'var(--neutral-100)', borderRadius: 'var(--radius-md)', padding: '3px', width: 224 }}>
            <button type="button" onClick={() => setMode('depenses')} style={{ ...toggleBtnStyle(mode === 'depenses'), textAlign: 'center' }}>Dépenses</button>
            <button type="button" onClick={() => setMode('revenus')} style={{ ...toggleBtnStyle(mode === 'revenus'), textAlign: 'center' }}>Revenus</button>
          </div>
        </div>

        {/* ── Revenue 2026 KPIs + histogram — revenus mode only ── */}
        {mode === 'revenus' && (
          <RevenueSection2026 revenueData={revenueData} ytdMonths={ytdMonths} />
        )}
        {mode === 'depenses' && (
          <ExpenseSection2026
            ytdExpenseClosedMonths={ytdExpenseClosedMonths}
            ytdBudgetClosedMonths={ytdBudgetClosedMonths}
            projectedExpense2026={projection?.projectedTotalExpensesAmount ?? null}
            monthlyMetrics={monthlyMetrics}
            completedMonths={completedMonths}
          />
        )}

      </div>
    </>
  )
}
