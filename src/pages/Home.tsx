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
import { useAccounts } from '@/hooks/useAccounts'
import { useBudgetSummaries } from '@/hooks/useBudgets'
import { formatCurrency, getCurrentPeriod, getDaysRemainingInMonth, getMonthLabel } from '@/lib/utils'
import type { AccountWithBalance } from '@/lib/types'
import { useTransactions } from '@/hooks/useTransactions'

export function Home() {
  const { year, month } = getCurrentPeriod()
  const { data: accounts, isLoading: loadingAccounts } = useAccounts()
  const { data: summaries, isLoading: loadingSummaries } = useBudgetSummaries(year, month)

  const totalBudget = summaries?.reduce((s, b) => s + b.budget_amount, 0) ?? 0
  // totalSpent exists in dataset but this page currently focuses on plan vs real trajectory.

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
    // Approx: budget mensuel - réel à date - dépenses planifiées restantes.
    return Math.max(0, totalBudget - realToDate - plannedFuture)
  }, [plannedFuture, realToDate, totalBudget])

  const budgetParJour = useMemo(() => {
    if (daysRemaining <= 0) return 0
    return resteUtile / daysRemaining
  }, [daysRemaining, resteUtile])

  const previsionFinDeMois = useMemo(() => {
    // Approx: réel à date + dépenses planifiées restantes + projection simple (si pas de planifiées).
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

  const deltaPct = useMemo(() => {
    const plannedToDate = daysElapsed > 0 ? (totalBudget / daysInMonth) * daysElapsed : 0
    if (plannedToDate <= 0) return null
    return ((realToDate - plannedToDate) / plannedToDate) * 100
  }, [daysElapsed, daysInMonth, realToDate, totalBudget])

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 0px))' }}>

      {/* ── Top Row ────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} style={{ padding: '18px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)' }}>
              Bonjour
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--neutral-400)', fontWeight: 600 }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
          </div>
          <button
            type="button"
            aria-label="Paramètres"
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--neutral-200)',
              background: 'var(--neutral-0)',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--neutral-700)',
            }}
            onClick={() => {}}
          >
            <Settings size={18} />
          </button>
        </div>
      </motion.div>

      {/* ── Budget Hero (design system) ───────────────────────── */}
      <section style={{ padding: '14px 16px 0' }}>
        <div
          style={{
            position: 'relative',
            borderRadius: 'var(--radius-2xl)',
            background: 'var(--primary-500)',
            padding: '16px 16px 14px',
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(108,92,231,0.22)',
          }}
        >
          {/* Decorative circles */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', right: -26, top: -34, width: 132, height: 132, borderRadius: 9999, background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ position: 'absolute', right: 34, bottom: -28, width: 96, height: 96, borderRadius: 9999, background: 'rgba(255,255,255,0.05)' }} />
          </div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.74)' }}>
                  Solde compte courant
                </p>
                <p style={{ margin: '6px 0 0', fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.05 }}>
                  {loadingAccounts ? '—' : (selectedAccount ? formatCurrency(selectedAccount.current_balance) : '—')}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.62)' }}>
                  {daysRemaining} jours restants dans le mois
                </p>
              </div>

              <button
                type="button"
                onClick={() => {}}
                style={{
                  borderRadius: 'var(--radius-pill)',
                  border: '1.5px solid rgba(255,255,255,0.85)',
                  background: 'transparent',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  padding: '6px 14px',
                  cursor: 'pointer',
                  height: 34,
                  flexShrink: 0,
                }}
              >
                DÉTAILS
              </button>
            </div>

            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Reste utile', value: resteUtile },
                { label: 'Budget / jour', value: budgetParJour },
                { label: 'Dépenses à venir', value: plannedFuture },
                { label: 'Fin de mois', value: previsionFinDeMois },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 14,
                    padding: '10px 10px',
                    minHeight: 54,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.70)' }}>
                    {label}
                  </p>
                  <p style={{ margin: '6px 0 0', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800, color: '#fff' }}>
                    {formatCurrency(value)}
                  </p>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, height: 1, background: 'rgba(255,255,255,0.20)' }} />

            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.86)' }}>
                {formatCurrency(realToDate)} dépensés
              </p>
              <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.68)' }}>
                sur {formatCurrency(totalBudget)}
              </p>
            </div>
            <div style={{ marginTop: 10, height: 3, borderRadius: 9999, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: totalBudget > 0 ? `${Math.min(100, Math.max(0, (realToDate / totalBudget) * 100))}%` : '0%',
                  borderRadius: 9999,
                  background: '#fff',
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Trajectoire ───────────────────────────────────────── */}
      <section style={{ padding: '14px 16px 0' }}>
        <div
          style={{
            borderRadius: 'var(--radius-2xl)',
            background: 'var(--neutral-0)',
            border: '1px solid var(--neutral-100)',
            boxShadow: 'var(--shadow-card)',
            padding: '14px 14px 12px',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--neutral-400)' }}>
                Trajectoire
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 700, color: 'var(--neutral-900)' }}>
                Projection mensuelle des dépenses
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: deltaPct != null && deltaPct > 0 ? 'var(--color-negative)' : 'var(--color-positive)' }}>
                {deltaPct == null ? '—' : `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%`}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--neutral-400)', fontWeight: 600 }}>
                Écart projeté / réel
              </p>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
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
        </div>
      </section>

      {/* ── Catégories en dérive ──────────────────────────────── */}
      <section style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--neutral-500)' }}>
            Catégories en dérive
          </p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-400)', fontWeight: 700 }}>
            {getMonthLabel(year, month)}
          </p>
        </div>
        <div style={{ marginTop: 10, background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--neutral-100)', padding: '4px 14px' }}>
          {loadingSummaries ? (
            <div style={{ padding: '14px 0', color: 'var(--neutral-400)' }}>Chargement…</div>
          ) : driftCategories.length === 0 ? (
            <div style={{ padding: '14px 0', color: 'var(--neutral-400)' }}>Aucune donnée.</div>
          ) : (
            driftCategories.map((c, i) => (
              <div
                key={c.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 10,
                  alignItems: 'center',
                  padding: '12px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--neutral-100)',
                }}
              >
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--neutral-800)' }}>{c.name}</p>
                <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 800, color: 'var(--neutral-900)' }}>
                  {formatCurrency(c.spent)}
                </p>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 900, color: c.driftPct > 0 ? 'var(--color-negative)' : 'var(--color-positive)' }}>
                  {c.driftPct > 0 ? '+' : ''}{c.driftPct.toFixed(0)}%
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Actions rapides ───────────────────────────────────── */}
      <section style={{ padding: '14px 16px 0' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--neutral-500)' }}>
          Actions rapides
        </p>
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { icon: Sparkles, label: 'NLP' },
            { icon: Calendar, label: 'Plan' },
            { icon: Target, label: 'Objectifs' },
            { icon: ArrowUpRight, label: 'Export' },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              style={{
                height: 58,
                borderRadius: 'var(--radius-2xl)',
                background: 'var(--neutral-0)',
                border: '1px solid var(--neutral-200)',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              onClick={() => {}}
              aria-label={label}
              title={label}
            >
              <Icon size={18} color="var(--neutral-700)" />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
