import { motion } from 'framer-motion'
import { TrendingUp, Target } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { getCurrentPeriod, getMonthLabel, formatCurrency, clamp } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

const SAVINGS_GOAL = 20000

export function Epargne() {
  const { year, month } = getCurrentPeriod()
  const { data: accounts, isLoading: loadingAccounts } = useAccounts()

  const savingsAccounts = (accounts ?? []).filter((a) => a.account_type === 'savings')
  const totalSavings = savingsAccounts.reduce((s, a) => s + a.current_balance, 0)
  const goalPct = clamp((totalSavings / SAVINGS_GOAL) * 100, 0, 100)

  const { data: savingsTxns, isLoading: loadingTxns } = useTransactions({
    startDate: `${year}-01-01`,
    endDate: new Date().toISOString().slice(0, 10),
    flowType: 'savings',
  })

  const savedThisYear = (savingsTxns ?? []).reduce((s, t) => s + Number(t.amount), 0)
  const avgMonthly = month > 0 ? savedThisYear / month : 0
  const projectedEOY = totalSavings + avgMonthly * (12 - month)

  const monthlyData = Array.from({ length: month }, (_, i) => {
    const m = i + 1
    const monthTxns = (savingsTxns ?? []).filter((t) => {
      const d = new Date(t.transaction_date)
      return d.getMonth() + 1 === m
    })
    return {
      month: m,
      amount: monthTxns.reduce((s, t) => s + Number(t.amount), 0),
    }
  })

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-nav">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-widest mb-0.5">
          {getMonthLabel(year, month)}
        </p>
        <h1 className="text-2xl font-bold text-neutral-900">Épargne</h1>
      </motion.div>

      {/* Total savings hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative overflow-hidden rounded-3xl p-5 text-white"
        style={{ background: 'linear-gradient(135deg, #2ED47A 0%, #00B894 100%)' }}
      >
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/[0.08]" />
        <div className="relative z-10">
          <p className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Épargne totale</p>
          <p className="font-amount text-4xl font-bold tracking-tight mb-4">
            {formatCurrency(totalSavings)}
          </p>

          {/* Goal progress */}
          <div className="mb-1 flex justify-between text-[11px] opacity-70">
            <span>Objectif {formatCurrency(SAVINGS_GOAL)}</span>
            <span>{goalPct.toFixed(0)}%</span>
          </div>
          <div className="h-[5px] bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${goalPct}%` }}
              transition={{ delay: 0.4, duration: 0.7 }}
              className="h-full bg-white rounded-full"
            />
          </div>
        </div>
      </motion.div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-card p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-positive" />
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide">Épargné {year}</p>
          </div>
          <p className="font-amount text-xl font-bold text-neutral-900">
            {formatCurrency(savedThisYear)}
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            {formatCurrency(avgMonthly)}/mois en moy.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl shadow-card p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} className="text-primary-500" />
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide">Projection fin {year}</p>
          </div>
          <p className="font-amount text-xl font-bold text-neutral-900">
            {formatCurrency(projectedEOY)}
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            Au rythme actuel
          </p>
        </motion.div>
      </div>

      {/* Savings accounts */}
      {loadingAccounts ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="bg-white rounded-3xl shadow-card p-4">
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
                transition={{ delay: 0.1 * i }}
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

      {/* Monthly savings history */}
      {!loadingTxns && monthlyData.some((m) => m.amount > 0) && (
        <div className="bg-white rounded-3xl shadow-card p-4">
          <h2 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-3">
            Épargne mensuelle {year}
          </h2>
          <div className="flex items-end gap-2 h-20">
            {monthlyData.map((m, i) => {
              const maxVal = Math.max(...monthlyData.map((x) => x.amount), 1)
              const h = clamp((m.amount / maxVal) * 100, 4, 100)
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: 0.05 * i, duration: 0.4 }}
                    className="w-full rounded-t-md bg-primary-200"
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-[9px] text-neutral-400">{['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
