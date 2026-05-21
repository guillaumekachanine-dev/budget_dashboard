import { Skeleton } from '@/components/ui/Skeleton'
import { useSavingsCurrentSummary } from '@/features/savings/hooks/useSavingsCurrentSummary'
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
            border: '1px solid color-mix(in oklab, #0B3D4A 52%, var(--neutral-0) 48%)',
            background: 'linear-gradient(138deg, #0B3D4A 0%, #1E6578 46%, #9EC4CF 78%, #DDECF1 100%)',
            padding: 'var(--space-4)',
            boxShadow: 'var(--shadow-card)',
            display: 'grid',
            gap: 'var(--space-2)',
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
          background: 'linear-gradient(138deg, #0B3D4A 0%, #1E6578 46%, #9EC4CF 78%, #DDECF1 100%)',
          borderRadius: 'var(--radius-2xl)',
          border: '1px solid color-mix(in oklab, #0B3D4A 52%, var(--neutral-0) 48%)',
          padding: 'var(--space-4)',
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
            top: -84,
            right: -62,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.08) 56%, transparent 76%)',
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

          {notice ? (
            <div style={{ marginTop: 'var(--space-2)' }}>
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
