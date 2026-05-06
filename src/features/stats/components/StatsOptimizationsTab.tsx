import { useState } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { useOptimizationCapacity } from '@/features/stats/hooks/useOptimizationCapacity'
import type { OptimizationLever, OptimizationMonthlyForecast } from '@/features/stats/types'

type OptimizationYear = 2026 | 2025

const OPTIMIZATION_YEARS: OptimizationYear[] = [2026, 2025]
const MONTH_SHORT_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'] as const

function asFiniteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function formatEuro(value: number | null | undefined): string {
  const numeric = asFiniteNumber(value)
  if (numeric == null) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numeric)
}

function formatEuroPerMonth(value: number | null | undefined): string {
  const amount = formatEuro(value)
  if (amount === '—') return amount
  return `${amount} / mois`
}

function formatMonthLabel(row: OptimizationMonthlyForecast): string {
  const month = asFiniteNumber(row.period_month)
  if (month != null && month >= 1 && month <= 12) {
    const label = MONTH_SHORT_FR[month - 1] ?? '—'
    const year = asFiniteNumber(row.period_year)
    return year == null ? label : `${label} ${year}`
  }

  if (row.month_start) {
    const date = new Date(row.month_start)
    if (!Number.isNaN(date.getTime())) {
      const label = MONTH_SHORT_FR[date.getMonth()] ?? '—'
      return `${label} ${date.getFullYear()}`
    }
  }

  return '—'
}

function resolveRiskInsight(riskMonthsCount: number | null): string {
  if (riskMonthsCount == null) return '—'
  if (riskMonthsCount === 0) return 'Aucun mois critique détecté sur la période.'
  if (riskMonthsCount === 1) return '1 mois nécessite une vigilance particulière.'
  return `${riskMonthsCount} mois nécessitent une vigilance particulière.`
}

function resolveForecastStatus(statusRaw: string | null | undefined): {
  label: string
  color: string
  background: string
  border: string
} {
  const normalized = (statusRaw ?? '').toLowerCase()

  if (normalized === 'ok') {
    return {
      label: 'OK',
      color: 'var(--color-positive)',
      background: 'color-mix(in oklab, var(--color-positive) 12%, var(--neutral-0) 88%)',
      border: 'color-mix(in oklab, var(--color-positive) 24%, var(--neutral-0) 76%)',
    }
  }
  if (normalized === 'watch') {
    return {
      label: 'À surveiller',
      color: 'var(--primary-700)',
      background: 'color-mix(in oklab, var(--primary-500) 12%, var(--neutral-0) 88%)',
      border: 'color-mix(in oklab, var(--primary-500) 24%, var(--neutral-0) 76%)',
    }
  }
  if (normalized === 'tense') {
    return {
      label: 'Tendu',
      color: 'var(--color-warning)',
      background: 'color-mix(in oklab, var(--color-warning) 12%, var(--neutral-0) 88%)',
      border: 'color-mix(in oklab, var(--color-warning) 24%, var(--neutral-0) 76%)',
    }
  }
  if (normalized === 'risk' || normalized === 'capacity_negative') {
    return {
      label: normalized === 'capacity_negative' ? 'Capacité négative' : 'Risque',
      color: 'var(--color-negative)',
      background: 'color-mix(in oklab, var(--color-negative) 12%, var(--neutral-0) 88%)',
      border: 'color-mix(in oklab, var(--color-negative) 24%, var(--neutral-0) 76%)',
    }
  }
  if (normalized === 'missing_income') {
    return {
      label: 'Revenus manquants',
      color: 'var(--color-negative)',
      background: 'color-mix(in oklab, var(--color-negative) 12%, var(--neutral-0) 88%)',
      border: 'color-mix(in oklab, var(--color-negative) 24%, var(--neutral-0) 76%)',
    }
  }
  if (normalized === 'completed') {
    return {
      label: 'Réalisé',
      color: 'var(--neutral-600)',
      background: 'var(--neutral-100)',
      border: 'var(--neutral-200)',
    }
  }

  return {
    label: statusRaw && statusRaw.trim().length > 0 ? statusRaw : '—',
    color: 'var(--neutral-600)',
    background: 'var(--neutral-100)',
    border: 'var(--neutral-200)',
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

  const top3MonthlyGain = top3Levers.reduce((sum, lever) => sum + (asFiniteNumber(lever.realistic_monthly_gain) ?? 0), 0)
  const top3AnnualGain = top3Levers.reduce((sum, lever) => sum + (asFiniteNumber(lever.realistic_annual_gain) ?? 0), 0)

  const top3Labels = top3Levers
    .map((lever) => lever.category_name)
    .filter((name): name is string => Boolean(name && name.trim().length > 0))

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', borderRadius: 'var(--radius-full)', border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', boxShadow: 'var(--shadow-card)' }}>
            {OPTIMIZATION_YEARS.map((year) => {
              const isActive = selectedYear === year
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedYear(year)}
                  aria-pressed={isActive}
                  style={{
                    border: 'none',
                    borderRadius: 'var(--radius-full)',
                    minHeight: 30,
                    padding: '0 12px',
                    background: isActive ? 'var(--primary-500)' : 'transparent',
                    color: isActive ? 'var(--neutral-0)' : 'var(--neutral-700)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-semibold)',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-base)',
                  }}
                >
                  {year}
                </button>
              )
            })}
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-52 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : null}

        {!isLoading && error ? (
          <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', color: 'var(--neutral-600)', padding: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
            Impossible de charger les données d’optimisation.
          </div>
        ) : null}

        {!isLoading && !error && !data ? (
          <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', color: 'var(--neutral-600)', padding: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
            Aucune donnée d’optimisation disponible.
          </div>
        ) : null}

        {!isLoading && !error && data ? (
          <>
            <section style={{ borderRadius: 'var(--radius-2xl)', border: '1px solid color-mix(in oklab, var(--primary-500) 24%, var(--neutral-0) 76%)', background: 'linear-gradient(135deg, color-mix(in oklab, var(--primary-700) 85%, var(--neutral-900) 15%) 0%, color-mix(in oklab, var(--primary-500) 78%, var(--neutral-900) 22%) 100%)', color: 'var(--neutral-0)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-5)' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.9, fontWeight: 'var(--font-weight-bold)' }}>
                Capacité prévisionnelle
              </p>
              <p style={{ margin: '6px 0 0', fontSize: '32px', lineHeight: 1.1, fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-extrabold)' }}>
                {formatEuro(annualSummary?.gross_savings_capacity_total)}
              </p>

              <div style={{ display: 'grid', gap: 'var(--space-2)', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginTop: 'var(--space-4)' }}>
                <div style={{ background: 'color-mix(in oklab, var(--neutral-0) 12%, transparent)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', opacity: 0.8 }}>Moyenne mensuelle</p>
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-bold)' }}>
                    {formatEuroPerMonth(annualSummary?.avg_monthly_gross_savings_capacity)}
                  </p>
                </div>
                <div style={{ background: 'color-mix(in oklab, var(--neutral-0) 12%, transparent)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', opacity: 0.8 }}>Épargne déjà planifiée</p>
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-bold)' }}>
                    {formatEuro(annualSummary?.planned_savings_total)}
                  </p>
                </div>
                <div style={{ background: 'color-mix(in oklab, var(--neutral-0) 12%, transparent)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', opacity: 0.8 }}>Capacité additionnelle</p>
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-bold)' }}>
                    {formatEuro(annualSummary?.additional_capacity_after_planned_savings_total)}
                  </p>
                </div>
                <div style={{ background: 'color-mix(in oklab, var(--neutral-0) 12%, transparent)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', opacity: 0.8 }}>Mois à risque</p>
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-bold)' }}>
                    {asFiniteNumber(annualSummary?.risk_months_count) == null ? '—' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(annualSummary?.risk_months_count ?? 0)}`}
                  </p>
                </div>
              </div>

              <p style={{ margin: 'var(--space-3) 0 0', fontSize: 'var(--font-size-sm)', opacity: 0.92 }}>
                {resolveRiskInsight(asFiniteNumber(annualSummary?.risk_months_count))}
              </p>
            </section>

            <section style={{ borderRadius: 'var(--radius-2xl)', border: '1px solid var(--neutral-150)', background: 'var(--neutral-0)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                Planning annuel
              </p>

              {monthlyForecast.length === 0 ? (
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>—</p>
              ) : (
                monthlyForecast.map((row, index) => {
                  const status = resolveForecastStatus(row.forecast_status)
                  return (
                    <article key={`${row.month_start ?? ''}-${row.period_year ?? ''}-${row.period_month ?? ''}-${index}`} style={{ border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)' }}>
                          {formatMonthLabel(row)}
                        </p>
                        <span style={{ fontSize: '11px', fontWeight: 'var(--font-weight-semibold)', color: status.color, background: status.background, border: `1px solid ${status.border}`, borderRadius: 'var(--radius-full)', padding: '2px 8px' }}>
                          {status.label}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gap: 'var(--space-1)', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Revenus projetés</p>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>{formatEuro(row.projected_income)}</p>

                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Dépenses hors épargne</p>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>{formatEuro(row.projected_non_savings_expenses)}</p>

                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Épargne planifiée</p>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>{formatEuro(row.planned_savings_budget)}</p>

                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Capacité brute</p>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>{formatEuro(row.gross_savings_capacity)}</p>

                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Capacité après épargne planifiée</p>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>{formatEuro(row.additional_capacity_after_planned_savings)}</p>

                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Solde compte courant estimé</p>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>{formatEuro(row.estimated_current_account_end_balance)}</p>
                      </div>
                    </article>
                  )
                })
              )}
            </section>

            <section style={{ borderRadius: 'var(--radius-2xl)', border: '1px solid var(--neutral-150)', background: 'var(--neutral-0)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                Postes optimisables
              </p>

              {displayedLevers.length === 0 ? (
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>—</p>
              ) : (
                displayedLevers.map((lever, index) => (
                  <article key={`${lever.category_name ?? ''}-${index}`} style={{ border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                        {lever.category_name ?? '—'}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>
                        {[lever.parent_category_name, lever.budget_bucket].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>

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
            </section>

            <section style={{ borderRadius: 'var(--radius-2xl)', border: '1px solid var(--neutral-150)', background: 'var(--neutral-0)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                Scénarios
              </p>

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
                          ? '1px solid color-mix(in oklab, var(--primary-500) 32%, var(--neutral-0) 68%)'
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
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>{formatEuroPerMonth(scenario?.monthly_gain ?? null)}</p>
                      <p style={{ margin: 0, fontSize: '10px', color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>{formatEuro(scenario?.projected_gain_on_scope ?? null)}</p>
                      <p style={{ margin: 0, fontSize: '10px', color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>{formatEuro(scenario?.projected_capacity_total ?? null)}</p>
                    </article>
                  )
                })}
              </div>
            </section>

            <section style={{ borderRadius: 'var(--radius-2xl)', border: '1px solid var(--neutral-150)', background: 'var(--neutral-0)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-2)' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                Plan d’action recommandé
              </p>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-600)' }}>
                {top3Labels.length > 0
                  ? `En optimisant ${top3Labels.join(', ')}, tu pourrais libérer environ ${formatEuroPerMonth(top3MonthlyGain)}, soit ${formatEuro(top3AnnualGain)} sur la période restante.`
                  : '—'}
              </p>
            </section>
          </>
        ) : null}
      </div>
    </section>
  )
}
