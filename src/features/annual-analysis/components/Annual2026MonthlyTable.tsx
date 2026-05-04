import { useState, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  PiggyBank, 
  Zap,
  LayoutList,
  LineChart as LineChartIcon,
  type LucideIcon,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyBudget2026Point } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { budgetDb } from '@/lib/supabaseBudget'

type Props = {
  monthlyProfile: MonthlyBudget2026Point[]
}

type MonthlySynthRow = {
  month: number
  monthLabel: string
  budget: number
  expense: number
  income: number
  savings: number
  deltaRealBudgetPct: number
}

const fmt = (n: number) => {
  const val = Math.round(n).toLocaleString('fr-FR')
  return `${val}€`
}

const fmtPct = (r: number) => {
  const val = (r * 100).toFixed(1)
  return `${val}%`
}

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function getCurrentMonthCutoff2026(): number {
  const now = new Date()
  if (now.getFullYear() < 2026) return 0
  if (now.getFullYear() > 2026) return 12
  return Math.max(1, Math.min(12, now.getMonth() + 1))
}

const CHART_SERIES = [
  { key: 'budget',  name: 'Budget',   color: '#5B57F5', gradId: 'gBudget', dashed: true },
  { key: 'expense', name: 'Dépenses', color: '#FC5A5A', gradId: 'gExp', dashed: false },
  { key: 'income',  name: 'Revenus',  color: '#2ED47A', gradId: 'gInc', dashed: false },
  { key: 'savings', name: 'Épargne',  color: '#FFAB2E', gradId: 'gSav', dashed: false },
]
const CHART_MAX_Y = 8000

export function Annual2026MonthlyTable({ monthlyProfile }: Props) {
  const [activeSlide, setActiveSlide] = useState<'table' | 'chart'>('table')
  const monthCutoff = getCurrentMonthCutoff2026()

  const fallbackRows: MonthlySynthRow[] = monthlyProfile.map((point) => ({
    month: point.month,
    monthLabel: point.monthLabel,
    budget: Number(point.totalExpenseBudget ?? 0),
    expense: Number(point.totalExpenseBudget ?? 0),
    income: 0,
    savings: 0,
    deltaRealBudgetPct: 0,
  }))

  const { data: dbRows } = useQuery({
    queryKey: ['annual-2026-monthly-synth', monthCutoff],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MonthlySynthRow[]> => {
      const [metricsRes, bucketTotalsRes, savingsTotalsRes] = await Promise.all([
        budgetDb()
          .from('analytics_monthly_metrics')
          .select('period_month, expense_total, income_total')
          .eq('period_year', 2026)
          .order('period_month', { ascending: true }),
        budgetDb()
          .from('budget_bucket_totals_by_period')
          .select('period_month, total_budget_bucket_eur')
          .eq('period_year', 2026),
        budgetDb()
          .from('savings_budget_totals_by_period')
          .select('period_month, total_savings_budget_eur')
          .eq('period_year', 2026),
      ])

      if (metricsRes.error) throw new Error(`monthly metrics query failed: ${metricsRes.error.message}`)
      if (bucketTotalsRes.error) throw new Error(`budget bucket totals query failed: ${bucketTotalsRes.error.message}`)
      if (savingsTotalsRes.error) throw new Error(`savings totals query failed: ${savingsTotalsRes.error.message}`)

      const expenseByMonth = new Map<number, number>()
      const incomeByMonth = new Map<number, number>()
      const budgetByMonth = new Map<number, number>()
      const savingsByMonth = new Map<number, number>()
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

      for (const row of savingsTotalsRes.data ?? []) {
        const month = Number(row.period_month ?? 0)
        if (!Number.isFinite(month) || month <= 0) continue
        monthSet.add(month)
        savingsByMonth.set(month, Number(row.total_savings_budget_eur ?? 0))
      }

      return [...monthSet]
        .sort((a, b) => a - b)
        .filter((month) => month <= monthCutoff)
        .map((month) => {
          const budget = budgetByMonth.get(month) ?? 0
          const expense = expenseByMonth.get(month) ?? 0
          return {
            month,
            monthLabel: MONTH_LABELS[month - 1] ?? `M${month}`,
            budget,
            expense,
            income: incomeByMonth.get(month) ?? 0,
            savings: savingsByMonth.get(month) ?? 0,
            deltaRealBudgetPct: budget > 0 ? (expense - budget) / budget : 0,
          }
        })
    },
  })

  const rows = (dbRows && dbRows.length > 0 ? dbRows : fallbackRows).filter((row) => row.month <= monthCutoff)
  if (rows.length === 0) return null

  const chartData = rows.map((row) => ({
    label: row.monthLabel,
    budget: row.budget,
    expense: row.expense,
    income: row.income,
    savings: row.savings,
  }))
  const overflowIncomeRows = rows.filter((row) => row.income > CHART_MAX_Y)

  return (
    <div style={{ padding: '0 var(--space-4)' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div>
              <h3 style={cardTitleStyle}>Vue mensuelle synthétique</h3>
              <p style={cardSubStyle}>Analyse des flux mensuels</p>
            </div>
            
            {/* Carousel Toggle */}
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
                  background: activeSlide === 'table' ? 'var(--neutral-0)' : 'transparent',
                  padding: '4px 8px',
                  borderRadius: 'calc(var(--radius-lg) - 2px)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: activeSlide === 'table' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                <LayoutList size={14} color={activeSlide === 'table' ? 'var(--primary-600)' : 'var(--neutral-500)'} />
              </button>
              <button 
                onClick={() => setActiveSlide('chart')}
                style={{
                  border: 'none',
                  background: activeSlide === 'chart' ? 'var(--neutral-0)' : 'transparent',
                  padding: '4px 8px',
                  borderRadius: 'calc(var(--radius-lg) - 2px)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: activeSlide === 'chart' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                <LineChartIcon size={14} color={activeSlide === 'chart' ? 'var(--primary-600)' : 'var(--neutral-500)'} />
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', overflow: 'hidden', minHeight: 300 }}>
            <AnimatePresence mode="wait">
              {activeSlide === 'table' ? (
                <motion.div
                  key="table"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflowX: 'auto', margin: '0 -2px' }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 300 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, ...cardSubStyle, margin: 0 }}>Mois</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>
                          <IconHeader icon={ArrowUpCircle} color="#E57373" label="Dépenses" />
                        </th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>
                          <IconHeader icon={ArrowDownCircle} color="#81C784" label="Revenus" />
                        </th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>
                          <IconHeader icon={PiggyBank} color="#FFAB2E" label="Épargne" />
                        </th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>
                          <IconHeader icon={Zap} color="var(--neutral-400)" label="% Écart réel/budget" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const deltaColor = row.deltaRealBudgetPct > 0 ? '#E57373' : '#81C784'
                        const deltaPrefix = row.deltaRealBudgetPct > 0 ? '+' : ''
                        return (
                          <tr key={row.month} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                            <td style={{ ...tdStyle, paddingLeft: 'var(--space-2)', textAlign: 'center' }}>
                              <span style={{ fontWeight: 600, color: 'var(--neutral-700)', fontSize: 11 }}>{row.monthLabel}</span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#E57373' }}>
                              {fmt(row.expense)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#81C784', fontWeight: 600 }}>
                              {fmt(row.income)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--neutral-400)' }}>
                              {fmt(row.savings)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', color: deltaColor, paddingRight: 'var(--space-2)', fontWeight: 700 }}>
                              {deltaPrefix}{fmtPct(row.deltaRealBudgetPct)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
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
                    <ResponsiveContainer width="100%" height={260}>
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
                          tick={{ fontSize: 10, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                          domain={[0, CHART_MAX_Y]}
                          allowDataOverflow
                          tickCount={5}
                          tickFormatter={(v: number) => `${Math.round(v).toLocaleString('fr-FR')}€`}
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
                        <Legend
                          wrapperStyle={{
                            fontSize: 10,
                            paddingTop: 14,
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--neutral-500)',
                          }}
                          iconType="circle"
                          iconSize={7}
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
                        {overflowIncomeRows.map((row, idx) => (
                          <ReferenceDot
                            key={`overflow-income-${row.month}`}
                            x={row.monthLabel}
                            y={CHART_MAX_Y}
                            r={3.5}
                            fill="#2ED47A"
                            stroke="#2ED47A"
                            isFront
                            label={idx === 0 ? {
                              value: 'hors échelle',
                              position: 'top',
                              fill: 'var(--neutral-500)',
                              fontSize: 10,
                              fontFamily: 'var(--font-sans)',
                              fontWeight: 600,
                            } : undefined}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
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

function IconHeader({ icon: Icon, color, label }: { icon: LucideIcon; color: string; label: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }} title={label}>
      <Icon size={14} color={color} strokeWidth={2.5} />
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

const cardTitleStyle: CSSProperties = {
  margin: 0, fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)',
}

const cardSubStyle: CSSProperties = {
  margin: '2px 0 0', fontSize: 10,
  color: 'var(--neutral-400)', textTransform: 'uppercase',
  letterSpacing: '0.05em', fontWeight: 600,
}


const thStyle: CSSProperties = {
  padding: '12px 2px', textAlign: 'left',
  borderBottom: '2px solid var(--neutral-50)',
  whiteSpace: 'nowrap',
}

const tdStyle: CSSProperties = {
  padding: '10px 2px', fontSize: 11, color: 'var(--neutral-700)',
  verticalAlign: 'middle',
}
