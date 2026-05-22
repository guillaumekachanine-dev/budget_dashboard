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

function formatTightEuro(value: number | null | undefined): string {
  return formatEuro(value).replace(/\s+€/u, '€')
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
          padding: 'var(--space-2)',
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

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) max-content',
            alignItems: 'center',
            columnGap: 'var(--space-4)',
            minHeight: '56px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minWidth: 0, minHeight: '100%' }}>
            <p
              style={{
                margin: 0,
                fontSize: 'clamp(24px, 6.4vw, 33px)',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: 'var(--neutral-0)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
              }}
            >
              {data ? formatEuro(data.total_savings) : '—'}
            </p>
          </div>

          <div style={{ display: 'grid', gap: 'var(--space-1)', justifyItems: 'start', textAlign: 'left', alignContent: 'center', minHeight: '100%' }}>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--font-size-xs)',
                color: 'rgba(255,255,255,0.9)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 'var(--font-weight-bold)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 'var(--space-2)',
                  height: 'var(--space-2)',
                  borderRadius: '50%',
                  background: 'color-mix(in oklab, var(--color-positive) 76%, var(--neutral-0) 24%)',
                }}
              />
              <span>Livret :</span>
              <span style={{ color: 'var(--neutral-500)' }}>{formatTightEuro(data?.livrets_total)}</span>
            </p>

            <p
              style={{
                margin: 0,
                fontSize: 'var(--font-size-xs)',
                color: 'rgba(255,255,255,0.9)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 'var(--font-weight-bold)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 'var(--space-2)',
                  height: 'var(--space-2)',
                  borderRadius: '50%',
                  background: 'color-mix(in oklab, var(--color-warning) 60%, var(--neutral-0) 40%)',
                }}
              />
              <span>Placements :</span>
              <span style={{ color: 'var(--neutral-500)' }}>{formatTightEuro(data?.placements_total)}</span>
            </p>
          </div>
        </div>

        {notice ? (
          <div style={{ marginTop: 'var(--space-2)', position: 'relative', zIndex: 2 }}>
            <DataQualityNotice
              title={notice.title}
              detail={notice.detail}
              tone={error ? 'warning' : 'neutral'}
            />
          </div>
        ) : null}
      </div>
    </StatsSection>
  )
}
