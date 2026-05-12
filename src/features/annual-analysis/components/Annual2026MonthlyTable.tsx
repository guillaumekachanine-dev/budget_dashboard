import { useEffect, useState, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  Wallet,
  Zap,
  LayoutList,
  LineChart as LineChartIcon,
  TrendingUp,
  PieChart,
  type LucideIcon,
} from 'lucide-react'
import type { MetricsScopeSelection } from '@/features/annual-analysis/components/Annual2026BlockMetrics'
import { useMonthlyFlowsByScope } from '@/features/budget/hooks/useMonthlyFlowsByScope'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyBudget2026Point } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { MONTH_LABELS_SHORT } from './_constants'
import { useAuth } from '@/hooks/useAuth'
import { budgetDb } from '@/lib/supabaseBudget'
import { getMonthlyPersonalAccountBalances } from '@/features/annual-analysis/api/getMonthlyPersonalAccountBalances'

const ALL_CATEGORIES_SCOPE_ID = 'all_categories'

type MonthlyFlowsAnalysisCardProps = {
  year: number
  initialView?: 'table' | 'chart'
  forcedView?: 'table' | 'chart'
  showInternalViewToggle?: boolean
  className?: string
  variant?: 'standalone' | 'embedded'
  monthlyProfile?: MonthlyBudget2026Point[]
  scopeSelection?: MetricsScopeSelection
}

type MonthlySynthRow = {
  month: number
  monthLabel: string
  openingBalance: number | null
  budget: number
  expense: number
  income: number
  savings: number
  deltaRealBudgetPct: number
}

type SavingsBucketActualRow = {
  period_month: number | null
  budget_bucket: string | null
  actual_budget_bucket_eur: number | null
}

type MonthlyBucketActualsCleanRow = {
  month_start: string | null
  budget_bucket: string | null
  revenue_amount: number | null
  net_amount: number | null
}

const fmt = (n: number) => {
  const val = Math.round(n).toLocaleString('fr-FR')
  return `${val}€`
}

const fmtPct = (r: number) => {
  const val = (r * 100).toFixed(1)
  return `${val}%`
}

// Pas de décimales sauf si la valeur absolue est < 1%
const fmtPctScope = (r: number) => {
  const pct = r * 100
  const decimals = Math.abs(pct) < 1 ? 1 : 0
  return `${pct.toFixed(decimals)}%`
}


function getCurrentMonthCutoff(year: number): number {
  const now = new Date()
  if (now.getFullYear() < year) return 0
  if (now.getFullYear() > year) return 12
  return Math.max(1, Math.min(12, now.getMonth() + 1))
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

const CHART_SERIES = [
  { key: 'budget',  name: 'Budget',   color: '#5B57F5', gradId: 'gBudget', dashed: true },
  { key: 'expense', name: 'Dépenses', color: '#FC5A5A', gradId: 'gExp', dashed: false },
  { key: 'income',  name: 'Revenus',  color: '#2ED47A', gradId: 'gInc', dashed: false },
  { key: 'savings', name: 'Épargne',  color: '#FFAB2E', gradId: 'gSav', dashed: false },
]
const SOLDE_SERIES = { key: 'balance', name: 'Cashflow', color: '#4A4A62' } as const

const fmtTickK = (v: number) => {
  if (!Number.isFinite(v)) return '0'
  const abs = Math.abs(v)
  if (abs < 1000) return `${Math.round(v)}`
  const k = Math.round(v / 1000)
  return `${k}k`
}

export function MonthlyFlowsAnalysisCard({
  year,
  initialView = 'table',
  forcedView,
  showInternalViewToggle = true,
  className,
  variant = 'standalone',
  monthlyProfile = [],
  scopeSelection,
}: MonthlyFlowsAnalysisCardProps) {
  const [activeSlide, setActiveSlide] = useState<'table' | 'chart'>(initialView)
  const { user, loading: authLoading } = useAuth()
  const tableMonthCutoff = getCurrentMonthCutoff(year)
  const activeView = forcedView ?? activeSlide

  const isScopedMode =
    Boolean(scopeSelection) &&
    !(scopeSelection?.kind === 'categorie' && scopeSelection?.id === ALL_CATEGORIES_SCOPE_ID)

  const { data: scopedData } = useMonthlyFlowsByScope(scopeSelection, year, isScopedMode && !authLoading)

  useEffect(() => {
    setActiveSlide(initialView)
  }, [initialView])

  const fallbackRows: MonthlySynthRow[] = monthlyProfile.map((point) => ({
    month: point.month,
    monthLabel: point.monthLabel,
    openingBalance: null,
    budget: Number(point.totalExpenseBudget ?? 0),
    expense: Number(point.totalExpenseBudget ?? 0),
    income: 0,
    savings: 0,
    deltaRealBudgetPct: 0,
  }))

  const { data: dbRows } = useQuery({
    queryKey: ['monthly-flows-analysis-card', year, tableMonthCutoff, user?.id ?? 'anon'],
    enabled: !authLoading && Boolean(user?.id),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MonthlySynthRow[]> => {
      const userId = user?.id
      if (!userId) return []

      const [metricsRes, bucketTotalsRes, savingsActualsRes, savingsMonthlyActualsRes, savingsTotalsRes, personalBalancesByMonth] = await Promise.all([
        budgetDb
          .from('analytics_monthly_metrics')
          .select('period_month, expense_total, income_total')
          .eq('period_year', year)
          .order('period_month', { ascending: true }),
        budgetDb
          .from('budget_bucket_totals_by_period')
          .select('period_month, total_budget_bucket_eur')
          .eq('period_year', year),
        budgetDb
          .from('budget_bucket_budget_vs_actual_by_month')
          .select('period_month, budget_bucket, actual_budget_bucket_eur')
          .eq('period_year', year)
          .eq('budget_bucket', 'epargne'),
        budgetDb
          .from('v_monthly_bucket_actuals_clean')
          .select('month_start, budget_bucket, revenue_amount, net_amount')
          .eq('budget_bucket', 'epargne'),
        budgetDb
          .from('savings_budget_totals_by_period')
          .select('period_month, total_savings_budget_eur')
          .eq('period_year', year),
        getMonthlyPersonalAccountBalances(year),
      ])

      if (metricsRes.error) throw new Error(`monthly metrics query failed: ${metricsRes.error.message}`)
      if (bucketTotalsRes.error) throw new Error(`budget bucket totals query failed: ${bucketTotalsRes.error.message}`)
      if (savingsActualsRes.error) throw new Error(`savings actuals query failed: ${savingsActualsRes.error.message}`)
      if (savingsMonthlyActualsRes.error) throw new Error(`savings monthly actuals query failed: ${savingsMonthlyActualsRes.error.message}`)
      if (savingsTotalsRes.error) throw new Error(`savings totals query failed: ${savingsTotalsRes.error.message}`)

      const expenseByMonth = new Map<number, number>()
      const incomeByMonth = new Map<number, number>()
      const budgetByMonth = new Map<number, number>()
      const savingsByMonth = new Map<number, number>()
      const hasSavingsPrimaryByMonth = new Set<number>()
      const hasSavingsSecondaryByMonth = new Set<number>()
      const openingBalanceByMonth = new Map<number, number | null>()
      const monthSet = new Set<number>()

      for (const row of metricsRes.data ?? []) {
        const month = Number(row.period_month ?? 0)
        if (!Number.isFinite(month) || month <= 0) continue
        monthSet.add(month)
        expenseByMonth.set(month, Number(row.expense_total ?? 0))
        incomeByMonth.set(month, Number(row.income_total ?? 0))
      }

      for (const row of bucketTotalsRes.data ?? []) {
        const month = Number(row.period_month ?? 0)
        if (!Number.isFinite(month) || month <= 0) continue
        monthSet.add(month)
        budgetByMonth.set(month, (budgetByMonth.get(month) ?? 0) + Number(row.total_budget_bucket_eur ?? 0))
      }

      for (const row of (savingsActualsRes.data ?? []) as SavingsBucketActualRow[]) {
        const month = Number(row.period_month ?? 0)
        if (!Number.isFinite(month) || month <= 0) continue
        monthSet.add(month)
        hasSavingsPrimaryByMonth.add(month)
        savingsByMonth.set(month, Math.abs(Number(row.actual_budget_bucket_eur ?? 0)))
      }

      for (const row of (savingsMonthlyActualsRes.data ?? []) as MonthlyBucketActualsCleanRow[]) {
        if (row.budget_bucket !== 'epargne') continue
        const monthRaw = row.month_start?.slice(5, 7) ?? ''
        const month = Number(monthRaw)
        if (!Number.isFinite(month) || month <= 0) continue
        monthSet.add(month)
        if (hasSavingsPrimaryByMonth.has(month)) continue
        hasSavingsSecondaryByMonth.add(month)
        savingsByMonth.set(month, Math.abs(Number(row.net_amount ?? row.revenue_amount ?? 0)))
      }

      for (const row of savingsTotalsRes.data ?? []) {
        const month = Number(row.period_month ?? 0)
        if (!Number.isFinite(month) || month <= 0) continue
        monthSet.add(month)
        if (!hasSavingsPrimaryByMonth.has(month) && !hasSavingsSecondaryByMonth.has(month)) {
          savingsByMonth.set(month, Number(row.total_savings_budget_eur ?? 0))
        }
      }

      for (let month = 1; month <= tableMonthCutoff; month += 1) {
        const key = monthKey(year, month)
        openingBalanceByMonth.set(month, personalBalancesByMonth.get(key) ?? null)
      }

      return [...monthSet]
        .sort((a, b) => a - b)
        .filter((month) => month <= tableMonthCutoff)
        .map((month) => {
          const budget = budgetByMonth.get(month) ?? 0
          const expense = expenseByMonth.get(month) ?? 0
          return {
            month,
            monthLabel: MONTH_LABELS_SHORT[month - 1] ?? `M${month}`,
            openingBalance: openingBalanceByMonth.get(month) ?? null,
            budget,
            expense,
            income: incomeByMonth.get(month) ?? 0,
            savings: savingsByMonth.get(month) ?? 0,
            deltaRealBudgetPct: budget > 0 ? (expense - budget) / budget : 0,
          }
        })
    },
  })

  const rows = (dbRows && dbRows.length > 0 ? dbRows : fallbackRows).filter((row) => row.month <= tableMonthCutoff)
  if (rows.length === 0) return null

  const chartRows = rows
  const chartData = chartRows.map((row) => ({
    label: row.monthLabel,
    // Reprend exactement la valeur affichée dans la colonne "Solde" du tableau.
    balance: row.openingBalance,
    budget: row.budget,
    expense: row.expense,
    income: row.income,
    savings: row.savings,
  }))

  if (import.meta.env.DEV) {
    console.log('[Graphique flux] chartData', chartData)
    console.log('[Graphique flux] epargne series', chartData.map((row) => ({
      month: row.label,
      savings: row.savings,
      epargne: row.savings,
    })))
  }
  const chartMaxY = Math.max(
    1000,
    Math.ceil(
      chartData.reduce((max, row) => {
        const values = [row.budget, row.expense, row.income, row.savings, Number(row.balance ?? 0)]
        return Math.max(max, ...values.filter((value) => Number.isFinite(value) && value >= 0))
      }, 0) / 1000,
    ) * 1000,
  )
  const showHeaderRow = variant !== 'embedded' || (showInternalViewToggle && !forcedView)

  return (
    <div className={className} style={{ padding: variant === 'embedded' ? '0' : '0 var(--space-4)' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={variant === 'embedded' ? cardStyleEmbedded : cardStyle}>
          {showHeaderRow ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <div>
                <h3 style={cardTitleStyle}>Analyse des flux mensuels</h3>
              </div>

              {/* Carousel Toggle */}
              {showInternalViewToggle && !forcedView ? (
                <div style={{ 
                  display: 'flex', 
                  background: 'var(--neutral-100)', 
                  borderRadius: 'var(--radius-lg)', 
                  padding: 2,
                  gap: 2
                }}>
                  <button 
                    onClick={() => setActiveSlide('table')}
                    style={{
                      border: 'none',
                      background: activeView === 'table' ? 'var(--neutral-0)' : 'transparent',
                      padding: '4px 8px',
                      borderRadius: 'calc(var(--radius-lg) - 2px)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      boxShadow: activeView === 'table' ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    <LayoutList size={14} color={activeView === 'table' ? 'var(--primary-600)' : 'var(--neutral-500)'} />
                  </button>
                  <button 
                    onClick={() => setActiveSlide('chart')}
                    style={{
                      border: 'none',
                      background: activeView === 'chart' ? 'var(--neutral-0)' : 'transparent',
                      padding: '4px 8px',
                      borderRadius: 'calc(var(--radius-lg) - 2px)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      boxShadow: activeView === 'chart' ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    <LineChartIcon size={14} color={activeView === 'chart' ? 'var(--primary-600)' : 'var(--neutral-500)'} />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={{ position: 'relative', overflow: 'hidden', minHeight: 300 }}>
            <AnimatePresence mode="wait">
              {activeView === 'table' ? (
                <motion.div
                  key="table"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflowX: 'hidden', margin: 0 }}
                >
                  {isScopedMode && scopedData ? (
                    // ── Mode scope : catégorie ou bloc ──────────────────────
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '23%' }} />
                        <col style={{ width: '21%' }} />
                        <col style={{ width: '24%' }} />
                        <col style={{ width: '18%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th style={{ ...thStyle, textAlign: 'left', paddingLeft: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }} title="Mois">
                              <CalendarDays size={14} color="var(--neutral-500)" strokeWidth={2.2} />
                              <span style={{ fontSize: 9, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Mois</span>
                            </div>
                          </th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>
                            <IconHeader icon={ArrowUpCircle} color="#E57373" label="Dépensé" />
                          </th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>
                            <IconHeader icon={Zap} color="var(--neutral-400)" label="Écart" />
                          </th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>
                            <IconHeader icon={TrendingUp} color="var(--neutral-400)" label="Évol M-1" />
                          </th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>
                            <IconHeader icon={PieChart} color="var(--neutral-400)" label="Part" />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {scopedData.rows.map((row) => {
                          const ecartColor = row.ecartPct == null ? 'var(--neutral-500)' : row.ecartPct > 0 ? '#E57373' : '#81C784'
                          const ecartPrefix = row.ecartPct != null && row.ecartPct > 0 ? '+' : ''
                          const evolColor = row.evolMoins1Pct == null ? 'var(--neutral-500)' : row.evolMoins1Pct > 0 ? '#E57373' : '#81C784'
                          const evolPrefix = row.evolMoins1Pct != null && row.evolMoins1Pct > 0 ? '+' : ''
                          return (
                            <tr key={row.month} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                              <td style={{ ...tdStyle, paddingLeft: 'var(--space-3)', textAlign: 'left' }}>
                                <span style={{ fontWeight: 600, color: 'var(--neutral-700)', fontSize: 11 }}>{row.monthLabel}</span>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#E57373' }}>
                                {fmt(row.depense)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: ecartColor }}>
                                {row.ecartPct == null ? '—' : `${ecartPrefix}${fmtPctScope(row.ecartPct)}`}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: evolColor }}>
                                {row.evolMoins1Pct == null ? '—' : `${evolPrefix}${fmtPctScope(row.evolMoins1Pct)}`}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--neutral-600)', fontWeight: 600 }}>
                                {row.partPct == null ? '—' : fmtPctScope(row.partPct)}
                              </td>
                            </tr>
                          )
                        })}
                        {/* Ligne Synth. */}
                        {scopedData.rows.length > 0 && (() => {
                          const { synth } = scopedData
                          const ecartColor = synth.avgEcartPct == null ? 'var(--neutral-500)' : synth.avgEcartPct > 0 ? '#E57373' : '#81C784'
                          const ecartPrefix = synth.avgEcartPct != null && synth.avgEcartPct > 0 ? '+' : ''
                          const evolColor = synth.avgEvolPct == null ? 'var(--neutral-500)' : synth.avgEvolPct > 0 ? '#E57373' : '#81C784'
                          const evolPrefix = synth.avgEvolPct != null && synth.avgEvolPct > 0 ? '+' : ''
                          return (
                            <tr style={synthRowStyle}>
                              <td style={{ ...tdStyle, paddingLeft: 'var(--space-3)', textAlign: 'left' }}>
                                <span style={{ fontWeight: 800, color: 'var(--neutral-600)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Synth.</span>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#E57373' }}>
                                {fmt(synth.totalDepense)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800, color: ecartColor }}>
                                {synth.avgEcartPct == null ? '—' : `${ecartPrefix}${fmtPctScope(synth.avgEcartPct)}`}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800, color: evolColor }}>
                                {synth.avgEvolPct == null ? '—' : `${evolPrefix}${fmtPctScope(synth.avgEvolPct)}`}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--neutral-600)', fontWeight: 800 }}>
                                {synth.partYtdPct == null ? '—' : fmtPctScope(synth.partYtdPct)}
                              </td>
                            </tr>
                          )
                        })()}
                      </tbody>
                    </table>
                  ) : (
                    // ── Mode défaut : Toutes catégories ─────────────────────
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '100%', tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '24%' }} />
                        <col style={{ width: '22%' }} />
                        <col style={{ width: '22%' }} />
                        <col style={{ width: '18%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th style={{ ...thStyle, textAlign: 'left', paddingLeft: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }} title="Mois">
                              <CalendarDays size={14} color="var(--neutral-500)" strokeWidth={2.2} />
                              <span style={{ fontSize: 9, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Mois</span>
                            </div>
                          </th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>
                            <IconHeader icon={Wallet} color="var(--neutral-500)" label="Solde" />
                          </th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>
                            <IconHeader icon={ArrowUpCircle} color="#E57373" label="Dépenses" />
                          </th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>
                            <IconHeader icon={ArrowDownCircle} color="#81C784" label="Revenus" />
                          </th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>
                            <IconHeader icon={Zap} color="var(--neutral-400)" label="% Écart" />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const deltaColor = row.deltaRealBudgetPct > 0 ? '#E57373' : '#81C784'
                          const deltaPrefix = row.deltaRealBudgetPct > 0 ? '+' : ''
                          return (
                            <tr key={row.month} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                              <td style={{ ...tdStyle, paddingLeft: 'var(--space-3)', textAlign: 'left' }}>
                                <span style={{ fontWeight: 600, color: 'var(--neutral-700)', fontSize: 11 }}>{row.monthLabel}</span>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--neutral-700)' }}>
                                {row.openingBalance == null ? '—' : fmt(row.openingBalance)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#E57373' }}>
                                {fmt(row.expense)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#81C784', fontWeight: 600 }}>
                                {fmt(row.income)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', color: deltaColor, fontWeight: 700 }}>
                                {deltaPrefix}{fmtPct(row.deltaRealBudgetPct)}
                              </td>
                            </tr>
                          )
                        })}
                        {/* Ligne Synth. — totaux/moyennes YTD */}
                        {rows.length > 0 && (() => {
                          const nonNullBalances = rows
                            .map((r) => r.openingBalance)
                            .filter((v): v is number => v != null)
                          const synthSolde = nonNullBalances.length > 0
                            ? nonNullBalances.reduce((s, v) => s + v, 0) / nonNullBalances.length
                            : null
                          const synthExpense = rows.reduce((s, r) => s + r.expense, 0)
                          const synthIncome = rows.reduce((s, r) => s + r.income, 0)
                          const synthDelta = rows.reduce((s, r) => s + r.deltaRealBudgetPct, 0) / rows.length
                          const deltaColor = synthDelta > 0 ? '#E57373' : '#81C784'
                          const deltaPrefix = synthDelta > 0 ? '+' : ''
                          return (
                            <tr style={synthRowStyle}>
                              <td style={{ ...tdStyle, paddingLeft: 'var(--space-3)', textAlign: 'left' }}>
                                <span style={{ fontWeight: 800, color: 'var(--neutral-600)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Synth.</span>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--neutral-700)' }}>
                                {synthSolde == null ? '—' : fmt(synthSolde)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#E57373' }}>
                                {fmt(synthExpense)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#81C784' }}>
                                {fmt(synthIncome)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800, color: deltaColor }}>
                                {deltaPrefix}{fmtPct(synthDelta)}
                              </td>
                            </tr>
                          )
                        })()}
                      </tbody>
                    </table>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="chart"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <ResponsiveContainer width="100%" height={variant === 'embedded' ? 232 : 260}>
                      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                        <defs>
                          {CHART_SERIES.map((s) => (
                            <linearGradient key={s.gradId} id={s.gradId} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%"   stopColor={s.color} stopOpacity={s.dashed ? 0.06 : 0.18} />
                              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--neutral-100)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', textAnchor: 'end' }}
                          axisLine={false}
                          tickLine={false}
                          width={30}
                          domain={[0, chartMaxY]}
                          allowDataOverflow
                          tickCount={5}
                          tickFormatter={(v: number) => fmtTickK(Number(v))}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--neutral-0)',
                            border: '1px solid var(--neutral-200)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-lg)',
                            fontSize: 12,
                            padding: '8px 12px',
                          }}
                          cursor={{ stroke: 'var(--neutral-200)', strokeWidth: 1 }}
                        />
                        {CHART_SERIES.map((s) => (
                          <Area
                            key={s.key}
                            type="monotone"
                            dataKey={s.key}
                            name={s.name}
                            stroke={s.color}
                            strokeWidth={s.dashed ? 1.5 : 2}
                            strokeDasharray={s.dashed ? '5 3' : undefined}
                            fill={`url(#${s.gradId})`}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                          />
                        ))}
                        <Area
                          type="monotone"
                          dataKey={SOLDE_SERIES.key}
                          name={SOLDE_SERIES.name}
                          stroke={SOLDE_SERIES.color}
                          strokeWidth={2.4}
                          dot={false}
                          connectNulls
                          fill="none"
                          fillOpacity={0}
                          activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        paddingTop: variant === 'embedded' ? 8 : 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          flexWrap: 'nowrap',
                          gap: 10,
                          fontSize: 9,
                          color: 'var(--neutral-500)',
                          fontFamily: 'var(--font-mono)',
                          whiteSpace: 'nowrap',
                          overflowX: 'auto',
                          maxWidth: '100%',
                        }}
                      >
                        {[...CHART_SERIES, SOLDE_SERIES].map((serie) => (
                          <span key={serie.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: serie.color, flexShrink: 0 }} />
                            <span>{serie.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

type LegacyAnnual2026MonthlyTableProps = {
  monthlyProfile: MonthlyBudget2026Point[]
}

export function Annual2026MonthlyTable({ monthlyProfile }: LegacyAnnual2026MonthlyTableProps) {
  return (
    <MonthlyFlowsAnalysisCard
      year={2026}
      monthlyProfile={monthlyProfile}
      initialView="table"
      showInternalViewToggle
      variant="standalone"
    />
  )
}

function IconHeader({ icon: Icon, color, label }: { icon: LucideIcon; color: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title={label}>
      <Icon size={14} color={color} strokeWidth={2.5} />
      <span style={{ fontSize: 9, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span>
    </div>
  )
}

const cardStyle: CSSProperties = {
  background: 'var(--neutral-0)',
  borderRadius: 'var(--radius-2xl)',
  boxShadow: 'var(--shadow-card)',
  border: '1px solid var(--neutral-150)',
  padding: 'var(--space-4) var(--space-3)',
}

const cardStyleEmbedded: CSSProperties = {
  background: 'transparent',
  borderRadius: 0,
  boxShadow: 'none',
  border: 'none',
  padding: 0,
}

const cardTitleStyle: CSSProperties = {
  margin: 0, fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)',
}

const thStyle: CSSProperties = {
  padding: '8px 2px', textAlign: 'left',
  borderBottom: '2px solid var(--neutral-50)',
  whiteSpace: 'nowrap',
  verticalAlign: 'bottom',
}

const tdStyle: CSSProperties = {
  padding: '9px 2px', fontSize: 11, color: 'var(--neutral-700)',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'clip',
}

const synthRowStyle: CSSProperties = {
  borderTop: '2px solid var(--neutral-300)',
}
