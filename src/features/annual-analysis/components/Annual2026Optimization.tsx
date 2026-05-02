/**
 * Annual2026Optimization
 *
 * Propositions d'optimisation visuellement représentées.
 * Angle original vs 2025 :
 *  - Cards « scénario d'économie » avec visualisation impact linéaire
 *  - Vue « potentiel d'épargne » : combien libérer si on réduit chaque bucket
 *  - Barre de progression "horizon annuel"
 */
import type { Budget2026OptimizationScenario } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

type Props = {
  scenarios: Budget2026OptimizationScenario[]
  totalMonthlyBudget: number
  totalSavings: number
}

export function Annual2026Optimization({ scenarios, totalMonthlyBudget, totalSavings }: Props) {
  if (scenarios.length === 0) return null

  const totalOptimizableSavings = scenarios.reduce((s, sc) => s + sc.monthlySaving, 0)
  const totalAnnualPotential = scenarios.reduce((s, sc) => s + sc.annualSaving, 0)

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>

        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)' }}>
            Leviers d'optimisation
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Simulations · Impact mensuel et annuel
          </p>
        </div>

        {/* ── Résumé potentiel global ── */}
        <PotentialSummaryCard
          totalOptimizableSavings={totalOptimizableSavings}
          totalAnnualPotential={totalAnnualPotential}
          currentSavings={totalSavings}
        />

        {/* ── Scénarios individuels ── */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Scénarios par bucket</h3>
          <p style={cardSubStyle}>Simulation réduction sur buckets pilotables</p>

          <div style={{ marginTop: 'var(--space-4)', display: 'grid', gap: 'var(--space-4)' }}>
            {scenarios.map((sc, i) => (
              <OptimizationScenarioRow key={sc.bucket} scenario={sc} index={i} totalMonthly={totalMonthlyBudget} />
            ))}
          </div>
        </div>

        {/* ── Vision annuelle ── */}
        <AnnualVisionCard
          currentSavings={totalSavings * 12}
          potentialExtra={totalAnnualPotential}
          scenarios={scenarios}
        />
      </div>
    </section>
  )
}

// ── Potential Summary ─────────────────────────────────────────────────────────

function PotentialSummaryCard({
  totalOptimizableSavings,
  totalAnnualPotential,
  currentSavings,
}: {
  totalOptimizableSavings: number
  totalAnnualPotential: number
  currentSavings: number
}) {
  const boostPct = currentSavings > 0
    ? ((totalOptimizableSavings / currentSavings) * 100).toFixed(0)
    : '–'

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1A1730 0%, #2D2B6B 100%)',
      borderRadius: 'var(--radius-2xl)',
      padding: 'var(--space-5)',
      boxShadow: '0 8px 28px rgba(91,87,245,0.2)',
      color: 'white',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Déco */}
      <div style={{
        position: 'absolute', top: -40, right: -40, width: 130, height: 130,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(46,212,122,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Potentiel d'optimisation identifié
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
        <div>
          <p style={{ margin: 0, fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Libérable / mois
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#2ED47A', lineHeight: 1 }}>
            {fmt(totalOptimizableSavings)}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
            +{boostPct}% vs épargne actuelle
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Impact sur 12 mois
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#FFAB2E', lineHeight: 1 }}>
            {fmt(totalAnnualPotential)}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
            en appliquant tous les scénarios
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Scenario Row ──────────────────────────────────────────────────────────────

function OptimizationScenarioRow({
  scenario,
  index,
  totalMonthly,
}: {
  scenario: Budget2026OptimizationScenario
  index: number
  totalMonthly: number
}) {
  const impactBarWidth = totalMonthly > 0 ? Math.min(100, (scenario.monthlySaving / totalMonthly) * 100 * 8) : 0

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '12px 1fr', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
        <span style={{ width: 12, height: 12, borderRadius: 3, background: scenario.color, flexShrink: 0, display: 'block', marginTop: 3 }} />

        <div>
          {/* Titre + badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-800)' }}>
              {scenario.bucketLabel}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
              background: `color-mix(in oklab, ${scenario.color} 12%, var(--neutral-0) 88%)`,
              color: scenario.color,
              border: `1px solid color-mix(in oklab, ${scenario.color} 30%, transparent)`,
              borderRadius: 'var(--radius-full)',
              padding: '2px 8px', whiteSpace: 'nowrap',
            }}>
              −{scenario.reductionPct}%
            </span>
          </div>

          {/* Catégories concernées */}
          {scenario.categories.length > 0 ? (
            <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--neutral-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {scenario.categories.join(' · ')}
            </p>
          ) : null}

          {/* Barre d'impact */}
          <div style={{ marginTop: 'var(--space-2)', height: 6, borderRadius: 3, background: 'var(--neutral-100)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${impactBarWidth.toFixed(1)}%`,
              background: scenario.color, borderRadius: 3,
              transition: 'width 0.5s ease',
            }} />
          </div>

          {/* Chiffres */}
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
            <div>
              <p style={{ margin: 0, fontSize: 9, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mensuel</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#2ED47A' }}>
                +{fmt(scenario.monthlySaving)}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 9, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Annuel</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#5B57F5' }}>
                +{fmt(scenario.annualSaving)}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 9, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Budget actuel</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-600)' }}>
                {fmt(scenario.monthlyBudget)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {index < 3 ? (
        <div style={{ marginTop: 'var(--space-4)', height: 1, background: 'var(--neutral-100)' }} />
      ) : null}
    </div>
  )
}

// ── Annual Vision ─────────────────────────────────────────────────────────────

function AnnualVisionCard({
  currentSavings,
  potentialExtra,
  scenarios,
}: {
  currentSavings: number
  potentialExtra: number
  scenarios: Budget2026OptimizationScenario[]
}) {
  const total = currentSavings + potentialExtra
  const currentPct = total > 0 ? (currentSavings / total) * 100 : 0
  const potentialPct = total > 0 ? (potentialExtra / total) * 100 : 0

  return (
    <div style={{
      background: 'color-mix(in oklab, var(--primary-600) 5%, var(--neutral-0) 95%)',
      borderRadius: 'var(--radius-2xl)',
      border: '1px solid color-mix(in oklab, var(--primary-600) 15%, var(--neutral-150) 85%)',
      padding: 'var(--space-5)',
    }}>
      <h3 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--primary-600)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        Vision horizon annuel
      </h3>

      <p style={{ margin: '0 0 var(--space-3)', fontSize: 12, color: 'var(--neutral-600)' }}>
        En appliquant les {scenarios.length} scénarios d'optimisation, votre épargne annuelle pourrait atteindre{' '}
        <strong style={{ color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>{fmt(total)}</strong> sur 12 mois.
      </p>

      {/* Barre comparaison */}
      <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', gap: 2 }}>
        <div style={{ flex: currentPct, background: '#5B57F5', borderRadius: '5px 0 0 5px', minWidth: 0 }} />
        <div style={{ flex: potentialPct, background: '#2ED47A', borderRadius: '0 5px 5px 0', minWidth: 0, opacity: 0.7 }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#5B57F5', display: 'block' }} />
          <span style={{ fontSize: 11, color: 'var(--neutral-600)' }}>Épargne planifiée · {fmt(currentSavings)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--neutral-600)' }}>Potentiel · +{fmt(potentialExtra)}</span>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#2ED47A', opacity: 0.7, display: 'block' }} />
        </div>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--neutral-0)',
  borderRadius: 'var(--radius-2xl)',
  boxShadow: 'var(--shadow-card)',
  border: '1px solid var(--neutral-150)',
  padding: 'var(--space-5)',
}

const cardTitleStyle: React.CSSProperties = {
  margin: 0, fontSize: 'var(--font-size-base)',
  fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)',
}

const cardSubStyle: React.CSSProperties = {
  margin: '3px 0 0', fontSize: 'var(--font-size-xs)',
  color: 'var(--neutral-400)', textTransform: 'uppercase',
  letterSpacing: '0.05em', fontWeight: 600,
}
