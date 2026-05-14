import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { X, TrendingUp } from 'lucide-react'
import { lockDocumentScroll } from '@/lib/scrollLock'
import { useInvestmentPerformance } from '@/features/stats/hooks/useInvestmentPerformance'
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

function CircleProgress({ pct, color, size = 42 }: { pct: number; color: string; size?: number }) {
  const r = (size - 6) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const filled = (pct / 100) * circ

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--neutral-150)" strokeWidth={3} />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 600ms ease' }}
      />
      <text
        x={cx}
        y={cy + 3.5}
        textAnchor="middle"
        fill={color}
        style={{ fontSize: size < 30 ? 7 : 8, fontWeight: 800, fontFamily: 'var(--font-mono)' }}
      >
        {Math.round(pct)}%
      </text>
    </svg>
  )
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

  const currentYear = 2026
  const ytdMetrics = yearlyMetrics[`${account.key}::${currentYear}`]
  const ytdSaved = ytdMetrics?.total_saved_amount ?? 0

  const totalInterests = useMemo(
    () => accountEvents.filter((e) => e.nature === 'intérêts').reduce((sum, e) => sum + e.amount, 0),
    [accountEvents],
  )

  const plafond = resolvePlafond(account.label)
  const fillPct = plafond ? Math.min(100, Math.max(0, (currentAmount / plafond) * 100)) : null

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

  // Balance at year-end for a given year (used for plafond progress per row)
  const balanceAtYear = (year: string): number => {
    const row = rows.find((r) => r.year === year)
    if (!row) return 0
    return Number(row[account.key] ?? 0)
  }

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
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 71,
          maxWidth: 480,
          margin: '0 auto',
          background: 'var(--neutral-0)',
          borderRadius: 'var(--radius-2xl) var(--radius-2xl) 0 0',
          boxShadow: '0 -4px 32px rgba(13,13,31,0.18)',
          maxHeight: '88dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Drag handle */}
        <div style={{ padding: '10px 0 0', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 'var(--radius-full)', background: 'var(--neutral-300)' }} />
        </div>

        {/* Header */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4) var(--space-4)',
            borderBottom: '1px solid var(--neutral-100)',
            flexShrink: 0,
            display: 'grid',
            gap: 'var(--space-3)',
          }}
        >
          {/* Top row: logo + name + YTD + close */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
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

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', flexShrink: 0 }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Épargné {currentYear} YTD
                </p>
                <p
                  style={{
                    margin: '2px 0 0',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-extrabold)',
                    fontFamily: 'var(--font-mono)',
                    color: ytdSaved >= 0 ? 'var(--color-positive)' : 'var(--color-negative)',
                    lineHeight: 1,
                  }}
                >
                  {fmtSigned(ytdSaved)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fermer la modale"
                onClick={onClose}
                style={{
                  border: 'none',
                  background: 'var(--neutral-100)',
                  color: 'var(--neutral-600)',
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--radius-full)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Plafond bar (for capped accounts) */}
          {plafond !== null && fillPct !== null ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                background: 'var(--neutral-50)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                border: '1px solid var(--neutral-150)',
              }}
            >
              <CircleProgress pct={fillPct} color={account.color} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--neutral-600)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Plafond légal
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--neutral-900)',
                    }}
                  >
                    {fmtEur(currentAmount)} / {fmtEur(plafond)}
                  </span>
                </div>
                <div
                  style={{
                    height: 5,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--neutral-200)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${fillPct}%`,
                      borderRadius: 'var(--radius-full)',
                      background:
                        fillPct > 90
                          ? 'linear-gradient(90deg, var(--color-positive), #FFAB2E)'
                          : account.color,
                      transition: 'width 600ms ease',
                    }}
                  />
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--neutral-500)', fontWeight: 500 }}>
                  {fillPct.toFixed(1)}% atteint · reste{' '}
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {fmtEur(Math.max(0, plafond - currentAmount))}
                  </span>
                </p>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 2px',
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--neutral-500)', fontWeight: 600 }}>Solde actuel</span>
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-bold)',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--neutral-900)',
                }}
              >
                {fmtEur(currentAmount)}
              </span>
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-5) var(--space-4)',
            display: 'grid',
            gap: 'var(--space-6)',
            alignContent: 'start',
          }}
        >
          {/* — Section Opérations — */}
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
                    gridTemplateColumns: plafond ? '1fr auto auto auto' : '1fr auto auto',
                    gap: '6px',
                    padding: '0 6px 6px',
                    borderBottom: '1px solid var(--neutral-100)',
                  }}
                >
                  {(['Date', 'Nature', plafond ? 'Remplissage' : null, 'Montant'] as (string | null)[])
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
                          textAlign: label === 'Montant' || label === 'Remplissage' ? 'right' : 'left',
                        }}
                      >
                        {label}
                      </span>
                    ))}
                </div>

                {accountEvents.map((event, idx) => {
                  const isInterest = event.nature === 'intérêts'
                  const yearBalance = balanceAtYear(event.year)
                  const rowFillPct =
                    plafond && event.nature === 'virement'
                      ? Math.min(100, Math.max(0, (yearBalance / plafond) * 100))
                      : null

                  return (
                    <div
                      key={event.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: plafond ? '1fr auto auto auto' : '1fr auto auto',
                        gap: '6px',
                        padding: '10px 6px',
                        borderBottom: idx < accountEvents.length - 1 ? '1px solid var(--neutral-50)' : 'none',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--neutral-700)',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                        }}
                      >
                        {fmtDate(event.transaction_date)}
                      </span>

                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: isInterest ? 'var(--color-positive)' : 'var(--primary-600)',
                          background: isInterest
                            ? 'color-mix(in oklab, var(--color-positive) 12%, var(--neutral-0) 88%)'
                            : 'color-mix(in oklab, var(--primary-600) 10%, var(--neutral-0) 90%)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isInterest ? '% Intérêts' : '→ Virement'}
                      </span>

                      {plafond ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          {rowFillPct !== null ? (
                            <CircleProgress pct={rowFillPct} color={account.color} size={26} />
                          ) : (
                            <span style={{ fontSize: 10, color: 'var(--neutral-300)', width: 26, textAlign: 'center' }}>—</span>
                          )}
                        </div>
                      ) : null}

                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          textAlign: 'right',
                          color: event.amount >= 0 ? 'var(--color-positive)' : 'var(--color-negative)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {fmtSigned(event.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* — Section Performance — */}
          <section>
            <SectionHeading label="Performance" color={account.color} />

            <div style={{ marginTop: 'var(--space-3)', display: 'grid', gap: 'var(--space-3)' }}>
              {/* Rate + gain */}
              <div
                style={{
                  border: '1px solid var(--neutral-150)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  display: 'grid',
                  gap: 'var(--space-2)',
                }}
              >
                {accountIsLivret ? (
                  <>
                    <MetricRow label="Taux annuel actuel" value={`${LIVRET_CURRENT_RATE.toFixed(2)} %`} />
                    {avgRate !== null ? (
                      <MetricRow label="Taux moyen depuis ouverture" value={`~${avgRate.toFixed(2)} %`} />
                    ) : null}
                  </>
                ) : investAccount?.estimated_gain_vs_total_cash_in_pct != null ? (
                  <MetricRow
                    label="Rendement estimé (vs. cash investi)"
                    value={`${investAccount.estimated_gain_vs_total_cash_in_pct >= 0 ? '+' : ''}${investAccount.estimated_gain_vs_total_cash_in_pct.toFixed(1)} %`}
                    positive={investAccount.estimated_gain_vs_total_cash_in_pct >= 0}
                  />
                ) : null}

                <div style={{ height: 1, background: 'var(--neutral-100)' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>
                    {accountIsLivret ? 'Total intérêts générés' : 'Plus-value / gain estimé'}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-bold)',
                      fontFamily: 'var(--font-mono)',
                      color:
                        totalGain == null
                          ? 'var(--neutral-400)'
                          : totalGain >= 0
                            ? 'var(--color-positive)'
                            : 'var(--color-negative)',
                    }}
                  >
                    {totalGain != null ? fmtSigned(totalGain) : '—'}
                  </span>
                </div>
              </div>

              {/* Grade */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  border: '1px solid var(--neutral-150)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                }}
              >
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--neutral-500)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 3,
                    }}
                  >
                    Note de performance
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)', fontWeight: 600 }}>
                    {grade.label}
                  </p>
                </div>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 'var(--radius-md)',
                    background: `color-mix(in oklab, ${grade.color} 12%, var(--neutral-0) 88%)`,
                    border: `2px solid ${grade.color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 18,
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

              {/* Expert advice */}
              <div
                style={{
                  background: 'color-mix(in oklab, var(--primary-600) 5%, var(--neutral-0) 95%)',
                  border: '1px solid color-mix(in oklab, var(--primary-600) 16%, var(--neutral-0) 84%)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  display: 'grid',
                  gap: 'var(--space-2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TrendingUp size={12} color="var(--primary-600)" />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--primary-600)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                    }}
                  >
                    Avis expert
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--neutral-700)',
                    lineHeight: 1.6,
                  }}
                >
                  {advice}
                </p>
              </div>
            </div>
          </section>

          {/* Safe area bottom padding */}
          <div style={{ height: 'max(var(--safe-bottom-offset, 0px), var(--space-3))' }} />
        </div>
      </motion.div>
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

function MetricRow({
  label,
  value,
  positive,
}: {
  label: string
  value: string
  positive?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>{label}</span>
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
        }}
      >
        {value}
      </span>
    </div>
  )
}
