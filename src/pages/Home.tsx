import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Check, Minus, TriangleAlert, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAccounts } from '@/hooks/useAccounts'
import { useBudgetSummaries } from '@/hooks/useBudgets'
import {
  getCurrentPeriod,
  getDaysRemainingInMonth,
  getCategoryColor,
  formatCurrencyFloored,
  getTxLabel,
} from '@/lib/utils'
import type { AccountWithBalance } from '@/lib/types'
import { useTransactions } from '@/hooks/useTransactions'
import { PageHeader } from '@/components/layout/PageHeader'
import { lockDocumentScroll } from '@/lib/scrollLock'
import { getBudgetLinesForPeriod } from '@/features/budget/api/getBudgetLinesForPeriod'
import type { BudgetLineWithCategory } from '@/features/budget/types'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { useHomeDailyBudgetPayload } from '@/features/home/hooks/useHomeDailyBudgetPayload'
// Lazy-loaded: TrajectoireChart imports Recharts (445 KB raw). Deferring it keeps
// the Home initial bundle free of the chart library until the chart section renders.
const TrajectoireChart = lazy(() =>
  import('@/features/home/components/TrajectoireChart').then(m => ({ default: m.TrajectoireChart }))
)
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

const VISIBLE_ACCOUNT_PRESET_IDS = new Set(['compte_principal', 'compte_joint'])

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

const PER_ACCOUNT_ID = 'ef9f92c1-c6db-4672-8231-39ec75aa0195'

const MOCK_SAVINGS_MONTHLY_GOAL = 600
const MOCK_SAVINGS_MONTHLY_SAVED = 0
const MOCK_SAVINGS_2026_YTD = 4_240
const MOCK_SAVINGS_2026_ANNUAL_GOAL = 7_200

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

type OptimizationGaugeTone = 'success' | 'warning' | 'danger'

type OptimizationTileRow = OptimizationPriorityMock & {
  gaugeTone: OptimizationGaugeTone
  spentAmount: number
  budgetAmount: number
  monthlyTargetAmount: number
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

type DriftRowShape = { id: string; name: string; spent: number; driftPct: number; overrunAmount: number; iconKey: string | null; colorToken: string | null; exceedDate: string | null }
type Top5RowShape = { id: string; name: string; spent: number; driftPct: number }

function DriftsModal({
  open,
  onClose,
  driftRows,
  top5ExpenseRows,
  loadingSummaries,
  onCategoryClick,
}: {
  open: boolean
  onClose: () => void
  driftRows: DriftRowShape[]
  top5ExpenseRows: Top5RowShape[]
  loadingSummaries: boolean
  onCategoryClick: (id: string) => void
}) {
  const [showTop5, setShowTop5] = useState(false)

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,13,31,0.52)' }}
          />
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 201,
              display: 'grid',
              placeItems: 'center',
              padding: 'var(--space-4)',
              pointerEvents: 'none',
            }}
          >
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              style={{
                width: 'min(520px, 100%)',
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-2xl)',
                maxHeight: 'min(80dvh, calc(100dvh - var(--space-8)))',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--shadow-lg)',
                pointerEvents: 'auto',
              }}
            >
              <div
                style={{
                  padding: 'var(--space-4) var(--space-5)',
                  borderBottom: '1px solid var(--neutral-150)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <TriangleAlert size={17} color="var(--color-warning)" />
                  <p style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--neutral-900)' }}>
                    Catégories en dérive
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  style={{
                    border: 'none',
                    background: 'var(--neutral-100)',
                    color: 'var(--neutral-600)',
                    minWidth: 34,
                    minHeight: 34,
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

              <div style={{ overflowY: 'auto', flex: 1 }}>
                {loadingSummaries ? (
                  <p style={{ margin: 0, padding: 'var(--space-8) var(--space-5)', textAlign: 'center', fontSize: 12, color: 'var(--neutral-400)' }}>
                    Chargement…
                  </p>
                ) : driftRows.length === 0 ? (
                  <div style={{ display: 'grid', alignContent: 'center', justifyItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-6) var(--space-5)' }}>
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
                            <p key={row.id} style={{ margin: 0, fontSize: 12, color: 'var(--neutral-700)', lineHeight: 1.35 }}>
                              {`#${idx + 1}. ${row.name} — ${formatCurrencyFloored(row.spent)} — `}
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
                  <div style={{ padding: '0 var(--space-5)' }}>
                    {driftRows.map((row) => {
                      const drift = Number(row.driftPct ?? 0)
                      return (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => onCategoryClick(row.id)}
                          style={{
                            border: 'none',
                            borderBottom: '1px solid var(--neutral-100)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            minHeight: 44,
                            padding: '8px 0',
                            width: '100%',
                            background: 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background-color var(--transition-fast)',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--neutral-50)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                        >
                          <span style={{ fontSize: 10, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', flexShrink: 0, width: 32, textAlign: 'left' }}>
                            {row.exceedDate ?? '--/--'}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <CategoryIcon iconKey={row.iconKey} size={18} label={row.name} />
                          </span>
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--neutral-800)' }}>
                            {`${row.name} — ${formatCurrencyFloored(row.spent)}`}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-error)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {`+${drift.toFixed(0)}%`}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>
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
        aspectRatio: '1',
        border: '1px solid rgba(255, 203, 150, 0.45)',
        background: 'radial-gradient(120% 88% at 18% -8%, rgba(255,234,184,0.58) 0%, rgba(255,234,184,0) 58%), radial-gradient(98% 82% at 100% 100%, rgba(255,154,90,0.44) 0%, rgba(255,154,90,0) 62%), linear-gradient(145deg, #4A1A07 0%, #A84512 47%, #F08A2B 100%)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        cursor: 'pointer',
        overflow: 'hidden',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
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
      {/* Titre */}
      <p
        style={{
          margin: 0,
          padding: '10px 12px 0',
          fontSize: 10,
          fontWeight: 800,
          color: 'rgba(255,241,220,0.94)',
          textTransform: 'uppercase',
          letterSpacing: '0.09em',
          textAlign: 'left',
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

      {/* Nombre en grand */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontSize: 'clamp(36px, 10vw, 52px)',
            fontWeight: 900,
            fontFamily: 'var(--font-mono)',
            lineHeight: 1,
            color: count > 0 ? '#FFF0E3' : '#E6FFE9',
          }}
        >
          {count}
        </span>
      </div>

      <p
        style={{
          margin: 0,
          padding: '0 12px 11px',
          fontSize: 13,
          fontWeight: 800,
          fontFamily: 'var(--font-mono)',
          lineHeight: 1,
          textAlign: 'center',
          color: count > 0 ? '#FFF0E3' : 'rgba(255,240,227,0.74)',
          position: 'relative',
          zIndex: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {formatCurrencyFloored(totalOverrunAmount)}
      </p>
    </button>
  )
}

// ─── Budget progress constants ────────────────────────────────────────────────
const EXPENSE_BUCKET_IDS = ['socle_fixe', 'variable_essentielle', 'provision', 'discretionnaire'] as const
type ExpenseBucketId = (typeof EXPENSE_BUCKET_IDS)[number]

const EXPENSE_BUCKET_LABELS: Record<ExpenseBucketId, string> = {
  socle_fixe: 'Fixe',
  variable_essentielle: 'Variable',
  provision: 'Provision',
  discretionnaire: 'Discrétionnaire',
}

type MonthlyBlockProgressItem = { id: string; label: string; actual: number; budget: number; pct: number }

// ─── ProgressRing ─────────────────────────────────────────────────────────────
function ProgressRing({ pct, size = 80 }: { pct: number; size?: number }) {
  const TRACK_COLOR = '#AABCCD'
  const ARC_COLOR = '#F5A623'
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
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={TRACK_COLOR} strokeWidth={sw} />
      {progress > 0 ? (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={ARC_COLOR}
          strokeWidth={sw}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      ) : null}
      <circle cx={startDotX} cy={startDotY} r={dotR} fill="white" stroke={TRACK_COLOR} strokeWidth={sw * 0.35} />
      {progress > 0.03 ? (
        <circle cx={endDotX} cy={endDotY} r={dotR} fill="white" stroke={ARC_COLOR} strokeWidth={sw * 0.35} />
      ) : null}
    </svg>
  )
}

// ─── ProgressCircleTile ───────────────────────────────────────────────────────
function ProgressCircleTile({ pct, onClick }: { pct: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${Math.round(pct)}% du budget mensuel consommé — voir la progression par bloc`}
      style={{
        width: '100%',
        aspectRatio: '1',
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
        <ProgressRing pct={pct} size={86} />
        <span style={{ position: 'absolute', fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1, pointerEvents: 'none' }}>
          {`${Math.round(pct)}%`}
        </span>
      </div>
    </button>
  )
}

// ─── BudgetProgressModal ─────────────────────────────────────────────────────
function BudgetProgressModal({
  open,
  onClose,
  monthlyBlockProgress,
}: {
  open: boolean
  onClose: () => void
  monthlyBlockProgress: MonthlyBlockProgressItem[]
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
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,13,31,0.52)' }}
          />
          <div style={{ position: 'fixed', inset: 0, zIndex: 201, display: 'grid', placeItems: 'center', padding: 'var(--space-4)', pointerEvents: 'none' }}>
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              style={{ width: 'min(400px, 100%)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)', pointerEvents: 'auto' }}
            >
              <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--neutral-150)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--neutral-900)' }}>
                  Progression dépenses du mois
                </p>
                <button type="button" onClick={onClose} aria-label="Fermer" style={{ border: 'none', background: 'var(--neutral-100)', color: 'var(--neutral-600)', minWidth: 34, minHeight: 34, borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ padding: 'var(--space-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                {monthlyBlockProgress.map((block) => {
                  const pctCapped = Math.min(100, block.pct)
                  const isOver = block.pct > 100
                  const barColor = isOver ? 'var(--color-error)' : block.pct >= 85 ? 'var(--color-warning)' : 'var(--primary-500)'
                  return (
                    <div key={block.id} style={{ border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)', background: 'var(--neutral-50)' }}>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        {block.label}
                      </p>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--neutral-200)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pctCapped}%`, background: barColor, borderRadius: 2, transition: 'width 700ms cubic-bezier(0.22, 1, 0.36, 1)' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: barColor, whiteSpace: 'nowrap' }}>
                          {`${block.pct.toFixed(0)}%`}
                        </span>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--neutral-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {`${formatCurrencyFloored(block.actual)} / ${formatCurrencyFloored(block.budget)}`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function SavingsTile({
  status,
  onClick,
}: {
  status: SavingsTileStatus
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
        aspectRatio: '1',
        border: '1px solid rgba(124, 211, 224, 0.4)',
        background: 'radial-gradient(120% 90% at 14% -8%, rgba(148,231,244,0.5) 0%, rgba(148,231,244,0) 58%), radial-gradient(98% 82% at 100% 100%, rgba(70,170,188,0.42) 0%, rgba(70,170,188,0) 62%), linear-gradient(144deg, #0B3F4A 0%, #0F5461 46%, #166C7A 100%)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        cursor: 'pointer',
        overflow: 'hidden',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
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
      <p
        style={{
          margin: 0,
          padding: '10px 12px 0',
          fontSize: 10,
          fontWeight: 800,
          color: 'rgba(232,250,255,0.9)',
          textTransform: 'uppercase',
          letterSpacing: '0.09em',
          textAlign: 'left',
          position: 'relative',
          zIndex: 1,
        }}
      >
        Épargne
      </p>

      <div
        style={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {status === 'validated' ? (
          <Check size={62} color="var(--color-success)" strokeWidth={3} />
        ) : null}
        {status === 'pending' ? (
          <Minus size={66} color="rgba(232,250,255,0.72)" strokeWidth={2.6} />
        ) : null}
        {status === 'alert' ? (
          <TriangleAlert size={58} color="#FFD08C" strokeWidth={2.4} />
        ) : null}
      </div>
    </button>
  )
}

function OptimizationGauge({ tone }: { tone: OptimizationGaugeTone }) {
  const angle = tone === 'success' ? -42 : tone === 'warning' ? 0 : 42
  const needleColor = tone === 'success' ? '#4ADE80' : tone === 'warning' ? '#FACC15' : '#F87171'

  return (
    <svg width="66" height="40" viewBox="0 0 66 40" aria-hidden="true" style={{ display: 'block' }}>
      <path d="M7 32 A26 26 0 0 1 23 9" fill="none" stroke="#5CCF42" strokeWidth="8" strokeLinecap="round" />
      <path d="M25 8 A26 26 0 0 1 41 8" fill="none" stroke="#F0D84A" strokeWidth="8" strokeLinecap="round" />
      <path d="M43 9 A26 26 0 0 1 59 32" fill="none" stroke="#FF3636" strokeWidth="8" strokeLinecap="round" />
      <g transform={`rotate(${angle} 33 32)`}>
        <line x1="33" y1="32" x2="33" y2="16" stroke={needleColor} strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <circle cx="33" cy="32" r="3.4" fill="#0f172a" />
      <circle cx="33" cy="32" r="1.5" fill="#fff" opacity="0.78" />
    </svg>
  )
}

function OptimizationsTile({
  rows,
  onClick,
}: {
  rows: OptimizationTileRow[]
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Voir le détail des optimisations"
      style={{
        width: '100%',
        minHeight: 148,
        border: '1px solid rgba(135, 236, 224, 0.42)',
        background: 'radial-gradient(120% 90% at 18% -10%, rgba(151,255,236,0.58) 0%, rgba(151,255,236,0) 58%), radial-gradient(105% 85% at 100% 100%, rgba(90,242,226,0.46) 0%, rgba(90,242,226,0) 62%), linear-gradient(142deg, #0A5B63 0%, #0F7B83 46%, #13A0A8 100%)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        cursor: 'pointer',
        overflow: 'hidden',
        padding: 'var(--space-3)',
        display: 'grid',
        gap: 'var(--space-2)',
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
      <p
        style={{
          margin: 0,
          fontSize: 10,
          fontWeight: 800,
          color: 'rgba(235,255,251,0.94)',
          textTransform: 'uppercase',
          letterSpacing: '0.09em',
          textAlign: 'left',
        }}
      >
        Optimisations
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-2)' }}>
        {rows.map((row) => (
          <div key={row.label} style={{ minWidth: 0, display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 4 }}>
            <CategoryIcon iconKey={row.iconKey} label={row.label} size={20} />
            <p style={{ margin: 0, fontSize: 9, color: 'rgba(235,255,251,0.9)', lineHeight: 1.1 }}>
              {row.label}
            </p>
            <OptimizationGauge tone={row.gaugeTone} />
            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'rgba(235,255,251,0.88)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
              {`${formatCurrencyFloored(row.spentAmount)} / ${formatCurrencyFloored(row.budgetAmount)}`}
            </p>
          </div>
        ))}
      </div>
    </button>
  )
}

// ─── InfosTile ────────────────────────────────────────────────────────────────
// Module libre : notes ponctuelles + rappels automatiques.
// showSnapshotReminder = true les 2 derniers jours du mois courant ;
// disparaît automatiquement au 1er du mois suivant.
function InfosTile({ showSnapshotReminder }: { showSnapshotReminder: boolean }) {
  const hasContent = showSnapshotReminder

  return (
    <div
      role="region"
      aria-label="Informations et rappels"
      style={{
        background: 'var(--neutral-0)',
        border: '1px solid var(--neutral-150)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        padding: 'var(--space-3) var(--space-4)',
        minHeight: 72,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
    >
      {/* En-tête */}
      <p
        style={{
          margin: 0,
          fontSize: 10,
          fontWeight: 800,
          color: 'var(--neutral-500)',
          textTransform: 'uppercase',
          letterSpacing: '0.09em',
        }}
      >
        Infos
      </p>

      {/* Placeholder si aucun contenu */}
      {!hasContent ? (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: 'var(--neutral-300)',
            fontStyle: 'italic',
            lineHeight: 1.4,
          }}
        >
          Aucune info pour le moment.
        </p>
      ) : null}

      {/* Rappel automatique snapshot — visible J-1 et J (dernier jour du mois) */}
      <AnimatePresence>
        {showSnapshotReminder ? (
          <motion.div
            key="snapshot-reminder"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div
              style={{
                background: 'color-mix(in oklab, var(--primary-500) 9%, var(--neutral-0) 91%)',
                border: '1px solid color-mix(in oklab, var(--primary-500) 22%, var(--neutral-0) 78%)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-2) var(--space-3)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <Bell
                size={14}
                color="var(--primary-600)"
                strokeWidth={2.2}
                style={{ flexShrink: 0 }}
                aria-hidden="true"
              />
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: 'var(--primary-700)',
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                Fin de mois — Pense à mettre à jour les snapshots épargne
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export function Home() {
  const { year, month } = getCurrentPeriod()
  const now = new Date()
  const { data: accounts } = useAccounts()
  const { data: summaries, isLoading: loadingSummaries } = useBudgetSummaries(year, month)
  const { data: dailyPayload } = useHomeDailyBudgetPayload(year, month)

  const totalBudget = summaries?.reduce((s, b) => s + b.budget_amount, 0) ?? 0

  const todayDate = now.toISOString().slice(0, 10)
  const monthStart = new Date(year, month - 1, 1).toISOString().slice(0, 10)
  const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10)
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysElapsed = now.getDate()
  const daysRemaining = getDaysRemainingInMonth()
  // Rappel snapshot : visible les 2 derniers jours du mois, disparaît le 1er du mois suivant
  const showSnapshotReminder = daysElapsed >= daysInMonth - 1

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
    const rows = summaries ?? []
    const txns = monthExpenseTxns ?? []
    return rows
      .filter((r) => r.budget_amount > 0)
      .map((r) => {
        const budget = Number(r.budget_amount)
        const spent = Number(r.spent_amount)
        const driftPct = (spent / budget) * 100 - 100
        const overrunAmount = Math.max(0, spent - budget)
        let exceedDateStr = null
        if (driftPct >= 0) {
          const categoryTxns = txns
            .filter(t => t.category_id === r.category.id && t.transaction_date <= todayDate)
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
          overrunAmount,
          exceedDate: exceedDateStr,
        }
      })
      .filter((r) => r.driftPct > 0)
      .sort((a, b) => b.driftPct - a.driftPct)
      .slice(0, 6)
  }, [summaries, monthExpenseTxns, todayDate])

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
  const [showDriftsModal, setShowDriftsModal] = useState(false)
  const [showResteUtileModal, setShowResteUtileModal] = useState(false)
  const [showHeroBalanceModal, setShowHeroBalanceModal] = useState(false)
  const [showSavingsModal, setShowSavingsModal] = useState(false)
  const [showOptimizationsModal, setShowOptimizationsModal] = useState(false)
  const [showProgressModal, setShowProgressModal] = useState(false)

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
    if (!showAccountsModal && !showDriftCategoryModal && !showDriftsModal && !showResteUtileModal && !showHeroBalanceModal && !showSavingsModal && !showOptimizationsModal && !showProgressModal) return
    return lockDocumentScroll()
  }, [showAccountsModal, showDriftCategoryModal, showDriftsModal, showResteUtileModal, showHeroBalanceModal, showSavingsModal, showOptimizationsModal, showProgressModal])

  useEffect(() => {
    if (!showResteUtileModal && !showDriftsModal && !showHeroBalanceModal && !showSavingsModal && !showOptimizationsModal && !showProgressModal) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowResteUtileModal(false)
        setShowDriftsModal(false)
        setShowHeroBalanceModal(false)
        setShowSavingsModal(false)
        setShowOptimizationsModal(false)
        setShowProgressModal(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showResteUtileModal, showDriftsModal, showHeroBalanceModal, showSavingsModal, showOptimizationsModal, showProgressModal])

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
  const resteUtileDisplay = dailyPayload?.daily_pilotage.remaining_useful_amount ?? resteUtile
  const budgetPerDayDisplay = dailyPayload?.daily_pilotage.budget_per_remaining_day ?? budgetParJour
  const revenueAmountDisplay = Number(dailyPayload?.realized.revenue_amount ?? 0)
  const expenseMonthAmountDisplay = useMemo(
    () => (monthExpenseTxns ?? []).reduce((sum, txn) => sum + Number(txn.amount), 0),
    [monthExpenseTxns],
  )
  const overallConsumedPct = useMemo(() => {
    if (!dailyPayload) return 0
    const buckets = dailyPayload.by_bucket.filter((b) => (EXPENSE_BUCKET_IDS as readonly string[]).includes(b.budget_bucket))
    const totalBudget = buckets.reduce((s, b) => s + Number(b.budget_amount), 0)
    const totalActual = buckets.reduce((s, b) => s + Number(b.actual_amount), 0)
    return totalBudget > 0 ? Math.min(100, (totalActual / totalBudget) * 100) : 0
  }, [dailyPayload])

  const monthlyBlockProgress = useMemo<MonthlyBlockProgressItem[]>(() => {
    // Map category_id → budget_bucket using dailyPayload.by_category
    const catToBucket = new Map<string, string>()
    for (const c of dailyPayload?.by_category ?? []) {
      if (c.category_id && c.budget_bucket) catToBucket.set(c.category_id, c.budget_bucket)
    }
    // Sum monthly expense amounts by bucket
    const bucketActuals: Record<string, number> = {}
    for (const txn of monthExpenseTxns ?? []) {
      if (!txn.category_id) continue
      if (txn.transaction_date > todayDate) continue
      const bucket = catToBucket.get(txn.category_id)
      if (!bucket) continue
      bucketActuals[bucket] = (bucketActuals[bucket] ?? 0) + Number(txn.amount)
    }
    return EXPENSE_BUCKET_IDS.map((id) => {
      const monthlyBudget = Number(
        dailyPayload?.by_bucket.find((b) => b.budget_bucket === id)?.budget_amount ?? 0,
      )
      const actual = bucketActuals[id] ?? 0
      const pct = monthlyBudget > 0 ? (actual / monthlyBudget) * 100 : 0
      return { id, label: EXPENSE_BUCKET_LABELS[id], actual, budget: monthlyBudget, pct }
    })
  }, [monthExpenseTxns, dailyPayload, todayDate])
  const savingsProgressPct = useMemo(() => {
    if (MOCK_SAVINGS_MONTHLY_GOAL <= 0) return 0
    return Math.max(0, Math.min(100, (MOCK_SAVINGS_MONTHLY_SAVED / MOCK_SAVINGS_MONTHLY_GOAL) * 100))
  }, [])
  const savingsGoalReached = savingsProgressPct >= 100
  const savingsTileStatus: SavingsTileStatus = useMemo(() => {
    if (savingsGoalReached) return 'validated'
    if (daysRemaining <= 10) return 'alert'
    return 'pending'
  }, [daysRemaining, savingsGoalReached])
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
  const optimizationTileRows = useMemo<OptimizationTileRow[]>(() => {
    const summaryRows = summaries ?? []
    return OPTIMIZATION_PRIORITIES_MOCK.map((row) => {
      const matchingRows = summaryRows.filter((summaryRow) => {
        const categoryName = normalizeLabel(summaryRow.category.name ?? '')
        return row.categoryNameMatchers.some((matcher) => categoryName.includes(normalizeLabel(matcher)))
      })
      const spentAmount = matchingRows.reduce((sum, summaryRow) => sum + Number(summaryRow.spent_amount ?? 0), 0)
      const budgetAmount = matchingRows.reduce((sum, summaryRow) => sum + Number(summaryRow.budget_amount ?? 0), 0)
      const monthlyTargetAmount = Math.max(0, row.expectedAnnualAmount / 12)
      const gaugeTone: OptimizationGaugeTone = spentAmount < monthlyTargetAmount
        ? 'success'
        : spentAmount <= budgetAmount
          ? 'warning'
          : 'danger'

      return {
        ...row,
        spentAmount,
        budgetAmount,
        monthlyTargetAmount,
        gaugeTone,
      }
    })
  }, [summaries])

  const top5ExpenseRows = useMemo(() => {
    const rows = monthExpenseTxns ?? []
    const categoryNameById = new Map<string, string>()
    ;(summaries ?? []).forEach((summary) => {
      categoryNameById.set(summary.category.id, summary.category.name)
    })
    const spentByCategory = new Map<string, { id: string; name: string; spent: number }>()
    rows.forEach((txn) => {
      if (txn.transaction_date > todayDate || !txn.category_id) return
      const current = spentByCategory.get(txn.category_id)
      spentByCategory.set(txn.category_id, {
        id: txn.category_id,
        name: current?.name ?? categoryNameById.get(txn.category_id) ?? 'Catégorie',
        spent: (current?.spent ?? 0) + Number(txn.amount),
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
  }, [monthExpenseTxns, summaries, todayDate])

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
    const rows = monthExpenseTxns ?? []
    return rows.filter((t) => t.category_id === selectedDriftCategoryId)
  }, [selectedDriftCategoryId, monthExpenseTxns])

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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', alignItems: 'start' }}>
                  <button
                    type="button"
                    onClick={() => setShowHeroBalanceModal(true)}
                    aria-label="Voir le détail revenus du mois et dépenses du mois"
                    style={{
                      border: 'none',
                      background: 'linear-gradient(140deg, #1A1730 0%, #2D2B6B 45%, #3D3AB8 100%)',
                      borderRadius: 'var(--radius-xl)',
                      boxShadow: 'var(--shadow-card)',
                      padding: 'var(--space-3) var(--space-4)',
                      minHeight: 92,
                      display: 'grid',
                      alignContent: 'start',
                      gap: 6,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <p style={{
                      margin: 0,
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.56)',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}>
                      {`solde au ${todayDayMonthLabel}`}
                    </p>
                    <p style={{
                      margin: 0,
                      fontSize: 'clamp(24px, 7vw, 34px)',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color: '#FFFFFF',
                      lineHeight: 1.05,
                      letterSpacing: '-0.02em',
                      whiteSpace: 'nowrap',
                    }}>
                      {formatCurrencyFloored(selectedAccount?.current_balance ?? 0)}
                    </p>
                  </button>
                  <ProgressCircleTile
                    pct={overallConsumedPct}
                    onClick={() => setShowProgressModal(true)}
                  />
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
        <>
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
                display: 'grid',
                gridTemplateColumns: isMainCheckingAccount ? '1fr' : '1fr 1fr',
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
                    <p
                      style={{
                        margin: 0,
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'rgba(255,244,221,0.92)',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Reste utile
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 'clamp(20px, 5.4vw, 28px)',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        color: '#FFD550',
                        lineHeight: 1.05,
                        letterSpacing: '-0.02em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatCurrencyFloored(resteUtileDisplay)}
                    </p>
                  </div>

                  <div style={{ minWidth: 0, display: 'grid', gap: 2, justifyItems: 'end', textAlign: 'right' }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'rgba(255,244,221,0.92)',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Budget/jour
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 'clamp(20px, 5.2vw, 26px)',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        color: '#FFF8EC',
                        lineHeight: 1.05,
                        letterSpacing: '-0.02em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatCurrencyFloored(budgetPerDayDisplay)}
                    </p>
                  </div>
                </div>
              </button>
              {!isMainCheckingAccount ? (
                <ProgressCircleTile
                  pct={overallConsumedPct}
                  onClick={() => setShowProgressModal(true)}
                />
              ) : null}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.16 }}
            style={{ padding: '0 var(--space-6)' }}
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
              <SavingsTile status={savingsTileStatus} onClick={() => setShowSavingsModal(true)} />
              {/* Tuile Dérives — droite */}
              <DriftsTile
                count={driftRows.length}
                totalOverrunAmount={driftOverrunTotal}
                onClick={() => setShowDriftsModal(true)}
              />
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            style={{ padding: '0 var(--space-6)' }}
          >
            <div
              style={{
                maxWidth: 600,
                margin: '0 auto',
                display: 'grid',
                gridTemplateColumns: '1fr',
              }}
            >
              <OptimizationsTile rows={optimizationTileRows} onClick={() => setShowOptimizationsModal(true)} />
            </div>
          </motion.section>

          {/* ── Tuile Trajectoire ── */}
          {isMainCheckingAccount ? (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.24 }}
              style={{ padding: '0 var(--space-6)' }}
            >
              <div style={{ maxWidth: 600, margin: '0 auto' }}>
                <Suspense fallback={<div style={{ height: 220 }} />}>
                  <TrajectoireChart />
                </Suspense>
              </div>
            </motion.section>
          ) : null}

          {/* ── Module libre Infos ── */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.28 }}
            style={{
              padding: '0 var(--space-6)',
              paddingBottom: 'calc(var(--space-6) + env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <InfosTile showSnapshotReminder={showSnapshotReminder} />
            </div>
          </motion.section>
        </>
      ) : null}

      <AnimatePresence>
        {showOptimizationsModal ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOptimizationsModal(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 67, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Détails des optimisations"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
              style={{
                position: 'fixed',
                left: 'var(--space-4)',
                right: 'var(--space-4)',
                top: '13%',
                zIndex: 68,
                maxWidth: 480,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                border: '1px solid var(--neutral-300)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-lg)',
                padding: 'var(--space-4)',
                display: 'grid',
                gap: 'var(--space-3)',
                maxHeight: '78dvh',
                overflowY: 'auto',
              }}
            >
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: 'var(--neutral-900)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Détails des optimisations
              </p>

              {OPTIMIZATION_PRIORITIES_MOCK.map((row) => (
                <article key={`optim-${row.label}`} style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <CategoryIcon iconKey={row.iconKey} label={row.label} size={24} />
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-900)', fontWeight: 700 }}>
                      {row.label}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                      <span style={{ fontSize: 11, color: 'var(--neutral-600)' }}>Optimisation YTD</span>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: row.optimizationYtdAmount != null ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 800 }}>
                        {row.optimizationYtdAmount != null ? `+${formatCurrencyFloored(row.optimizationYtdAmount)}` : '✕'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                      <span style={{ fontSize: 11, color: 'var(--neutral-600)' }}>Montant précis attendu (année)</span>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', fontWeight: 700 }}>
                        {formatCurrencyFloored(row.expectedAnnualAmount)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                      <span style={{ fontSize: 11, color: 'var(--neutral-600)' }}>Montant N-1</span>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', fontWeight: 700 }}>
                        {formatCurrencyFloored(row.previousYearAmount)}
                      </span>
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-700)', lineHeight: 1.35 }}>
                    <span style={{ fontWeight: 700, color: 'var(--neutral-900)' }}>Méthode:</span>{' '}
                    {row.determinationMethod}
                  </p>
                </article>
              ))}
            </motion.div>
          </>
        ) : null}

      </AnimatePresence>

      <AnimatePresence>
        {showSavingsModal ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSavingsModal(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 68, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Détails de l'épargne"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
              style={{
                position: 'fixed',
                left: 'var(--space-4)',
                right: 'var(--space-4)',
                top: '20%',
                zIndex: 69,
                maxWidth: 420,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                border: '1px solid var(--neutral-300)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-lg)',
                padding: 'var(--space-4)',
                display: 'grid',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'grid', gap: 6 }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Objectif mensuel d'épargne
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>
                  {formatCurrencyFloored(MOCK_SAVINGS_MONTHLY_GOAL)}
                </p>
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Taux de progression actuel
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>
                  {`${savingsProgressPct.toFixed(0)}%`}
                </p>
              </div>

              <div style={{ height: 1, background: 'var(--neutral-200)' }} />

              <div style={{ display: 'grid', gap: 6 }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Épargné 2026 YTD
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>
                  {formatCurrencyFloored(MOCK_SAVINGS_2026_YTD)}
                </p>
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Objectif annuel global
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>
                  {formatCurrencyFloored(MOCK_SAVINGS_2026_ANNUAL_GOAL)}
                </p>
              </div>
            </motion.div>
          </>
        ) : null}

      </AnimatePresence>

      <AnimatePresence>
        {showHeroBalanceModal ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHeroBalanceModal(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 69, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Détail revenus du mois et dépenses du mois"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
              style={{
                position: 'fixed',
                left: 'var(--space-4)',
                right: 'var(--space-4)',
                top: '22%',
                zIndex: 70,
                maxWidth: 420,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                border: '1px solid var(--neutral-300)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-lg)',
                padding: 'var(--space-4)',
                display: 'grid',
                gap: 'var(--space-2)',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div style={{ display: 'grid', gap: 4, justifyItems: 'start' }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Revenus du mois
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrencyFloored(revenueAmountDisplay)}
                  </p>
                </div>
                <div style={{ display: 'grid', gap: 4, justifyItems: 'end', textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Dépenses du mois
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrencyFloored(expenseMonthAmountDisplay)}
                  </p>
                </div>
              </div>
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
                padding: 'calc(64px + var(--safe-top) + var(--space-4)) var(--space-4) var(--space-3)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div style={{ width: 28, height: 3, borderRadius: 'var(--radius-full)', background: 'var(--neutral-300)', margin: '0 auto var(--space-2)' }} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
                {accountEntries.filter((entry) => VISIBLE_ACCOUNT_PRESET_IDS.has(entry.preset.id)).map((entry) => {
                  const isActive = entry.preset.id === selectedAccountEntry?.preset.id
                  return (
                    <button
                      key={entry.preset.id}
                      type="button"
                      onClick={() => handleSelectAccountPreset(entry.preset.id)}
                      style={{
                        border: `1.5px solid ${isActive ? 'var(--primary-300)' : 'var(--neutral-150)'}`,
                        background: isActive ? 'color-mix(in oklab, var(--primary-500) 8%, var(--neutral-0) 92%)' : 'var(--neutral-50)',
                        borderRadius: 'var(--radius-md)',
                        padding: '6px var(--space-2)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 150ms ease, border-color 150ms ease',
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-semibold)', color: isActive ? 'var(--primary-600)' : 'var(--neutral-700)', whiteSpace: 'nowrap' }}>
                        {entry.preset.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <BudgetProgressModal
        open={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        monthlyBlockProgress={monthlyBlockProgress}
      />

      <DriftsModal
        open={showDriftsModal}
        onClose={() => setShowDriftsModal(false)}
        driftRows={driftRows}
        top5ExpenseRows={top5ExpenseRows}
        loadingSummaries={loadingSummaries}
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
        loading={loadingSummaries}
      />
    </div>
  )
}
