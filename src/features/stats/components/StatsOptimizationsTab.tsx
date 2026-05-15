import { useOptimizationCapacity } from '@/features/stats/hooks/useOptimizationCapacity'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import {
  EmptyState,
  HeroMetricCard,
  SectionHeader,
  SkeletonCard,
  StatsSection,
  StatusBadge,
  SurfaceCard,
  asFiniteNumber,
  formatEuro,
  formatEuroPerMonth,
} from '@/features/stats/components/ui'
const OPTIMIZATION_YEAR = 2026

function resolveScenarioType(scenarioLabel: string | null | undefined): 'prudent' | 'realiste' | 'ambitieux' | 'other' {
  const normalized = (scenarioLabel ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (normalized.includes('prudent')) return 'prudent'
  if (normalized.includes('realiste')) return 'realiste'
  if (normalized.includes('ambitieux')) return 'ambitieux'
  return 'other'
}

function resolveOptimizationLeverIconKey(categoryName: string | null | undefined): string | null {
  const normalized = (categoryName ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

  if (!normalized) return null
  if (normalized.includes('retrait') && normalized.includes('espece')) return 'achats_divers_retrait_d_especes'
  if (normalized.includes('petits achats alimentaires')) return 'alimentation_petits_achats_alimentaires'
  if (normalized.includes('cafe') && normalized.includes('bar')) return 'sorties_cafe_bars'
  if (normalized.includes('restaurant')) return 'sorties_restaurant'
  if (normalized.includes('courses')) return 'alimentation_courses'
  if (normalized.includes('e-commerce')) return 'achats_divers_e_commerce'
  if (normalized.includes('vetement')) return 'achats_divers_vetements'
  return null
}

export function StatsOptimizationsTab() {
  const { data, isLoading, error } = useOptimizationCapacity(OPTIMIZATION_YEAR)

  const annualSummary = data?.annual_summary ?? null
  const monthlyForecast = data?.monthly_forecast ?? []
  const optimizationLevers = data?.optimization_levers ?? []
  const scenarios = data?.scenarios ?? []

  const displayedLevers = optimizationLevers.slice(0, 8)

  const grossSavingsCapacityFromForecast = monthlyForecast.reduce<number | null>((sum, row) => {
    const income = asFiniteNumber(row.projected_income)
    const expenses = asFiniteNumber(row.projected_non_savings_expenses)
    if (income == null || expenses == null) return sum
    const delta = income - expenses
    return sum == null ? delta : sum + delta
  }, null)

  const grossSavingsCapacityTotal = grossSavingsCapacityFromForecast
    ?? asFiniteNumber(annualSummary?.gross_savings_capacity_total)
    ?? null
  const plannedSavingsTotal = asFiniteNumber(annualSummary?.planned_savings_total) ?? null
  const additionalCapacityTotal = asFiniteNumber(annualSummary?.additional_capacity_after_planned_savings_total) ?? null
  const finalSavingsObjective = plannedSavingsTotal != null && additionalCapacityTotal != null
    ? plannedSavingsTotal + additionalCapacityTotal
    : null
  const optimizationFocusItems = [
    {
      label: "Retraits d'espèces",
      iconKey: 'achats_divers_retrait_d_especes',
      match: (name: string) => name.includes('retrait') && name.includes('espece'),
    },
    {
      label: 'Petits achats alimentaires',
      iconKey: 'alimentation_petits_achats_alimentaires',
      match: (name: string) => name.includes('petits achats alimentaires'),
    },
    {
      label: 'Café / bars',
      iconKey: 'sorties_cafe_bars',
      match: (name: string) => name.includes('cafe') && name.includes('bar'),
    },
  ] as const

  const focusRows = optimizationFocusItems.map((item) => {
    const matched = optimizationLevers.find((lever) => {
      const normalized = (lever.category_name ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
      return item.match(normalized)
    })
    return {
      ...item,
      value: formatEuro(matched?.avg_monthly_amount_6m ?? null),
    }
  })

  return (
    <>
      {isLoading ? (
        <StatsSection style={{ gap: 'var(--space-3)' }}>
          <SkeletonCard heightClass="h-28" lines={2} />
          <SkeletonCard heightClass="h-52" lines={0} />
          <SkeletonCard heightClass="h-44" lines={0} />
          <SkeletonCard heightClass="h-36" lines={0} />
        </StatsSection>
      ) : null}

      {!isLoading && error ? (
        <StatsSection>
          <EmptyState message="Impossible de charger les données d’optimisation." />
        </StatsSection>
      ) : null}

      {!isLoading && !error && !data ? (
        <StatsSection>
          <EmptyState message="Aucune donnée d’optimisation disponible." />
        </StatsSection>
      ) : null}

      {!isLoading && !error && data ? (
        <StatsSection style={{ gap: 'var(--space-4)' }}>
          <HeroMetricCard
            title="Montant des optimisations YTD"
            value="360€ (+1,3%)"
            tone="info"
            metrics={[
              {
                label: 'Capacité épargne brute',
                value: formatEuro(grossSavingsCapacityTotal),
              },
              {
                label: 'Épargne planifiée',
                value: formatEuro(plannedSavingsTotal),
              },
              {
                label: 'Obj. optimisation 2026',
                value: '+3450€ (+XX€)',
              },
              {
                label: 'Obj. épargne finale',
                value: finalSavingsObjective != null ? formatEuro(finalSavingsObjective) : '—',
                valueTone: 'warning',
              },
            ]}
          />

          <SurfaceCard tone="info" padding="var(--space-3)">
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--primary-700)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Top 3 dépenses à optimiser - Situation mai 2026
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-2)' }}>
                {focusRows.map((row) => (
                  <div key={row.label} style={{ minWidth: 0, display: 'grid', justifyItems: 'center', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <CategoryIcon iconKey={row.iconKey} label={row.label} size={16} />
                      <p style={{ margin: 0, fontSize: '10px', color: 'var(--neutral-600)' }}>{row.label}</p>
                    </div>
                    <p style={{ margin: 0, marginTop: '2px', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard tone="neutral" padding="var(--space-4)">
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <SectionHeader title="Scénarios" subtitle="Prudent, réaliste, ambitieux" />

              <div style={{ display: 'grid', gap: 'var(--space-2)', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                {[
                  { key: 'prudent', label: 'Prudent' },
                  { key: 'realiste', label: 'Réaliste' },
                  { key: 'ambitieux', label: 'Ambitieux' },
                ].map((expected) => {
                  const scenario = scenarios.find((item) => resolveScenarioType(item.scenario_label) === expected.key)
                    ?? (expected.key === 'realiste'
                      ? scenarios.find((item) => resolveScenarioType(item.scenario_label) === 'other') ?? null
                      : null)

                  const isHighlighted = expected.key === 'realiste'

                  return (
                    <article
                      key={expected.key}
                      style={{
                        borderRadius: 'var(--radius-md)',
                        border: isHighlighted
                          ? '1px solid color-mix(in oklab, var(--primary-500) 30%, var(--neutral-0) 70%)'
                          : '1px solid var(--neutral-150)',
                        background: isHighlighted
                          ? 'color-mix(in oklab, var(--primary-500) 8%, var(--neutral-0) 92%)'
                          : 'var(--neutral-0)',
                        padding: '10px',
                        display: 'grid',
                        gap: '2px',
                        minWidth: 0,
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '10px', color: isHighlighted ? 'var(--primary-700)' : 'var(--neutral-600)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {expected.label}
                      </p>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>
                        {formatEuroPerMonth(scenario?.monthly_gain ?? null)}
                      </p>
                      <p style={{ margin: 0, fontSize: '10px', color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>
                        Scope: {formatEuro(scenario?.projected_gain_on_scope ?? null)}
                      </p>
                    </article>
                  )
                })}
              </div>
            </div>
          </SurfaceCard>

          <StatsSection>
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <div
                aria-hidden="true"
                style={{
                  height: 2,
                  width: '100%',
                  background: 'var(--neutral-900)',
                  borderRadius: 'var(--radius-full)',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: '8px solid transparent',
                    borderBottom: '8px solid transparent',
                    borderLeft: '14px solid var(--neutral-900)',
                    flexShrink: 0,
                  }}
                />
                <h3
                  style={{
                    margin: 0,
                    fontSize: 'clamp(24px, 5.2vw, 30px)',
                    lineHeight: 1.05,
                    fontWeight: 'var(--font-weight-extrabold)',
                    color: 'var(--neutral-900)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Postes optimisables
                </h3>
              </div>
            </div>
          </StatsSection>

          <SurfaceCard tone="neutral" padding="var(--space-4)">
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <SectionHeader title="Priorités de dépenses" subtitle="6 à 8 leviers prioritaires" />

              {displayedLevers.length === 0 ? (
                <EmptyState message="Aucun levier d’optimisation disponible." />
              ) : (
                displayedLevers.map((lever, index) => (
                  <article key={`${lever.category_name ?? ''}-${index}`} style={{ border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <CategoryIcon
                          iconKey={resolveOptimizationLeverIconKey(lever.category_name)}
                          label={lever.category_name ?? 'Poste'}
                          size={26}
                        />
                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                          {lever.category_name ?? '—'}
                        </p>
                      </div>
                      <StatusBadge label={lever.budget_bucket ?? '—'} tone="neutral" />
                    </div>

                    <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>
                      {lever.parent_category_name ?? '—'}
                    </p>

                    <div style={{ display: 'grid', gap: 'var(--space-1)', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Dépense moyenne 6 mois</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>{formatEuro(lever.avg_monthly_amount_6m)}</p>

                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Gain réaliste / mois</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-positive)' }}>{formatEuro(lever.realistic_monthly_gain)}</p>

                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Gain réaliste / an</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--primary-700)' }}>{formatEuro(lever.realistic_annual_gain)}</p>
                    </div>

                    <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-600)' }}>
                      {lever.optimization_comment ?? '—'}
                    </p>
                  </article>
                ))
              )}
            </div>
          </SurfaceCard>

        </StatsSection>
      ) : null}
    </>
  )
}
