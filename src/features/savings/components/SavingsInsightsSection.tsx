import { Skeleton } from '@/components/ui/Skeleton'
import { useSavingsAnalytics } from '@/features/savings/hooks/useSavingsAnalytics'
import type { SavingsMonthlyMetric } from '@/features/savings/types'

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

function formatEuroPerYear(value: number | null | undefined): string {
  const amount = formatEuro(value)
  if (amount === '—') return amount
  return `${amount} / an`
}

function formatPercent(value: number | null | undefined): string {
  const numeric = asFiniteNumber(value)
  if (numeric == null) return '—'
  const normalized = Math.abs(numeric) <= 1 ? numeric * 100 : numeric
  return `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(normalized)} %`
}

function formatInteger(value: number | null | undefined): string {
  const numeric = asFiniteNumber(value)
  if (numeric == null) return '—'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(numeric)
}

function resolveMonthShort(month: number | null | undefined): string | null {
  const numeric = asFiniteNumber(month)
  if (numeric == null) return null
  if (numeric < 1 || numeric > 12) return null
  return MONTH_SHORT_FR[numeric - 1] ?? null
}

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

type InsightCardProps = {
  title: string
  value: string
  detail: string
  badge?: string | null
}

function InsightCard({ title, value, detail, badge }: InsightCardProps) {
  return (
    <article
      style={{
        background: 'var(--neutral-0)',
        border: '1px solid var(--neutral-150)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        padding: 'var(--space-4)',
        display: 'grid',
        gap: 'var(--space-2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 'var(--font-weight-semibold)' }}>
          {title}
        </p>
        {badge ? (
          <span style={{ fontSize: 10, color: 'var(--primary-700)', background: 'color-mix(in oklab, var(--primary-500) 14%, var(--neutral-0) 86%)', border: '1px solid color-mix(in oklab, var(--primary-500) 22%, var(--neutral-0) 78%)', borderRadius: 'var(--radius-full)', padding: '2px 7px', fontWeight: 'var(--font-weight-semibold)' }}>
            {badge}
          </span>
        ) : null}
      </div>

      <p style={{ margin: 0, fontSize: 'var(--font-size-xl)', lineHeight: 1.2, fontWeight: 'var(--font-weight-extrabold)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </p>

      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>
        {detail}
      </p>
    </article>
  )
}

type SavingsInsightsSectionProps = {
  year: number
}

export function SavingsInsightsSection({ year }: SavingsInsightsSectionProps) {
  const { data, isLoading, error } = useSavingsAnalytics(year)

  if (isLoading) {
    return (
      <section style={{ padding: '0 var(--space-6)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-3)', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))' }}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={`savings-insight-skeleton-${index + 1}`} className="h-28 w-full" />
          ))}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section style={{ padding: '0 var(--space-6)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', borderRadius: 'var(--radius-xl)', border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', padding: 'var(--space-4)', color: 'var(--neutral-600)', fontSize: 'var(--font-size-sm)' }}>
          Impossible de charger les insights d’épargne pour le moment.
        </div>
      </section>
    )
  }

  const monthlyMetrics = data?.monthlyMetrics ?? []
  const destinationBreakdown = data?.destinationBreakdown ?? []
  const currentSummary = data?.currentSummary ?? null
  const hasAnalyticsData = monthlyMetrics.length > 0 || destinationBreakdown.length > 0 || currentSummary != null

  if (!hasAnalyticsData) {
    return (
      <section style={{ padding: '0 var(--space-6)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', borderRadius: 'var(--radius-xl)', border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', padding: 'var(--space-4)', color: 'var(--neutral-600)', fontSize: 'var(--font-size-sm)' }}>
          Aucune donnée analytique disponible pour l’épargne.
        </div>
      </section>
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

  const cards: InsightCardProps[] = [
    {
      title: 'Épargné ce mois',
      value: formatEuro(lastMetric?.saved_amount),
      detail: `${formatInteger(lastMetric?.transfer_count)} virements`,
      badge: lastMonthShort,
    },
    {
      title: `Épargne cumulée ${year}`,
      value: formatEuro(lastMetric?.ytd_saved_amount),
      detail: 'Cumul de l’année en cours',
    },
    {
      title: 'Vitesse actuelle',
      value: formatEuroPerYear(lastMetric?.annualized_savings_speed_3m),
      detail: 'Projection basée sur la moyenne 3 mois',
    },
    {
      title: 'Moyenne 3 mois',
      value: formatEuro(lastMetric?.savings_rolling_avg_3m),
      detail: 'Effort d’épargne lissé',
    },
    {
      title: 'Taux d’épargne',
      value: formatPercent(lastMetric?.savings_rate_on_income_pct),
      detail: 'Part des revenus épargnée',
    },
    {
      title: 'Allocation',
      value: `${formatPercent(currentSummary?.livrets_share_pct)} livrets`,
      detail: `${formatPercent(currentSummary?.placements_share_pct)} placements`,
    },
    {
      title: 'Destination principale',
      value: topDestinationLabel ?? '—',
      detail: topDestinationLabel
        ? `${formatEuro(topDestinationAmount)} • ${formatPercent(topDestinationShare)} du total annuel`
        : '—',
    },
    {
      title: 'Régularité',
      value: monthsAvailable > 0 ? `${monthsWithSavings}/${monthsAvailable} mois` : '—',
      detail: 'Mois avec effort d’épargne positif',
    },
  ]

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-3)', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))' }}>
        {cards.map((card) => (
          <InsightCard
            key={card.title}
            title={card.title}
            value={card.value}
            detail={card.detail}
            badge={card.badge}
          />
        ))}
      </div>
    </section>
  )
}
