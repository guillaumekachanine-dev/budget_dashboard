import { useState } from 'react'
import { useOptimizationCapacity } from '@/features/stats/hooks/useOptimizationCapacity'
import type { OptimizationLever, OptimizationMonthlyForecast } from '@/features/stats/types'
import {
  DataQualityNotice,
  EmptyState,
  HeroMetricCard,
  MonthlyTimeline,
  SectionHeader,
  SkeletonCard,
  StatsSection,
  StatusBadge,
  SurfaceCard,
  YearToggle,
  asFiniteNumber,
  formatEuro,
  formatEuroPerMonth,
  formatInteger,
  formatMonthLabel,
  type Tone,
} from '@/features/stats/components/ui'

type OptimizationYear = 2026 | 2025

const OPTIMIZATION_YEARS: OptimizationYear[] = [2026, 2025]

function formatMonthLabelFromRow(row: OptimizationMonthlyForecast): string {
  const monthLabel = formatMonthLabel(row.period_month, row.period_year)
  if (monthLabel !== '—') return monthLabel

  if (!row.month_start) return '—'
  const date = new Date(row.month_start)
  if (Number.isNaN(date.getTime())) return '—'

  return formatMonthLabel(date.getMonth() + 1, date.getFullYear())
}

function resolveRiskInsight(riskMonthsCount: number | null): string {
  if (riskMonthsCount == null) return '—'
  if (riskMonthsCount === 0) return 'Aucun mois critique détecté sur la période.'
  if (riskMonthsCount === 1) return '1 mois nécessite une vigilance particulière.'
  return `${riskMonthsCount} mois nécessitent une vigilance particulière.`
}

function resolveForecastStatus(statusRaw: string | null | undefined): {
  label: string
  tone: Tone
} {
  const normalized = (statusRaw ?? '').toLowerCase()

  if (normalized === 'ok') {
    return { label: 'OK', tone: 'positive' }
  }

  if (normalized === 'watch') {
    return { label: 'À surveiller', tone: 'info' }
  }

  if (normalized === 'tense') {
    return { label: 'Tendu', tone: 'warning' }
  }

  if (normalized === 'risk') {
    return { label: 'Risque', tone: 'danger' }
  }

  if (normalized === 'capacity_negative') {
    return { label: 'Capacité négative', tone: 'danger' }
  }

  if (normalized === 'missing_income') {
    return { label: 'Revenus manquants', tone: 'danger' }
  }

  if (normalized === 'completed') {
    return { label: 'Réalisé', tone: 'neutral' }
  }

  return {
    label: statusRaw && statusRaw.trim().length > 0 ? statusRaw : '—',
    tone: 'neutral',
  }
}

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

function getTop3Levers(levers: OptimizationLever[]): OptimizationLever[] {
  return [...levers]
    .sort((a, b) => {
      const gainB = asFiniteNumber(b.realistic_monthly_gain) ?? Number.NEGATIVE_INFINITY
      const gainA = asFiniteNumber(a.realistic_monthly_gain) ?? Number.NEGATIVE_INFINITY
      return gainB - gainA
    })
    .slice(0, 3)
}

export function StatsOptimizationsTab() {
  const [selectedYear, setSelectedYear] = useState<OptimizationYear>(2026)
  const { data, isLoading, error } = useOptimizationCapacity(selectedYear)

  const annualSummary = data?.annual_summary ?? null
  const monthlyForecast = data?.monthly_forecast ?? []
  const optimizationLevers = data?.optimization_levers ?? []
  const scenarios = data?.scenarios ?? []

  const displayedLevers = optimizationLevers.slice(0, 8)
  const top3Levers = getTop3Levers(optimizationLevers)

  const top3MonthlyGainValues = top3Levers
    .map((lever) => asFiniteNumber(lever.realistic_monthly_gain))
    .filter((value): value is number => value != null)
  const top3AnnualGainValues = top3Levers
    .map((lever) => asFiniteNumber(lever.realistic_annual_gain))
    .filter((value): value is number => value != null)

  const top3MonthlyGain = top3MonthlyGainValues.length > 0
    ? top3MonthlyGainValues.reduce((sum, value) => sum + value, 0)
    : null
  const top3AnnualGain = top3AnnualGainValues.length > 0
    ? top3AnnualGainValues.reduce((sum, value) => sum + value, 0)
    : null

  const top3Labels = top3Levers
    .map((lever) => lever.category_name)
    .filter((name): name is string => Boolean(name && name.trim().length > 0))

  return (
    <>
      <StatsSection>
        <SectionHeader
          title="Optimisations"
          subtitle={`Capacité d’épargne prévisionnelle ${selectedYear}`}
          rightSlot={<YearToggle years={OPTIMIZATION_YEARS} value={selectedYear} onChange={(year) => setSelectedYear(year as OptimizationYear)} />}
        />
      </StatsSection>

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
            title="Capacité prévisionnelle"
            value={formatEuro(annualSummary?.gross_savings_capacity_total)}
            caption="Capacité d’épargne restante estimée"
            tone="info"
            detail={resolveRiskInsight(asFiniteNumber(annualSummary?.risk_months_count))}
            metrics={[
              {
                label: 'Moyenne mensuelle',
                value: formatEuroPerMonth(annualSummary?.avg_monthly_gross_savings_capacity),
              },
              {
                label: 'Épargne planifiée',
                value: formatEuro(annualSummary?.planned_savings_total),
              },
              {
                label: 'Capacité additionnelle',
                value: formatEuro(annualSummary?.additional_capacity_after_planned_savings_total),
              },
              {
                label: 'Mois à risque',
                value: formatInteger(annualSummary?.risk_months_count),
              },
            ]}
            notice={
              asFiniteNumber(annualSummary?.risk_months_count) != null && (annualSummary?.risk_months_count ?? 0) > 0
                ? (
                    <DataQualityNotice
                      tone="warning"
                      title="Vigilance"
                      detail={resolveRiskInsight(asFiniteNumber(annualSummary?.risk_months_count))}
                    />
                  )
                : undefined
            }
          />

          <SurfaceCard tone="neutral" padding="var(--space-4)">
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <SectionHeader title="Planning annuel" subtitle="Projection mois par mois" />
              <MonthlyTimeline
                items={monthlyForecast.map((row, index) => {
                  const status = resolveForecastStatus(row.forecast_status)
                  return {
                    key: `${row.month_start ?? ''}-${row.period_year ?? ''}-${row.period_month ?? ''}-${index}`,
                    title: formatMonthLabelFromRow(row),
                    badge: <StatusBadge label={status.label} tone={status.tone} />,
                    metrics: [
                      { label: 'Revenus projetés', value: formatEuro(row.projected_income) },
                      { label: 'Dépenses hors épargne', value: formatEuro(row.projected_non_savings_expenses) },
                      { label: 'Épargne planifiée', value: formatEuro(row.planned_savings_budget) },
                      { label: 'Capacité brute', value: formatEuro(row.gross_savings_capacity), tone: 'info' },
                      { label: 'Capacité après planifié', value: formatEuro(row.additional_capacity_after_planned_savings), tone: 'positive' },
                      { label: 'Solde courant estimé', value: formatEuro(row.estimated_current_account_end_balance) },
                    ],
                  }
                })}
              />
            </div>
          </SurfaceCard>

          <SurfaceCard tone="neutral" padding="var(--space-4)">
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <SectionHeader title="Postes optimisables" subtitle="6 à 8 leviers prioritaires" />

              {displayedLevers.length === 0 ? (
                <EmptyState message="Aucun levier d’optimisation disponible." />
              ) : (
                displayedLevers.map((lever, index) => (
                  <article key={`${lever.category_name ?? ''}-${index}`} style={{ border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                        {lever.category_name ?? '—'}
                      </p>
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

          <SurfaceCard tone="neutral" padding="var(--space-4)">
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <SectionHeader title="Scénarios" subtitle="Prudent, réaliste, ambitieux" />

              <div style={{ display: 'grid', gap: 'var(--space-2)', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
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
                        padding: 'var(--space-3)',
                        display: 'grid',
                        gap: 'var(--space-1)',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: isHighlighted ? 'var(--primary-700)' : 'var(--neutral-600)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {expected.label}
                      </p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>
                        {formatEuroPerMonth(scenario?.monthly_gain ?? null)}
                      </p>
                      <p style={{ margin: 0, fontSize: '10px', color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>
                        Scope: {formatEuro(scenario?.projected_gain_on_scope ?? null)}
                      </p>
                      <p style={{ margin: 0, fontSize: '10px', color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>
                        Total: {formatEuro(scenario?.projected_capacity_total ?? null)}
                      </p>
                    </article>
                  )
                })}
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard tone="neutral" padding="var(--space-4)">
            <SectionHeader title="Plan d’action recommandé" />
            <p style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)' }}>
              {top3Labels.length > 0 && top3MonthlyGain != null && top3AnnualGain != null
                ? `En optimisant ${top3Labels.join(', ')}, tu pourrais libérer environ ${formatEuroPerMonth(top3MonthlyGain)}, soit ${formatEuro(top3AnnualGain)} sur la période restante.`
                : '—'}
            </p>
          </SurfaceCard>
        </StatsSection>
      ) : null}
    </>
  )
}
