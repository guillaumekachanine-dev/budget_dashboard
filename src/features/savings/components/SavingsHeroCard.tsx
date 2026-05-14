import { useMemo } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { useSavingsAnalytics } from '@/features/savings/hooks/useSavingsAnalytics'
import { useSavingsCurrentSummary } from '@/features/savings/hooks/useSavingsCurrentSummary'
import type { SavingsMonthlyMetric } from '@/features/savings/types'
import {
  DataQualityNotice,
  StatsSection,
  asFiniteNumber,
  formatEuro,
  formatPercent,
} from '@/features/stats/components/ui'

function findLatestMetric(metrics: SavingsMonthlyMetric[]): SavingsMonthlyMetric | null {
  if (metrics.length === 0) return null

  for (let index = metrics.length - 1; index >= 0; index -= 1) {
    const amount = asFiniteNumber(metrics[index].ytd_saved_amount)
    if (amount != null) return metrics[index]
  }

  return metrics[metrics.length - 1] ?? null
}

function findMetricForMonth(metrics: SavingsMonthlyMetric[], month: number): SavingsMonthlyMetric | null {
  if (metrics.length === 0) return null

  const exact = metrics.find((metric) => asFiniteNumber(metric.period_month) === month)
  if (exact) return exact

  for (let index = metrics.length - 1; index >= 0; index -= 1) {
    const metricMonth = asFiniteNumber(metrics[index].period_month)
    if (metricMonth != null && metricMonth <= month) {
      return metrics[index]
    }
  }

  return findLatestMetric(metrics)
}

function computeVariationPct(current: number | null, reference: number | null): number | null {
  if (current == null || reference == null || reference === 0) return null
  return ((current - reference) / Math.abs(reference)) * 100
}

function formatSignedPercent(value: number | null): string {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)} %`
}

export function SavingsHeroCard() {
  const { data, isLoading, error } = useSavingsCurrentSummary()
  const analytics2026 = useSavingsAnalytics(2026)
  const analytics2025 = useSavingsAnalytics(2025)

  const {
    ytdSaved2026,
    ytdVs2025Pct,
    monthlySavingsTarget,
  } = useMemo(() => {
    const metrics2026 = analytics2026.data?.monthlyMetrics ?? []
    const metrics2025 = analytics2025.data?.monthlyMetrics ?? []

    const latest2026 = findLatestMetric(metrics2026)
    const month2026 = asFiniteNumber(latest2026?.period_month)
    const ytdSaved2026Value = asFiniteNumber(latest2026?.ytd_saved_amount)
    const targetValue = asFiniteNumber(latest2026?.savings_budget_total)

    const reference2025 = month2026 != null
      ? findMetricForMonth(metrics2025, month2026)
      : findLatestMetric(metrics2025)

    const ytdSaved2025 = asFiniteNumber(reference2025?.ytd_saved_amount)

    return {
      ytdSaved2026: ytdSaved2026Value,
      ytdVs2025Pct: computeVariationPct(ytdSaved2026Value, ytdSaved2025),
      monthlySavingsTarget: targetValue,
    }
  }, [analytics2025.data?.monthlyMetrics, analytics2026.data?.monthlyMetrics])

  if (isLoading) {
    return (
      <StatsSection>
        <div
          style={{
            borderRadius: 'var(--radius-2xl)',
            border: '1px solid color-mix(in oklab, var(--color-positive) 26%, var(--neutral-0) 74%)',
            background: 'linear-gradient(136deg, color-mix(in oklab, var(--color-positive) 90%, var(--neutral-900) 10%) 0%, color-mix(in oklab, var(--color-positive) 74%, var(--neutral-900) 26%) 56%, color-mix(in oklab, var(--color-positive) 54%, var(--neutral-900) 46%) 100%)',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-card)',
            display: 'grid',
            gap: 'var(--space-3)',
          }}
        >
          <Skeleton className="h-4 w-36 bg-white/25" />
          <Skeleton className="h-10 w-44 bg-white/25" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--space-2)' }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`savings-hero-kpi-skeleton-${index + 1}`} className="h-16 w-full bg-white/25" />
            ))}
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
      <div
        style={{
          background: 'linear-gradient(136deg, color-mix(in oklab, var(--color-positive) 90%, var(--neutral-900) 10%) 0%, color-mix(in oklab, var(--color-positive) 74%, var(--neutral-900) 26%) 56%, color-mix(in oklab, var(--color-positive) 54%, var(--neutral-900) 46%) 100%)',
          borderRadius: 'var(--radius-2xl)',
          border: '1px solid color-mix(in oklab, var(--color-positive) 28%, var(--neutral-0) 72%)',
          padding: 'var(--space-5)',
          boxShadow: 'var(--shadow-card)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            position: 'absolute',
            right: -10,
            bottom: -18,
            fontSize: 92,
            fontWeight: 900,
            fontFamily: 'var(--font-mono)',
            color: 'rgba(255,255,255,0.06)',
            lineHeight: 1,
            userSelect: 'none',
            pointerEvents: 'none',
            letterSpacing: '-0.04em',
          }}
        >
          EPARGNE
        </span>

        <div
          style={{
            position: 'absolute',
            top: -66,
            right: -54,
            width: 190,
            height: 190,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(46,212,122,0.34) 0%, transparent 72%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 'var(--space-2)' }}>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'rgba(255,255,255,0.62)',
              textTransform: 'uppercase',
              letterSpacing: '0.09em',
            }}
          >
            Patrimoine épargne
          </p>

          <p
            style={{
              margin: 0,
              fontSize: 'clamp(28px, 8vw, 40px)',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              color: 'var(--neutral-0)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            {data ? formatEuro(data.total_savings) : '—'}
          </p>

          <p
            style={{
              margin: 0,
              fontSize: '11px',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'rgba(255,255,255,0.72)',
              letterSpacing: '0.03em',
            }}
          >
            Répartition et rythme d’épargne
          </p>

          <div style={{ margin: 'var(--space-3) 0 var(--space-2)', height: 1, background: 'rgba(255,255,255,0.16)' }} />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 'var(--space-2)',
              alignItems: 'start',
            }}
          >
            <div style={{ minWidth: 0, display: 'grid', gap: '2px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.46)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                livrets
              </p>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.96)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatEuro(data?.livrets_total ?? null).replace(/\s+€/u, '€')}
              </p>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.72)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatPercent(data?.livrets_share_pct)}
              </p>
            </div>

            <div style={{ minWidth: 0, display: 'grid', gap: '2px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.46)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                placements
              </p>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.96)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatEuro(data?.placements_total ?? null).replace(/\s+€/u, '€')}
              </p>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.72)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatPercent(data?.placements_share_pct)}
              </p>
            </div>

            <div style={{ minWidth: 0, display: 'grid', gap: '2px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.46)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                épargné 2026 ytd
              </p>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.96)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatEuro(ytdSaved2026).replace(/\s+€/u, '€')}
              </p>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.72)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {`vs 2025 ${formatSignedPercent(ytdVs2025Pct)}`}
              </p>
            </div>

            <div style={{ minWidth: 0, display: 'grid', gap: '2px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.46)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                objectif mensuel
              </p>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.96)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatEuro(monthlySavingsTarget).replace(/\s+€/u, '€')}
              </p>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.72)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                budget épargne
              </p>
            </div>
          </div>

          {notice ? (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <DataQualityNotice
                title={notice.title}
                detail={notice.detail}
                tone={error ? 'warning' : 'neutral'}
              />
            </div>
          ) : null}
        </div>
      </div>
    </StatsSection>
  )
}
