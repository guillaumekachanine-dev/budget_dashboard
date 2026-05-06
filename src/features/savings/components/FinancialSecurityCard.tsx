import { useFinancialSecurity } from '@/features/savings/hooks/useFinancialSecurity'
import type { FinancialSecurityStatus } from '@/features/savings/types'
import {
  CompactStatGrid,
  DataQualityNotice,
  EmptyState,
  MetricCard,
  SkeletonCard,
  StatsSection,
  StatusBadge,
  SurfaceCard,
  formatEuro,
  formatMonths,
  formatMonthLabel,
  formatSignedEuro,
  asFiniteNumber,
  type Tone,
} from '@/features/stats/components/ui'

function resolveStatusMeta(statusRaw: string | null | undefined): {
  label: string
  tone: Tone
} {
  const status = (statusRaw ?? 'insufficient_data') as FinancialSecurityStatus

  if (status === 'critical') {
    return { label: 'Critique', tone: 'danger' }
  }

  if (status === 'building') {
    return { label: 'À renforcer', tone: 'warning' }
  }

  if (status === 'comfortable') {
    return { label: 'Confortable', tone: 'info' }
  }

  if (status === 'premium_reached') {
    return { label: 'Objectif atteint', tone: 'positive' }
  }

  return { label: 'Données insuffisantes', tone: 'neutral' }
}

export function FinancialSecurityCard() {
  const { data, isLoading, error } = useFinancialSecurity()

  if (isLoading) {
    return (
      <StatsSection>
        <SkeletonCard heightClass="h-28" lines={3} />
      </StatsSection>
    )
  }

  if (error) {
    return (
      <StatsSection>
        <EmptyState message="Impossible de charger le matelas de sécurité pour le moment." />
      </StatsSection>
    )
  }

  const summary = data?.summary
  if (!data || !summary) {
    return (
      <StatsSection>
        <EmptyState message="Données insuffisantes pour calculer le matelas de sécurité." />
      </StatsSection>
    )
  }

  const statusMeta = resolveStatusMeta(summary.security_status)
  const premiumGap = asFiniteNumber(summary.premium_target_surplus_or_gap)
  const isPremiumReached = premiumGap != null ? premiumGap >= 0 : summary.security_status === 'premium_reached'
  const monthlyEffort12m = formatEuro(summary.monthly_effort_to_premium_target_in_12m)

  const monthlyEssentials = [...(data.monthly_essentials ?? [])]
    .sort((a, b) => {
      const yearA = asFiniteNumber(a.period_year) ?? 0
      const yearB = asFiniteNumber(b.period_year) ?? 0
      if (yearA !== yearB) return yearB - yearA

      const monthA = asFiniteNumber(a.period_month) ?? 0
      const monthB = asFiniteNumber(b.period_month) ?? 0
      return monthB - monthA
    })
    .slice(0, 6)

  return (
    <StatsSection>
      <SurfaceCard tone={statusMeta.tone} padding="var(--space-5)">
        <div style={{ display: 'grid', gap: 'var(--space-4)', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
              Sécurité financière
            </p>
            <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
          </div>

          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 'clamp(30px, 7vw, 36px)', lineHeight: 1.08, fontFamily: 'var(--font-mono)', color: statusMeta.tone === 'neutral' ? 'var(--neutral-900)' : undefined, fontWeight: 'var(--font-weight-extrabold)', overflowWrap: 'anywhere' }}>
              {formatMonths(summary.security_months_reference)} mois
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-600)' }}>
              Sur la base de tes dépenses essentielles moyennes
            </p>
          </div>

          <CompactStatGrid minItemWidth={145}>
            <MetricCard label="Épargne liquide" value={formatEuro(summary.liquid_savings_total)} tone="positive" compact />
            <MetricCard label="Dépenses essentielles" value={formatEuro(summary.reference_essential_monthly_spending)} detail="/ mois" tone="warning" compact />
            <MetricCard label="Objectif 6 mois" value={formatEuro(summary.comfort_target_amount)} tone="info" compact />
            <MetricCard label="Objectif 12 mois" value={formatEuro(summary.premium_target_amount)} tone="premium" compact />
          </CompactStatGrid>

          <DataQualityNotice
            title="Insight"
            detail={summary.security_insight ?? '—'}
            tone={statusMeta.tone}
          />

          <CompactStatGrid minItemWidth={120}>
            <MetricCard label="Moyenne 3 mois" value={formatEuro(summary.essential_avg_3m)} compact />
            <MetricCard label="Moyenne 6 mois" value={formatEuro(summary.essential_avg_6m)} compact />
            <MetricCard label="Moyenne 12 mois" value={formatEuro(summary.essential_avg_12m)} compact />
          </CompactStatGrid>

          <SurfaceCard tone="neutral" padding="var(--space-3)">
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <p style={{ margin: 0, fontSize: '10px', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Écart objectif 12 mois
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-bold)', overflowWrap: 'anywhere' }}>
                  {premiumGap == null ? '—' : (premiumGap >= 0 ? `Excédent : ${formatSignedEuro(premiumGap)}` : `Manque : ${formatSignedEuro(premiumGap)}`)}
                </p>
              </div>

              <div style={{ display: 'grid', gap: '4px' }}>
                <p style={{ margin: 0, fontSize: '10px', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Effort nécessaire
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-semibold)', overflowWrap: 'anywhere' }}>
                  {isPremiumReached
                    ? 'Aucun effort supplémentaire requis pour l’objectif 12 mois'
                    : (monthlyEffort12m === '—' ? '—' : `${monthlyEffort12m} / mois pendant 12 mois`)}
                </p>
              </div>
            </div>
          </SurfaceCard>

          {monthlyEssentials.length > 0 ? (
            <SurfaceCard tone="neutral" padding="var(--space-3)">
              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                <p style={{ margin: 0, fontSize: '10px', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  6 derniers mois essentiels
                </p>
                {monthlyEssentials.map((row) => (
                  <div
                    key={`${row.month_start ?? ''}-${row.period_year ?? ''}-${row.period_month ?? ''}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', minWidth: 0 }}
                  >
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-600)' }}>
                      {formatMonthLabel(row.period_month, row.period_year)}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-semibold)' }}>
                      {formatEuro(row.essential_spending_total)}
                    </span>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          ) : null}
        </div>
      </SurfaceCard>
    </StatsSection>
  )
}
