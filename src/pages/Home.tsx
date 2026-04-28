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
import { Badge, Button, Card, KpiCard, Table } from '@/components'
import { useAccounts } from '@/hooks/useAccounts'
import { useBudgetSummaries } from '@/hooks/useBudgets'
import { formatCurrency, formatCurrencyRounded, getCurrentPeriod, getDaysRemainingInMonth, getMonthLabel } from '@/lib/utils'
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
      .slice(0, 3)
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

  const quickActions = useMemo(
    () => [
      { icon: Sparkles, label: 'NLP' },
      { icon: Calendar, label: 'Plan' },
      { icon: Target, label: 'Objectifs' },
      { icon: ArrowUpRight, label: 'Export' },
    ],
    [],
  )

  const kpiItems = useMemo(
    () => [
      {
        label: 'Reste utile',
        value: resteUtile,
        delta: deltaPct ?? 0,
        deltaLabel: `${daysRemaining} j restants`,
      },
      {
        label: 'Budget / jour',
        value: budgetParJour,
        delta: 0,
        deltaLabel: 'Rythme actuel',
      },
      {
        label: 'Dépenses à venir',
        value: plannedFuture,
        delta: plannedFuture > 0 ? 1 : 0,
        deltaLabel: plannedFuture > 0 ? 'Planifiées' : 'Aucune',
      },
      {
        label: 'Fin de mois',
        value: previsionFinDeMois,
        delta: deltaPct ?? 0,
        deltaLabel: 'Projection',
      },
    ],
    [budgetParJour, daysRemaining, deltaPct, plannedFuture, previsionFinDeMois, resteUtile],
  )

  const driftColumns = useMemo(
    () => [
      { key: 'name', label: 'Catégorie', align: 'left' as const },
      { key: 'spent', label: 'Dépensé', align: 'right' as const },
      { key: 'drift', label: 'Écart', align: 'right' as const },
    ],
    [],
  )

  const driftData = useMemo(
    () =>
      driftCategories.map((c) => ({
        id: c.id,
        name: c.name,
        spent: c.spent,
        driftPct: c.driftPct,
      })),
    [driftCategories],
  )

  const deltaBadgeVariant =
    deltaPct == null ? 'neutral' : deltaPct > 10 ? 'error' : deltaPct > 0 ? 'warning' : 'success'

  return (
    <div className="flex flex-col gap-0 pb-[calc(90px+env(safe-area-inset-bottom,0px))]">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="px-4 pt-[18px]"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-[13px] font-extrabold text-[var(--neutral-900)]">
            Bonjour · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Paramètres"
            onClick={() => {}}
            className="h-10 w-10 rounded-full border border-[var(--neutral-200)] bg-[var(--neutral-0)] px-0 text-[var(--neutral-700)] shadow-[var(--shadow-card)]"
          >
            <Settings size={18} />
          </Button>
        </div>
      </motion.div>

      <section className="px-4 pt-[14px]">
        <Card
          variant="elevated"
          padding="none"
          className="relative overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--primary-500)] p-4 pb-[14px] shadow-[0_10px_30px_rgba(108,92,231,0.22)]"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-[26px] -top-[34px] h-[132px] w-[132px] rounded-full bg-white/[0.06]" />
            <div className="absolute -bottom-[28px] right-[34px] h-[96px] w-[96px] rounded-full bg-white/[0.05]" />
          </div>

          <div className="relative z-[1]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-white/75">Solde compte courant</p>
                <p className="mt-[6px] m-0 leading-[1.05] text-[34px] font-extrabold tracking-[-0.02em] text-white [font-family:var(--font-mono)]">
                  {loadingAccounts ? '—' : selectedAccount ? formatCurrencyRounded(selectedAccount.current_balance) : '—'}
                </p>
                <p className="mt-[6px] m-0 text-[11px] font-semibold text-white/65">{daysRemaining} jours restants dans le mois</p>
              </div>

              <div
                aria-label="Pourcentage dépensé vs prévision"
                title="Dépenses réelles vs prévision (à date)"
                className="relative grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full bg-white shadow-[0_10px_22px_rgba(30,30,45,0.18)]"
              >
                <svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-hidden="true">
                  <defs>
                    <linearGradient id="spendRing" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#55EFC4" />
                      <stop offset="100%" stopColor="#74B9FF" />
                    </linearGradient>
                  </defs>
                  <circle cx="28" cy="28" r="22" fill="none" stroke="#F0F0F5" strokeWidth="6" />
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    fill="none"
                    stroke="url(#spendRing)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(2 * Math.PI * 22) * ((spendVsForecastPct ?? 0) / 100)} ${(2 * Math.PI * 22)}`}
                    transform="rotate(-90 28 28)"
                  />
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-[2px]">
                  <p className="m-0 text-[12px] font-extrabold text-[var(--neutral-900)] [font-family:var(--font-mono)]">
                    {spendVsForecastPct == null ? '—' : `${Math.round(spendVsForecastPct)}%`}
                  </p>
                  <p className="m-0 text-[9px] font-bold text-[var(--neutral-400)]">vs prév.</p>
                </div>
              </div>
            </div>

            <div className="mt-[14px] grid grid-cols-2 gap-[10px]">
              {kpiItems.map((item) => (
                <KpiCard
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  delta={item.delta}
                  deltaLabel={item.deltaLabel}
                  format="currency"
                  className="bg-white/95 p-[10px] shadow-none"
                />
              ))}
            </div>
          </div>
        </Card>
      </section>

      <section className="px-4 pt-[14px]">
        <Card variant="default" padding="none" className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--neutral-100)] p-[14px] pb-3 shadow-[var(--shadow-card)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--neutral-400)]">Trajectoire</p>
              <p className="mt-1 m-0 text-[14px] font-bold text-[var(--neutral-900)]">Projection mensuelle des dépenses</p>
            </div>
            <div className="text-right">
              <Badge variant={deltaBadgeVariant}>
                {deltaPct == null ? '—' : `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%`}
              </Badge>
              <p className="mt-[2px] m-0 text-[11px] font-semibold text-[var(--neutral-400)]">Écart projeté / réel</p>
            </div>
          </div>

          <div className="mt-[10px]">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trajectoryData}>
                <defs>
                  <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(108,92,231,0.18)" />
                    <stop offset="100%" stopColor="rgba(108,92,231,0.00)" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#F0F0F5" strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#C4C4CC' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#C4C4CC' }} axisLine={false} tickLine={false} width={38} />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    boxShadow: '0 10px 24px rgba(30,30,45,0.12)',
                    fontSize: 12,
                  }}
                  formatter={(v: number) => formatCurrency(v)}
                  labelFormatter={(l) => `Jour ${l}`}
                />
                <Line type="monotone" dataKey="planned" stroke="#FF7675" strokeWidth={1.8} dot={false} strokeDasharray="4 3" />
                <Area type="monotone" dataKey="actual" stroke="#6C5CE7" strokeWidth={2.4} fill="url(#actualFill)" dot={false} connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section className="px-4 pt-[14px]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="m-0 text-[11px] font-black uppercase tracking-[0.08em] text-[var(--neutral-500)]">Catégories en dérive</p>
          <Badge variant="neutral">{getMonthLabel(year, month)}</Badge>
        </div>

        <Table
          className="mt-[10px] rounded-[var(--radius-2xl)] border border-[var(--neutral-100)] shadow-[var(--shadow-card)]"
          columns={driftColumns}
          data={loadingSummaries ? [] : driftData}
          density="compact"
          striped
          hoverable
          emptyMessage={loadingSummaries ? 'Chargement…' : 'Aucune donnée.'}
          renderCell={(value, key, row) => {
            if (key === 'name') {
              return <span className="text-[13px] font-extrabold text-[var(--neutral-800)]">{String(value)}</span>
            }
            if (key === 'spent') {
              return <span className="text-[12px] font-extrabold text-[var(--neutral-900)] [font-family:var(--font-mono)]">{formatCurrency(Number(value ?? 0))}</span>
            }
            if (key === 'drift') {
              const drift = Number(row.driftPct ?? 0)
              const badgeVariant = drift > 12 ? 'error' : drift > 0 ? 'warning' : drift < -5 ? 'success' : 'neutral'
              return <Badge variant={badgeVariant}>{`${drift > 0 ? '+' : ''}${drift.toFixed(0)}%`}</Badge>
            }
            return value ?? '—'
          }}
        />
      </section>

      <section className="px-4 pt-[14px]">
        <p className="m-0 text-[11px] font-black uppercase tracking-[0.08em] text-[var(--neutral-500)]">Actions rapides</p>

        <div className="mt-[10px] grid grid-cols-2 gap-[10px] sm:grid-cols-4">
          {quickActions.map(({ icon: Icon, label }) => (
            <Button
              key={label}
              type="button"
              variant="ghost"
              size="md"
              leftIcon={<Icon size={16} />}
              onClick={() => {}}
              className="h-[58px] justify-center rounded-[var(--radius-2xl)] border border-[var(--neutral-200)] bg-[var(--neutral-0)] px-3 text-[var(--neutral-700)] shadow-[var(--shadow-card)]"
            >
              {label}
            </Button>
          ))}
        </div>
      </section>
    </div>
  )
}
