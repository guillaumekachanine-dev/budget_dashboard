import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useAnnual2026Analysis } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { useAnnualProjectionOverview2026 } from '@/features/annual-analysis/hooks/useAnnualProjectionOverview2026'
import { useBudgetRevenueAnalytics } from '@/features/budget/hooks/useBudgetRevenueAnalytics'
import { formatCurrencyRounded as fmt } from '@/lib/utils'
import { getMonthShortLabel } from '@/features/annual-analysis/components/_constants'

// ─── Types ────────────────────────────────────────────────────────────────────

type DisplayMode = 'depenses' | 'revenus'

const CYAN = '#0EA5C3'

type CalcStep = { label: string; value: number | null }

type CalcModalConfig = {
  title: string
  subtitle: string
  steps: CalcStep[]
  totalLabel: string
  totalValue: number | null
  note: string
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DarkToggle({ mode, onChange }: { mode: DisplayMode; onChange: (m: DisplayMode) => void }) {
  function btn(active: boolean): React.CSSProperties {
    return {
      border: active ? '1.5px solid rgba(255,255,255,0.30)' : '1.5px solid transparent',
      background: active ? 'rgba(255,255,255,0.16)' : 'transparent',
      color: active ? '#fff' : 'rgba(255,255,255,0.45)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-2) var(--space-4)',
      fontSize: 'var(--font-size-sm)',
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all var(--transition-base)',
      minHeight: 34,
      textAlign: 'center' as const,
    }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 3,
      background: 'rgba(255,255,255,0.07)',
      borderRadius: 'var(--radius-md)',
      padding: '3px',
      width: 224,
    }}>
      <button type="button" onClick={() => onChange('depenses')} style={btn(mode === 'depenses')}>Dépenses</button>
      <button type="button" onClick={() => onChange('revenus')} style={btn(mode === 'revenus')}>Revenus</button>
    </div>
  )
}

function DarkKpiCard({
  accentColor,
  cardBg,
  borderColor,
  title,
  subAmount,
  subLabel,
  amount,
  caption,
  onClick,
}: {
  accentColor: string
  cardBg: string
  borderColor: string
  title: string
  subAmount?: number | null
  subLabel?: string
  amount: number | null
  caption: string
  onClick?: () => void
}) {
  const TAG = onClick ? 'button' : 'div'
  return (
    <TAG
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        background: cardBg,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3)',
        border: `1px solid ${borderColor}`,
        textAlign: 'left' as const,
        width: '100%',
        cursor: onClick ? 'pointer' : undefined,
        transition: 'filter 140ms ease',
      } as React.CSSProperties}
    >
      <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.07em', lineHeight: 1.2 }}>
        {title}
      </p>
      {subAmount != null && subLabel ? (
        <p style={{ margin: '0 0 2px', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.42)' }}>
          {fmt(subAmount)} {subLabel}
        </p>
      ) : null}
      <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-base)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#FFFFFF', lineHeight: 1 }}>
        {amount != null ? fmt(amount) : '—'}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>
        {caption}
      </p>
    </TAG>
  )
}

function SummaryRow({
  label,
  amount,
  pct,
  positiveIsGood = false,
}: {
  label: string
  amount: number | null
  pct: number | null
  positiveIsGood?: boolean
}) {
  const isGood = pct == null ? null : (positiveIsGood ? pct > 0 : pct < 0)
  const amountColor = '#fff'
  const pillText = isGood == null ? null : isGood ? 'rgba(46,212,122,0.9)' : 'rgba(252,90,90,0.85)'
  const pillBg = isGood == null ? null : isGood ? 'rgba(46,212,122,0.12)' : 'rgba(252,90,90,0.12)'
  const arrow = pct == null ? '' : pct > 0 ? '▲' : '▼'

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: amountColor, whiteSpace: 'nowrap' }}>
          {amount != null ? fmt(amount) : '—'}
        </span>
        {pct != null && pillText && pillBg ? (
          <span style={{ fontSize: 10, fontWeight: 700, color: pillText, background: pillBg, borderRadius: 'var(--radius-full)', padding: '2px 7px', whiteSpace: 'nowrap' }}>
            {arrow} {Math.abs(pct).toFixed(1)}%
          </span>
        ) : null}
      </div>
    </div>
  )
}

function CalcModal({ config, onClose }: { config: CalcModalConfig | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {config && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(13,13,31,0.52)' }}
          />
          <motion.div
            key="modal"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: 'var(--page-gutter)',
              right: 'var(--page-gutter)',
              top: '25vh',
              zIndex: 81,
              maxWidth: 340,
              margin: '0 auto',
              background: 'var(--neutral-0)',
              borderRadius: 'var(--radius-2xl)',
              padding: 'var(--space-5)',
              boxShadow: '0 12px 48px rgba(13,13,31,0.22)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 'var(--space-1)' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--neutral-900)', lineHeight: 1.2 }}>
                {config.title}
              </h3>
              <button
                type="button"
                onClick={onClose}
                style={{ border: 'none', background: 'var(--neutral-100)', color: 'var(--neutral-600)', width: 30, height: 30, borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <X size={13} />
              </button>
            </div>
            <p style={{ margin: '0 0 var(--space-3)', fontSize: 11, color: 'var(--neutral-500)', fontWeight: 500, lineHeight: 1.3 }}>
              {config.subtitle}
            </p>
            <div style={{ height: 2, background: 'linear-gradient(90deg, var(--primary-400) 0%, var(--primary-200) 100%)', borderRadius: 2, marginBottom: 'var(--space-3)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              {config.steps.map((step, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 'var(--radius-full)', border: '1.5px solid var(--primary-300)', color: 'var(--primary-600)', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {idx + 1}
                  </span>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--neutral-700)', fontWeight: 500, lineHeight: 1.3 }}>{step.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-800)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                    {step.value != null ? fmt(step.value) : '—'}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ height: 1, borderTop: '1.5px dashed var(--neutral-200)', marginBottom: 'var(--space-3)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-4)' }}>
              <span style={{ width: 20, textAlign: 'center', fontSize: 14, fontWeight: 800, color: CYAN, flexShrink: 0 }}>=</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)' }}>{config.totalLabel}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: CYAN, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                {config.totalValue != null ? fmt(config.totalValue) : '—'}
              </span>
            </div>
            <p style={{ margin: '0 0 var(--space-4)', fontSize: 11, color: 'var(--neutral-500)', lineHeight: 1.5 }}>{config.note}</p>
            <button type="button" onClick={onClose} style={{ width: '100%', padding: '12px var(--space-4)', background: 'color-mix(in oklab, var(--primary-300) 55%, var(--neutral-0) 45%)', border: 'none', borderRadius: 'var(--radius-xl)', color: 'var(--neutral-900)', fontSize: 'var(--font-size-sm)', fontWeight: 700, cursor: 'pointer' }}>
              Fermer
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectionsTabContent() {
  const [mode, setMode] = useState<DisplayMode>('depenses')
  const [activeModal, setActiveModal] = useState<CalcModalConfig | null>(null)

  const { summary, categories } = useAnnual2026Analysis()
  const { data: projection } = useAnnualProjectionOverview2026(2026)
  const { data: revenueData } = useBudgetRevenueAnalytics()

  const now = new Date()
  const ytdMonths = summary?.ytdMonths ?? Math.min(now.getMonth() + 1, 12)
  const remainingMonths = 12 - ytdMonths
  const currentMonthLabel = getMonthShortLabel(ytdMonths)

  // ── Dépenses ────────────────────────────────────────────────────────────────

  const consumedYtd = useMemo(
    () => categories.reduce((sum, cat) => sum + cat.ytdActual, 0),
    [categories],
  )
  const budgetYtd = summary?.ytdBudgetTotal ?? 0
  const annualBudget = summary ? summary.totalMonthlyBudget * 12 : 0
  const projectedTotal = projection?.projectedTotalExpensesAmount ?? null
  const avgMonthlyConsumed = ytdMonths > 0 ? consumedYtd / ytdMonths : 0
  const projectedFromAvg = consumedYtd + avgMonthlyConsumed * remainingMonths

  const gapYtdPct = budgetYtd > 0 ? ((consumedYtd - budgetYtd) / budgetYtd) * 100 : null
  const gapAnnualPct = projectedTotal != null && annualBudget > 0
    ? ((projectedTotal - annualBudget) / annualBudget) * 100
    : null

  // ── Revenus ─────────────────────────────────────────────────────────────────

  const revenueMetrics = useMemo(() => {
    if (!revenueData) {
      return {
        ytdRevenue: null, avgMonthly6m: null, scenario1: null, scenario2: null,
        gapRevYtdVs2025Pct: null, gapS2Vs2025TotalPct: null, ytd2025SamePeriod: null,
      }
    }

    const series2026 = revenueData.monthlySeries.filter(p => p.month_start.startsWith('2026'))
    const series2025 = revenueData.monthlySeries.filter(p => p.month_start.startsWith('2025'))

    const ytd = series2026.reduce((sum, p) => sum + p.revenue_amount, 0)
    const avg = revenueData.avgMonthlyRevenueLast6M
    const s1 = projection?.projectedRevenueAmount ?? null
    const s2 = ytd > 0 && ytdMonths > 0 ? ytd + (ytd / ytdMonths) * remainingMonths : null

    const ytd2025SamePeriod = series2025.slice(0, ytdMonths).reduce((sum, p) => sum + p.revenue_amount, 0)
    const total2025Revenue = series2025.reduce((sum, p) => sum + p.revenue_amount, 0)

    const gapRevYtdVs2025Pct = ytd2025SamePeriod > 0 ? ((ytd - ytd2025SamePeriod) / ytd2025SamePeriod) * 100 : null
    const gapS2Vs2025TotalPct = s2 != null && total2025Revenue > 0 ? ((s2 - total2025Revenue) / total2025Revenue) * 100 : null

    return { ytdRevenue: ytd, avgMonthly6m: avg, scenario1: s1, scenario2: s2, gapRevYtdVs2025Pct, gapS2Vs2025TotalPct, ytd2025SamePeriod }
  }, [revenueData, projection, ytdMonths, remainingMonths])

  const { ytdRevenue, avgMonthly6m, scenario1, scenario2, gapRevYtdVs2025Pct, gapS2Vs2025TotalPct, ytd2025SamePeriod } = revenueMetrics

  // ── Modal configs ────────────────────────────────────────────────────────────

  const MODAL_CONSOMME: CalcModalConfig = {
    title: 'Consommé YTD · 2026',
    subtitle: `Dépenses réelles Jan–${currentMonthLabel} (${ytdMonths} mois)`,
    steps: [
      { label: `Dépenses réelles Jan–${currentMonthLabel}`, value: consumedYtd },
      { label: 'Mois écoulés', value: ytdMonths },
      { label: 'Moyenne mensuelle réelle', value: avgMonthlyConsumed },
    ],
    totalLabel: 'Total consommé YTD',
    totalValue: consumedYtd,
    note: 'Somme des dépenses réelles sur tous les mois écoulés depuis le 1er janvier 2026, toutes catégories confondues.',
  }

  const MODAL_BUDGET_YTD: CalcModalConfig = {
    title: 'Budget YTD · 2026',
    subtitle: `Budget mensuel 2026 × ${ytdMonths} mois écoulés`,
    steps: [
      { label: 'Budget mensuel 2026', value: summary?.totalMonthlyBudget ?? null },
      { label: `× ${ytdMonths} mois écoulés (Jan–${currentMonthLabel})`, value: budgetYtd },
    ],
    totalLabel: 'Budget théorique YTD',
    totalValue: budgetYtd,
    note: 'Budget théorique cumulé sur les mois écoulés. Compare le rythme réel au plan budgétaire mensuel.',
  }

  const MODAL_PROJECTION: CalcModalConfig = {
    title: 'Projection fin 2026',
    subtitle: `YTD réel + rythme moyen × ${remainingMonths} mois restants`,
    steps: [
      { label: `Consommé réel Jan–${currentMonthLabel} (${ytdMonths} mois)`, value: consumedYtd },
      { label: 'Moyenne mensuelle réelle', value: avgMonthlyConsumed },
      { label: `Projection ${remainingMonths} mois restants`, value: avgMonthlyConsumed * remainingMonths },
    ],
    totalLabel: 'Projection fin d\'année',
    totalValue: projectedTotal ?? projectedFromAvg,
    note: 'Projection basée sur le rythme de dépenses réel. La vue SQL peut utiliser une médiane pour neutraliser les mois exceptionnels.',
  }

  const MODAL_BUDGET_ANNUEL: CalcModalConfig = {
    title: 'Budget annuel 2026',
    subtitle: 'Budget mensuel 2026 × 12 mois',
    steps: [
      { label: 'Budget mensuel 2026', value: summary?.totalMonthlyBudget ?? null },
      { label: '× 12 mois', value: annualBudget },
    ],
    totalLabel: 'Budget annuel 2026',
    totalValue: annualBudget,
    note: 'Enveloppe budgétaire totale prévue pour l\'année 2026, calculée sur la base du budget mensuel défini.',
  }

  const MODAL_REVENUS_YTD: CalcModalConfig = {
    title: 'Revenus YTD · 2026',
    subtitle: `Revenus encaissés Jan–${currentMonthLabel} (${ytdMonths} mois)`,
    steps: [
      { label: `Revenus réels Jan–${currentMonthLabel}`, value: ytdRevenue },
      { label: `Revenus 2025 même période (${ytdMonths} mois)`, value: ytd2025SamePeriod },
      { label: 'Écart vs 2025', value: ytdRevenue != null && ytd2025SamePeriod != null ? ytdRevenue - ytd2025SamePeriod : null },
    ],
    totalLabel: 'Total revenus YTD',
    totalValue: ytdRevenue,
    note: 'Somme des revenus encaissés depuis le 1er janvier 2026, comparée à la même période en 2025.',
  }

  const MODAL_MOY_REVENUS: CalcModalConfig = {
    title: 'Moyenne mensuelle des revenus',
    subtitle: 'Moyenne calculée sur les 6 derniers mois',
    steps: [
      { label: 'Revenus cumulés (6 derniers mois)', value: avgMonthly6m != null ? avgMonthly6m * 6 : null },
      { label: 'Nombre de mois', value: 6 },
      { label: 'Moyenne mensuelle résultante', value: avgMonthly6m },
    ],
    totalLabel: 'Moyenne mensuelle (6M)',
    totalValue: avgMonthly6m,
    note: 'Moyenne des 6 derniers mois de revenus pour lisser les mois atypiques (bonus exceptionnels, etc.).',
  }

  const MODAL_SCENARIO1: CalcModalConfig = {
    title: 'Scénario 1 — Revenus projetés',
    subtitle: 'Projection annuelle via vue SQL',
    steps: [
      { label: `Revenus Jan–${currentMonthLabel} (${ytdMonths} mois)`, value: ytdRevenue },
      { label: `Projection ${remainingMonths} mois restants (SQL)`, value: scenario1 != null && ytdRevenue != null ? scenario1 - ytdRevenue : null },
    ],
    totalLabel: 'Revenus projetés fin 2026',
    totalValue: scenario1,
    note: 'Projection basée sur la vue SQL. Peut utiliser la médiane ou un rythme 6M pour estimer les mois restants.',
  }

  const MODAL_SCENARIO2: CalcModalConfig = {
    title: 'Scénario 2 — Projection haute',
    subtitle: 'Extrapolation pure du rythme YTD 2026',
    steps: [
      { label: `Revenus YTD réels (${ytdMonths} mois)`, value: ytdRevenue },
      { label: `Moyenne YTD (÷ ${ytdMonths} mois)`, value: ytdRevenue != null && ytdMonths > 0 ? ytdRevenue / ytdMonths : null },
      { label: `× ${remainingMonths} mois restants`, value: ytdRevenue != null && ytdMonths > 0 ? (ytdRevenue / ytdMonths) * remainingMonths : null },
    ],
    totalLabel: 'Projection haute fin 2026',
    totalValue: scenario2,
    note: 'Projection optimiste basée uniquement sur le rythme YTD 2026, sans correction ni régression.',
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '0 var(--page-gutter)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

      <h2 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--neutral-900)', letterSpacing: '-0.01em' }}>
        Projection annuelle globale
      </h2>

      {/* Dark navy container — same design language as "projections annuelles comparées" */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1c4a 0%, #2d2a6e 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-5)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}>
        {/* Subtle radial glow */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 80% 20%, rgba(91,87,245,0.25) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Toggle — inside the frame, centered at top */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <DarkToggle mode={mode} onChange={setMode} />
        </div>

        {/* 2×2 card grid */}
        {mode === 'depenses' ? (
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <DarkKpiCard
              accentColor="rgba(252,90,90,0.9)"
              cardBg="rgba(252,90,90,0.10)"
              borderColor="rgba(252,90,90,0.20)"
              title="2026 · Consommé YTD"
              amount={consumedYtd}
              caption={`Jan–${currentMonthLabel} · ${ytdMonths} mois`}
              onClick={() => setActiveModal(MODAL_CONSOMME)}
            />
            <DarkKpiCard
              accentColor="rgba(91,87,245,0.9)"
              cardBg="rgba(91,87,245,0.10)"
              borderColor="rgba(91,87,245,0.22)"
              title="2026 · Budget YTD"
              amount={budgetYtd}
              caption={`objectif ${ytdMonths} mois`}
              onClick={() => setActiveModal(MODAL_BUDGET_YTD)}
            />
            <DarkKpiCard
              accentColor="rgba(255,171,46,0.9)"
              cardBg="rgba(255,171,46,0.10)"
              borderColor="rgba(255,171,46,0.22)"
              title="2026 · Projection"
              subAmount={consumedYtd}
              subLabel="YTD"
              amount={projectedTotal ?? projectedFromAvg}
              caption="projeté fin d'année"
              onClick={() => setActiveModal(MODAL_PROJECTION)}
            />
            <DarkKpiCard
              accentColor="rgba(76,201,240,0.9)"
              cardBg="rgba(76,201,240,0.10)"
              borderColor="rgba(76,201,240,0.22)"
              title="2026 · Budget Annuel"
              subAmount={summary?.totalMonthlyBudget ?? null}
              subLabel="/mois"
              amount={annualBudget}
              caption="enveloppe annuelle"
              onClick={() => setActiveModal(MODAL_BUDGET_ANNUEL)}
            />
          </div>
        ) : (
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <DarkKpiCard
              accentColor="rgba(99,241,171,0.95)"
              cardBg="rgba(46,212,122,0.12)"
              borderColor="rgba(99,241,171,0.22)"
              title="2026 · Revenus YTD"
              subAmount={ytd2025SamePeriod}
              subLabel="en 2025"
              amount={ytdRevenue}
              caption={`Jan–${currentMonthLabel} · ${ytdMonths} mois`}
              onClick={() => setActiveModal(MODAL_REVENUS_YTD)}
            />
            <DarkKpiCard
              accentColor="rgba(255,171,46,0.9)"
              cardBg="rgba(255,171,46,0.10)"
              borderColor="rgba(255,171,46,0.20)"
              title="2026 · Moy. mensuelle"
              amount={avgMonthly6m}
              caption="6 derniers mois"
              onClick={() => setActiveModal(MODAL_MOY_REVENUS)}
            />
            <DarkKpiCard
              accentColor="rgba(76,201,240,0.9)"
              cardBg="rgba(76,201,240,0.11)"
              borderColor="rgba(76,201,240,0.20)"
              title="2026 · Scénario 1"
              subAmount={ytdRevenue}
              subLabel="YTD"
              amount={scenario1}
              caption="projection SQL"
              onClick={() => setActiveModal(MODAL_SCENARIO1)}
            />
            <DarkKpiCard
              accentColor="rgba(180,140,255,0.9)"
              cardBg="rgba(150,120,230,0.10)"
              borderColor="rgba(180,140,255,0.20)"
              title="2026 · Scénario 2"
              subAmount={ytdRevenue}
              subLabel="YTD"
              amount={scenario2}
              caption="rythme YTD · optimiste"
              onClick={() => setActiveModal(MODAL_SCENARIO2)}
            />
          </div>
        )}

        {/* Summary rows — separated by a divider line, same pattern as ComparedVelocityCard */}
        <div style={{
          position: 'relative',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          paddingTop: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {mode === 'depenses' ? (
            <>
              <SummaryRow
                label="Dépenses YTD 2026"
                amount={consumedYtd}
                pct={gapYtdPct}
                positiveIsGood={false}
              />
              <SummaryRow
                label="Projection dépenses 2026"
                amount={projectedTotal ?? projectedFromAvg}
                pct={gapAnnualPct}
                positiveIsGood={false}
              />
            </>
          ) : (
            <>
              <SummaryRow
                label="Revenus YTD 2026"
                amount={ytdRevenue}
                pct={gapRevYtdVs2025Pct}
                positiveIsGood={true}
              />
              <SummaryRow
                label="Projection haute revenus 2026"
                amount={scenario2}
                pct={gapS2Vs2025TotalPct}
                positiveIsGood={true}
              />
            </>
          )}
        </div>
      </div>

      <h2 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--neutral-900)', letterSpacing: '-0.01em' }}>
        Projection coûts annuels
      </h2>

      <CalcModal config={activeModal} onClose={() => setActiveModal(null)} />
    </div>
  )
}
