import { useMemo } from 'react'
import { useOptimizationCapacity } from '@/features/stats/hooks/useOptimizationCapacity'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { EmptyState, SkeletonCard, StatsSection, formatEuro } from '@/features/stats/components/ui'

const OPTIMIZATION_YEAR = 2026
const OPTIMIZATION_CONTENT_MAX_WIDTH = 548
const DEFAULT_REMAINING_MONTHS = 12
const ANNUAL_GAIN_MONTHS = 6

export type AnnualHorizonData = {
  plannedAnnual: number
  potentialAnnual: number
  projectedAnnual: number
  plannedShare: number
  potentialShare: number
  finalObjectivePct: number
}
function normalizeBucketKey(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
}

function normalizeCategoryKey(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function resolveBucketColor(bucketKey: string): string {
  if (bucketKey.includes('discret')) return 'var(--color-negative)'
  if (bucketKey.includes('provision')) return 'var(--color-warning)'
  if (bucketKey.includes('variable')) return 'var(--primary-500)'
  if (bucketKey.includes('voyage')) return 'var(--bucket-voyage)'
  return 'var(--neutral-500)'
}

function resolveOptimizationLeverIconKey(categoryName: string | null | undefined): string | null {
  const n = (categoryName ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
  if (!n) return null
  if (n.includes('retrait') && n.includes('espece')) return 'achats_divers_retrait_d_especes'
  if (n.includes('petits achats alimentaires')) return 'alimentation_petits_achats_alimentaires'
  if (n.includes('cafe') && n.includes('bar')) return 'sorties_cafe_bars'
  if (n.includes('restaurant')) return 'sorties_restaurant'
  if (n.includes('courses')) return 'alimentation_courses'
  if (n.includes('e-commerce')) return 'achats_divers_e_commerce'
  if (n.includes('vetement')) return 'achats_divers_vetements'
  return null
}

// ─── Sub-components ───────────────────────────────────────────────────────────


function OptimisationKpiRow({ totalMonthlyGain, totalAnnualGain }: { totalMonthlyGain: number; totalAnnualGain: number }) {
  const items = [
    {
      label: 'Objectif mensuel',
      value: `+${formatEuro(totalMonthlyGain)}/mois`,
      backgroundColor: 'var(--color-warning)',
      borderColor: 'color-mix(in oklab, var(--color-warning) 78%, var(--neutral-300) 22%)',
      labelColor: '#fff',
      valueColor: '#fff',
    },
    {
      label: 'Objectif annuel',
      value: `+${formatEuro(totalAnnualGain)}/an`,
      backgroundColor: '#0E7490',
      borderColor: 'color-mix(in oklab, #0E7490 72%, var(--neutral-300) 28%)',
      labelColor: '#FCD34D',
      valueColor: '#FCD34D',
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            background: item.backgroundColor,
            border: `1.5px solid ${item.borderColor}`,
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-3)',
            minHeight: 58,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: item.labelColor, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.2 }}>
            {item.label}
          </p>
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: item.valueColor, lineHeight: 1 }}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}

function PlanningPotentialProgressBar({ annualHorizon }: { annualHorizon: AnnualHorizonData }) {
  const safePlanned = Math.max(0, Math.min(100, annualHorizon.plannedShare))
  const safePotential = Math.max(0, Math.min(100, annualHorizon.potentialShare))

  return (
    <div style={{ display: 'grid', gap: '8px', padding: '0 4px', marginTop: 'var(--space-2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--neutral-500)' }}>
          Répartition Épargne 2026
        </p>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'var(--neutral-800)', fontFamily: 'var(--font-mono)' }}>
          Total : {formatEuro(annualHorizon.projectedAnnual)}
        </p>
      </div>

      {/* Progress Bar */}
      <div style={{ height: 12, borderRadius: 'var(--radius-full)', overflow: 'hidden', display: 'flex', background: 'var(--neutral-150)' }}>
        {safePlanned > 0 && (
          <div
            style={{
              width: `${safePlanned}%`,
              background: 'linear-gradient(90deg, var(--primary-600) 0%, var(--primary-400) 100%)',
              transition: 'width 600ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        )}
        {safePotential > 0 && (
          <div
            style={{
              width: `${safePotential}%`,
              background: 'linear-gradient(90deg, var(--color-positive) 0%, #22C55E 100%)',
              transition: 'width 600ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        )}
      </div>

      {/* Single line Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Planifié */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-500)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Planifié :{' '}
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--neutral-850)' }}>
              {formatEuro(annualHorizon.plannedAnnual)}
            </span>
          </span>
        </div>

        {/* Potentiel */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Potentiel :{' '}
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 850, color: 'var(--color-positive-text)' }}>
              +{formatEuro(annualHorizon.potentialAnnual)}
            </span>
          </span>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-positive)', flexShrink: 0 }} />
        </div>
      </div>
    </div>
  )
}

function LeverCard({
  lever,
  categoryBudget,
  categoryActual,
}: {
  lever: { category_name: string | null; parent_category_name: string | null; budget_bucket: string | null; avg_monthly_amount_6m: number | null; realistic_monthly_gain: number | null }
  categoryBudget: number | null
  categoryActual: number | null
}) {
  const monthlyGain = Math.max(0, Number(lever.realistic_monthly_gain ?? 0))
  const monthlyAvg = Number(lever.avg_monthly_amount_6m ?? 0)
  const budget = categoryBudget ?? (monthlyAvg > 0 ? monthlyAvg : null)
  const spendObjective = budget != null ? Math.max(0, budget - monthlyGain) : null

  const bucketKey = normalizeBucketKey(lever.budget_bucket)
  const bucketColor = resolveBucketColor(bucketKey)
  const rawIconKey = resolveOptimizationLeverIconKey(lever.category_name)
  // Fallback to normalized category name as iconKey if mapping doesn't exist
  const iconKey = rawIconKey || normalizeCategoryKey(lever.category_name)

  const hasMonthlyData = categoryActual != null && spendObjective != null
  const progressPct = hasMonthlyData && spendObjective! > 0
    ? Math.max(0, Math.min(110, (categoryActual! / spendObjective!) * 100))
    : 0
  const isOver = hasMonthlyData && progressPct > 100
  const objectiveReached = hasMonthlyData && !isOver

  return (
    <>
      {/* Legends ABOVE the progress bar and OUTSIDE the card container */}
      {hasMonthlyData ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2, padding: '0 4px', height: 16 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Mois en cours
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              color: objectiveReached ? 'var(--color-positive-text)' : isOver ? 'var(--color-negative-text)' : 'var(--neutral-700)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 14,
                height: 14,
                borderRadius: objectiveReached ? 3 : '50%',
                background: objectiveReached ? 'var(--color-positive)' : 'var(--color-negative)',
                color: '#fff',
                fontSize: 9,
                fontWeight: 900,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              {objectiveReached ? '✓' : '✕'}
            </span>
            {formatEuro(categoryActual)} / {formatEuro(spendObjective)}
          </p>
        </div>
      ) : (
        <div style={{ height: 16, marginBottom: 2 }} />
      )}

      <article
        style={{
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--neutral-150)',
          background: 'var(--neutral-0)',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
          flexShrink: 0,
          scrollSnapAlign: 'start',
        }}
      >
        {/* Top Progress Bar / Accent (Higher contrast and thickness) */}
        {hasMonthlyData ? (
          <div style={{ height: 8, background: 'var(--neutral-200)', width: '100%', flexShrink: 0, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, progressPct)}%`,
                height: '100%',
                background: objectiveReached
                  ? 'linear-gradient(90deg, var(--color-positive), color-mix(in oklab, var(--color-positive) 75%, var(--neutral-0) 25%))'
                  : isOver
                    ? 'linear-gradient(90deg, var(--color-warning), var(--color-negative))'
                    : `linear-gradient(90deg, ${bucketColor}, color-mix(in oklab, ${bucketColor} 72%, var(--neutral-0) 28%))`,
                transition: 'width 360ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </div>
        ) : (
          <div style={{ height: 3, background: bucketColor, flexShrink: 0 }} />
        )}

        <div style={{ padding: 'var(--space-3) var(--space-4) var(--space-4)' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ flexShrink: 0 }}>
              <CategoryIcon iconKey={iconKey} label={lever.category_name ?? 'Poste'} size={32} />
            </div>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--neutral-900)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lever.category_name ?? '—'}
              </p>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--color-positive-text)', fontFamily: 'var(--font-mono)', lineHeight: 1.2 }}>
                +{formatEuro(monthlyGain)}/mois
              </p>
            </div>
          </div>

          {/* Stats row (Clean container, no heavy frames) */}
          <div
            style={{
              marginTop: 'var(--space-3)',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              background: 'var(--neutral-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--neutral-100)',
              padding: '6px 0',
            }}
          >
            {[
              { label: 'Moy. 6 mois', value: formatEuro(monthlyAvg > 0 ? monthlyAvg : null) },
              { label: 'Budget', value: categoryBudget != null ? formatEuro(categoryBudget) : '—' },
              { label: 'Cible opti.', value: spendObjective != null ? formatEuro(spendObjective) : '—', highlight: true },
            ].map((stat, i) => (
              <div
                key={stat.label}
                style={{
                  padding: '2px 0',
                  textAlign: 'center',
                  borderLeft: i > 0 ? '1px solid var(--neutral-200)' : undefined,
                }}
              >
                <p style={{ margin: 0, fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--neutral-400)', lineHeight: 1.2 }}>
                  {stat.label}
                </p>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: stat.highlight ? 'var(--primary-600)' : 'var(--neutral-800)',
                    lineHeight: 1,
                  }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </article>
    </>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

type StatsOptimizationsTabProps = {
  monthlyBudgetByCategory?: Map<string, number>
  monthlyActualByCategory?: Map<string, number>
  selectedMonth?: number | null
  selectedYear?: number
  annualHorizon?: AnnualHorizonData | null
}

export function StatsOptimizationsTab({
  monthlyBudgetByCategory,
  monthlyActualByCategory,
  selectedMonth = null,
  selectedYear = OPTIMIZATION_YEAR,
  annualHorizon,
}: StatsOptimizationsTabProps) {
  const { data, isLoading, error } = useOptimizationCapacity(OPTIMIZATION_YEAR)

  const optimizationLevers = data?.optimization_levers ?? []
  const displayedLevers = optimizationLevers.slice(0, 8)

  const elapsedMonthsInYear = useMemo(() => {
    if (selectedYear !== OPTIMIZATION_YEAR) return DEFAULT_REMAINING_MONTHS
    if (selectedMonth == null || selectedMonth < 1 || selectedMonth > 12) return 0
    return selectedMonth
  }, [selectedMonth, selectedYear])

  const totalMonthlyGain = useMemo(
    () => displayedLevers.reduce((sum, lever) => sum + Math.max(0, Number(lever.realistic_monthly_gain ?? 0)), 0),
    [displayedLevers],
  )
  const totalAnnualGain = totalMonthlyGain * ANNUAL_GAIN_MONTHS

  void elapsedMonthsInYear

  return (
    <>
      {isLoading ? (
        <StatsSection style={{ gap: 'var(--space-3)', maxWidth: OPTIMIZATION_CONTENT_MAX_WIDTH }}>
          <SkeletonCard heightClass="h-28" lines={0} />
          <SkeletonCard heightClass="h-36" lines={0} />
          <SkeletonCard heightClass="h-36" lines={0} />
          <SkeletonCard heightClass="h-36" lines={0} />
        </StatsSection>
      ) : null}

      {!isLoading && error ? (
        <StatsSection style={{ maxWidth: OPTIMIZATION_CONTENT_MAX_WIDTH }}>
          <EmptyState message="Impossible de charger les données d'optimisation." />
        </StatsSection>
      ) : null}

      {!isLoading && !error && !data ? (
        <StatsSection style={{ maxWidth: OPTIMIZATION_CONTENT_MAX_WIDTH }}>
          <EmptyState message="Aucune donnée d'optimisation disponible." />
        </StatsSection>
      ) : null}

      {!isLoading && !error && data ? (
        <StatsSection style={{ gap: 'var(--space-5)', maxWidth: OPTIMIZATION_CONTENT_MAX_WIDTH }}>

          {/* KPI cards in copy-paste Planning style */}
          {totalAnnualGain > 0 ? (
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <OptimisationKpiRow
                totalMonthlyGain={totalMonthlyGain}
                totalAnnualGain={totalAnnualGain}
              />
              {annualHorizon ? (
                <PlanningPotentialProgressBar annualHorizon={annualHorizon} />
              ) : null}
            </div>
          ) : null}

          {/* Lever cards (horizontal scroll carousel) */}
          <div style={{ width: '100%', overflow: 'hidden', marginTop: 'var(--space-2)' }}>
            {displayedLevers.length === 0 ? (
              <div style={{ padding: '0 var(--page-gutter)' }}>
                <EmptyState message="Aucun levier d'optimisation disponible." />
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--space-3)',
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  scrollSnapType: 'x mandatory',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                  paddingLeft: 'var(--page-gutter)',
                  paddingRight: 'var(--page-gutter)',
                  margin: '0 calc(-1 * var(--page-gutter))',
                  background: 'linear-gradient(180deg, var(--neutral-100) 0%, var(--neutral-50) 100%)',
                  borderTop: '1px solid var(--neutral-150)',
                  borderBottom: '1px solid var(--neutral-150)',
                  paddingTop: 'var(--space-4)',
                  paddingBottom: 'var(--space-4)',
                }}
              >
                {displayedLevers.map((lever, index) => {
                  const catKey = normalizeCategoryKey(lever.category_name)
                  const categoryBudget = monthlyBudgetByCategory?.get(catKey) ?? null
                  const categoryActual = monthlyActualByCategory?.get(catKey) ?? null
                  return (
                    <div key={`${catKey || 'lever'}-${index}`} style={{ width: '280px', flexShrink: 0 }}>
                      <LeverCard
                        lever={lever}
                        categoryBudget={categoryBudget !== undefined ? categoryBudget : null}
                        categoryActual={categoryActual !== undefined ? categoryActual : null}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </StatsSection>
      ) : null}
    </>
  )
}
