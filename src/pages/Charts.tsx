import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useTransactions } from '@/hooks/useTransactions'
import { getCurrentPeriod, getMonthLabel, formatCurrency, getCategoryColor } from '@/lib/utils'

type Period = 'month' | 'quarter' | 'year'

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

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

export function Charts() {
  const [period, setPeriod] = useState<Period>('month')
  const { year, month } = getCurrentPeriod()
  const range = getDateRange(period)

  const { data: txns } = useTransactions({ ...range })
  const { data: allTxns } = useTransactions({
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  })

  // Expenses by category (pie)
  const expenses = (txns ?? []).filter((t) => t.flow_type === 'expense')
  const byCat = expenses.reduce<Record<string, { name: string; value: number; color: string; icon: string }>>((acc, t) => {
    const catId = t.category_id ?? 'other'
    const catName = t.category?.name ?? 'Autre'
    const catIcon = t.category?.icon_name ?? '💰'
    if (!acc[catId]) {
      acc[catId] = { name: catName, value: 0, color: getCategoryColor(t.category?.color_token ?? null, Object.keys(acc).length), icon: catIcon }
    }
    acc[catId].value += Number(t.amount)
    return acc
  }, {})
  const pieData = Object.values(byCat).sort((a, b) => b.value - a.value)

  // Monthly income vs expenses
  const monthlyData = MONTHS_FR.map((label, i) => {
    const monthTxns = (allTxns ?? []).filter((t) => {
      const d = new Date(t.transaction_date)
      return d.getMonth() === i && d.getFullYear() === year
    })
    return {
      label,
      income: monthTxns.filter((t) => t.flow_type === 'income').reduce((s, t) => s + Number(t.amount), 0),
      expense: monthTxns.filter((t) => t.flow_type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    }
  }).slice(0, month)

  // Daily balance trend
  const dailyData = (txns ?? [])
    .filter((t) => ['income', 'expense'].includes(t.flow_type))
    .reduce<Record<string, number>>((acc, t) => {
      const d = t.transaction_date
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

  const tooltipStyle = {
    background: '#fff',
    border: 'none',
    borderRadius: 12,
    boxShadow: '0 4px 16px rgba(28,28,58,0.12)',
    padding: '8px 12px',
    fontSize: 12,
    fontFamily: 'DM Mono',
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-nav">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-widest mb-0.5">
          {getMonthLabel(year, month)}
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neutral-900">Charts</h1>
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

      {/* Dépenses par catégorie */}
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
                <Pie data={pieData} dataKey="value" innerRadius={40} outerRadius={65} paddingAngle={2} startAngle={90} endAngle={-270}>
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
                  <span className="text-xs text-neutral-600 truncate flex-1">{d.icon} {d.name}</span>
                  <span className="font-amount text-xs font-semibold text-neutral-800 flex-shrink-0">
                    {formatCurrency(d.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Revenus vs Dépenses par mois */}
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
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number) => formatCurrency(v)}
            />
            <Bar dataKey="income" fill="#2ED47A" radius={[4, 4, 0, 0]} name="Revenus" />
            <Bar dataKey="expense" fill="#5B57F5" radius={[4, 4, 0, 0]} name="Dépenses" />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Flux net cumulé */}
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
                  <stop offset="5%" stopColor="#5B57F5" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#5B57F5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => formatCurrency(v)}
                labelFormatter={(l) => `Date: ${l}`}
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
    </div>
  )
}
