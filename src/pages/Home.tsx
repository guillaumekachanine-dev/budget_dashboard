import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
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
import { PageHeader } from '@/components/layout/PageHeader'
import comptePrincipalIcon from '@/assets/bank_account_icons/Compte_principal_banque_populaire.png'
import compteJointIcon from '@/assets/bank_account_icons/banque_postale_compte_joint.png'
import peaIcon from '@/assets/bank_account_icons/Boursorama_PEA .png'
import percolIcon from '@/assets/bank_account_icons/Amundi_Epargne.png'
import cryptoIcon from '@/assets/bank_account_icons/bitcoin.png'

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

type HomeAccountPreset = {
  id: string
  label: string
  iconSrc: string
  keywords: string[]
  iconScale?: number
  missing?: boolean
}

type HomeAccountEntry = {
  preset: HomeAccountPreset
  account: AccountWithBalance | null
}

const HOME_ACCOUNT_PRESETS: HomeAccountPreset[] = [
  { id: 'compte_principal', label: 'Compte principal', iconSrc: comptePrincipalIcon, keywords: ['compte principal', 'courant principal', 'principal'] },
  { id: 'compte_joint', label: 'Compte joint', iconSrc: compteJointIcon, keywords: ['compte joint', 'joint'], iconScale: 1.22 },
  { id: 'livret_a', label: 'Livret A', iconSrc: comptePrincipalIcon, keywords: ['livret a'] },
  { id: 'ldds', label: 'LDDS', iconSrc: comptePrincipalIcon, keywords: ['ldds'] },
  { id: 'per', label: 'PER', iconSrc: comptePrincipalIcon, keywords: ['per'] },
  { id: 'pea', label: 'PEA', iconSrc: peaIcon, keywords: ['pea'], iconScale: 1.22 },
  { id: 'epargne_percol', label: 'Epargne PERCOL', iconSrc: percolIcon, keywords: ['percol', 'amundi'], iconScale: 1.22 },
  { id: 'compte_crypto', label: 'Compte crypto', iconSrc: cryptoIcon, keywords: ['crypto', 'bitcoin'], missing: true },
]

function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function formatDateShort(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return isoDate
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const SAVINGS_BOOKLET_IDS = ['livret_a', 'ldds'] as const
const SAVINGS_BOOKLET_CEILINGS: Record<(typeof SAVINGS_BOOKLET_IDS)[number], number> = {
  livret_a: 22_950,
  ldds: 12_000,
}

const SAVINGS_INTEREST_RATE_BY_YEAR: Record<number, number> = {
  2017: 0.0075,
  2018: 0.0075,
  2019: 0.0075,
  2020: 0.005,
  2021: 0.005,
  2022: 0.01,
  2023: 0.03,
  2024: 0.03,
  2025: 0.024,
  2026: 0.015,
  2027: 0.015,
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

  const accountEntries = useMemo<HomeAccountEntry[]>(() => {
    const source = accounts ?? []
    return HOME_ACCOUNT_PRESETS.map((preset) => {
      const matched = source.find((account) => {
        const haystack = `${account.name} ${account.institution_name ?? ''}`
        const normalized = normalizeLabel(haystack)
        return preset.keywords.some((keyword) => normalized.includes(normalizeLabel(keyword)))
      })
      return { preset, account: matched ?? null }
    })
  }, [accounts])

  const [selectedAccountPresetId, setSelectedAccountPresetId] = useState<string | null>(null)
  const [showAccountsModal, setShowAccountsModal] = useState(false)

  useEffect(() => {
    if (!accountEntries.length) {
      setSelectedAccountPresetId(null)
      return
    }
    setSelectedAccountPresetId((current) => {
      if (current && accountEntries.some((entry) => entry.preset.id === current)) return current
      return accountEntries[0].preset.id
    })
  }, [accountEntries])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!showAccountsModal) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [showAccountsModal])

  const selectedAccountEntry = useMemo<HomeAccountEntry | null>(() => {
    if (!accountEntries.length) return null
    if (!selectedAccountPresetId) return accountEntries[0]
    return accountEntries.find((entry) => entry.preset.id === selectedAccountPresetId) ?? accountEntries[0]
  }, [accountEntries, selectedAccountPresetId])

  const selectedAccount = selectedAccountEntry?.account ?? null
  const { data: selectedAccountTxns } = useTransactions({
    accountId: selectedAccount?.id ?? '__none__',
  })
  const isSavingsBooklet =
    selectedAccountEntry != null
    && (SAVINGS_BOOKLET_IDS as readonly string[]).includes(selectedAccountEntry.preset.id)
  const selectedBalance = Number(selectedAccount?.current_balance ?? 0)

  const handleOpenAccountsModal = useCallback(() => {
    setShowAccountsModal((current) => !current)
  }, [])

  const handleSelectAccountPreset = useCallback((presetId: string) => {
    setSelectedAccountPresetId(presetId)
    setShowAccountsModal(false)
  }, [])

  const heroMetrics = useMemo(
    () => [
      { key: 'reste', label: 'Reste utile', value: formatMoneyInteger(resteUtile) },
      { key: 'jour', label: 'Budget / jour', value: formatMoneyInteger(budgetParJour) },
      { key: 'avenir', label: 'Dépenses à venir', value: formatMoneyInteger(plannedFuture) },
      { key: 'fin', label: 'Fin de mois', value: formatMoneyInteger(previsionFinDeMois) },
    ],
    [budgetParJour, plannedFuture, previsionFinDeMois, resteUtile],
  )

  const savingsBookletCeiling = useMemo(() => {
    if (!isSavingsBooklet || !selectedAccountEntry) return null
    return SAVINGS_BOOKLET_CEILINGS[selectedAccountEntry.preset.id as keyof typeof SAVINGS_BOOKLET_CEILINGS] ?? null
  }, [isSavingsBooklet, selectedAccountEntry])

  const savingsCeilingPct = useMemo(() => {
    if (!savingsBookletCeiling || savingsBookletCeiling <= 0) return 0
    return Math.max(0, Math.min(100, (selectedBalance / savingsBookletCeiling) * 100))
  }, [savingsBookletCeiling, selectedBalance])

  const savingsStatusLabel = useMemo(() => {
    if (!isSavingsBooklet) return ''
    if (savingsCeilingPct >= 99.5) return 'Plafond atteint'
    if (savingsCeilingPct >= 45 && savingsCeilingPct <= 55) return 'Moitié'
    return `${savingsCeilingPct.toFixed(0)}%`
  }, [isSavingsBooklet, savingsCeilingPct])

  const latestSavingsDeposit = useMemo(() => {
    if (!isSavingsBooklet) return null
    const rows = selectedAccountTxns ?? []
    return rows.find((txn) =>
      txn.direction === 'income'
      || txn.direction === 'transfer_in'
      || txn.direction === 'savings'
      || txn.flow_type === 'income'
      || txn.flow_type === 'savings')
  }, [isSavingsBooklet, selectedAccountTxns])

  const latestSavingsDepositLabel = useMemo(() => {
    if (!isSavingsBooklet) return ''
    if (!latestSavingsDeposit) return 'Aucun versement'
    return `${formatMoneyInteger(Number(latestSavingsDeposit.amount))} · ${formatDateShort(latestSavingsDeposit.transaction_date)}`
  }, [isSavingsBooklet, latestSavingsDeposit])

  const savingsInterestYtd2026 = useMemo(() => {
    if (!isSavingsBooklet) return 0
    const rows = selectedAccountTxns ?? []
    const hasExplicitInterest = rows.filter((txn) => {
      if (txn.transaction_date < '2026-01-01' || txn.transaction_date > todayIso) return false
      const label = `${txn.raw_label ?? ''} ${txn.normalized_label ?? ''} ${txn.merchant_name ?? ''}`
      return normalizeLabel(label).includes('interet')
    })
    if (hasExplicitInterest.length > 0) {
      return hasExplicitInterest.reduce((sum, txn) => sum + Number(txn.amount), 0)
    }
    const ytdRatio = Math.max(0, Math.min(1, (now.getMonth() + 1) / 12))
    return selectedBalance * (SAVINGS_INTEREST_RATE_BY_YEAR[2026] ?? 0.015) * ytdRatio
  }, [isSavingsBooklet, now, selectedAccountTxns, selectedBalance, todayIso])

  const projectedInterest2027 = useMemo(() => {
    if (!isSavingsBooklet) return 0
    const projectedBase = selectedBalance + savingsInterestYtd2026
    return projectedBase * (SAVINGS_INTEREST_RATE_BY_YEAR[2027] ?? 0.015)
  }, [isSavingsBooklet, savingsInterestYtd2026, selectedBalance])

  const savingsHeroMetrics = useMemo(
    () => [
      { key: 'statut', label: 'Statut', value: savingsStatusLabel },
      { key: 'versement', label: 'Dernier versement réalisé', value: latestSavingsDepositLabel },
      { key: 'interets2026', label: 'Intérêts perçus début 2026', value: formatMoneyInteger(savingsInterestYtd2026) },
      { key: 'projection2027', label: 'Projection intérêt 2027', value: formatMoneyInteger(projectedInterest2027) },
    ],
    [latestSavingsDepositLabel, projectedInterest2027, savingsInterestYtd2026, savingsStatusLabel],
  )

  const savingsInterestCurveData = useMemo(() => {
    if (!isSavingsBooklet) return []
    const currentYear = now.getFullYear()
    const firstYear = currentYear - 9
    const estimatedOpeningBalance = Math.max(0, Number(selectedAccount?.opening_balance ?? selectedBalance * 0.58))
    const annualContribution = Math.max(0, (selectedBalance - estimatedOpeningBalance) / 10)
    let capital = estimatedOpeningBalance
    let cumulativeInterest = 0
    return Array.from({ length: 10 }, (_, idx) => {
      const yearValue = firstYear + idx
      capital += annualContribution
      const rate = SAVINGS_INTEREST_RATE_BY_YEAR[yearValue] ?? (yearValue <= 2025 ? 0.02 : 0.015)
      const interest = capital * rate
      cumulativeInterest += interest
      capital += interest
      return {
        year: String(yearValue),
        yearlyInterest: interest,
        cumulativeInterest,
      }
    })
  }, [isSavingsBooklet, now, selectedAccount?.opening_balance, selectedBalance])

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
      <PageHeader
        title="Accueil"
        rightLabel={selectedAccountEntry?.preset.label ?? ''}
        actionIcon={
          selectedAccountEntry ? (
            <img
              src={selectedAccountEntry.preset.iconSrc}
              alt={selectedAccountEntry.preset.label}
              width={46}
              height={46}
              style={{
                width: 46,
                height: 46,
                objectFit: 'contain',
                transform: `scale(${selectedAccountEntry.preset.iconScale ?? 1})`,
              }}
              loading="lazy"
              decoding="async"
            />
          ) : null
        }
        actionAriaLabel="Changer de compte"
        onActionClick={handleOpenAccountsModal}
      />

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
              marginBottom: 'var(--space-2)',
            }}
          >
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
            {isSavingsBooklet && savingsBookletCeiling ? (
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--neutral-600)' }}>
                {`Plafond ${formatMoneyInteger(savingsBookletCeiling)} · ${savingsCeilingPct.toFixed(0)}%`}
              </p>
            ) : null}
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
              {(isSavingsBooklet ? savingsHeroMetrics : heroMetrics).map((metric) => (
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
                {isSavingsBooklet ? 'Évolution des intérêts' : 'Trajectoire'}
              </p>
              <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--neutral-900)' }}>
                {isSavingsBooklet ? 'Courbe sur 10 ans' : 'Prévisions VS Réel'}
              </p>
            </div>
            {isSavingsBooklet ? null : (
              <p style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: trajectoryDeltaColor, fontFamily: 'var(--font-mono)' }}>
                {deltaPct == null ? '—' : `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%`}
              </p>
            )}
          </div>

          <div style={{ height: 220 }}>
            {isSavingsBooklet ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={savingsInterestCurveData}>
                  <CartesianGrid stroke="var(--neutral-200)" strokeDasharray="3 6" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--neutral-400)' }} axisLine={false} tickLine={false} />
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
                    formatter={(value: number, name: string) => [formatMoneyInteger(Number(value)), name === 'yearlyInterest' ? 'Intérêts annuels' : 'Intérêts cumulés']}
                    labelFormatter={(label) => `Année ${label}`}
                  />
                  <Line type="monotone" dataKey="yearlyInterest" name="Intérêts annuels" stroke="var(--primary-500)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="cumulativeInterest" name="Intérêts cumulés" stroke="var(--color-warning)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
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
            )}
          </div>
        </div>
      </motion.section>

      {!isSavingsBooklet ? (
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
      ) : null}

      <AnimatePresence>
        {showAccountsModal ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAccountsModal(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Sélectionner un compte"
              initial={{ y: '-100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 330 }}
              onClick={(event) => event.stopPropagation()}
              style={{
                position: 'fixed',
                left: 0,
                right: 0,
                top: 0,
                zIndex: 61,
                width: '100%',
                maxWidth: 430,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: '0 0 var(--radius-2xl) var(--radius-2xl)',
                padding: 'calc(var(--safe-top-offset) + var(--space-2)) var(--space-6) var(--space-6)',
                boxShadow: 'var(--shadow-lg)',
                maxHeight: '78dvh',
                overflowY: 'auto',
              }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 'var(--radius-full)', background: 'var(--neutral-300)', margin: '2px auto var(--space-4)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--neutral-900)' }}>
                  Sélectionner un compte
                </p>
                <button
                  type="button"
                  aria-label="Fermer"
                  onClick={() => setShowAccountsModal(false)}
                  style={{
                    border: 'none',
                    background: 'var(--neutral-100)',
                    color: 'var(--neutral-600)',
                    minWidth: 'var(--touch-target-min)',
                    minHeight: 'var(--touch-target-min)',
                    borderRadius: 'var(--radius-full)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--space-5) var(--space-2)' }}>
                {accountEntries.map((entry) => {
                  const isActive = entry.preset.id === selectedAccountEntry?.preset.id
                  return (
                    <button
                      key={entry.preset.id}
                      type="button"
                      onClick={() => handleSelectAccountPreset(entry.preset.id)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        cursor: 'pointer',
                        display: 'grid',
                        justifyItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <img
                        src={entry.preset.iconSrc}
                        alt={entry.preset.label}
                        width={56}
                        height={56}
                        style={{ width: 56, height: 56, objectFit: 'contain', transform: `scale(${entry.preset.iconScale ?? 1})` }}
                        loading="lazy"
                        decoding="async"
                      />
                      <span style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.35, fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)', color: isActive ? 'var(--primary-600)' : 'var(--neutral-700)', textAlign: 'center' }}>
                        {entry.preset.missing ? `${entry.preset.label} (à créer)` : entry.preset.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
