import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ChevronDown } from 'lucide-react'
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
  ReferenceDot,
  ReferenceLine,
} from 'recharts'
import { useAccounts } from '@/hooks/useAccounts'
import { useBudgetSummaries } from '@/hooks/useBudgets'
import {
  getCurrentPeriod,
  getDaysRemainingInMonth,
  getMonthLabel,
} from '@/lib/utils'
import type { AccountWithBalance, Transaction } from '@/lib/types'
import { useTransactions } from '@/hooks/useTransactions'
import { PageHeader } from '@/components/layout/PageHeader'
import { lockDocumentScroll } from '@/lib/scrollLock'
import { TransactionDetailsModal } from '@/components/modals/TransactionDetailsModal'
import { getBudgetLinesForPeriod } from '@/features/budget/api/getBudgetLinesForPeriod'
import type { BudgetLineWithCategory } from '@/features/budget/types'
import { supabase } from '@/lib/supabase'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { useHomeDailyBudgetPayload } from '@/features/home/hooks/useHomeDailyBudgetPayload'
import { BUCKET_LABELS, BUCKET_COLORS, PILOTAGE_BUCKET_ORDER } from '@/features/annual-analysis/components/_constants'
import comptePrincipalIcon from "@/assets/icons/accounts/compte_principal_banque_populaire.png";
import compteJointIcon from "@/assets/icons/accounts/banque_postale_compte_joint.png";
import peaIcon from "@/assets/icons/accounts/boursorama_pea.png";
import percolIcon from "@/assets/icons/accounts/amundi_epargne.png";
import cryptoIcon from "@/assets/icons/accounts/bitcoin.png";

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

type RecurringOperationRow = {
  id: string
  due_day?: number | null
  day_of_month?: number | null
  operation_day?: number | null
  planned_day?: number | null
  starts_on?: string | null
  ends_on?: string | null
  is_active?: boolean | null
  recurrence_frequency?: string | null
}

type AccountVisualGroup = 'checking' | 'savings' | 'invest'

const HOME_ACCOUNT_PRESETS: HomeAccountPreset[] = [
  { id: 'compte_principal', label: 'Compte principal', iconSrc: comptePrincipalIcon, keywords: ['compte principal', 'courant principal', 'principal'] },
  { id: 'compte_joint', label: 'Compte joint', iconSrc: compteJointIcon, keywords: ['compte joint', 'joint'], iconScale: 1.22 },
  { id: 'livret_a', label: 'Epargne', iconSrc: comptePrincipalIcon, keywords: ['livret a', 'epargne'] },
  { id: 'placements', label: 'Placements', iconSrc: peaIcon, keywords: ['placements', 'pea'], iconScale: 1.22 },
  { id: 'per', label: 'PER', iconSrc: comptePrincipalIcon, keywords: ['per'] },
  { id: 'pea', label: 'PEA', iconSrc: peaIcon, keywords: ['pea'], iconScale: 1.22 },
  { id: 'epargne_percol', label: 'Epargne PERCOL', iconSrc: percolIcon, keywords: ['percol', 'amundi'], iconScale: 1.22 },
  { id: 'compte_crypto', label: 'Compte crypto', iconSrc: cryptoIcon, keywords: ['crypto', 'bitcoin'], missing: true },
]

const VISIBLE_ACCOUNT_PRESET_IDS = new Set(['compte_principal', 'compte_joint', 'livret_a', 'placements'])

function mapPresetIdToDisplayed(presetId: string): string {
  if (presetId === 'per') {
    return 'livret_a'
  }
  if (presetId === 'pea' || presetId === 'epargne_percol' || presetId === 'compte_crypto') {
    return 'placements'
  }
  return presetId
}

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

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
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
  const trajectoryYear = 2026
  const now = new Date()
  const maxTrajectoryMonth = now.getFullYear() <= trajectoryYear
    ? (now.getFullYear() < trajectoryYear ? 12 : now.getMonth() + 1)
    : 12
  const [selectedTrajectoryMonth, setSelectedTrajectoryMonth] = useState<number>(Math.min(Math.max(month, 1), maxTrajectoryMonth))
  const [showTrajectoryMonthMenu, setShowTrajectoryMonthMenu] = useState(false)
  const { data: accounts } = useAccounts()
  const { data: summaries, isLoading: loadingSummaries } = useBudgetSummaries(year, month)
  const { data: trajectorySummaries } = useBudgetSummaries(trajectoryYear, selectedTrajectoryMonth)
  const { data: dailyPayload } = useHomeDailyBudgetPayload(year, month)

  const totalBudget = summaries?.reduce((s, b) => s + b.budget_amount, 0) ?? 0
  const trajectoryTotalBudget = trajectorySummaries?.reduce((s, b) => s + b.budget_amount, 0) ?? 0

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
  const trajectoryMonthStart = new Date(trajectoryYear, selectedTrajectoryMonth - 1, 1).toISOString().slice(0, 10)
  const trajectoryMonthEnd = new Date(trajectoryYear, selectedTrajectoryMonth, 0).toISOString().slice(0, 10)
  const trajectoryDaysInMonth = new Date(trajectoryYear, selectedTrajectoryMonth, 0).getDate()
  const trajectoryIsCurrentMonth = now.getFullYear() === trajectoryYear && now.getMonth() + 1 === selectedTrajectoryMonth
  const trajectoryDaysElapsed = trajectoryIsCurrentMonth ? now.getDate() : trajectoryDaysInMonth
  const trajectoryCutoffIso = trajectoryIsCurrentMonth ? todayIso : trajectoryMonthEnd
  const { data: trajectoryMonthExpenseTxns } = useTransactions({
    startDate: trajectoryMonthStart,
    endDate: trajectoryMonthEnd,
    flowType: 'expense',
  })
  const { data: recurringOperationsRows } = useQuery<RecurringOperationRow[]>({
    queryKey: ['home', 'recurring-operations', trajectoryYear, selectedTrajectoryMonth],
    queryFn: async () => {
      const recurringTableQuery = supabase
        .schema('budget_dashboard')
        .from('recurring_operations' as any)
        .select('*')

      const { data: recurringData, error: recurringError } = await recurringTableQuery
      if (!recurringError && Array.isArray(recurringData)) return recurringData as unknown as RecurringOperationRow[]

      const fallbackQuery = supabase
        .schema('budget_dashboard')
        .from('recurring_obligations')
        .select('id, due_day, starts_on, ends_on, is_active, recurrence_frequency')
      const { data: fallbackData } = await fallbackQuery
      return (fallbackData ?? []) as RecurringOperationRow[]
    },
    staleTime: 60_000,
  })
  const trajectoryPreviousMonthYear = selectedTrajectoryMonth === 1 ? trajectoryYear - 1 : trajectoryYear
  const trajectoryPreviousMonth = selectedTrajectoryMonth === 1 ? 12 : selectedTrajectoryMonth - 1
  const trajectoryPreviousMonthStart = new Date(trajectoryPreviousMonthYear, trajectoryPreviousMonth - 1, 1).toISOString().slice(0, 10)
  const trajectoryPreviousMonthEnd = new Date(trajectoryPreviousMonthYear, trajectoryPreviousMonth, 0).toISOString().slice(0, 10)
  const { data: previousMonthExpenseTxns } = useTransactions({
    startDate: trajectoryPreviousMonthStart,
    endDate: trajectoryPreviousMonthEnd,
    flowType: 'expense',
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

  const driftCategories = useMemo(() => {
    const rows = trajectorySummaries ?? []
    const txns = trajectoryMonthExpenseTxns ?? []

    return rows
      .filter((r) => r.budget_amount > 0)
      .map((r) => {
        const budget = Number(r.budget_amount)
        const spent = Number(r.spent_amount)
        const driftPct = (spent / budget) * 100 - 100

        // Calculer la date de dépassement
        let exceedDateStr = null
        if (driftPct >= 0) {
          const categoryTxns = txns
            .filter(t => t.category_id === r.category.id && t.transaction_date <= trajectoryCutoffIso)
            .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
          
          let cumul = 0
          for (const t of categoryTxns) {
            cumul += Number(t.amount)
            if (cumul > budget) {
              const d = t.transaction_date
              exceedDateStr = `${d.slice(8, 10)}/${d.slice(5, 7)}`
              break
            }
          }
        }

        return {
          id: r.category.id,
          name: r.category.name,
          iconKey: r.category.icon_key,
          colorToken: r.category.color_token,
          spent: r.spent_amount,
          driftPct,
          exceedDate: exceedDateStr
        }
      })
      .filter((r) => r.driftPct >= 0)
      .sort((a, b) => b.driftPct - a.driftPct)
      .slice(0, 6)
  }, [trajectorySummaries, trajectoryMonthExpenseTxns, trajectoryCutoffIso])

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
  const [trajectorySelectedTxn, setTrajectorySelectedTxn] = useState<Transaction | null>(null)
  const [trajectoryLinkError, setTrajectoryLinkError] = useState<string | null>(null)
  const [showTop5ExpensesInDrift, setShowTop5ExpensesInDrift] = useState(false)
  const [selectedPlannedDay, setSelectedPlannedDay] = useState<number | null>(null)

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
    if (selectedAccountPresetId === 'ldds') {
      setSelectedAccountPresetId('livret_a')
      return
    }
    const mapped = mapPresetIdToDisplayed(selectedAccountPresetId ?? '')
    if (mapped !== selectedAccountPresetId) {
      setSelectedAccountPresetId(mapped)
    }
  }, [selectedAccountPresetId])

  useEffect(() => {
    if (!showAccountsModal && !showDriftCategoryModal) return
    return lockDocumentScroll()
  }, [showAccountsModal, showDriftCategoryModal])

  useEffect(() => {
    if (!trajectoryLinkError) return
    const timeoutId = window.setTimeout(() => setTrajectoryLinkError(null), 2200)
    return () => window.clearTimeout(timeoutId)
  }, [trajectoryLinkError])

  const selectedAccountEntry = useMemo<HomeAccountEntry | null>(() => {
    if (!accountEntries.length) return null
    if (!selectedAccountPresetId) return accountEntries[0]
    return accountEntries.find((entry) => entry.preset.id === selectedAccountPresetId) ?? accountEntries[0]
  }, [accountEntries, selectedAccountPresetId])

  const livretAAccount = useMemo(
    () => (accounts ?? []).find((account) => normalizeLabel(account.name).includes('livret a')) ?? null,
    [accounts],
  )
  const lddsAccount = useMemo(
    () => (accounts ?? []).find((account) => normalizeLabel(account.name).includes('ldds')) ?? null,
    [accounts],
  )
  const perAccount = useMemo(
    () => accountEntries.find((entry) => entry.preset.id === 'per')?.account ?? null,
    [accountEntries],
  )
  const peaAccount = useMemo(
    () => accountEntries.find((entry) => entry.preset.id === 'pea')?.account ?? null,
    [accountEntries],
  )
  const percolAccount = useMemo(
    () => accountEntries.find((entry) => entry.preset.id === 'epargne_percol')?.account ?? null,
    [accountEntries],
  )
  const cryptoAccount = useMemo(
    () => accountEntries.find((entry) => entry.preset.id === 'compte_crypto')?.account ?? null,
    [accountEntries],
  )

  const selectedAccount = selectedAccountEntry?.account ?? null
  const { data: selectedAccountTxns } = useTransactions({
    accountId: selectedAccount?.id ?? null,
    debugSource: 'Home:selectedAccountTxns',
  })
  const { data: livretATxns } = useTransactions({ accountId: livretAAccount?.id ?? null })
  const { data: lddsTxns } = useTransactions({ accountId: lddsAccount?.id ?? null })
  const selectedPresetId = selectedAccountEntry?.preset.id ?? null
  const isLivretA = selectedPresetId === 'livret_a'
  const isLDDS = selectedPresetId === 'ldds'
  const isPER = selectedPresetId === 'per'
  const isPEA = selectedPresetId === 'pea'
  const isPlacements = selectedPresetId === 'placements'
  const isMainCheckingAccount = selectedPresetId === 'compte_principal'
  const isProjectionSavingsAccount = isLivretA || isLDDS
  const isEpargneTab = selectedPresetId === 'livret_a'
  const isCombinedSavingsPage = isEpargneTab || isPlacements
  const isSavingsBooklet =
    selectedAccountEntry != null
    && (SAVINGS_BOOKLET_IDS as readonly string[]).includes(selectedAccountEntry.preset.id)
  const selectedBalance = Number(selectedAccount?.current_balance ?? 0)
  const [homeInsightsSlide, setHomeInsightsSlide] = useState<0 | 1 | 2>(0)

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
  const todayDayMonthLabel = useMemo(
    () => now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    [now],
  )
  const consumedVariablePct = useMemo(() => {
    if (variableBudgetMonthly <= 0) return 0
    return (variableSpentToDate / variableBudgetMonthly) * 100
  }, [variableBudgetMonthly, variableSpentToDate])
  const consumedVariablePctClamped = useMemo(
    () => Math.max(0, Math.min(100, consumedVariablePct)),
    [consumedVariablePct],
  )
  const consumedVariablePctDisplay = useMemo(
    () => `${Math.round(consumedVariablePct)}%`,
    [consumedVariablePct],
  )
  const resteUtileDisplay = dailyPayload?.daily_pilotage.remaining_useful_amount ?? resteUtile
  const budgetPerDayDisplay = dailyPayload?.daily_pilotage.budget_per_remaining_day ?? budgetParJour

  useEffect(() => {
    if (!import.meta.env.DEV || !dailyPayload) return
    console.log('[HomeDailyBudgetPayload]', dailyPayload)
    console.log('[Home by_bucket]', dailyPayload.by_bucket)
    console.log('[Home by_category sample]', dailyPayload.by_category?.slice(0, 5))
  }, [dailyPayload])

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

  useEffect(() => {
    setShowTop5ExpensesInDrift(false)
  }, [homeInsightsSlide, selectedTrajectoryMonth])

  useEffect(() => {
    setSelectedPlannedDay(null)
  }, [selectedTrajectoryMonth, homeInsightsSlide])

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
      { key: `taux-${accountKey}`, label: "Taux d'intérêt", value: '1,5%' },
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

  const plannedTrajectoryItems = useMemo(() => {
    const rows = recurringOperationsRows ?? []
    return rows
      .filter((row) => {
        const active = row.is_active ?? true
        if (!active) return false
        if (row.starts_on && row.starts_on > trajectoryMonthEnd) return false
        if (row.ends_on && row.ends_on < trajectoryMonthStart) return false
        return true
      })
      .map((row) => {
        const dueDayCandidates = [
          row.due_day,
          row.day_of_month,
          row.operation_day,
          row.planned_day,
        ]
        const numericDay = dueDayCandidates.find((value) => Number.isFinite(Number(value)))
        const day = Number(numericDay ?? NaN)
        return {
          row,
          day,
        }
      })
      .filter((item) => Number.isFinite(item.day) && item.day > 0 && item.day <= trajectoryDaysInMonth)
  }, [recurringOperationsRows, trajectoryDaysInMonth, trajectoryMonthEnd, trajectoryMonthStart])

  const plannedMarkerDays = useMemo(
    () => Array.from(new Set(plannedTrajectoryItems.map((item) => item.day))).sort((a, b) => a - b),
    [plannedTrajectoryItems],
  )
  const plannedMarkerDaySet = useMemo(() => new Set(plannedMarkerDays), [plannedMarkerDays])

  const plannedItemsByDay = useMemo(() => {
    const map = new Map<number, typeof plannedTrajectoryItems>()
    plannedTrajectoryItems.forEach((item) => {
      const current = map.get(item.day) ?? []
      current.push(item)
      map.set(item.day, current)
    })
    return map
  }, [plannedTrajectoryItems])

  const previousMonthTxnsByKey = useMemo(() => {
    const map = new Map<string, Transaction>()
      ; (previousMonthExpenseTxns ?? []).forEach((txn) => {
        const key = `${txn.normalized_label ?? txn.raw_label ?? ''}|${Math.round(Number(txn.amount) * 100)}|${txn.category_id ?? ''}`
        map.set(key, txn)
      })
    return map
  }, [previousMonthExpenseTxns])

  const plannedTxnsByDay = useMemo(() => {
    const map = new Map<number, Transaction[]>()
      ; (trajectoryMonthExpenseTxns ?? [])
        .filter((txn) => txn.is_recurring)
        .forEach((txn) => {
          const day = Number(txn.transaction_date.slice(8, 10))
          if (!Number.isFinite(day) || day <= 0 || day > trajectoryDaysInMonth) return
          const current = map.get(day) ?? []
          current.push(txn)
          map.set(day, current)
        })
    return map
  }, [trajectoryDaysInMonth, trajectoryMonthExpenseTxns])

  const openPreviousMonthTxnFromPlannedDay = useCallback((day: number) => {
    const plannedItems = plannedTxnsByDay.get(day) ?? []
    if (!plannedItems.length) {
      setTrajectoryLinkError('Opération planifiée introuvable pour cette date.')
      return
    }

    const plannedTxn = plannedItems[0]
    const key = `${plannedTxn.normalized_label ?? plannedTxn.raw_label ?? ''}|${Math.round(Number(plannedTxn.amount) * 100)}|${plannedTxn.category_id ?? ''}`
    const previousMonthMatch = previousMonthTxnsByKey.get(key)

    if (!previousMonthMatch) {
      setTrajectoryLinkError('Modale M-1 indisponible pour cette opération.')
      return
    }

    const previousMonthDay = Number(previousMonthMatch.transaction_date.slice(8, 10))
    const remappedDate = toIsoDate(trajectoryYear, selectedTrajectoryMonth, Number.isFinite(previousMonthDay) ? previousMonthDay : day)
    const mirroredTxn = {
      ...previousMonthMatch,
      transaction_date: remappedDate,
    }

    setTrajectorySelectedTxn(mirroredTxn)
  }, [plannedTxnsByDay, previousMonthTxnsByKey, selectedTrajectoryMonth, trajectoryYear])

  const trajectoryTooltipContent = useCallback((payload: any) => {
    if (!payload.active || !payload.payload?.length) return null
    const day = Number(payload.label)
    const actualValue = payload.payload.find((entry: any) => entry.dataKey === 'actual')?.value
    const plannedValue = payload.payload.find((entry: any) => entry.dataKey === 'planned')?.value
    const plannedCount = plannedItemsByDay.get(day)?.length ?? 0

    return (
      <div style={{ background: 'var(--neutral-0)', border: '1px solid var(--neutral-200)', borderRadius: 12, boxShadow: 'var(--shadow-sm)', fontSize: 12, padding: '8px 10px', display: 'grid', gap: 4, minWidth: 154 }}>
        <p style={{ margin: 0, fontWeight: 700, color: 'var(--neutral-800)' }}>{`Jour ${day}`}</p>
        <p style={{ margin: 0, color: 'var(--neutral-700)' }}>{`Réel: ${actualValue == null ? '—' : formatMoneyInteger(Number(actualValue))}`}</p>
        {plannedCount > 0 ? (
          <p style={{ margin: 0, color: 'var(--neutral-700)' }}>{`Planifié: ${plannedValue == null ? '—' : formatMoneyInteger(Number(plannedValue))}`}</p>
        ) : null}
        {plannedCount > 0 ? (
          <button
            type="button"
            onClick={() => openPreviousMonthTxnFromPlannedDay(day)}
            style={{
              border: '1px solid var(--neutral-200)',
              background: 'var(--neutral-0)',
              color: 'var(--neutral-700)',
              borderRadius: 'var(--radius-full)',
              minHeight: 26,
              padding: '0 10px',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            ↗ Détail M-1
          </button>
        ) : null}
      </div>
    )
  }, [openPreviousMonthTxnFromPlannedDay, plannedItemsByDay])

  const trajectoryData = useMemo(() => {
    const txns = trajectoryMonthExpenseTxns ?? []
    const daily = new Map<number, number>()
    txns.forEach((t) => {
      if (t.transaction_date < trajectoryMonthStart || t.transaction_date > trajectoryMonthEnd) return
      const day = Number(t.transaction_date.slice(8, 10))
      if (!Number.isFinite(day)) return
      if (t.transaction_date > trajectoryCutoffIso) return
      daily.set(day, (daily.get(day) ?? 0) + Number(t.amount))
    })

    let cumul = 0
    return Array.from({ length: trajectoryDaysInMonth }, (_, i) => {
      const day = i + 1
      cumul += daily.get(day) ?? 0
      const planned = trajectoryDaysInMonth > 0 ? (trajectoryTotalBudget / trajectoryDaysInMonth) * day : 0
      return {
        day,
        planned,
        plannedMarker: plannedMarkerDaySet.has(day) ? planned : null,
        actual: day <= trajectoryDaysElapsed ? cumul : null,
        overBudget: day <= trajectoryDaysElapsed && cumul > Math.max(0, Number(trajectoryTotalBudget ?? 0)) ? cumul : null,
        delta: day <= trajectoryDaysElapsed ? cumul - planned : null,
      }
    })
  }, [plannedMarkerDaySet, trajectoryCutoffIso, trajectoryDaysElapsed, trajectoryDaysInMonth, trajectoryMonthEnd, trajectoryMonthExpenseTxns, trajectoryMonthStart, trajectoryTotalBudget])

  const trajectoryDataByDay = useMemo(() => {
    const map = new Map<number, { planned: number; actual: number | null }>()
    trajectoryData.forEach((row) => {
      map.set(Number(row.day), { planned: Number(row.planned), actual: row.actual == null ? null : Number(row.actual) })
    })
    return map
  }, [trajectoryData])

  const trajectoryRealToDate = useMemo(() => {
    const rows = trajectoryMonthExpenseTxns ?? []
    return rows
      .filter((t) => t.transaction_date <= trajectoryCutoffIso)
      .reduce((sum, t) => sum + Number(t.amount), 0)
  }, [trajectoryCutoffIso, trajectoryMonthExpenseTxns])

  const trajectoryPlannedToDate = useMemo(
    () => trajectoryDaysElapsed > 0 ? (trajectoryTotalBudget / trajectoryDaysInMonth) * trajectoryDaysElapsed : 0,
    [trajectoryDaysElapsed, trajectoryDaysInMonth, trajectoryTotalBudget],
  )

  const trajectoryDeltaPct = useMemo(() => {
    if (trajectoryPlannedToDate <= 0) return null
    return ((trajectoryRealToDate - trajectoryPlannedToDate) / trajectoryPlannedToDate) * 100
  }, [trajectoryPlannedToDate, trajectoryRealToDate])

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
        iconKey: c.iconKey,
        colorToken: c.colorToken,
        exceedDate: c.exceedDate,
      })),
    [driftCategories],
  )

  const top5ExpenseRows = useMemo(() => {
    const rows = trajectoryMonthExpenseTxns ?? []
    const categoryNameById = new Map<string, string>()
      ; (trajectorySummaries ?? []).forEach((summary) => {
        categoryNameById.set(summary.category.id, summary.category.name)
      })
    const spentByCategory = new Map<string, { id: string; name: string; spent: number }>()
    rows.forEach((txn) => {
      if (txn.transaction_date > trajectoryCutoffIso || !txn.category_id) return
      const current = spentByCategory.get(txn.category_id)
      spentByCategory.set(txn.category_id, {
        id: txn.category_id,
        name: current?.name ?? categoryNameById.get(txn.category_id) ?? 'Catégorie',
        spent: (current?.spent ?? 0) + Number(txn.amount),
      })
    })

    const budgetsByCategory = new Map<string, number>()
      ; (trajectorySummaries ?? []).forEach((summary) => {
        budgetsByCategory.set(summary.category.id, Number(summary.budget_amount))
      })

    return Array.from(spentByCategory.values())
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5)
      .map((row) => {
        const budget = budgetsByCategory.get(row.id) ?? 0
        const driftPct = budget > 0 ? ((row.spent - budget) / budget) * 100 : 0
        return { ...row, driftPct }
      })
  }, [trajectoryCutoffIso, trajectoryMonthExpenseTxns, trajectorySummaries])

  const selectedDriftCategoryName = useMemo(() => {
    if (!selectedDriftCategoryId) return null
    return driftRows.find((r) => r.id === selectedDriftCategoryId)?.name ?? null
  }, [selectedDriftCategoryId, driftRows])

  const selectedDriftCategoryTransactions = useMemo(() => {
    if (!selectedDriftCategoryId) return null
    const rows = trajectoryMonthExpenseTxns ?? []
    return rows.filter((t) => t.category_id === selectedDriftCategoryId)
  }, [selectedDriftCategoryId, trajectoryMonthExpenseTxns])

  const trajectoryDeltaColor =
    trajectoryDeltaPct == null ? 'var(--neutral-500)' : trajectoryDeltaPct > 0 ? 'var(--color-error)' : 'var(--color-success)'
  const monthlyBudgetCap = Math.max(0, Number(trajectoryTotalBudget ?? 0))
  const monthlyBudgetCapLabel = formatMoneyInteger(monthlyBudgetCap)
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
  const livretABalance = Number(livretAAccount?.current_balance ?? 0)
  const lddsBalance = Number(lddsAccount?.current_balance ?? 0)
  const perBalance = Number(perAccount?.current_balance ?? 0)
  const peaBalance = Number(peaAccount?.current_balance ?? 0)
  const percolBalance = Number(percolAccount?.current_balance ?? 0)
  const cryptoBalance = Number(cryptoAccount?.current_balance ?? 0)
  const livretACeilingPct = Math.max(0, Math.min(100, (livretABalance / SAVINGS_BOOKLET_CEILINGS.livret_a) * 100))
  const lddsCeilingPct = Math.max(0, Math.min(100, (lddsBalance / SAVINGS_BOOKLET_CEILINGS.ldds) * 100))
  const combinedSavingsSections = useMemo(() => {
    if (isEpargneTab) {
      return [
        {
          id: 'livret_a',
          title: 'Livret A',
          balance: livretABalance,
          ceiling: SAVINGS_BOOKLET_CEILINGS.livret_a,
          ceilingPct: livretACeilingPct,
          txns: livretATxns ?? [],
          color: 'var(--color-success)',
          metrics: [
            { key: 'statut-livret_a', label: 'Statut', value: livretACeilingPct >= 99.5 ? 'Plafond atteint' : `${livretACeilingPct.toFixed(0)}%` },
            { key: 'liquidite-livret_a', label: 'Liquidite', value: 'Disponible' },
            { key: 'taux-livret_a', label: 'Taux', value: '1,5%' },
            { key: 'interets-2025-livret_a', label: 'Interets 2025', value: '522 EUR' },
          ],
        },
        {
          id: 'ldds',
          title: 'LDDS',
          balance: lddsBalance,
          ceiling: SAVINGS_BOOKLET_CEILINGS.ldds,
          ceilingPct: lddsCeilingPct,
          txns: lddsTxns ?? [],
          color: 'var(--color-success)',
          metrics: [
            { key: 'statut-ldds', label: 'Statut', value: lddsCeilingPct >= 99.5 ? 'Plafond atteint' : `${lddsCeilingPct.toFixed(0)}%` },
            { key: 'liquidite-ldds', label: 'Liquidite', value: 'Disponible' },
            { key: 'taux-ldds', label: 'Taux', value: '1,5%' },
            { key: 'interets-2025-ldds', label: 'Interets 2025', value: '57 EUR' },
          ],
        },
        {
          id: 'per',
          title: 'PER',
          balance: perBalance,
          ceiling: null,
          ceilingPct: null,
          txns: [],
          color: 'var(--color-success)',
          metrics: [
            { key: 'solde-per', label: 'Solde', value: formatMoneyInteger(perBalance) },
            { key: 'liquidite-per', label: 'Liquidite', value: 'Bloque' },
            { key: 'perf-per', label: 'Performance', value: '+2,3%' },
            { key: 'simulation-2026-per', label: 'Projection 2026', value: formatMoneyInteger(perBalance + 3000) },
          ],
        },
      ]
    }
    if (isPlacements) {
      return [
        {
          id: 'pea',
          title: 'PEA',
          balance: peaBalance,
          ceiling: null,
          ceilingPct: null,
          txns: [],
          color: 'var(--color-warning)',
          metrics: [
            { key: 'solde-pea', label: 'Solde', value: formatMoneyInteger(peaBalance) },
            { key: 'liquidite-pea', label: 'Liquidite', value: 'Disponible' },
            { key: 'perf-pea', label: 'Performance', value: '+8,2%' },
            { key: 'gain-pea', label: 'Gain realise', value: formatMoneyInteger(peaBalance * 0.082) },
          ],
        },
        {
          id: 'epargne_percol',
          title: 'PERCOL',
          balance: percolBalance,
          ceiling: null,
          ceilingPct: null,
          txns: [],
          color: 'var(--color-warning)',
          metrics: [
            { key: 'solde-percol', label: 'Solde', value: formatMoneyInteger(percolBalance) },
            { key: 'liquidite-percol', label: 'Liquidite', value: 'Bloque' },
            { key: 'perf-percol', label: 'Performance', value: '+1,5%' },
            { key: 'gain-percol', label: 'Gain realise', value: formatMoneyInteger(percolBalance * 0.015) },
          ],
        },
        {
          id: 'compte_crypto',
          title: 'Compte Crypto',
          balance: cryptoBalance,
          ceiling: null,
          ceilingPct: null,
          txns: [],
          color: 'var(--color-warning)',
          metrics: [
            { key: 'solde-crypto', label: 'Solde', value: formatMoneyInteger(cryptoBalance) },
            { key: 'liquidite-crypto', label: 'Liquidite', value: 'Disponible' },
            { key: 'perf-crypto', label: 'Performance', value: '+45,2%' },
            { key: 'gain-crypto', label: 'Gain realise', value: formatMoneyInteger(cryptoBalance * 0.452) },
          ],
        },
      ]
    }
    return []
  }, [isEpargneTab, isPlacements, livretABalance, livretACeilingPct, lddsBalance, lddsCeilingPct, perBalance, peaBalance, percolBalance, cryptoBalance, livretATxns, lddsTxns])

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
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
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ padding: '0 var(--space-6)' }}
      >
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          {isCombinedSavingsPage ? (
            <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
              {combinedSavingsSections.map((section) => (
                <div key={section.id} style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-700)', textAlign: 'center' }}>{section.title}</p>
                  <div style={{ display: 'grid', gap: 'var(--space-1)', justifyItems: 'center', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-kpi)', fontWeight: 'var(--font-weight-extrabold)', lineHeight: 'var(--line-height-tight)', fontFamily: 'var(--font-mono)', color: `color-mix(in oklab, ${section.color} 58%, var(--neutral-900) 42%)` }}>
                      {formatMoneyInteger(section.balance)}
                    </p>
                    {section.ceiling !== null && section.ceilingPct !== null ? (
                      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--neutral-600)' }}>
                        {`Plafond ${formatMoneyInteger(section.ceiling)} · ${section.ceilingPct.toFixed(0)}%`}
                      </p>
                    ) : null}
                  </div>
                  <div style={{ background: section.color, color: 'var(--neutral-0)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', boxShadow: 'var(--shadow-lg)', display: 'grid' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 'var(--space-3)' }}>
                      {section.metrics.map((metric) => (
                        <div key={metric.key} style={{ background: `color-mix(in oklab, ${section.color} 12%, var(--neutral-0) 88%)`, borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', border: `1px solid color-mix(in oklab, ${section.color} 28%, var(--neutral-0) 72%)`, display: 'grid', gap: 'var(--space-1)', justifyItems: 'center', textAlign: 'center' }}>
                          <p style={{ margin: 0, fontSize: 10, fontWeight: 'var(--font-weight-semibold)', textTransform: 'uppercase', color: 'var(--neutral-700)', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {metric.label}
                          </p>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {metric.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {isMainCheckingAccount ? (
                <div style={{
                  background: 'linear-gradient(140deg, #1A1730 0%, #2D2B6B 45%, #3D3AB8 100%)',
                  borderRadius: 'var(--radius-2xl)',
                  padding: 'var(--space-5)',
                  minHeight: 206,
                  boxShadow: 'var(--shadow-card)',
                  position: 'relative',
                  overflow: 'visible',
                }}>
                  <span style={{
                    position: 'absolute',
                    right: -16,
                    bottom: -20,
                    fontSize: 110,
                    fontWeight: 900,
                    fontFamily: 'var(--font-mono)',
                    color: 'rgba(255,255,255,0.04)',
                    lineHeight: 1,
                    userSelect: 'none',
                    pointerEvents: 'none',
                    letterSpacing: '-0.04em',
                  }}>
                    {now.getFullYear()}
                  </span>

                  <div style={{
                    position: 'absolute',
                    top: -60,
                    right: -60,
                    width: 200,
                    height: 200,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(91,87,245,0.25) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }} />

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <p style={{
                      margin: 0,
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.5)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}>
                      compte courant
                    </p>
                    <div
                      aria-label={`Progression consommé ${consumedVariablePctDisplay}`}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: '50%',
                        background: `conic-gradient(${consumedVariablePct > 100 ? 'rgba(252,90,90,0.98)' : 'rgba(46,212,122,0.95)'} ${consumedVariablePctClamped}%, rgba(226,228,234,0.9) ${consumedVariablePctClamped}% 100%)`,
                        display: 'grid',
                        placeItems: 'center',
                        alignSelf: 'center',
                      }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#FFFFFF', display: 'grid', placeItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                          {consumedVariablePctDisplay}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p style={{
                    margin: '2px 0 0',
                    fontSize: 'clamp(28px, 8vw, 40px)',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: '#FFFFFF',
                    lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                  }}>
                    {formatMoneyInteger(selectedAccount?.current_balance ?? 0)}
                  </p>
                  <p style={{
                    margin: '4px 0 0',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.4)',
                    letterSpacing: '0.04em',
                  }}>
                    {`solde au ${todayDayMonthLabel}`}
                  </p>

                  <div style={{ margin: 'var(--space-4) 0 var(--space-3)', height: 1, background: 'rgba(255,255,255,0.16)' }} />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', alignItems: 'start' }}>
                    <div style={{ minWidth: 0, display: 'grid', justifyItems: 'center', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>variable</p>
                      <p style={{ margin: '3px 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.9)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatMoneyInteger(variableBudgetMonthly).replace(/\s+€/, '€')}</p>
                    </div>
                    <div style={{ minWidth: 0, display: 'grid', justifyItems: 'center', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>consommé</p>
                      <p style={{ margin: '3px 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.9)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatMoneyInteger(variableSpentToDate).replace(/\s+€/, '€')}</p>
                    </div>
                    <div style={{ minWidth: 0, display: 'grid', justifyItems: 'center', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>reste utile</p>
                      <p style={{ margin: '3px 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'rgba(255,213,80,0.95)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatMoneyInteger(resteUtileDisplay).replace(/\s+€/, '€')}</p>
                    </div>
                    <div style={{ minWidth: 0, display: 'grid', justifyItems: 'center', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>budget/jour</p>
                      <p style={{ margin: '3px 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'rgba(255,213,80,0.95)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatMoneyInteger(budgetPerDayDisplay).replace(/\s+€/, '€')}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
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
                </>
              )}
            </>
          )}
        </div>
      </motion.section>

      {!isCombinedSavingsPage ? (
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
              padding: 'var(--space-1) 0',
              borderBottom: '1px solid var(--neutral-200)',
              display: 'grid',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-900)', letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isMainCheckingAccount
                    ? (
                      homeInsightsSlide === 0
                        ? 'Consommé vs réel'
                        : 'Catégories en dérive'
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
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', position: 'relative' }}>
                {isMainCheckingAccount ? (
                  <>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-600)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {getMonthLabel(trajectoryYear, selectedTrajectoryMonth)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowTrajectoryMonthMenu((current) => !current)}
                      aria-label="Choisir le mois de trajectoire"
                      style={{ border: 'none', background: 'transparent', color: 'var(--neutral-600)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, minWidth: 20, minHeight: 20, cursor: 'pointer' }}
                    >
                      <ChevronDown size={14} style={{ transform: showTrajectoryMonthMenu ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform var(--transition-base)' }} />
                    </button>
                  </>
                ) : null}
                {isMainCheckingAccount && showTrajectoryMonthMenu ? (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 20, background: 'var(--neutral-0)', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', padding: '6px', display: 'grid', gap: 2, minWidth: 160 }}>
                    {Array.from({ length: maxTrajectoryMonth }, (_, idx) => idx + 1).map((m) => (
                      <button
                        key={`trajectory-month-${m}`}
                        type="button"
                        onClick={() => {
                          setSelectedTrajectoryMonth(m)
                          setShowTrajectoryMonthMenu(false)
                        }}
                        style={{
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          background: selectedTrajectoryMonth === m ? 'var(--primary-50)' : 'transparent',
                          color: selectedTrajectoryMonth === m ? 'var(--primary-700)' : 'var(--neutral-700)',
                          textAlign: 'left',
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '6px 8px',
                          cursor: 'pointer',
                        }}
                      >
                        {getMonthLabel(trajectoryYear, m)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ height: 300 }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                          <div />
                          {!isSavingsBooklet && !isPER && !isPEA ? (
                            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: trajectoryDeltaColor, fontFamily: 'var(--font-mono)' }}>
                              {trajectoryDeltaPct == null ? '—' : `${trajectoryDeltaPct > 0 ? '+' : ''}${trajectoryDeltaPct.toFixed(1)}%`}
                            </p>
                          ) : null}
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={trajectoryData}
                            onClick={(state: any) => {
                              const day = Number(state?.activeLabel)
                              if (plannedMarkerDays.includes(day)) {
                                setSelectedPlannedDay(day)
                              } else {
                                setSelectedPlannedDay(null)
                              }
                            }}
                          >
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
                            <Tooltip content={trajectoryTooltipContent} />
                            <ReferenceLine
                              y={monthlyBudgetCap}
                              stroke="var(--neutral-400)"
                              strokeDasharray="3 4"
                              strokeOpacity={0.55}
                              ifOverflow="extendDomain"
                              label={{
                                value: monthlyBudgetCapLabel,
                                position: 'left',
                                fill: 'color-mix(in oklab, var(--color-error) 62%, var(--neutral-500) 38%)',
                                fontSize: 11,
                                textAnchor: 'end',
                                dx: -2,
                              }}
                            />
                            <Line type="monotone" dataKey="planned" stroke="var(--color-warning)" strokeWidth={1.8} dot={false} strokeDasharray="4 3" />
                            <Area
                              type="monotone"
                              dataKey="overBudget"
                              baseValue={monthlyBudgetCap}
                              stroke="none"
                              fill="var(--color-error)"
                              fillOpacity={0.14}
                              connectNulls={false}
                              isAnimationActive={false}
                            />
                            {plannedMarkerDays.map((day) => (
                              <ReferenceDot
                                key={`planned-segment-${day}`}
                                x={day}
                                y={Number(trajectoryDataByDay.get(day)?.actual ?? trajectoryDataByDay.get(day)?.planned ?? 0)}
                                r={0}
                                ifOverflow="visible"
                                shape={(props: any) => {
                                  const { cx, cy } = props
                                  return (
                                    <line
                                      x1={cx}
                                      y1={cy - 7}
                                      x2={cx}
                                      y2={cy + 7}
                                      stroke="var(--neutral-700)"
                                      strokeWidth={1.9}
                                      strokeLinecap="round"
                                      opacity={0.92}
                                    />
                                  )
                                }}
                              />
                            ))}
                            <Area type="monotone" dataKey="actual" stroke="var(--primary-500)" strokeWidth={2.3} fill="url(#actualFillHome)" dot={false} connectNulls={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                        {selectedPlannedDay != null && plannedItemsByDay.get(selectedPlannedDay)?.length ? (
                          <div style={{ marginTop: 'var(--space-2)', background: 'var(--neutral-0)', border: '1px solid var(--neutral-200)', borderRadius: 12, boxShadow: 'var(--shadow-sm)', fontSize: 12, padding: '8px 10px', display: 'grid', gap: 4 }}>
                            <p style={{ margin: 0, fontWeight: 700, color: 'var(--neutral-800)' }}>{`Jour ${selectedPlannedDay}`}</p>
                            <p style={{ margin: 0, color: 'var(--neutral-700)' }}>{`Réel: ${formatMoneyInteger(Number(trajectoryDataByDay.get(selectedPlannedDay)?.actual ?? 0))}`}</p>
                            <p style={{ margin: 0, color: 'var(--neutral-700)' }}>{`Planifié: ${formatMoneyInteger(Number(trajectoryDataByDay.get(selectedPlannedDay)?.planned ?? 0))}`}</p>
                            <button
                              type="button"
                              onClick={() => openPreviousMonthTxnFromPlannedDay(selectedPlannedDay)}
                              style={{
                                border: '1px solid var(--neutral-200)',
                                background: 'var(--neutral-0)',
                                color: 'var(--neutral-700)',
                                borderRadius: 'var(--radius-full)',
                                minHeight: 26,
                                padding: '0 10px',
                                cursor: 'pointer',
                                fontSize: 11,
                                fontWeight: 700,
                                justifySelf: 'start',
                              }}
                            >
                              ↗ Détail M-1
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div style={{ flex: '0 0 calc(100% / 3)', minWidth: 0, padding: 'var(--space-2) var(--space-3)' }}>
                        {loadingSummaries ? (
                          <p style={{ margin: 0, height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', fontSize: 12, fontWeight: 'var(--font-weight-regular)', color: 'var(--neutral-400)' }}>
                            Chargement…
                          </p>
                        ) : driftRows.length === 0 ? (
                          <div style={{ height: '100%', display: 'grid', alignContent: 'center', justifyItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
                            <p style={{ margin: 0, textAlign: 'center', fontSize: 12, fontWeight: 'var(--font-weight-regular)', color: 'var(--neutral-500)', lineHeight: 1.5 }}>
                              Rien à afficher le budget est sous contrôle. Pour le moment...
                            </p>
                            <button
                              type="button"
                              onClick={() => setShowTop5ExpensesInDrift((current) => !current)}
                              style={{
                                border: '1px solid var(--neutral-200)',
                                borderRadius: 'var(--radius-full)',
                                minHeight: 30,
                                padding: '0 12px',
                                background: 'var(--neutral-0)',
                                color: 'var(--neutral-700)',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              voir le top 5 catégories (dépenses)
                            </button>
                            {showTop5ExpensesInDrift ? (
                              <div style={{ width: '100%', display: 'grid', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                                {top5ExpenseRows.map((row, idx) => {
                                  const drift = Number(row.driftPct ?? 0)
                                  const driftColor = drift > 0 ? 'var(--color-error)' : drift < 0 ? 'var(--color-success)' : 'var(--neutral-500)'
                                  return (
                                    <p key={row.id} style={{ margin: 0, fontSize: 12, color: 'var(--neutral-700)', lineHeight: 1.35 }}>
                                      {`#${idx + 1}. ${row.name} - ${formatMoneyInteger(row.spent)} - `}
                                      <span style={{ color: driftColor, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                                        {`${drift >= 0 ? '+' : ''}${drift.toFixed(0)}%`}
                                      </span>
                                    </p>
                                  )
                                })}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div style={{ height: '100%', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                            {driftRows.map((row) => {
                              const drift = Number(row.driftPct ?? 0)
                              const color = row.colorToken || 'var(--neutral-400)'
                              
                              return (
                                <button
                                  key={row.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedDriftCategoryId(row.id)
                                    setShowDriftCategoryModal(true)
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-2)',
                                    minHeight: 36,
                                    padding: '6px 0',
                                    borderBottom: '1px solid var(--neutral-100)',
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
                                  {/* Date de dépassement */}
                                  <span style={{ 
                                    fontSize: 10, 
                                    color: 'var(--neutral-400)', 
                                    fontFamily: 'var(--font-mono)', 
                                    flexShrink: 0,
                                    width: 32,
                                    textAlign: 'left'
                                  }}>
                                    {row.exceedDate || '--/--'}
                                  </span>

                                  {/* Icône de catégorie */}
                                  <div style={{ 
                                    width: 24, 
                                    height: 24, 
                                    borderRadius: 'var(--radius-sm)', 
                                    backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, 
                                    color: color, 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    flexShrink: 0 
                                  }}>
                                    <CategoryIcon iconKey={row.iconKey} size={14} label={row.name} />
                                  </div>

                                  {/* Nom de catégorie */}
                                  <span style={{ 
                                    flex: 1, 
                                    minWidth: 0, 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis', 
                                    whiteSpace: 'nowrap', 
                                    fontSize: 12, 
                                    fontWeight: 'var(--font-weight-regular)', 
                                    color: 'var(--neutral-800)' 
                                  }}>
                                    {row.name}
                                  </span>

                                  {/* Drift Percentage */}
                                  <span style={{ 
                                    fontSize: 12, 
                                    fontWeight: 'var(--font-weight-semibold)', 
                                    color: 'var(--color-error)', 
                                    fontFamily: 'var(--font-mono)', 
                                    whiteSpace: 'nowrap', 
                                    flexShrink: 0 
                                  }}>
                                    +{drift.toFixed(0)}%
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Slide 3: Opérations planifiées */}
                      <div style={{ flex: '0 0 calc(100% / 3)', minWidth: 0, padding: 'var(--space-2) var(--space-3)' }}>
                        <div style={{ height: '100%', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--neutral-800)' }}>Opérations planifiées</h4>
                            <span style={{ fontSize: 11, color: 'var(--neutral-500)', fontWeight: 500 }}>Ce mois</span>
                          </div>

                          {(dailyPayload?.planned_operations?.count ?? 0) === 0 ? (
                            <p style={{ margin: 0, padding: 'var(--space-6) 0', textAlign: 'center', fontSize: 12, color: 'var(--neutral-400)', fontStyle: 'italic' }}>
                              Aucune opération planifiée pour le moment
                            </p>
                          ) : (
                            <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                              {(dailyPayload?.planned_operations.items ?? []).map((op, idx) => {
                                const d = op.scheduled_date
                                const dateStr = d ? `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}` : '--/--'
                                return (
                                  <div
                                    key={op.id ?? idx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 'var(--space-2)',
                                      padding: '8px 0',
                                      borderBottom: '1px solid var(--neutral-100)',
                                    }}
                                  >
                                    <span style={{ fontSize: 10, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', width: 32 }}>{dateStr}</span>
                                    <span style={{ flex: 1, fontSize: 12, color: 'var(--neutral-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(op.label ?? '—')}</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-800)', fontFamily: 'var(--font-mono)' }}>{op.amount != null ? formatMoneyInteger(Number(op.amount)) : '—'}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-1)' }}>
                    {[0, 1, 2].map((idx) => (
                      <button
                        key={idx}
                        type="button"
                        aria-label={idx === 0 ? 'Afficher la trajectoire' : idx === 1 ? 'Afficher les catégories en dérive' : 'Afficher les opérations planifiées'}
                        onClick={() => setHomeInsightsSlide(idx as 0 | 1 | 2)}
                        style={{
                          padding: '16px 12px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <div
                          style={{
                            width: homeInsightsSlide === idx ? 22 : 10,
                            height: 10,
                            borderRadius: 'var(--radius-full)',
                            background: homeInsightsSlide === idx ? 'var(--primary-500)' : 'var(--neutral-300)',
                            transition: 'width var(--transition-base), background-color var(--transition-fast)',
                          }}
                        />
                      </button>
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
                    Évolution de l'indice ETF sur 1 an: à faire plus tard
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
                    <Tooltip content={trajectoryTooltipContent} />
                    <ReferenceLine
                      y={monthlyBudgetCap}
                      stroke="var(--neutral-400)"
                      strokeDasharray="3 4"
                      strokeOpacity={0.55}
                      ifOverflow="extendDomain"
                      label={{
                        value: monthlyBudgetCapLabel,
                        position: 'left',
                        fill: 'color-mix(in oklab, var(--color-error) 62%, var(--neutral-500) 38%)',
                        fontSize: 11,
                        textAnchor: 'end',
                        dx: -2,
                      }}
                    />
                    <Line type="monotone" dataKey="planned" stroke="var(--color-warning)" strokeWidth={1.8} dot={false} strokeDasharray="4 3" />
                    <Area
                      type="monotone"
                      dataKey="overBudget"
                      baseValue={monthlyBudgetCap}
                      stroke="none"
                      fill="var(--color-error)"
                      fillOpacity={0.14}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                    {plannedMarkerDays.map((day) => (
                      <ReferenceDot
                        key={`planned-segment-secondary-${day}`}
                        x={day}
                        y={Number(trajectoryDataByDay.get(day)?.actual ?? trajectoryDataByDay.get(day)?.planned ?? 0)}
                        r={0}
                        ifOverflow="visible"
                        shape={(props: any) => {
                          const { cx, cy } = props
                          return (
                            <line
                              x1={cx}
                              y1={cy - 7}
                              x2={cx}
                              y2={cy + 7}
                              stroke="var(--neutral-700)"
                              strokeWidth={1.9}
                              strokeLinecap="round"
                              opacity={0.92}
                            />
                          )
                        }}
                      />
                    ))}
                    <Area type="monotone" dataKey="actual" stroke="var(--primary-500)" strokeWidth={2.3} fill="url(#actualFillHome)" dot={false} connectNulls={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            {trajectoryLinkError ? (
              <p style={{ margin: 0, marginTop: 'var(--space-2)', fontSize: 11, color: 'var(--color-error)', textAlign: 'center' }}>
                {trajectoryLinkError}
              </p>
            ) : null}
          </div>
        </motion.section>
      ) : null}

      {/* ── Pilotage par bucket ─────────────────────────────────────────── */}
      {isMainCheckingAccount && dailyPayload && dailyPayload.by_bucket.length > 0 ? (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.18 }}
          style={{ padding: '0 var(--space-6)' }}
        >
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <p style={{ margin: '0 0 var(--space-3)', fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Pilotage par bucket
            </p>
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              {PILOTAGE_BUCKET_ORDER.map((bucketId) => {
                const row = dailyPayload.by_bucket.find((b) => b.budget_bucket === bucketId)
                if (!row) return null
                const pct = row.budget_amount > 0 ? Math.min(100, (row.actual_amount / row.budget_amount) * 100) : 0
                const isOver = row.variance_amount > 0
                const barColor = isOver ? 'var(--color-error)' : BUCKET_COLORS[bucketId] ?? 'var(--primary-500)'
                const label = BUCKET_LABELS[bucketId] ?? bucketId
                return (
                  <div
                    key={bucketId}
                    style={{
                      background: 'var(--neutral-0)',
                      border: '1px solid var(--neutral-200)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-800)' }}>{label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <span style={{ fontSize: 11, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>
                          {formatMoneyInteger(row.actual_amount)} / {formatMoneyInteger(row.budget_amount)}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: isOver ? 'var(--color-error)' : 'var(--color-success)' }}>
                          {row.variance_pct != null ? `${isOver ? '+' : ''}${(row.variance_pct * 100).toFixed(0)}%` : '—'}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 6, borderRadius: 'var(--radius-full)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 'var(--radius-full)', background: barColor, transition: 'width 400ms ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}>
                        Reste : {row.remaining_amount >= 0 ? '' : '−'}{formatMoneyInteger(Math.abs(row.remaining_amount))}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--neutral-400)' }}>
                        {row.transaction_count} opération{row.transaction_count > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.section>
      ) : null}

      {/* ── Écarts par catégorie ────────────────────────────────────────── */}
      {isMainCheckingAccount && dailyPayload && dailyPayload.by_category.length > 0 ? (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.22 }}
          style={{ padding: '0 var(--space-6)' }}
        >
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <p style={{ margin: '0 0 var(--space-3)', fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Écarts par catégorie
            </p>
            <div style={{ background: 'var(--neutral-0)', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {[...dailyPayload.by_category]
                .filter((c) => c.actual_amount > 0 || c.budget_amount > 0)
                .sort((a, b) => {
                  if (a.variance_amount > 0 && b.variance_amount <= 0) return -1
                  if (b.variance_amount > 0 && a.variance_amount <= 0) return 1
                  if (a.remaining_amount < 0 && b.remaining_amount >= 0) return -1
                  if (b.remaining_amount < 0 && a.remaining_amount >= 0) return 1
                  return b.actual_amount - a.actual_amount
                })
                .slice(0, 12)
                .map((cat, idx, arr) => {
                  const isOver = cat.variance_amount > 0
                  const bucketLabel = BUCKET_LABELS[cat.budget_bucket] ?? cat.budget_bucket
                  return (
                    <div
                      key={cat.category_id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-3)',
                        borderBottom: idx < arr.length - 1 ? '1px solid var(--neutral-100)' : 'none',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginBottom: 2 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cat.category_name}
                          </span>
                          {cat.parent_category_name ? (
                            <span style={{ fontSize: 10, color: 'var(--neutral-400)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              · {cat.parent_category_name}
                            </span>
                          ) : null}
                        </div>
                        <span style={{
                          display: 'inline-block',
                          fontSize: 9,
                          fontWeight: 700,
                          color: BUCKET_COLORS[cat.budget_bucket] ?? 'var(--primary-500)',
                          background: `color-mix(in srgb, ${BUCKET_COLORS[cat.budget_bucket] ?? '#5B57F5'} 10%, transparent)`,
                          borderRadius: 4,
                          padding: '1px 5px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}>
                          {bucketLabel}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(48px, auto))', gap: 'var(--space-2)', alignItems: 'center', justifyItems: 'end' }}>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--neutral-400)', fontWeight: 600, textTransform: 'uppercase' }}>Budget</p>
                          <p style={{ margin: 0, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)', fontWeight: 600 }}>{cat.budget_amount > 0 ? formatMoneyInteger(cat.budget_amount) : '—'}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--neutral-400)', fontWeight: 600, textTransform: 'uppercase' }}>Consommé</p>
                          <p style={{ margin: 0, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--neutral-800)', fontWeight: 700 }}>{formatMoneyInteger(cat.actual_amount)}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--neutral-400)', fontWeight: 600, textTransform: 'uppercase' }}>Reste</p>
                          <p style={{ margin: 0, fontSize: 11, fontFamily: 'var(--font-mono)', color: cat.remaining_amount < 0 ? 'var(--color-error)' : 'var(--neutral-700)', fontWeight: 600 }}>
                            {cat.budget_amount > 0 ? formatMoneyInteger(cat.remaining_amount) : '—'}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--neutral-400)', fontWeight: 600, textTransform: 'uppercase' }}>Écart</p>
                          <p style={{ margin: 0, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: isOver ? 'var(--color-error)' : cat.variance_amount < 0 ? 'var(--color-success)' : 'var(--neutral-500)' }}>
                            {cat.variance_pct != null ? `${isOver ? '+' : ''}${(cat.variance_pct * 100).toFixed(0)}%` : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
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
                left: 'var(--space-3)',
                right: 'var(--space-3)',
                top: 0,
                zIndex: 61,
                width: 'auto',
                maxWidth: 430,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: '0 0 var(--radius-2xl) var(--radius-2xl)',
                padding: 'calc(var(--safe-top-offset) + var(--space-2)) var(--space-5) var(--space-5)',
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--space-3) var(--space-2)' }}>
                {accountEntries.filter((entry) => VISIBLE_ACCOUNT_PRESET_IDS.has(entry.preset.id)).map((entry) => {
                  const isActive = entry.preset.id === selectedAccountEntry?.preset.id || (entry.preset.id === 'placements' && selectedAccountEntry?.preset.id === 'placements')
                  return (
                    <div key={entry.preset.id} style={{ display: 'grid', justifyItems: 'center', gap: 'var(--space-2)' }}>
                      <button
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
                          width={44}
                          height={44}
                          style={{ width: 44, height: 44, objectFit: 'contain', transform: `scale(${entry.preset.iconScale ?? 1})` }}
                          loading="lazy"
                          decoding="async"
                        />
                        <span style={{ fontSize: 11, lineHeight: 1.25, fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)', color: isActive ? 'var(--primary-600)' : 'var(--neutral-700)', textAlign: 'center' }}>
                          {entry.preset.missing ? `${entry.preset.label} (à créer)` : entry.preset.label}
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <TransactionDetailsModal
        transaction={trajectorySelectedTxn}
        transactionList={trajectorySelectedTxn ? [trajectorySelectedTxn] : []}
        onClose={() => setTrajectorySelectedTxn(null)}
      />

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
