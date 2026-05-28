import { useMemo, useState } from 'react'
import { useOptimizationCapacity } from '@/features/stats/hooks/useOptimizationCapacity'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import {
  EmptyState,
  SkeletonCard,
  StatsSection,
  StatusBadge,
  formatEuro,
} from '@/features/stats/components/ui'
const OPTIMIZATION_YEAR = 2026
const OPTIMIZATION_CONTENT_MAX_WIDTH = 548
const DEFAULT_REMAINING_MONTHS = 12
const ANNUAL_GAIN_MONTHS = 6
const OPTIMIZED_AMOUNT_COLOR = 'color-mix(in oklab, var(--color-warning) 82%, var(--neutral-900) 18%)'
const OPTIMIZATION_PROGRESS_COLOR = '#036d8b'
const BUCKET_REDUCTION_PCT: Record<string, number> = {
  discretionnaire: 10,
  provision: 8,
  variable_essentielle: 6,
  voyage: 12,
}

type OptimizationBucketImpact = {
  bucketKey: string
  bucketLabel: string
  color: string
  reductionPct: number
  monthlyOptimization: number
  annualOptimization: number
  categories: string[]
  progressPct: number
}

function toNumberOrNull(value: number | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function resolveProgressColor(budgetBucket: string | null | undefined): string {
  void budgetBucket
  return OPTIMIZATION_PROGRESS_COLOR
}

function resolveBucketColor(bucketKey: string): string {
  if (bucketKey.includes('discretion')) return 'var(--color-negative)'
  if (bucketKey.includes('provision')) return 'var(--color-warning)'
  if (bucketKey.includes('variable')) return 'var(--primary-500)'
  if (bucketKey.includes('voyage')) return '#0ea5a0'
  return 'var(--neutral-500)'
}

function normalizeBucketKey(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
}

function resolveBucketLabel(bucketKey: string): string {
  if (!bucketKey) return 'Socle'
  const map: Record<string, string> = {
    socle_fixe: 'Socle fixe',
    variable_essentielle: 'Variable essentielle',
    provision: 'Provision',
    discretionnaire: 'Discrétionnaire',
    voyage: 'Voyage',
  }
  if (map[bucketKey]) return map[bucketKey]
  return bucketKey
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
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

type StatsOptimizationsTabProps = {
  monthlyBudgetByCategory?: Map<string, number>
  monthlyActualByCategory?: Map<string, number>
  selectedMonth?: number | null
  selectedYear?: number
}

function normalizeCategoryKey(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function StatsOptimizationsTab({
  monthlyBudgetByCategory,
  monthlyActualByCategory,
  selectedMonth = null,
  selectedYear = OPTIMIZATION_YEAR,
}: StatsOptimizationsTabProps) {
  const { data, isLoading, error } = useOptimizationCapacity(OPTIMIZATION_YEAR)
  const [expandedLeverKeys, setExpandedLeverKeys] = useState<Set<string>>(() => new Set())
  const [expandedBucketKeys, setExpandedBucketKeys] = useState<Set<string>>(() => new Set())

  const optimizationLevers = data?.optimization_levers ?? []

  const displayedLevers = optimizationLevers.slice(0, 8)
  const elapsedMonthsInYear = useMemo(() => {
    if (selectedYear !== OPTIMIZATION_YEAR) return DEFAULT_REMAINING_MONTHS
    if (selectedMonth == null || selectedMonth < 1 || selectedMonth > 12) return 0
    return selectedMonth
  }, [selectedMonth, selectedYear])
  const bucketImpacts = useMemo<OptimizationBucketImpact[]>(() => {
    const grouped = new Map<string, {
      monthlyOptimization: number
      annualOptimization: number
      budgetTotal: number
      categories: Set<string>
    }>()

    for (const lever of displayedLevers) {
      const bucketKey = normalizeBucketKey(lever.budget_bucket)
      if (!bucketKey) continue
      const monthlyOptimization = Number(lever.realistic_monthly_gain ?? 0)
      const annualOptimization = monthlyOptimization * ANNUAL_GAIN_MONTHS
      const categoryBudget = Number(monthlyBudgetByCategory?.get(normalizeCategoryKey(lever.category_name)) ?? 0)
      const categoryName = (lever.parent_category_name ?? lever.category_name ?? '').trim()

      const existing = grouped.get(bucketKey) ?? {
        monthlyOptimization: 0,
        annualOptimization: 0,
        budgetTotal: 0,
        categories: new Set<string>(),
      }

      existing.monthlyOptimization += Number.isFinite(monthlyOptimization) ? monthlyOptimization : 0
      existing.annualOptimization += Number.isFinite(annualOptimization) ? annualOptimization : 0
      existing.budgetTotal += Number.isFinite(categoryBudget) ? categoryBudget : 0
      if (categoryName) existing.categories.add(categoryName)
      grouped.set(bucketKey, existing)
    }

    return [...grouped.entries()]
      .map(([bucketKey, values]) => {
        const progressPct = values.budgetTotal > 0
          ? Math.max(0, Math.min(100, (values.monthlyOptimization / values.budgetTotal) * 100))
          : 0
        return {
          bucketKey,
          bucketLabel: resolveBucketLabel(bucketKey),
          color: resolveBucketColor(bucketKey),
          reductionPct: BUCKET_REDUCTION_PCT[bucketKey] ?? 0,
          monthlyOptimization: values.monthlyOptimization,
          annualOptimization: values.annualOptimization,
          categories: [...values.categories].slice(0, 3),
          progressPct,
        }
      })
      .sort((a, b) => b.monthlyOptimization - a.monthlyOptimization)
  }, [displayedLevers, monthlyBudgetByCategory])

  const toggleLever = (key: string) => {
    setExpandedLeverKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleBucket = (key: string) => {
    setExpandedBucketKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <>
      {isLoading ? (
        <StatsSection style={{ gap: 'var(--space-3)', maxWidth: OPTIMIZATION_CONTENT_MAX_WIDTH }}>
          <SkeletonCard heightClass="h-28" lines={2} />
          <SkeletonCard heightClass="h-52" lines={0} />
          <SkeletonCard heightClass="h-44" lines={0} />
          <SkeletonCard heightClass="h-36" lines={0} />
        </StatsSection>
      ) : null}

      {!isLoading && error ? (
        <StatsSection style={{ maxWidth: OPTIMIZATION_CONTENT_MAX_WIDTH }}>
          <EmptyState message="Impossible de charger les données d’optimisation." />
        </StatsSection>
      ) : null}

      {!isLoading && !error && !data ? (
        <StatsSection style={{ maxWidth: OPTIMIZATION_CONTENT_MAX_WIDTH }}>
          <EmptyState message="Aucune donnée d’optimisation disponible." />
        </StatsSection>
      ) : null}

      {!isLoading && !error && data ? (
        <StatsSection style={{ gap: 'var(--space-4)', maxWidth: OPTIMIZATION_CONTENT_MAX_WIDTH }}>
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
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
                    fontSize: 'clamp(20px, 4.6vw, 24px)',
                    lineHeight: 1.05,
                    fontWeight: 'var(--font-weight-extrabold)',
                    color: 'var(--neutral-900)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Postes optimisables
                </h3>
              </div>

              {displayedLevers.length === 0 ? (
                <EmptyState message="Aucun levier d’optimisation disponible." />
              ) : (
                displayedLevers.map((lever, index) => {
                  const leverKey = `${normalizeCategoryKey(lever.category_name) || 'poste'}-${index}`
                  const isExpanded = expandedLeverKeys.has(leverKey)
                  return (
                  <article key={leverKey} style={{ padding: 'var(--space-1) 0 var(--space-3)', borderBottom: '1px solid var(--neutral-150)', display: 'grid', gap: 'var(--space-2)' }}>
                    <button
                      type="button"
                      onClick={() => toggleLever(leverKey)}
                      aria-expanded={isExpanded}
                      style={{ border: 'none', padding: 0, margin: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', width: '100%', textAlign: 'left' }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <CategoryIcon
                          iconKey={resolveOptimizationLeverIconKey(lever.category_name)}
                          label={lever.category_name ?? 'Poste'}
                          size={26}
                        />
                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                          {lever.category_name ?? '—'}
                        </p>
                      </span>
                      <StatusBadge label={lever.budget_bucket ?? '—'} tone="neutral" />
                    </button>

                    {isExpanded ? (() => {
                      const categoryBudget = toNumberOrNull(monthlyBudgetByCategory?.get(normalizeCategoryKey(lever.category_name)) ?? null)
                      const categoryActualToDate = toNumberOrNull(monthlyActualByCategory?.get(normalizeCategoryKey(lever.category_name)) ?? null)
                      const monthlyAverage = toNumberOrNull(lever.avg_monthly_amount_6m)
                      const monthlyOptimization = toNumberOrNull(lever.realistic_monthly_gain)
                      const annualOptimization = monthlyOptimization != null
                        ? monthlyOptimization * ANNUAL_GAIN_MONTHS
                        : null
                      const optimizedYtd = monthlyOptimization != null
                        ? monthlyOptimization * elapsedMonthsInYear
                        : null
                      const monthlySpendObjective = categoryBudget != null && monthlyOptimization != null
                        ? Math.max(0, categoryBudget - monthlyOptimization)
                        : null
                      const objectiveReached = categoryActualToDate != null
                        && monthlySpendObjective != null
                        && categoryActualToDate <= monthlySpendObjective
                      const currentMonthProgressPct = categoryActualToDate != null
                        && monthlySpendObjective != null
                        && monthlySpendObjective > 0
                        ? Math.max(0, Math.min(100, (categoryActualToDate / monthlySpendObjective) * 100))
                        : 0
                      const progressBase = categoryBudget != null && categoryBudget > 0
                        ? categoryBudget
                        : monthlyAverage != null && monthlyAverage > 0
                          ? monthlyAverage
                          : null
                      const progressPct = progressBase != null && monthlyOptimization != null
                        ? Math.max(0, Math.min(100, (monthlyOptimization / progressBase) * 100))
                        : 0
                      const progressColor = resolveProgressColor(lever.budget_bucket)

                      return (
                        <>
                        <div style={{ display: 'grid', gap: 'var(--space-1)', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Budget mensuel</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>{formatEuro(categoryBudget)}</p>

                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Dépenses moyennes / mois</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>{formatEuro(monthlyAverage)}</p>

                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Objectif dépenses / mois</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>{formatEuro(monthlySpendObjective)}</p>

                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Optimisation / mois</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-positive)' }}>{formatEuro(monthlyOptimization)}</p>

                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Gain / an</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--primary-700)' }}>{formatEuro(annualOptimization)}</p>
                      <p style={{ margin: '6px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          aria-hidden="true"
                          style={{
                            width: 0,
                            height: 0,
                            borderTop: '4px solid transparent',
                            borderBottom: '4px solid transparent',
                            borderLeft: '6px solid var(--neutral-400)',
                            flexShrink: 0,
                          }}
                        />
                        Mois en cours
                      </p>
                      <p style={{ margin: '6px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textAlign: 'right', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        Objectif
                        <span
                          aria-label={objectiveReached ? 'atteint' : 'non atteint'}
                          title={objectiveReached ? 'atteint' : 'non atteint'}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 14,
                            height: 14,
                            borderRadius: objectiveReached ? 3 : '50%',
                            background: objectiveReached ? 'var(--color-positive)' : 'var(--color-negative)',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 800,
                            lineHeight: 1,
                            verticalAlign: 'middle',
                          }}
                        >
                          {objectiveReached ? '✓' : '✕'}
                        </span>
                      </p>
                        </div>
                        <div style={{ marginTop: '2px', display: 'grid', gap: '6px' }}>
                          <div style={{ height: 10, borderRadius: 'var(--radius-full)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${currentMonthProgressPct}%`,
                                height: '100%',
                                borderRadius: 'var(--radius-full)',
                                background: `linear-gradient(90deg, ${progressColor} 0%, color-mix(in oklab, ${progressColor} 72%, var(--neutral-0) 28%) 100%)`,
                                transition: 'width 360ms ease',
                              }}
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)' }}>Consommé</p>
                              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: OPTIMIZED_AMOUNT_COLOR }}>
                                {formatEuro(categoryActualToDate)}
                              </p>
                            </div>
                            <div style={{ minWidth: 0, textAlign: 'right' }}>
                              <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)' }}>Plafond cible</p>
                              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--primary-600)' }}>
                                {formatEuro(monthlySpendObjective)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gap: 'var(--space-1)', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>

                      <p style={{ margin: '6px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          aria-hidden="true"
                          style={{
                            width: 0,
                            height: 0,
                            borderTop: '4px solid transparent',
                            borderBottom: '4px solid transparent',
                            borderLeft: '6px solid var(--neutral-400)',
                            flexShrink: 0,
                          }}
                        />
                        Optimisé YTD
                      </p>
                      <p style={{ margin: '6px 0 0', fontSize: 'var(--font-size-xs)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: OPTIMIZED_AMOUNT_COLOR }}>{formatEuro(optimizedYtd)}</p>
                        </div>
                        <div style={{ marginTop: '2px', display: 'grid', gap: '6px' }}>
                          <div style={{ height: 10, borderRadius: 'var(--radius-full)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${progressPct}%`,
                                height: '100%',
                                borderRadius: 'var(--radius-full)',
                                background: `linear-gradient(90deg, ${progressColor} 0%, color-mix(in oklab, ${progressColor} 72%, var(--neutral-0) 28%) 100%)`,
                                transition: 'width 360ms ease',
                              }}
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)' }}>Optimisé</p>
                              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: OPTIMIZED_AMOUNT_COLOR }}>
                                {formatEuro(optimizedYtd)}
                              </p>
                            </div>
                            <div style={{ minWidth: 0, textAlign: 'right' }}>
                              <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)' }}>Objectif</p>
                              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--primary-600)' }}>
                                {formatEuro(annualOptimization)}
                              </p>
                            </div>
                          </div>
                        </div>
                        </>
                      )
                    })() : null}
                  </article>
                  )
                })
              )}

              {bucketImpacts.length > 0 ? (
                <div style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
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
                        fontSize: 'clamp(20px, 4.6vw, 24px)',
                        lineHeight: 1.05,
                        fontWeight: 'var(--font-weight-extrabold)',
                        color: 'var(--neutral-900)',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      Impact par socle budgétaire
                    </h3>
                  </div>

                  {bucketImpacts.map((impact) => {
                    const isExpanded = expandedBucketKeys.has(impact.bucketKey)
                    return (
                    <article key={impact.bucketKey} style={{ padding: 'var(--space-1) 0 var(--space-3)', borderBottom: '1px solid var(--neutral-150)', display: 'grid', gap: 'var(--space-2)' }}>
                      <button
                        type="button"
                        onClick={() => toggleBucket(impact.bucketKey)}
                        aria-expanded={isExpanded}
                        style={{ border: 'none', padding: 0, margin: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', width: '100%', textAlign: 'left' }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span style={{ width: 14, height: 14, borderRadius: 4, background: impact.color, flexShrink: 0 }} />
                          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                            {impact.bucketLabel}
                          </p>
                        </span>
                        <StatusBadge label={`-${impact.reductionPct}%`} tone="warning" />
                      </button>

                      {isExpanded ? (
                        <>
                          {impact.categories.length > 0 ? (
                            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', overflowWrap: 'anywhere' }}>
                              {impact.categories.join(' · ')}
                            </p>
                          ) : null}

                          <div style={{ height: 10, borderRadius: 'var(--radius-full)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${impact.progressPct}%`,
                                height: '100%',
                                borderRadius: 'var(--radius-full)',
                                background: `linear-gradient(90deg, ${impact.color} 0%, color-mix(in oklab, ${impact.color} 72%, var(--neutral-0) 28%) 100%)`,
                                transition: 'width 360ms ease',
                              }}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)' }}>Mensuel</p>
                              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-positive)' }}>
                                +{formatEuro(impact.monthlyOptimization)}
                              </p>
                            </div>
                            <div style={{ minWidth: 0, textAlign: 'right' }}>
                              <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)' }}>Annuel</p>
                              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--primary-600)' }}>
                                +{formatEuro(impact.annualOptimization)}
                              </p>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </article>
                    )
                  })}
                </div>
              ) : null}
          </div>

        </StatsSection>
      ) : null}
    </>
  )
}
