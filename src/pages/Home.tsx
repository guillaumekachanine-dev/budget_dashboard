import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
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
import { lockDocumentScroll } from '@/lib/scrollLock'
import { getBudgetLinesForPeriod } from '@/features/budget/api/getBudgetLinesForPeriod'
import { budgetDb } from '@/lib/supabaseBudget'
import type { BudgetLineWithCategory } from '@/features/budget/types'
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

type AccountVisualGroup = 'checking' | 'savings' | 'invest'

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

const CHECKING_ACCOUNT_IDS = new Set(['compte_principal', 'compte_joint'])
const SAVINGS_ACCOUNT_IDS = new Set(['livret_a', 'ldds', 'per', 'epargne_percol'])
const INVEST_ACCOUNT_IDS = new Set(['pea', 'compte_crypto'])

function resolveAccountVisualGroup(presetId: string | null | undefined): AccountVisualGroup {
  if (!presetId) return 'checking'
  if (SAVINGS_ACCOUNT_IDS.has(presetId)) return 'savings'
  if (INVEST_ACCOUNT_IDS.has(presetId)) return 'invest'
  if (CHECKING_ACCOUNT_IDS.has(presetId)) return 'checking'
  return 'checking'
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

const PROJECTION_SAVINGS_RATE = 0.015
const PER_ACCOUNT_ID = 'ef9f92c1-c6db-4672-8231-39ec75aa0195'
const MONTHS_2026_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

type HomeVisionMode = 'to_date' | 'end_of_month'
type HomeBudgetBlockId = 'fixe' | 'variable_essentiel' | 'discretionnaire' | 'epargne' | 'cagnotte'

interface RecurringObligationRow {
  id: string
  category_id: string | null
  amount: number
  due_day: number
  recurrence_frequency: 'monthly' | 'quarterly' | 'yearly'
  starts_on: string | null
  ends_on: string | null
}

interface HomeVisionBlockConfig {
  id: HomeBudgetBlockId
  label: string
  color: string
}

interface HomeVisionBlockRow extends HomeVisionBlockConfig {
  budgetAmount: number
  spentToDate: number
  plannedOperationsCount: number
  plannedOperationsAmount: number
  consumedAmount: number
  consumedRatio: number
}

const HOME_VISION_BLOCKS: HomeVisionBlockConfig[] = [
  { id: 'fixe', label: 'Fixe', color: 'var(--primary-500)' },
  { id: 'variable_essentiel', label: 'Variable essentiel', color: 'var(--color-success)' },
  { id: 'discretionnaire', label: 'Discrétionnaire', color: 'var(--color-error)' },
  { id: 'epargne', label: 'Épargne', color: 'var(--color-warning)' },
  { id: 'cagnotte', label: 'Cagnotte', color: 'var(--viz-e)' },
]

function normalizeBudgetBucket(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_')
}

function mapBudgetBucketToHomeBlock(bucket: string | null | undefined): HomeBudgetBlockId | null {
  const normalized = normalizeBudgetBucket(bucket)
  if (normalized === 'socle_fixe') return 'fixe'
  if (normalized === 'variable_essentielle') return 'variable_essentiel'
  if (normalized === 'discretionnaire') return 'discretionnaire'
  if (normalized === 'provision') return 'epargne'
  if (normalized === 'cagnotte_projet') return 'cagnotte'
  return null
}

function resolveObligationDueDateForMonth(
  obligation: RecurringObligationRow,
  year: number,
  month: number,
): string | null {
  const monthDays = new Date(year, month, 0).getDate()
  const dueDay = Math.max(1, Math.min(monthDays, Number(obligation.due_day ?? 1)))
  const dueDate = new Date(year, month - 1, dueDay)
  const dueIso = dueDate.toISOString().slice(0, 10)

  if (obligation.starts_on && dueIso < obligation.starts_on) return null
  if (obligation.ends_on && dueIso > obligation.ends_on) return null

  if (obligation.recurrence_frequency === 'monthly') return dueIso

  if (!obligation.starts_on) return null

  const startDate = new Date(`${obligation.starts_on}T00:00:00`)
  if (Number.isNaN(startDate.getTime())) return null

  const startMonth = startDate.getMonth() + 1
  const monthsDiff = (year - startDate.getFullYear()) * 12 + (month - startMonth)
  if (monthsDiff < 0) return null

  if (obligation.recurrence_frequency === 'quarterly') {
    return monthsDiff % 3 === 0 ? dueIso : null
  }

  if (obligation.recurrence_frequency === 'yearly') {
    return month === startMonth && monthsDiff % 12 === 0 ? dueIso : null
  }

  return null
}

function DriftCategoryTransactionsModal({
  open,
  onClose,
  categoryName,
  categoryTransactions,
  loading,
}: {
  open: boolean
  onClose: () => void
  categoryName: string | null
  categoryTransactions: Array<{ id: string; transaction_date: string; merchant_name: string | null; normalized_label: string | null; raw_label: string | null; amount: number }> | null
  loading: boolean
}) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(13,13,31,0.56)' }}
          />
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 221,
              display: 'grid',
              placeItems: 'center',
              padding: 'var(--space-4)',
              pointerEvents: 'none',
            }}
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', damping: 30, stiffness: 330 }}
              style={{
                width: 'min(560px, 100%)',
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-2xl)',
                maxHeight: 'min(82dvh, calc(100dvh - var(--space-8)))',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-lg)',
                pointerEvents: 'auto',
              }}
            >
              <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--neutral-900)' }}>{categoryName}</p>
                <button type="button" onClick={onClose} style={{ border: 'none', background: 'var(--neutral-100)', color: 'var(--neutral-600)', minWidth: 'var(--touch-target-min)', minHeight: 'var(--touch-target-min)', borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label="Fermer">
                  <X size={15} />
                </button>
              </div>
              <div style={{ maxHeight: 'calc(min(82dvh, 100dvh - var(--space-8)) - 66px)', overflowY: 'auto' }}>
                {loading ? (
                  <p style={{ margin: 0, padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)' }}>Chargement…</p>
                ) : (categoryTransactions?.length ?? 0) === 0 ? (
                  <p style={{ margin: 0, padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)' }}>Aucune opération</p>
                ) : (
                  categoryTransactions?.map((tx) => {
                    const d = new Date(`${tx.transaction_date}T00:00:00`)
                    const dateStr = Number.isNaN(d.getTime()) ? '--/--' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                    const label = (tx.normalized_label ?? tx.raw_label ?? 'Opération').trim() || 'Opération'
                    return (
                      <button
                        key={tx.id}
                        type="button"
                        style={{
                          width: '100%',
                          border: 'none',
                          borderBottom: '1px solid var(--neutral-200)',
                          padding: 'var(--space-3) var(--space-5)',
                          display: 'grid',
                          gridTemplateColumns: '52px minmax(0,1fr) auto',
                          alignItems: 'center',
                          gap: 'var(--space-3)',
                          background: 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'background-color var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--neutral-50)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <span style={{ fontSize: 12, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>{dateStr}</span>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--neutral-800)' }}>{label}</span>
                        <span style={{ fontSize: 13, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{formatMoneyInteger(Number(tx.amount))}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  )
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
  const { data: monthSavingsTxns } = useTransactions({
    startDate: monthStart,
    endDate: monthEnd,
    flowType: 'savings',
  })
  const { data: homeBudgetLines } = useQuery<{
    categoryLines: BudgetLineWithCategory[]
    globalVariableAmount: number
  } | null>({
    queryKey: ['home', 'budget-lines', year, month],
    queryFn: async () => {
      try {
        const budgetLines = await getBudgetLinesForPeriod({ year, month })
        return {
          categoryLines: budgetLines.categoryLines,
          globalVariableAmount: Number(budgetLines.globalVariableLine?.amount ?? 0),
        }
      } catch {
        return null
      }
    },
    staleTime: 60_000,
  })
  const { data: recurringObligations } = useQuery<RecurringObligationRow[]>({
    queryKey: ['home', 'recurring-obligations'],
    queryFn: async () => {
      const { data, error } = await budgetDb()
        .from('recurring_obligations')
        .select('id, category_id, amount, due_day, recurrence_frequency, starts_on, ends_on')
        .eq('is_active', true)

      if (error) throw error
      return (data ?? []) as RecurringObligationRow[]
    },
    staleTime: 60_000,
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

  const fallbackVariableBudget = useMemo(() => {
    const rows = summaries ?? []
    return rows
      .filter((row) => row.category.budget_behavior === 'variable')
      .reduce((sum, row) => sum + Number(row.budget_amount), 0)
  }, [summaries])

  const variableBudgetMonthly = useMemo(() => {
    if (typeof homeBudgetLines?.globalVariableAmount === 'number' && Number.isFinite(homeBudgetLines.globalVariableAmount)) {
      return homeBudgetLines.globalVariableAmount
    }
    return fallbackVariableBudget
  }, [fallbackVariableBudget, homeBudgetLines?.globalVariableAmount])

  const variableSpentToDate = useMemo(() => {
    const rows = monthExpenseTxns ?? []
    return rows
      .filter((t) => t.transaction_date <= todayIso && t.budget_behavior === 'variable')
      .reduce((sum, t) => sum + Number(t.amount), 0)
  }, [monthExpenseTxns, todayIso])

  const fixedChargesToDate = useMemo(() => {
    const rows = monthExpenseTxns ?? []
    return rows
      .filter((t) => t.transaction_date <= todayIso && t.budget_behavior === 'fixed')
      .reduce((sum, t) => sum + Number(t.amount), 0)
  }, [monthExpenseTxns, todayIso])

  const savingsContributionsToDate = useMemo(() => {
    const rows = monthSavingsTxns ?? []
    return rows
      .filter((t) => t.transaction_date <= todayIso)
      .reduce((sum, t) => sum + Number(t.amount), 0)
  }, [monthSavingsTxns, todayIso])

  const certainUpcomingExpenses = useMemo(() => {
    const rows = monthExpenseTxns ?? []
    return rows
      .filter((t) => t.transaction_date > todayIso && (t.is_recurring || t.budget_behavior === 'fixed'))
      .reduce((sum, t) => sum + Number(t.amount), 0)
  }, [monthExpenseTxns, todayIso])

  const budgetBlockByCategoryId = useMemo(() => {
    const map = new Map<string, HomeBudgetBlockId>()
    const rows = homeBudgetLines?.categoryLines ?? []
    for (const line of rows) {
      if (!line.category_id) continue
      const blockId = mapBudgetBucketToHomeBlock(line.budget_bucket)
      if (!blockId) continue
      map.set(line.category_id, blockId)
    }
    return map
  }, [homeBudgetLines?.categoryLines])

  const blockBudgetById = useMemo(() => {
    const byBlock = new Map<HomeBudgetBlockId, number>()
    const rows = homeBudgetLines?.categoryLines ?? []
    for (const line of rows) {
      const blockId = mapBudgetBucketToHomeBlock(line.budget_bucket)
      if (!blockId) continue
      byBlock.set(blockId, (byBlock.get(blockId) ?? 0) + Number(line.amount))
    }
    return byBlock
  }, [homeBudgetLines?.categoryLines])

  const spentToDateByBlock = useMemo(() => {
    const byBlock = new Map<HomeBudgetBlockId, number>()
    const rows = monthExpenseTxns ?? []
    for (const txn of rows) {
      if (txn.transaction_date > todayIso) continue
      const mappedCategoryBlock = txn.category_id ? budgetBlockByCategoryId.get(txn.category_id) ?? null : null
      const fallbackBlock = txn.budget_behavior === 'fixed' ? 'fixe' : txn.budget_behavior === 'variable' ? 'variable_essentiel' : null
      const blockId = mappedCategoryBlock ?? fallbackBlock
      if (!blockId) continue
      byBlock.set(blockId, (byBlock.get(blockId) ?? 0) + Number(txn.amount))
    }
    return byBlock
  }, [budgetBlockByCategoryId, monthExpenseTxns, todayIso])

  const plannedObligationsByBlock = useMemo(() => {
    const byBlock = new Map<HomeBudgetBlockId, { count: number; amount: number }>()
    const rows = recurringObligations ?? []

    for (const obligation of rows) {
      const dueIso = resolveObligationDueDateForMonth(obligation, year, month)
      if (!dueIso || dueIso <= todayIso) continue
      if (!obligation.category_id) continue
      const blockId = budgetBlockByCategoryId.get(obligation.category_id)
      if (!blockId) continue
      const previous = byBlock.get(blockId) ?? { count: 0, amount: 0 }
      previous.count += 1
      previous.amount += Number(obligation.amount ?? 0)
      byBlock.set(blockId, previous)
    }

    return byBlock
  }, [budgetBlockByCategoryId, month, recurringObligations, todayIso, year])

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
      if (preset.id === 'per') {
        const perAccount = source.find((account) => account.id === PER_ACCOUNT_ID)
        if (perAccount) return { preset, account: perAccount }
      }
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
  const [selectedDriftCategoryId, setSelectedDriftCategoryId] = useState<string | null>(null)
  const [showDriftCategoryModal, setShowDriftCategoryModal] = useState(false)

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
    if (!showAccountsModal && !showDriftCategoryModal) return
    return lockDocumentScroll()
  }, [showAccountsModal, showDriftCategoryModal])

  const selectedAccountEntry = useMemo<HomeAccountEntry | null>(() => {
    if (!accountEntries.length) return null
    if (!selectedAccountPresetId) return accountEntries[0]
    return accountEntries.find((entry) => entry.preset.id === selectedAccountPresetId) ?? accountEntries[0]
  }, [accountEntries, selectedAccountPresetId])

  const selectedAccount = selectedAccountEntry?.account ?? null
  const { data: selectedAccountTxns } = useTransactions({
    accountId: selectedAccount?.id ?? null,
    debugSource: 'Home:selectedAccountTxns',
  })
  const selectedPresetId = selectedAccountEntry?.preset.id ?? null
  const isLivretA = selectedPresetId === 'livret_a'
  const isLDDS = selectedPresetId === 'ldds'
  const isPER = selectedPresetId === 'per'
  const isPEA = selectedPresetId === 'pea'
  const isMainCheckingAccount = selectedPresetId === 'compte_principal'
  const isProjectionSavingsAccount = isLivretA || isLDDS
  const isSavingsBooklet =
    selectedAccountEntry != null
    && (SAVINGS_BOOKLET_IDS as readonly string[]).includes(selectedAccountEntry.preset.id)
  const selectedBalance = Number(selectedAccount?.current_balance ?? 0)
  const [homeInsightsSlide, setHomeInsightsSlide] = useState<0 | 1 | 2>(0)
  const [homeVisionMode, setHomeVisionMode] = useState<HomeVisionMode>('to_date')

  const mainAccountResteUtile = useMemo(() => (
    selectedBalance
    - fixedChargesToDate
    - variableSpentToDate
    - savingsContributionsToDate
    - certainUpcomingExpenses
  ), [
    certainUpcomingExpenses,
    fixedChargesToDate,
    savingsContributionsToDate,
    selectedBalance,
    variableSpentToDate,
  ])

  const mainAccountDailyAvailable = useMemo(() => {
    if (daysRemaining <= 0) return mainAccountResteUtile
    return mainAccountResteUtile / daysRemaining
  }, [daysRemaining, mainAccountResteUtile])

  const homeVisionRows = useMemo<HomeVisionBlockRow[]>(() => (
    HOME_VISION_BLOCKS.map((block) => {
      const budgetAmount = blockBudgetById.get(block.id) ?? 0
      const spentToDate = spentToDateByBlock.get(block.id) ?? 0
      const planned = plannedObligationsByBlock.get(block.id) ?? { count: 0, amount: 0 }
      const consumedAmount = homeVisionMode === 'end_of_month'
        ? spentToDate + planned.amount
        : spentToDate
      const consumedRatio = budgetAmount > 0 ? (consumedAmount / budgetAmount) * 100 : 0

      return {
        ...block,
        budgetAmount,
        spentToDate,
        plannedOperationsCount: planned.count,
        plannedOperationsAmount: planned.amount,
        consumedAmount,
        consumedRatio,
      }
    })
  ), [blockBudgetById, homeVisionMode, plannedObligationsByBlock, spentToDateByBlock])

  const handleOpenAccountsModal = useCallback(() => {
    setShowAccountsModal((current) => !current)
  }, [])

  const handleSelectAccountPreset = useCallback((presetId: string) => {
    setSelectedAccountPresetId(presetId)
    setShowAccountsModal(false)
  }, [])

  useEffect(() => {
    if (!isMainCheckingAccount) setHomeInsightsSlide(0)
  }, [isMainCheckingAccount])

  const heroMetrics = useMemo(
    () => [
      { key: 'reste', label: 'Reste utile', value: formatMoneyInteger(resteUtile) },
      { key: 'jour', label: 'Budget / jour', value: formatMoneyInteger(budgetParJour) },
      { key: 'avenir', label: 'Dépenses à venir', value: formatMoneyInteger(plannedFuture) },
      { key: 'fin', label: 'Fin de mois', value: formatMoneyInteger(previsionFinDeMois) },
    ],
    [budgetParJour, plannedFuture, previsionFinDeMois, resteUtile],
  )

  const mainCheckingHeroMetrics = useMemo(
    () => [
      { key: 'variable-budget', label: 'Budget variable', value: formatMoneyInteger(variableBudgetMonthly) },
      { key: 'variable-spent', label: 'Variable consommé', value: formatMoneyInteger(variableSpentToDate) },
      { key: 'reste-utile-main', label: 'Reste utile', value: formatMoneyInteger(variableSpentToDate > variableBudgetMonthly ? 0 : mainAccountResteUtile) },
      { key: 'daily-available', label: 'Disponible / jour', value: formatMoneyInteger(variableSpentToDate > variableBudgetMonthly ? 0 : mainAccountDailyAvailable) },
    ],
    [mainAccountDailyAvailable, mainAccountResteUtile, variableBudgetMonthly, variableSpentToDate],
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

  const projectionSavingsHeroMetrics = useMemo(() => {
    if (!isProjectionSavingsAccount) return []
    const interests2025 = isLivretA ? '522€' : '57€'
    const accountKey = isLivretA ? 'livret-a' : 'ldds'

    return [
      { key: `statut-${accountKey}`, label: 'Statut', value: 'Plafond atteint' },
      { key: `liquidite-${accountKey}`, label: 'Liquidité', value: 'Disponible' },
      { key: `taux-${accountKey}`, label: "Taux d’intérêt", value: '1,5%' },
      { key: `interets-2025-${accountKey}`, label: 'Intérêts 2025', value: interests2025 },
    ]
  }, [isLivretA, isProjectionSavingsAccount])

  const displayedHeroMetrics = isProjectionSavingsAccount
    ? projectionSavingsHeroMetrics
    : isPER
      ? [
          { key: 'per-versement', label: 'Dernier versement', value: 'Décembre 2025' },
          { key: 'per-liquidite', label: 'Liquidité', value: 'Sous conditions' },
          { key: 'per-plus-value-2025', label: 'Plus-value 2025', value: '+265€' },
          { key: 'per-objectif-2026', label: 'Objectif épargne 2026', value: '+3k€' },
        ]
      : isPEA
        ? [
            { key: 'pea-indice', label: 'Evolution indice', value: '+8,7%' },
            { key: 'pea-plus-value', label: 'Plus-value', value: '1305€' },
            { key: 'pea-liquidite', label: 'Liquidité', value: 'Sous conditions' },
            { key: 'pea-objectif-2026', label: 'Objectif épargne 2026', value: '+3k€' },
          ]
    : isMainCheckingAccount
      ? mainCheckingHeroMetrics
    : isSavingsBooklet
      ? savingsHeroMetrics
      : heroMetrics

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

  const projectionSavingsData = useMemo(() => {
    if (!isProjectionSavingsAccount) return []

    const currentYear = new Date().getFullYear()
    let projectedAmount = Math.max(0, selectedBalance)

    return Array.from({ length: 10 }, (_, index) => {
      const yearValue = currentYear + index + 1
      projectedAmount = projectedAmount * (1 + PROJECTION_SAVINGS_RATE)
      return {
        year: String(yearValue),
        projectedFunds: projectedAmount,
      }
    })
  }, [isProjectionSavingsAccount, selectedBalance])

  const perProjection2026Data = useMemo(() => {
    if (!isPER) return []

    let modeledBalance = Math.max(0, Number(selectedAccount?.opening_balance ?? (selectedBalance - 3000)))
    const contributionByMonth = new Set([6, 10, 12])

    return MONTHS_2026_LABELS.map((label, index) => {
      const monthNumber = index + 1
      if (contributionByMonth.has(monthNumber)) {
        modeledBalance += 1000
      }

      return {
        month: label,
        balance: modeledBalance,
      }
    })
  }, [isPER, selectedAccount?.opening_balance, selectedBalance])

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

  const selectedDriftCategoryName = useMemo(() => {
    if (!selectedDriftCategoryId) return null
    return driftRows.find((r) => r.id === selectedDriftCategoryId)?.name ?? null
  }, [selectedDriftCategoryId, driftRows])

  const selectedDriftCategoryTransactions = useMemo(() => {
    if (!selectedDriftCategoryId) return null
    const rows = monthExpenseTxns ?? []
    return rows.filter((t) => t.category_id === selectedDriftCategoryId)
  }, [selectedDriftCategoryId, monthExpenseTxns])

  const trajectoryDeltaColor =
    deltaPct == null ? 'var(--neutral-500)' : deltaPct > 0 ? 'var(--color-error)' : 'var(--color-success)'
  const accountVisualGroup = resolveAccountVisualGroup(selectedAccountEntry?.preset.id)
  const heroPrimaryColor = accountVisualGroup === 'savings'
    ? 'var(--color-success)'
    : accountVisualGroup === 'invest'
      ? 'var(--color-warning)'
      : 'var(--primary-500)'
  const heroAmountColor = accountVisualGroup === 'savings'
    ? 'color-mix(in oklab, var(--color-success) 58%, var(--neutral-900) 42%)'
    : accountVisualGroup === 'invest'
      ? 'color-mix(in oklab, var(--color-warning) 56%, var(--neutral-900) 44%)'
      : 'var(--primary-700)'

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
                color: heroAmountColor,
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
              background: heroPrimaryColor,
              color: 'var(--neutral-0)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-lg)',
              display: 'grid',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 'var(--space-3)' }}>
              {displayedHeroMetrics.map((metric) => (
                <div
                  key={metric.key}
                  style={{
                    background: `color-mix(in oklab, ${heroPrimaryColor} 12%, var(--neutral-0) 88%)`,
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3)',
                    border: `1px solid color-mix(in oklab, ${heroPrimaryColor} 28%, var(--neutral-0) 72%)`,
                    display: 'grid',
                    gap: 'var(--space-1)',
                    justifyItems: 'center',
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: isProjectionSavingsAccount || isPER || isPEA ? 10 : 9,
                      fontWeight: 'var(--font-weight-semibold)',
                      textTransform: 'uppercase',
                      color: 'var(--neutral-700)',
                      letterSpacing: '0.06em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {metric.label}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: isProjectionSavingsAccount || isPER || isPEA ? 13 : 11,
                      fontWeight: 'var(--font-weight-bold)',
                      color: 'var(--neutral-900)',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
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
            padding: 'var(--space-2) 0',
            borderBottom: '1px solid var(--neutral-200)',
            display: 'grid',
            gap: 'var(--space-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-900)', letterSpacing: '0.01em' }}>
              {isMainCheckingAccount
                ? (
                  homeInsightsSlide === 0
                    ? 'Trajectoire · Consommé VS réel'
                    : homeInsightsSlide === 1
                      ? 'Consommé par bloc'
                      : `Catégories en dérive · ${getMonthLabel(year, month)}`
                )
                : isPEA
                  ? "Évolution de l'indice ETF · 1 an · à faire plus tard"
                  : isPER
                    ? 'Évolution du solde · Simulation 2026 · +1000€ en juin, octobre et décembre'
                    : isProjectionSavingsAccount
                      ? 'Évolution des fonds · Projection sur 10 ans à 1,5%'
                      : isSavingsBooklet
                        ? 'Évolution des intérêts · Courbe sur 10 ans'
                        : 'Trajectoire · Prévisions VS Réel'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {isMainCheckingAccount && homeInsightsSlide === 1 ? (
                <div style={{ display: 'inline-flex', padding: 2, borderRadius: 'var(--radius-full)', background: 'var(--neutral-100)', border: '1px solid var(--neutral-200)' }}>
                  <button
                    type="button"
                    onClick={() => setHomeVisionMode('to_date')}
                    aria-pressed={homeVisionMode === 'to_date'}
                    style={{
                      border: 'none',
                      borderRadius: 'var(--radius-full)',
                      background: homeVisionMode === 'to_date' ? 'var(--neutral-0)' : 'transparent',
                      color: homeVisionMode === 'to_date' ? 'var(--neutral-900)' : 'var(--neutral-500)',
                      fontSize: 10,
                      fontWeight: 'var(--font-weight-semibold)',
                      padding: '3px 8px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    À date
                  </button>
                  <button
                    type="button"
                    onClick={() => setHomeVisionMode('end_of_month')}
                    aria-pressed={homeVisionMode === 'end_of_month'}
                    style={{
                      border: 'none',
                      borderRadius: 'var(--radius-full)',
                      background: homeVisionMode === 'end_of_month' ? 'var(--neutral-0)' : 'transparent',
                      color: homeVisionMode === 'end_of_month' ? 'var(--neutral-900)' : 'var(--neutral-500)',
                      fontSize: 10,
                      fontWeight: 'var(--font-weight-semibold)',
                      padding: '3px 8px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    Fin de mois
                  </button>
                </div>
              ) : null}
              {isMainCheckingAccount && homeInsightsSlide === 1 ? (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-500)', fontWeight: 'var(--font-weight-semibold)', whiteSpace: 'nowrap' }}>
                  {`${daysRemaining} j restants`}
                </p>
              ) : !isMainCheckingAccount ? null : isSavingsBooklet || isPER || isPEA ? null : (
                <p style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: trajectoryDeltaColor, fontFamily: 'var(--font-mono)' }}>
                  {deltaPct == null ? '—' : `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%`}
                </p>
              )}
            </div>
          </div>

          <div style={{ height: 420 }}>
            {isMainCheckingAccount ? (
              <div style={{ height: '100%', display: 'grid', gridTemplateRows: '1fr auto', gap: 'var(--space-2)' }}>
                <div
                  style={{
                    minHeight: 0,
                    overflow: 'hidden',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--neutral-200)',
                    background: 'var(--neutral-0)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      width: '300%',
                      height: '100%',
                      transform: `translateX(-${homeInsightsSlide * (100 / 3)}%)`,
                      transition: 'transform 420ms ease',
                    }}
                  >
                    <div style={{ flex: '0 0 calc(100% / 3)', minWidth: 0, padding: 'var(--space-2)' }}>
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
                    <div style={{ flex: '0 0 calc(100% / 3)', minWidth: 0, padding: 'var(--space-2)', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                        {homeVisionRows.map((row) => {
                          const progressWidth = `${Math.max(0, Math.min(100, row.consumedRatio)).toFixed(1)}%`
                          return (
                            <div
                              key={row.id}
                              style={{
                                display: 'grid',
                                gap: 'var(--space-1)',
                                paddingBottom: 'var(--space-2)',
                                borderBottom: '1px solid var(--neutral-100)',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-1)', minHeight: 20, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, fontWeight: 'var(--font-weight-semibold)', color: 'var(--neutral-800)', minWidth: 0 }}>
                                  {row.label}
                                </span>
                                {homeVisionMode === 'end_of_month' ? (
                                  <span style={{ fontSize: 10, color: 'var(--neutral-600)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    {row.plannedOperationsCount} opération{row.plannedOperationsCount > 1 ? 's' : ''} planifiée{row.plannedOperationsCount > 1 ? 's' : ''}{row.plannedOperationsCount > 0 ? ` : ${formatMoneyInteger(row.plannedOperationsAmount)}` : ''}
                                  </span>
                                ) : null}
                                <span style={{ fontSize: 11, fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', marginLeft: 'auto', flexShrink: 0 }}>
                                  {formatMoneyInteger(row.budgetAmount)}
                                </span>
                              </div>

                              <div style={{ height: 6, borderRadius: 'var(--radius-full)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: progressWidth,
                                    height: '100%',
                                    background: row.color,
                                    borderRadius: 'var(--radius-full)',
                                    transition: 'width var(--transition-base)',
                                  }}
                                />
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', fontSize: 10, color: 'var(--neutral-600)', fontFamily: 'var(--font-mono)' }}>
                                <span>
                                  {homeVisionMode === 'to_date'
                                    ? `${formatMoneyInteger(row.spentToDate)}`
                                    : `${formatMoneyInteger(row.consumedAmount)}`}
                                </span>
                                <span style={{ color: 'var(--neutral-700)', fontWeight: 'var(--font-weight-semibold)' }}>
                                  {`${row.consumedRatio.toFixed(0)}%`}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <div style={{ flex: '0 0 calc(100% / 3)', minWidth: 0, padding: 'var(--space-2) var(--space-3)' }}>
                      {loadingSummaries ? (
                        <p style={{ margin: 0, height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', fontSize: 12, fontWeight: 'var(--font-weight-regular)', color: 'var(--neutral-400)' }}>
                          Chargement…
                        </p>
                      ) : driftRows.length === 0 ? (
                        <p style={{ margin: 0, height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', fontSize: 12, fontWeight: 'var(--font-weight-regular)', color: 'var(--neutral-400)' }}>
                          Aucune donnée
                        </p>
                      ) : (
                        <div style={{ height: '100%', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                          {driftRows.map((row) => {
                            const drift = Number(row.driftPct ?? 0)
                            const driftColor = drift > 0 ? 'var(--color-error)' : drift < 0 ? 'var(--color-success)' : 'var(--neutral-500)'
                            return (
                              <button
                                key={row.id}
                                type="button"
                                onClick={() => {
                                  setSelectedDriftCategoryId(row.id)
                                  setShowDriftCategoryModal(true)
                                }}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr auto',
                                  alignItems: 'center',
                                  gap: 'var(--space-2)',
                                  minHeight: 40,
                                  padding: '8px 0',
                                  borderBottom: '1px solid var(--neutral-100)',
                                  lineHeight: 1.4,
                                  width: '100%',
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  transition: 'background-color var(--transition-fast)',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'var(--neutral-50)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                              >
                                <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center', minWidth: 0 }}>
                                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 'var(--font-weight-regular)', color: 'var(--neutral-800)' }}>
                                    {row.name}
                                  </span>
                                  <span style={{ fontSize: 12, fontWeight: 'var(--font-weight-semibold)', color: driftColor, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    {`${drift > 0 ? '+' : ''}${drift.toFixed(0)}%`}
                                  </span>
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 'var(--font-weight-regular)', color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                                  {formatMoneyInteger(Number(row.spent ?? 0))}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {[0, 1, 2].map((idx) => (
                    <button
                      key={idx}
                      type="button"
                      aria-label={idx === 0 ? 'Afficher la trajectoire' : idx === 1 ? 'Afficher la vision globale' : 'Afficher les catégories en dérive'}
                      onClick={() => setHomeInsightsSlide(idx as 0 | 1 | 2)}
                      style={{
                        width: homeInsightsSlide === idx ? 18 : 8,
                        height: 8,
                        borderRadius: 'var(--radius-full)',
                        border: 'none',
                        padding: 0,
                        background: homeInsightsSlide === idx ? 'var(--primary-500)' : 'var(--neutral-300)',
                        cursor: 'pointer',
                        transition: 'width var(--transition-base), background-color var(--transition-fast)',
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : isPEA ? (
              <div
                style={{
                  height: '100%',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px dashed var(--neutral-300)',
                  background: 'color-mix(in oklab, var(--color-warning) 8%, var(--neutral-0) 92%)',
                  color: 'var(--neutral-700)',
                  textAlign: 'center',
                  padding: 'var(--space-5)',
                }}
              >
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>
                  Évolution de l’indice ETF sur 1 an: à faire plus tard
                </p>
              </div>
            ) : isPER ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={perProjection2026Data}>
                  <CartesianGrid stroke="var(--neutral-200)" strokeDasharray="3 6" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--neutral-400)' }} axisLine={false} tickLine={false} />
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
                    formatter={(value: number) => [formatMoneyInteger(Number(value)), 'Solde modélisé']}
                    labelFormatter={(label) => `2026 · ${label}`}
                  />
                  <Line type="monotone" dataKey="balance" name="Solde modélisé" stroke="var(--color-success)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : isProjectionSavingsAccount ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projectionSavingsData}>
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
                    formatter={(value: number) => [formatMoneyInteger(Number(value)), 'Fonds projetés']}
                    labelFormatter={(label) => `Année ${label}`}
                  />
                  <Line type="monotone" dataKey="projectedFunds" name="Fonds projetés" stroke="var(--color-success)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : isSavingsBooklet ? (
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

      <DriftCategoryTransactionsModal
        open={showDriftCategoryModal}
        onClose={() => {
          setShowDriftCategoryModal(false)
          setSelectedDriftCategoryId(null)
        }}
        categoryName={selectedDriftCategoryName}
        categoryTransactions={selectedDriftCategoryTransactions}
        loading={loadingSummaries}
      />
    </div>
  )
}
