import { Skeleton } from '@/components/ui/Skeleton'
import { useFinancialSecurity } from '@/features/savings/hooks/useFinancialSecurity'
import type { FinancialSecurityStatus } from '@/features/savings/types'

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

function formatEuroSigned(value: number | null | undefined): string {
  const numeric = asFiniteNumber(value)
  if (numeric == null) return '—'
  const sign = numeric > 0 ? '+' : ''
  return `${sign}${formatEuro(numeric)}`
}

function formatMonths(value: number | null | undefined): string {
  const numeric = asFiniteNumber(value)
  if (numeric == null) return '—'
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(numeric)
}

function formatMonthLabel(periodMonth: number | null | undefined, periodYear: number | null | undefined): string {
  const month = asFiniteNumber(periodMonth)
  if (month == null || month < 1 || month > 12) return '—'
  const monthLabel = MONTH_SHORT_FR[month - 1] ?? '—'
  const year = asFiniteNumber(periodYear)
  return year == null ? monthLabel : `${monthLabel} ${year}`
}

function resolveStatusMeta(statusRaw: string | null | undefined): {
  label: string
  textColor: string
  badgeTextColor: string
  badgeBackground: string
  cardBackground: string
  cardBorder: string
} {
  const status = (statusRaw ?? 'insufficient_data') as FinancialSecurityStatus

  if (status === 'critical') {
    return {
      label: 'Critique',
      textColor: 'var(--color-negative)',
      badgeTextColor: 'var(--color-negative)',
      badgeBackground: 'color-mix(in oklab, var(--color-negative) 14%, var(--neutral-0) 86%)',
      cardBackground: 'color-mix(in oklab, var(--color-negative) 5%, var(--neutral-0) 95%)',
      cardBorder: 'color-mix(in oklab, var(--color-negative) 26%, var(--neutral-0) 74%)',
    }
  }

  if (status === 'building') {
    return {
      label: 'À renforcer',
      textColor: 'var(--color-warning)',
      badgeTextColor: 'var(--color-warning)',
      badgeBackground: 'color-mix(in oklab, var(--color-warning) 14%, var(--neutral-0) 86%)',
      cardBackground: 'color-mix(in oklab, var(--color-warning) 5%, var(--neutral-0) 95%)',
      cardBorder: 'color-mix(in oklab, var(--color-warning) 26%, var(--neutral-0) 74%)',
    }
  }

  if (status === 'comfortable') {
    return {
      label: 'Confortable',
      textColor: 'var(--primary-700)',
      badgeTextColor: 'var(--primary-700)',
      badgeBackground: 'color-mix(in oklab, var(--primary-500) 14%, var(--neutral-0) 86%)',
      cardBackground: 'color-mix(in oklab, var(--primary-500) 6%, var(--neutral-0) 94%)',
      cardBorder: 'color-mix(in oklab, var(--primary-500) 24%, var(--neutral-0) 76%)',
    }
  }

  if (status === 'premium_reached') {
    return {
      label: 'Objectif atteint',
      textColor: 'var(--color-positive)',
      badgeTextColor: 'var(--color-positive)',
      badgeBackground: 'color-mix(in oklab, var(--color-positive) 14%, var(--neutral-0) 86%)',
      cardBackground: 'color-mix(in oklab, var(--color-positive) 6%, var(--neutral-0) 94%)',
      cardBorder: 'color-mix(in oklab, var(--color-positive) 24%, var(--neutral-0) 76%)',
    }
  }

  return {
    label: 'Données insuffisantes',
    textColor: 'var(--neutral-600)',
    badgeTextColor: 'var(--neutral-700)',
    badgeBackground: 'var(--neutral-100)',
    cardBackground: 'var(--neutral-0)',
    cardBorder: 'var(--neutral-200)',
  }
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--neutral-0)', border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-bold)' }}>{value}</p>
    </div>
  )
}

export function FinancialSecurityCard() {
  const { data, isLoading, error } = useFinancialSecurity()

  if (isLoading) {
    return (
      <section style={{ padding: '0 var(--space-6)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-5)', display: 'grid', gap: 'var(--space-3)' }}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-4 w-full" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-2)' }}>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section style={{ padding: '0 var(--space-6)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-5)' }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>Sécurité financière</p>
          <p style={{ margin: '8px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-600)' }}>
            Impossible de charger le matelas de sécurité pour le moment.
          </p>
        </div>
      </section>
    )
  }

  const summary = data?.summary
  if (!data || !summary) {
    return (
      <section style={{ padding: '0 var(--space-6)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-5)' }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>Sécurité financière</p>
          <p style={{ margin: '8px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-600)' }}>
            Données insuffisantes pour calculer le matelas de sécurité.
          </p>
        </div>
      </section>
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
    <section style={{ padding: '0 var(--space-6)' }}>
      <div
        style={{
          maxWidth: 600,
          margin: '0 auto',
          borderRadius: 'var(--radius-2xl)',
          border: `1px solid ${statusMeta.cardBorder}`,
          background: statusMeta.cardBackground,
          boxShadow: 'var(--shadow-card)',
          padding: 'var(--space-5)',
          display: 'grid',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
            Sécurité financière
          </p>
          <span style={{ fontSize: '11px', color: statusMeta.badgeTextColor, background: statusMeta.badgeBackground, borderRadius: 'var(--radius-full)', padding: '3px 10px', fontWeight: 'var(--font-weight-semibold)' }}>
            {statusMeta.label}
          </span>
        </div>

        <div>
          <p style={{ margin: 0, fontSize: '34px', lineHeight: 1.1, fontFamily: 'var(--font-mono)', color: statusMeta.textColor, fontWeight: 'var(--font-weight-extrabold)' }}>
            {formatMonths(summary.security_months_reference)} mois
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-600)' }}>
            Sur la base de tes dépenses essentielles moyennes
          </p>
        </div>

        <div style={{ display: 'grid', gap: 'var(--space-2)', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <DetailMetric label="Épargne liquide" value={formatEuro(summary.liquid_savings_total)} />
          <DetailMetric label="Dépenses essentielles moyennes" value={`${formatEuro(summary.reference_essential_monthly_spending)} / mois`} />
          <DetailMetric label="Objectif 6 mois" value={formatEuro(summary.comfort_target_amount)} />
          <DetailMetric label="Objectif 12 mois" value={formatEuro(summary.premium_target_amount)} />
        </div>

        <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', padding: 'var(--space-3)' }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Insight</p>
          <p style={{ margin: '5px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)' }}>
            {summary.security_insight ?? '—'}
          </p>
        </div>

        <div style={{ display: 'grid', gap: 'var(--space-2)', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <DetailMetric label="Moyenne 3 mois" value={formatEuro(summary.essential_avg_3m)} />
          <DetailMetric label="Moyenne 6 mois" value={formatEuro(summary.essential_avg_6m)} />
          <DetailMetric label="Moyenne 12 mois" value={formatEuro(summary.essential_avg_12m)} />
        </div>

        <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Écart objectif 12 mois</p>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-bold)' }}>
              {premiumGap == null ? '—' : (premiumGap >= 0 ? `Excédent : ${formatEuroSigned(premiumGap)}` : `Manque : ${formatEuroSigned(premiumGap)}`)}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Effort nécessaire</p>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-bold)' }}>
              {isPremiumReached
                ? 'Aucun effort supplémentaire requis pour l’objectif 12 mois'
                : (monthlyEffort12m === '—' ? '—' : `${monthlyEffort12m} / mois pendant 12 mois`)}
            </p>
          </div>
        </div>

        {monthlyEssentials.length > 0 ? (
          <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', padding: 'var(--space-3)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>6 derniers mois essentiels</p>
            <div style={{ display: 'grid', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}>
              {monthlyEssentials.map((row) => (
                <div
                  key={`${row.month_start ?? ''}-${row.period_year ?? ''}-${row.period_month ?? ''}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}
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
          </div>
        ) : null}
      </div>
    </section>
  )
}
