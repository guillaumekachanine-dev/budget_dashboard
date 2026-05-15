import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BarChart2, CalendarDays, Compass, PiggyBank, Shield, Target, ArrowDownToLine, X } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, Line, ReferenceLine, Legend } from 'recharts'
import { lockDocumentScroll } from '@/lib/scrollLock'
import { useInvestmentPerformance } from '@/features/stats/hooks/useInvestmentPerformance'
import epargneInteretsIcon from '@/assets/icons/categories/epargne_interets.webp'
import epargnePlacementIcon from '@/assets/icons/categories/epargne_placement.webp'
import epargneVirementIcon from '@/assets/icons/categories/epargne_virement.webp'
import type {
  SavingsEvolutionFiveYearsRow,
  SavingsEvolutionFiveYearsSeries,
  SavingsEvolutionOperationEvent,
  SavingsEvolutionYearAccountMetrics,
} from '@/features/savings/types'

type StyledSeries = SavingsEvolutionFiveYearsSeries & {
  shortLabel: string
  iconSrc: string
  listLabel: string
}

type Props = {
  account: StyledSeries
  operationEvents: SavingsEvolutionOperationEvent[]
  yearlyMetrics: Record<string, SavingsEvolutionYearAccountMetrics>
  rows: SavingsEvolutionFiveYearsRow[]
  currentAmount: number
  onClose: () => void
}

// Livret A / LDDS historical annual rates
const LIVRET_RATES: Record<number, number> = {
  2020: 0.5,
  2021: 0.5,
  2022: 1.5,
  2023: 3.0,
  2024: 2.7,
  2025: 2.4,
  2026: 2.4,
}
const LIVRET_CURRENT_RATE = 2.40

function normalizeStr(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isLivret(label: string): boolean {
  const n = normalizeStr(label)
  return n.includes('livret') || n.includes('ldds') || n.includes('lep')
}

type RiskLevel = { label: string; color: string }
type TrendSignal = { label: string; color: string }

function resolveRisk(label: string): RiskLevel {
  const n = normalizeStr(label)
  if (n.includes('livret') || n.includes('ldds') || n.includes('lep')) return { label: 'Nul', color: '#2ED47A' }
  if (n.includes('per') || n.includes('plan epargne retraite')) return { label: 'Faible', color: '#3B82F6' }
  if (n.includes('peg') || n.includes('capgemini')) return { label: 'Modéré', color: '#FFAB2E' }
  if (n.includes('pea')) return { label: 'Modéré', color: '#FFAB2E' }
  if (n.includes('bitcoin') || n.includes('btc') || n.includes('crypto')) return { label: 'Élevé', color: '#FC5A5A' }
  return { label: 'Modéré', color: '#FFAB2E' }
}

function resolveTrend(label: string): TrendSignal {
  const n = normalizeStr(label)
  if (n.includes('livret a')) return { label: 'Maintenir', color: '#2ED47A' }
  if (n.includes('ldds')) return { label: 'Maintenir', color: '#2ED47A' }
  if (n.includes('lep')) return { label: 'Maintenir', color: '#2ED47A' }
  if (n.includes('pea')) return { label: 'Continuer', color: '#2ED47A' }
  if (n.includes('per') || n.includes('plan epargne retraite')) return { label: 'Continuer', color: '#2ED47A' }
  if (n.includes('peg') || n.includes('capgemini')) return { label: 'Surveiller', color: '#FFAB2E' }
  if (n.includes('bitcoin') || n.includes('btc') || n.includes('crypto')) return { label: 'Réduire', color: '#FC5A5A' }
  return { label: 'Continuer', color: '#2ED47A' }
}

function resolveObjectif2026(label: string): string {
  const n = normalizeStr(label)
  if (n.includes('livret a')) return 'Conserver le plafond'
  if (n.includes('ldds')) return 'Atteindre 12 000 €'
  if (n.includes('lep')) return 'Atteindre 10 000 €'
  if (n.includes('pea')) return '3 600 € · 300 €/mois'
  if (n.includes('per') || n.includes('plan epargne retraite')) return '4 000 € · TMI 30 %'
  if (n.includes('peg') || n.includes('capgemini')) return 'Max abondement · 1 200 €'
  if (n.includes('bitcoin') || n.includes('btc') || n.includes('crypto')) return 'HODL — pas de renforcement'
  return '—'
}

function resolveAdvice(label: string, family: string, recommendedAction: string | null): string {
  const n = normalizeStr(label)

  if (n.includes('livret a')) {
    return "Votre Livret A est un pilier solide de votre épargne liquide. Maintenez-y l'équivalent de 3 à 6 mois de dépenses essentielles. Au-delà du plafond de 22 950 €, redirigez l'excédent vers un PEA ou une assurance-vie pour optimiser le rendement sur le long terme."
  }
  if (n.includes('ldds')) {
    return "Votre LDDS finance des projets à impact environnemental et social, avec les mêmes avantages fiscaux que le Livret A. Excellent complément si votre Livret A est déjà plafonné. Profitez de la liquidité totale pour l'épargne de précaution."
  }
  if (n.includes('lep')) {
    return "Le LEP offre le meilleur taux de l'épargne réglementée française. À prioriser absolument tant que vous êtes éligible. Maximisez le plafond de 10 000 € avant d'alimenter les autres livrets."
  }
  if (recommendedAction) return recommendedAction
  if (n.includes('pea')) {
    return "Le PEA est l'enveloppe fiscale la plus efficace pour investir en actions européennes. Après 5 ans, les gains sont exonérés d'impôt sur le revenu. Alimentez régulièrement pour bénéficier du DCA et de la capitalisation à long terme."
  }
  if (n.includes('per') || n.includes('plan epargne retraite')) {
    return "Le PER offre une déduction fiscale à l'entrée, idéale si vous êtes dans une tranche marginale d'imposition élevée. Attention à l'horizon long terme — les fonds sont bloqués jusqu'à la retraite, sauf cas de déblocage anticipé."
  }
  if (n.includes('peg') || n.includes('capgemini')) {
    return "L'épargne salariale bénéficie d'avantages fiscaux et potentiellement d'un abondement employeur. Si un abondement est disponible, l'alimenter en priorité représente un rendement garanti immédiat. Vérifiez vos fenêtres de déblocage."
  }
  if (n.includes('bitcoin') || n.includes('btc') || n.includes('crypto')) {
    return "Les cryptoactifs présentent une volatilité très élevée. Limitez l'exposition à 5-10% du patrimoine global. Sécurisez vos clés privées et respectez vos obligations déclaratives fiscales (formulaire 3916-bis annuel)."
  }
  return `Diversifiez votre épargne ${family === 'livrets' ? 'liquide' : 'financière'} entre sécurité, rendement et croissance. Rééquilibrez régulièrement selon votre tolérance au risque et vos objectifs de moyen terme.`
}

function resolveGrade(qualityStatus: string | null, family: string): {
  grade: string
  label: string
  color: string
} {
  if (family === 'livrets') return { grade: 'A+', label: 'Excellent', color: '#2ED47A' }

  const n = (qualityStatus ?? '').toLowerCase()
  if (n === 'excellent') return { grade: 'A+', label: 'Excellent', color: '#2ED47A' }
  if (n === 'good') return { grade: 'B', label: 'Bon', color: '#5B57F5' }
  if (n === 'watch') return { grade: 'C', label: 'À surveiller', color: '#FFAB2E' }
  if (n === 'optimize') return { grade: 'D', label: 'À optimiser', color: '#FC5A5A' }
  return { grade: '—', label: 'Non évalué', color: 'var(--neutral-400)' }
}

const EUR = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
function fmtEur(v: number): string {
  return EUR.format(v)
}

function fmtSignedCompact(v: number): string {
  const abs = EUR.format(Math.abs(v)).replace(/\s*€/u, '€')
  if (v > 0) return `+${abs}`
  if (v < 0) return `-${abs}`
  return abs
}

function fmtSignedPercentCompact(value: number, digits = 1): string {
  const abs = Math.abs(value).toFixed(digits)
  if (value > 0) return `+${abs}%`
  if (value < 0) return `-${abs}%`
  return `${abs}%`
}

function fmtDate(s: string): string {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

function fmtMonthYear(value: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { month: '2-digit', year: '2-digit' }).format(value)
}

export function SavingsPortfolioModal({
  account,
  operationEvents,
  yearlyMetrics,
  rows,
  currentAmount,
  onClose,
}: Props) {
  const { data: perfData } = useInvestmentPerformance(2026)

  useEffect(() => lockDocumentScroll(), [])

  const accountEvents = useMemo(
    () =>
      operationEvents
        .filter((e) => e.account_key === account.key)
        .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()),
    [operationEvents, account.key],
  )

  const totalInterests = useMemo(
    () => accountEvents.filter((e) => e.nature === 'intérêts').reduce((sum, e) => sum + e.amount, 0),
    [accountEvents],
  )

  const accountIsLivret = isLivret(account.label)

  const investAccount = useMemo(() => {
    if (!perfData || accountIsLivret) return null
    const labelParts = normalizeStr(account.label).split(' ')
    return (
      perfData.accounts.find((a) => {
        const n = normalizeStr(a.account_name ?? '')
        return labelParts.some((part) => part.length > 2 && n.includes(part))
      }) ?? null
    )
  }, [perfData, account.label, accountIsLivret])

  const grade = resolveGrade(investAccount?.quality_status ?? null, account.family)
  const advice = resolveAdvice(account.label, account.family, investAccount?.recommended_action ?? null)

  const totalGain: number | null = accountIsLivret
    ? totalInterests
    : (investAccount?.estimated_gain_vs_total_cash_in ?? null)

  const avgRate = useMemo(() => {
    if (!accountIsLivret) return null
    const years = accountEvents.map((e) => Number(e.year)).filter(Number.isFinite)
    if (years.length === 0) return LIVRET_CURRENT_RATE
    const min = Math.min(...years)
    const max = Math.max(...years)
    let total = 0
    let count = 0
    for (let y = min; y <= max; y++) {
      total += LIVRET_RATES[y] ?? LIVRET_CURRENT_RATE
      count++
    }
    return count > 0 ? total / count : LIVRET_CURRENT_RATE
  }, [accountIsLivret, accountEvents])

  const accountEventsAsc = useMemo(
    () => [...accountEvents].sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()),
    [accountEvents],
  )

  const openedAt = useMemo(() => {
    const firstEventDate = accountEventsAsc[0]?.transaction_date
    if (firstEventDate) {
      const parsed = new Date(firstEventDate)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }

    const firstFundedYear = [...rows]
      .sort((a, b) => Number(a.year) - Number(b.year))
      .find((row) => Number(row[account.key] ?? 0) > 0)?.year

    if (firstFundedYear && /^\d{4}$/.test(firstFundedYear)) {
      return new Date(Number(firstFundedYear), 0, 1)
    }

    return null
  }, [accountEventsAsc, rows, account.key])

  const activeMonths = useMemo(() => {
    if (!openedAt) return null
    const now = new Date()
    return (now.getFullYear() - openedAt.getFullYear()) * 12 + (now.getMonth() - openedAt.getMonth())
  }, [openedAt])

  const lastDeposit = useMemo(() => {
    return [...accountEventsAsc]
      .reverse()
      .find((e) => e.amount > 0 && e.nature !== 'intérêts') ?? null
  }, [accountEventsAsc])

  const amount2026 = useMemo(() => {
    const total = accountEvents
      .filter((e) => e.year === '2026' && e.amount > 0 && e.nature !== 'intérêts')
      .reduce((sum, e) => sum + e.amount, 0)
    return total > 0 ? total : null
  }, [accountEvents])

  const risk = resolveRisk(account.label)
  const trend = resolveTrend(account.label)
  const objectif2026 = resolveObjectif2026(account.label)

  const [showIndexModal, setShowIndexModal] = useState(false)
  const [showOperationsModal, setShowOperationsModal] = useState(false)

  const totalCashIn = useMemo(
    () => accountEvents
      .filter((e) => e.amount > 0 && e.nature !== 'intérêts')
      .reduce((sum, e) => sum + e.amount, 0),
    [accountEvents],
  )
  const kpiYtdGainAmount = useMemo(
    () => (totalCashIn > 0 ? currentAmount - totalCashIn : null),
    [currentAmount, totalCashIn],
  )
  const previewAccountEvents = useMemo(() => accountEvents.slice(0, 3), [accountEvents])

  const currentYear = new Date().getFullYear()
  const previousYear = currentYear - 1

  const kpiPreviousYearAmount = useMemo(() => {
    if (accountIsLivret) {
      return accountEvents
        .filter((event) => event.nature === 'intérêts' && Number(event.year) === previousYear)
        .reduce((sum, event) => sum + Number(event.amount ?? 0), 0)
    }

    const prevYearRow = rows.find((row) => Number(row.year) === previousYear)
    const prevPrevYearRow = rows.find((row) => Number(row.year) === previousYear - 1)
    if (!prevYearRow || !prevPrevYearRow) return null

    const prevYearBalance = Number(prevYearRow[account.key] ?? 0)
    const prevPrevYearBalance = Number(prevPrevYearRow[account.key] ?? 0)
    if (!Number.isFinite(prevYearBalance) || !Number.isFinite(prevPrevYearBalance)) return null

    const savedPrevYear = yearlyMetrics[`${account.key}::${previousYear}`]?.total_saved_amount ?? 0
    return prevYearBalance - prevPrevYearBalance - savedPrevYear
  }, [accountIsLivret, accountEvents, previousYear, rows, account.key, yearlyMetrics])

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 70,
          background: 'rgba(13,13,31,0.52)',
          backdropFilter: 'blur(2px)',
        }}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Détails ${account.listLabel}`}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 71,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: 'var(--space-3)',
          overflowY: 'auto',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 'min(640px, 100%)',
            background: 'var(--neutral-0)',
            borderRadius: 'var(--radius-2xl)',
            boxShadow: '0 24px 60px rgba(13,13,31,0.24)',
            margin: 'var(--space-4) 0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'visible',
            pointerEvents: 'auto',
          }}
        >

        {/* Header */}
        <div
          style={{
            padding: 'var(--space-4)',
            borderBottom: '1px solid var(--neutral-100)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              background: 'color-mix(in oklab, var(--primary-600) 5%, var(--neutral-0) 95%)',
              border: '1px solid color-mix(in oklab, var(--primary-600) 12%, var(--neutral-0) 88%)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-3)',
            }}
          >
            {/* Top row: logo + info left + amount right */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    border: `2.5px solid ${account.color}`,
                    flexShrink: 0,
                    overflow: 'hidden',
                    background: 'var(--neutral-100)',
                  }}
                >
                  <img
                    src={account.iconSrc}
                    alt=""
                    aria-hidden="true"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 'var(--font-size-md)',
                      fontWeight: 'var(--font-weight-extrabold)',
                      color: 'var(--neutral-900)',
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {account.listLabel}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', fontWeight: 500 }}>
                    {account.family === 'livrets' ? 'Livret réglementé' : 'Placement financier'}
                  </p>
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 'var(--font-weight-extrabold)',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-positive)',
                    lineHeight: 1.1,
                  }}
                >
                  {fmtEur(currentAmount)}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Quick indicators grid */}
        <div style={{ padding: '8px var(--space-4)', borderBottom: '1px solid var(--neutral-100)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
            <IndicatorCell
              icon={<CalendarDays size={14} strokeWidth={2} />}
              value={openedAt
                ? `${fmtMonthYear(openedAt)}${activeMonths != null ? ` (${activeMonths} mois)` : ''}`
                : '—'}
            />
            <IndicatorCell
              icon={<ArrowDownToLine size={14} strokeWidth={2} />}
              value={lastDeposit
                ? `${fmtDate(lastDeposit.transaction_date)} · ${fmtEur(lastDeposit.amount)}`
                : '—'}
            />
            <IndicatorCell
              icon={<PiggyBank size={14} strokeWidth={2} />}
              value={amount2026 != null ? fmtEur(amount2026) : '—'}
            />
            <IndicatorCell
              icon={<Target size={14} strokeWidth={2} />}
              value={objectif2026}
            />
            <IndicatorCell
              icon={<Shield size={14} strokeWidth={2} />}
              value={risk.label}
              valueColor={risk.color}
            />
            <IndicatorCell
              icon={<Compass size={14} strokeWidth={2} />}
              value={trend.label}
              valueColor={trend.color}
            />
          </div>
        </div>

        {/* Middle section: operations list */}
        <div
          style={{
            overflow: 'visible',
            padding: 'var(--space-4)',
          }}
        >
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SectionHeading label="Opérations" color={account.color} />
                <button
                  type="button"
                  onClick={() => setShowOperationsModal(true)}
                  title="Voir la liste complète des opérations"
                  style={{
                    border: '1px solid var(--neutral-200)',
                    background: 'var(--neutral-0)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px 5px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    color: 'var(--primary)',
                    fontSize: 9,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  Liste ({accountEvents.length})
                </button>
              </div>
            </div>

            {accountEvents.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--neutral-400)',
                  textAlign: 'center',
                  padding: 'var(--space-5) 0',
                }}
              >
                Aucune opération enregistrée
              </p>
            ) : (
              <div style={{ marginTop: 'var(--space-3)' }}>
                {/* Table header */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 116px 132px',
                    columnGap: '14px',
                    padding: '0 6px 4px',
                    borderBottom: '1px solid var(--neutral-100)',
                    lineHeight: 1,
                  }}
                >
                  {(['Date', 'Nature', 'Montant'] as const)
                    .filter(Boolean)
                    .map((label) => (
                      <span
                        key={label}
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: 'var(--neutral-400)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                          textAlign: label === 'Montant' ? 'left' : 'left',
                          paddingLeft: label === 'Nature' ? 2 : 0,
                        }}
                      >
                        {label}
                      </span>
                    ))}
                </div>

                {previewAccountEvents.map((event, idx) => {
                  const isInterest = event.nature === 'intérêts'
                  const isPlacementAccount = account.family === 'placements'
                  const natureLabel = isInterest ? 'Intérêts' : (isPlacementAccount ? 'Placement' : 'Virement')
                  const natureIconSrc = isInterest
                    ? epargneInteretsIcon
                    : (isPlacementAccount ? epargnePlacementIcon : epargneVirementIcon)
                  const amountSign = event.amount > 0 ? '+' : event.amount < 0 ? '-' : ''
                  const amountAbs = fmtEur(Math.abs(event.amount))

                  return (
                    <div
                      key={event.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 116px 132px',
                        columnGap: '14px',
                        padding: '7px 6px',
                        borderBottom: idx < previewAccountEvents.length - 1 ? '1px solid var(--neutral-50)' : 'none',
                        alignItems: 'center',
                        lineHeight: 1,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: 'var(--neutral-700)',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 500,
                          lineHeight: 1,
                        }}
                      >
                        {fmtDate(event.transaction_date)}
                      </span>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: 'var(--neutral-900)',
                          whiteSpace: 'nowrap',
                          lineHeight: 1,
                          justifySelf: 'start',
                          display: 'inline-grid',
                          gridTemplateColumns: '12px auto',
                          alignItems: 'center',
                          columnGap: 6,
                        }}
                      >
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={natureIconSrc}
                            alt=""
                            aria-hidden="true"
                            style={{
                              width: 10,
                              height: 10,
                              objectFit: 'contain',
                              display: 'block',
                            }}
                          />
                        </span>
                        {natureLabel}
                      </span>

                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          textAlign: 'left',
                          color: 'var(--neutral-900)',
                          whiteSpace: 'nowrap',
                          lineHeight: 1,
                          width: '100%',
                          display: 'inline-grid',
                          gridTemplateColumns: '9px auto',
                          columnGap: 4,
                          justifyContent: 'start',
                          alignItems: 'center',
                          justifySelf: 'start',
                        }}
                      >
                        <span
                          style={{
                            color:
                              amountSign === '+'
                                ? 'var(--color-positive)'
                                : amountSign === '-'
                                  ? 'var(--color-negative)'
                                  : 'transparent',
                            textAlign: 'center',
                          }}
                        >
                          {amountSign || '+'}
                        </span>
                        <span style={{ color: 'var(--neutral-900)' }}>{amountAbs}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* Bottom section: analysis and advice */}
        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid var(--neutral-100)',
            background: 'var(--neutral-50)',
            padding: 'var(--space-4)',
          }}
        >
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SectionHeading label="Performance" color={account.color} />
                <button
                  type="button"
                  onClick={() => setShowIndexModal(true)}
                  title="Voir l'évolution des indices"
                  style={{
                    border: '1px solid var(--neutral-200)',
                    background: 'var(--neutral-0)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px 5px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    color: 'var(--primary)',
                    fontSize: 9,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  <BarChart2 size={10} strokeWidth={2} />
                  Indices
                </button>
              </div>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 'var(--radius-sm)',
                  background: `color-mix(in oklab, ${grade.color} 12%, var(--neutral-0) 88%)`,
                  border: `2px solid ${grade.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginRight: 12,
                }}
                aria-label={`Note ${grade.grade}`}
                title={`Note ${grade.grade} · ${grade.label}`}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: grade.color,
                    lineHeight: 1,
                  }}
                >
                  {grade.grade}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-2)', display: 'grid', gap: 'var(--space-3)' }}>
              {/* KPI list */}
              <div
                style={{
                  display: 'grid',
                  gap: '6px',
                  paddingLeft: '18px',
                }}
              >
                <KpiBulletRow
                  label="Variation depuis ouverture"
                  value={
                    accountIsLivret
                      ? (avgRate != null ? `~${avgRate.toFixed(2)}%` : '—')
                      : (investAccount?.estimated_gain_vs_total_cash_in_pct != null
                          ? fmtSignedPercentCompact(investAccount.estimated_gain_vs_total_cash_in_pct, 1)
                          : '—')
                  }
                />
                <KpiBulletRow
                  label="Variation N-1 glissante"
                  value={kpiPreviousYearAmount != null ? fmtSignedCompact(kpiPreviousYearAmount) : '—'}
                />
                <KpiBulletRow
                  label="Plus-values YTD"
                  value={kpiYtdGainAmount != null ? fmtSignedCompact(kpiYtdGainAmount) : '—'}
                  positive={kpiYtdGainAmount != null ? kpiYtdGainAmount >= 0 : undefined}
                />
                <KpiBulletRow
                  label="Rendement depuis ouverture"
                  value={totalGain != null && totalGain !== 0
                    ? `${fmtSignedCompact(totalGain)}${
                        !accountIsLivret && investAccount?.estimated_gain_vs_total_cash_in_pct != null
                          ? ` (${fmtSignedPercentCompact(investAccount.estimated_gain_vs_total_cash_in_pct, 1)})`
                          : ''
                      }`
                    : '—'}
                />
              </div>

              <div
                aria-hidden="true"
                style={{
                  height: 1,
                  background: 'var(--neutral-100)',
                  width: '100%',
                }}
              />

              <SectionHeading label="Conseil" color={account.color} />

              {/* Expert advice */}
              <div
                style={{
                  background: 'linear-gradient(145deg, color-mix(in oklab, var(--primary-600) 84%, #1a1f4a 16%), color-mix(in oklab, var(--primary-600) 68%, #2a3672 32%))',
                  border: '1px solid color-mix(in oklab, var(--primary-600) 42%, #324090 58%)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-4)',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--font-size-sm)',
                    color: 'rgba(255,255,255,0.9)',
                    lineHeight: 1.6,
                  }}
                >
                  {advice}
                </p>
              </div>
            </div>
          </section>
        </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showOperationsModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOperationsModal(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 72,
                background: 'rgba(13,13,31,0.48)',
              }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`Liste complète des opérations ${account.listLabel}`}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 73,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-3)',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: 'min(560px, 100%)',
                  maxHeight: 'min(72dvh, calc(100dvh - 2 * var(--space-3)))',
                  overflow: 'hidden',
                  pointerEvents: 'auto',
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--neutral-150)',
                boxShadow: '0 20px 52px rgba(13,13,31,0.26)',
                display: 'grid',
                gridTemplateRows: 'auto 1fr',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--neutral-100)' }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                  Liste complète des opérations ({accountEvents.length})
                </p>
                <button
                  type="button"
                  onClick={() => setShowOperationsModal(false)}
                  aria-label="Fermer la liste des opérations"
                  style={{
                    border: '1px solid var(--neutral-200)',
                    background: 'var(--neutral-0)',
                    borderRadius: 'var(--radius-sm)',
                    width: 28,
                    height: 28,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--neutral-600)',
                    flexShrink: 0,
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              <div style={{ overflowY: 'auto', padding: 'var(--space-3) var(--space-4)' }}>
                {accountEvents.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-400)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
                    Aucune opération enregistrée
                  </p>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 116px 132px',
                        columnGap: '14px',
                        padding: '0 6px 4px',
                        borderBottom: '1px solid var(--neutral-100)',
                        lineHeight: 1,
                      }}
                    >
                      {(['Date', 'Nature', 'Montant'] as const).map((label) => (
                        <span
                          key={label}
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: 'var(--neutral-400)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.07em',
                            textAlign: 'left',
                            paddingLeft: label === 'Nature' ? 2 : 0,
                          }}
                        >
                          {label}
                        </span>
                      ))}
                    </div>

                    {accountEvents.map((event, idx) => {
                      const isInterest = event.nature === 'intérêts'
                      const isPlacementAccount = account.family === 'placements'
                      const natureLabel = isInterest ? 'Intérêts' : (isPlacementAccount ? 'Placement' : 'Virement')
                      const natureIconSrc = isInterest
                        ? epargneInteretsIcon
                        : (isPlacementAccount ? epargnePlacementIcon : epargneVirementIcon)
                      const amountSign = event.amount > 0 ? '+' : event.amount < 0 ? '-' : ''
                      const amountAbs = fmtEur(Math.abs(event.amount))

                      return (
                        <div
                          key={`all-${event.id}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 116px 132px',
                            columnGap: '14px',
                            padding: '7px 6px',
                            borderBottom: idx < accountEvents.length - 1 ? '1px solid var(--neutral-50)' : 'none',
                            alignItems: 'center',
                            lineHeight: 1,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              color: 'var(--neutral-700)',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 500,
                              lineHeight: 1,
                            }}
                          >
                            {fmtDate(event.transaction_date)}
                          </span>

                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: 'var(--neutral-900)',
                              whiteSpace: 'nowrap',
                              lineHeight: 1,
                              justifySelf: 'start',
                              display: 'inline-grid',
                              gridTemplateColumns: '12px auto',
                              alignItems: 'center',
                              columnGap: 6,
                            }}
                          >
                            <span
                              style={{
                                width: 12,
                                height: 12,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <img
                                src={natureIconSrc}
                                alt=""
                                aria-hidden="true"
                                style={{
                                  width: 10,
                                  height: 10,
                                  objectFit: 'contain',
                                  display: 'block',
                                }}
                              />
                            </span>
                            {natureLabel}
                          </span>

                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              textAlign: 'left',
                              color: 'var(--neutral-900)',
                              whiteSpace: 'nowrap',
                              lineHeight: 1,
                              width: '100%',
                              display: 'inline-grid',
                              gridTemplateColumns: '9px auto',
                              columnGap: 4,
                              justifyContent: 'start',
                              alignItems: 'center',
                              justifySelf: 'start',
                            }}
                          >
                            <span
                              style={{
                                color:
                                  amountSign === '+'
                                    ? 'var(--color-positive)'
                                    : amountSign === '-'
                                      ? 'var(--color-negative)'
                                      : 'transparent',
                                textAlign: 'center',
                              }}
                            >
                              {amountSign || '+'}
                            </span>
                            <span style={{ color: 'var(--neutral-900)' }}>{amountAbs}</span>
                          </span>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
              </div>
            </motion.div>
          </>
        )}

        {showIndexModal && (
          <IndexEvolutionModal
            accountLabel={account.listLabel}
            accountColor={account.color}
            onClose={() => setShowIndexModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function SectionHeading({ label, count, color }: { label: string; count?: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <span
        aria-hidden="true"
        style={{
          width: 0,
          height: 0,
          borderTop: '6px solid transparent',
          borderBottom: '6px solid transparent',
          borderLeft: `10px solid ${color}`,
          flexShrink: 0,
        }}
      />
      <h3
        style={{
          margin: 0,
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-extrabold)',
          color: 'var(--neutral-900)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
        }}
      >
        {label}
      </h3>
      {count !== undefined ? (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--neutral-500)',
            background: 'var(--neutral-100)',
            borderRadius: 'var(--radius-full)',
            padding: '1px 7px',
          }}
        >
          {count}
        </span>
      ) : null}
    </div>
  )
}

function IndicatorCell({
  icon,
  value,
  valueColor,
}: {
  icon: ReactNode
  value: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 6,
        minWidth: 0,
        minHeight: 22,
        width: '100%',
      }}
    >
      <span style={{ color: 'var(--neutral-500)', flexShrink: 0, display: 'flex' }}>{icon}</span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: valueColor ?? 'var(--neutral-900)',
          lineHeight: 1.15,
          textAlign: 'left',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          width: 'auto',
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ETF cotation data for PEA (Amundi MSCI World, Apr 2025 – Apr 2026)
const PEA_ETF_DATA = [
  { date: '2025-04-30', value: 5.12 },
  { date: '2025-05-15', value: 5.48 },
  { date: '2025-06-01', value: 5.45 },
  { date: '2025-06-15', value: 5.52 },
  { date: '2025-07-01', value: 5.60 },
  { date: '2025-07-15', value: 5.68 },
  { date: '2025-08-01', value: 5.72 },
  { date: '2025-08-15', value: 5.75 },
  { date: '2025-09-01', value: 5.80 },
  { date: '2025-09-15', value: 5.88 },
  { date: '2025-10-01', value: 6.02 },
  { date: '2025-10-15', value: 6.10 },
  { date: '2025-11-01', value: 5.98 },
  { date: '2025-11-15', value: 6.08 },
  { date: '2025-12-01', value: 6.12 },
  { date: '2025-12-15', value: 6.18 },
  { date: '2026-01-15', value: 6.25 },
  { date: '2026-02-15', value: 6.20 },
  { date: '2026-03-15', value: 5.95 },
  { date: '2026-04-29', value: 6.38 },
]

// Bitcoin/EUR — YTD 2026 (~5-day intervals, estimated from Google Finance)
const BTC_YTD_DATA = [
  { date: '2026-01-01', value: 74586.18 },
  { date: '2026-01-06', value: 79895.00 },
  { date: '2026-01-11', value: 77669.32 },
  { date: '2026-01-16', value: 82718.68 },
  { date: '2026-01-21', value: 79130.03 },
  { date: '2026-01-26', value: 75881.68 },
  { date: '2026-01-31', value: 74055.07 },
  { date: '2026-02-05', value: 64592.75 },
  { date: '2026-02-10', value: 58840.66 },
  { date: '2026-02-15', value: 56774.38 },
  { date: '2026-02-20', value: 58272.32 },
  { date: '2026-02-25', value: 57403.81 },
  { date: '2026-03-02', value: 55800.57 },
  { date: '2026-03-07', value: 57203.11 },
  { date: '2026-03-12', value: 60150.12 },
  { date: '2026-03-17', value: 60321.15 },
  { date: '2026-03-22', value: 63166.94 },
  { date: '2026-03-27', value: 61061.69 },
  { date: '2026-04-01', value: 61098.33 },
  { date: '2026-04-06', value: 58411.35 },
  { date: '2026-04-11', value: 57826.72 },
  { date: '2026-04-16', value: 59790.04 },
  { date: '2026-04-21', value: 61395.01 },
  { date: '2026-04-26', value: 62893.53 },
  { date: '2026-05-01', value: 66869.03 },
  { date: '2026-05-06', value: 69105.76 },
  { date: '2026-05-11', value: 68714.84 },
  { date: '2026-05-15', value: 68038.30 },
]

// Bitcoin/EUR — 5 ans (~15-day intervals, estimated)
const BTC_5Y_DATA = [
  { date: '2021-05-15', value: 38469.01 },
  { date: '2021-05-30', value: 28943.83 },
  { date: '2021-06-14', value: 28622.98 },
  { date: '2021-06-29', value: 29945.80 },
  { date: '2021-07-14', value: 34789.88 },
  { date: '2021-07-29', value: 40687.46 },
  { date: '2021-08-13', value: 39987.12 },
  { date: '2021-08-28', value: 39188.13 },
  { date: '2021-09-12', value: 43027.95 },
  { date: '2021-09-27', value: 52243.47 },
  { date: '2021-10-12', value: 54298.26 },
  { date: '2021-10-27', value: 54556.43 },
  { date: '2021-11-11', value: 55351.17 },
  { date: '2021-11-26', value: 47157.95 },
  { date: '2021-12-11', value: 45220.65 },
  { date: '2021-12-26', value: 43009.11 },
  { date: '2022-01-10', value: 41479.36 },
  { date: '2022-01-25', value: 36066.63 },
  { date: '2022-02-09', value: 35210.22 },
  { date: '2022-02-24', value: 38292.43 },
  { date: '2022-03-11', value: 40001.58 },
  { date: '2022-03-26', value: 39017.98 },
  { date: '2022-04-10', value: 39044.30 },
  { date: '2022-04-25', value: 37150.90 },
  { date: '2022-05-10', value: 30588.60 },
  { date: '2022-05-25', value: 27715.89 },
  { date: '2022-06-09', value: 21956.24 },
  { date: '2022-06-24', value: 21021.47 },
  { date: '2022-07-09', value: 22035.10 },
  { date: '2022-07-24', value: 23119.28 },
  { date: '2022-08-08', value: 22761.72 },
  { date: '2022-08-23', value: 21791.94 },
  { date: '2022-09-07', value: 21320.57 },
  { date: '2022-09-22', value: 20228.57 },
  { date: '2022-10-07', value: 19819.17 },
  { date: '2022-10-22', value: 19183.28 },
  { date: '2022-11-06', value: 17701.92 },
  { date: '2022-11-21', value: 16579.85 },
  { date: '2022-12-06', value: 16633.69 },
  { date: '2022-12-21', value: 16599.85 },
  { date: '2023-01-05', value: 16173.28 },
  { date: '2023-01-20', value: 16718.76 },
  { date: '2023-02-04', value: 19034.35 },
  { date: '2023-02-19', value: 21162.47 },
  { date: '2023-03-06', value: 22156.23 },
  { date: '2023-03-21', value: 23768.63 },
  { date: '2023-04-05', value: 25198.31 },
  { date: '2023-04-20', value: 26043.91 },
  { date: '2023-05-05', value: 26235.88 },
  { date: '2023-05-20', value: 25224.36 },
  { date: '2023-06-04', value: 25449.73 },
  { date: '2023-06-19', value: 26178.96 },
  { date: '2023-07-04', value: 26299.56 },
  { date: '2023-07-19', value: 26703.20 },
  { date: '2023-08-03', value: 27032.96 },
  { date: '2023-08-18', value: 26369.77 },
  { date: '2023-09-02', value: 25735.94 },
  { date: '2023-09-17', value: 25747.53 },
  { date: '2023-10-02', value: 25013.69 },
  { date: '2023-10-17', value: 27392.07 },
  { date: '2023-11-01', value: 32949.67 },
  { date: '2023-11-16', value: 35028.44 },
  { date: '2023-12-01', value: 36323.53 },
  { date: '2023-12-16', value: 39661.32 },
  { date: '2023-12-31', value: 40991.80 },
  { date: '2024-01-15', value: 39532.76 },
  { date: '2024-01-30', value: 39094.67 },
  { date: '2024-02-14', value: 48519.54 },
  { date: '2024-02-29', value: 59844.01 },
  { date: '2024-03-15', value: 60607.76 },
  { date: '2024-03-30', value: 62101.50 },
  { date: '2024-04-14', value: 60827.36 },
  { date: '2024-04-29', value: 59240.39 },
  { date: '2024-05-14', value: 58045.64 },
  { date: '2024-05-29', value: 58442.06 },
  { date: '2024-06-13', value: 61858.65 },
  { date: '2024-06-28', value: 64247.86 },
  { date: '2024-07-13', value: 60317.81 },
  { date: '2024-07-28', value: 54194.33 },
  { date: '2024-08-12', value: 55251.39 },
  { date: '2024-08-27', value: 57165.34 },
  { date: '2024-09-11', value: 58778.79 },
  { date: '2024-09-26', value: 57413.68 },
  { date: '2024-10-11', value: 52247.13 },
  { date: '2024-10-26', value: 54162.69 },
  { date: '2024-11-10', value: 61696.76 },
  { date: '2024-11-25', value: 70545.87 },
  { date: '2024-12-10', value: 90056.39 },
  { date: '2024-12-25', value: 93821.59 },
  { date: '2025-01-09', value: 96105.06 },
  { date: '2025-01-24', value: 96279.21 },
  { date: '2025-02-08', value: 99834.93 },
  { date: '2025-02-23', value: 95992.17 },
  { date: '2025-03-10', value: 79275.65 },
  { date: '2025-03-25', value: 77428.54 },
  { date: '2025-04-09', value: 75995.06 },
  { date: '2025-04-24', value: 77652.14 },
  { date: '2025-05-09', value: 88017.48 },
  { date: '2025-05-24', value: 91713.76 },
  { date: '2025-06-08', value: 94156.37 },
  { date: '2025-06-23', value: 94552.84 },
  { date: '2025-07-08', value: 93934.97 },
  { date: '2025-07-23', value: 93810.96 },
  { date: '2025-08-07', value: 99748.34 },
  { date: '2025-08-22', value: 102434.83 },
  { date: '2025-09-06', value: 98261.43 },
  { date: '2025-09-21', value: 96454.40 },
  { date: '2025-10-06', value: 98950.16 },
  { date: '2025-10-21', value: 96907.81 },
  { date: '2025-11-05', value: 81145.76 },
  { date: '2025-11-20', value: 76646.02 },
  { date: '2025-12-05', value: 79045.11 },
  { date: '2025-12-20', value: 78065.12 },
  { date: '2026-01-04', value: 66961.14 },
  { date: '2026-01-19', value: 61175.12 },
  { date: '2026-02-03', value: 58254.18 },
  { date: '2026-02-18', value: 58036.54 },
  { date: '2026-03-05', value: 60536.22 },
  { date: '2026-03-20', value: 61021.97 },
  { date: '2026-04-04', value: 63345.98 },
  { date: '2026-04-19', value: 64449.05 },
  { date: '2026-05-04', value: 65935.00 },
  { date: '2026-05-15', value: 68147.61 },
]

// LDDS — taux réglementés, inflation et rendement réel par période (2015–2026)
// PER BPCE — Natixis ESG Dynamic Fund (LU2169559270)
// Mouvements mensuels : valeur totale estimée, valeur UC, frais mensuels
const PER_MONTHLY_DATA: Array<{
  period: string
  valeur: number
  uc: number
  frais: number
}> = [
  { period: 'jan 25',  valeur: 6087.35, uc: 144.78, frais: 3.11 },
  { period: 'fév 25',  valeur: 6098.41, uc: 145.11, frais: 2.82 },
  { period: 'mar 25',  valeur: 5760.94, uc: 137.15, frais: 2.95 },
  { period: 'avr 25',  valeur: 5680.42, uc: 135.30, frais: 2.81 },
  { period: 'mai 25',  valeur: 5941.46, uc: 141.59, frais: 3.04 },
  { period: 'jun 25',  valeur: 5907.91, uc: 140.86, frais: 2.92 },
  { period: 'jul 25',  valeur: 5993.34, uc: 142.97, frais: 3.07 },
  { period: 'aoû 25',  valeur: 5962.62, uc: 142.31, frais: 3.05 },
  { period: 'sep 25',  valeur: 6030.87, uc: 144.01, frais: 2.98 },
  { period: 'oct 25',  valeur: 6183.07, uc: 147.72, frais: 3.16 },
  { period: 'nov 25',  valeur: 6128.98, uc: 146.50, frais: 3.03 },
  { period: 'déc 25',  valeur: 6137.55, uc: 146.78, frais: 3.14 },
  { period: 'jan 26',  valeur: 6141.10, uc: 146.94, frais: 3.14 },
  { period: 'fév 26',  valeur: 6231.84, uc: 149.18, frais: 2.88 },
  { period: 'mar 26',  valeur: 5825.75, uc: 139.53, frais: 2.98 },
  { period: 'mai 26',  valeur: 6117.29, uc: 146.59, frais: 3.23 },
]

// PER synthèse par exercice — rendement, frais totaux, performance
const PER_SYNTHESE_DATA: Array<{
  period: string
  opening: number
  closing: number
  rendement: number
  rendementPct: number
  fraisTotaux: number
}> = [
  { period: '2025',      opening: 5872.56, closing: 6137.55, rendement:  264.99, rendementPct:  4.51, fraisTotaux: 36.08 },
  { period: '2026 YTD',  opening: 6137.55, closing: 6117.29, rendement:  -20.26, rendementPct: -0.33, fraisTotaux: 12.23 },
]

// Livret A — taux réglementés par période depuis 2015 (source Banque de France)
const LIVRET_A_RATE_DATA: Array<{ period: string; taux: number; plafond: number }> = [
  { period: 'fév 2015', taux: 1.00, plafond: 22950 },
  { period: 'août 15',  taux: 0.75, plafond: 22950 },
  { period: 'fév 2016', taux: 0.75, plafond: 22950 },
  { period: 'fév 2022', taux: 1.00, plafond: 22950 },
  { period: 'août 22',  taux: 2.00, plafond: 22950 },
  { period: 'fév 2023', taux: 3.00, plafond: 22950 },
  { period: 'août 23',  taux: 3.00, plafond: 22950 },
  { period: 'fév 2024', taux: 3.00, plafond: 22950 },
  { period: 'fév 2025', taux: 2.40, plafond: 22950 },
  { period: 'août 25',  taux: 1.70, plafond: 22950 },
  { period: 'fév 2026', taux: 1.50, plafond: 22950 },
]

// LDDS — taux réglementés, inflation et rendement réel par période (2015–2026)
const LDDS_RATE_DATA: Array<{ period: string; ldds: number; inflation: number; reel: number }> = [
  { period: 'jan 2015', ldds: 1.0,  inflation: 0.0, reel:  1.0  },
  { period: 'août 15',  ldds: 0.75, inflation: 0.0, reel:  0.75 },
  { period: '2016',     ldds: 0.75, inflation: 0.2, reel:  0.55 },
  { period: '2017',     ldds: 0.75, inflation: 1.0, reel: -0.25 },
  { period: '2018',     ldds: 0.75, inflation: 1.9, reel: -1.15 },
  { period: '2019',     ldds: 0.75, inflation: 1.1, reel: -0.35 },
  { period: 'jan 2020', ldds: 0.75, inflation: 0.5, reel:  0.25 },
  { period: 'fév 2020', ldds: 0.5,  inflation: 0.5, reel:  0.0  },
  { period: '2021',     ldds: 0.5,  inflation: 1.6, reel: -1.1  },
  { period: 'jan 22',   ldds: 0.5,  inflation: 5.2, reel: -4.7  },
  { period: 'fév 22',   ldds: 1.0,  inflation: 5.2, reel: -4.2  },
  { period: 'août 22',  ldds: 2.0,  inflation: 5.2, reel: -3.2  },
  { period: 'jan 23',   ldds: 2.0,  inflation: 4.9, reel: -2.9  },
  { period: 'fév 23',   ldds: 3.0,  inflation: 4.9, reel: -1.9  },
  { period: '2024',     ldds: 3.0,  inflation: 2.0, reel:  1.0  },
  { period: 'jan 25',   ldds: 3.0,  inflation: 0.9, reel:  2.1  },
  { period: 'fév 25',   ldds: 2.4,  inflation: 0.9, reel:  1.5  },
  { period: 'août 25',  ldds: 1.7,  inflation: 0.9, reel:  0.8  },
  { period: 'fév 26',   ldds: 1.5,  inflation: 0.8, reel:  0.7  },
]

type RateHistoryEntry = { period: string; ldds: number; inflation: number; reel: number }
type LivretHistoryEntry = { period: string; taux: number; plafond: number }
type PerMonthlyEntry = { period: string; valeur: number; uc: number; frais: number }
type PerSyntheseEntry = { period: string; opening: number; closing: number; rendement: number; rendementPct: number; fraisTotaux: number }

type IndexDataset = {
  default: Array<{ date: string; value: number }>
  fiveYears?: Array<{ date: string; value: number }>
  rateHistory?: RateHistoryEntry[]        // LDDS — taux + inflation + rendement réel
  livretHistory?: LivretHistoryEntry[]    // Livret A — taux par période réglementaire
  perHistory?: PerMonthlyEntry[]          // PER — valorisation mensuelle + frais + UC
  perSynthese?: PerSyntheseEntry[]        // PER — synthèse par exercice
  unit: string
  label: string
  sourceNote: string
}

const FR_MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc']

function fmtEtfDate(iso: string): string {
  const d = new Date(iso)
  return `${FR_MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

function resolveIndexData(label: string): IndexDataset | null {
  const n = normalizeStr(label)
  if (n.includes('pea')) {
    return {
      default: PEA_ETF_DATA,
      unit: '€',
      label: 'ETF Amundi MSCI World',
      sourceNote: 'ETF Amundi MSCI World — données semi-mensuelles',
    }
  }
  if (n.includes('bitcoin') || n.includes('btc') || n.includes('crypto')) {
    return {
      default: BTC_YTD_DATA,
      fiveYears: BTC_5Y_DATA,
      unit: '€',
      label: 'Bitcoin / EUR',
      sourceNote: 'Bitcoin/EUR — données estimées depuis Google Finance',
    }
  }
  if (n.includes('per') || n.includes('plan epargne retraite')) {
    return {
      default: [],
      perHistory: PER_MONTHLY_DATA,
      perSynthese: PER_SYNTHESE_DATA,
      unit: '€',
      label: 'PER — Natixis ESG Dynamic Fund',
      sourceNote: 'BPCE/Natixis ESG Dynamic Fund LU2169559270 — relevés 2025–2026',
    }
  }
  // Livret A — must be checked before generic 'livret'
  if (n.includes('livret a')) {
    return {
      default: [],
      livretHistory: LIVRET_A_RATE_DATA,
      unit: '%',
      label: 'Taux Livret A · Historique réglementaire',
      sourceNote: 'Taux réglementés Banque de France · Plafond légal 22 950 € — depuis 2015',
    }
  }
  if (n.includes('ldds') || n.includes('lep') || n.includes('livret')) {
    return {
      default: [],
      rateHistory: LDDS_RATE_DATA,
      unit: '%',
      label: 'Taux LDDS · Inflation · Rendement réel',
      sourceNote: 'Taux réglementés Banque de France · Inflation INSEE — depuis 2015',
    }
  }
  return null
}

function IndexEvolutionModal({
  accountLabel,
  accountColor,
  onClose,
}: {
  accountLabel: string
  accountColor: string
  onClose: () => void
}) {
  const dataset = resolveIndexData(accountLabel)
  const hasFiveYears = Boolean(dataset?.fiveYears)
  const isRateChart = Boolean(dataset?.rateHistory)
  const isLivretChart = Boolean(dataset?.livretHistory)
  const isPerChart = Boolean(dataset?.perHistory)
  const [period, setPeriod] = useState<'ytd' | '5y'>('ytd')

  const data = useMemo(() => {
    if (!dataset || isRateChart || isLivretChart || isPerChart) return null
    if (period === '5y' && dataset.fiveYears) return dataset.fiveYears
    return dataset.default
  }, [dataset, period, isRateChart, isLivretChart, isPerChart])

  const first = data?.[0]
  const last = data?.[data.length - 1]
  const pct = first && last ? ((last.value - first.value) / first.value) * 100 : null

  const minVal = data ? Math.min(...data.map((d) => d.value)) : 0
  const maxVal = data ? Math.max(...data.map((d) => d.value)) : 0
  const padding = (maxVal - minVal) * 0.06
  const yMin = minVal - padding
  const yMax = maxVal + padding

  // Tick interval: fewer ticks for 5Y (more data points)
  const tickInterval = period === '5y' ? 11 : 4

  // Formatter: for large values (BTC) use "k" suffix
  const isLargeValue = maxVal > 1000
  const fmtAxisVal = (v: number) =>
    isLargeValue ? `${(v / 1000).toFixed(0)}k` : v.toFixed(1)
  const fmtTooltipVal = (v: number) =>
    isLargeValue
      ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v) + ' €'
      : `${v.toFixed(2)} €`

  // Rate chart KPIs (LDDS)
  const rateData = dataset?.rateHistory ?? null
  const latestRate = rateData?.[rateData.length - 1]
  const maxLddsRate = rateData ? Math.max(...rateData.map((r) => r.ldds)) : 0
  const avgReel = rateData
    ? rateData.reduce((s, r) => s + r.reel, 0) / rateData.length
    : 0

  // Livret A KPIs
  const livretData = dataset?.livretHistory ?? null
  const latestLivret = livretData?.[livretData.length - 1]
  const maxLivretTaux = livretData ? Math.max(...livretData.map((r) => r.taux)) : 0
  const PLAFOND_LIVRET_A = 22950

  // PER KPIs
  const perData = dataset?.perHistory ?? null
  const perSynthese = dataset?.perSynthese ?? null
  const latestPer = perData?.[perData.length - 1]
  const firstPer = perData?.[0]
  const perUcMin = perData ? Math.min(...perData.map((r) => r.uc)) : 0
  const perUcMax = perData ? Math.max(...perData.map((r) => r.uc)) : 0
  const perValMin = perData ? Math.min(...perData.map((r) => r.valeur)) : 0
  const perValMax = perData ? Math.max(...perData.map((r) => r.valeur)) : 0
  const perFraisTotaux = perData ? perData.reduce((s, r) => s + r.frais, 0) : 0
  const perRendementTotal = perSynthese
    ? perSynthese.reduce((s, r) => s + r.rendement, 0)
    : null
  const perRendementPctTotal = firstPer && latestPer
    ? ((latestPer.valeur - (perSynthese?.[0]?.opening ?? firstPer.valeur)) / (perSynthese?.[0]?.opening ?? firstPer.valeur)) * 100
    : null

  const gradientId = 'index-area-gradient'
  const gradientPerValeurId = 'per-valeur-gradient'

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(13,13,31,0.6)', backdropFilter: 'blur(3px)' }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'fixed', inset: 0, zIndex: 81, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', pointerEvents: 'none' }}
      >
        <div style={{ width: 'min(560px, 100%)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', boxShadow: '0 24px 60px rgba(13,13,31,0.28)', pointerEvents: 'auto', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--neutral-100)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: accountColor, flexShrink: 0 }} />
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--neutral-900)' }}>
                Évolution des indices · {accountLabel}
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Period toggle — only shown when 5Y data exists */}
              {hasFiveYears && (
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--neutral-100)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 2,
                    gap: 2,
                  }}
                >
                  {(['ytd', '5y'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      style={{
                        border: 'none',
                        borderRadius: 'calc(var(--radius-sm) - 2px)',
                        padding: '3px 10px',
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        cursor: 'pointer',
                        letterSpacing: '0.04em',
                        transition: 'background 0.15s, color 0.15s',
                        background: period === p ? 'var(--neutral-0)' : 'transparent',
                        color: period === p ? accountColor : 'var(--neutral-400)',
                        boxShadow: period === p ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                      }}
                    >
                      {p === 'ytd' ? 'YTD' : '5 ans'}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: 'var(--neutral-400)', display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── PER multi-series chart ── */}
          {isPerChart && perData ? (
            <>
              {/* KPI strip — 4 métriques */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderBottom: '1px solid var(--neutral-100)', background: 'var(--neutral-50)' }}>
                {[
                  {
                    label: 'Valeur actuelle',
                    value: latestPer ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(latestPer.valeur) : '—',
                    color: accountColor,
                  },
                  {
                    label: 'Valeur UC actuelle',
                    value: latestPer ? `${latestPer.uc.toFixed(2)} €` : '—',
                    color: 'var(--neutral-700)',
                    sub: perUcMin !== perUcMax ? `min ${perUcMin.toFixed(0)} · max ${perUcMax.toFixed(0)}` : undefined,
                  },
                  {
                    label: 'Frais cumulés',
                    value: `${perFraisTotaux.toFixed(2)} €`,
                    color: '#FC5A5A',
                    sub: '(période affichée)',
                  },
                  {
                    label: 'Rendement total',
                    value: perRendementTotal != null
                      ? `${perRendementTotal >= 0 ? '+' : ''}${perRendementTotal.toFixed(2)} €`
                      : '—',
                    color: (perRendementTotal ?? 0) >= 0 ? '#2ED47A' : '#FC5A5A',
                    sub: perRendementPctTotal != null
                      ? `${perRendementPctTotal >= 0 ? '+' : ''}${perRendementPctTotal.toFixed(2)} %`
                      : undefined,
                  },
                ].map((kpi, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 14px',
                      borderRight: i < 3 ? '1px solid var(--neutral-100)' : 'none',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 8, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {kpi.label}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)', color: kpi.color, lineHeight: 1.1 }}>
                      {kpi.value}
                    </p>
                    {kpi.sub && (
                      <p style={{ margin: '2px 0 0', fontSize: 8, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}>
                        {kpi.sub}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Synthèse par exercice */}
              {perSynthese && perSynthese.length > 0 && (
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--neutral-100)' }}>
                  {perSynthese.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        padding: '8px 14px',
                        borderRight: i < perSynthese.length - 1 ? '1px solid var(--neutral-100)' : 'none',
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                        {s.period}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.rendement >= 0 ? '#2ED47A' : '#FC5A5A' }}>
                        {s.rendement >= 0 ? '+' : ''}{s.rendement.toFixed(2)} €
                      </span>
                      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: s.rendementPct >= 0 ? '#2ED47A' : '#FC5A5A' }}>
                        ({s.rendementPct >= 0 ? '+' : ''}{s.rendementPct.toFixed(2)} %)
                      </span>
                      <span style={{ fontSize: 9, color: '#FC5A5A', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                        −{s.fraisTotaux.toFixed(2)} € frais
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Chart — ComposedChart : aire valeur + ligne UC + barres frais */}
              <div style={{ padding: '16px 8px 4px 2px' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={perData} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={gradientPerValeurId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accountColor} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={accountColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-100)" vertical={false} />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 8, fill: 'var(--neutral-400)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      interval={1}
                      angle={-30}
                      textAnchor="end"
                      height={32}
                    />
                    {/* Axe gauche : valeur totale (€) */}
                    <YAxis
                      yAxisId="val"
                      orientation="left"
                      domain={[Math.floor(perValMin * 0.96), Math.ceil(perValMax * 1.02)]}
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
                      tick={{ fontSize: 8, fill: 'var(--neutral-400)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    {/* Axe droit : valeur UC (€) */}
                    <YAxis
                      yAxisId="uc"
                      orientation="right"
                      domain={[Math.floor(perUcMin * 0.96), Math.ceil(perUcMax * 1.02)]}
                      tickFormatter={(v: number) => `${v.toFixed(0)}`}
                      tick={{ fontSize: 8, fill: 'var(--neutral-500)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const valeur = payload.find((p) => p.dataKey === 'valeur')?.value as number | undefined
                        const uc = payload.find((p) => p.dataKey === 'uc')?.value as number | undefined
                        const frais = payload.find((p) => p.dataKey === 'frais')?.value as number | undefined
                        const firstValeur = perData[0]?.valeur ?? 1
                        const delta = valeur != null ? ((valeur - firstValeur) / firstValeur) * 100 : null
                        return (
                          <div style={{ background: '#1a1f3a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.32)', minWidth: 170 }}>
                            <p style={{ margin: '0 0 6px', fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{label as string}</p>
                            {valeur != null && (
                              <p style={{ margin: '2px 0', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: accountColor }}>
                                Valeur · {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(valeur)}
                              </p>
                            )}
                            {delta != null && (
                              <p style={{ margin: '1px 0', fontSize: 9, fontFamily: 'var(--font-mono)', color: delta >= 0 ? '#2ED47A' : '#FC5A5A' }}>
                                {delta >= 0 ? '+' : ''}{delta.toFixed(2)} % vs jan 25
                              </p>
                            )}
                            {uc != null && (
                              <p style={{ margin: '2px 0', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)' }}>
                                UC · {uc.toFixed(2)} €
                              </p>
                            )}
                            {frais != null && (
                              <p style={{ margin: '4px 0 0', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#FC5A5A', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 4 }}>
                                Frais · −{frais.toFixed(2)} €
                              </p>
                            )}
                          </div>
                        )
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 9, fontWeight: 700, paddingBottom: 4 }}
                      formatter={(value: string) => {
                        const labels: Record<string, string> = { valeur: 'Valeur totale', uc: 'Valeur UC', frais: 'Frais mensuels' }
                        return labels[value] ?? value
                      }}
                    />
                    <Area
                      yAxisId="val"
                      type="monotone"
                      dataKey="valeur"
                      stroke={accountColor}
                      strokeWidth={2}
                      fill={`url(#${gradientPerValeurId})`}
                      dot={false}
                      activeDot={{ r: 4, fill: accountColor, strokeWidth: 0 }}
                    />
                    <Line
                      yAxisId="uc"
                      type="monotone"
                      dataKey="uc"
                      stroke="#FFAB2E"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      dot={false}
                      activeDot={{ r: 3, fill: '#FFAB2E', strokeWidth: 0 }}
                    />
                    <Bar
                      yAxisId="val"
                      dataKey="frais"
                      fill="#FC5A5A"
                      opacity={0.55}
                      radius={[2, 2, 0, 0]}
                      maxBarSize={10}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <p style={{ margin: '2px 20px 8px', fontSize: 9, color: 'var(--neutral-400)', textAlign: 'right', fontStyle: 'italic' }}>
                  {dataset?.sourceNote ?? ''}
                </p>
              </div>
            </>
          ) : null}

          {/* ── Livret A rate chart ── */}
          {isLivretChart && livretData ? (
            <>
              {/* KPI strip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '12px 20px', background: 'var(--neutral-50)', borderBottom: '1px solid var(--neutral-100)' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Taux actuel</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: accountColor }}>
                    {latestLivret ? `${latestLivret.taux.toFixed(2)} %` : '—'}
                  </p>
                </div>
                <div style={{ flex: 1, height: 1, background: 'var(--neutral-200)' }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Taux max. historique</p>
                  <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)' }}>
                    {`${maxLivretTaux.toFixed(2)} %`}
                  </p>
                </div>
                <div style={{ flex: 1, height: 1, background: 'var(--neutral-200)' }} />
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Plafond légal</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)' }}>
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(PLAFOND_LIVRET_A)}
                  </p>
                </div>
              </div>

              {/* Chart */}
              <div style={{ padding: '16px 8px 4px 4px' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={livretData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap="22%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-100)" vertical={false} />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 8, fill: 'var(--neutral-400)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={38}
                    />
                    <YAxis
                      tickFormatter={(v: number) => `${v.toFixed(1)} %`}
                      tick={{ fontSize: 9, fill: 'var(--neutral-400)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      width={42}
                      domain={[0, 'auto']}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const taux = payload.find((p) => p.dataKey === 'taux')?.value as number | undefined
                        return (
                          <div style={{ background: '#1a1f3a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.32)', minWidth: 160 }}>
                            <p style={{ margin: '0 0 6px', fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{label as string}</p>
                            {taux != null && (
                              <p style={{ margin: '2px 0', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: accountColor }}>
                                Taux Livret A · {taux.toFixed(2)} %
                              </p>
                            )}
                            <p style={{ margin: '4px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 4 }}>
                              Plafond légal · {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(PLAFOND_LIVRET_A)}
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Bar
                      dataKey="taux"
                      fill={accountColor}
                      opacity={0.85}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                      label={{
                        position: 'top',
                        fontSize: 8,
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        fill: accountColor,
                        formatter: (v: number) => `${v.toFixed(2)}%`,
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <p style={{ margin: '2px 20px 8px', fontSize: 9, color: 'var(--neutral-400)', textAlign: 'right', fontStyle: 'italic' }}>
                  {dataset?.sourceNote ?? ''}
                </p>
              </div>
            </>
          ) : null}

          {/* ── Rate history chart (LDDS / livrets) ── */}
          {isRateChart && rateData ? (
            <>
              {/* KPI strip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '12px 20px', background: 'var(--neutral-50)', borderBottom: '1px solid var(--neutral-100)' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Taux actuel</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: accountColor }}>
                    {latestRate ? `${latestRate.ldds.toFixed(2)} %` : '—'}
                  </p>
                </div>
                <div style={{ flex: 1, height: 1, background: 'var(--neutral-200)' }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Rendement réel moy.</p>
                  <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-mono)', color: avgReel >= 0 ? '#2ED47A' : '#FC5A5A' }}>
                    {avgReel >= 0 ? '+' : ''}{avgReel.toFixed(2)} %
                  </p>
                </div>
                <div style={{ flex: 1, height: 1, background: 'var(--neutral-200)' }} />
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Taux max. historique</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)' }}>
                    {`${maxLddsRate.toFixed(2)} %`}
                  </p>
                </div>
              </div>

              {/* Chart */}
              <div style={{ padding: '16px 8px 4px 4px' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={rateData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap="18%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-100)" vertical={false} />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 8, fill: 'var(--neutral-400)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      interval={1}
                      angle={-35}
                      textAnchor="end"
                      height={38}
                    />
                    <YAxis
                      tickFormatter={(v: number) => `${v.toFixed(1)} %`}
                      tick={{ fontSize: 9, fill: 'var(--neutral-400)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      width={42}
                    />
                    <ReferenceLine y={0} stroke="var(--neutral-300)" strokeWidth={1} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const lddsVal = payload.find((p) => p.dataKey === 'ldds')?.value as number | undefined
                        const inflVal = payload.find((p) => p.dataKey === 'inflation')?.value as number | undefined
                        const reelVal = payload.find((p) => p.dataKey === 'reel')?.value as number | undefined
                        return (
                          <div style={{ background: '#1a1f3a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.32)', minWidth: 150 }}>
                            <p style={{ margin: '0 0 6px', fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{label as string}</p>
                            {lddsVal != null && (
                              <p style={{ margin: '2px 0', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: accountColor }}>
                                Taux LDDS · {lddsVal.toFixed(2)} %
                              </p>
                            )}
                            {inflVal != null && (
                              <p style={{ margin: '2px 0', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#FC5A5A' }}>
                                Inflation · {inflVal.toFixed(1)} %
                              </p>
                            )}
                            {reelVal != null && (
                              <p style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: reelVal >= 0 ? '#2ED47A' : '#FFAB2E', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 4 }}>
                                Rendement réel · {reelVal >= 0 ? '+' : ''}{reelVal.toFixed(2)} %
                              </p>
                            )}
                          </div>
                        )
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 9, fontWeight: 700, paddingBottom: 4 }}
                      formatter={(value: string) => {
                        const labels: Record<string, string> = { ldds: 'Taux LDDS', inflation: 'Inflation', reel: 'Rendement réel' }
                        return labels[value] ?? value
                      }}
                    />
                    <Bar dataKey="ldds" fill={accountColor} opacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={14} />
                    <Bar dataKey="inflation" fill="#FC5A5A" opacity={0.6} radius={[3, 3, 0, 0]} maxBarSize={14} />
                    <Line
                      type="monotone"
                      dataKey="reel"
                      stroke="#2ED47A"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#2ED47A', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#2ED47A', strokeWidth: 0 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <p style={{ margin: '2px 20px 8px', fontSize: 9, color: 'var(--neutral-400)', textAlign: 'right', fontStyle: 'italic' }}>
                  {dataset?.sourceNote ?? ''}
                </p>
              </div>
            </>
          ) : data ? (
            <>
              {/* Performance strip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '12px 20px', background: 'var(--neutral-50)', borderBottom: '1px solid var(--neutral-100)' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {period === '5y' ? 'Départ (mai 2021)' : 'Départ (1 jan 2026)'}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)' }}>
                    {first ? fmtTooltipVal(first.value) : '—'}
                  </p>
                </div>
                <div style={{ flex: 1, height: 1, background: 'var(--neutral-200)' }} />
                {pct != null && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Performance</p>
                    <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-mono)', color: pct >= 0 ? '#2ED47A' : '#FC5A5A' }}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(1)} %
                    </p>
                  </div>
                )}
                <div style={{ flex: 1, height: 1, background: 'var(--neutral-200)' }} />
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Valeur actuelle</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: accountColor }}>
                    {last ? fmtTooltipVal(last.value) : '—'}
                  </p>
                </div>
              </div>

              {/* Chart */}
              <div style={{ padding: '20px 8px 12px 4px' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accountColor} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={accountColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-100)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtEtfDate}
                      tick={{ fontSize: 9, fill: 'var(--neutral-400)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      interval={tickInterval}
                    />
                    <YAxis
                      domain={[yMin, yMax]}
                      tickFormatter={fmtAxisVal}
                      tick={{ fontSize: 9, fill: 'var(--neutral-400)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      width={isLargeValue ? 36 : 32}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const val = payload[0]?.value as number
                        const base = first?.value ?? 1
                        const delta = ((val - base) / base) * 100
                        return (
                          <div style={{
                            background: '#1a1f3a',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 8,
                            padding: '7px 12px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.32)',
                          }}>
                            <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 4 }}>{fmtEtfDate(label as string)}</p>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff' }}>{fmtTooltipVal(val)}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: delta >= 0 ? '#2ED47A' : '#FC5A5A' }}>
                              {delta >= 0 ? '+' : ''}{delta.toFixed(1)} % vs départ
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={accountColor}
                      strokeWidth={2}
                      fill={`url(#${gradientId})`}
                      dot={false}
                      activeDot={{ r: 4, fill: accountColor, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <p style={{ margin: '4px 20px 0', fontSize: 9, color: 'var(--neutral-400)', textAlign: 'right', fontStyle: 'italic' }}>
                  {dataset?.sourceNote ?? ''}
                </p>
              </div>
            </>
          ) : (
            <div style={{ padding: 'var(--space-5) var(--space-4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 220, background: 'var(--neutral-50)' }}>
              <BarChart2 size={32} strokeWidth={1.5} color="var(--neutral-300)" />
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--neutral-400)', textAlign: 'center' }}>
                Données non disponibles<br />
                <span style={{ fontWeight: 400 }}>Aucun indice configuré pour ce compte.</span>
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}

function KpiBulletRow({
  label,
  value,
  positive,
}: {
  label: string
  value: string
  positive?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'nowrap' }}>
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: 'var(--radius-full)',
          background: 'var(--primary-600)',
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-600)', lineHeight: 1.3, whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ flex: 1 }} />
      <span
        style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-medium)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
          minWidth: 122,
          textAlign: 'right',
          marginRight: 22,
          color:
            positive === undefined
              ? 'var(--neutral-900)'
              : positive
                ? 'var(--color-positive)'
                : 'var(--color-negative)',
          flexShrink: 0,
        }}
      >
        {value}
      </span>
    </div>
  )
}
