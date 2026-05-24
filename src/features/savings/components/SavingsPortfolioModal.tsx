import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { TriangleAlert } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, Line, ReferenceLine, Legend } from 'recharts'
import { lockDocumentScroll } from '@/lib/scrollLock'
import { useInvestmentPerformance } from '@/features/stats/hooks/useInvestmentPerformance'
import { useSavingsAnnualPerformance } from '@/features/savings/hooks/useSavingsAnnualPerformance'
import { useSavingsAccountsDisplay } from '@/features/savings/hooks/useSavingsAccountsDisplay'
import type {
  SavingsEvolutionFiveYearsRow,
  SavingsEvolutionFiveYearsSeries,
  SavingsEvolutionOperationEvent,
} from '@/features/savings/types'

type StyledSeries = SavingsEvolutionFiveYearsSeries & {
  shortLabel: string
  iconSrc: string
  listLabel: string
}

type Props = {
  account: StyledSeries
  operationEvents: SavingsEvolutionOperationEvent[]
  rows: SavingsEvolutionFiveYearsRow[]
  currentAmount: number
  onClose: () => void
  onReturnToList?: () => void
}

function normalizeStr(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
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

export function SavingsPortfolioModal({
  account,
  operationEvents,
  rows,
  currentAmount,
  onClose,
  onReturnToList,
}: Props) {
  const { data: perfData } = useInvestmentPerformance(2026)
  const { data: annualPerf } = useSavingsAnnualPerformance()
  const { data: accountsDisplay } = useSavingsAccountsDisplay()

  useEffect(() => lockDocumentScroll(), [])

  const accountAnnualPerf = useMemo(
    () => annualPerf.filter((r) => r.account_id === account.key),
    [annualPerf, account.key],
  )

  const accountEvents = useMemo(
    () =>
      operationEvents
        .filter((e) => e.account_key === account.key)
        .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()),
    [operationEvents, account.key],
  )

  const accountIsLivret = account.family === 'livrets'

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
  const normalizedAccountLabel = useMemo(() => normalizeStr(account.label), [account.label])
  const isLivretAModal = useMemo(() => normalizedAccountLabel.includes('livret a'), [normalizedAccountLabel])
  const isLddsModal = useMemo(() => normalizedAccountLabel.includes('ldds'), [normalizedAccountLabel])
  const isPeaModal = useMemo(() => normalizedAccountLabel.includes('pea'), [normalizedAccountLabel])
  const isPegModal = useMemo(
    () => normalizedAccountLabel.includes('peg') || normalizedAccountLabel.includes('capgemini'),
    [normalizedAccountLabel],
  )
  const isBitcoinModal = useMemo(
    () => normalizedAccountLabel.includes('bitcoin') || normalizedAccountLabel.includes('btc') || normalizedAccountLabel.includes('crypto'),
    [normalizedAccountLabel],
  )
  const isPerModal = useMemo(
    () => normalizedAccountLabel.includes('per') || normalizedAccountLabel.includes('plan epargne retraite'),
    [normalizedAccountLabel],
  )

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

  const handleReturnToList = () => {
    if (onReturnToList) {
      onReturnToList()
      return
    }
    onClose()
  }

  // Résolution du capital investi :
  // 1. Priorité à total_capital_deposited si défini explicitement en config (ex. Livret A = 22 950 €)
  //    → couvre les comptes réglementés où les retraits ne sont pas tracés dans la vue opérations
  // 2. Sinon : somme des virements nets depuis les événements (hors intérêts)
  const accountConfig = useMemo(
    () => accountsDisplay.find((a) => a.account_id === account.key) ?? null,
    [accountsDisplay, account.key],
  )
  const totalCashIn = useMemo(() => {
    if (accountConfig?.total_capital_deposited != null) {
      return accountConfig.total_capital_deposited
    }
    return accountEvents
      .filter((e) => e.nature !== 'intérêts')
      .reduce((sum, e) => sum + e.amount, 0)
  }, [accountConfig, accountEvents])
  const kpiYtdGainAmount = useMemo(
    () => (totalCashIn > 0 ? currentAmount - totalCashIn : null),
    [currentAmount, totalCashIn],
  )

  const currentYear = new Date().getFullYear()
  const previousYear = currentYear - 1

  const kpiPreviousYearAmount = useMemo(() => {
    if (accountIsLivret) {
      const interestRow = accountAnnualPerf.find((r) => r.period_year === previousYear)
      if (interestRow?.regulated_interest_theoretical != null) return interestRow.regulated_interest_theoretical
      return accountEvents
        .filter((event) => event.nature === 'intérêts' && Number(event.year) === previousYear)
        .reduce((sum, event) => sum + Number(event.amount ?? 0), 0)
    }

    const perfRow = accountAnnualPerf.find((r) => r.period_year === previousYear)
    return perfRow?.performance_amount ?? null
  }, [accountIsLivret, accountEvents, previousYear, accountAnnualPerf])

  const annualizedReturnPctModal = useMemo(() => {
    if (!activeMonths || activeMonths <= 0 || totalCashIn <= 0 || currentAmount <= 0) return null
    const activeYears = activeMonths / 12
    return (Math.pow(currentAmount / totalCashIn, 1 / activeYears) - 1) * 100
  }, [activeMonths, totalCashIn, currentAmount])

  const kpiPreviousYearPct = useMemo(() => {
    if (accountIsLivret) {
      return accountAnnualPerf.find((r) => r.period_year === previousYear)?.regulated_rate_pct ?? null
    }
    return accountAnnualPerf.find((r) => r.period_year === previousYear)?.performance_pct ?? null
  }, [accountIsLivret, accountAnnualPerf, previousYear])
  const modalTopInset = 'calc(var(--safe-top) + 64px + var(--space-8))'
  const modalBottomInset = 'calc(var(--nav-height) + var(--space-4))'
  const modalMaxHeight = 'calc(100dvh - var(--safe-top) - 64px - var(--space-8) - var(--nav-height) - var(--space-4))'

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
          top: modalTopInset,
          left: 0,
          right: 0,
          bottom: modalBottomInset,
          zIndex: 71,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '0 var(--page-gutter)',
          overflowY: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 'min(620px, 100%)',
            maxHeight: modalMaxHeight,
            background: 'var(--neutral-0)',
            borderRadius: 'var(--radius-2xl)',
            boxShadow: '0 24px 60px rgba(13,13,31,0.24)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            overflowX: 'hidden',
            overscrollBehavior: 'contain',
            pointerEvents: 'auto',
          }}
        >

        {/* Header */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 12,
            padding: 'var(--space-3)',
            borderBottom: '1px solid var(--neutral-100)',
            background: 'var(--neutral-0)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              background: 'color-mix(in oklab, var(--primary-600) 5%, var(--neutral-0) 95%)',
              border: '1px solid color-mix(in oklab, var(--primary-600) 12%, var(--neutral-0) 88%)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-2) var(--space-3)',
            }}
          >
            {/* Top row: back affordance + logo/info + amount */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                <button
                  type="button"
                  onClick={handleReturnToList}
                  aria-label="Fermer et revenir"
                  title="Retour"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    margin: 0,
                    minWidth: 22,
                    minHeight: 22,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 0,
                      height: 0,
                      borderTop: '6px solid transparent',
                      borderBottom: '6px solid transparent',
                      borderRight: '9px solid var(--neutral-400)',
                      display: 'inline-block',
                    }}
                  />
                </button>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    border: `2px solid ${account.color}`,
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
                <div style={{ minWidth: 0, display: 'flex', alignItems: 'center' }}>
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

        {/* Bottom section: analysis and advice */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            scrollbarGutter: 'stable both-edges',
            background: 'var(--neutral-50)',
            padding: 'var(--space-4)',
            paddingBottom: 'max(var(--space-4), var(--safe-bottom))',
          }}
        >
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
              <SectionHeading label="Performance" color={account.color} />
            </div>

            <div style={{ marginTop: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
              {/* KPI list */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  columnGap: 'var(--space-3)',
                  rowGap: '6px',
                }}
              >
                <KpiBulletRow
                  label="Activité"
                  value={
                    activeMonths != null
                      ? `${activeMonths} mois`
                      : '—'
                  }
                />
                <KpiBulletRow
                  label="Capital init."
                  value={isBitcoinModal ? '3000€' : (isLddsModal ? '12000€' : (isPegModal ? '6772€' : (isPerModal ? '6000€' : (isPeaModal ? '15000€' : (totalCashIn > 0 ? fmtEur(totalCashIn) : '—')))))}
                />
                <KpiBulletRow
                  label="Valeur"
                  value={fmtEur(currentAmount)}
                />
                <KpiBulletRow
                  label="Gain net"
                  value={isLddsModal ? '57€' : (isPegModal ? '+899€' : (isPerModal ? '+117€' : (isPeaModal ? '2481€' : (isBitcoinModal ? '+146€' : (kpiYtdGainAmount != null ? fmtSignedCompact(kpiYtdGainAmount) : '—')))))}
                  positive={isLddsModal ? true : (isPegModal ? true : (isPerModal ? true : (isPeaModal ? true : (isBitcoinModal ? true : (kpiYtdGainAmount != null ? kpiYtdGainAmount >= 0 : undefined)))))}
                />
                <KpiBulletRow
                  label="Rend.annual."
                  value={isLddsModal ? '+0,48%' : (isPegModal ? '+3,4%' : (isPerModal ? '+1,43%' : (isPeaModal ? '13%' : (isBitcoinModal ? '+2,22%' : (annualizedReturnPctModal != null ? fmtSignedPercentCompact(annualizedReturnPctModal, 1) : '—')))))}
                  positive={isLddsModal ? true : (isPegModal ? true : (isPerModal ? true : (isPeaModal ? true : (isBitcoinModal ? true : (annualizedReturnPctModal != null ? annualizedReturnPctModal >= 0 : undefined)))))}
                />
                <KpiBulletRow
                  label="Rend.N-1"
                  value={isLddsModal
                    ? '+0,48%'
                    : isPerModal
                    ? '-0,3%'
                    : isPeaModal
                    ? '+21,6%'
                    : (
                      kpiPreviousYearAmount != null
                        ? `${fmtSignedCompact(kpiPreviousYearAmount)}${kpiPreviousYearPct != null ? ` (${fmtSignedPercentCompact(kpiPreviousYearPct, 1)})` : ''}`
                        : '—'
                    )}
                  positive={isLddsModal ? true : (isPerModal ? false : (isPeaModal ? true : (kpiPreviousYearAmount != null ? kpiPreviousYearAmount >= 0 : undefined)))}
                />
              </div>

              <div style={{ marginTop: 'var(--space-2)' }}>
                <IndexEvolutionSection
                  accountLabel={account.listLabel}
                  accountColor={account.color}
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

              <SectionHeading label="Stratégie" color={account.color} />

              {/* Expert advice */}
              <div
                style={{
                  background: 'linear-gradient(145deg, color-mix(in oklab, var(--primary-600) 84%, #1a1f4a 16%), color-mix(in oklab, var(--primary-600) 68%, #2a3672 32%))',
                  border: '1px solid color-mix(in oklab, var(--primary-600) 42%, #324090 58%)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-4)',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) auto',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                {isLivretAModal ? (
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 'var(--space-4)',
                      listStyleType: 'disc',
                      listStylePosition: 'outside',
                      display: 'grid',
                      gap: 'var(--space-2)',
                      color: 'rgba(255,255,255,0.92)',
                      fontSize: 'var(--font-size-sm)',
                      lineHeight: 1.55,
                    }}
                  >
                    <li>Rediriger l&apos;excédent vers un placement plus rentable pour optimiser le rendement à long terme</li>
                  </ul>
                ) : isLddsModal ? (
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 'var(--space-4)',
                      listStyleType: 'disc',
                      listStylePosition: 'outside',
                      display: 'grid',
                      gap: 'var(--space-2)',
                      color: 'rgba(255,255,255,0.92)',
                      fontSize: 'var(--font-size-sm)',
                      lineHeight: 1.55,
                    }}
                  >
                    <li>Maintenir le plafond : Liquidité totale pour l&apos;épargne de précaution</li>
                  </ul>
                ) : isPeaModal ? (
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 'var(--space-4)',
                      listStyleType: 'disc',
                      listStylePosition: 'outside',
                      display: 'grid',
                      gap: 'var(--space-2)',
                      color: 'rgba(255,255,255,0.92)',
                      fontSize: 'var(--font-size-sm)',
                      lineHeight: 1.55,
                    }}
                  >
                    <li>Continuer la stratégie ETF passive initiée en 2025</li>
                    <li>Augmenter l&apos;investissement sur ce portefeuille</li>
                  </ul>
                ) : isPegModal ? (
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 'var(--space-4)',
                      listStyleType: 'disc',
                      listStylePosition: 'outside',
                      display: 'grid',
                      gap: 'var(--space-2)',
                      color: 'rgba(255,255,255,0.92)',
                      fontSize: 'var(--font-size-sm)',
                      lineHeight: 1.55,
                    }}
                  >
                    <li>Apport de capital bloqué (sortie de l&apos;entreprise) + frais et supports peu optimisés</li>
                    <li>Étudier le déblocage / la réallocation dès 2026</li>
                  </ul>
                ) : isBitcoinModal ? (
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 'var(--space-4)',
                      listStyleType: 'disc',
                      listStylePosition: 'outside',
                      display: 'grid',
                      gap: 'var(--space-2)',
                      color: 'rgba(255,255,255,0.92)',
                      fontSize: 'var(--font-size-sm)',
                      lineHeight: 1.55,
                    }}
                  >
                    <li>Sécurisation des clés privées (Ledger)</li>
                  </ul>
                ) : isPerModal ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', color: 'rgba(255,255,255,0.92)' }}>
                    <TriangleAlert size={16} color="#FC5A5A" style={{ flexShrink: 0, marginTop: 2 }} />
                    <p
                      style={{
                        margin: 0,
                        fontSize: 'var(--font-size-sm)',
                        lineHeight: 1.55,
                      }}
                    >
                      Étudier rapidement le transfert du PER vers une enveloppe moins chargée en frais et plus ouverte aux ETF (PEA)
                    </p>
                  </div>
                ) : (
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
                )}

                <div
                  aria-label={`Note ${grade.grade}`}
                  title={`Note ${grade.grade} · ${grade.label}`}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--radius-sm)',
                    background: `color-mix(in oklab, ${grade.color} 12%, var(--neutral-0) 88%)`,
                    border: `2.5px solid ${grade.color}`,
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

            </div>
          </section>
        </div>
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

// PEA — données réelles portfolio (jan 2025 – mai 2026, mensuel)
// Source : evol_finale_pea.csv + pea_wpea_synthese_rendement_Vdef.csv
const PEA_PORTFOLIO_DATA: Array<{ date: string; valeur: number; capitalInvesti: number; gainPerte: number; rendementPct: number }> = [
  { date: '2025-01-31', valeur: 2102.25,  capitalInvesti: 2000.0,  gainPerte: 113.84,   rendementPct: 5.692  },
  { date: '2025-02-28', valeur: 14096.06, capitalInvesti: 14000.0, gainPerte: 177.16,   rendementPct: 1.266  },
  { date: '2025-03-31', valeur: 13969.84, capitalInvesti: 15000.0, gainPerte: -943.26,  rendementPct: -6.288 },
  { date: '2025-04-30', valeur: 13427.50, capitalInvesti: 15000.0, gainPerte: -1485.60, rendementPct: -9.904 },
  { date: '2025-05-31', valeur: 14302.58, capitalInvesti: 15000.0, gainPerte: -610.52,  rendementPct: -4.070 },
  { date: '2025-06-30', valeur: 14410.00, capitalInvesti: 15000.0, gainPerte: -503.10,  rendementPct: -3.354 },
  { date: '2025-07-31', valeur: 15091.20, capitalInvesti: 15000.0, gainPerte: 178.10,   rendementPct: 1.187  },
  { date: '2025-08-31', valeur: 15038.80, capitalInvesti: 15000.0, gainPerte: 125.70,   rendementPct: 0.838  },
  { date: '2025-09-30', valeur: 15424.46, capitalInvesti: 15000.0, gainPerte: 511.36,   rendementPct: 3.409  },
  { date: '2025-10-31', valeur: 16071.08, capitalInvesti: 15000.0, gainPerte: 1157.98,  rendementPct: 7.720  },
  { date: '2025-11-30', valeur: 16018.68, capitalInvesti: 15000.0, gainPerte: 1105.58,  rendementPct: 7.371  },
  { date: '2025-12-31', valeur: 16035.19, capitalInvesti: 15000.0, gainPerte: 1122.09,  rendementPct: 7.481  },
  { date: '2026-01-31', valeur: 16120.86, capitalInvesti: 15000.0, gainPerte: 1207.76,  rendementPct: 8.052  },
  { date: '2026-02-28', valeur: 16314.74, capitalInvesti: 15000.0, gainPerte: 1401.64,  rendementPct: 9.344  },
  { date: '2026-03-31', valeur: 15536.34, capitalInvesti: 15000.0, gainPerte: 623.24,   rendementPct: 4.155  },
  { date: '2026-04-30', valeur: 16820.40, capitalInvesti: 15000.0, gainPerte: 1907.30,  rendementPct: 12.715 },
  { date: '2026-05-15', valeur: 17394.18, capitalInvesti: 15000.0, gainPerte: 2481.08,  rendementPct: 16.541 },
]

// Synthèse globale PEA (depuis ouverture jan 2025)
const PEA_SYNTHESE = {
  firstContributionDate: '2025-01-20',
  valuationDate: '2026-05-15',
  totalContributed: 15000.0,
  portfolioValue: 17394.18,
  gainLoss: 2481.08,
  simpleReturnPct: 16.5405,
  xirrAnnualizedPct: 13.0622,
  etfClose: 6.639,
}

// Bitcoin — portefeuille réel (tous les 2 mois, mars 2024 – mai 2026)
// Source : bitcoin_portefeuille_valeur_bimestrielle_2024_2026.csv
const BTC_PORTFOLIO_DATA: Array<{ date: string; cours: number; portefeuille: number }> = [
  { date: '2024-03-27', cours: 63323.64, portefeuille: 2000.00 },
  { date: '2024-05-27', cours: 58389.20, portefeuille: 1844.15 },
  { date: '2024-07-27', cours: 54602.56, portefeuille: 1724.56 },
  { date: '2024-09-27', cours: 57069.24, portefeuille: 1802.46 },
  { date: '2024-11-27', cours: 73147.27, portefeuille: 2310.27 },
  { date: '2025-01-27', cours: 96990.35, portefeuille: 3063.32 },
  { date: '2025-03-27', cours: 77237.41, portefeuille: 2439.45 },
  { date: '2025-05-27', cours: 92202.28, portefeuille: 2912.10 },
  { date: '2025-07-27', cours: 95394.26, portefeuille: 3012.91 },
  { date: '2025-09-27', cours: 97452.70, portefeuille: 3077.92 },
  { date: '2025-11-27', cours: 77765.60, portefeuille: 2456.13 },
  { date: '2026-01-27', cours: 59617.29, portefeuille: 2796.37 },
  { date: '2026-03-27', cours: 62106.51, portefeuille: 2913.15 },
  { date: '2026-05-16', cours: 67965.58, portefeuille: 3188.00 },
]

// Synthèse Bitcoin — portefeuille consolidé BTC-1 (2000€, mars 2024) + BTC-2 (1042€, déc 2025)
const BTC_SYNTHESE = {
  dateAchat: '2024-03-27',
  dateValorisation: '2026-05-16',
  montantInvesti: 3042.0,
  valeurActuelle: 3188.00,
  gainLatent: 146.00,
  rendementCumulePct: 4.80,
  dureeJours: 780,
  rendementAnnualisePct: 2.22,
  quantiteBtc: 0.050791,
  prixRevient: 59890,
  prixActuel: 67965.58,
}

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
  { period: 'mai 26',  valeur: 6180.23, uc: 148.10, frais: 3.23 },
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
  { period: '2026 YTD',  opening: 6137.55, closing: 6180.23, rendement:   42.68, rendementPct:  0.70, fraisTotaux: 12.23 },
]

// Livret A — rendement réel semestriel 2020–2026 vs inflation (source INSEE / BdF)
const LIVRET_A_REEL_DATA: Array<LivretReelEntry> = [
  { period: 'jan 20',  taux: 0.75, inflation: 0.5,  reel:  0.25,  tauxCumule:  0.00,  inflationCumulee:  0.00,  reelCumule:  0.00  },
  { period: 'jul 20',  taux: 0.50, inflation: 0.5,  reel:  0.00,  tauxCumule:  0.27,  inflationCumulee:  0.25,  reelCumule:  0.02  },
  { period: 'jan 21',  taux: 0.50, inflation: 1.6,  reel: -1.10,  tauxCumule:  0.52,  inflationCumulee:  0.50,  reelCumule:  0.02  },
  { period: 'jul 21',  taux: 0.50, inflation: 1.6,  reel: -1.10,  tauxCumule:  0.77,  inflationCumulee:  1.30,  reelCumule: -0.52  },
  { period: 'jan 22',  taux: 0.50, inflation: 5.2,  reel: -4.70,  tauxCumule:  1.03,  inflationCumulee:  2.11,  reelCumule: -1.06  },
  { period: 'jul 22',  taux: 1.00, inflation: 5.2,  reel: -4.20,  tauxCumule:  1.48,  inflationCumulee:  4.71,  reelCumule: -3.08  },
  { period: 'jan 23',  taux: 2.00, inflation: 4.9,  reel: -2.90,  tauxCumule:  2.41,  inflationCumulee:  7.42,  reelCumule: -4.66  },
  { period: 'jul 23',  taux: 3.00, inflation: 4.9,  reel: -1.90,  tauxCumule:  3.84,  inflationCumulee: 10.00,  reelCumule: -5.60  },
  { period: 'jan 24',  taux: 3.00, inflation: 2.0,  reel:  1.00,  tauxCumule:  5.40,  inflationCumulee: 12.68,  reelCumule: -6.46  },
  { period: 'jul 24',  taux: 3.00, inflation: 2.0,  reel:  1.00,  tauxCumule:  6.96,  inflationCumulee: 13.80,  reelCumule: -6.01  },
  { period: 'jan 25',  taux: 3.00, inflation: 0.9,  reel:  2.10,  tauxCumule:  8.57,  inflationCumulee: 14.94,  reelCumule: -5.54  },
  { period: 'jul 25',  taux: 2.40, inflation: 0.9,  reel:  1.50,  tauxCumule:  9.91,  inflationCumulee: 15.45,  reelCumule: -4.80  },
  { period: 'jan 26',  taux: 1.70, inflation: 0.8,  reel:  0.90,  tauxCumule: 10.91,  inflationCumulee: 15.98,  reelCumule: -4.37  },
  { period: 'jul 26',  taux: 1.50, inflation: 0.8,  reel:  0.70,  tauxCumule: 11.75,  inflationCumulee: 16.44,  reelCumule: -4.02  },
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
type LivretReelEntry = { period: string; taux: number; inflation: number; reel: number; tauxCumule: number; inflationCumulee: number; reelCumule: number }
type PerMonthlyEntry = { period: string; valeur: number; uc: number; frais: number }
type PerSyntheseEntry = { period: string; opening: number; closing: number; rendement: number; rendementPct: number; fraisTotaux: number }
type PeaPortfolioEntry = { date: string; valeur: number; capitalInvesti: number; gainPerte: number; rendementPct: number }
type PeaSynthese = { firstContributionDate: string; valuationDate: string; totalContributed: number; portfolioValue: number; gainLoss: number; simpleReturnPct: number; xirrAnnualizedPct: number; etfClose: number }
type PegEntry = { date: string; salariale: number | null; retraite: number | null; total: number }
type BtcPortfolioEntry = { date: string; cours: number; portefeuille: number }
type BtcSynthese = { dateAchat: string; dateValorisation: string; montantInvesti: number; valeurActuelle: number; gainLatent: number; rendementCumulePct: number; dureeJours: number; rendementAnnualisePct: number; quantiteBtc: number; prixRevient: number; prixActuel: number }

type IndexDataset = {
  default: Array<{ date: string; value: number }>
  fiveYears?: Array<{ date: string; value: number }>
  rateHistory?: RateHistoryEntry[]        // LDDS — taux + inflation + rendement réel
  livretHistory?: LivretHistoryEntry[]    // Livret A — paliers réglementaires depuis 2015
  livretReel?: LivretReelEntry[]          // Livret A — taux + inflation + rendement réel 2020–2026
  perHistory?: PerMonthlyEntry[]          // PER — valorisation mensuelle + frais + UC
  perSynthese?: PerSyntheseEntry[]        // PER — synthèse par exercice
  peaPortfolio?: PeaPortfolioEntry[]      // PEA — capital investi + valeur + gain/perte mensuel
  peaSynthese?: PeaSynthese              // PEA — KPIs globaux depuis ouverture
  pegHistory?: PegEntry[]                // PEG — épargne salariale + retraite mensuel
  btcPortfolio?: BtcPortfolioEntry[]     // Bitcoin — cours + valeur portefeuille bimestriel
  btcSynthese?: BtcSynthese             // Bitcoin — KPIs globaux depuis achat
  unit: string
  label: string
  sourceNote: string
}

// PEG Capgemini — épargne salariale + retraite (tous les 6 mois, mai 2021 – mai 2026)
// Source : peg_capgemini_epargne_salariale_retraite_total.csv
const PEG_HISTORY_DATA: Array<PegEntry> = [
  { date: '2021-05-16', salariale: null,   retraite: 162.36,  total: 162.36   },
  { date: '2021-11-16', salariale: 360.75, retraite: 351.22,  total: 711.97   },
  { date: '2022-05-16', salariale: 2581.53, retraite: 368.73, total: 2950.26  },
  { date: '2022-11-16', salariale: 2473.53, retraite: 1005.01, total: 3478.54 },
  { date: '2023-05-16', salariale: 3660.68, retraite: 1024.43, total: 4685.11 },
  { date: '2023-11-16', salariale: 5220.36, retraite: 1002.17, total: 6222.53 },
  { date: '2024-05-16', salariale: 7875.54, retraite: 1128.19, total: 9003.73 },
  { date: '2024-11-16', salariale: 6600.19, retraite: null,    total: 6600.19 },
  { date: '2025-05-16', salariale: 6638.19, retraite: 1186.57, total: 7824.76 },
  { date: '2025-11-16', salariale: 6564.82, retraite: 1240.94, total: 7805.76 },
  { date: '2026-05-16', salariale: 6368.23, retraite: 1303.23, total: 7671.46 },
]


const FR_MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc']

function fmtEtfDate(iso: string): string {
  const d = new Date(iso)
  return `${FR_MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

function resolveIndexData(label: string): IndexDataset | null {
  const n = normalizeStr(label)
  if (n.includes('pea')) {
    return {
      default: [],
      peaPortfolio: PEA_PORTFOLIO_DATA,
      peaSynthese: PEA_SYNTHESE,
      unit: '€',
      label: 'PEA — Amundi MSCI World',
      sourceNote: 'Données réelles PEA · Amundi ETF MSCI World (LU1681043599) · jan 2025–mai 2026',
    }
  }
  if (n.includes('bitcoin') || n.includes('btc') || n.includes('crypto')) {
    return {
      default: [],
      btcPortfolio: BTC_PORTFOLIO_DATA,
      btcSynthese: BTC_SYNTHESE,
      unit: '€',
      label: 'Bitcoin — Cours & Portefeuille',
      sourceNote: 'Données réelles · achat mars 2024 · 0.03158 BTC · prix de revient 63 324 €/BTC',
    }
  }
  if (n.includes('peg') || n.includes('capgemini')) {
    return {
      default: [],
      pegHistory: PEG_HISTORY_DATA,
      unit: '€',
      label: 'PEG Capgemini — Épargne salariale & retraite',
      sourceNote: 'Données réelles PEG Capgemini · épargne salariale + retraite · mai 2021–mai 2026',
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
      livretReel: LIVRET_A_REEL_DATA,
      unit: '%',
      label: 'Taux Livret A · Inflation · Rendement réel',
      sourceNote: 'Taux BdF · Inflation INSEE — semestriel 2020–2026',
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

function IndexEvolutionSection({
  accountLabel,
  accountColor,
}: {
  accountLabel: string
  accountColor: string
}) {
  const normalizedAccountLabel = useMemo(() => normalizeStr(accountLabel), [accountLabel])
  const isLddsChart = normalizedAccountLabel.includes('ldds')
  const dataset = resolveIndexData(accountLabel)
  const hasFiveYears = Boolean(dataset?.fiveYears)
  const isRateChart = Boolean(dataset?.rateHistory)
  const isLivretChart = Boolean(dataset?.livretHistory)
  const isPerChart = Boolean(dataset?.perHistory)
  const [period, setPeriod] = useState<'ytd' | '5y'>('ytd')

  const data = useMemo(() => {
    if (!dataset || isRateChart || isLivretChart || isPerChart || dataset.peaPortfolio || dataset.btcPortfolio || dataset.pegHistory) return null
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

  // Livret A réel (série 2020–2026)
  const livretReelData = dataset?.livretReel ?? null

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

  // PEA KPIs
  const peaData = dataset?.peaPortfolio ?? null
  const peaSyntheseData = dataset?.peaSynthese ?? null
  const isPeaChart = Boolean(peaData)
  const peaAllMin = peaData ? Math.min(...peaData.map((r) => Math.min(r.valeur, r.capitalInvesti))) : 0
  const peaAllMax = peaData ? Math.max(...peaData.map((r) => Math.max(r.valeur, r.capitalInvesti))) : 0
  const peaPad = (peaAllMax - peaAllMin) * 0.08
  const peaYMin = peaAllMin - peaPad
  const peaYMax = peaAllMax + peaPad

  // PEG KPIs
  const pegData = dataset?.pegHistory ?? null
  const isPegChart = Boolean(pegData)
  const latestPeg = pegData?.[pegData.length - 1]
  const pegYMax = pegData ? Math.max(...pegData.map((r) => r.total)) * 1.1 : 0

  // Bitcoin KPIs
  const btcData = dataset?.btcPortfolio ?? null
  const btcSyntheseData = dataset?.btcSynthese ?? null
  const isBtcChart = Boolean(btcData)
  const btcCoursMin = btcData ? Math.min(...btcData.map((r) => r.cours)) : 0
  const btcCoursMax = btcData ? Math.max(...btcData.map((r) => r.cours)) : 0
  const btcPadLeft = (btcCoursMax - btcCoursMin) * 0.08
  const btcCoursYMin = btcCoursMin - btcPadLeft
  const btcCoursYMax = btcCoursMax + btcPadLeft * 0.5
  const btcPortefMin = btcData ? Math.min(...btcData.map((r) => r.portefeuille)) : 0
  const btcPortefMax = btcData ? Math.max(...btcData.map((r) => r.portefeuille)) : 0
  const btcPortefYMin = btcPortefMin * 0.92
  const btcPortefYMax = btcPortefMax * 1.08

  const gradientId = 'index-area-gradient'
  const gradientPerValeurId = 'per-valeur-gradient'
  const gradientPeaValeurId = 'pea-valeur-gradient'
  const gradientPeaCapitalId = 'pea-capital-gradient'
  const peaSourceNoteSingleLine = (dataset?.sourceNote ?? '').replace(/\s*\([^)]*\d[^)]*\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()

  return (
    <div style={{ width: '100%', background: 'var(--neutral-0)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--neutral-100)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {!isPeaChart && !isLddsChart && !isLivretChart ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--neutral-100)' }}>
              {!isPegChart && !isBtcChart ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: accountColor, flexShrink: 0 }} />
                  <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--neutral-900)' }}>
                    Évolution des indices · {accountLabel}
                  </h3>
                </div>
              ) : <div />}
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
              </div>
            </div>
          ) : null}

          <div style={{ overflowY: 'auto' }}>

          {/* ── Bitcoin — cours + valeur portefeuille bimestriel ── */}
          {isBtcChart && btcData ? (
            <>
              {/* ── ComposedChart dual-axis : cours BTC (gauche) + portefeuille € (droite) ── */}
              <div style={{ padding: '16px 8px 4px 4px' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={btcData} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="btc-cours-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accountColor} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={accountColor} stopOpacity={0.01} />
                      </linearGradient>
                      <linearGradient id="btc-portef-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2ED47A" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#2ED47A" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-100)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtEtfDate}
                      tick={{ fontSize: 9, fill: 'var(--neutral-400)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    {/* Axe gauche : cours BTC en k€ */}
                    <YAxis
                      yAxisId="cours"
                      orientation="left"
                      domain={[btcCoursYMin, btcCoursYMax]}
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 9, fill: accountColor, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    {/* Axe droit : valeur portefeuille en € */}
                    <YAxis
                      yAxisId="portef"
                      orientation="right"
                      domain={[btcPortefYMin, btcPortefYMax]}
                      tickFormatter={(v: number) => `${v.toFixed(0)} €`}
                      tick={{ fontSize: 9, fill: '#2ED47A', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      width={46}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const coursEntry = payload.find((p) => p.dataKey === 'cours')
                        const portefEntry = payload.find((p) => p.dataKey === 'portefeuille')
                        const cours = coursEntry?.value as number | undefined
                        const portef = portefEntry?.value as number | undefined
                        const investi = btcSyntheseData?.montantInvesti ?? 2000
                        const gainVal = portef != null ? portef - investi : null
                        return (
                          <div style={{
                            background: '#1a1f3a',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.32)',
                            minWidth: 170,
                          }}>
                            <p style={{ margin: '0 0 6px', fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{fmtEtfDate(label as string)}</p>
                            {cours != null && (
                              <p style={{ margin: '2px 0', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: accountColor }}>
                                BTC/EUR · {new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(cours)} €
                              </p>
                            )}
                            {portef != null && (
                              <p style={{ margin: '2px 0', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#2ED47A' }}>
                                Portefeuille · {fmtEur(portef)}
                              </p>
                            )}
                            {gainVal != null && (
                              <p style={{ margin: '4px 0 0', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: gainVal >= 0 ? '#2ED47A' : '#FC5A5A', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 4 }}>
                                {gainVal >= 0 ? '+' : ''}{fmtEur(gainVal)} vs investi
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
                        const labels: Record<string, string> = { cours: 'Cours BTC/EUR', portefeuille: 'Mon portefeuille' }
                        return labels[value] ?? value
                      }}
                    />
                    {/* Ligne de référence : montant investi */}
                    <ReferenceLine yAxisId="portef" y={btcSyntheseData?.montantInvesti ?? 2000} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 3" strokeWidth={1} />
                    {/* Courbe cours BTC */}
                    <Area
                      yAxisId="cours"
                      type="monotone"
                      dataKey="cours"
                      stroke={accountColor}
                      strokeWidth={2}
                      fill="url(#btc-cours-gradient)"
                      dot={{ r: 3, fill: accountColor, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: accountColor, strokeWidth: 0 }}
                    />
                    {/* Courbe portefeuille */}
                    <Area
                      yAxisId="portef"
                      type="monotone"
                      dataKey="portefeuille"
                      stroke="#2ED47A"
                      strokeWidth={2}
                      strokeDasharray="5 2"
                      fill="url(#btc-portef-gradient)"
                      dot={{ r: 3, fill: '#2ED47A', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#2ED47A', strokeWidth: 0 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : null}

          {/* ── PEG Capgemini — barres empilées salariale + retraite ── */}
          {isPegChart && pegData ? (
            <>
              {/* KPI strip — 3 métriques */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--neutral-100)', background: 'var(--neutral-50)' }}>
                {[
                  {
                    label: 'Salariale',
                    value: latestPeg?.salariale != null ? fmtEur(latestPeg.salariale) : '—',
                    color: accountColor,
                  },
                  {
                    label: 'PERCOL',
                    value: latestPeg?.retraite != null ? fmtEur(latestPeg.retraite) : '—',
                    color: '#FFAB2E',
                  },
                  {
                    label: 'Total PEG',
                    value: latestPeg ? fmtEur(latestPeg.total) : '—',
                    color: 'var(--neutral-700)',
                  },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    style={{
                      padding: '7px 12px',
                      borderRight: '1px solid var(--neutral-100)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 8, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>
                      {kpi.label}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)', color: kpi.color, lineHeight: 1.1 }}>
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* ── ComposedChart : barres empilées + ligne total ── */}
              <div style={{ padding: '16px 8px 4px 4px' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={pegData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-100)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtEtfDate}
                      tick={{ fontSize: 9, fill: 'var(--neutral-400)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      domain={[0, pegYMax]}
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 9, fill: 'var(--neutral-400)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const salEntry = payload.find((p) => p.dataKey === 'salariale')
                        const retEntry = payload.find((p) => p.dataKey === 'retraite')
                        const totEntry = payload.find((p) => p.dataKey === 'total')
                        const sal = salEntry?.value as number | undefined
                        const ret = retEntry?.value as number | undefined
                        const tot = totEntry?.value as number | undefined
                        return (
                          <div style={{
                            background: '#1a1f3a',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.32)',
                            minWidth: 160,
                          }}>
                            <p style={{ margin: '0 0 6px', fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{fmtEtfDate(label as string)}</p>
                            {sal != null && (
                              <p style={{ margin: '2px 0', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: accountColor }}>
                                Salariale · {fmtEur(sal)}
                              </p>
                            )}
                            {ret != null && (
                              <p style={{ margin: '2px 0', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#FFAB2E' }}>
                                Retraite · {fmtEur(ret)}
                              </p>
                            )}
                            {tot != null && (
                              <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 4 }}>
                                Total · {fmtEur(tot)}
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
                        const labels: Record<string, string> = {
                          salariale: 'Épargne salariale',
                          retraite: 'Épargne retraite',
                          total: 'Total PEG',
                        }
                        return labels[value] ?? value
                      }}
                    />
                    <Bar dataKey="salariale" stackId="peg" fill={accountColor} opacity={0.85} radius={[0, 0, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="retraite" stackId="peg" fill="#FFAB2E" opacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={28} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#fff"
                      strokeWidth={1.5}
                      strokeOpacity={0.5}
                      dot={{ r: 3, fill: '#fff', fillOpacity: 0.7, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#fff', strokeWidth: 0 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : null}

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

          {/* ── Livret A — taux · inflation · rendement réel 2020–2026 ── */}
          {isLivretChart && livretReelData ? (
            <>
              {/* ComposedChart : barres taux + ligne inflation + ligne rendement réel */}
              <div style={{ padding: '16px 8px 4px 4px' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={livretReelData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap="20%">
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
                        const taux = payload.find((p) => p.dataKey === 'taux')?.value as number | undefined
                        const inflation = payload.find((p) => p.dataKey === 'inflation')?.value as number | undefined
                        const reel = payload.find((p) => p.dataKey === 'reel')?.value as number | undefined
                        return (
                          <div style={{ background: '#1a1f3a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.32)', minWidth: 175 }}>
                            <p style={{ margin: '0 0 6px', fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{label as string}</p>
                            {taux != null && (
                              <p style={{ margin: '2px 0', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: accountColor }}>
                                Taux Livret A · {taux.toFixed(2)} %
                              </p>
                            )}
                            {inflation != null && (
                              <p style={{ margin: '2px 0', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#FC5A5A' }}>
                                Inflation · {inflation.toFixed(1)} %
                              </p>
                            )}
                            {reel != null && (
                              <p style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: reel >= 0 ? '#2ED47A' : '#FFAB2E', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 4 }}>
                                Rendement réel · {reel >= 0 ? '+' : ''}{reel.toFixed(2)} %
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
                        const labels: Record<string, string> = { taux: 'Taux Livret A', inflation: 'Inflation', reel: 'Rendement réel' }
                        return labels[value] ?? value
                      }}
                    />
                    <Bar dataKey="taux" fill={accountColor} opacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={16} />
                    <Line type="monotone" dataKey="inflation" stroke="#FC5A5A" strokeWidth={2} dot={{ r: 3, fill: '#FC5A5A', strokeWidth: 0 }} activeDot={{ r: 4, fill: '#FC5A5A', strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="reel" stroke="#2ED47A" strokeWidth={2} strokeDasharray="5 2" dot={{ r: 3, fill: '#2ED47A', strokeWidth: 0 }} activeDot={{ r: 4, fill: '#2ED47A', strokeWidth: 0 }} />
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
              {!isLddsChart ? (
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
              ) : null}

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
          ) : isPeaChart && peaData ? (
            <>
              {/* ── ComposedChart : valeur + capital investi + gain/perte ── */}
              <div style={{ padding: '6px 8px 4px 4px' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={peaData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={gradientPeaValeurId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accountColor} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={accountColor} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id={gradientPeaCapitalId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--neutral-400)" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="var(--neutral-400)" stopOpacity={0.01} />
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
                      domain={[peaYMin, peaYMax]}
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 9, fill: 'var(--neutral-400)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const valEntry = payload.find((p) => p.dataKey === 'valeur')
                        const capEntry = payload.find((p) => p.dataKey === 'capitalInvesti')
                        const gainEntry = payload.find((p) => p.dataKey === 'gainPerte')
                        const pctEntry = payload.find((p) => p.dataKey === 'rendementPct')
                        const valeur = valEntry?.value as number | undefined
                        const capital = capEntry?.value as number | undefined
                        const gain = gainEntry?.value as number | undefined
                        const rendPct = pctEntry?.value as number | undefined
                        return (
                          <div style={{
                            background: '#1a1f3a',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.32)',
                            minWidth: 160,
                          }}>
                            <p style={{ margin: '0 0 6px', fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{fmtEtfDate(label as string)}</p>
                            {valeur != null && (
                              <p style={{ margin: '2px 0', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: accountColor }}>
                                Valeur · {fmtEur(valeur)}
                              </p>
                            )}
                            {capital != null && (
                              <p style={{ margin: '2px 0', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.55)' }}>
                                Capital · {fmtEur(capital)}
                              </p>
                            )}
                            {gain != null && (
                              <p style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: gain >= 0 ? '#2ED47A' : '#FC5A5A', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 4 }}>
                                {gain >= 0 ? '+' : ''}{fmtEur(gain)} {rendPct != null ? `· ${rendPct >= 0 ? '+' : ''}${rendPct.toFixed(1)} %` : ''}
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
                        const labels: Record<string, string> = {
                          valeur: 'Valeur portefeuille',
                          capitalInvesti: 'Capital investi',
                          gainPerte: 'Gain / Perte',
                        }
                        return labels[value] ?? value
                      }}
                    />
                    {/* Zone capital investi (référence basse) */}
                    <Area
                      type="stepAfter"
                      dataKey="capitalInvesti"
                      stroke="var(--neutral-300)"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      fill={`url(#${gradientPeaCapitalId})`}
                      dot={false}
                      activeDot={false}
                    />
                    {/* Zone valeur portefeuille (au-dessus/en-dessous du capital) */}
                    <Area
                      type="monotone"
                      dataKey="valeur"
                      stroke={accountColor}
                      strokeWidth={2}
                      fill={`url(#${gradientPeaValeurId})`}
                      dot={false}
                      activeDot={{ r: 4, fill: accountColor, strokeWidth: 0 }}
                    />
                    {/* Ligne gain/perte — axe secondaire transparent via référence zéro */}
                    <ReferenceLine y={peaSyntheseData?.totalContributed ?? 15000} stroke="var(--neutral-200)" strokeDasharray="2 4" strokeWidth={1} />
                  </ComposedChart>
                </ResponsiveContainer>
                <p
                  style={{
                    margin: '2px 20px 8px',
                    fontSize: 9,
                    color: 'var(--neutral-400)',
                    textAlign: 'center',
                    fontStyle: 'italic',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {peaSourceNoteSingleLine}
                </p>
              </div>
            </>
          ) : data ? (
            <>
              {/* Performance strip — Bitcoin */}
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
          ) : null}
          </div>
    </div>
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
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span
          aria-hidden="true"
          style={{
            width: 0,
            height: 0,
            borderTop: '4px solid transparent',
            borderBottom: '4px solid transparent',
            borderLeft: '6px solid var(--neutral-900)',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--neutral-600)',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-semibold)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            marginLeft: 'auto',
            minWidth: 0,
            maxWidth: '55%',
            textAlign: 'right',
            color:
              positive === undefined
                ? 'var(--neutral-900)'
                : positive
                  ? 'var(--color-positive)'
                  : 'var(--color-negative)',
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
          }}
        >
          {value}
        </span>
      </div>
    </div>
  )
}
