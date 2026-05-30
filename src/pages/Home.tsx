import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Check, ChevronLeft, ChevronRight, TriangleAlert, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAccounts } from '@/hooks/useAccounts'
import { TripCockpitCard } from '@/features/voyages/components/TripCockpitCard'
import { TripManualExpenseModal } from '@/features/voyages/components/TripManualExpenseModal'
import { TripExpenseMatchingSheet } from '@/features/voyages/components/TripExpenseMatchingSheet'
import { useBudgetSummaries } from '@/hooks/useBudgets'
import {
  getCurrentPeriod,
  getDaysRemainingInMonth,
  getCategoryColor,
  formatCurrencyFloored,
} from '@/lib/utils'
import { getBudgetBucketColor } from '@/lib/budgetBuckets'
import type { AccountWithBalance } from '@/lib/types'
import type { PlannedOperationItem } from '@/features/home/types'
import { useTransactions } from '@/hooks/useTransactions'
import { lockDocumentScroll } from '@/lib/scrollLock'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useCountUp } from '@/hooks/useCountUp'
import { useHomeDailyBudgetPayload } from '@/features/home/hooks/useHomeDailyBudgetPayload'
import { useHomeUsefulRemaining } from '@/features/home/hooks/useHomeUsefulRemaining'
import { useCurrentMonthSavingsPlanning } from '@/features/home/hooks/useCurrentMonthSavingsPlanning'
import { useHomeDriftOperations } from '@/features/home/hooks/useHomeDriftOperations'
import { useAccountBalanceStatus } from '@/features/home/hooks/useAccountBalanceStatus'
import { useOptimizationBalance } from '@/features/stats/hooks/useOptimizationBalance'
import { useUpcomingPlannedOperations } from '@/features/home/hooks/useUpcomingPlannedOperations'
import { formatSignedEuro } from '@/features/stats/components/ui/analyticsFormatters'
import {
  DetailModal,
  DetailModalRow,
  DetailModalSeparator,
} from '@/components'
import comptePrincipalIcon from "@/assets/icons/accounts/compte_principal_banque_populaire.webp";
import compteJointIcon from "@/assets/icons/accounts/banque_postale_compte_joint.webp";
import peaIcon from "@/assets/icons/accounts/boursorama_pea.webp";
import percolIcon from "@/assets/icons/accounts/amundi_epargne.webp";
import cryptoIcon from "@/assets/icons/accounts/bitcoin.webp";

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
  { id: 'livret_a', label: 'Epargne', iconSrc: comptePrincipalIcon, keywords: ['livret a', 'epargne'] },
  { id: 'placements', label: 'Placements', iconSrc: peaIcon, keywords: ['placements', 'pea'], iconScale: 1.22 },
  { id: 'per', label: 'PER', iconSrc: comptePrincipalIcon, keywords: ['per'] },
  { id: 'pea', label: 'PEA', iconSrc: peaIcon, keywords: ['pea'], iconScale: 1.22 },
  { id: 'epargne_percol', label: 'Epargne PERCOL', iconSrc: percolIcon, keywords: ['percol', 'amundi'], iconScale: 1.22 },
  { id: 'compte_crypto', label: 'Compte crypto', iconSrc: cryptoIcon, keywords: ['crypto', 'bitcoin'], missing: true },
]

const HOME_SWIPE_PILLS = [
  { id: 'compte_principal', label: 'Compte' },
  { id: 'budget_voyage', label: 'Voyage' },
] as const
const BUDGET_VOYAGE_TAB_ID = 'budget_voyage'

// Swipe constants (module-level pour stabilité des dépendances)
const SWIPE_MIN_DELTA_X = 50
const SWIPE_RATIO = 1.5

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
}

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

function formatSignedCurrency(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${formatCurrencyFloored(Math.abs(value))}`
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

const PER_ACCOUNT_ID = 'ef9f92c1-c6db-4672-8231-39ec75aa0195'
const MAIN_CHECKING_ACCOUNT_ID = 'bcffa4d1-92b0-4feb-a492-51ea328cfce2'

type SavingsTileStatus = 'validated' | 'pending' | 'alert'

type OptimizationPriorityMock = {
  label: string
  iconKey: string
  optimizationYtdAmount: number | null
  expectedAnnualAmount: number
  previousYearAmount: number
  determinationMethod: string
  categoryNameMatchers: string[]
}



const OPTIMIZATION_PRIORITIES_MOCK: OptimizationPriorityMock[] = [
  {
    label: "Retraits d'espèces",
    iconKey: 'achats_divers_retrait_d_especes',
    optimizationYtdAmount: 145,
    expectedAnnualAmount: 420,
    previousYearAmount: 85,
    determinationMethod: 'Écart entre moyenne mobile 6 mois et cible hebdomadaire plafonnée.',
    categoryNameMatchers: ["retrait d'especes", 'retrait especes', 'retrait'],
  },
  {
    label: 'Petits achats alimentaires',
    iconKey: 'alimentation_petits_achats_alimentaires',
    optimizationYtdAmount: null,
    expectedAnnualAmount: 360,
    previousYearAmount: 210,
    determinationMethod: 'Réduction visée par regroupement des achats et suppression des doublons de panier.',
    categoryNameMatchers: ['petits achats alimentaires', 'alimentation'],
  },
  {
    label: 'Café / bars',
    iconKey: 'sorties_cafe_bars',
    optimizationYtdAmount: 92,
    expectedAnnualAmount: 300,
    previousYearAmount: 70,
    determinationMethod: 'Comparaison N vs N-1 ajustée du nombre de sorties mensuelles observées.',
    categoryNameMatchers: ['cafe', 'bars', 'bar'],
  },
]

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
  categoryTransactions: Array<{ id: string; operation_date: string; label: string; amount: number; iconKey: string | null }> | null
  loading: boolean
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      zIndex={220}
      variant="center"
      header={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
            <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: categoryColor, flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--neutral-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {categoryName ?? 'Catégorie'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{ flexShrink: 0, border: 'none', background: 'var(--neutral-100)', color: 'var(--neutral-600)', minWidth: 44, minHeight: 44, borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      }
    >
      {loading ? (
        <p style={{ margin: 0, padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)' }}>Chargement…</p>
      ) : (categoryTransactions?.length ?? 0) === 0 ? (
        <p style={{ margin: 0, padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)' }}>Aucune opération</p>
      ) : (
        categoryTransactions?.map((tx) => {
          const d = new Date(`${tx.operation_date}T00:00:00`)
          const dateStr = Number.isNaN(d.getTime()) ? '--/--' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
          return (
            <button
              key={tx.id}
              type="button"
              style={{
                width: '100%',
                border: 'none',
                borderBottom: '1px solid var(--neutral-200)',
                padding: 'var(--space-3) var(--space-5)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                background: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'background-color var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--neutral-50)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <span style={{ fontSize: 12, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>{dateStr}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CategoryIcon iconKey={tx.iconKey} size={18} label={tx.label} />
              </span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--neutral-800)' }}>{tx.label}</span>
              <span style={{ fontSize: 13, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{formatCurrencyFloored(Math.abs(Number(tx.amount ?? 0)))}</span>
            </button>
          )
        })
      )}
    </BottomSheet>
  )
}

function PlannedOpsModal({
  open,
  onClose,
  title,
  dotColor,
  items,
}: {
  open: boolean
  onClose: () => void
  title: string
  dotColor: string
  items: PlannedOperationItem[]
}) {
  const total = items.reduce((sum, item) => {
    const amount = Math.abs(Number(item.planned_personal_amount ?? item.planned_amount ?? 0))
    const isOutflow = item.flow_type === 'expense' || item.flow_type === 'savings'
    return sum + (isOutflow ? amount : -amount)
  }, 0)

  return (
    <DetailModal
      open={open}
      onClose={onClose}
      title={title}
      accentColor={dotColor}
    >
      {items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-400)', fontStyle: 'italic' }}>
          Aucune opération planifiée.
        </p>
      ) : (
        <>
          {items.map((item) => {
            const amount = Math.abs(Number(item.planned_personal_amount ?? item.planned_amount ?? 0))
            const isIncome = item.flow_type === 'income'
            const isSavings = item.flow_type === 'savings'
            const flowLabel = isIncome ? 'Revenu' : isSavings ? 'Épargne' : 'Dépense'
            const dateLabel = new Date(item.planned_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
            return (
              <DetailModalRow
                key={item.id}
                label={`${item.label} (${flowLabel}, ${dateLabel})`}
                value={`${isIncome ? '+' : '-'}${formatCurrencyFloored(amount)}`}
              />
            )
          })}
          {items.length > 1 ? (
            <>
              <DetailModalSeparator />
              <DetailModalRow
                label="Total"
                value={`${total >= 0 ? '-' : '+'}${formatCurrencyFloored(Math.abs(total))}`}
                variant="total"
              />
            </>
          ) : null}
        </>
      )}
    </DetailModal>
  )
}

type DriftRowShape = { id: string; name: string; spent: number; driftPct: number; overrunAmount: number; iconKey: string | null; colorToken: string | null; exceedDate: string | null }
type Top5RowShape = { id: string; name: string; spent: number; driftPct: number }

function DriftsModal({
  open,
  onClose,
  driftRows,
  totalOverrunAmount,
  top5ExpenseRows,
  loadingSummaries,
  onCategoryClick,
}: {
  open: boolean
  onClose: () => void
  driftRows: DriftRowShape[]
  totalOverrunAmount: number
  top5ExpenseRows: Top5RowShape[]
  loadingSummaries: boolean
  onCategoryClick: (id: string) => void
}) {
  const [showTop5, setShowTop5] = useState(false)
  const titleWithTotal = (
    <span>
      <span>{'Catégories en dérive '}</span>
      <span style={{ color: 'var(--color-error)', fontFamily: 'var(--font-mono)' }}>
        {`+${formatCurrencyFloored(totalOverrunAmount)}`}
      </span>
    </span>
  ) as unknown as string

  return (
    <DetailModal
      open={open}
      onClose={onClose}
      title={titleWithTotal}
      accentColor="var(--color-warning)"
    >
      {loadingSummaries ? (
        <p style={{ margin: 0, textAlign: 'center', fontSize: 12, color: 'var(--neutral-400)' }}>
          Chargement…
        </p>
      ) : driftRows.length === 0 ? (
        <div style={{ display: 'grid', alignContent: 'center', justifyItems: 'center', gap: 'var(--space-3)' }}>
          <p style={{ margin: 0, textAlign: 'center', fontSize: 12, color: 'var(--neutral-500)', lineHeight: 1.5 }}>
            Budget sous contrôle. Rien à signaler pour le moment.
          </p>
          <button
            type="button"
            onClick={() => setShowTop5((c) => !c)}
            style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-full)', minHeight: 30, padding: '0 12px', background: 'var(--neutral-0)', color: 'var(--neutral-700)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            {showTop5 ? 'masquer' : 'voir le top 5 catégories (dépenses)'}
          </button>
          {showTop5 ? (
            <div style={{ width: '100%', display: 'grid', gap: 'var(--space-2)' }}>
              {top5ExpenseRows.map((row, idx) => {
                const drift = Number(row.driftPct ?? 0)
                const driftColor = drift > 0 ? 'var(--color-error)' : drift < 0 ? 'var(--color-success)' : 'var(--neutral-500)'
                return (
                  <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--neutral-600)', lineHeight: 1.3 }}>
                      {`#${idx + 1}. ${row.name} — ${formatCurrencyFloored(row.spent)}`}
                    </span>
                    <span style={{ fontSize: 12, color: driftColor, fontFamily: 'var(--font-mono)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {`${drift >= 0 ? '+' : ''}${drift.toFixed(0)}%`}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {driftRows.map((row) => {
            const overrunAmount = Math.max(0, Number(row.overrunAmount ?? 0))
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => onCategoryClick(row.id)}
                style={{
                  border: 'none',
                  padding: 0,
                  width: '100%',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <DetailModalRow
                  label={`${row.exceedDate ?? '--/--'} · ${row.name} — ${formatCurrencyFloored(row.spent)}`}
                  value={`+${formatCurrencyFloored(overrunAmount)}`}
                />
              </button>
            )
          })}
        </div>
      )}
    </DetailModal>
  )
}

function DriftsTile({
  count,
  totalOverrunAmount,
  onClick,
}: {
  count: number
  totalOverrunAmount: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${count} catégorie${count !== 1 ? 's' : ''} en dérive budgétaire, total ${formatCurrencyFloored(totalOverrunAmount)} — voir le détail`}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 60,
        border: '1px solid rgba(255, 203, 150, 0.45)',
        background: 'radial-gradient(120% 88% at 18% -8%, rgba(255,234,184,0.58) 0%, rgba(255,234,184,0) 58%), radial-gradient(98% 82% at 100% 100%, rgba(255,154,90,0.44) 0%, rgba(255,154,90,0) 62%), linear-gradient(145deg, #4A1A07 0%, #A84512 47%, #F08A2B 100%)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        cursor: 'pointer',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'box-shadow var(--transition-base), transform var(--transition-base)',
        padding: 'var(--space-2) var(--space-4)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-card)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 'var(--font-size-xs)',
          fontWeight: 800,
          color: 'rgba(255,241,220,0.94)',
          textTransform: 'uppercase',
          letterSpacing: '0.09em',
          position: 'relative',
          zIndex: 1,
        }}
      >
        Dérives
      </p>

      {/* Pictogramme avertissement en arrière-plan */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <TriangleAlert
          size={84}
          color="#FFE0B2"
          style={{ opacity: 0.2 }}
        />
      </div>

      <span
        style={{
          fontSize: 'clamp(24px, 6vw, 30px)',
          fontWeight: 900,
          fontFamily: 'var(--font-mono)',
          lineHeight: 1,
          color: '#FFF0E3',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {count}
      </span>
    </button>
  )
}

function TimelineRow({
  label,
  sublabel,
  value,
  dotColor,
  shadowColor,
  onClick,
  hasOps,
}: {
  label: string
  sublabel: string
  value: string
  dotColor: string
  shadowColor: string
  onClick: () => void
  hasOps: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: hovered ? 'rgba(91, 87, 245, 0.05)' : 'transparent',
        border: 'none',
        padding: '12px 16px',
        marginLeft: -16,
        marginRight: -16,
        width: 'calc(100% + 32px)',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.2s ease, transform 0.2s ease',
        transform: hovered ? 'translateX(2px)' : 'translateX(0)',
        outline: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', minWidth: 0, flex: 1 }}>
        {/* Dot container */}
        <div style={{ width: 12, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 'var(--radius-full)',
              background: dotColor,
              boxShadow: `0 0 0 4px ${shadowColor}`,
              transition: 'transform 0.2s ease',
              transform: hovered ? 'scale(1.25)' : 'scale(1)',
            }}
          />
        </div>

        {/* Labels */}
        <div style={{ minWidth: 0, display: 'grid', gap: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--neutral-900)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--neutral-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {sublabel}
            </span>
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: hasOps ? 700 : 500,
              color: hasOps ? 'var(--neutral-800)' : 'var(--neutral-400)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {value}
          </span>
        </div>
      </div>

      {/* Action/chevron indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          color: hovered ? 'var(--neutral-800)' : 'var(--neutral-400)',
          transition: 'color 0.2s ease, transform 0.2s ease',
          transform: hovered ? 'translateX(2px)' : 'translateX(0)',
        }}
      >
        <ChevronRight size={18} />
      </div>
    </button>
  )
}

function PlannedOpsTimeline({
  j3Count,
  j3Amount,
  eomCount,
  eomAmount,
  daysUntilEom,
  onClickJ3,
  onClickEom,
}: {
  j3Count: number
  j3Amount: number
  eomCount: number
  eomAmount: number
  daysUntilEom: number
  onClickJ3: () => void
  onClickEom: () => void
}) {
  const j3Text =
    j3Count <= 0
      ? 'aucune opération'
      : `${j3Count} opé. · ${j3Amount < 0 ? '+' : ''}${formatCurrencyFloored(Math.abs(j3Amount))}`

  const eomText =
    eomCount <= 0
      ? 'aucune opération'
      : `${eomCount} opé. · ${eomAmount < 0 ? '+' : ''}${formatCurrencyFloored(Math.abs(eomAmount))}`

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        paddingLeft: 'var(--space-6)',
        gap: 'var(--space-3)',
      }}
    >
      {/* Connecting Vertical Line */}
      <div
        style={{
          position: 'absolute',
          left: 21,
          top: 24,
          bottom: 24,
          width: 2,
          background: 'linear-gradient(180deg, var(--primary-500) 0%, #FFAB2E 100%)',
          borderRadius: 'var(--radius-full)',
          opacity: 0.6,
        }}
      />

      {/* J+3 Step */}
      <TimelineRow
        label="J+3"
        sublabel="Échéance 3 jours"
        value={j3Text}
        dotColor="var(--primary-500)"
        shadowColor="rgba(91, 87, 245, 0.2)"
        onClick={onClickJ3}
        hasOps={j3Count > 0}
      />

      {/* Fin de mois Step */}
      <TimelineRow
        label={`J+${daysUntilEom}`}
        sublabel="Échéances fin de mois"
        value={eomText}
        dotColor="#FFAB2E"
        shadowColor="rgba(255, 171, 46, 0.2)"
        onClick={onClickEom}
        hasOps={eomCount > 0}
      />
    </div>
  )
}

// ─── Budget progress constants ────────────────────────────────────────────────
const EXPENSE_BUCKET_IDS = ['socle_fixe', 'variable_essentielle', 'provision', 'voyage', 'discretionnaire'] as const
type ExpenseBucketId = (typeof EXPENSE_BUCKET_IDS)[number]

const EXPENSE_BUCKET_LABELS: Record<ExpenseBucketId, string> = {
  socle_fixe: 'Fixe',
  variable_essentielle: 'Variable',
  provision: 'Provision',
  voyage: 'Voyage',
  discretionnaire: 'Discrétionnaire',
}

type MonthlyBlockProgressItem = { id: string; label: string; actual: number; budget: number; pct: number }

// ─── ProgressRing ─────────────────────────────────────────────────────────────
function ProgressRing({
  pct,
  size = 80,
  arcColor = '#F5A623',
  trackColor = '#AABCCD',
}: {
  pct: number
  size?: number
  arcColor?: string
  trackColor?: string
}) {
  const sw = Math.round(size * 0.105)
  const r = (size - sw) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const progress = Math.max(0, Math.min(1, pct / 100))
  const dashOffset = circumference * (1 - progress)
  const dotR = sw * 0.58
  const startDotX = cx
  const startDotY = cy - r
  const endAngleRad = (progress * 360 - 90) * (Math.PI / 180)
  const endDotX = cx + r * Math.cos(endAngleRad)
  const endDotY = cy + r * Math.sin(endAngleRad)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={sw} />
      {progress > 0 ? (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={arcColor}
          strokeWidth={sw}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      ) : null}
      <circle cx={startDotX} cy={startDotY} r={dotR} fill="white" stroke={trackColor} strokeWidth={sw * 0.35} />
      {progress > 0.03 ? (
        <circle cx={endDotX} cy={endDotY} r={dotR} fill="white" stroke={arcColor} strokeWidth={sw * 0.35} />
      ) : null}
    </svg>
  )
}

function AccountProgressRing({
  pct,
  size = 136,
  amountText,
  label = 'Reste utile',
  onClick,
}: {
  pct: number
  size?: number
  amountText: string
  label?: string
  onClick?: () => void
}) {
  const sw = 10
  const r = (size - sw) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const progress = Math.max(0, Math.min(1, pct / 100))
  const dashOffset = circumference * (1 - progress)

  const trackColor = 'rgba(255, 255, 255, 0.12)'
  const arcColor = pct > 100 ? '#FC5A5A' : '#38BDF8'

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: size,
        height: size,
        border: 'none',
        background: 'transparent',
        padding: 0,
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'visible',
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ display: 'block', transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={sw} />
        {progress > 0 ? (
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arcColor}
            strokeWidth={sw}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        ) : null}
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', width: '100%', padding: '0 8px', boxSizing: 'border-box', pointerEvents: 'none' }}>
        <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#FFFFFF', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
          {amountText}
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
          {label}
        </span>
      </div>
    </button>
  )
}


// ─── ProgressCircleTile ───────────────────────────────────────────────────────
function ProgressCircleTile({
  pct,
  onClick,
  size = 86,
  arcColor = '#F5A623',
  showLabel = true,
  ariaLabel,
  title,
  mode = 'fill',
}: {
  pct: number
  onClick: () => void
  size?: number
  arcColor?: string
  showLabel?: boolean
  ariaLabel?: string
  title?: string
  mode?: 'fill' | 'fixed'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? `${Math.round(pct)}% du budget mensuel consommé — voir la progression par bloc`}
      title={title}
      style={{
        width: mode === 'fixed' ? size : '100%',
        height: mode === 'fixed' ? size : undefined,
        aspectRatio: mode === 'fixed' ? undefined : '1',
        border: 'none',
        background: 'transparent',
        borderRadius: 'var(--radius-full)',
        cursor: 'pointer',
        overflow: 'visible',
        padding: 0,
        display: 'grid',
        placeItems: 'center',
        transition: 'transform var(--transition-base)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{ display: 'grid', placeItems: 'center', position: 'relative' }}>
        <ProgressRing pct={pct} size={size} arcColor={arcColor} />
        {showLabel ? (
          <span style={{ position: 'absolute', fontSize: Math.round(size * 0.19), fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1, pointerEvents: 'none' }}>
            {`${Math.round(pct)}%`}
          </span>
        ) : null}
      </div>
    </button>
  )
}

// ─── BudgetProgressModal ─────────────────────────────────────────────────────
function BudgetProgressModal({
  open,
  onClose,
  monthlyBlockProgress,
  onBlockClick,
}: {
  open: boolean
  onClose: () => void
  monthlyBlockProgress: MonthlyBlockProgressItem[]
  onBlockClick: (blockId: string) => void
}) {
  const modalBlockRings = monthlyBlockProgress.filter((block) => block.id !== 'voyage')
  const blockRingLabel: Record<string, string> = {
    socle_fixe: 'Socle fixe',
    variable_essentielle: 'Variable essentielle',
    provision: 'Provisions',
    discretionnaire: 'Discrétionnaire',
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Progression des budgets"
      zIndex={200}
      variant="center"
    >
      <div style={{ padding: 'var(--space-3) var(--space-5) var(--space-5)', display: 'grid', gap: 'var(--space-2)' }}>
        {modalBlockRings.map((block) => (
          <button
            key={block.id}
            type="button"
            onClick={() => onBlockClick(block.id)}
            aria-label={`Ouvrir Budgets en mode socle ${blockRingLabel[block.id] ?? block.label}, ${Math.round(block.pct)}% consommé`}
            style={{
              border: 'none',
              borderBottom: '1px solid var(--neutral-100)',
              background: 'transparent',
              width: '100%',
              padding: 'var(--space-3) 0',
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              alignItems: 'center',
              gap: 'var(--space-4)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'grid', placeItems: 'center', position: 'relative' }}>
              <ProgressRing pct={block.pct} size={76} arcColor={getBudgetBucketColor(block.id)} />
              <span style={{ position: 'absolute', fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1 }}>
                {`${Math.round(block.pct)}%`}
              </span>
            </div>
            <div style={{ display: 'grid', gap: 3 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-900)', letterSpacing: '0.01em' }}>
                {blockRingLabel[block.id] ?? block.label}
              </p>
              <div style={{ display: 'grid', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                  <span style={{ fontSize: 12, color: 'var(--neutral-600)' }}>Consommé</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                    {formatCurrencyFloored(block.actual)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                  <span style={{ fontSize: 12, color: 'var(--neutral-600)' }}>Budget</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                    {formatCurrencyFloored(block.budget)}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function SavingsTile({
  status,
  monthAmountLabel,
  onClick,
}: {
  status: SavingsTileStatus
  monthAmountLabel: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Voir le détail de l'objectif d'épargne"
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 64,
        border: 'none',
        background: 'rgba(255,255,255,0.82)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 8px 20px rgba(46, 212, 122, 0.12)',
        cursor: 'pointer',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'box-shadow var(--transition-base), transform var(--transition-base)',
        padding: 'var(--space-2) var(--space-4)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-card)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{ display: 'grid', gap: 2, textAlign: 'left' }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 800,
            color: 'var(--neutral-800)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            position: 'relative',
            zIndex: 1,
          }}
        >
          Épargne
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--neutral-700)',
            fontFamily: 'var(--font-mono)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {monthAmountLabel}
        </p>
      </div>

      <span
        style={{
          position: 'relative',
          zIndex: 1,
        }}
      >
        {status === 'validated' ? (
          <Check size={30} color="var(--color-success)" strokeWidth={3} />
        ) : null}
        {status === 'pending' || status === 'alert' ? (
          <X size={30} color={status === 'pending' ? 'var(--neutral-500)' : 'var(--color-error)'} strokeWidth={3} />
        ) : null}
      </span>
    </button>
  )
}



function OptimizationsTile({
  onClick,
  theme = 'light',
}: {
  onClick: () => void
  theme?: 'light' | 'dark'
}) {
  const isDark = theme === 'dark'
  const { balance, isLoading } = useOptimizationBalance()

  const isPositive = balance >= 0
  const formattedAmount = isLoading ? '— €' : formatSignedEuro(balance)
  const toneColor = isPositive 
    ? (isDark ? '#2ED47A' : '#1E854A') 
    : (isDark ? '#FC5A5A' : '#D32F2F')

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Voir le détail des optimisations"
      style={{
        width: '100%',
        minHeight: 64,
        border: isDark ? '1px solid rgba(91, 87, 245, 0.3)' : '1.5px solid rgba(91, 87, 245, 0.15)',
        background: isDark
          ? 'radial-gradient(120% 90% at 14% -8%, rgba(56, 189, 248, 0.35) 0%, rgba(56, 189, 248, 0) 58%), radial-gradient(98% 82% at 100% 100%, rgba(91, 87, 245, 0.3) 0%, rgba(91, 87, 245, 0) 62%), linear-gradient(145deg, #0B132B 0%, #1C2541 47%, #3A506B 100%)'
          : 'linear-gradient(145deg, rgba(91, 87, 245, 0.08) 0%, rgba(91, 87, 245, 0.02) 100%)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        cursor: 'pointer',
        overflow: 'hidden',
        padding: 'var(--space-2) var(--space-3)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        transition: 'box-shadow var(--transition-base), transform var(--transition-base)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-card)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', minWidth: 0 }}>
        <span
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 800,
            color: isDark ? '#FFFFFF' : 'var(--neutral-800)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Optimisations
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', minWidth: 0, marginTop: 4 }}>
        <span
          style={{
            fontSize: 'clamp(16px, 4.5vw, 19px)',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            color: toneColor,
            transition: 'color var(--transition-base)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {formattedAmount}
        </span>
      </div>
    </button>
  )
}

function SavingsGoalTile({
  goalAmount,
  reached,
  onClick,
}: {
  goalAmount: number
  reached: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={`Objectif d'épargne: ${formatCurrencyFloored(goalAmount)}`}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 64,
        border: 'none',
        background:
          'radial-gradient(120% 90% at 14% -8%, rgba(45, 212, 191, 0.28) 0%, rgba(45, 212, 191, 0) 58%), radial-gradient(98% 82% at 100% 100%, rgba(20, 184, 166, 0.24) 0%, rgba(20, 184, 166, 0) 62%), linear-gradient(145deg, #083344 0%, #0F4C5C 48%, #0F766E 100%)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        padding: 'var(--space-2) var(--space-3)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        transition: 'box-shadow var(--transition-base), transform var(--transition-base)',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = 'var(--shadow-card)'
          e.currentTarget.style.transform = 'translateY(0)'
        }
      }}
    >
      {reached && (
        <span
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            opacity: 0.16,
            color: '#2ED47A',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        >
          <Check size={64} strokeWidth={3} />
        </span>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', minWidth: 0, position: 'relative', zIndex: 1 }}>
        <span
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 800,
            color: 'rgba(255, 255, 255, 0.82)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Épargne
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', minWidth: 0, marginTop: 4, position: 'relative', zIndex: 1 }}>
        <span
          style={{
            fontSize: 'clamp(16px, 4.5vw, 19px)',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            color: '#E6FDF9',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {formatCurrencyFloored(goalAmount)}
        </span>
      </div>
    </button>
  )
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function Home() {
  const navigate = useNavigate()
  const { year, month } = getCurrentPeriod()
  const now = new Date()
  const { data: accounts } = useAccounts()
  const { data: summaries, isLoading: loadingSummaries } = useBudgetSummaries(year, month)
  const { data: dailyPayload } = useHomeDailyBudgetPayload(year, month)
  const { data: currentMonthSavingsPlanning } = useCurrentMonthSavingsPlanning(year, month)
  const { data: driftOperations, isLoading: loadingDriftOperations } = useHomeDriftOperations(year, month)
  const eomDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const eomDateStr = toLocalIsoDate(eomDate)
  const { data: upcomingOps } = useUpcomingPlannedOperations(eomDateStr)

  const optimizationsData = useMemo(() => {
    const operations = driftOperations ?? []
    return OPTIMIZATION_PRIORITIES_MOCK.map((row) => {
      const matchingOps = operations.filter((op) => {
        const catName = op.categoryName ? op.categoryName.toLowerCase() : ''
        return row.categoryNameMatchers.some((matcher) => catName.includes(matcher.toLowerCase()))
      })

      const realAmount = matchingOps.reduce((sum, op) => sum + Math.abs(op.budgetAccountingAmount), 0)
      
      const consumedAmount = realAmount > 0 ? realAmount : (row.previousYearAmount / 12)
      const objectiveAmount = row.expectedAnnualAmount / 12
      const progressPct = objectiveAmount > 0 ? (consumedAmount / objectiveAmount) * 100 : 0

      let barColor = '#5B57F5'
      if (progressPct > 100) {
        barColor = '#FC5A5A'
      } else if (progressPct > 75) {
        barColor = '#FFAB2E'
      }

      return {
        label: row.label,
        iconKey: row.iconKey,
        consumedAmount,
        objectiveAmount,
        progressPct,
        barColor,
      }
    })
  }, [driftOperations])

  const todayDate = now.toISOString().slice(0, 10)
  const {
    data: mainAccountBalanceStatus,
    isLoading: loadingMainAccountBalanceStatus,
    isError: hasMainAccountBalanceStatusError,
  } = useAccountBalanceStatus(MAIN_CHECKING_ACCOUNT_ID, todayDate)
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysElapsed = now.getDate()
  const daysRemaining = getDaysRemainingInMonth()
  // Rappel snapshot : visible les 2 derniers jours du mois, disparaît le 1er du mois suivant
  const showSnapshotReminder = daysElapsed >= daysInMonth - 1
  const sectionHorizontalPadding = '0 calc(var(--space-6) + 6px)'

  const upcomingOpsWindows = useMemo(() => {
    const items = upcomingOps ?? []
    const plus3Date = new Date(now)
    plus3Date.setDate(now.getDate() + 3)
    const end3 = toLocalIsoDate(plus3Date)
    const localToday = toLocalIsoDate(now)

    let count3 = 0
    let amount3 = 0
    let countEom = 0
    let amountEom = 0
    const items3: PlannedOperationItem[] = []
    const itemsEom: PlannedOperationItem[] = []

    for (const item of items) {
      const date = String(item.planned_date ?? '').slice(0, 10)
      if (!date) continue
      if (date < localToday) continue

      const amount = Math.abs(Number(item.planned_personal_amount ?? item.planned_amount ?? 0))
      const isOutflow = item.flow_type === 'expense' || item.flow_type === 'savings'

      if (date <= end3) {
        count3 += 1
        if (isOutflow) amount3 += amount
        else amount3 -= amount
        items3.push(item)
      }

      if (date <= eomDateStr) {
        countEom += 1
        if (isOutflow) amountEom += amount
        else amountEom -= amount
        itemsEom.push(item)
      }
    }

    return {
      j3: { count: count3, amount: amount3, items: items3 },
      eom: { count: countEom, amount: amountEom, items: itemsEom },
    }
  }, [upcomingOps, now, eomDateStr])

  const driftCategories = useMemo(() => {
    const rows = summaries ?? []
    const operations = driftOperations ?? []
    const operationsByCategory = new Map<string, typeof operations>()

    for (const operation of operations) {
      if (!operation.categoryId) continue
      const current = operationsByCategory.get(operation.categoryId) ?? []
      current.push(operation)
      operationsByCategory.set(operation.categoryId, current)
    }

    return rows
      .filter((row) => Number(row.budget_amount ?? 0) > 0)
      .map((row) => {
        const budget = Number(row.budget_amount ?? 0)
        const categoryOperations = [...(operationsByCategory.get(row.category.id) ?? [])]
          .sort((a, b) => a.operationDate.localeCompare(b.operationDate))
        const spent = categoryOperations.reduce((sum, operation) => sum + Math.abs(Number(operation.budgetAccountingAmount ?? 0)), 0)
        const overrunAmount = Math.max(0, spent - budget)
        if (overrunAmount <= 0) return null

        const driftPct = budget > 0 ? (spent / budget) * 100 - 100 : 0
        let exceedDateStr: string | null = null
        let cumul = 0
        for (const operation of categoryOperations) {
          cumul += Math.abs(Number(operation.budgetAccountingAmount ?? 0))
          if (cumul > budget) {
            exceedDateStr = `${operation.operationDate.slice(8, 10)}/${operation.operationDate.slice(5, 7)}`
            break
          }
        }

        return {
          id: row.category.id,
          name: row.category.name,
          iconKey: row.category.icon_key ?? categoryOperations[0]?.categoryIconKey ?? null,
          colorToken: row.category.color_token,
          spent,
          driftPct,
          overrunAmount,
          exceedDate: exceedDateStr,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.overrunAmount - a.overrunAmount)
      .slice(0, 6)
  }, [driftOperations, summaries])

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
  const prevTabRef = useRef<string | null>(null)
  const currentTab = selectedAccountPresetId ?? 'compte_principal'
  const direction = prevTabRef.current === 'compte_principal' && currentTab === 'budget_voyage' ? 1 : -1

  useEffect(() => {
    prevTabRef.current = currentTab
  }, [currentTab])

  const [selectedDriftCategoryId, setSelectedDriftCategoryId] = useState<string | null>(null)
  const [showDriftCategoryModal, setShowDriftCategoryModal] = useState(false)
  const [showDriftsModal, setShowDriftsModal] = useState(false)
  const [showResteUtileModal, setShowResteUtileModal] = useState(false)
  const [showHeroBalanceModal, setShowHeroBalanceModal] = useState(false)
  const [showSavingsModal, setShowSavingsModal] = useState(false)
  const [showOptimizationsModal, setShowOptimizationsModal] = useState(false)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [showPlannedOpsModal, setShowPlannedOpsModal] = useState(false)
  const [showPlannedOpsEomModal, setShowPlannedOpsEomModal] = useState(false)
  const [infosExpanded, setInfosExpanded] = useState(false)
  const [tripExpenseModalOpen, setTripExpenseModalOpen] = useState(false)
  const [tripExpenseInitialId, setTripExpenseInitialId] = useState<string | null>(null)
  const [matchingSheetOpen,   setMatchingSheetOpen]   = useState(false)
  const [matchingTripId,      setMatchingTripId]      = useState<string | null>(null)
  const [matchingTripName,    setMatchingTripName]    = useState<string | null>(null)

  useEffect(() => {
    if (!accountEntries.length) {
      setSelectedAccountPresetId(null)
      return
    }
    setSelectedAccountPresetId((current) => {
      if (current === BUDGET_VOYAGE_TAB_ID) return current
      if (current && accountEntries.some((entry) => entry.preset.id === current)) return current
      return accountEntries[0].preset.id
    })
  }, [accountEntries])

  useEffect(() => {
    if (!showDriftCategoryModal && !showDriftsModal && !showResteUtileModal && !showHeroBalanceModal && !showSavingsModal && !showOptimizationsModal && !showProgressModal && !showPlannedOpsModal && !showPlannedOpsEomModal) return
    return lockDocumentScroll()
  }, [showDriftCategoryModal, showDriftsModal, showResteUtileModal, showHeroBalanceModal, showSavingsModal, showOptimizationsModal, showProgressModal, showPlannedOpsModal, showPlannedOpsEomModal])

  useEffect(() => {
    if (!showResteUtileModal && !showDriftsModal && !showHeroBalanceModal && !showSavingsModal && !showOptimizationsModal && !showProgressModal && !showPlannedOpsModal && !showPlannedOpsEomModal) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowResteUtileModal(false)
        setShowDriftsModal(false)
        setShowHeroBalanceModal(false)
        setShowSavingsModal(false)
        setShowOptimizationsModal(false)
        setShowProgressModal(false)
        setShowPlannedOpsModal(false)
        setShowPlannedOpsEomModal(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showResteUtileModal, showDriftsModal, showHeroBalanceModal, showSavingsModal, showOptimizationsModal, showProgressModal, showPlannedOpsModal, showPlannedOpsEomModal])

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
  const isBudgetVoyageTab = selectedAccountPresetId === BUDGET_VOYAGE_TAB_ID
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
  const todayShortDateLabel = useMemo(
    () => {
      const label = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      return label.replace('.', '')
    },
    [now],
  )
  const fixedBudgetAmountDisplay = Number(dailyPayload?.budgets.fixed_budget_amount ?? 0)
  const provisionBudgetAmountDisplay = Number(dailyPayload?.budgets.provision_budget_amount ?? 0)
  const fallbackSavingsBudgetAmountDisplay = Number(dailyPayload?.budgets.savings_budget_amount ?? 0)
  const planningEffectiveSavingsAmountDisplay = Number(currentMonthSavingsPlanning?.effectivePlannedSavingsAmount ?? 0)
  const plannedSavingsAmountDisplay = planningEffectiveSavingsAmountDisplay > 0
    ? planningEffectiveSavingsAmountDisplay
    : fallbackSavingsBudgetAmountDisplay
  const { data: usefulRemainingData } = useHomeUsefulRemaining({
    year,
    month,
    fixedBudgetAmount: fixedBudgetAmountDisplay,
    provisionBudgetAmount: provisionBudgetAmountDisplay,
    savingsBudgetAmount: plannedSavingsAmountDisplay,
    daysRemaining,
  })
  const resteUtileDisplay = Number(usefulRemainingData?.usefulRemainingAmount ?? dailyPayload?.daily_pilotage.remaining_useful_amount ?? 0)
  const budgetPerDayDisplay = Number(usefulRemainingData?.budgetPerDayAmount ?? dailyPayload?.daily_pilotage.budget_per_remaining_day ?? 0)
  const plannedFutureDisplay = Number(dailyPayload?.planned_operations_impact.additional_commitment_amount ?? 0)
  const previsionFinDeMoisDisplay = Number(dailyPayload?.totals.projected_end_of_month_expense_amount ?? 0)
  const variableBudgetMonthlyDisplay = Number(dailyPayload?.totals.variable_budget_amount ?? 0)
  const variableSpentToDateDisplay = Number(dailyPayload?.totals.variable_actual_amount ?? 0)
  const mainAccountResteUtileDisplay = resteUtileDisplay
  const mainAccountDailyAvailableDisplay = budgetPerDayDisplay
  const fallbackMainAccountBalanceDisplay = Number(dailyPayload?.account.main_account_balance ?? 0)
  const estimatedMainAccountBalance = Number(mainAccountBalanceStatus?.estimated_balance_today)
  const hasEstimatedMainAccountBalance = Number.isFinite(estimatedMainAccountBalance)
  const mainAccountBalanceDisplay = hasEstimatedMainAccountBalance
    ? estimatedMainAccountBalance
    : fallbackMainAccountBalanceDisplay

  const animatedResteUtile = useCountUp(resteUtileDisplay)
  const animatedBudgetPerDay = useCountUp(budgetPerDayDisplay)
  const animatedBalance = useCountUp(mainAccountBalanceDisplay)
  const observedOperationalBalanceDisplay = mainAccountBalanceStatus?.observed_operational_balance_amount
  const observedDateDayMonthLabel = useMemo(() => {
    const observedDate = mainAccountBalanceStatus?.observed_date
    if (!observedDate) return '—'
    const [yearPart, monthPart, dayPart] = observedDate.split('-')
    if (!yearPart || !monthPart || !dayPart) return '—'
    return `${dayPart}/${monthPart}`
  }, [mainAccountBalanceStatus?.observed_date])
  const todayDayMonthLabel = useMemo(() => {
    const day = String(now.getDate()).padStart(2, '0')
    const monthValue = String(now.getMonth() + 1).padStart(2, '0')
    return `${day}/${monthValue}`
  }, [now])
  const actualDeltaSinceObservedDisplay = mainAccountBalanceStatus?.actual_delta_since_observed
  const plannedDeltaEomDisplay = mainAccountBalanceStatus?.future_planned_delta_eom
  const projectedBalanceEomDisplay = mainAccountBalanceStatus?.projected_balance_eom
  const hasMissingSnapshot = mainAccountBalanceStatus?.confidence_level === 'missing_snapshot'

  const revenueAmountDisplay = Number(dailyPayload?.realized.revenue_amount ?? 0)
  const overallConsumedPct = useMemo(() => {
    const consumed = Number(dailyPayload?.totals.consumed_pct ?? 0)
    return Math.max(0, Math.min(100, consumed))
  }, [dailyPayload])

  const monthlyBlockProgress = useMemo<MonthlyBlockProgressItem[]>(() => {
    return EXPENSE_BUCKET_IDS.map((id) => {
      const monthlyBudget = Number(
        dailyPayload?.by_bucket.find((b) => b.budget_bucket === id)?.budget_amount ?? 0,
      )
      const actual = Number(
        dailyPayload?.by_bucket.find((b) => b.budget_bucket === id)?.actual_amount ?? 0,
      )
      const pct = monthlyBudget > 0 ? (actual / monthlyBudget) * 100 : 0
      return { id, label: EXPENSE_BUCKET_LABELS[id], actual, budget: monthlyBudget, pct }
    })
  }, [dailyPayload])

  const savingsMonthlyGoalDisplay = Number(dailyPayload?.budgets.savings_budget_amount ?? 0)
  const savingsMonthlySavedDisplay = Number(dailyPayload?.realized.savings_actual_amount ?? 0)
  const savingsYtdDisplay = Number(dailyPayload?.realized.savings_actual_amount ?? 0)
  const savingsAnnualGoalDisplay = Number(dailyPayload?.budgets.savings_budget_amount ?? 0) * 12
  const savingsProgressPct = useMemo(() => {
    if (savingsMonthlyGoalDisplay <= 0) return 0
    return Math.max(0, Math.min(100, (savingsMonthlySavedDisplay / savingsMonthlyGoalDisplay) * 100))
  }, [savingsMonthlyGoalDisplay, savingsMonthlySavedDisplay])
  const savingsGoalReached = savingsProgressPct >= 100
  const savingsTileStatus: SavingsTileStatus = useMemo(() => {
    if (savingsGoalReached) return 'validated'
    if (daysRemaining <= 10) return 'alert'
    return 'pending'
  }, [daysRemaining, savingsGoalReached])
  const savingsMonthLabel = useMemo(
    () => new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
    [month, year],
  )
  const savingsTileMonthAmountLabel = useMemo(
    () => `${savingsMonthLabel} ${formatCurrencyFloored(savingsMonthlySavedDisplay)}`,
    [savingsMonthLabel, savingsMonthlySavedDisplay],
  )
  const variableEssentialConsumedDisplay = Number(
    dailyPayload?.by_bucket.find((bucket) => bucket.budget_bucket === 'variable_essentielle')?.actual_amount ?? 0,
  )
  const discretionaryConsumedDisplay = Number(
    dailyPayload?.by_bucket.find((bucket) => bucket.budget_bucket === 'discretionnaire')?.actual_amount ?? 0,
  )
  const protectedAmountsTotalDisplay = useMemo(
    () => fixedBudgetAmountDisplay + provisionBudgetAmountDisplay + plannedSavingsAmountDisplay,
    [fixedBudgetAmountDisplay, plannedSavingsAmountDisplay, provisionBudgetAmountDisplay],
  )

  useEffect(() => {
    if (!import.meta.env.DEV || !dailyPayload) return
    console.log('[HomeDailyBudgetPayload]', dailyPayload)
    console.log('[Home by_bucket]', dailyPayload.by_bucket)
    console.log('[Home by_category sample]', dailyPayload.by_category?.slice(0, 5))
    console.log('[Home planned operations items]', dailyPayload?.planned_operations?.items)
  }, [dailyPayload])

  const handleSelectAccountPreset = useCallback((presetId: string) => {
    const normalized = presetId === 'ldds' ? 'livret_a' : mapPresetIdToDisplayed(presetId)
    setSelectedAccountPresetId(normalized)
  }, [])

  // ─── Swipe horizontal pour changer d'onglet ────────────────────────────────
  const swipeTouchStart = useRef<{ x: number; y: number } | null>(null)

  const handleSwipeTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0]
    swipeTouchStart.current = { x: t.clientX, y: t.clientY }
  }, [])

  const handleSwipeTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!swipeTouchStart.current) return
      const t = e.changedTouches[0]
      const deltaX = t.clientX - swipeTouchStart.current.x
      const deltaY = t.clientY - swipeTouchStart.current.y
      swipeTouchStart.current = null

      // Seuils : horizontal significatif ET dominant
      if (Math.abs(deltaX) < SWIPE_MIN_DELTA_X) return
      if (Math.abs(deltaX) <= Math.abs(deltaY) * SWIPE_RATIO) return

      // Ignorer si la cible est dans un élément scrollable horizontalement
      const target = e.target as HTMLElement
      if (target.closest('[data-swipe-ignore]')) return

      if (deltaX < 0) {
        // swipe gauche → onglet Voyage
        handleSelectAccountPreset('budget_voyage')
      } else {
        // swipe droite → onglet Compte
        handleSelectAccountPreset('compte_principal')
      }
    },
    [handleSelectAccountPreset],
  )

  const heroMetrics = useMemo(
    () => [
      { key: 'reste', label: 'Reste utile', value: formatCurrencyFloored(resteUtileDisplay) },
      { key: 'jour', label: 'Budget / jour', value: formatCurrencyFloored(budgetPerDayDisplay) },
      { key: 'avenir', label: 'Dépenses à venir', value: formatCurrencyFloored(plannedFutureDisplay) },
      { key: 'fin', label: 'Fin de mois', value: formatCurrencyFloored(previsionFinDeMoisDisplay) },
    ],
    [budgetPerDayDisplay, plannedFutureDisplay, previsionFinDeMoisDisplay, resteUtileDisplay],
  )

  const mainCheckingHeroMetrics = useMemo(
    () => [
      { key: 'variable-budget', label: 'Budget variable', value: formatCurrencyFloored(variableBudgetMonthlyDisplay) },
      { key: 'variable-spent', label: 'Variable consommé', value: formatCurrencyFloored(variableSpentToDateDisplay) },
      { key: 'reste-utile-main', label: 'Reste utile', value: formatCurrencyFloored(mainAccountResteUtileDisplay) },
      { key: 'daily-available', label: 'Disponible / jour', value: formatCurrencyFloored(mainAccountDailyAvailableDisplay) },
    ],
    [mainAccountDailyAvailableDisplay, mainAccountResteUtileDisplay, variableBudgetMonthlyDisplay, variableSpentToDateDisplay],
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
        overrunAmount: c.overrunAmount,
      })),
    [driftCategories],
  )
  const driftOverrunTotal = useMemo(
    () => driftRows.reduce((sum, row) => sum + Math.max(0, Number(row.overrunAmount ?? 0)), 0),
    [driftRows],
  )
  const loadingDriftsData = loadingSummaries || loadingDriftOperations


  const top5ExpenseRows = useMemo(() => {
    const rows = driftOperations ?? []
    const categoryNameById = new Map<string, string>()
    ;(summaries ?? []).forEach((summary) => {
      categoryNameById.set(summary.category.id, summary.category.name)
    })
    const spentByCategory = new Map<string, { id: string; name: string; spent: number }>()
    rows.forEach((operation) => {
      if (!operation.categoryId) return
      const current = spentByCategory.get(operation.categoryId)
      spentByCategory.set(operation.categoryId, {
        id: operation.categoryId,
        name: current?.name ?? categoryNameById.get(operation.categoryId) ?? operation.categoryName ?? 'Catégorie',
        spent: (current?.spent ?? 0) + Math.abs(Number(operation.budgetAccountingAmount ?? 0)),
      })
    })
    const budgetsByCategory = new Map<string, number>()
    ;(summaries ?? []).forEach((summary) => {
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
  }, [driftOperations, summaries])

  const selectedDriftCategoryMeta = useMemo(() => {
    if (!selectedDriftCategoryId) return null
    return driftRows.find((r) => r.id === selectedDriftCategoryId) ?? null
  }, [selectedDriftCategoryId, driftRows])
  const selectedDriftCategoryColor = useMemo(
    () => getCategoryColor(selectedDriftCategoryMeta?.colorToken ?? null, 0, selectedDriftCategoryMeta?.name),
    [selectedDriftCategoryMeta?.colorToken, selectedDriftCategoryMeta?.name],
  )

  const selectedDriftCategoryTransactions = useMemo(() => {
    if (!selectedDriftCategoryId) return null
    const rows = driftOperations ?? []
    return rows
      .filter((operation) => operation.categoryId === selectedDriftCategoryId)
      .sort((a, b) => b.operationDate.localeCompare(a.operationDate))
      .map((operation) => ({
        id: operation.id,
        operation_date: operation.operationDate,
        label: operation.label || operation.categoryName || 'Opération',
        amount: Math.abs(Number(operation.budgetAccountingAmount ?? 0)),
        iconKey: operation.categoryIconKey ?? selectedDriftCategoryMeta?.iconKey ?? null,
      }))
  }, [driftOperations, selectedDriftCategoryId, selectedDriftCategoryMeta?.iconKey])

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
      onTouchStart={handleSwipeTouchStart}
      onTouchEnd={handleSwipeTouchEnd}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      <header
        style={{
          height: 'var(--header-height)',
          paddingRight: 'var(--page-gutter)',
          paddingBottom: 'var(--space-2)',
          paddingLeft: 'var(--page-gutter)',
          boxSizing: 'border-box',
          background: 'linear-gradient(135deg, var(--primary-700) 0%, var(--primary-500) 100%)',
          borderBottom: '1px solid color-mix(in oklab, var(--primary-800) 35%, var(--primary-500) 65%)',
          position: 'sticky',
          top: 0,
          zIndex: 120,
          marginBottom: 'var(--space-2)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
      >
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', minHeight: 44, width: '100%' }}>
          <h1
            style={{
              margin: 0,
              fontSize: 'var(--font-size-2xl)',
              lineHeight: 1.1,
              fontWeight: 'var(--font-weight-extrabold)',
              color: 'var(--neutral-0)',
              letterSpacing: '-0.02em',
            }}
          >
            {isBudgetVoyageTab ? 'Voyage' : 'Accueil'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {HOME_SWIPE_PILLS.map((pill) => {
                const isActive = selectedAccountPresetId === pill.id || (!selectedAccountPresetId && pill.id === 'compte_principal')
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => handleSelectAccountPreset(pill.id)}
                    aria-pressed={isActive}
                    style={{
                      border: `1px solid ${isActive ? '#5B57F5' : 'rgba(255,255,255,0.46)'}`,
                      background: 'rgba(255,255,255,0.7)',
                      backdropFilter: 'blur(12px)',
                      color: isActive ? '#5B57F5' : 'var(--neutral-800)',
                      borderRadius: 'var(--radius-full)',
                      padding: '4px var(--space-3)',
                      fontSize: 13,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 150ms ease, border-color 150ms ease, transform 150ms ease',
                    }}
                  >
                    {pill.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </header>

      <div style={{ overflow: 'hidden', width: '100%' }}>
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={isBudgetVoyageTab ? 'voyage' : 'compte'}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'tween', duration: 0.26, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.22 },
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', width: '100%' }}
          >
            <section style={{ padding: sectionHorizontalPadding }}>
              <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative' }}>
                {/* Left Swipe Arrow */}
                <button
                  type="button"
                  onClick={() => handleSelectAccountPreset('compte_principal')}
                  disabled={selectedAccountPresetId === 'compte_principal' || !selectedAccountPresetId}
                  style={{
                    position: 'absolute',
                    left: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10,
                    border: 'none',
                    background: 'rgba(255, 255, 255, 0.18)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    color: '#FFFFFF',
                    opacity: selectedAccountPresetId === 'budget_voyage' ? 0.75 : 0.08,
                    pointerEvents: selectedAccountPresetId === 'budget_voyage' ? 'auto' : 'none',
                    transition: 'opacity var(--transition-fast), background var(--transition-fast)',
                    cursor: selectedAccountPresetId === 'budget_voyage' ? 'pointer' : 'default',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 'var(--radius-full)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  }}
                  onMouseEnter={e => {
                    if (selectedAccountPresetId === 'budget_voyage') {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.28)'
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)'
                  }}
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Right Swipe Arrow */}
                <button
                  type="button"
                  onClick={() => handleSelectAccountPreset('budget_voyage')}
                  disabled={selectedAccountPresetId === 'budget_voyage'}
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10,
                    border: 'none',
                    background: 'rgba(255, 255, 255, 0.18)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    color: '#FFFFFF',
                    opacity: selectedAccountPresetId === 'compte_principal' || !selectedAccountPresetId ? 0.75 : 0.08,
                    pointerEvents: selectedAccountPresetId === 'compte_principal' || !selectedAccountPresetId ? 'auto' : 'none',
                    transition: 'opacity var(--transition-fast), background var(--transition-fast)',
                    cursor: selectedAccountPresetId === 'compte_principal' || !selectedAccountPresetId ? 'pointer' : 'default',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 'var(--radius-full)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  }}
                  onMouseEnter={e => {
                    if (selectedAccountPresetId !== 'budget_voyage') {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.28)'
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)'
                  }}
                >
                  <ChevronRight size={16} />
                </button>

                {isBudgetVoyageTab ? (
                  <TripCockpitCard
                    onViewDetail={(tripId) => navigate(tripId ? `/voyages/${tripId}` : '/voyages')}
                    onAddExpense={(tripId) => {
                      setTripExpenseInitialId(tripId)
                      setTripExpenseModalOpen(true)
                    }}
                    onMatch={(tripId, tripName) => {
                      setMatchingTripId(tripId)
                      setMatchingTripName(tripName ?? null)
                      setMatchingSheetOpen(true)
                    }}
                  />
                ) : isCombinedSavingsPage ? (
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
                      <div
                        style={{
                          background: 'radial-gradient(120% 90% at 14% -8%, rgba(56, 189, 248, 0.35) 0%, rgba(56, 189, 248, 0) 58%), radial-gradient(98% 82% at 100% 100%, rgba(91, 87, 245, 0.3) 0%, rgba(91, 87, 245, 0) 62%), linear-gradient(145deg, #0B132B 0%, #1C2541 47%, #3A506B 100%)',
                          borderRadius: 'var(--radius-xl)',
                          boxShadow: 'var(--shadow-card)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          overflow: 'hidden',
                          padding: 'var(--space-4)',
                          display: 'grid',
                          gap: 'var(--space-4)',
                        }}
                      >
                        {/* ── Header: Nom + Date ─────────────────────── */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 4 }}>
                              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Compte principal
                              </h3>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.95)' }}>
                              {todayShortDateLabel}
                            </span>
                          </div>
                        </div>

                        {/* ── Central Progress Ring ─────────────────────────────── */}
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-2) 0' }}>
                          <AccountProgressRing
                            pct={overallConsumedPct}
                            amountText={formatCurrencyFloored(animatedResteUtile)}
                            onClick={() => setShowResteUtileModal(true)}
                          />
                        </div>

                        {/* ── Calculation Line ──────────────────────────────────── */}
                        <div style={{ textAlign: 'center', display: 'grid', gap: 2 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>
                            Budget / jour : <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrencyFloored(animatedBudgetPerDay)}</span>
                          </p>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
                            {overallConsumedPct.toFixed(0)}% consommé
                          </p>
                        </div>

                        {/* ── CTAs ──────────────────────────────────────────────── */}
                        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
                          <button
                            type="button"
                            onClick={() => setShowHeroBalanceModal(true)}
                            aria-label="Voir le détail du solde bancaire du compte principal"
                            style={{
                              flex: '1 1 auto',
                              display: 'inline-flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 1,
                              border: '1px solid rgba(255,255,255,0.25)',
                              background: 'rgba(255,255,255,0.1)',
                              color: '#FFFFFF',
                              borderRadius: 'var(--radius-button)',
                              padding: '4px var(--space-3)',
                              minHeight: 40,
                              cursor: 'pointer',
                              transition: 'background 120ms ease',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.18)'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                            }}
                          >
                            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                              Solde estimé
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                              {formatCurrencyFloored(animatedBalance)}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowDriftsModal(true)}
                            aria-label="Voir le détail des dérives"
                            style={{
                              flex: '1 1 auto',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 'var(--space-2)',
                              border: driftRows.length > 0 ? '1px solid rgba(252,90,90,0.4)' : '1px solid rgba(255,255,255,0.25)',
                              background: driftRows.length > 0 ? 'rgba(252,90,90,0.12)' : 'rgba(255,255,255,0.1)',
                              color: driftRows.length > 0 ? '#FC5A5A' : 'rgba(255,255,255,0.9)',
                              borderRadius: 'var(--radius-button)',
                              padding: '4px var(--space-3)',
                              minHeight: 40,
                              cursor: 'pointer',
                              transition: 'background 120ms ease',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = driftRows.length > 0 ? 'rgba(252,90,90,0.2)' : 'rgba(255,255,255,0.18)'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = driftRows.length > 0 ? 'rgba(252,90,90,0.12)' : 'rgba(255,255,255,0.08)'
                            }}
                          >
                            {driftRows.length > 0 ? (
                              <>
                                <TriangleAlert size={15} color="#FC5A5A" />
                                <span style={{ fontSize: 12, fontWeight: 700 }}>
                                  {`${driftRows.length} dérive${driftRows.length > 1 ? 's' : ''}`}
                                </span>
                              </>
                            ) : (
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                                Aucune dérive
                              </span>
                            )}
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
            </section>

      {!isCombinedSavingsPage && !isBudgetVoyageTab ? (
        <>
          {!isMainCheckingAccount ? (
            <section
              style={{ padding: sectionHorizontalPadding }}
            >
              <div
                style={{
                  maxWidth: 600,
                  margin: '0 auto',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-3)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowResteUtileModal(true)}
                  aria-label="Voir le détail du calcul du reste utile"
                  style={{
                    border: '1px solid rgba(255, 218, 130, 0.45)',
                    background: 'radial-gradient(120% 90% at 14% -8%, rgba(255,239,178,0.56) 0%, rgba(255,239,178,0) 58%), radial-gradient(98% 82% at 100% 100%, rgba(255,181,72,0.4) 0%, rgba(255,181,72,0) 62%), linear-gradient(145deg, #5B3B06 0%, #A97512 46%, #E3AF30 100%)',
                    borderRadius: 'var(--radius-xl)',
                    boxShadow: 'var(--shadow-card)',
                    padding: 'var(--space-3)',
                    display: 'grid',
                    gap: 'var(--space-2)',
                    alignContent: 'start',
                    textAlign: 'left',
                    cursor: 'pointer',
                    minHeight: 112,
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-2)', alignItems: 'start' }}>
                    <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'rgba(255,244,221,0.92)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        Reste utile
                      </p>
                      <p style={{ margin: 0, fontSize: 'clamp(20px, 5.4vw, 28px)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#FFD550', lineHeight: 1.05, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                        {formatCurrencyFloored(resteUtileDisplay)}
                      </p>
                    </div>

                    <div style={{ minWidth: 0, display: 'grid', gap: 2, justifyItems: 'end', textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'rgba(255,244,221,0.92)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        Budget/jour
                      </p>
                      <p style={{ margin: 0, fontSize: 'clamp(20px, 5.2vw, 26px)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#FFF8EC', lineHeight: 1.05, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                        {formatCurrencyFloored(budgetPerDayDisplay)}
                      </p>
                    </div>
                  </div>
                </button>
                <ProgressCircleTile
                  pct={overallConsumedPct}
                  onClick={() => setShowProgressModal(true)}
                />
              </div>
            </section>
          ) : null}

          {isMainCheckingAccount ? (
            <section
              style={{ padding: sectionHorizontalPadding }}
            >
              <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 var(--space-2)' }}>
                <PlannedOpsTimeline
                  j3Count={upcomingOpsWindows.j3.count}
                  j3Amount={upcomingOpsWindows.j3.amount}
                  eomCount={upcomingOpsWindows.eom.count}
                  eomAmount={upcomingOpsWindows.eom.amount}
                  daysUntilEom={daysRemaining}
                  onClickJ3={() => setShowPlannedOpsModal(true)}
                  onClickEom={() => setShowPlannedOpsEomModal(true)}
                />
              </div>
            </section>
          ) : null}

          {isMainCheckingAccount ? (
            <section
              style={{ padding: sectionHorizontalPadding }}
            >
              <div
                style={{
                  maxWidth: 600,
                  margin: '0 auto',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 'var(--space-3)',
                }}
              >
                <OptimizationsTile onClick={() => setShowOptimizationsModal(true)} theme="dark" />
                <SavingsGoalTile
                  goalAmount={savingsMonthlyGoalDisplay}
                  reached={savingsGoalReached}
                  onClick={() => setShowSavingsModal(true)}
                />
              </div>
            </section>
          ) : (
            <>
              <section
                style={{ padding: sectionHorizontalPadding }}
              >
                <div
                  style={{
                    maxWidth: 600,
                    margin: '0 auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 'var(--space-3)',
                  }}
                >
                  <SavingsTile
                    status={savingsTileStatus}
                    monthAmountLabel={savingsTileMonthAmountLabel}
                    onClick={() => setShowSavingsModal(true)}
                  />
                  <DriftsTile
                    count={driftRows.length}
                    totalOverrunAmount={driftOverrunTotal}
                    onClick={() => setShowDriftsModal(true)}
                  />
                  <OptimizationsTile onClick={() => setShowOptimizationsModal(true)} />
                  <SavingsGoalTile
                    goalAmount={savingsMonthlyGoalDisplay}
                    reached={savingsGoalReached}
                    onClick={() => setShowSavingsModal(true)}
                  />
                </div>
              </section>
            </>
          )}

          {/* ── Module libre Infos — tuile cloche dépliable ── */}
          <section
            style={{ padding: sectionHorizontalPadding }}
          >
            <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', justifyContent: 'flex-start' }}>
              <button
                id="infos-bell-btn"
                type="button"
                onClick={() => setInfosExpanded(prev => !prev)}
                aria-label={showSnapshotReminder ? 'Voir les informations disponibles' : 'Aucune information'}
                style={{
                  width: infosExpanded ? '100%' : '48px',
                  height: 48,
                  borderRadius: 'var(--radius-xl)',
                  border: showSnapshotReminder
                    ? '1.5px solid rgba(91, 87, 245, 0.35)'
                    : '1.5px solid rgba(91, 87, 245, 0.12)',
                  background: showSnapshotReminder
                    ? 'linear-gradient(135deg, rgba(91, 87, 245, 0.12) 0%, rgba(139, 92, 246, 0.06) 100%)'
                    : 'rgba(91, 87, 245, 0.03)',
                  boxShadow: 'var(--shadow-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: infosExpanded ? 'space-between' : 'center',
                  cursor: 'pointer',
                  transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1), background 150ms ease, box-shadow 150ms ease, transform 150ms ease',
                  flexShrink: 0,
                  position: 'relative',
                  padding: infosExpanded ? '0 var(--space-4)' : 0,
                  overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-card)'
                }}
              >
                {!infosExpanded ? (
                  <>
                    <Bell
                      size={20}
                      color={showSnapshotReminder ? '#5B57F5' : 'rgba(91, 87, 245, 0.5)'}
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                    {showSnapshotReminder && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#5B57F5',
                          border: '2px solid var(--neutral-0)',
                        }}
                      />
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 'var(--space-3)', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                      <Bell
                        size={20}
                        color={showSnapshotReminder ? '#5B57F5' : 'rgba(91, 87, 245, 0.5)'}
                        strokeWidth={2.2}
                      />
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--neutral-800)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {showSnapshotReminder
                          ? 'Snapshot fin de mois prêt : valide tes catégories.'
                          : 'Aucune info pour le moment.'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                      {showSnapshotReminder && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/budgets');
                          }}
                          style={{
                            border: 'none',
                            background: '#5B57F5',
                            color: '#fff',
                            borderRadius: 'var(--radius-md)',
                            height: '28px',
                            padding: '0 var(--space-3)',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Vérifier
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInfosExpanded(false);
                        }}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--neutral-500)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 4,
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </button>
            </div>
          </section>
        </>
      ) : null}
    </motion.div>
  </AnimatePresence>
</div>

      <BottomSheet
        open={showOptimizationsModal}
        onClose={() => setShowOptimizationsModal(false)}
        title="Optimisations"
        zIndex={67}
        variant="center"
      >
        <div style={{ padding: 'var(--space-4) var(--space-5)', display: 'grid', gap: 'var(--space-3)' }}>
          {optimizationsData.map((row) => (
            <article
              key={`optim-${row.label}`}
              style={{
                border: '1.5px solid var(--neutral-200)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                display: 'grid',
                gap: 'var(--space-2)',
                background: 'var(--neutral-0)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <CategoryIcon iconKey={row.iconKey} label={row.label} size={20} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--neutral-900)' }}>
                    {row.label}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--neutral-600)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatCurrencyFloored(row.consumedAmount)} / {formatCurrencyFloored(row.objectiveAmount)}
                </span>
              </div>

              <div
                style={{
                  height: 8,
                  width: '100%',
                  background: 'var(--neutral-150)',
                  borderRadius: 'var(--radius-full)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, row.progressPct))}%`,
                    background: row.barColor,
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet
        open={showSavingsModal}
        onClose={() => setShowSavingsModal(false)}
        title="Épargne"
        zIndex={68}
        variant="center"
      >
        <div style={{ padding: 'var(--space-4) var(--space-5)', display: 'grid', gap: 'var(--space-4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--neutral-600)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Objectif mensuel
              </p>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>
                {formatCurrencyFloored(savingsMonthlyGoalDisplay)}
              </p>
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--neutral-600)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Progression
              </p>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>
                {`${savingsProgressPct.toFixed(0)}%`}
              </p>
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--neutral-200)' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--neutral-600)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Épargné 2026 YTD
              </p>
              <p style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>
                {formatCurrencyFloored(savingsYtdDisplay)}
              </p>
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--neutral-600)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Objectif annuel
              </p>
              <p style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>
                {formatCurrencyFloored(savingsAnnualGoalDisplay)}
              </p>
            </div>
          </div>
        </div>
      </BottomSheet>

      <AnimatePresence>
        {showHeroBalanceModal ? (
          <DetailModal
            open={showHeroBalanceModal}
            onClose={() => setShowHeroBalanceModal(false)}
            title="Solde compte courant"
            subtitle={`Sur la base du relevé du ${observedDateDayMonthLabel}`}
            accentColor="var(--primary-500)"
          >
            {loadingMainAccountBalanceStatus ? (
              <p style={{ margin: 0, textAlign: 'center', color: 'var(--neutral-500)', fontSize: 12 }}>Chargement du détail du solde…</p>
            ) : hasMainAccountBalanceStatusError ? (
              <p style={{ margin: 0, textAlign: 'center', color: 'var(--color-negative)', fontSize: 12 }}>
                Impossible de charger le détail canonique du solde. Valeur affichée en fallback.
              </p>
            ) : hasMissingSnapshot ? (
              <p style={{ margin: 0, textAlign: 'center', color: 'var(--neutral-700)', fontSize: 13 }}>
                Aucun solde bancaire de référence disponible.
              </p>
            ) : (
              <>
                <DetailModalRow
                  label="Solde opérationnel relevé"
                  value={formatCurrencyFloored(Number(observedOperationalBalanceDisplay ?? 0))}
                />
                <DetailModalRow
                  label="Mouvements depuis observation"
                  value={formatSignedCurrency(Number(actualDeltaSinceObservedDisplay ?? 0))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--neutral-600)', lineHeight: 1.3 }}>
                    {`Solde estimé le ${todayDayMonthLabel}`}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color: '#D4AF37',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatCurrencyFloored(Number(mainAccountBalanceStatus?.estimated_balance_today ?? 0))}
                  </span>
                </div>
                <DetailModalSeparator />
                <DetailModalRow
                  label="Opérations prévues restantes"
                  value={formatCurrencyFloored(Number(plannedDeltaEomDisplay ?? 0))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--neutral-600)', lineHeight: 1.3 }}>
                    Solde projeté fin de mois
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color: '#D4AF37',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatCurrencyFloored(Number(projectedBalanceEomDisplay ?? 0))}
                  </span>
                </div>
              </>
            )}
          </DetailModal>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showResteUtileModal ? (
          <DetailModal
            open={showResteUtileModal}
            onClose={() => setShowResteUtileModal(false)}
            title="Détails du calcul"
            accentColor="var(--primary-500)"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#111827' }}>
                {'\u25b8'} Revenus encaissés
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-positive)', whiteSpace: 'nowrap' }}>
                {`+${formatCurrencyFloored(revenueAmountDisplay)}`}
              </span>
            </div>

            <div style={{ height: 2 }} />

            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#111827' }}>
              {'\u25b8'} Montants protégés
            </div>
            <DetailModalRow label="− Socle fixe prévu" value={formatCurrencyFloored(fixedBudgetAmountDisplay)} />
            <DetailModalRow label="− Provisions prévues" value={formatCurrencyFloored(provisionBudgetAmountDisplay)} />
            <DetailModalRow label="− Épargne prévue" value={formatCurrencyFloored(plannedSavingsAmountDisplay)} />

            <div
              style={{
                marginTop: 2,
                border: '1px solid var(--neutral-200)',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(17,24,39,0.03)',
                padding: '10px 12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#2C2E3D' }}>Total protégé</span>
                <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-negative)', whiteSpace: 'nowrap' }}>
                  {`-${formatCurrencyFloored(protectedAmountsTotalDisplay)}`}
                </span>
              </div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#111827', marginTop: 2 }}>
              {'\u25b8'} Déjà consommé
            </div>
            <DetailModalRow label="− Variable essentielle consommée" value={formatCurrencyFloored(variableEssentialConsumedDisplay)} />
            <DetailModalRow label="− Discrétionnaire consommé" value={formatCurrencyFloored(discretionaryConsumedDisplay)} />

            <div
              style={{
                marginTop: 2,
                border: '1px solid var(--neutral-200)',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(17,24,39,0.03)',
                padding: '10px 12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#2C2E3D' }}>Total consommé</span>
                <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-negative)', whiteSpace: 'nowrap' }}>
                  {`-${formatCurrencyFloored(variableEssentialConsumedDisplay + discretionaryConsumedDisplay)}`}
                </span>
              </div>
            </div>
          </DetailModal>
        ) : null}
      </AnimatePresence>

      <BudgetProgressModal
        open={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        monthlyBlockProgress={monthlyBlockProgress}
        onBlockClick={(blockId) => {
          setShowProgressModal(false)
          navigate(`/budgets?block=${blockId}`)
        }}
      />

      <DriftsModal
        open={showDriftsModal}
        onClose={() => setShowDriftsModal(false)}
        driftRows={driftRows}
        totalOverrunAmount={driftOverrunTotal}
        top5ExpenseRows={top5ExpenseRows}
        loadingSummaries={loadingDriftsData}
        onCategoryClick={(id) => {
          setSelectedDriftCategoryId(id)
          setShowDriftCategoryModal(true)
        }}
      />

      <DriftCategoryTransactionsModal
        open={showDriftCategoryModal}
        onClose={() => {
          setShowDriftCategoryModal(false)
          setSelectedDriftCategoryId(null)
        }}
        categoryName={selectedDriftCategoryMeta?.name ?? null}
        categoryColor={selectedDriftCategoryColor}
        categoryTransactions={selectedDriftCategoryTransactions}
        loading={loadingDriftsData}
      />

      <TripManualExpenseModal
        open={tripExpenseModalOpen}
        onClose={() => {
          setTripExpenseModalOpen(false)
          setTripExpenseInitialId(null)
        }}
        initialTripId={tripExpenseInitialId}
      />

      <TripExpenseMatchingSheet
        open={matchingSheetOpen}
        onClose={() => {
          setMatchingSheetOpen(false)
          setMatchingTripId(null)
          setMatchingTripName(null)
        }}
        tripId={matchingTripId}
        tripName={matchingTripName}
      />

      <PlannedOpsModal
        open={showPlannedOpsModal}
        onClose={() => setShowPlannedOpsModal(false)}
        title="Échéances J+3"
        dotColor="var(--primary-500)"
        items={upcomingOpsWindows.j3.items}
      />
      <PlannedOpsModal
        open={showPlannedOpsEomModal}
        onClose={() => setShowPlannedOpsEomModal(false)}
        title="Échéances fin de mois"
        dotColor="#FFAB2E"
        items={upcomingOpsWindows.eom.items}
      />
    </div>
  )
}
