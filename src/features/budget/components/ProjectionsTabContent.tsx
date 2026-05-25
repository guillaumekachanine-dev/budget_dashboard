import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { ComposedChart, Area, Line, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, ReferenceLine } from 'recharts'
import { useAnnual2026Analysis } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { useBudgetRevenueAnalytics } from '@/features/budget/hooks/useBudgetRevenueAnalytics'
import { useAnnualProjectionOverview2026 } from '@/features/annual-analysis/hooks/useAnnualProjectionOverview2026'
import { AnnualProjectionSectionConnected } from '@/features/annual-analysis/components/AnnualCostProjection2026'
import { budgetDb } from '@/lib/supabaseBudget'
import { formatCurrencyRounded as fmt } from '@/lib/utils'
import { EXPENSE_BUCKETS, getMonthShortLabel, MONTH_LABELS_SHORT } from '@/features/annual-analysis/components/_constants'
import { getMonthlyMetrics } from '@/features/budget/api/getMonthlyMetrics'
import { QK, STALE } from '@/lib/queryKeys'
import type { BudgetRevenueAnalytics, BudgetRevenueTransaction } from '@/features/budget/types'
import { useBudgetRevenueSources2026, type RevenuSource2026 } from '@/features/budget/hooks/useBudgetRevenueSources2026'

// ─── Types ────────────────────────────────────────────────────────────────────

type DisplayMode = 'depenses' | 'revenus'
type ExpenseSlide = 0 | 1
type ExpenseKpiModalKey = 'ytd' | 'gap' | 'projection' | null
type ExpenseMonthlyMetric = { period_month: number; expense_total: number }
type MonthlyExpenseBudgetRow = { period_month: number | null; budget_bucket: string | null; budget_amount: number | null }

interface ExpenseProjectionDetailRow {
  month: number
  monthLabel: string
  sourceLabel: string
  amount: number
}

interface ExpenseHistoryPoint {
  month: number
  monthLabel: string
  amount: number
  budget: number
  avg2026: number
  median2026: number
}

// ─── Sub-components ───────────────────────────────────────────────────────────


// ─── Revenue 2026 sources ─────────────────────────────────────────────────────

const REV_GREENS = ['#0C5D39', '#167A4B', '#1F955B', '#2DB26E', '#4BC684', '#6FD69D', '#94E3B7', '#B9EED1']
const SCENARIO_1_COLOR = '#D58A83'
const SCENARIO_2_COLOR = '#15A9A1'
const MONTHS_FR_FULL_PROJ = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

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

interface RevenueMonthGroup {
  monthKey: string
  monthLabel: string
  total: number
  transactions: BudgetRevenueTransaction[]
}

type RevenueKpiModalKey = 'ytd' | 'scenario1' | 'scenario2' | null
type RevenueDisplayMode = 'real_ytd' | 'scenario1' | 'scenario2'

interface ScenarioMonthPoint {
  monthLabel: string
  actual: number | null
  projected: number | null
}

interface RevenueKpiModalConfig {
  title: string
  subtitle?: string
  accentColor: string
  lines: Array<{ label: string; value: string }>
  totalLabel: string
  totalValue: string
  chartPoints?: ScenarioMonthPoint[]
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
          top: '18vh',
          bottom: '12vh',
          zIndex: 91,
          maxWidth: 640,
          margin: '0 auto',
          background: 'var(--neutral-0)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: '0 12px 48px rgba(13,13,31,0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Titre fixe — hors zone de scroll */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-4) var(--space-3)', flexShrink: 0 }}>
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

        {/* Zone scrollable — pas de padding-top pour que les sticky touchent le bord */}
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 var(--space-4) var(--space-4)' }}>
          <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', overflow: 'clip', display: 'grid' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) auto', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'color-mix(in oklab, var(--color-success) 30%, var(--neutral-0) 70%)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-800)', fontWeight: 700 }}>
              <span>Date</span>
              <span style={{ paddingLeft: 'var(--space-1)' }}>Libellé / catégorie</span>
              <span>Montant</span>
            </div>
            <div style={{ display: 'grid' }}>
              {groups.length > 0 ? groups.map((group) => (
                <div key={group.monthKey} style={{ display: 'grid' }}>
                  <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-2)', borderTop: '1px solid color-mix(in oklab, var(--neutral-700) 55%, transparent)', background: 'color-mix(in oklab, var(--neutral-200) 42%, var(--neutral-0) 58%)', padding: '9px var(--space-3)' }}>
                    <span style={{ fontSize: 11, color: 'var(--neutral-700)', fontWeight: 700, letterSpacing: '0.02em' }}>{group.monthLabel}</span>
                    <span style={{ fontSize: 11, color: 'var(--neutral-800)', fontWeight: 700, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{fmt(group.total)}</span>
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
        </div>
      </motion.div>
    </>
  )
}

function ScenarioRevenueChart({
  points,
  accentColor,
}: {
  points: ScenarioMonthPoint[]
  accentColor: string
}) {
  const gradId = `srev-act-${accentColor.replace('#', '')}`
  const gradProjId = `srev-proj-${accentColor.replace('#', '')}`
  return (
    <ResponsiveContainer width="100%" height={130}>
      <ComposedChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: -28 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4E4AE0" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#4E4AE0" stopOpacity={0.0} />
          </linearGradient>
          <linearGradient id={gradProjId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity={0.22} />
            <stop offset="100%" stopColor={accentColor} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--neutral-200)" strokeDasharray="3 3" />
        <XAxis
          dataKey="monthLabel"
          tick={{ fontSize: 9, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 9, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
          width={36}
        />
        <ReferenceLine y={3338} stroke="var(--neutral-400)" strokeDasharray="4 3" strokeWidth={1} />
        <ReferenceLine y={6500} stroke={accentColor} strokeDasharray="4 3" strokeWidth={1} opacity={0.55} />
        <Area
          type="monotone"
          dataKey="actual"
          fill={`url(#${gradId})`}
          stroke="none"
          connectNulls={false}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="projected"
          fill={`url(#${gradProjId})`}
          stroke="none"
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#4E4AE0"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="projected"
          stroke={accentColor}
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
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
          maxWidth: 420,
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

          {config.chartPoints && config.chartPoints.length > 0 ? (
            <div style={{ margin: '4px 0 2px', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <ScenarioRevenueChart points={config.chartPoints} accentColor={config.accentColor} />
            </div>
          ) : null}

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
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [showRevenueTransactionsModal, setShowRevenueTransactionsModal] = useState(false)
  const [activeRevenueKpiModal, setActiveRevenueKpiModal] = useState<RevenueKpiModalKey>(null)
  const [revenueDisplayMode, setRevenueDisplayMode] = useState<RevenueDisplayMode>('real_ytd')
  const [showRevenueDisplayPicker, setShowRevenueDisplayPicker] = useState(false)
  const { data: rawSources } = useBudgetRevenueSources2026()

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
  const centerRevenueTotal = revenueDisplayMode === 'real_ytd'
    ? ytdRevenue2026
    : revenueDisplayMode === 'scenario1'
      ? projectedScenario1
      : projectedScenario2
  const centerRevenueLabel = revenueDisplayMode === 'real_ytd'
    ? 'Réel YTD'
    : revenueDisplayMode === 'scenario1'
      ? 'scenario #1'
      : 'scenario #2'
  const centerRevenueLabelColor = revenueDisplayMode === 'real_ytd'
    ? 'var(--neutral-500)'
    : revenueDisplayMode === 'scenario1'
      ? SCENARIO_1_COLOR
      : SCENARIO_2_COLOR
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
      const chartPoints: ScenarioMonthPoint[] = MONTH_LABELS_SHORT.map((monthLabel, idx) => {
        const month = idx + 1
        const seriesRow = series2026.find((r) => parseInt(r.month_start.slice(5, 7), 10) === month)
        const actual = seriesRow ? Number(seriesRow.revenue_amount ?? 0) : null
        if (month < ytdMonths) return { monthLabel, actual, projected: null }
        if (month === ytdMonths) return { monthLabel, actual, projected: actual ?? guaranteedMonthlyIncome }
        return { monthLabel, actual: null, projected: guaranteedMonthlyIncome }
      })
      return {
        title: 'Scenario #1 : chômage full year',
        accentColor: SCENARIO_1_COLOR,
        lines: [
          { label: 'revenus 2026 YTD', value: fmt(ytdRevenue2026) },
          { label: 'revenus assurés', value: `${fmt(guaranteedMonthlyIncome)}/mois (Chômage)` },
          { label: 'période concernée', value: assuredPeriodLabel },
        ],
        totalLabel: 'Projection #1',
        totalValue: fmt(projectedScenario1),
        chartPoints,
      }
    }

    const chartPoints2: ScenarioMonthPoint[] = MONTH_LABELS_SHORT.map((monthLabel, idx) => {
      const month = idx + 1
      const seriesRow = series2026.find((r) => parseInt(r.month_start.slice(5, 7), 10) === month)
      const actual = seriesRow ? Number(seriesRow.revenue_amount ?? 0) : null
      if (month < ytdMonths) return { monthLabel, actual, projected: null }
      if (month === ytdMonths) return { monthLabel, actual, projected: actual ?? guaranteedMonthlyIncome }
      // months ytdMonths+1 … ytdMonths+scenario2UnemploymentMonths: chômage
      // months after that (up to 12): salary
      const projectedMonthOffset = month - ytdMonths // 1-indexed offset into projected period
      const projected =
        projectedMonthOffset <= scenario2UnemploymentMonths
          ? guaranteedMonthlyIncome
          : salaryAndPrimeMonthlyIncome
      return { monthLabel, actual: null, projected }
    })
    return {
      title: 'Scenario #2 : reprise salariat octobre',
      accentColor: SCENARIO_2_COLOR,
      lines: [
        { label: 'revenus 2026 YTD', value: fmt(ytdRevenue2026) },
        { label: 'indemnités chômage', value: `${fmt(guaranteedMonthlyIncome)} × ${scenario2UnemploymentMonths}(juin-sept.)` },
        { label: 'salaire + primes', value: `${fmt(salaryAndPrimeMonthlyIncome)} × ${scenario2SalaryMonths} (oct.-déc.)` },
      ],
      totalLabel: 'Projection #2',
      totalValue: fmt(projectedScenario2),
      chartPoints: chartPoints2,
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
    series2026,
    ytdMonths,
    ytdRevenue2026,
  ])

  function handleDisplayModeSelect(mode: RevenueDisplayMode) {
    setRevenueDisplayMode(mode)
    setSelectedSourceId(null)
    setShowRevenueDisplayPicker(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

      {/* ── 2 KPI tiles — always above carousel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
        {([
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

      <div style={{
        background: 'var(--neutral-0)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4, gap: 'var(--space-2)' }}>
          <div style={{ display: 'grid', gap: 3 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-700)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              Sources de revenus 2026
            </p>
            <button
              type="button"
              onClick={() => setShowRevenueTransactionsModal(true)}
              style={{
                border: '1px solid var(--neutral-300)',
                background: 'var(--neutral-100)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--neutral-700)',
                padding: '3px var(--space-2)',
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                width: 'fit-content',
              }}
            >
              <span style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '6px solid var(--neutral-500)', marginTop: 1, flexShrink: 0 }} />
              <span>liste transactions</span>
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowRevenueDisplayPicker((prev) => !prev)}
              aria-label="Choisir un affichage des sources de revenus"
              style={{
                border: '1px solid var(--neutral-300)',
                background: 'var(--neutral-100)',
                borderRadius: 'var(--radius-xs)',
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
        </div>

        <div style={{ height: 290, display: 'flex', flexDirection: 'column', gap: 0, paddingTop: 'var(--space-2)' }}>
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
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '54%',
                transform: 'translate(-50%, -50%)',
                display: 'grid',
                justifyItems: 'center',
                gap: 2,
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              <span
                style={{
                  margin: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  color: centerRevenueLabelColor,
                  lineHeight: 1.2,
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {centerRevenueLabel}
              </span>
              <span
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 900,
                  color: 'var(--neutral-900)',
                  lineHeight: 1,
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                }}
              >
                {fmt(centerRevenueTotal)}
              </span>
            </div>
          </div>
          <div aria-hidden="true" style={{ height: 'calc(var(--space-8) + var(--space-3))', flexShrink: 0 }} />
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
  projectionDetailRows,
}: {
  ytdExpenseClosedMonths: number
  ytdBudgetClosedMonths: number
  projectedExpense2026: number | null
  monthlyMetrics: ExpenseMonthlyMetric[]
  completedMonths: number
  projectionDetailRows: ExpenseProjectionDetailRow[]
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
    const baseRows = Array.from({ length: monthCount }, (_, index) => {
      const month = index + 1
      const monthMetric = monthlyMetrics.find((metric) => Number(metric.period_month) === month)
      return {
        month,
        monthLabel: MONTH_LABELS_SHORT[month - 1] ?? `M${month}`,
        amount: Number(monthMetric?.expense_total ?? 0),
        budget: historyBudgetPerMonth,
        avg2026: 0,
        median2026: 0,
      }
    })

    const ytdValues2026 = baseRows.map((row) => row.amount)
    const avg2026 = ytdValues2026.length > 0
      ? ytdValues2026.reduce((sum, value) => sum + value, 0) / ytdValues2026.length
      : 0
    const median2026 = median(ytdValues2026)

    return baseRows.map((row) => ({ ...row, avg2026, median2026 }))
  }, [completedMonths, historyBudgetPerMonth, monthlyMetrics])
  const historyAvg2026 = expenseHistoryRows[0]?.avg2026 ?? 0
  const historyMedian2026 = expenseHistoryRows[0]?.median2026 ?? 0
  const historyYMax = useMemo(() => {
    const maxVal = Math.max(
      1000,
      ...expenseHistoryRows.map((row) => row.amount),
      historyBudgetPerMonth,
      historyAvg2026,
      historyMedian2026,
    )
    return Math.ceil(maxVal / 500) * 500 + 500
  }, [expenseHistoryRows, historyAvg2026, historyBudgetPerMonth, historyMedian2026])
  const historyLegend = [
    { key: 'actual_2026', label: 'Réel 2026', color: '#4E4AE0' },
    { key: 'budget_2026', label: 'Budget 2026', color: '#EF4444' },
    { key: 'avg_2026', label: 'Moyenne 2026 YTD', color: '#7C4DFF' },
    { key: 'median_2026', label: 'Médiane 2026 YTD', color: '#FFB300' },
  ] as const
  const expenseSlideToggleButtonStyle = (active: boolean): React.CSSProperties => ({
    border: active ? '1px solid color-mix(in oklab, var(--primary-600) 70%, var(--neutral-0) 30%)' : '1px solid transparent',
    background: active ? 'var(--neutral-0)' : 'transparent',
    color: active ? 'var(--primary-700)' : 'var(--neutral-600)',
    borderRadius: 'var(--radius-full)',
    padding: '5px 10px',
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    transition: 'all 160ms ease',
    minHeight: 32,
    width: '100%',
    textAlign: 'center',
    textTransform: 'none',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
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
          onClick={() => setActiveExpenseKpiModal('projection')}
          style={{
            background: 'linear-gradient(135deg, #0F4C5C 0%, #245E6D 62%, #DDEFF4 98%)',
            border: '1.5px solid rgba(255,255,255,0.96)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-3)',
            minHeight: 58,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.2 }}>
            projection 2026
          </p>
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#F2B622', lineHeight: 1, textShadow: '0 1px 1px rgba(0,0,0,0.22)' }}>
            {projectedExpense2026 != null ? fmt(projectedExpense2026) : '—'}
          </p>
        </button>
      </div>

      <div style={{ background: 'var(--neutral-0)', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
        <div style={{ height: 354, overflow: 'hidden' }}>
          <AnimatePresence mode="wait" initial={false}>
            {expenseSlide === 0 ? (
              <motion.div
                key="expense-slide-category"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              >
                <AnnualProjectionSectionConnected
                  viewMode="category"
                  hideModeToggle
                />
              </motion.div>
            ) : (
              <motion.div
                key="expense-slide-year"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              >
                <AnnualProjectionSectionConnected
                  viewMode="year"
                  hideModeToggle
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div
          role="tablist"
          aria-label="Sélection du graphique de projection dépenses"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 4,
            padding: 3,
            borderRadius: 'var(--radius-full)',
            background: 'color-mix(in oklab, var(--primary-500) 10%, var(--neutral-0) 90%)',
            border: '1px solid color-mix(in oklab, var(--primary-500) 16%, var(--neutral-200) 84%)',
            marginTop: 8,
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={expenseSlide === 0}
            onClick={() => setExpenseSlide(0)}
            style={expenseSlideToggleButtonStyle(expenseSlide === 0)}
          >
            Catégories
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={expenseSlide === 1}
            onClick={() => setExpenseSlide(1)}
            style={expenseSlideToggleButtonStyle(expenseSlide === 1)}
          >
            Socles
          </button>
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
                              <span>Moy. 2026 YTD</span>
                              <strong style={{ justifySelf: 'end', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(selectedExpenseHistoryBar.avg2026)}</strong>
                            </p>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-900)', display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 12, alignItems: 'center' }}>
                              <span>Méd. 2026 YTD</span>
                              <strong style={{ justifySelf: 'end', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(selectedExpenseHistoryBar.median2026)}</strong>
                            </p>
                          </div>
                        </div>
                      ) : null}
                      <div
                        style={{
                          height: '100%',
                          borderRadius: 'var(--radius-lg)',
                          border: '1px solid color-mix(in oklab, var(--primary-500) 10%, var(--neutral-200) 90%)',
                          background: 'linear-gradient(180deg, color-mix(in oklab, var(--primary-50) 52%, var(--neutral-0) 48%) 0%, var(--neutral-0) 64%)',
                          padding: '8px 8px 4px',
                        }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={expenseHistoryRows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                            <defs>
                              <linearGradient id="expenseYtdGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#5B57F5" stopOpacity={0.34} />
                                <stop offset="100%" stopColor="#5B57F5" stopOpacity={0.04} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-200)" vertical={false} />
                            <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--neutral-600)' }} />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 11, fill: 'var(--neutral-500)' }}
                              tickFormatter={(value) => fmt(Number(value))}
                              width={68}
                              domain={[0, historyYMax]}
                              tickCount={5}
                            />
                            <ReferenceLine y={historyBudgetPerMonth} stroke="#EF4444" strokeWidth={1.8} />
                            <ReferenceLine y={historyAvg2026} stroke="#7C4DFF" strokeWidth={1.8} strokeDasharray="5 4" />
                            <ReferenceLine y={historyMedian2026} stroke="#FFB300" strokeWidth={1.8} strokeDasharray="5 4" />
                            <Area
                              type="monotone"
                              dataKey="amount"
                              stroke="transparent"
                              fill="url(#expenseYtdGradient)"
                              isAnimationActive
                              animationDuration={220}
                            />
                            <Line
                              type="monotone"
                              dataKey="amount"
                              stroke="#4E4AE0"
                              strokeWidth={2.6}
                              dot={{ r: 3.5, strokeWidth: 0, fill: '#4E4AE0' }}
                              activeDot={{ r: 5, fill: '#4E4AE0', stroke: '#fff', strokeWidth: 2 }}
                              isAnimationActive
                              animationDuration={240}
                            />
                            <Bar
                              dataKey="amount"
                              fill="rgba(0,0,0,0)"
                              maxBarSize={34}
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
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 9, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)', paddingTop: 6 }}>
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
                  <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'grid' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'var(--neutral-100)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-700)', fontWeight: 700 }}>
                        <span>Mois</span>
                        <span>Source</span>
                        <span style={{ textAlign: 'right' }}>Montant</span>
                      </div>
                      <div style={{ maxHeight: 332, overflowY: 'auto' }}>
                        {projectionDetailRows.map((row) => (
                          <div
                            key={row.month}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(0,1fr) auto auto',
                              gap: 'var(--space-2)',
                              padding: 'var(--space-2) var(--space-3)',
                              borderTop: '1px solid var(--neutral-200)',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', fontWeight: 600 }}>{row.monthLabel}</span>
                            <span
                              style={{
                                fontSize: 10,
                                color: row.sourceLabel === 'réel' ? 'var(--primary-600)' : 'var(--neutral-600)',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                              }}
                            >
                              {row.sourceLabel}
                            </span>
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 800, textAlign: 'right' }}>
                              {fmt(row.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)' }}>
                      Projection fin 2026 : <strong style={{ fontFamily: 'var(--font-mono)' }}>{projectedExpense2026 != null ? fmt(projectedExpense2026) : '—'}</strong>
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
  const { data: monthlyExpenseBudgets2026 = [] } = useQuery({
    queryKey: ['projection-expense-budgets-2026'],
    staleTime: STALE.ANALYTICS,
    queryFn: async (): Promise<MonthlyExpenseBudgetRow[]> => {
      const { data, error } = await budgetDb
        .from('v_monthly_bucket_budgets_clean' as never)
        .select('period_month, budget_bucket, budget_amount')
        .eq('period_year', 2026)
        .in('budget_bucket', [...EXPENSE_BUCKETS])
        .order('period_month', { ascending: true })

      if (error) throw new Error(`projection-expense-budgets-2026 failed: ${error.message}`)
      return (data ?? []) as MonthlyExpenseBudgetRow[]
    },
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
  const monthlyExpenseBudgetByMonth = useMemo(() => {
    return monthlyExpenseBudgets2026.reduce<Map<number, number>>((acc, row) => {
      const month = Number(row.period_month ?? 0)
      if (!Number.isFinite(month) || month < 1 || month > 12) return acc
      acc.set(month, (acc.get(month) ?? 0) + Number(row.budget_amount ?? 0))
      return acc
    }, new Map<number, number>())
  }, [monthlyExpenseBudgets2026])

  const expenseProjectionDetailRows = useMemo<ExpenseProjectionDetailRow[]>(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1
      const monthMetric = monthlyMetrics.find((metric) => Number(metric.period_month) === month)
      const realAmount = Number(monthMetric?.expense_total ?? 0)
      const futureBudgetAmount = Number(monthlyExpenseBudgetByMonth.get(month) ?? 0)
      const isClosedMonth = month <= completedMonths
      return {
        month,
        monthLabel: `${MONTHS_FR_FULL_PROJ[month - 1]} 2026`,
        sourceLabel: isClosedMonth ? 'réel' : 'budget',
        amount: isClosedMonth ? realAmount : futureBudgetAmount,
      }
    })
  }, [completedMonths, monthlyExpenseBudgetByMonth, monthlyMetrics])

  const projectedExpenseFromStrictSeries = useMemo(
    () => expenseProjectionDetailRows.reduce((sum, row) => sum + row.amount, 0),
    [expenseProjectionDetailRows],
  )
  const projectedExpense2026 = projectedExpenseFromStrictSeries > 0
    ? projectedExpenseFromStrictSeries
    : projection?.projectedTotalExpensesAmount ?? null

  // ── Helpers ────────────────────────────────────────────────────────────────

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
            projectedExpense2026={projectedExpense2026}
            monthlyMetrics={monthlyMetrics}
            completedMonths={completedMonths}
            projectionDetailRows={expenseProjectionDetailRows}
          />
        )}

      </div>
    </>
  )
}
