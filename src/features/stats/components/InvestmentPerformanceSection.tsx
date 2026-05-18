import { useState } from 'react'
import { useInvestmentPerformance } from '@/features/stats/hooks/useInvestmentPerformance'
import type {
  InvestmentAccountPerformanceSummary,
  InvestmentActionItem,
  InvestmentCashflow,
  InvestmentMonthlyPerformance,
} from '@/features/stats/types'
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
  extractYearFromDate,
  formatDateShort,
  formatEuro,
  formatMonthLabel,
  formatPercent,
  formatScore,
  type Tone,
} from '@/features/stats/components/ui'

type InvestmentYear = 2026 | 2025

const INVESTMENT_YEARS: InvestmentYear[] = [2026, 2025]

function formatMonthLabelFromRow(row: InvestmentMonthlyPerformance): string {
  const periodLabel = formatMonthLabel(row.period_month, row.period_year)
  if (periodLabel !== '—') return periodLabel

  if (!row.month_start) return '—'
  const date = new Date(row.month_start)
  if (Number.isNaN(date.getTime())) return '—'

  return formatMonthLabel(date.getMonth() + 1, date.getFullYear())
}

function resolveQualityStatusMeta(statusRaw: string | null | undefined): {
  label: string
  tone: Tone
} {
  const normalized = (statusRaw ?? '').toLowerCase()

  if (normalized === 'excellent') {
    return { label: 'Excellent', tone: 'positive' }
  }

  if (normalized === 'good') {
    return { label: 'Bon', tone: 'info' }
  }

  if (normalized === 'watch') {
    return { label: 'À surveiller', tone: 'warning' }
  }

  if (normalized === 'optimize') {
    return { label: 'À optimiser', tone: 'danger' }
  }

  return {
    label: statusRaw && statusRaw.trim().length > 0 ? statusRaw : '—',
    tone: 'neutral',
  }
}

function resolveFlowTypeLabel(flowTypeRaw: string | null | undefined): string {
  const normalized = (flowTypeRaw ?? '').toLowerCase()

  if (normalized === 'cash_in' || normalized === 'deposit' || normalized === 'buy') {
    return 'Versement'
  }
  if (normalized === 'cash_out' || normalized === 'withdrawal' || normalized === 'sell') {
    return 'Retrait'
  }
  if (normalized === 'dividend') {
    return 'Dividende'
  }
  if (normalized === 'fee') {
    return 'Frais'
  }

  return flowTypeRaw && flowTypeRaw.trim().length > 0 ? flowTypeRaw : '—'
}

function filterCashflowsByYear(cashflows: InvestmentCashflow[], selectedYear: number): InvestmentCashflow[] {
  return cashflows.filter((row) => {
    const year = extractYearFromDate(row.flow_date)
    if (year == null) return true
    return year === selectedYear
  })
}

function filterMonthlyPerformanceByYear(rows: InvestmentMonthlyPerformance[], selectedYear: number): InvestmentMonthlyPerformance[] {
  return rows.filter((row) => {
    const periodYear = asFiniteNumber(row.period_year)
    if (periodYear != null) return periodYear === selectedYear

    const derivedYear = extractYearFromDate(row.month_start)
    if (derivedYear == null) return true
    return derivedYear === selectedYear
  })
}

function sortActionsByPriorityDesc(actions: InvestmentActionItem[]): InvestmentActionItem[] {
  return [...actions].sort((left, right) => {
    const leftPriority = asFiniteNumber(left.priority) ?? Number.NEGATIVE_INFINITY
    const rightPriority = asFiniteNumber(right.priority) ?? Number.NEGATIVE_INFINITY
    return rightPriority - leftPriority
  })
}

function AccountPerformanceText({ row }: { row: InvestmentAccountPerformanceSummary }) {
  const gain = asFiniteNumber(row.estimated_gain_vs_total_cash_in)

  if (gain == null) {
    return (
      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)', fontWeight: 'var(--font-weight-semibold)' }}>
        Performance à consolider
      </p>
    )
  }

  const percentage = formatPercent(row.estimated_gain_vs_total_cash_in_pct)
  return (
    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: gain >= 0 ? 'var(--color-positive)' : 'var(--color-negative)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-semibold)' }}>
      {formatEuro(gain)} · {percentage}
    </p>
  )
}

export function InvestmentPerformanceSection() {
  const [selectedYear, setSelectedYear] = useState<InvestmentYear>(2026)
  const { data, isLoading, error } = useInvestmentPerformance(selectedYear)

  const globalSummary = data?.global_summary ?? null
  const accounts = data?.accounts ?? []
  const actions = data?.actions ?? []
  const latestPositions = data?.latest_positions ?? []
  const monthlyPerformance = filterMonthlyPerformanceByYear(data?.monthly_performance ?? [], selectedYear)
  const cashflows = filterCashflowsByYear(data?.cashflows ?? [], selectedYear)

  const hasAnyData = globalSummary != null
    || accounts.length > 0
    || actions.length > 0
    || latestPositions.length > 0
    || monthlyPerformance.length > 0
    || cashflows.length > 0

  const showHistoryConsolidation = Boolean(
    globalSummary
      && (monthlyPerformance.length === 0 || cashflows.length === 0),
  )

  const sortedActions = sortActionsByPriorityDesc(actions)
  const heroGainAmount = asFiniteNumber(globalSummary?.estimated_gain_vs_known_cash_in)

  return (
    <>
      <StatsSection>
        <SectionHeader
          title="Performance"
          subtitle="Performance des placements"
          rightSlot={<YearToggle years={INVESTMENT_YEARS} value={selectedYear} onChange={(year) => setSelectedYear(year as InvestmentYear)} />}
        />
      </StatsSection>

      {isLoading ? (
        <StatsSection style={{ gap: 'var(--space-3)' }}>
          <SkeletonCard heightClass="h-28" lines={2} />
          <SkeletonCard heightClass="h-52" lines={0} />
          <SkeletonCard heightClass="h-52" lines={0} />
          <SkeletonCard heightClass="h-48" lines={0} />
          <SkeletonCard heightClass="h-44" lines={0} />
        </StatsSection>
      ) : null}

      {!isLoading && error ? (
        <StatsSection>
          <EmptyState message="Impossible de charger la performance des placements pour le moment." />
        </StatsSection>
      ) : null}

      {!isLoading && !error && !data ? (
        <StatsSection>
          <EmptyState message="Aucune donnée de performance placement disponible." />
        </StatsSection>
      ) : null}

      {!isLoading && !error && data && !hasAnyData ? (
        <StatsSection>
          <EmptyState message="Aucune donnée de performance placement disponible." />
        </StatsSection>
      ) : null}

      {!isLoading && !error && data && hasAnyData ? (
        <StatsSection style={{ gap: 'var(--space-4)' }}>
          <HeroMetricCard
            title="Performance placements"
            value={formatEuro(globalSummary?.total_invested_value)}
            caption="Placements suivis"
            tone="premium"
            detail={globalSummary?.global_investment_insight ?? undefined}
            metrics={[
              { label: 'Cash non investi', value: formatEuro(globalSummary?.total_investment_cash) },
              {
                label: 'Performance estimée',
                value: heroGainAmount == null
                  ? 'Performance à consolider'
                  : `${formatEuro(heroGainAmount)} · ${formatPercent(globalSummary?.estimated_gain_vs_known_cash_in_pct)}`,
              },
              { label: 'Score qualité moyen', value: formatScore(globalSummary?.avg_quality_score) },
            ]}
            notice={
              heroGainAmount == null
                ? (
                    <DataQualityNotice
                      tone="warning"
                      title="Performance complète à consolider"
                      detail="Ajoute plus de snapshots et de flux pour fiabiliser le calcul."
                    />
                  )
                : undefined
            }
          />

          <SurfaceCard tone="neutral" padding="var(--space-4)">
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <SectionHeader title="Performance par enveloppe" />

              {accounts.length === 0 ? (
                <EmptyState message="Aucune enveloppe disponible." />
              ) : (
                accounts.map((account, index) => {
                  const quality = resolveQualityStatusMeta(account.quality_status)

                  return (
                    <article key={`${account.account_name ?? ''}-${index}`} style={{ border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                            {account.account_name ?? '—'}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', overflowWrap: 'anywhere' }}>
                            {[account.provider_name, account.product_name, account.envelope_type].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                        <StatusBadge label={quality.label} tone={quality.tone} />
                      </div>

                      <div style={{ display: 'grid', gap: 'var(--space-1)', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Valeur courante</p>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {formatEuro(account.current_value)}
                        </p>

                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Source</p>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', textAlign: 'right' }}>
                          {account.current_value_source ?? '—'}
                        </p>

                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Performance estimée</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <AccountPerformanceText row={account} />
                        </div>

                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Score qualité</p>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {formatScore(account.global_quality_score)}
                        </p>
                      </div>

                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-600)' }}>
                        {account.recommended_action ?? '—'}
                      </p>
                    </article>
                  )
                })
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard tone="neutral" padding="var(--space-4)">
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <SectionHeader title="Actions recommandées" />

              {sortedActions.length === 0 ? (
                <EmptyState message="Aucune action recommandée disponible." />
              ) : (
                sortedActions.map((action, index) => (
                  <article key={`${action.action_title ?? ''}-${index}`} style={{ border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                          {action.action_title ?? '—'}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>
                          {action.account_name ?? '—'}
                        </p>
                      </div>
                      <StatusBadge
                        label={asFiniteNumber(action.priority) == null ? '—' : `Priorité ${Math.round(action.priority ?? 0)}`}
                        tone="info"
                      />
                    </div>

                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)' }}>
                      {action.action_description ?? '—'}
                    </p>

                    <div style={{ display: 'grid', gap: 'var(--space-1)', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Impact attendu</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', textAlign: 'right' }}>{action.expected_impact_label ?? '—'}</p>

                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Économie annuelle estimée</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatEuro(action.expected_annual_saving)}</p>

                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Amélioration perf.</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', textAlign: 'right' }}>{action.expected_performance_improvement_label ?? '—'}</p>

                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Statut</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', textAlign: 'right' }}>{action.status ?? '—'}</p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard tone="neutral" padding="var(--space-4)">
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <SectionHeader title="Dernières positions" />

              {latestPositions.length === 0 ? (
                <EmptyState message="Aucune position récente disponible." />
              ) : (
                latestPositions.map((position, index) => (
                  <article key={`${position.asset_name ?? ''}-${position.snapshot_date ?? ''}-${index}`} style={{ border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                        {position.asset_name ?? '—'}
                      </p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>
                        {formatDateShort(position.snapshot_date)}
                      </p>
                    </div>

                    <div style={{ display: 'grid', gap: 'var(--space-1)', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Unités</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {asFiniteNumber(position.units) == null
                          ? '—'
                          : new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(position.units ?? 0)}
                      </p>

                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Prix unitaire</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {formatEuro(position.unit_price)}
                      </p>

                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Valeur marché</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {formatEuro(position.market_value)}
                      </p>

                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Cash</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {formatEuro(position.cash_value)}
                      </p>

                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>Valeur totale</p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {formatEuro(position.total_value)}
                      </p>
                    </div>

                    <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-600)' }}>
                      {position.source_document ?? '—'}
                    </p>
                  </article>
                ))
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard tone="neutral" padding="var(--space-4)">
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <SectionHeader title={`Historique ${selectedYear}`} subtitle="Performance mensuelle et cashflows" />

              {showHistoryConsolidation ? (
                <DataQualityNotice
                  tone="info"
                  title="Historique de performance en consolidation"
                  detail="Les prochains snapshots mensuels permettront d’affiner la performance hors versements."
                />
              ) : null}

              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Performance mensuelle
                </p>

                {monthlyPerformance.length === 0 ? (
                  <EmptyState message="—" />
                ) : (
                  <MonthlyTimeline
                    items={monthlyPerformance.map((row, index) => ({
                      key: `${row.month_start ?? ''}-${row.period_year ?? ''}-${row.period_month ?? ''}-${index}`,
                      title: formatMonthLabelFromRow(row),
                      badge: <StatusBadge label={`Score ${formatScore(row.quality_score)}`} tone="neutral" />,
                      metrics: [
                        { label: 'Valeur totale', value: formatEuro(row.total_value) },
                        { label: 'Cash in / Cash out', value: `${formatEuro(row.total_cash_in)} / ${formatEuro(row.total_cash_out)}` },
                        { label: 'Gain estimé', value: `${formatEuro(row.net_gain)} · ${formatPercent(row.net_gain_pct)}` },
                        { label: 'Perf. mensuelle', value: `${formatEuro(row.monthly_return)} · ${formatPercent(row.monthly_return_pct)}` },
                      ],
                    }))}
                  />
                )}
              </div>

              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Cashflows connus
                </p>

                {cashflows.length === 0 ? (
                  <EmptyState message="—" />
                ) : (
                  cashflows.map((flow, index) => (
                    <article key={`${flow.flow_date ?? ''}-${flow.account_name ?? ''}-${flow.amount ?? ''}-${index}`} style={{ border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-1)' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                          {flow.account_name ?? '—'}
                        </p>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-semibold)' }}>
                          {formatEuro(flow.amount)}
                        </p>
                      </div>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>
                        {formatDateShort(flow.flow_date)} · {resolveFlowTypeLabel(flow.flow_type)}
                      </p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-600)' }}>
                        {flow.description ?? '—'}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </div>
          </SurfaceCard>
        </StatsSection>
      ) : null}
    </>
  )
}
