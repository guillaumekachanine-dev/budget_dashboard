import { useId, useMemo } from 'react'
import { ArrowRightLeft, ArrowRight, Plane } from 'lucide-react'
import { useTripCockpit } from '../hooks/useTripCockpit'
import type { TripCockpitRow } from '@/lib/types'
import { formatCurrencyFloored } from '@/lib/utils'

// ─── Constantes ───────────────────────────────────────────────────────────────

const MONTHS_FR = [
  'jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
]

const VOYAGE_ACCENT = '#D7B25C'
const VOYAGE_ACCENT_DARK = '#8A5A12'

// ─── Utilitaires locaux ───────────────────────────────────────────────────────

function fmtDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`
}



function daysElapsed(isoStart: string): number {
  const start = new Date(`${isoStart}T00:00:00`)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((now.getTime() - start.getTime()) / 86_400_000))
}

function TripProgressRing({
  pct,
  size = 136,
  amountText,
  label = 'Reste utile'
}: {
  pct: number
  size?: number
  amountText: string
  label?: string
}) {
  const sw = 10
  const r = (size - sw) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const progress = Math.max(0, Math.min(1, pct / 100))
  const dashOffset = circumference * (1 - progress)
  const orbitRadius = r + 8
  const orbitCircumference = 2 * Math.PI * orbitRadius
  const orbitSegment = orbitCircumference * 0.24
  const travelerId = useId().replace(/:/g, '')
  const orbitGlowId = `${travelerId}-orbit-glow`
  const orbitGradientId = `${travelerId}-orbit-gradient`
  const travelerGradientId = `${travelerId}-traveler-gradient`
  const burstGlowId = `${travelerId}-burst-glow`
  const animationClass = `trip-orbit-${travelerId}`

  const trackColor = 'rgba(110, 78, 22, 0.28)'
  const arcColor = pct > 100 ? '#C41C1C' : '#B8730A'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', width: size, height: size }}>
      <style>{`
        .${animationClass}-orbit {
          transform-origin: ${cx}px ${cy}px;
          animation: ${animationClass}-spin 3.55s linear infinite;
          opacity: 0;
        }

        .${animationClass}-trail-glow {
          animation: ${animationClass}-trail 3.55s ease-out infinite;
        }

        .${animationClass}-trail-core {
          animation: ${animationClass}-trail-core 3.55s ease-out infinite;
        }

        .${animationClass}-traveler {
          transform-origin: ${cx}px ${cy}px;
          animation:
            ${animationClass}-traveler-fill 0.28s linear infinite,
            ${animationClass}-traveler-pop 3.55s ease-out infinite;
        }

        .${animationClass}-sparkles {
          transform-origin: ${cx}px ${cy - orbitRadius}px;
          animation: ${animationClass}-burst 3.55s ease-out infinite;
          opacity: 0;
        }

        .${animationClass}-sparkles circle,
        .${animationClass}-sparkles path {
          animation: ${animationClass}-spark-fade 3.55s ease-out infinite;
        }

        @keyframes ${animationClass}-spin {
          0% { transform: rotate(-90deg); opacity: 0; }
          3% { opacity: 1; }
          24% { transform: rotate(270deg); opacity: 1; }
          29% { transform: rotate(270deg); opacity: 0; }
          100% { transform: rotate(270deg); opacity: 0; }
        }

        @keyframes ${animationClass}-trail {
          0% { opacity: 0; }
          4% { opacity: 0.95; }
          20% { opacity: 0.88; }
          28% { opacity: 0; }
          100% { opacity: 0; }
        }

        @keyframes ${animationClass}-trail-core {
          0% { opacity: 0; }
          4% { opacity: 0.92; }
          20% { opacity: 0.84; }
          28% { opacity: 0; }
          100% { opacity: 0; }
        }

        @keyframes ${animationClass}-traveler-fill {
          0% { fill: #ff2d55; }
          16% { fill: #ff7a00; }
          32% { fill: #ffd500; }
          48% { fill: #33d17a; }
          64% { fill: #00c2ff; }
          82% { fill: #4f6bff; }
          100% { fill: #c45cff; }
        }

        @keyframes ${animationClass}-traveler-pop {
          0% { opacity: 0; transform: scale(0.7); }
          4% { opacity: 1; transform: scale(1); }
          21% { opacity: 1; transform: scale(1.02); }
          27% { opacity: 0; transform: scale(0.72); }
          100% { opacity: 0; transform: scale(0.72); }
        }

        @keyframes ${animationClass}-burst {
          0%, 21% { opacity: 0; transform: scale(0.45); }
          24% { opacity: 0.95; transform: scale(0.72); }
          30% { opacity: 0; transform: scale(1.35); }
          100% { opacity: 0; transform: scale(1.35); }
        }

        @keyframes ${animationClass}-spark-fade {
          0%, 22% { opacity: 0; }
          25% { opacity: 1; }
          31% { opacity: 0; }
          100% { opacity: 0; }
        }
      `}</style>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ display: 'block', transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <defs>
          <filter id={orbitGlowId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={burstGlowId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="spark-blur" />
            <feMerge>
              <feMergeNode in="spark-blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={orbitGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff6d5" />
            <stop offset="18%" stopColor="#ffd36e" />
            <stop offset="38%" stopColor="#ff9f43" />
            <stop offset="56%" stopColor="#fff1bf" />
            <stop offset="76%" stopColor="#ffb347" />
            <stop offset="100%" stopColor="#fff8e7" />
          </linearGradient>
          <radialGradient id={travelerGradientId} cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.96" />
            <stop offset="46%" stopColor="#fff2c7" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffad3d" stopOpacity="0.32" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={sw} />
        {progress > 0 ? (
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arcColor}
            strokeWidth={sw}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        ) : null}
        <g className={`${animationClass}-orbit`}>
          <circle
            className={`${animationClass}-trail-glow`}
            cx={cx}
            cy={cy}
            r={orbitRadius}
            fill="none"
            stroke={`url(#${orbitGradientId})`}
            strokeWidth={5.5}
            strokeDasharray={`${orbitSegment} ${orbitCircumference}`}
            strokeLinecap="round"
            filter={`url(#${orbitGlowId})`}
          />
          <circle
            className={`${animationClass}-trail-core`}
            cx={cx}
            cy={cy}
            r={orbitRadius}
            fill="none"
            stroke={`url(#${orbitGradientId})`}
            strokeWidth={2.4}
            strokeDasharray={`${orbitSegment * 0.88} ${orbitCircumference}`}
            strokeLinecap="round"
          />
          <circle
            className={`${animationClass}-traveler`}
            cx={cx}
            cy={cy - orbitRadius}
            r={4.8}
            fill={`url(#${travelerGradientId})`}
            filter={`url(#${orbitGlowId})`}
          />
        </g>
        <g className={`${animationClass}-sparkles`} filter={`url(#${burstGlowId})`}>
          <circle cx={cx} cy={cy - orbitRadius} r={1.7} fill="#ffffff" />
          <circle cx={cx - 7} cy={cy - orbitRadius - 2} r={1.4} fill="#ffd86b" />
          <circle cx={cx + 8} cy={cy - orbitRadius - 1} r={1.5} fill="#ffbd59" />
          <circle cx={cx - 4} cy={cy - orbitRadius - 8} r={1.2} fill="#ff9640" />
          <circle cx={cx + 4} cy={cy - orbitRadius - 9} r={1.1} fill="#fff2c5" />
          <path d={`M ${cx - 10} ${cy - orbitRadius + 2} l -4 3 M ${cx + 10} ${cy - orbitRadius + 1} l 4 3 M ${cx - 2} ${cy - orbitRadius - 11} l -1 -4 M ${cx + 3} ${cy - orbitRadius - 10} l 2 -4`} stroke="#fff6cc" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', width: '100%', padding: '0 8px', boxSizing: 'border-box' }}>
        <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#26190A', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
          {amountText}
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(70, 44, 10, 0.75)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
          {label}
        </span>
      </div>
    </div>
  )
}

// ─── Composant interne : carte voyage principal ───────────────────────────────

function TripCard({
  trip,
  onViewDetail,
  onMatch,
  onRepartition,
}: {
  trip: TripCockpitRow
  onViewDetail?: () => void
  onMatch?: () => void
  onRepartition?: () => void
}) {
  const consumedPct = trip.consumed_pct ?? 0
  const hasPlannedBudget = trip.planned_budget != null && trip.planned_budget > 0
  const showMatch = trip.pending_match_count > 0
  const shineId = useId().replace(/:/g, '')

  const dateRange = useMemo(() => {
    return `${fmtDateShort(trip.start_date)} → ${fmtDateShort(trip.end_date)}`
  }, [trip.start_date, trip.end_date])

  const contextLine = useMemo(() => {
    if (trip.trip_status === 'ongoing') {
      const elapsed = daysElapsed(trip.start_date)
      return `Jour ${elapsed + 1} / ${trip.days_total}`
    }
    return null
  }, [trip.trip_status, trip.start_date, trip.days_total])

  const budget = trip.planned_budget ?? 0
  const consumed = trip.total_actual
  const resteUtile = budget - consumed

  return (
    <div
      style={{
        background: 'radial-gradient(122% 96% at 16% -10%, rgba(255, 242, 191, 0.72) 0%, rgba(255, 242, 191, 0) 52%), radial-gradient(96% 88% at 100% 100%, rgba(255, 176, 72, 0.34) 0%, rgba(255, 176, 72, 0) 60%), linear-gradient(145deg, #6D6A66 0%, #B9B6B1 46%, #ECE7DF 100%)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid rgba(255, 206, 112, 0.34)',
        overflow: 'hidden',
        padding: 'var(--space-4)',
        display: 'grid',
        gap: 'var(--space-4)',
      }}
    >
      <style>{`
        @keyframes trip-cta-shine-a-${shineId} {
          0%, 84%, 100% {
            transform: translateX(-190%) skewX(-24deg);
            opacity: 0;
          }
          85% {
            opacity: 0.08;
          }
          95% {
            transform: translateX(220%) skewX(-24deg);
            opacity: 0.72;
          }
          96%, 100% {
            opacity: 0;
          }
        }

        @keyframes trip-cta-shine-b-${shineId} {
          0%, 81%, 100% {
            transform: translateX(-190%) skewX(-24deg);
            opacity: 0;
          }
          82% {
            opacity: 0.08;
          }
          92% {
            transform: translateX(220%) skewX(-24deg);
            opacity: 0.66;
          }
          93%, 100% {
            opacity: 0;
          }
        }
      `}</style>

      {/* ── Header: Nom + Dates ───────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
        {/* 1. Nom seul — sans émoji ni pastille statut */}
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#FFFDF8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 6px rgba(92, 62, 8, 0.16)' }}>
            {trip.name}
          </h3>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255, 252, 244, 0.92)' }}>
            {dateRange}
          </span>
          {contextLine && (
            <p style={{ margin: '2px 0 0', fontSize: 10, fontWeight: 600, color: 'rgba(255, 225, 170, 0.78)' }}>
              {contextLine}
            </p>
          )}
        </div>
      </div>

      {/* ── Central Progress Ring ───────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: 'var(--space-2) 0',
          position: 'relative',
          isolation: 'isolate',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '50% auto auto 50%',
            width: 196,
            height: 136,
            transform: 'translate(-50%, -50%)',
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(90deg, rgba(0, 43, 127, 0.14) 0%, rgba(0, 43, 127, 0.14) 33.333%, rgba(252, 209, 22, 0.14) 33.333%, rgba(252, 209, 22, 0.14) 66.666%, rgba(206, 17, 38, 0.14) 66.666%, rgba(206, 17, 38, 0.14) 100%)',
            boxShadow: '0 14px 34px rgba(255, 196, 76, 0.08)',
            filter: 'blur(0.4px) saturate(0.84)',
            opacity: 0.42,
            zIndex: 0,
          }}
        />
        <TripProgressRing
          pct={consumedPct}
          amountText={formatCurrencyFloored(resteUtile)}
        />
      </div>

      {/* ── 2. Ligne consommation unifiée ─────────────────────────────── */}
      <div style={{ textAlign: 'center', display: 'grid', gap: 2 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#2C1A08' }}>
          {hasPlannedBudget ? (
            <>
              {'Consommé : '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrencyFloored(consumed)}</span>
            </>
          ) : (
            <>
              {'Dépensé\u00a0: '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrencyFloored(consumed)}</span>
              {'\u00a0€'}
            </>
          )}
        </p>
        {hasPlannedBudget && (
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'rgba(52, 30, 6, 0.82)' }}>
            {consumedPct.toFixed(0)}% consommé
          </p>
        )}
      </div>

      {/* ── 3. CTAs — mêmes dimensions, même ligne ──────────── */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
        {onRepartition ? (
          <button
            type="button"
            onClick={onRepartition}
            style={{
              flex: '1 1 0',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              border: '1px solid rgba(193, 135, 40, 0.28)',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255, 214, 130, 0.18) 100%)',
              color: '#6D450B',
              borderRadius: 'var(--radius-button)',
              padding: '8px var(--space-3)',
              minHeight: 40,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 120ms ease, border-color 120ms ease',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255, 214, 130, 0.26) 100%)'
              e.currentTarget.style.borderColor = 'rgba(193, 135, 40, 0.4)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255, 214, 130, 0.18) 100%)'
              e.currentTarget.style.borderColor = 'rgba(193, 135, 40, 0.28)'
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -10,
                bottom: -10,
                left: '-42%',
                width: '38%',
                pointerEvents: 'none',
                background: 'linear-gradient(115deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.08) 34%, rgba(255,255,255,0.62) 50%, rgba(255,248,223,0.22) 62%, rgba(255,255,255,0) 100%)',
                mixBlendMode: 'screen',
                filter: 'blur(0.5px)',
                animation: `trip-cta-shine-a-${shineId} 7.3s linear infinite`,
              }}
            />
            <span style={{ position: 'relative', zIndex: 1 }}>Répartition</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={onViewDetail}
          style={{
            flex: '1 1 0',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            border: '1px solid rgba(255, 252, 244, 0.38)',
            background: 'rgba(255,255,255,0.16)',
            color: '#5F430E',
            borderRadius: 'var(--radius-button)',
            padding: '8px var(--space-3)',
            minHeight: 40,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 120ms ease',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.24)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.16)'
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -10,
              bottom: -10,
              left: '-42%',
              width: '38%',
              pointerEvents: 'none',
              background: 'linear-gradient(115deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.07) 34%, rgba(255,255,255,0.54) 50%, rgba(255,255,255,0.18) 62%, rgba(255,255,255,0) 100%)',
              mixBlendMode: 'screen',
              filter: 'blur(0.5px)',
              animation: `trip-cta-shine-b-${shineId} 7.9s linear infinite`,
              animationDelay: '3.1s',
            }}
          />
          <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            Voir détails
            <ArrowRight size={12} />
          </span>
        </button>

        {showMatch && onMatch ? (
          <button
            type="button"
            onClick={onMatch}
            style={{
              flex: '1 1 0',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              border: '1px solid rgba(204, 140, 36, 0.38)',
              background: 'linear-gradient(135deg, rgba(255, 219, 142, 0.22) 0%, rgba(255, 177, 70, 0.16) 100%)',
              color: '#9A5D00',
              borderRadius: 'var(--radius-button)',
              padding: '8px var(--space-3)',
              minHeight: 40,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 120ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 219, 142, 0.3) 0%, rgba(255, 177, 70, 0.24) 100%)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 219, 142, 0.22) 0%, rgba(255, 177, 70, 0.16) 100%)'
            }}
          >
            <ArrowRightLeft size={12} />
            {`Rapprocher (${trip.pending_match_count})`}
          </button>
        ) : null}
      </div>
    </div>
  )
}

// ─── Composant interne : skeleton loading ─────────────────────────────────────

function TripSkeleton() {
  return (
    <div
      style={{
        background: 'var(--neutral-0)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid var(--neutral-100)',
        overflow: 'hidden',
      }}
    >
      <div style={{ height: 3, background: 'var(--neutral-100)' }} />
      <div style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
        {[80, 50, 100, 60].map((w, i) => (
          <div
            key={i}
            style={{
              height: i === 0 ? 20 : i === 2 ? 40 : 14,
              width: `${w}%`,
              background: 'var(--neutral-100)',
              borderRadius: 'var(--radius-sm)',
              animation: 'pulse 1.4s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Composant interne : état vide ────────────────────────────────────────────

function EmptyState({ onViewDetail }: { onViewDetail?: () => void }) {
  return (
    <div
      style={{
        background: 'var(--neutral-0)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid var(--neutral-100)',
        padding: 'var(--space-6)',
        display: 'grid',
        gap: 'var(--space-3)',
        justifyItems: 'center',
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: 36 }}>✈️</span>
      <div>
        <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--neutral-800)' }}>
          Aucun voyage planifié
        </p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-400)', lineHeight: 1.5 }}>
          Planifie ton prochain voyage pour suivre ton budget en temps réel.
        </p>
      </div>
      {onViewDetail ? (
        <button
          type="button"
          onClick={onViewDetail}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: `1px solid ${VOYAGE_ACCENT}`,
            background: 'transparent',
            color: VOYAGE_ACCENT_DARK,
            borderRadius: 'var(--radius-button)',
            padding: '8px var(--space-4)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Plane size={13} />
          Créer un voyage
        </button>
      ) : null}
    </div>
  )
}

// ─── Export principal ─────────────────────────────────────────────────────────

export interface TripCockpitCardProps {
  /**
   * Navigue vers /voyages/:tripId si tripId fourni, sinon /voyages.
   * Désactivé si non fourni.
   */
  onViewDetail?: (tripId?: string) => void
  /**
   * Ouvre le workflow de rapprochement manuel↔bancaire.
   * Non affiché si non fourni (feature à venir).
   */
  /** tripId + tripName pour pré-filtrer et titrer le sheet de rapprochement */
  onMatch?: (tripId: string, tripName: string) => void
  onRepartition?: () => void
}

export function TripCockpitCard({ onViewDetail, onMatch, onRepartition }: TripCockpitCardProps) {
  const { selectedTrip, isLoading, error } = useTripCockpit()

  if (isLoading) return <TripSkeleton />

  if (error) {
    return (
      <div
        style={{
          background: 'var(--neutral-0)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--neutral-100)',
          padding: 'var(--space-4)',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-error)' }}>
          Erreur lors du chargement des voyages.
        </p>
      </div>
    )
  }

  if (!selectedTrip) {
    return <EmptyState onViewDetail={onViewDetail} />
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <TripCard
        trip={selectedTrip}
        onViewDetail={onViewDetail ? () => onViewDetail(selectedTrip.trip_id) : undefined}
        onMatch={onMatch ? () => onMatch(selectedTrip.trip_id, selectedTrip.name) : undefined}
        onRepartition={onRepartition}
      />
    </div>
  )
}
