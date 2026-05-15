import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BarChart2, CalendarDays, Compass, PiggyBank, Shield, Target, ArrowDownToLine, X } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
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

// Legal ceilings
const PLAFOND_EUR: Record<string, number> = {
  'livret a': 22950,
  'ldds': 12000,
  'lep': 10000,
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

function resolvePlafond(label: string): number | null {
  const n = normalizeStr(label)
  for (const [key, eur] of Object.entries(PLAFOND_EUR)) {
    if (n.includes(key)) return eur
  }
  return null
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

function fmtSigned(v: number): string {
  const abs = EUR.format(Math.abs(v))
  if (v > 0) return `+${abs}`
  if (v < 0) return `-${abs}`
  return abs
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

  const plafond = resolvePlafond(account.label)

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

  const totalCashIn = useMemo(
    () => accountEvents
      .filter((e) => e.amount > 0 && e.nature !== 'intérêts')
      .reduce((sum, e) => sum + e.amount, 0),
    [accountEvents],
  )

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
        <div style={{ padding: '12px var(--space-4)', borderBottom: '1px solid var(--neutral-100)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <IndicatorCell
              icon={<CalendarDays size={13} strokeWidth={2} />}
              label="Date d'ouverture"
              value={openedAt
                ? `${fmtMonthYear(openedAt)}${activeMonths != null ? ` (${activeMonths} mois)` : ''}`
                : '—'}
            />
            <IndicatorCell
              icon={<ArrowDownToLine size={13} strokeWidth={2} />}
              label="Dernier versement"
              value={lastDeposit
                ? `${fmtDate(lastDeposit.transaction_date)} · ${fmtEur(lastDeposit.amount)}`
                : '—'}
            />
            <IndicatorCell
              icon={<PiggyBank size={13} strokeWidth={2} />}
              label="Montant placé en 2026"
              value={amount2026 != null ? fmtEur(amount2026) : '—'}
            />
            <IndicatorCell
              icon={<Target size={13} strokeWidth={2} />}
              label="Objectif 2026"
              value={objectif2026}
            />
            <IndicatorCell
              icon={<Shield size={13} strokeWidth={2} />}
              label="Risque"
              value={risk.label}
              valueColor={risk.color}
            />
            <IndicatorCell
              icon={<Compass size={13} strokeWidth={2} />}
              label="Tendance"
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
            <SectionHeading label="Opérations" count={accountEvents.length} color={account.color} />

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
                      key={event.id}
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
              <SectionHeading label="Performance" color={account.color} />
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

            <div style={{ marginTop: 'var(--space-3)', display: 'grid', gap: 'var(--space-3)' }}>
              {/* KPI list */}
              <div
                style={{
                  border: '1px solid var(--neutral-150)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  display: 'grid',
                  gap: 'var(--space-3)',
                }}
              >
                <KpiBulletRow
                  label="Variation depuis ouverture"
                  value={
                    accountIsLivret
                      ? (avgRate != null ? `~${avgRate.toFixed(2)} %` : '—')
                      : (investAccount?.estimated_gain_vs_total_cash_in_pct != null
                          ? `${investAccount.estimated_gain_vs_total_cash_in_pct >= 0 ? '+' : ''}${investAccount.estimated_gain_vs_total_cash_in_pct.toFixed(1)} %`
                          : '—')
                  }
                />
                <KpiBulletRow
                  label="Variation N-1 glissante"
                  value={kpiPreviousYearAmount != null ? fmtSigned(kpiPreviousYearAmount) : '—'}
                  action={
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
                  }
                />
                <KpiBulletRow
                  label="Plus-values YTD"
                  value={
                    totalCashIn > 0
                      ? `${fmtEur(currentAmount)} · mis ${fmtEur(totalCashIn)}`
                      : '—'
                  }
                />
                <KpiBulletRow
                  label="Rendement depuis ouverture"
                  value={totalGain != null && totalGain !== 0
                    ? `${fmtSigned(totalGain)}${
                        !accountIsLivret && investAccount?.estimated_gain_vs_total_cash_in_pct != null
                          ? ` (${investAccount.estimated_gain_vs_total_cash_in_pct >= 0 ? '+' : ''}${investAccount.estimated_gain_vs_total_cash_in_pct.toFixed(1)} %)`
                          : ''
                      }`
                    : '—'}
                />
              </div>

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
  label,
  value,
  valueColor,
}: {
  icon: ReactNode
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        background: 'var(--neutral-50)',
        border: '1px solid var(--neutral-100)',
        borderRadius: 'var(--radius-md)',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ color: 'var(--neutral-400)', flexShrink: 0, display: 'flex' }}>{icon}</span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--neutral-400)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: valueColor ?? 'var(--neutral-900)',
          lineHeight: 1.2,
          wordBreak: 'break-word',
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

const FR_MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc']

function fmtEtfDate(iso: string): string {
  const d = new Date(iso)
  return `${FR_MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

function resolveIndexData(label: string): typeof PEA_ETF_DATA | null {
  const n = normalizeStr(label)
  if (n.includes('pea')) return PEA_ETF_DATA
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
  const data = resolveIndexData(accountLabel)
  const first = data?.[0]
  const last = data?.[data.length - 1]
  const pct = first && last ? ((last.value - first.value) / first.value) * 100 : null
  const minVal = data ? Math.min(...data.map((d) => d.value)) : 0
  const maxVal = data ? Math.max(...data.map((d) => d.value)) : 0
  const yMin = Math.floor((minVal - 0.1) * 10) / 10
  const yMax = Math.ceil((maxVal + 0.1) * 10) / 10

  const gradientId = 'etf-area-gradient'

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
            <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: 'var(--neutral-400)', display: 'flex' }}>
              <X size={16} />
            </button>
          </div>

          {data ? (
            <>
              {/* Performance strip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '12px 20px', background: 'var(--neutral-50)', borderBottom: '1px solid var(--neutral-100)' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Valeur départ</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)' }}>{first?.value.toFixed(2)} €</p>
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
                  <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: accountColor }}>{last?.value.toFixed(2)} €</p>
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
                      interval={3}
                    />
                    <YAxis
                      domain={[yMin, yMax]}
                      tickFormatter={(v: number) => `${v.toFixed(1)}`}
                      tick={{ fontSize: 9, fill: 'var(--neutral-400)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      width={32}
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
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff' }}>{val.toFixed(2)} €</p>
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
                  ETF Amundi MSCI World — données semi-mensuelles
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
  action,
}: {
  label: string
  value: string
  positive?: boolean
  action?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
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
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-600)', lineHeight: 1.3, flex: 1 }}>{label}</span>
      {action}
      <span
        style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-bold)',
          fontFamily: 'var(--font-mono)',
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
