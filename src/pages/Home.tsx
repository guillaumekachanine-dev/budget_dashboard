import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Settings, ArrowUpRight, Sparkles, Calendar, Target } from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { Badge, Button, Card, KpiCard } from '@/components'
import { useAccounts } from '@/hooks/useAccounts'
import { useBudgetSummaries } from '@/hooks/useBudgets'
import {
  formatCurrency,
  getCurrentPeriod,
  getDaysRemainingInMonth,
  getMonthLabel,
} from '@/lib/utils'
import type { AccountWithBalance } from '@/lib/types'
import { useTransactions } from '@/hooks/useTransactions'

export function Home() {
  const { year, month } = getCurrentPeriod()
  const { data: accounts, isLoading: loadingAccounts } = useAccounts()
  const { data: summaries, isLoading: loadingSummaries } = useBudgetSummaries(year, month)

  const totalBudget = summaries?.reduce((s, b) => s + b.budget_amount, 0) ?? 0

  const now = new Date()
  const todayIso = now.toISOString().slice(0, 10)
  const monthStart = new Date(year, month - 1, 1).toISOString().slice(0, 10)
  const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10)
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysElapsed = now.getDate()
  const daysRemaining = getDaysRemainingInMonth()

  const { data: monthExpenseTxns } = useTransactions({
    startDate: monthStart,
    endDate: monthEnd,
    flowType: 'expense',
  })

  const realToDate = useMemo(() => {
    const rows = monthExpenseTxns ?? []
    return rows
      .filter((t) => t.transaction_date <= todayIso)
      .reduce((sum, t) => sum + Number(t.amount), 0)
  }, [monthExpenseTxns, todayIso])

  const plannedFuture = useMemo(() => {
    const rows = monthExpenseTxns ?? []
    return rows
      .filter((t) => t.is_recurring && t.transaction_date > todayIso)
      .reduce((sum, t) => sum + Number(t.amount), 0)
  }, [monthExpenseTxns, todayIso])

  const resteUtile = useMemo(() => {
    return Math.max(0, totalBudget - realToDate - plannedFuture)
  }, [plannedFuture, realToDate, totalBudget])

  const budgetParJour = useMemo(() => {
    if (daysRemaining <= 0) return 0
    return resteUtile / daysRemaining
  }, [daysRemaining, resteUtile])

  const previsionFinDeMois = useMemo(() => {
    if (plannedFuture > 0) return realToDate + plannedFuture
    if (daysElapsed <= 0) return realToDate
    return (realToDate / daysElapsed) * daysInMonth
  }, [daysElapsed, daysInMonth, plannedFuture, realToDate])

  const trajectoryData = useMemo(() => {
    const txns = monthExpenseTxns ?? []
    const daily = new Map<number, number>()
    txns.forEach((t) => {
      if (t.transaction_date < monthStart || t.transaction_date > monthEnd) return
      const day = Number(t.transaction_date.slice(8, 10))
      if (!Number.isFinite(day)) return
      if (t.transaction_date > todayIso) return
      daily.set(day, (daily.get(day) ?? 0) + Number(t.amount))
    })

    let cumul = 0
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      cumul += daily.get(day) ?? 0
      const planned = daysInMonth > 0 ? (totalBudget / daysInMonth) * day : 0
      return {
        day,
        planned,
        actual: day <= daysElapsed ? cumul : null,
        delta: day <= daysElapsed ? cumul - planned : null,
      }
    })
  }, [daysElapsed, daysInMonth, monthEnd, monthExpenseTxns, monthStart, todayIso, totalBudget])

  const plannedToDate = useMemo(() => {
    return daysElapsed > 0 ? (totalBudget / daysInMonth) * daysElapsed : 0
  }, [daysElapsed, daysInMonth, totalBudget])

  const deltaPct = useMemo(() => {
    if (plannedToDate <= 0) return null
    return ((realToDate - plannedToDate) / plannedToDate) * 100
  }, [plannedToDate, realToDate])

  const spendVsForecastPct = useMemo(() => {
    if (plannedToDate <= 0) return null
    return Math.max(0, Math.min(100, (realToDate / plannedToDate) * 100))
  }, [plannedToDate, realToDate])

  const driftCategories = useMemo(() => {
    const rows = summaries ?? []
    return [...rows]
      .filter((r) => r.budget_amount > 0)
      .map((r) => ({
        id: r.category.id,
        name: r.category.name,
        spent: r.spent_amount,
        driftPct: (r.spent_amount / r.budget_amount) * 100 - 100,
      }))
      .sort((a, b) => b.driftPct - a.driftPct)
      .slice(0, 6)
  }, [summaries])

  const selectedAccount = useMemo<AccountWithBalance | null>(() => {
    if (!accounts?.length) return null
    return (
      accounts.find((a) => a.name === 'Compte courant principal') ??
      accounts.find((a) => a.account_type === 'checking' && a.name.toLowerCase().includes('principal')) ??
      accounts.find((a) => a.account_type === 'checking') ??
      accounts[0] ??
      null
    )
  }, [accounts])

  const heroMetrics = useMemo(
    () => [
      {
        key: 'reste',
        label: 'Reste utile',
        value: formatCurrency(resteUtile),
        badgeText: deltaPct != null && deltaPct <= 0 ? 'Sous contrôle' : 'À surveiller',
        badgeVariant: (deltaPct != null && deltaPct <= 0 ? 'success' : 'warning') as
          | 'success'
          | 'warning',
      },
      {
        key: 'jour',
        label: 'Budget / jour',
        value: formatCurrency(budgetParJour),
        badgeText: `${daysRemaining} jours`,
        badgeVariant: 'neutral' as const,
      },
      {
        key: 'avenir',
        label: 'Dépenses à venir',
        value: formatCurrency(plannedFuture),
        badgeText: plannedFuture > 0 ? 'Planifiées' : 'Aucune',
        badgeVariant: (plannedFuture > 0 ? 'warning' : 'success') as 'warning' | 'success',
      },
      {
        key: 'fin',
        label: 'Fin de mois',
        value: formatCurrency(previsionFinDeMois),
        badgeText: deltaPct != null && deltaPct > 0 ? 'Risque de dépassement' : 'Prévision stable',
        badgeVariant: (deltaPct != null && deltaPct > 0 ? 'error' : 'success') as
          | 'error'
          | 'success',
      },
    ],
    [budgetParJour, daysRemaining, deltaPct, plannedFuture, previsionFinDeMois, resteUtile],
  )

  const driftRows = useMemo(
    () =>
      driftCategories.map((c) => ({
        id: c.id,
        name: c.name,
        spent: c.spent,
        driftPct: c.driftPct,
      })),
    [driftCategories],
  )

  const quickActions = useMemo(
    () => [
      { label: 'NLP', icon: Sparkles },
      { label: 'Plan', icon: Calendar },
      { label: 'Objectifs', icon: Target },
      { label: 'Export', icon: ArrowUpRight },
    ],
    [],
  )

  const trajectoryDeltaVariant =
    deltaPct == null ? 'neutral' : deltaPct <= 0 ? 'success' : deltaPct > 12 ? 'error' : 'warning'

  return (
    <div className="flex flex-col gap-[var(--space-4)] px-[var(--space-6)] pb-[calc(90px+env(safe-area-inset-bottom,0px))] pt-[var(--space-6)]">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-center justify-between gap-3"
      >
        <p className="m-0 text-[13px] font-extrabold text-[var(--neutral-900)]">
          Bonjour · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Paramètres"
          onClick={() => {}}
          className="h-10 w-10 rounded-full border border-[var(--neutral-200)] bg-[var(--neutral-0)] px-0 text-[var(--neutral-700)] shadow-[var(--shadow-sm)]"
        >
          <Settings size={18} />
        </Button>
      </motion.div>

      <Card
        variant="elevated"
        padding="md"
        className="bg-[var(--primary-500)] text-white"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <KpiCard
              label="Solde"
              value={selectedAccount?.current_balance ?? 0}
              format="currency"
              subtitle={`${daysRemaining} jours restants dans le mois`}
              className="flex-1 border border-white/15 bg-transparent p-0 shadow-none [&_p]:text-white [&_span]:text-white"
            />
            <Badge variant={trajectoryDeltaVariant}>
              {spendVsForecastPct == null ? '—' : `${Math.round(spendVsForecastPct)}% vs prév.`}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {heroMetrics.map((metric) => (
              <Card key={metric.key} variant="default" padding="sm" className="bg-white shadow-none">
                <div className="flex flex-col gap-2">
                  <p className="m-0 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--neutral-400)]">
                    {metric.label}
                  </p>
                  <p className="m-0 text-[16px] font-extrabold text-[var(--neutral-900)] [font-family:var(--font-mono)]">
                    {metric.value}
                  </p>
                  <Badge variant={metric.badgeVariant}>{metric.badgeText}</Badge>
                </div>
              </Card>
            ))}
          </div>

          <p className="m-0 text-[11px] font-semibold text-white/80">
            {loadingAccounts ? 'Chargement du solde…' : selectedAccount ? selectedAccount.name : 'Aucun compte sélectionné'}
          </p>
        </div>
      </Card>

      <Card variant="default" padding="md" className="overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--neutral-400)]">Trajectoire</p>
            <p className="mt-1 m-0 text-[14px] font-bold text-[var(--neutral-700)]">Projection mensuelle des dépenses</p>
          </div>
          <Badge variant={trajectoryDeltaVariant}>
            {deltaPct == null ? '—' : `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%`}
          </Badge>
        </div>

        <div className="mt-4 h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trajectoryData}>
              <defs>
                <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary-500)" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="var(--primary-500)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--neutral-200)" strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={38} />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 12,
                  boxShadow: 'var(--shadow-sm)',
                  fontSize: 12,
                }}
                formatter={(v: number) => formatCurrency(v)}
                labelFormatter={(l) => `Jour ${l}`}
              />
              <Line type="monotone" dataKey="planned" stroke="var(--color-error)" strokeWidth={1.8} dot={false} strokeDasharray="4 3" />
              <Area type="monotone" dataKey="actual" stroke="var(--primary-500)" strokeWidth={2.4} fill="url(#actualFill)" dot={false} connectNulls={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card variant="default" padding="md">
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-[11px] font-black uppercase tracking-[0.08em] text-[var(--neutral-400)]">Catégories en dérive</p>
          <Badge variant="warning">{getMonthLabel(year, month)}</Badge>
        </div>

        <div className="mt-4 -mx-[var(--space-5)]">
          {loadingSummaries ? (
            <p className="m-0 px-[var(--space-5)] py-[var(--space-4)] text-[13px] font-medium text-[var(--neutral-500)]">Chargement…</p>
          ) : driftRows.length === 0 ? (
            <p className="m-0 px-[var(--space-5)] py-[var(--space-4)] text-[13px] font-medium text-[var(--neutral-500)]">Aucune donnée</p>
          ) : (
            driftRows.map((row) => {
              const drift = Number(row.driftPct ?? 0)
              const variant = drift > 12 ? 'error' : drift > 0 ? 'warning' : drift < -5 ? 'success' : 'neutral'
              return (
                <div
                  key={row.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-[var(--neutral-100)] px-[var(--space-5)] py-[10px]"
                >
                  <span className="min-w-0 truncate text-[13px] font-extrabold text-[var(--neutral-700)]">{row.name}</span>
                  <span className="text-[13px] font-extrabold text-[var(--neutral-700)] [font-family:var(--font-mono)]">
                    {formatCurrency(Number(row.spent ?? 0))}
                  </span>
                  <Badge variant={variant}>{`${drift > 0 ? '+' : ''}${drift.toFixed(0)}%`}</Badge>
                </div>
              )
            })
          )}
        </div>
      </Card>

      <Card variant="default" padding="md">
        <p className="m-0 text-[11px] font-black uppercase tracking-[0.08em] text-[var(--neutral-400)]">Actions rapides</p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {quickActions.map(({ label, icon: Icon }) => (
            <Button
              key={label}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {}}
              className="h-[58px] flex-col justify-center gap-1 px-1 text-[11px] font-semibold text-[var(--neutral-700)]"
            >
              <Icon size={14} />
              {label}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  )
}
