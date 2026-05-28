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

type OptimizationBucketImpact = {
  bucketKey: string
  bucketLabel: string
  color: string
  monthlyOptimization: number
  annualOptimization: number
  categories: string[]
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

function resolveBucketLabel(bucketKey: string): string {
  const map: Record<string, string> = {
    socle_fixe: 'Socle fixe',
    variable_essentielle: 'Variable',
    provision: 'Provision',
    discretionnaire: 'Discrétionnaire',
    voyage: 'Voyage',
  }
  return map[bucketKey] ?? bucketKey.split('_').filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
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

function SectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 3, height: 18, borderRadius: 'var(--radius-full)', background: 'var(--primary-500)', flexShrink: 0 }} />
      <p style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--neutral-900)', letterSpacing: '-0.01em' }}>
        {label}
        {count != null ? (
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}>
            {count}
          </span>
        ) : null}
      </p>
    </div>
  )
}

function GainHeroCard({ totalMonthlyGain, totalAnnualGain, annualHorizon }: {
  totalMonthlyGain: number
  totalAnnualGain: number
  annualHorizon: AnnualHorizonData
}) {
  const safePlanned = Math.max(0, Math.min(100, annualHorizon.plannedShare))
  const safePotential = Math.max(0, Math.min(100, annualHorizon.potentialShare))
  const fmtPct = (v: number) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)}%`

  return (
    <div
      style={{
        borderRadius: 'var(--radius-2xl)',
        background: 'linear-gradient(135deg, var(--neutral-900) 0%, color-mix(in oklab, var(--primary-700) 62%, var(--neutral-900) 38%) 55%, var(--color-petrol) 100%)',
        padding: 'var(--space-5)',
        color: '#fff',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 12px 40px rgba(18, 14, 60, 0.30)',
      }}
    >
      {/* Decorative circle */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          pointerEvents: 'none',
        }}
      />

      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.65 }}>
        Gain optimisable annuel
      </p>

      <div style={{ marginTop: 'var(--space-2)', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 'clamp(34px, 9vw, 42px)', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.025em', fontFamily: 'var(--font-mono)' }}>
          +{formatEuro(totalAnnualGain)}
        </p>
        <p style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700, opacity: 0.78 }}>
          +{formatEuro(totalMonthlyGain)}<span style={{ fontSize: 11, opacity: 0.85 }}>/mois</span>
        </p>
      </div>

      <p style={{ margin: 'var(--space-1) 0 0', fontSize: 10, opacity: 0.62, lineHeight: 1.4 }}>
        {ANNUAL_GAIN_MONTHS} mois · objectif total {formatEuro(annualHorizon.projectedAnnual)} · {fmtPct(annualHorizon.finalObjectivePct)} des revenus
      </p>

      {/* Split bar */}
      <div style={{ marginTop: 'var(--space-4)', display: 'grid', gap: 'var(--space-2)' }}>
        <div style={{ height: 8, borderRadius: 'var(--radius-full)', overflow: 'hidden', display: 'flex', gap: 2 }}>
          <div
            style={{
              flex: safePlanned,
              background: 'var(--primary-400)',
              borderRadius: 'var(--radius-full)',
              minWidth: 0,
              transition: 'flex 480ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
          <div
            style={{
              flex: safePotential,
              background: 'var(--color-positive)',
              borderRadius: 'var(--radius-full)',
              minWidth: 0,
              opacity: 0.9,
              transition: 'flex 480ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
          {safePlanned + safePotential < 99 ? (
            <div style={{ flex: Math.max(0, 100 - safePlanned - safePotential), background: 'rgba(255,255,255,0.1)', borderRadius: 'var(--radius-full)', minWidth: 0 }} />
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--primary-400)', flexShrink: 0, display: 'inline-block' }} />
            <p style={{ margin: 0, fontSize: 10, opacity: 0.82, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
              Planifié {formatEuro(annualHorizon.plannedAnnual)}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--color-positive)', flexShrink: 0, display: 'inline-block' }} />
            <p style={{ margin: 0, fontSize: 10, opacity: 0.82, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
              Potentiel +{formatEuro(annualHorizon.potentialAnnual)}
            </p>
          </div>
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
  const iconKey = resolveOptimizationLeverIconKey(lever.category_name)

  const hasMonthlyData = categoryActual != null && spendObjective != null
  const progressPct = hasMonthlyData && spendObjective! > 0
    ? Math.max(0, Math.min(110, (categoryActual! / spendObjective!) * 100))
    : 0
  const isOver = hasMonthlyData && progressPct > 100
  const objectiveReached = hasMonthlyData && !isOver

  return (
    <article
      style={{
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--neutral-150)',
        background: 'var(--neutral-0)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
      }}
    >
      {/* Top accent */}
      <div style={{ height: 3, background: bucketColor, flexShrink: 0 }} />

      <div style={{ padding: 'var(--space-3) var(--space-4) var(--space-4)' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div style={{ flexShrink: 0 }}>
              <CategoryIcon iconKey={iconKey} label={lever.category_name ?? 'Poste'} size={30} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--neutral-900)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lever.category_name ?? '—'}
              </p>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  marginTop: 3,
                  padding: '1px 7px',
                  borderRadius: 'var(--radius-full)',
                  background: `color-mix(in oklab, ${bucketColor} 11%, var(--neutral-0) 89%)`,
                  border: `1px solid color-mix(in oklab, ${bucketColor} 30%, var(--neutral-200) 70%)`,
                  fontSize: 10,
                  fontWeight: 700,
                  color: bucketColor,
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                {resolveBucketLabel(bucketKey)}
              </span>
            </div>
          </div>

          {/* Gain pill */}
          <div
            style={{
              flexShrink: 0,
              background: 'color-mix(in oklab, var(--color-positive) 10%, var(--neutral-0) 90%)',
              border: '1.5px solid color-mix(in oklab, var(--color-positive) 30%, var(--neutral-200) 70%)',
              borderRadius: 'var(--radius-md)',
              padding: '5px 10px',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-positive)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', lineHeight: 1 }}>
              +{formatEuro(monthlyGain)}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 9, fontWeight: 600, color: 'var(--neutral-500)', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1 }}>
              /mois
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ marginTop: 'var(--space-3)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderRadius: 'var(--radius-md)', background: 'var(--neutral-50)', border: '1px solid var(--neutral-150)', overflow: 'hidden' }}>
          {[
            { label: 'Moy. 6 mois', value: formatEuro(monthlyAvg > 0 ? monthlyAvg : null) },
            { label: 'Budget', value: categoryBudget != null ? formatEuro(categoryBudget) : '—' },
            { label: 'Plafond cible', value: spendObjective != null ? formatEuro(spendObjective) : '—' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              style={{
                padding: '6px 0',
                textAlign: 'center',
                borderLeft: i > 0 ? '1px solid var(--neutral-150)' : undefined,
              }}
            >
              <p style={{ margin: 0, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--neutral-400)', lineHeight: 1 }}>
                {stat.label}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)', lineHeight: 1 }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Monthly progress bar */}
        {hasMonthlyData ? (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: 'var(--neutral-500)' }}>
                Mois en cours
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: objectiveReached ? 'var(--color-positive)' : isOver ? 'var(--color-negative)' : 'var(--neutral-700)',
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

            <div style={{ height: 7, borderRadius: 'var(--radius-full)', background: 'var(--neutral-100)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, progressPct)}%`,
                  height: '100%',
                  borderRadius: 'var(--radius-full)',
                  background: objectiveReached
                    ? 'linear-gradient(90deg, var(--color-positive), color-mix(in oklab, var(--color-positive) 75%, var(--neutral-0) 25%))'
                    : isOver
                      ? 'linear-gradient(90deg, var(--color-warning), var(--color-negative))'
                      : `linear-gradient(90deg, ${bucketColor}, color-mix(in oklab, ${bucketColor} 72%, var(--neutral-0) 28%))`,
                  transition: 'width 360ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function BucketImpactGrid({ buckets }: { buckets: OptimizationBucketImpact[] }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      <SectionLabel label="Impact par bloc" count={buckets.length} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-2)' }}>
        {buckets.map((impact) => (
          <article
            key={impact.bucketKey}
            style={{
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--neutral-150)',
              borderLeft: `3px solid ${impact.color}`,
              background: 'var(--neutral-0)',
              boxShadow: 'var(--shadow-card)',
              padding: 'var(--space-3)',
              display: 'grid',
              gap: 3,
              minWidth: 0,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--neutral-800)',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {impact.bucketLabel}
            </p>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-positive)', lineHeight: 1 }}>
              +{formatEuro(impact.monthlyOptimization)}<span style={{ fontSize: 9, fontWeight: 600, opacity: 0.75 }}>/mois</span>
            </p>
            <p style={{ margin: 0, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--primary-600)', lineHeight: 1 }}>
              +{formatEuro(impact.annualOptimization)}<span style={{ fontSize: 9, fontWeight: 600, opacity: 0.8 }}>/an</span>
            </p>
            {impact.categories.length > 0 ? (
              <p style={{ margin: '2px 0 0', fontSize: 9, color: 'var(--neutral-500)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {impact.categories.slice(0, 3).join(' · ')}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </div>
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

  const bucketImpacts = useMemo<OptimizationBucketImpact[]>(() => {
    const grouped = new Map<string, {
      monthlyOptimization: number
      annualOptimization: number
      categories: Set<string>
    }>()

    for (const lever of displayedLevers) {
      const bucketKey = normalizeBucketKey(lever.budget_bucket)
      if (!bucketKey) continue
      const monthly = Math.max(0, Number(lever.realistic_monthly_gain ?? 0))
      const annual = monthly * ANNUAL_GAIN_MONTHS
      const categoryName = (lever.parent_category_name ?? lever.category_name ?? '').trim()

      const existing = grouped.get(bucketKey) ?? { monthlyOptimization: 0, annualOptimization: 0, categories: new Set<string>() }
      existing.monthlyOptimization += Number.isFinite(monthly) ? monthly : 0
      existing.annualOptimization += Number.isFinite(annual) ? annual : 0
      if (categoryName) existing.categories.add(categoryName)
      grouped.set(bucketKey, existing)
    }

    return [...grouped.entries()]
      .map(([bucketKey, values]) => ({
        bucketKey,
        bucketLabel: resolveBucketLabel(bucketKey),
        color: resolveBucketColor(bucketKey),
        monthlyOptimization: values.monthlyOptimization,
        annualOptimization: values.annualOptimization,
        categories: [...values.categories].slice(0, 3),
      }))
      .sort((a, b) => b.monthlyOptimization - a.monthlyOptimization)
  }, [displayedLevers])

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

          {/* Hero gain card */}
          {annualHorizon && totalAnnualGain > 0 ? (
            <GainHeroCard
              totalMonthlyGain={totalMonthlyGain}
              totalAnnualGain={totalAnnualGain}
              annualHorizon={annualHorizon}
            />
          ) : null}

          {/* Lever cards */}
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <SectionLabel label="Leviers d'action" count={displayedLevers.length} />

            {displayedLevers.length === 0 ? (
              <EmptyState message="Aucun levier d'optimisation disponible." />
            ) : (
              displayedLevers.map((lever, index) => {
                const catKey = normalizeCategoryKey(lever.category_name)
                const categoryBudget = monthlyBudgetByCategory?.get(catKey) ?? null
                const categoryActual = monthlyActualByCategory?.get(catKey) ?? null
                return (
                  <LeverCard
                    key={`${catKey || 'lever'}-${index}`}
                    lever={lever}
                    categoryBudget={categoryBudget !== undefined ? categoryBudget : null}
                    categoryActual={categoryActual !== undefined ? categoryActual : null}
                  />
                )
              })
            )}
          </div>

          {/* Bucket impact grid */}
          {bucketImpacts.length > 0 ? <BucketImpactGrid buckets={bucketImpacts} /> : null}

        </StatsSection>
      ) : null}
    </>
  )
}
