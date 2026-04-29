import { useMemo } from 'react'
import { motion } from 'framer-motion'
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
import { useAccounts } from '@/hooks/useAccounts'
import { useBudgetSummaries } from '@/hooks/useBudgets'
import {
  getCurrentPeriod,
  getDaysRemainingInMonth,
  getMonthLabel,
} from '@/lib/utils'
import type { AccountWithBalance } from '@/lib/types'
import { useTransactions } from '@/hooks/useTransactions'
import geminiIcon from '@/assets/icons_app/gemini-svg.svg'

function formatMoneyInteger(amount: number): string {
  if (!Number.isFinite(amount)) return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(0)

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.floor(amount))
}

export function Home() {
  const { year, month } = getCurrentPeriod()
  const { data: accounts } = useAccounts()
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
      { key: 'reste', label: 'Reste utile', value: formatMoneyInteger(resteUtile) },
      { key: 'jour', label: 'Budget / jour', value: formatMoneyInteger(budgetParJour) },
      { key: 'avenir', label: 'Dépenses à venir', value: formatMoneyInteger(plannedFuture) },
      { key: 'fin', label: 'Fin de mois', value: formatMoneyInteger(previsionFinDeMois) },
    ],
    [budgetParJour, plannedFuture, previsionFinDeMois, resteUtile],
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

  const trajectoryDeltaColor =
    deltaPct == null ? 'var(--neutral-500)' : deltaPct > 0 ? 'var(--color-error)' : 'var(--color-success)'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-8)',
        paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom-offset))',
      }}
    >
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{
          borderBottom: '1px solid var(--neutral-200)',
          padding: 'var(--space-4) var(--space-6)',
        }}
      >
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
          <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <h1
              style={{
                margin: 0,
                fontSize: 'var(--font-size-2xl)',
                lineHeight: 'var(--line-height-tight)',
                fontWeight: 'var(--font-weight-extrabold)',
                color: 'var(--neutral-900)',
                letterSpacing: '-0.02em',
              }}
            >
              Accueil
            </h1>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--neutral-500)', textTransform: 'capitalize' }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
          </div>

          <button
            type="button"
            aria-label="Profil utilisateur"
            onClick={() => {}}
            style={{
              border: '1px solid var(--neutral-200)',
              background: 'var(--neutral-0)',
              borderRadius: 'var(--radius-full)',
              minWidth: 'var(--touch-target-min)',
              minHeight: 'var(--touch-target-min)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--neutral-600)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
            }}
          >
            <img
              src={geminiIcon}
              alt=""
              aria-hidden="true"
              style={{ width: 18, height: 18, borderRadius: 'var(--radius-full)' }}
            />
          </button>
        </div>
      </motion.header>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        style={{ padding: '0 var(--space-6)' }}
      >
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gap: 'var(--space-1)',
              justifyItems: 'center',
              textAlign: 'center',
              marginBottom: 'var(--space-4)',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--primary-600)',
              }}
            >
              Solde compte courant
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--font-size-kpi)',
                fontWeight: 'var(--font-weight-extrabold)',
                lineHeight: 'var(--line-height-tight)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--primary-700)',
              }}
            >
              {formatMoneyInteger(selectedAccount?.current_balance ?? 0)}
            </p>
          </div>

          <div
            style={{
              background: 'var(--primary-500)',
              color: 'var(--neutral-0)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-lg)',
              display: 'grid',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 'var(--space-3)' }}>
              {heroMetrics.map((metric) => (
                <div
                  key={metric.key}
                  style={{
                    background:
                      metric.key === 'reste'
                        ? 'color-mix(in oklab, var(--primary-500) 14%, var(--neutral-0) 86%)'
                        : metric.key === 'jour'
                          ? 'color-mix(in oklab, var(--primary-500) 10%, var(--neutral-0) 90%)'
                          : metric.key === 'avenir'
                            ? 'color-mix(in oklab, var(--primary-500) 18%, var(--neutral-0) 82%)'
                            : 'color-mix(in oklab, var(--primary-500) 12%, var(--neutral-0) 88%)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3)',
                    border: '1px solid color-mix(in oklab, var(--primary-500) 28%, var(--neutral-0) 72%)',
                    display: 'grid',
                    gap: 'var(--space-1)',
                    justifyItems: 'center',
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-semibold)',
                      textTransform: 'uppercase',
                      color: 'var(--neutral-600)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {metric.label}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 'var(--font-size-md)',
                      fontWeight: 'var(--font-weight-bold)',
                      color: 'var(--neutral-900)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12 }}
        style={{ padding: '0 var(--space-6)' }}
      >
        <div
          style={{
            maxWidth: 600,
            margin: '0 auto',
            padding: 'var(--space-4) 0',
            borderBottom: '1px solid var(--neutral-200)',
            display: 'grid',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <div>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-500)', letterSpacing: '0.08em' }}>
                Trajectoire
              </p>
              <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--neutral-900)' }}>
                Prévisions VS Réel
              </p>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: trajectoryDeltaColor, fontFamily: 'var(--font-mono)' }}>
              {deltaPct == null ? '—' : `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%`}
            </p>
          </div>

          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trajectoryData}>
                <defs>
                  <linearGradient id="actualFillHome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary-500)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--primary-500)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--neutral-200)" strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--neutral-400)' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--neutral-400)' }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                  tickFormatter={(value) => formatMoneyInteger(Number(value))}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--neutral-0)',
                    border: '1px solid var(--neutral-200)',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-sm)',
                    fontSize: 12,
                  }}
                  formatter={(value: number) => formatMoneyInteger(Number(value))}
                  labelFormatter={(label) => `Jour ${label}`}
                />
                <Line type="monotone" dataKey="planned" stroke="var(--color-warning)" strokeWidth={1.8} dot={false} strokeDasharray="4 3" />
                <Area type="monotone" dataKey="actual" stroke="var(--primary-500)" strokeWidth={2.3} fill="url(#actualFillHome)" dot={false} connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.18 }}
        style={{ padding: '0 var(--space-6)' }}
      >
        <div
          style={{
            maxWidth: 600,
            margin: '0 auto',
            padding: 'var(--space-4) 0',
            borderBottom: '1px solid var(--neutral-200)',
            display: 'grid',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-500)', letterSpacing: '0.08em' }}>
              Catégories en dérive
            </p>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
              {getMonthLabel(year, month)}
            </p>
          </div>

          {loadingSummaries ? (
            <p style={{ margin: 0, padding: 'var(--space-6) 0', textAlign: 'center', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-400)' }}>
              Chargement…
            </p>
          ) : driftRows.length === 0 ? (
            <p style={{ margin: 0, padding: 'var(--space-6) 0', textAlign: 'center', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-400)' }}>
              Aucune donnée
            </p>
          ) : (
            <div>
              {driftRows.map((row) => {
                const drift = Number(row.driftPct ?? 0)
                const driftColor = drift > 0 ? 'var(--color-error)' : drift < 0 ? 'var(--color-success)' : 'var(--neutral-500)'
                return (
                  <div
                    key={row.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1fr) auto auto',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3) 0',
                      borderBottom: '1px solid var(--neutral-100)',
                      transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.backgroundColor = 'var(--neutral-50)'
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)' }}>
                      {row.name}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      {formatMoneyInteger(Number(row.spent ?? 0))}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: driftColor, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      {`${drift > 0 ? '+' : ''}${drift.toFixed(0)}%`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </motion.section>
    </div>
  )
}
