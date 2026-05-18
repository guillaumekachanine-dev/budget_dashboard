import { Skeleton } from '@/components/ui/Skeleton'
import { useSavingsCurrentSummary } from '@/features/savings/hooks/useSavingsCurrentSummary'
import epargneCapitalInvestiIcon from '@/assets/icons/app/epargne_capital_investi.png'
import epargnePerformanceIcon from '@/assets/icons/app/epargne_performance.png'
import epargnePlanning2026Icon from '@/assets/icons/app/epargne_planning_2026.png'
import epargneRepartitionIcon from '@/assets/icons/app/epargne_repartition.png'
import repartitionEpargneIcon from '@/assets/icons/app/repartition_epargne.png'
import {
  DataQualityNotice,
  StatsSection,
  formatEuro,
} from '@/features/stats/components/ui'

type SavingsHeroCardProps = {
  onOpenAllocationModal?: () => void
}

export function SavingsHeroCard({ onOpenAllocationModal }: SavingsHeroCardProps) {
  const { data, isLoading, error } = useSavingsCurrentSummary()

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
        {onOpenAllocationModal ? (
          <button
            type="button"
            onClick={onOpenAllocationModal}
            aria-label="Ouvrir la répartition de l'épargne"
            title="Répartition"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              transform: 'translate(18%, -18%)',
              transformOrigin: 'top right',
              zIndex: 3,
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={repartitionEpargneIcon}
              alt=""
              aria-hidden="true"
              style={{
                width: 204,
                height: 204,
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </button>
        ) : null}

        <span
          style={{
            position: 'absolute',
            right: -16,
            top: -14,
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
              alignItems: 'center',
            }}
          >
            <div style={{ minWidth: 0, display: 'flex', justifyContent: 'center' }}>
              <img src={epargneRepartitionIcon} alt="" aria-hidden="true" width={42} height={42} style={{ width: 42, height: 42, objectFit: 'contain' }} loading="lazy" decoding="async" />
            </div>
            <div style={{ minWidth: 0, display: 'flex', justifyContent: 'center' }}>
              <img src={epargnePlanning2026Icon} alt="" aria-hidden="true" width={34} height={34} style={{ width: 34, height: 34, objectFit: 'contain' }} loading="lazy" decoding="async" />
            </div>
            <div style={{ minWidth: 0, display: 'flex', justifyContent: 'center' }}>
              <img src={epargneCapitalInvestiIcon} alt="" aria-hidden="true" width={34} height={34} style={{ width: 34, height: 34, objectFit: 'contain' }} loading="lazy" decoding="async" />
            </div>
            <div style={{ minWidth: 0, display: 'flex', justifyContent: 'center' }}>
              <img src={epargnePerformanceIcon} alt="" aria-hidden="true" width={34} height={34} style={{ width: 34, height: 34, objectFit: 'contain' }} loading="lazy" decoding="async" />
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
