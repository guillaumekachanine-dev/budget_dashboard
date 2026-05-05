import { useState, type CSSProperties } from 'react'
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
import { useAuth } from '@/hooks/useAuth'
import { budgetDb } from '@/lib/supabaseBudget'

type Props = {
  monthlyProfile: MonthlyBudget2026Point[]
}

type MonthlySynthRow = {
  month: number
  monthLabel: string
  openingBalance: number
  budget: number
  expense: number
  income: number
  savings: number
  deltaRealBudgetPct: number
}

type TransactionRow = {
  account_id: string | null
  amount: number | null
  flow_type: string | null
  direction: string | null
  transaction_date: string | null
}

type AccountRow = {
  id: string
  opening_balance: number | null
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

function getLastCompletedMonthCutoff2026(): number {
  const now = new Date()
  if (now.getFullYear() < 2026) return 0
  if (now.getFullYear() > 2026) return 12
  return Math.max(0, Math.min(12, now.getMonth()))
}

function signedAmountFromTransaction(tx: TransactionRow): number {
  const amount = Number(tx.amount ?? 0)
  if (tx.flow_type === 'income') return amount
  if (tx.flow_type === 'expense') return -amount
  if (tx.direction === 'transfer_in') return amount
  if (tx.direction === 'transfer_out') return -amount
  return 0
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
  const { user, loading: authLoading } = useAuth()
  const tableMonthCutoff = getCurrentMonthCutoff2026()
  const chartMonthCutoff = getLastCompletedMonthCutoff2026()

  const fallbackRows: MonthlySynthRow[] = monthlyProfile.map((point) => ({
    month: point.month,
    monthLabel: point.monthLabel,
    openingBalance: 0,
    budget: Number(point.totalExpenseBudget ?? 0),
    expense: Number(point.totalExpenseBudget ?? 0),
    income: 0,
    savings: 0,
    deltaRealBudgetPct: 0,
  }))

  const { data: dbRows } = useQuery({
    queryKey: ['annual-2026-monthly-synth', tableMonthCutoff, user?.id ?? 'anon'],
    enabled: !authLoading && Boolean(user?.id),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MonthlySynthRow[]> => {
      const userId = user?.id
      if (!userId) return []

      const [metricsRes, bucketTotalsRes, savingsTotalsRes, accountsRes] = await Promise.all([
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
        budgetDb()
          .from('accounts')
          .select('id, opening_balance'),
      ])

      if (metricsRes.error) throw new Error(`monthly metrics query failed: ${metricsRes.error.message}`)
      if (bucketTotalsRes.error) throw new Error(`budget bucket totals query failed: ${bucketTotalsRes.error.message}`)
      if (savingsTotalsRes.error) throw new Error(`savings totals query failed: ${savingsTotalsRes.error.message}`)
      if (accountsRes.error) throw new Error(`accounts query failed: ${accountsRes.error.message}`)

      const accounts = (accountsRes.data ?? []) as AccountRow[]
      const accountIds = accounts.map((row) => row.id).filter((id): id is string => Boolean(id))

      const balancesRes = accountIds.length > 0
        ? await budgetDb()
            .from('accounts_balance')
            .select('account_id, balance_amount, created_at')
            .in('account_id', accountIds)
            .lte('created_at', '2026-12-31T23:59:59.999Z')
            .order('created_at', { ascending: true })
        : { data: [], error: null }

      if (balancesRes.error) throw new Error(`accounts_balance query failed: ${balancesRes.error.message}`)

      const transactionsRes = accountIds.length > 0
        ? await budgetDb()
            .from('transactions')
            .select('account_id, amount, flow_type, direction, transaction_date')
            .in('account_id', accountIds)
            .lt('transaction_date', '2027-01-01')
            .order('transaction_date', { ascending: true })
        : { data: [], error: null }

      if (transactionsRes.error) throw new Error(`transactions query failed: ${transactionsRes.error.message}`)

      const expenseByMonth = new Map<number, number>()
      const incomeByMonth = new Map<number, number>()
      const budgetByMonth = new Map<number, number>()
      const savingsByMonth = new Map<number, number>()
      const openingBalanceByMonth = new Map<number, number>()
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

      type BalanceRow = { account_id: string | null; balance_amount: number | null; created_at: string | null }
      const balanceRows = (balancesRes.data ?? []) as BalanceRow[]
      const balancesByAccount = new Map<string, Array<{ createdAtMs: number; amount: number }>>()

      for (const row of balanceRows) {
        const accountId = row.account_id ?? ''
        if (!accountId) continue
        const createdAtMs = row.created_at ? new Date(row.created_at).getTime() : Number.NaN
        if (!Number.isFinite(createdAtMs)) continue
        const amount = Number(row.balance_amount ?? 0)
        const list = balancesByAccount.get(accountId) ?? []
        list.push({ createdAtMs, amount })
        balancesByAccount.set(accountId, list)
      }

      const transactionsByAccount = new Map<string, Array<{ timestampMs: number; signedAmount: number }>>()
      const txRows = (transactionsRes.data ?? []) as TransactionRow[]

      for (const row of txRows) {
        const accountId = row.account_id ?? ''
        const transactionDate = row.transaction_date ?? ''
        if (!accountId || !transactionDate) continue
        const timestampMs = new Date(`${transactionDate}T00:00:00Z`).getTime()
        if (!Number.isFinite(timestampMs)) continue
        const signedAmount = signedAmountFromTransaction(row)
        const list = transactionsByAccount.get(accountId) ?? []
        list.push({ timestampMs, signedAmount })
        transactionsByAccount.set(accountId, list)
      }

      for (let month = 1; month <= tableMonthCutoff; month += 1) {
        const monthStartMs = new Date(Date.UTC(2026, month - 1, 1, 0, 0, 0, 0)).getTime()
        let totalOpeningBalance = 0
        let totalFallbackOpeningBalance = 0

        for (const account of accounts) {
          const accountId = account.id
          const accountBalances = balancesByAccount.get(accountId) ?? []
          let latestAmount: number | null = null
          for (const entry of accountBalances) {
            if (entry.createdAtMs <= monthStartMs) latestAmount = entry.amount
            else break
          }
          totalOpeningBalance += latestAmount ?? 0

          const txList = transactionsByAccount.get(accountId) ?? []
          let cumulative = 0
          for (const tx of txList) {
            if (tx.timestampMs < monthStartMs) cumulative += tx.signedAmount
            else break
          }
          totalFallbackOpeningBalance += Number(account.opening_balance ?? 0) + cumulative
        }

        const hasSnapshotForMonth = totalOpeningBalance !== 0
        openingBalanceByMonth.set(month, hasSnapshotForMonth ? totalOpeningBalance : totalFallbackOpeningBalance)
      }

      return [...monthSet]
        .sort((a, b) => a - b)
        .filter((month) => month <= tableMonthCutoff)
        .map((month) => {
          const budget = budgetByMonth.get(month) ?? 0
          const expense = expenseByMonth.get(month) ?? 0
          return {
            month,
            monthLabel: MONTH_LABELS[month - 1] ?? `M${month}`,
            openingBalance: openingBalanceByMonth.get(month) ?? 0,
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

  const chartRows = rows.filter((row) => row.month <= chartMonthCutoff)
  const chartData = chartRows.map((row) => ({
    label: row.monthLabel,
    budget: row.budget,
    expense: row.expense,
    income: row.income,
    savings: row.savings,
  }))
  const overflowIncomeRows = chartRows.filter((row) => row.income > CHART_MAX_Y)

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
                  style={{ overflowX: 'hidden', margin: 0 }}
                >
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
                          <div style={{ display: 'grid', justifyItems: 'start', gap: 2 }} title="Mois">
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
                            <td style={{ ...tdStyle, textAlign: 'right', paddingRight: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--neutral-700)' }}>
                              {fmt(row.openingBalance)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', paddingRight: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#E57373' }}>
                              {fmt(row.expense)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', paddingRight: 'var(--space-3)', fontFamily: 'var(--font-mono)', color: '#81C784', fontWeight: 600 }}>
                              {fmt(row.income)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', paddingRight: 'var(--space-2)', fontFamily: 'var(--font-mono)', color: deltaColor, fontWeight: 700 }}>
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
    <div style={{ display: 'grid', justifyItems: 'center', gap: 2 }} title={label}>
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
  padding: '8px 2px', textAlign: 'left',
  borderBottom: '2px solid var(--neutral-50)',
  whiteSpace: 'nowrap',
  verticalAlign: 'bottom',
}

const tdStyle: CSSProperties = {
  padding: '12px 2px', fontSize: 11, color: 'var(--neutral-700)',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'clip',
}
