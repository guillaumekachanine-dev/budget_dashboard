import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Target } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useTransactions } from '@/hooks/useTransactions'
import { getCurrentPeriod, getMonthLabel, formatCurrency, getCategoryColor, clamp } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import type { Category } from '@/lib/types'

type Period = 'month' | 'quarter' | 'year'

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const SAVINGS_GOAL = 20000

function getDateRange(period: Period) {
  const now = new Date()
  switch (period) {
    case 'month': return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
      endDate: now.toISOString().slice(0, 10),
    }
    case 'quarter': return {
      startDate: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10),
      endDate: now.toISOString().slice(0, 10),
    }
    case 'year': return {
      startDate: new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10),
      endDate: now.toISOString().slice(0, 10),
    }
  }
}

const tooltipStyle = {
  background: '#fff',
  border: 'none',
  borderRadius: 12,
  boxShadow: '0 4px 16px rgba(28,28,58,0.12)',
  padding: '8px 12px',
  fontSize: 12,
  fontFamily: 'DM Mono',
}

export function Stats() {
  const [period, setPeriod] = useState<Period>('month')
  const { year, month } = getCurrentPeriod()
  const range = getDateRange(period)

  /* ── Chart data ─────────────────────────────────────────── */
  const { data: txns }    = useTransactions({ ...range })
  const { data: allTxns } = useTransactions({
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  })
  const { data: expenseCategories = [] } = useCategories('expense')

  const categoryById = useMemo(
    () => new Map(expenseCategories.map((c) => [c.id, c])),
    [expenseCategories],
  )

  // Expenses by category (pie)
  const expenses = (txns ?? []).filter((t) => t.flow_type === 'expense')
  const byCat = expenses.reduce<Record<string, { name: string; value: number; color: string }>>(
    (acc, t) => {
      const txCategory = t.category ?? null
      const parentCategory: Category | null = txCategory?.parent_id
        ? (categoryById.get(txCategory.parent_id) ?? null)
        : null
      const displayCategory = parentCategory ?? txCategory

      const catId   = displayCategory?.id ?? t.category_id ?? 'other'
      const catName = displayCategory?.name ?? 'Autre'
      const catColorToken = displayCategory?.color_token ?? txCategory?.color_token ?? null

      if (!acc[catId]) {
        acc[catId] = {
          name: catName,
          value: 0,
          color: getCategoryColor(catColorToken, Object.keys(acc).length),
        }
      }
      acc[catId].value += Number(t.amount)
      return acc
    },
    {},
  )
  const pieData = Object.values(byCat).sort((a, b) => b.value - a.value)

  // Monthly income vs expenses
  const monthlyData = MONTHS_FR.map((label, i) => {
    const monthTxns = (allTxns ?? []).filter((t) => {
      const d = new Date(t.transaction_date)
      return d.getMonth() === i && d.getFullYear() === year
    })
    return {
      label,
      income:  monthTxns.filter((t) => t.flow_type === 'income').reduce((s, t) => s + Number(t.amount), 0),
      expense: monthTxns.filter((t) => t.flow_type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    }
  }).slice(0, month)

  // Daily net cumulated
  const dailyData = (txns ?? [])
    .filter((t) => ['income', 'expense'].includes(t.flow_type))
    .reduce<Record<string, number>>((acc, t) => {
      const d     = t.transaction_date
      const delta = t.flow_type === 'income' ? Number(t.amount) : -Number(t.amount)
      acc[d] = (acc[d] ?? 0) + delta
      return acc
    }, {})

  const dailyTrend = Object.entries(dailyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce<{ date: string; cumul: number }[]>((acc, [date, delta]) => {
      const prev = acc[acc.length - 1]?.cumul ?? 0
      acc.push({ date: date.slice(5), cumul: prev + delta })
      return acc
    }, [])

  /* ── Savings data ─────────────────────────────────────────── */
  const { data: accounts, isLoading: loadingAccounts } = useAccounts()
  const savingsAccounts = (accounts ?? []).filter((a) => a.account_type === 'savings')
  const totalSavings    = savingsAccounts.reduce((s, a) => s + a.current_balance, 0)
  const goalPct         = clamp((totalSavings / SAVINGS_GOAL) * 100, 0, 100)

  const { data: savingsTxns, isLoading: loadingTxns } = useTransactions({
    startDate: `${year}-01-01`,
    endDate: new Date().toISOString().slice(0, 10),
    flowType: 'savings',
  })
  const savedThisYear = (savingsTxns ?? []).reduce((s, t) => s + Number(t.amount), 0)
  const avgMonthly    = month > 0 ? savedThisYear / month : 0
  const projectedEOY  = totalSavings + avgMonthly * (12 - month)

  const monthlyBarData = Array.from({ length: month }, (_, i) => {
    const m = i + 1
    const monthTxns = (savingsTxns ?? []).filter((t) => {
      const d = new Date(t.transaction_date)
      return d.getMonth() + 1 === m
    })
    return { month: m, amount: monthTxns.reduce((s, t) => s + Number(t.amount), 0) }
  })

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-nav">

      {/* ── Header ───────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-widest mb-0.5">
          {getMonthLabel(year, month)}
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neutral-900">Stats</h1>
          <div className="flex bg-neutral-100 rounded-full p-0.5 gap-0.5">
            {(['month', 'quarter', 'year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  period === p ? 'bg-primary-500 text-white shadow-sm' : 'text-neutral-400'
                }`}
              >
                {p === 'month' ? 'Mois' : p === 'quarter' ? 'Trim.' : 'An'}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Dépenses par catégorie (pie) ─────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-3xl shadow-card p-4"
      >
        <h2 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-4">
          Dépenses par catégorie
        </h2>
        {pieData.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-8">Aucune donnée</p>
        ) : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => formatCurrency(v)}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              {pieData.slice(0, 5).map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <CategoryIcon categoryName={d.name} size={14} fallback="💰" />
                    <span className="text-xs text-neutral-600 truncate">{d.name}</span>
                  </div>
                  <span className="font-amount text-xs font-semibold text-neutral-800 flex-shrink-0">
                    {formatCurrency(d.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Revenus vs Dépenses ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-3xl shadow-card p-4"
      >
        <h2 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-4">
          Revenus vs Dépenses {year}
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData} barSize={8} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EBEBF5" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9898B3' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
            <Bar dataKey="income"  fill="#2ED47A" radius={[4, 4, 0, 0]} name="Revenus"   />
            <Bar dataKey="expense" fill="#5B57F5" radius={[4, 4, 0, 0]} name="Dépenses"  />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* ── Flux net cumulé ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-3xl shadow-card p-4"
      >
        <h2 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-4">
          Flux net cumulé
        </h2>
        {dailyTrend.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-8">Aucune donnée</p>
        ) : (
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={dailyTrend}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#5B57F5" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#5B57F5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => formatCurrency(v)}
                labelFormatter={(l) => `Date : ${l}`}
              />
              <Area
                type="monotone"
                dataKey="cumul"
                stroke="#5B57F5"
                strokeWidth={2}
                fill="url(#areaGrad)"
                dot={false}
                name="Flux net"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* ── Épargne ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="relative overflow-hidden rounded-3xl p-5 text-white"
        style={{ background: 'linear-gradient(135deg, #2ED47A 0%, #00B894 100%)' }}
      >
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/[0.08]" />
        <div className="absolute right-10 -bottom-10 w-32 h-32 rounded-full bg-white/[0.06]" />
        <div className="relative z-10">
          <p className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Épargne totale</p>
          <p className="font-amount text-4xl font-bold tracking-tight mb-4">
            {formatCurrency(totalSavings)}
          </p>
          <div className="mb-1 flex justify-between text-[11px] opacity-70">
            <span>Objectif {formatCurrency(SAVINGS_GOAL)}</span>
            <span>{goalPct.toFixed(0)}%</span>
          </div>
          <div className="h-[5px] bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${goalPct}%` }}
              transition={{ delay: 0.5, duration: 0.7 }}
              className="h-full bg-white rounded-full"
            />
          </div>
        </div>
      </motion.div>

      {/* ── KPI épargne ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 -mt-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-white rounded-2xl shadow-card p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-positive" />
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide">Épargné {year}</p>
          </div>
          <p className="font-amount text-xl font-bold text-neutral-900">{formatCurrency(savedThisYear)}</p>
          <p className="text-xs text-neutral-400 mt-1">{formatCurrency(avgMonthly)}/mois en moy.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl shadow-card p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} className="text-primary-500" />
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide">Projection {year}</p>
          </div>
          <p className="font-amount text-xl font-bold text-neutral-900">{formatCurrency(projectedEOY)}</p>
          <p className="text-xs text-neutral-400 mt-1">Au rythme actuel</p>
        </motion.div>
      </div>

      {/* ── Comptes d'épargne ─────────────────────────────────── */}
      {loadingAccounts ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="bg-white rounded-3xl shadow-card p-4 -mt-3">
          <h2 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-3">
            Comptes d'épargne
          </h2>
          {savingsAccounts.length === 0 ? (
            <p className="text-sm text-neutral-400 py-2">Aucun compte épargne configuré.</p>
          ) : (
            savingsAccounts.map((account, i) => (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 * i }}
                className="flex items-center justify-between py-3 border-b border-neutral-100 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-700">{account.name}</p>
                  <p className="text-xs text-neutral-400">{account.institution_name}</p>
                </div>
                <p className="font-amount font-bold text-neutral-900">
                  {formatCurrency(account.current_balance, account.currency)}
                </p>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ── Historique épargne mensuel ────────────────────────── */}
      {!loadingTxns && monthlyBarData.some((m) => m.amount > 0) && (
        <div className="bg-white rounded-3xl shadow-card p-4 -mt-3">
          <h2 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-3">
            Épargne mensuelle {year}
          </h2>
          <div className="flex items-end gap-2 h-20">
            {monthlyBarData.map((m, i) => {
              const maxVal = Math.max(...monthlyBarData.map((x) => x.amount), 1)
              const h = clamp((m.amount / maxVal) * 100, 4, 100)
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: 0.05 * i, duration: 0.4 }}
                    className="w-full rounded-t-md"
                    style={{ height: `${h}%`, background: 'var(--primary-200)' }}
                  />
                  <span className="text-[9px] text-neutral-400">
                    {['J','F','M','A','M','J','J','A','S','O','N','D'][i]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
