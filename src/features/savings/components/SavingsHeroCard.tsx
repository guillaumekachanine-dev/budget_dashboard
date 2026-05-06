import { Skeleton } from '@/components/ui/Skeleton'
import { useSavingsCurrentSummary } from '@/features/savings/hooks/useSavingsCurrentSummary'
import {
  CompactStatGrid,
  DataQualityNotice,
  HeroMetricCard,
  MetricCard,
  StatsSection,
  formatEuro,
  formatPercent,
} from '@/features/stats/components/ui'

export function SavingsHeroCard() {
  const { data, isLoading, error } = useSavingsCurrentSummary()

  if (isLoading) {
    return (
      <StatsSection>
        <div
          style={{
            borderRadius: 'var(--radius-2xl)',
            border: '1px solid color-mix(in oklab, var(--color-positive) 24%, var(--neutral-0) 76%)',
            background: 'linear-gradient(135deg, color-mix(in oklab, var(--color-positive) 80%, var(--primary-700) 20%) 0%, color-mix(in oklab, var(--color-positive) 86%, var(--primary-600) 14%) 100%)',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-card)',
            display: 'grid',
            gap: 'var(--space-3)',
          }}
        >
          <Skeleton className="h-4 w-36 bg-white/25" />
          <Skeleton className="h-10 w-44 bg-white/25" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-2)' }}>
            <Skeleton className="h-20 w-full bg-white/25" />
            <Skeleton className="h-20 w-full bg-white/25" />
          </div>
        </div>
      </StatsSection>
    )
  }

  const notice = error
    ? {
        title: 'Données indisponibles pour le moment',
        detail: 'La synthèse épargne sera réaffichée dès la prochaine actualisation.',
      }
    : !data
      ? {
          title: 'Aucune donnée d’épargne disponible',
          detail: 'Connecte au moins un compte d’épargne pour alimenter cette section.',
        }
      : null

  return (
    <StatsSection>
      <HeroMetricCard
        title="Patrimoine épargne"
        value={data ? formatEuro(data.total_savings) : '—'}
        caption="Total actuel"
        tone="positive"
        metrics={[]}
        notice={notice ? <DataQualityNotice title={notice.title} detail={notice.detail} tone={error ? 'warning' : 'neutral'} /> : null}
      />

      {data ? (
        <CompactStatGrid minItemWidth={145}>
          <MetricCard
            label="Livrets"
            value={formatEuro(data.livrets_total)}
            detail={formatPercent(data.livrets_share_pct)}
            tone="positive"
          />
          <MetricCard
            label="Placements"
            value={formatEuro(data.placements_total)}
            detail={formatPercent(data.placements_share_pct)}
            tone="premium"
          />
        </CompactStatGrid>
      ) : null}
    </StatsSection>
  )
}
