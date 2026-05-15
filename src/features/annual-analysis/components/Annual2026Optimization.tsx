import { useState } from 'react'
import type { Budget2026OptimizationScenario } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import {
  CompactStatGrid,
  DataQualityNotice,
  SectionHeader,
  StatsSection,
  StatusBadge,
  SurfaceCard,
  formatEuro,
} from '@/features/stats/components/ui'

type Props = {
  scenarios: Budget2026OptimizationScenario[]
  totalMonthlyBudget: number
  totalSavings: number
}

export function Annual2026Optimization({ scenarios, totalMonthlyBudget, totalSavings }: Props) {
  const [showDetailedScenarios, setShowDetailedScenarios] = useState(false)
  if (scenarios.length === 0) return null

  const totalAnnualPotential = scenarios.reduce((sum, scenario) => sum + scenario.annualSaving, 0)

  const annualCurrentSavings = totalSavings * 12
  const projectedAnnualSavings = annualCurrentSavings + totalAnnualPotential

  const currentShare = projectedAnnualSavings > 0 ? (annualCurrentSavings / projectedAnnualSavings) * 100 : 0
  const potentialShare = projectedAnnualSavings > 0 ? (totalAnnualPotential / projectedAnnualSavings) * 100 : 0

  return (
    <StatsSection>
      <SurfaceCard tone="neutral" padding="var(--space-4)">
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <button
            type="button"
            onClick={() => setShowDetailedScenarios((current) => !current)}
            aria-expanded={showDetailedScenarios}
            style={{
              border: '1px solid var(--neutral-200)',
              background: 'var(--neutral-0)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>Détails des leviers</p>
              <p style={{ margin: '3px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Scénarios par bucket · Vision horizon annuel</p>
            </div>
            <StatusBadge label={showDetailedScenarios ? 'Masquer' : 'Afficher'} tone="info" />
          </button>

          {showDetailedScenarios ? (
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <SurfaceCard tone="neutral" padding="var(--space-3)">
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  <SectionHeader title="Scénarios par bucket" subtitle="Simulation de réduction sur buckets pilotables" />
                  {scenarios.map((scenario, index) => {
                    const impactBarWidth = totalMonthlyBudget > 0 ? Math.min(100, (scenario.monthlySaving / totalMonthlyBudget) * 100 * 8) : 0

                    return (
                      <article key={`${scenario.bucket}-${index}`} style={{ border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 3, background: scenario.color, flexShrink: 0 }} />
                            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                              {scenario.bucketLabel}
                            </p>
                          </div>
                          <StatusBadge label={`-${scenario.reductionPct}%`} tone="warning" />
                        </div>

                        {scenario.categories.length > 0 ? (
                          <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', overflowWrap: 'anywhere' }}>
                            {scenario.categories.join(' · ')}
                          </p>
                        ) : null}

                        <div style={{ height: 7, borderRadius: 4, background: 'var(--neutral-100)', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${impactBarWidth.toFixed(1)}%`,
                              background: scenario.color,
                              borderRadius: 4,
                              transition: 'width var(--transition-base)',
                            }}
                          />
                        </div>

                        <CompactStatGrid minItemWidth={120}>
                          <div>
                            <p style={{ margin: 0, fontSize: '10px', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mensuel</p>
                            <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-mono)', color: 'var(--color-positive)', fontWeight: 'var(--font-weight-bold)' }}>
                              +{formatEuro(scenario.monthlySaving)}
                            </p>
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: '10px', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Annuel</p>
                            <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-mono)', color: 'var(--primary-700)', fontWeight: 'var(--font-weight-bold)' }}>
                              +{formatEuro(scenario.annualSaving)}
                            </p>
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: '10px', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Budget actuel</p>
                            <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)', fontWeight: 'var(--font-weight-semibold)' }}>
                              {formatEuro(scenario.monthlyBudget)}
                            </p>
                          </div>
                        </CompactStatGrid>
                      </article>
                    )
                  })}
                </div>
              </SurfaceCard>

              <SurfaceCard tone="neutral" padding="var(--space-4)">
                <SectionHeader title="Vision horizon annuel" subtitle="Projection avec tous les scénarios" />
                <p style={{ margin: 'var(--space-2) 0 var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)' }}>
                  En appliquant les {scenarios.length} scénarios d’optimisation, l’épargne annuelle pourrait atteindre{' '}
                  <strong style={{ color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>{formatEuro(projectedAnnualSavings)}</strong>.
                </p>

                <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', gap: 2, marginBottom: 'var(--space-2)' }}>
                  <div style={{ flex: currentShare, background: 'var(--primary-500)', borderRadius: '5px 0 0 5px', minWidth: 0 }} />
                  <div style={{ flex: potentialShare, background: 'var(--color-positive)', borderRadius: '0 5px 5px 0', minWidth: 0, opacity: 0.72 }} />
                </div>

                <div style={{ display: 'grid', gap: '6px' }}>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-600)' }}>
                    Épargne planifiée: {formatEuro(annualCurrentSavings)}
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-600)' }}>
                    Potentiel additionnel: +{formatEuro(totalAnnualPotential)}
                  </p>
                </div>
              </SurfaceCard>
            </div>
          ) : (
            <DataQualityNotice
              title="Section repliée"
              detail="Déplie pour voir les scénarios par bucket et la vision horizon annuel."
              tone="neutral"
            />
          )}
        </div>
      </SurfaceCard>
    </StatsSection>
  )
}
