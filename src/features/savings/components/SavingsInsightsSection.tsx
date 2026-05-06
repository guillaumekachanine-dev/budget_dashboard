import { useSavingsAnalytics } from '@/features/savings/hooks/useSavingsAnalytics'
import type { SavingsMonthlyMetric } from '@/features/savings/types'
import {
  EmptyState,
  InsightCard,
  SkeletonCard,
  StatsSection,
  StatusBadge,
  formatEuro,
  formatEuroPerYear,
  formatInteger,
  formatPercent,
  resolveMonthShort,
  asFiniteNumber,
} from '@/features/stats/components/ui'

function findLastMetric(metrics: SavingsMonthlyMetric[]): SavingsMonthlyMetric | null {
  if (metrics.length === 0) return null

  for (let index = metrics.length - 1; index >= 0; index -= 1) {
    const savedAmount = asFiniteNumber(metrics[index].saved_amount)
    if ((savedAmount ?? 0) > 0) {
      return metrics[index]
    }
  }

  return metrics[metrics.length - 1] ?? null
}

type SavingsInsightsSectionProps = {
  year: number
}

export function SavingsInsightsSection({ year }: SavingsInsightsSectionProps) {
  const { data, isLoading, error } = useSavingsAnalytics(year)

  if (isLoading) {
    return (
      <StatsSection style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))' }}>
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={`savings-insight-skeleton-${index + 1}`} heightClass="h-20" lines={1} />
        ))}
      </StatsSection>
    )
  }

  if (error) {
    return (
      <StatsSection>
        <EmptyState message="Impossible de charger les insights d’épargne pour le moment." />
      </StatsSection>
    )
  }

  const monthlyMetrics = data?.monthlyMetrics ?? []
  const destinationBreakdown = data?.destinationBreakdown ?? []
  const currentSummary = data?.currentSummary ?? null
  const hasAnalyticsData = monthlyMetrics.length > 0 || destinationBreakdown.length > 0 || currentSummary != null

  if (!hasAnalyticsData) {
    return (
      <StatsSection>
        <EmptyState message="Aucune donnée analytique disponible pour l’épargne." />
      </StatsSection>
    )
  }

  const lastMetric = findLastMetric(monthlyMetrics)
  const lastMonthShort = resolveMonthShort(lastMetric?.period_month)
  const annualTotalSaved = monthlyMetrics.reduce((sum, metric) => {
    const value = asFiniteNumber(metric.saved_amount)
    return sum + (value ?? 0)
  }, 0)

  const destinationTotals = new Map<string, number>()
  for (const row of destinationBreakdown) {
    if (!row.destination_label) continue
    const value = asFiniteNumber(row.saved_amount)
    if (value == null) continue
    destinationTotals.set(row.destination_label, (destinationTotals.get(row.destination_label) ?? 0) + value)
  }

  let topDestinationLabel: string | null = null
  let topDestinationAmount: number | null = null
  for (const [label, value] of destinationTotals.entries()) {
    if (topDestinationAmount == null || value > topDestinationAmount) {
      topDestinationLabel = label
      topDestinationAmount = value
    }
  }

  const topDestinationShare = topDestinationAmount != null && annualTotalSaved > 0
    ? (topDestinationAmount / annualTotalSaved) * 100
    : null

  const monthsWithSavings = monthlyMetrics.reduce((count, metric) => {
    const savedAmount = asFiniteNumber(metric.saved_amount)
    return (savedAmount ?? 0) > 0 ? count + 1 : count
  }, 0)

  const monthNumbers = monthlyMetrics
    .map((metric) => asFiniteNumber(metric.period_month))
    .filter((month): month is number => month != null && month >= 1 && month <= 12)
  const monthsAvailable = monthNumbers.length > 0 ? Math.max(...monthNumbers) : 0

  const cards = [
    {
      title: 'Épargné ce mois',
      value: formatEuro(lastMetric?.saved_amount),
      detail: `${formatInteger(lastMetric?.transfer_count)} virements`,
      badge: lastMonthShort ? <StatusBadge label={lastMonthShort} tone="info" /> : undefined,
      tone: 'positive' as const,
    },
    {
      title: `Épargne cumulée ${year}`,
      value: formatEuro(lastMetric?.ytd_saved_amount),
      detail: 'Cumul de l’année en cours',
      tone: 'info' as const,
    },
    {
      title: 'Vitesse actuelle',
      value: formatEuroPerYear(lastMetric?.annualized_savings_speed_3m),
      detail: 'Projection basée sur la moyenne 3 mois',
      tone: 'premium' as const,
    },
    {
      title: 'Moyenne 3 mois',
      value: formatEuro(lastMetric?.savings_rolling_avg_3m),
      detail: 'Effort d’épargne lissé',
      tone: 'info' as const,
    },
    {
      title: 'Taux d’épargne',
      value: formatPercent(lastMetric?.savings_rate_on_income_pct),
      detail: 'Part des revenus épargnée',
      tone: 'positive' as const,
    },
    {
      title: 'Allocation',
      value: `${formatPercent(currentSummary?.livrets_share_pct)} livrets`,
      detail: `${formatPercent(currentSummary?.placements_share_pct)} placements`,
      tone: 'premium' as const,
    },
    {
      title: 'Destination principale',
      value: topDestinationLabel ?? '—',
      detail: topDestinationLabel
        ? `${formatEuro(topDestinationAmount)} • ${formatPercent(topDestinationShare)} du total annuel`
        : '—',
      tone: 'info' as const,
    },
    {
      title: 'Régularité',
      value: monthsAvailable > 0 ? `${monthsWithSavings}/${monthsAvailable} mois` : '—',
      detail: 'Mois avec effort d’épargne positif',
      tone: 'warning' as const,
    },
  ]

  return (
    <StatsSection style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))' }}>
      {cards.map((card) => (
        <InsightCard
          key={card.title}
          title={card.title}
          value={card.value}
          detail={card.detail}
          badge={card.badge}
          tone={card.tone}
        />
      ))}
    </StatsSection>
  )
}
