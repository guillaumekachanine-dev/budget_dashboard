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
  getCategoryColor,
  formatCurrencyFloored,
  formatCurrencyAdaptive,
  getTxLabel,
} from '@/lib/utils'
import type { AccountWithBalance } from '@/lib/types'
import { useTransactions } from '@/hooks/useTransactions'
import { PageHeader } from '@/components/layout/PageHeader'
import { lockDocumentScroll } from '@/lib/scrollLock'
import { getBudgetLinesForPeriod } from '@/features/budget/api/getBudgetLinesForPeriod'
import type { BudgetLineWithCategory } from '@/features/budget/types'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { normalizeIconKey } from '@/lib/categoryIcons'
import { useHomeDailyBudgetPayload } from '@/features/home/hooks/useHomeDailyBudgetPayload'
import { useTrajectoryData } from '@/features/home/hooks/useTrajectoryData'
import type { PlannedOperationItem } from '@/features/home/types'
import { budgetDb } from '@/lib/supabaseBudget'
import { BUCKET_LABELS, MONTH_LABELS_SHORT, PLANNED_FLOW_LABELS } from '@/features/annual-analysis/components/_constants'
import { Annual2026Hero } from '@/features/annual-analysis/components/Annual2026Hero'
import { useAnnual2026Analysis } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import comptePrincipalIcon from "@/assets/icons/accounts/compte_principal_banque_populaire.webp";
import compteJointIcon from "@/assets/icons/accounts/banque_postale_compte_joint.webp";
import peaIcon from "@/assets/icons/accounts/boursorama_pea.webp";
import percolIcon from "@/assets/icons/accounts/amundi_epargne.webp";
import cryptoIcon from "@/assets/icons/accounts/bitcoin.webp";

function formatPlannedDateShort(isoDate?: string | null): string {
  if (!isoDate) return '--/--'
  const date = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '--/--'
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function formatPlannedDateLong(isoDate?: string | null): string {
  if (!isoDate) return '--/--'
  const date = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '--/--'
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}



function plannedOperationIconKey(item: PlannedOperationItem): string | null {
  const candidates: string[] = []
  if (item.parent_category_name && item.category_name) {
    candidates.push(`${item.parent_category_name}_${item.category_name}`)
  }
  if (item.category_name) candidates.push(item.category_name)
  if (item.parent_category_name) candidates.push(item.parent_category_name)
  if (item.label) candidates.push(item.label)

  if (!candidates.length) return null

  const iconAliases: Record<string, string> = {
    frais_bancaires_impots_frais_bancaires: 'taxes_frais_frais_bancaires',
    frais_bancaires: 'taxes_frais_frais_bancaires',
    cotisations_bancaires: 'taxes_frais_frais_bancaires',
    loyer_credit: 'logement_loyer_credit',
    virement_loyer: 'logement_loyer_credit',
  }

  for (const candidate of candidates) {
    const normalized = normalizeIconKey(candidate)
    if (iconAliases[normalized]) return iconAliases[normalized]
  }

  return candidates[0]
}

type PlannedImpactDetail = {
  title: string
  text: string
  showMarker: boolean
  amount: number | null
}

function buildPlannedImpactDetail(item: PlannedOperationItem): PlannedImpactDetail {
  const isAdditionalCommitmentExpense = item.flow_type === 'expense' && item.budget_impact === 'additional_commitment'
  const impactsRemainingUseful = isAdditionalCommitmentExpense
    && (item.impacts_remaining_useful === true || Number(item.remaining_useful_impact_amount ?? 0) > 0)

  if (impactsRemainingUseful) {
    return {
      title: 'Impacte le reste utile',
      text: `Cette opération est un engagement additionnel : elle n'est pas déjà couverte par le budget du mois.`,
      showMarker: true,
      amount: Number(item.remaining_useful_impact_amount ?? 0),
    }
  }

  if (item.flow_type === 'savings') {
    return {
      title: `N'impacte pas une deuxième fois le reste utile`,
      text: `Cette opération est une allocation d'épargne déjà prise en compte dans l'épargne prévue du mois.`,
      showMarker: false,
      amount: null,
    }
  }

  if (item.flow_type === 'transfer') {
    return {
      title: 'Hors pilotage',
      text: 'Ce transfert interne est exclu du calcul du reste utile.',
      showMarker: false,
      amount: null,
    }
  }

  if (item.budget_impact === 'already_budgeted') {
    return {
      title: 'Déjà budgétisée',
      text: `Cette opération est déjà couverte par le budget du mois. Elle est affichée pour le suivi, mais elle n'est pas retirée une deuxième fois du reste utile.`,
      showMarker: false,
      amount: null,
    }
  }

  return {
    title: 'Information uniquement',
    text: `Cette opération est affichée à titre informatif et n'impacte pas le reste utile.`,
    showMarker: false,
    amount: null,
  }
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

function DriftCategoryTransactionsModal({
  open,
  onClose,
  categoryName,
  categoryColor,
  categoryTransactions,
  loading,
}: {
  open: boolean
  onClose: () => void
  categoryName: string | null
  categoryColor: string
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
              <div style={{ padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', background: categoryColor }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--neutral-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{categoryName ?? 'Catégorie'}</p>
                <button type="button" onClick={onClose} style={{ border: 'none', background: 'rgba(255,255,255,0.2)', color: 'var(--neutral-0)', width: 32, height: 32, minWidth: 32, minHeight: 32, borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label="Fermer">
                  <X size={20} />
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
                    const label = getTxLabel(tx)
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
                        <span style={{ fontSize: 13, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{formatCurrencyFloored(Number(tx.amount))}</span>
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
  const { data: trajectoryRpc } = useTrajectoryData(trajectoryYear, selectedTrajectoryMonth)
  const { summary: annual2026Summary, buckets: annual2026Buckets } = useAnnual2026Analysis()

  const totalBudget = summaries?.reduce((s, b) => s + b.budget_amount, 0) ?? 0
  const trajectoryTotalBudget = trajectoryRpc?.total_budget ?? 0

  const todayDate = now.toISOString().slice(0, 10)
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
  const trajectoryIsCurrentMonth = now.getFullYear() === trajectoryYear && now.getMonth() + 1 === selectedTrajectoryMonth
  const trajectoryDaysInMonth = trajectoryRpc?.days_in_month ?? new Date(trajectoryYear, selectedTrajectoryMonth, 0).getDate()
  const trajectoryDaysElapsed = trajectoryRpc?.days_elapsed ?? (trajectoryIsCurrentMonth ? now.getDate() : trajectoryDaysInMonth)
  const trajectoryCutoffIso = trajectoryIsCurrentMonth ? todayDate : trajectoryMonthEnd
  const { data: trajectoryMonthExpenseTxns } = useTransactions({
    startDate: trajectoryMonthStart,
    endDate: trajectoryMonthEnd,
    flowType: 'expense',
  })
  const { data: recurringOperationsRows } = useQuery<RecurringOperationRow[]>({
    queryKey: ['home', 'recurring-operations', trajectoryYear, selectedTrajectoryMonth],
    queryFn: async () => {
      const { data } = await budgetDb
        .from('recurring_obligations')
        .select('id, due_day, starts_on, ends_on, is_active, recurrence_frequency')
      return (data ?? []) as RecurringOperationRow[]
    },
    staleTime: 60_000,
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
      .filter((t) => t.transaction_date <= todayDate)
      .reduce((sum, t) => sum + Number(t.amount), 0)
  }, [monthExpenseTxns, todayDate])

  const plannedFuture = useMemo(() => {
    const rows = monthExpenseTxns ?? []
    return rows
      .filter((t) => t.is_recurring && t.transaction_date > todayDate)
      .reduce((sum, t) => sum + Number(t.amount), 0)
  }, [monthExpenseTxns, todayDate])

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
      .filter((t) => t.transaction_date <= todayDate && t.budget_behavior === 'variable')
      .reduce((sum, t) => sum + Number(t.amount), 0)
  }, [monthExpenseTxns, todayDate])

  const fixedChargesToDate = useMemo(() => {
    const rows = monthExpenseTxns ?? []
    return rows
      .filter((t) => t.transaction_date <= todayDate && t.budget_behavior === 'fixed')
      .reduce((sum, t) => sum + Number(t.amount), 0)
  }, [monthExpenseTxns, todayDate])

  const savingsContributionsToDate = useMemo(() => {
    const rows = monthSavingsTxns ?? []
    return rows
      .filter((t) => t.transaction_date <= todayDate)
      .reduce((sum, t) => sum + Number(t.amount), 0)
  }, [monthSavingsTxns, todayDate])

  const certainUpcomingExpenses = useMemo(() => {
    const rows = monthExpenseTxns ?? []
    return rows
      .filter((t) => t.transaction_date > todayDate && (t.is_recurring || t.budget_behavior === 'fixed'))
      .reduce((sum, t) => sum + Number(t.amount), 0)
  }, [monthExpenseTxns, todayDate])

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
  const [trajectoryLinkError, setTrajectoryLinkError] = useState<string | null>(null)
  const [showTop5ExpensesInDrift, setShowTop5ExpensesInDrift] = useState(false)
  const [selectedPlannedDay, setSelectedPlannedDay] = useState<number | null>(null)
  const [showResteUtileModal, setShowResteUtileModal] = useState(false)
  const [selectedPlannedOperation, setSelectedPlannedOperation] = useState<PlannedOperationItem | null>(null)

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
    if (!showAccountsModal && !showDriftCategoryModal && !showResteUtileModal && !selectedPlannedOperation) return
    return lockDocumentScroll()
  }, [showAccountsModal, showDriftCategoryModal, showResteUtileModal, selectedPlannedOperation])

  useEffect(() => {
    if (!showResteUtileModal) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowResteUtileModal(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showResteUtileModal])

  useEffect(() => {
    if (!selectedPlannedOperation) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedPlannedOperation(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectedPlannedOperation])

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
    startDate: '2024-01-01',
  })
  const { data: livretATxns } = useTransactions({ accountId: livretAAccount?.id ?? null, startDate: '2024-01-01' })
  const { data: lddsTxns } = useTransactions({ accountId: lddsAccount?.id ?? null, startDate: '2024-01-01' })
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
  const { consumedVariablePct, consumedVariablePctClamped, consumedVariablePctDisplay } = useMemo(() => {
    const pct = variableBudgetMonthly <= 0 ? 0 : (variableSpentToDate / variableBudgetMonthly) * 100
    return {
      consumedVariablePct: pct,
      consumedVariablePctClamped: Math.max(0, Math.min(100, pct)),
      consumedVariablePctDisplay: `${Math.round(pct)}%`,
    }
  }, [variableBudgetMonthly, variableSpentToDate])
  const resteUtileDisplay = dailyPayload?.daily_pilotage.remaining_useful_amount ?? resteUtile
  const budgetPerDayDisplay = dailyPayload?.daily_pilotage.budget_per_remaining_day ?? budgetParJour
  const revenueAmountDisplay = Number(dailyPayload?.realized.revenue_amount ?? 0)
  const fixedBudgetAmountDisplay = Number(dailyPayload?.budgets.fixed_budget_amount ?? 0)
  const provisionBudgetAmountDisplay = Number(dailyPayload?.budgets.provision_budget_amount ?? 0)
  const savingsBudgetAmountDisplay = Number(dailyPayload?.budgets.savings_budget_amount ?? 0)
  const variableEssentialConsumedDisplay = Number(
    dailyPayload?.by_bucket.find((bucket) => bucket.budget_bucket === 'variable_essentielle')?.actual_amount ?? 0,
  )
  const discretionaryConsumedDisplay = Number(
    dailyPayload?.by_bucket.find((bucket) => bucket.budget_bucket === 'discretionnaire')?.actual_amount ?? 0,
  )

  useEffect(() => {
    if (!import.meta.env.DEV || !dailyPayload) return
    console.log('[HomeDailyBudgetPayload]', dailyPayload)
    console.log('[Home by_bucket]', dailyPayload.by_bucket)
    console.log('[Home by_category sample]', dailyPayload.by_category?.slice(0, 5))
    console.log('[Home planned operations items]', dailyPayload?.planned_operations?.items)
  }, [dailyPayload])

  const handleOpenAccountsModal = useCallback(() => {
    setShowAccountsModal((current) => !current)
  }, [])

  const handleSelectAccountPreset = useCallback((presetId: string) => {
    const normalized = presetId === 'ldds' ? 'livret_a' : mapPresetIdToDisplayed(presetId)
    setSelectedAccountPresetId(normalized)
    setShowAccountsModal(false)
  }, [])

  useEffect(() => {
    if (!isMainCheckingAccount) setHomeInsightsSlide(0)
  }, [isMainCheckingAccount])

  useEffect(() => {
    setShowTop5ExpensesInDrift(false)
    setSelectedPlannedDay(null)
  }, [homeInsightsSlide, selectedTrajectoryMonth])

  const heroMetrics = useMemo(
    () => [
      { key: 'reste', label: 'Reste utile', value: formatCurrencyFloored(resteUtile) },
      { key: 'jour', label: 'Budget / jour', value: formatCurrencyFloored(budgetParJour) },
      { key: 'avenir', label: 'Dépenses à venir', value: formatCurrencyFloored(plannedFuture) },
      { key: 'fin', label: 'Fin de mois', value: formatCurrencyFloored(previsionFinDeMois) },
    ],
    [budgetParJour, plannedFuture, previsionFinDeMois, resteUtile],
  )

  const mainCheckingHeroMetrics = useMemo(
    () => [
      { key: 'variable-budget', label: 'Budget variable', value: formatCurrencyFloored(variableBudgetMonthly) },
      { key: 'variable-spent', label: 'Variable consommé', value: formatCurrencyFloored(variableSpentToDate) },
      { key: 'reste-utile-main', label: 'Reste utile', value: formatCurrencyFloored(variableSpentToDate > variableBudgetMonthly ? 0 : mainAccountResteUtile) },
      { key: 'daily-available', label: 'Disponible / jour', value: formatCurrencyFloored(variableSpentToDate > variableBudgetMonthly ? 0 : mainAccountDailyAvailable) },
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
    return `${formatCurrencyFloored(Number(latestSavingsDeposit.amount))} · ${formatDateShort(latestSavingsDeposit.transaction_date)}`
  }, [isSavingsBooklet, latestSavingsDeposit])

  const savingsInterestYtd2026 = useMemo(() => {
    if (!isSavingsBooklet) return 0
    const rows = selectedAccountTxns ?? []
    const hasExplicitInterest = rows.filter((txn) => {
      if (txn.transaction_date < '2026-01-01' || txn.transaction_date > todayDate) return false
      const label = `${txn.raw_label ?? ''} ${txn.normalized_label ?? ''} ${txn.merchant_name ?? ''}`
      return normalizeLabel(label).includes('interet')
    })
    if (hasExplicitInterest.length > 0) {
      return hasExplicitInterest.reduce((sum, txn) => sum + Number(txn.amount), 0)
    }
    const ytdRatio = Math.max(0, Math.min(1, (now.getMonth() + 1) / 12))
    return selectedBalance * (SAVINGS_INTEREST_RATE_BY_YEAR[2026] ?? 0.015) * ytdRatio
  }, [isSavingsBooklet, now, selectedAccountTxns, selectedBalance, todayDate])

  const projectedInterest2027 = useMemo(() => {
    if (!isSavingsBooklet) return 0
    const projectedBase = selectedBalance + savingsInterestYtd2026
    return projectedBase * (SAVINGS_INTEREST_RATE_BY_YEAR[2027] ?? 0.015)
  }, [isSavingsBooklet, savingsInterestYtd2026, selectedBalance])

  const savingsHeroMetrics = useMemo(
    () => [
      { key: 'statut', label: 'Statut', value: savingsStatusLabel },
      { key: 'versement', label: 'Dernier versement réalisé', value: latestSavingsDepositLabel },
      { key: 'interets2026', label: 'Intérêts perçus début 2026', value: formatCurrencyFloored(savingsInterestYtd2026) },
      { key: 'projection2027', label: 'Projection intérêt 2027', value: formatCurrencyFloored(projectedInterest2027) },
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

  const plannedOperationItemsByDay = useMemo(() => {
    const map = new Map<number, PlannedOperationItem[]>()
      ; (dailyPayload?.planned_operations?.items ?? []).forEach((item) => {
        const date = item.occurrence_date ?? item.planned_date
        if (!date) return
        const day = Number(date.slice(8, 10))
        if (!Number.isFinite(day) || day <= 0 || day > trajectoryDaysInMonth) return
        const current = map.get(day) ?? []
        current.push(item)
        map.set(day, current)
      })
    return map
  }, [dailyPayload?.planned_operations?.items, trajectoryDaysInMonth])

  const getPlannedOperationFromDay = useCallback((day: number) => {
    const directMatch = plannedOperationItemsByDay.get(day)?.[0] ?? null
    if (directMatch) return directMatch
    return (dailyPayload?.planned_operations?.items ?? []).find((item) => Number(item.recurrence_day_of_month ?? NaN) === day) ?? null
  }, [dailyPayload?.planned_operations?.items, plannedOperationItemsByDay])

  const openPlannedOperationDetailsFromDay = useCallback((day: number) => {
    const plannedOperation = getPlannedOperationFromDay(day)
    if (!plannedOperation) {
      setTrajectoryLinkError('Détail indisponible pour cette opération planifiée.')
      return
    }
    setSelectedPlannedOperation(plannedOperation)
  }, [getPlannedOperationFromDay])

  const plannedAmountLabelForDay = useCallback((day: number) => {
    const plannedOperation = getPlannedOperationFromDay(day)
    const plannedAmount = plannedOperation
      ? Number(plannedOperation.planned_personal_amount ?? plannedOperation.planned_amount)
      : null
    return plannedAmount != null && Number.isFinite(plannedAmount) ? formatCurrencyAdaptive(plannedAmount) : '–'
  }, [getPlannedOperationFromDay])

  const trajectoryTooltipContent = useCallback((payload: any) => {
    if (!payload.active || !payload.payload?.length) return null
    const day = Number(payload.label)
    const actualValue = payload.payload.find((entry: any) => entry.dataKey === 'actual')?.value
    const plannedValue = payload.payload.find((entry: any) => entry.dataKey === 'planned')?.value
    const hasPlannedOperation = getPlannedOperationFromDay(day) != null
    const isOverBudget = actualValue != null && plannedValue != null && Number(actualValue) > Number(plannedValue)
    return (
      <div style={{
        background: 'rgba(255,255,255,0.97)',
        border: '1px solid rgba(200,148,74,0.18)',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(28,28,58,0.12), 0 2px 8px rgba(200,148,74,0.10)',
        fontSize: 12,
        padding: '10px 13px',
        display: 'grid',
        gap: 6,
        minWidth: 156,
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'linear-gradient(135deg, #C8944A, #D4A853)',
            flexShrink: 0,
            boxShadow: '0 0 6px rgba(200,148,74,0.5)',
          }} />
          <p style={{ margin: 0, fontWeight: 700, color: '#2C2A3A', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{`Jour ${day}`}</p>
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <p style={{ margin: 0, color: '#7A7A8C', fontSize: 11 }}>Réel</p>
            <p style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 13,
              color: isOverBudget ? '#C8944A' : '#2C2A3A',
            }}>{actualValue == null ? '—' : formatCurrencyFloored(Number(actualValue))}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <p style={{ margin: 0, color: '#7A7A8C', fontSize: 11 }}>Prévu</p>
            <p style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontWeight: 500,
              fontSize: 12,
              color: '#3B7A8A',
            }}>{plannedValue == null ? '—' : formatCurrencyFloored(Number(plannedValue))}</p>
          </div>
        </div>
        {hasPlannedOperation ? (
          <div style={{ borderTop: '1px solid rgba(200,148,74,0.14)', paddingTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
            <p style={{ margin: 0, color: '#7A7A8C', fontSize: 11 }}>{`Op. : ${plannedAmountLabelForDay(day)}`}</p>
            <button
              type="button"
              aria-label="Voir le détail de l'opération planifiée"
              onClick={() => openPlannedOperationDetailsFromDay(day)}
              style={{
                border: '1px solid rgba(200,148,74,0.3)',
                background: 'rgba(200,148,74,0.06)',
                color: '#C8944A',
                borderRadius: 'var(--radius-sm)',
                width: 28,
                height: 22,
                minWidth: 28,
                minHeight: 22,
                padding: 0,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              ↗
            </button>
          </div>
        ) : null}
      </div>
    )
  }, [getPlannedOperationFromDay, openPlannedOperationDetailsFromDay, plannedAmountLabelForDay])

  const trajectoryData = useMemo(() => {
    const rpcDays = trajectoryRpc?.days ?? []
    const budget = trajectoryRpc?.total_budget ?? 0
    return rpcDays.map((d) => ({
      day: d.day,
      planned: d.planned,
      plannedMarker: plannedMarkerDaySet.has(d.day) ? d.planned : null,
      actual: d.actual,
      overBudget: d.actual != null && d.actual > Math.max(0, budget) ? d.actual : null,
      delta: d.delta,
    }))
  }, [trajectoryRpc, plannedMarkerDaySet])

  const trajectoryDataByDay = useMemo(() => {
    const map = new Map<number, { planned: number; actual: number | null }>()
    trajectoryData.forEach((row) => {
      map.set(Number(row.day), { planned: Number(row.planned), actual: row.actual == null ? null : Number(row.actual) })
    })
    return map
  }, [trajectoryData])

  const trajectoryRealToDate = useMemo(() => {
    const days = trajectoryRpc?.days ?? []
    const last = [...days].reverse().find((d) => d.actual != null)
    return last?.actual ?? 0
  }, [trajectoryRpc?.days])

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

    return MONTH_LABELS_SHORT.map((label, index) => {
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

  const selectedDriftCategoryMeta = useMemo(() => {
    if (!selectedDriftCategoryId) return null
    return driftRows.find((r) => r.id === selectedDriftCategoryId) ?? null
  }, [selectedDriftCategoryId, driftRows])
  const selectedDriftCategoryColor = useMemo(
    () => getCategoryColor(selectedDriftCategoryMeta?.colorToken ?? null, 0),
    [selectedDriftCategoryMeta?.colorToken],
  )

  const selectedDriftCategoryTransactions = useMemo(() => {
    if (!selectedDriftCategoryId) return null
    const rows = trajectoryMonthExpenseTxns ?? []
    return rows.filter((t) => t.category_id === selectedDriftCategoryId)
  }, [selectedDriftCategoryId, trajectoryMonthExpenseTxns])

  const trajectoryDeltaColor =
    trajectoryDeltaPct == null ? 'var(--neutral-500)' : trajectoryDeltaPct > 0 ? 'var(--color-error)' : 'var(--color-success)'
  const monthlyBudgetCap = Math.max(0, Number(trajectoryTotalBudget ?? 0))
  const monthlyBudgetCapLabel = formatCurrencyFloored(monthlyBudgetCap)
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
            { key: 'solde-per', label: 'Solde', value: formatCurrencyFloored(perBalance) },
            { key: 'liquidite-per', label: 'Liquidite', value: 'Bloque' },
            { key: 'perf-per', label: 'Performance', value: '+2,3%' },
            { key: 'simulation-2026-per', label: 'Projection 2026', value: formatCurrencyFloored(perBalance + 3000) },
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
            { key: 'solde-pea', label: 'Solde', value: formatCurrencyFloored(peaBalance) },
            { key: 'liquidite-pea', label: 'Liquidite', value: 'Disponible' },
            { key: 'perf-pea', label: 'Performance', value: '+8,2%' },
            { key: 'gain-pea', label: 'Gain realise', value: formatCurrencyFloored(peaBalance * 0.082) },
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
            { key: 'solde-percol', label: 'Solde', value: formatCurrencyFloored(percolBalance) },
            { key: 'liquidite-percol', label: 'Liquidite', value: 'Bloque' },
            { key: 'perf-percol', label: 'Performance', value: '+1,5%' },
            { key: 'gain-percol', label: 'Gain realise', value: formatCurrencyFloored(percolBalance * 0.015) },
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
            { key: 'solde-crypto', label: 'Solde', value: formatCurrencyFloored(cryptoBalance) },
            { key: 'liquidite-crypto', label: 'Liquidite', value: 'Disponible' },
            { key: 'perf-crypto', label: 'Performance', value: '+45,2%' },
            { key: 'gain-crypto', label: 'Gain realise', value: formatCurrencyFloored(cryptoBalance * 0.452) },
          ],
        },
      ]
    }
    return []
  }, [isEpargneTab, isPlacements, livretABalance, livretACeilingPct, lddsBalance, lddsCeilingPct, perBalance, peaBalance, percolBalance, cryptoBalance, livretATxns, lddsTxns])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
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
                      {formatCurrencyFloored(section.balance)}
                    </p>
                    {section.ceiling !== null && section.ceilingPct !== null ? (
                      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--neutral-600)' }}>
                        {`Plafond ${formatCurrencyFloored(section.ceiling)} · ${section.ceilingPct.toFixed(0)}%`}
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
                    {formatCurrencyFloored(selectedAccount?.current_balance ?? 0)}
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
                      <p style={{ margin: '3px 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.9)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCurrencyFloored(variableBudgetMonthly).replace(/\s+€/, '€')}</p>
                    </div>
                    <div style={{ minWidth: 0, display: 'grid', justifyItems: 'center', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>consommé</p>
                      <p style={{ margin: '3px 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.9)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCurrencyFloored(variableSpentToDate).replace(/\s+€/, '€')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowResteUtileModal(true)}
                      aria-label="Voir le détail du calcul du reste utile"
                      style={{ minWidth: 0, display: 'grid', justifyItems: 'center', textAlign: 'center', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                    >
                      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>reste utile</p>
                      <p style={{ margin: '3px 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'rgba(255,213,80,0.95)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCurrencyFloored(resteUtileDisplay).replace(/\s+€/, '€')}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResteUtileModal(true)}
                      aria-label="Voir le détail du calcul du budget par jour"
                      style={{ minWidth: 0, display: 'grid', justifyItems: 'center', textAlign: 'center', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                    >
                      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>budget/jour</p>
                      <p style={{ margin: '3px 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'rgba(255,213,80,0.95)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCurrencyFloored(budgetPerDayDisplay).replace(/\s+€/, '€')}</p>
                    </button>
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
                      {formatCurrencyFloored(selectedAccount?.current_balance ?? 0)}
                    </p>
                    {isSavingsBooklet && savingsBookletCeiling ? (
                      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--neutral-600)' }}>
                        {`Plafond ${formatCurrencyFloored(savingsBookletCeiling)} · ${savingsCeilingPct.toFixed(0)}%`}
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
                        : homeInsightsSlide === 1
                          ? 'Catégories en dérive'
                          : 'Opérations planifiées'
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

            <div style={{ height: 400 }}>
              {isMainCheckingAccount ? (
                <div style={{ height: '100%', display: 'grid', gridTemplateRows: '1fr auto', gap: 'var(--space-2)' }}>
                  <div
                    style={{
                      minHeight: 0,
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid rgba(200,148,74,0.14)',
                      background: 'linear-gradient(160deg, rgba(255,253,248,1) 0%, rgba(255,255,255,1) 60%)',
                      boxShadow: '0 2px 16px rgba(200,148,74,0.06)',
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
                      <div style={{ flex: '0 0 calc(100% / 3)', minWidth: 0, padding: 'var(--space-2)', paddingBottom: 'var(--space-3)' }}>
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
                            margin={{ top: 6, right: 4, left: 0, bottom: 0 }}
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
                              {/* Gradient principal : or chaud → transparent */}
                              <linearGradient id="actualFillHome" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#C8944A" stopOpacity={0.28} />
                                <stop offset="55%" stopColor="#C8944A" stopOpacity={0.08} />
                                <stop offset="100%" stopColor="#C8944A" stopOpacity={0} />
                              </linearGradient>
                              {/* Gradient zone dépassement : ambre foncé */}
                              <linearGradient id="overBudgetFillHome" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#C8944A" stopOpacity={0.22} />
                                <stop offset="100%" stopColor="#C8944A" stopOpacity={0.06} />
                              </linearGradient>
                              {/* Glow sur la ligne actual */}
                              <filter id="glowAmber" x="-20%" y="-60%" width="140%" height="220%">
                                <feGaussianBlur stdDeviation="2.5" result="blur" />
                                <feMerge>
                                  <feMergeNode in="blur" />
                                  <feMergeNode in="SourceGraphic" />
                                </feMerge>
                              </filter>
                            </defs>
                            <CartesianGrid
                              stroke="rgba(120,118,140,0.10)"
                              strokeDasharray="0"
                              vertical={false}
                              strokeWidth={1}
                            />
                            <XAxis
                              dataKey="day"
                              tick={{ fontSize: 10, fill: 'rgba(120,118,140,0.65)', fontFamily: 'var(--font-mono)' }}
                              axisLine={false}
                              tickLine={false}
                              interval={4}
                              tickMargin={6}
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: 'rgba(120,118,140,0.65)', fontFamily: 'var(--font-mono)' }}
                              axisLine={false}
                              tickLine={false}
                              width={48}
                              tickFormatter={(value) => formatCurrencyFloored(Number(value))}
                              tickCount={4}
                            />
                            <Tooltip content={trajectoryTooltipContent} cursor={{ stroke: 'rgba(200,148,74,0.25)', strokeWidth: 1.5, strokeDasharray: '3 3' }} />
                            {/* Ligne budget max : fine, bleue pétrole, très discrète */}
                            <ReferenceLine
                              y={monthlyBudgetCap}
                              stroke="rgba(59,122,138,0.4)"
                              strokeDasharray="5 4"
                              strokeWidth={1.2}
                              ifOverflow="extendDomain"
                              label={{
                                value: monthlyBudgetCapLabel,
                                position: 'left',
                                fill: 'rgba(59,122,138,0.75)',
                                fontSize: 10,
                                fontFamily: 'var(--font-mono)',
                                textAnchor: 'end',
                                dx: -3,
                              }}
                            />
                            {/* Ligne verticale "aujourd'hui" */}
                            <ReferenceLine
                              x={trajectoryDaysElapsed}
                              stroke="rgba(200,148,74,0.20)"
                              strokeWidth={1.5}
                              strokeDasharray="2 4"
                            />
                            {/* Courbe planifiée : bleu pétrole, tirets fins */}
                            <Line
                              type="monotone"
                              dataKey="planned"
                              stroke="#3B7A8A"
                              strokeWidth={1.5}
                              dot={false}
                              strokeDasharray="5 4"
                              strokeOpacity={0.7}
                            />
                            {/* Zone dépassement : ambre doux */}
                            <Area
                              type="monotone"
                              dataKey="overBudget"
                              baseValue={monthlyBudgetCap}
                              stroke="none"
                              fill="url(#overBudgetFillHome)"
                              connectNulls={false}
                              isAnimationActive={false}
                            />
                            {/* Marqueurs opérations planifiées */}
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
                                    <g>
                                      <line
                                        x1={cx}
                                        y1={cy - 8}
                                        x2={cx}
                                        y2={cy + 8}
                                        stroke="rgba(59,122,138,0.6)"
                                        strokeWidth={1.5}
                                        strokeLinecap="round"
                                      />
                                      <circle cx={cx} cy={cy} r={2.5} fill="#3B7A8A" fillOpacity={0.5} />
                                    </g>
                                  )
                                }}
                              />
                            ))}
                            {/* Courbe réelle : or/ambre, trait épais avec glow subtil */}
                            <Area
                              type="monotone"
                              dataKey="actual"
                              stroke="#C8944A"
                              strokeWidth={2.5}
                              fill="url(#actualFillHome)"
                              dot={false}
                              connectNulls={false}
                              activeDot={{ r: 4, fill: '#C8944A', stroke: '#fff', strokeWidth: 2, filter: 'drop-shadow(0 0 4px rgba(200,148,74,0.6))' }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                        {selectedPlannedDay != null && getPlannedOperationFromDay(selectedPlannedDay) ? (
                          <div style={{ marginTop: 'var(--space-2)', background: 'var(--neutral-0)', border: '1px solid var(--neutral-200)', borderRadius: 12, boxShadow: 'var(--shadow-sm)', fontSize: 12, padding: '7px 9px', display: 'grid', gap: 3 }}>
                            <p style={{ margin: 0, fontWeight: 700, color: 'var(--neutral-800)' }}>{`Jour ${selectedPlannedDay}`}</p>
                            <p style={{ margin: 0, color: 'var(--neutral-700)' }}>{`Réel: ${formatCurrencyFloored(Number(trajectoryDataByDay.get(selectedPlannedDay)?.actual ?? 0))}`}</p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                              <p style={{ margin: 0, color: 'var(--neutral-700)' }}>{`Planifié: ${plannedAmountLabelForDay(selectedPlannedDay)}`}</p>
                              <button
                                type="button"
                                aria-label="Voir le détail de l'opération planifiée"
                                onClick={() => openPlannedOperationDetailsFromDay(selectedPlannedDay)}
                                style={{
                                  border: '1px solid var(--neutral-200)',
                                  background: 'var(--neutral-0)',
                                  color: 'var(--neutral-700)',
                                  borderRadius: 'var(--radius-sm)',
                                  width: 30,
                                  height: 24,
                                  minWidth: 30,
                                  minHeight: 24,
                                  borderColor: 'var(--neutral-400)',
                                  padding: 0,
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  fontWeight: 800,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  lineHeight: 1,
                                }}
                              >
                                ↗
                              </button>
                            </div>
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
                                      {`#${idx + 1}. ${row.name} - ${formatCurrencyFloored(row.spent)} - `}
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
                                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <CategoryIcon iconKey={row.iconKey} size={18} label={row.name} />
                                  </span>

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
                                    {`${row.name} - ${formatCurrencyFloored(row.spent)}`}
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
                          {(dailyPayload?.planned_operations?.count ?? 0) === 0 ? (
                            <p style={{ margin: 0, padding: 'var(--space-6) 0', textAlign: 'center', fontSize: 12, color: 'var(--neutral-400)', fontStyle: 'italic' }}>
                              Aucune opération planifiée pour le moment
                            </p>
                          ) : (
                            <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                              {(dailyPayload?.planned_operations.items ?? []).map((op, idx) => {
                                const displayDate = op.occurrence_date ?? op.planned_date
                                const dateStr = formatPlannedDateShort(displayDate)
                                const rawAmount = op.planned_personal_amount ?? op.planned_amount
                                const hasAmount = Number.isFinite(Number(rawAmount))
                                const amountStr = hasAmount ? formatCurrencyAdaptive(Number(rawAmount)) : '–'
                                const isAdditionalCommitmentExpense = op.flow_type === 'expense' && op.budget_impact === 'additional_commitment'
                                const impactsRemainingUseful = isAdditionalCommitmentExpense
                                  && (op.impacts_remaining_useful === true || Number(op.remaining_useful_impact_amount ?? 0) > 0)
                                return (
                                  <button
                                    type="button"
                                    key={op.id ?? idx}
                                    aria-label={`Voir le détail de ${String(op.label ?? 'cette opération planifiée')}`}
                                    onClick={() => setSelectedPlannedOperation(op)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 'var(--space-2)',
                                      padding: '8px 0',
                                      borderBottom: '1px solid var(--neutral-100)',
                                      borderTop: 'none',
                                      borderLeft: 'none',
                                      borderRight: 'none',
                                      background: 'transparent',
                                      width: '100%',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <span style={{ fontSize: 10, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', width: 32 }}>{dateStr}</span>
                                    <span style={{ width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      <CategoryIcon iconKey={plannedOperationIconKey(op)} label={op.category_name ?? op.label} size={18} />
                                    </span>
                                    <span style={{ flex: 1, fontSize: 12, color: 'var(--neutral-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(op.label ?? '—')}</span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--neutral-800)', fontFamily: 'var(--font-mono)' }}>
                                      {impactsRemainingUseful ? (
                                        <span
                                          title="Impacte le reste utile"
                                          aria-label="Impacte le reste utile"
                                          style={{ fontSize: 10, fontWeight: 700, color: '#FFD550', letterSpacing: '0.02em' }}
                                        >
                                          + €
                                        </span>
                                      ) : null}
                                      <span>{amountStr}</span>
                                    </span>
                                  </button>
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
                      tickFormatter={(value) => formatCurrencyFloored(Number(value))}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--neutral-0)',
                        border: '1px solid var(--neutral-200)',
                        borderRadius: 12,
                        boxShadow: 'var(--shadow-sm)',
                        fontSize: 12,
                      }}
                      formatter={(value: number) => [formatCurrencyFloored(Number(value)), 'Solde modélisé']}
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
                      tickFormatter={(value) => formatCurrencyFloored(Number(value))}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--neutral-0)',
                        border: '1px solid var(--neutral-200)',
                        borderRadius: 12,
                        boxShadow: 'var(--shadow-sm)',
                        fontSize: 12,
                      }}
                      formatter={(value: number) => [formatCurrencyFloored(Number(value)), 'Fonds projetés']}
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
                      tickFormatter={(value) => formatCurrencyFloored(Number(value))}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--neutral-0)',
                        border: '1px solid var(--neutral-200)',
                        borderRadius: 12,
                        boxShadow: 'var(--shadow-sm)',
                        fontSize: 12,
                      }}
                      formatter={(value: number, name: string) => [formatCurrencyFloored(Number(value)), name === 'yearlyInterest' ? 'Intérêts annuels' : 'Intérêts cumulés']}
                      labelFormatter={(label) => `Année ${label}`}
                    />
                    <Line type="monotone" dataKey="yearlyInterest" name="Intérêts annuels" stroke="var(--primary-500)" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="cumulativeInterest" name="Intérêts cumulés" stroke="var(--color-warning)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trajectoryData} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="actualFillHomeAlt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C8944A" stopOpacity={0.28} />
                        <stop offset="55%" stopColor="#C8944A" stopOpacity={0.08} />
                        <stop offset="100%" stopColor="#C8944A" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="overBudgetFillHomeAlt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C8944A" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#C8944A" stopOpacity={0.06} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="rgba(120,118,140,0.10)"
                      strokeDasharray="0"
                      vertical={false}
                      strokeWidth={1}
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: 'rgba(120,118,140,0.65)', fontFamily: 'var(--font-mono)' }}
                      axisLine={false}
                      tickLine={false}
                      interval={4}
                      tickMargin={6}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'rgba(120,118,140,0.65)', fontFamily: 'var(--font-mono)' }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tickFormatter={(value) => formatCurrencyFloored(Number(value))}
                      tickCount={4}
                    />
                    <Tooltip content={trajectoryTooltipContent} cursor={{ stroke: 'rgba(200,148,74,0.25)', strokeWidth: 1.5, strokeDasharray: '3 3' }} />
                    <ReferenceLine
                      y={monthlyBudgetCap}
                      stroke="rgba(59,122,138,0.4)"
                      strokeDasharray="5 4"
                      strokeWidth={1.2}
                      ifOverflow="extendDomain"
                      label={{
                        value: monthlyBudgetCapLabel,
                        position: 'left',
                        fill: 'rgba(59,122,138,0.75)',
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        textAnchor: 'end',
                        dx: -3,
                      }}
                    />
                    <ReferenceLine
                      x={trajectoryDaysElapsed}
                      stroke="rgba(200,148,74,0.20)"
                      strokeWidth={1.5}
                      strokeDasharray="2 4"
                    />
                    <Line
                      type="monotone"
                      dataKey="planned"
                      stroke="#3B7A8A"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="5 4"
                      strokeOpacity={0.7}
                    />
                    <Area
                      type="monotone"
                      dataKey="overBudget"
                      baseValue={monthlyBudgetCap}
                      stroke="none"
                      fill="url(#overBudgetFillHomeAlt)"
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
                            <g>
                              <line
                                x1={cx}
                                y1={cy - 8}
                                x2={cx}
                                y2={cy + 8}
                                stroke="rgba(59,122,138,0.6)"
                                strokeWidth={1.5}
                                strokeLinecap="round"
                              />
                              <circle cx={cx} cy={cy} r={2.5} fill="#3B7A8A" fillOpacity={0.5} />
                            </g>
                          )
                        }}
                      />
                    ))}
                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke="#C8944A"
                      strokeWidth={2.5}
                      fill="url(#actualFillHomeAlt)"
                      dot={false}
                      connectNulls={false}
                      activeDot={{ r: 4, fill: '#C8944A', stroke: '#fff', strokeWidth: 2, filter: 'drop-shadow(0 0 4px rgba(200,148,74,0.6))' }}
                    />
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

      {/* ── Budget hero 2026 ─────────────────────────────────────────────── */}
      {isMainCheckingAccount && annual2026Summary && annual2026Buckets.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Annual2026Hero summary={annual2026Summary} buckets={annual2026Buckets} />
        </motion.div>
      ) : null}

      <AnimatePresence>
        {selectedPlannedOperation ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlannedOperation(null)}
              style={{ position: 'fixed', inset: 0, zIndex: 72, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Détail de l'opération planifiée"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
              style={{
                position: 'fixed',
                left: 'var(--space-4)',
                right: 'var(--space-4)',
                top: '15%',
                zIndex: 73,
                maxWidth: 420,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                border: '1px solid var(--neutral-200)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-lg)',
                padding: 'var(--space-4)',
                display: 'grid',
                gap: 'var(--space-3)',
              }}
            >
              {(() => {
                const displayDate = selectedPlannedOperation.occurrence_date ?? selectedPlannedOperation.planned_date
                const displayAmount = selectedPlannedOperation.planned_personal_amount ?? selectedPlannedOperation.planned_amount
                const amountText = Number.isFinite(Number(displayAmount)) ? formatCurrencyAdaptive(Number(displayAmount)) : '–'
                const categoryLabel = selectedPlannedOperation.parent_category_name && selectedPlannedOperation.category_name
                  ? `${selectedPlannedOperation.parent_category_name} > ${selectedPlannedOperation.category_name}`
                  : (selectedPlannedOperation.category_name ?? 'Non catégorisé')
                const recurrenceLabel = selectedPlannedOperation.is_recurring
                  ? (
                    selectedPlannedOperation.recurrence_frequency === 'monthly' && selectedPlannedOperation.recurrence_day_of_month
                      ? `Tous les mois, le ${selectedPlannedOperation.recurrence_day_of_month}`
                      : 'Récurrent'
                  )
                  : 'Ponctuelle'
                const impactDetail = buildPlannedImpactDetail(selectedPlannedOperation)

                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                      <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--neutral-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedPlannedOperation.label}
                        </p>
                        {selectedPlannedOperation.merchant_name && selectedPlannedOperation.merchant_name !== selectedPlannedOperation.label ? (
                          <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-500)' }}>
                            {selectedPlannedOperation.merchant_name}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        aria-label="Fermer le détail de l'opération planifiée"
                        onClick={() => setSelectedPlannedOperation(null)}
                        style={{ border: 'none', background: 'var(--neutral-100)', color: 'var(--neutral-600)', minWidth: 34, minHeight: 34, borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)', background: 'var(--neutral-50)' }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'var(--neutral-900)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Informations principales</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                        <span style={{ fontSize: 12, color: 'var(--neutral-600)' }}>Date prévue</span>
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', fontWeight: 700 }}>{formatPlannedDateLong(displayDate)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                        <span style={{ fontSize: 12, color: 'var(--neutral-600)' }}>Montant</span>
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', fontWeight: 700 }}>{amountText}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                        <span style={{ fontSize: 12, color: 'var(--neutral-600)' }}>Type</span>
                        <span style={{ fontSize: 12, color: 'var(--neutral-900)', fontWeight: 700 }}>{PLANNED_FLOW_LABELS[selectedPlannedOperation.flow_type] ?? '—'}</span>
                      </div>
                    </div>

                    <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)', background: 'var(--neutral-50)' }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'var(--neutral-900)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Catégorie</p>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-800)' }}>
                        {categoryLabel}
                      </p>
                    </div>

                    <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)', background: 'var(--neutral-50)' }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'var(--neutral-900)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pilotage</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                        <span style={{ fontSize: 12, color: 'var(--neutral-600)' }}>Bloc de pilotage</span>
                        <span style={{ fontSize: 12, color: 'var(--neutral-900)', fontWeight: 700 }}>{BUCKET_LABELS[selectedPlannedOperation.budget_bucket ?? ''] ?? '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                        <span style={{ fontSize: 12, color: 'var(--neutral-600)' }}>Récurrence</span>
                        <span style={{ fontSize: 12, color: 'var(--neutral-900)', fontWeight: 700, textAlign: 'right' }}>{recurrenceLabel}</span>
                      </div>
                    </div>

                    <div style={{ border: impactDetail.showMarker ? '1px solid color-mix(in oklab, #FFD550 70%, var(--neutral-200) 30%)' : '1px solid var(--neutral-200)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)', background: impactDetail.showMarker ? 'color-mix(in oklab, #FFD550 14%, var(--neutral-0) 86%)' : 'var(--neutral-50)' }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'var(--neutral-900)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{impactDetail.title}</p>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-700)', lineHeight: 1.4 }}>{impactDetail.text}</p>
                      {impactDetail.showMarker ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <span
                            title="Impacte le reste utile"
                            aria-label="Impacte le reste utile"
                            style={{ fontSize: 11, fontWeight: 800, color: '#C49200', letterSpacing: '0.02em' }}
                          >
                            + €
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                            {formatCurrencyAdaptive(Math.max(0, Number(impactDetail.amount ?? 0)))}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </>
                )
              })()}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showResteUtileModal ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResteUtileModal(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Détail du calcul du reste utile"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
              style={{
                position: 'fixed',
                left: 'var(--space-4)',
                right: 'var(--space-4)',
                top: '17%',
                zIndex: 71,
                maxWidth: 376,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                border: '1px solid var(--neutral-200)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-lg)',
                padding: 'var(--space-3)',
                display: 'grid',
                gap: 'var(--space-2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--neutral-900)' }}>
                  Méthode et détails du calcul
                </p>
                <button
                  type="button"
                  aria-label="Fermer"
                  onClick={() => setShowResteUtileModal(false)}
                  style={{ border: 'none', background: 'var(--neutral-100)', color: 'var(--neutral-600)', minWidth: 34, minHeight: 34, borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              </div>
              <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-3)', background: 'var(--neutral-50)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--neutral-900)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revenus encaissés</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', fontWeight: 700 }}>{formatCurrencyFloored(revenueAmountDisplay)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'var(--neutral-900)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Montants protégés
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: 12, color: 'var(--neutral-700)' }}>− Socle fixe prévu</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', fontWeight: 700 }}>{formatCurrencyFloored(fixedBudgetAmountDisplay)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: 12, color: 'var(--neutral-700)' }}>− Provisions prévues</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', fontWeight: 700 }}>{formatCurrencyFloored(provisionBudgetAmountDisplay)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: 12, color: 'var(--neutral-700)' }}>− Épargne prévue</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', fontWeight: 700 }}>{formatCurrencyFloored(savingsBudgetAmountDisplay)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'var(--neutral-900)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Déjà consommé
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: 12, color: 'var(--neutral-700)' }}>− Variable essentielle consommée</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', fontWeight: 700 }}>{formatCurrencyFloored(variableEssentialConsumedDisplay)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: 12, color: 'var(--neutral-700)' }}>− Discrétionnaire consommé</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', fontWeight: 700 }}>{formatCurrencyFloored(discretionaryConsumedDisplay)}</span>
                </div>
              </div>

              <div
                style={{
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-3)',
                  background: 'linear-gradient(135deg, color-mix(in oklab, var(--primary-500) 88%, #000 12%) 0%, color-mix(in oklab, var(--primary-700) 78%, #000 22%) 100%)',
                  display: 'grid',
                  justifyItems: 'center',
                  gap: 'var(--space-1)',
                }}
              >
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.72)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Reste utile
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-2xl)', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#FFD550', lineHeight: 1.1 }}>
                  {formatCurrencyFloored(resteUtileDisplay)}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.92)', fontWeight: 700 }}>
                  {`${formatCurrencyFloored(budgetPerDayDisplay)} / jour`}
                </p>
              </div>

              <div style={{ display: 'grid', gap: '1px' }}>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-500)', lineHeight: 1.15 }}>
                  • "Hors pilotage" et "virements internes" exclus.
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-500)', lineHeight: 1.15 }}>
                  • Les dépenses planifiéesnon déjà budgétisées seront retirées à leur intégration.
                </p>
              </div>
            </motion.div>
          </>
        ) : null}

      </AnimatePresence>

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

      <DriftCategoryTransactionsModal
        open={showDriftCategoryModal}
        onClose={() => {
          setShowDriftCategoryModal(false)
          setSelectedDriftCategoryId(null)
        }}
        categoryName={selectedDriftCategoryMeta?.name ?? null}
        categoryColor={selectedDriftCategoryColor}
        categoryTransactions={selectedDriftCategoryTransactions}
        loading={loadingSummaries}
      />
    </div>
  )
}
