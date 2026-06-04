import { useId, useMemo, type ReactNode } from 'react'
import { formatCurrencyFloored } from '@/lib/utils'

export interface CombinedDatum {
  id: string
  name: string
  color: string
  realAmount: number
  budgetAmount: number
}

interface RadialEnvelopeChartProps {
  data: CombinedDatum[]
  realTotal: number
  budgetTotal: number
  selectedId: string | null
  onEntryClick: (entry: CombinedDatum) => void
  onCenterClick?: () => void
  /** Override the default center content (consumed total + % budget) */
  centerContent?: ReactNode
  /** Chart diameter in px (default 240) */
  size?: number
}

export function RadialEnvelopeChart({
  data,
  realTotal,
  budgetTotal,
  selectedId,
  onEntryClick,
  onCenterClick,
  centerContent,
  size = 240,
}: RadialEnvelopeChartProps) {
  const animationId = useId().replace(/:/g, '')
  const cx = size / 2
  const cy = size / 2
  const OUTER_R = Math.round(size * 0.458)   // ~110 at 240
  const INNER_R = Math.round(size * 0.217)   // ~52 at 240
  const n = data.length
  const ringGap = 2.5
  const totalSpace = OUTER_R - INNER_R
  const ringWidth = n > 0 ? Math.max(5, (totalSpace - ringGap * Math.max(0, n - 1)) / n) : totalSpace
  const overallPct = budgetTotal > 0 ? Math.round((realTotal / budgetTotal) * 100) : 0
  const hasSelection = selectedId !== null
  const animationClass = `account-hero-orbit-${animationId}`
  const orbitGlowId = `${animationId}-orbit-glow`
  const trailGradientId = `${animationId}-trail-gradient`
  const travelerGradientId = `${animationId}-traveler-gradient`
  const sparkleGlowId = `${animationId}-sparkle-glow`

  const ringGeometries = useMemo(() => {
    return data.map((entry, i) => {
      const r = OUTER_R - i * (ringWidth + ringGap) - ringWidth / 2
      const circumference = 2 * Math.PI * r
      const isOverBudget = entry.budgetAmount > 0 && entry.realAmount > entry.budgetAmount
      const pct = entry.budgetAmount > 0 ? Math.min(1, entry.realAmount / entry.budgetAmount) : 0
      const fillLength = pct * circumference
      const isSelected = selectedId === entry.id
      const opacity = hasSelection ? (isSelected ? 1 : 0.28) : 1
      const fillColor = isOverBudget ? 'var(--color-error)' : entry.color

      return {
        entry,
        r,
        circumference,
        fillLength,
        isSelected,
        opacity,
        fillColor,
        strokeWidth: isSelected ? ringWidth + 2 : ringWidth,
      }
    })
  }, [OUTER_R, data, hasSelection, ringGap, ringWidth, selectedId])

  const animatedOrbits = useMemo(() => {
    if (ringGeometries.length === 0) return []

    const candidateIndices = [
      0,
      Math.max(0, Math.floor((ringGeometries.length - 1) / 2)),
      Math.max(0, ringGeometries.length - 1),
    ]

    return candidateIndices
      .filter((index, position, source) => source.indexOf(index) === position)
      .map((index, sequence) => {
        const ring = ringGeometries[index]
        const trailLength = ring.circumference * 0.15

        return {
          sequence,
          radius: ring.r,
          trailLength,
          circumference: ring.circumference,
          delay: sequence * 5,
        }
      })
  }, [ringGeometries])

  const animationCycle = Math.max(animatedOrbits.length * 5, 5)

  const defaultCenter = (
    <>
      <span style={{
        display: 'block',
        fontSize: 'clamp(12px, 3.5vw, 15px)',
        fontWeight: 800,
        fontFamily: 'var(--font-mono)',
        color: 'var(--neutral-900)',
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
      }}>
        {formatCurrencyFloored(realTotal)}
      </span>
      <span style={{
        display: 'block',
        fontSize: 8,
        fontWeight: 700,
        color: overallPct > 100
          ? 'var(--color-error-text)'
          : overallPct > 85
            ? 'var(--color-warning-text)'
            : 'var(--neutral-400)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginTop: 4,
        lineHeight: 1,
      }}>
        {overallPct}% budget
      </span>
    </>
  )

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <style>{`
        .${animationClass}-orbit {
          opacity: 0;
          transform-origin: ${cx}px ${cy}px;
          animation: ${animationClass}-spin ${animationCycle}s linear infinite;
        }

        .${animationClass}-trail-glow {
          animation: ${animationClass}-trail ${animationCycle}s ease-out infinite;
        }

        .${animationClass}-trail-core {
          animation: ${animationClass}-trail-core ${animationCycle}s ease-out infinite;
        }

        .${animationClass}-traveler {
          animation:
            ${animationClass}-traveler-fill 1.1s linear infinite,
            ${animationClass}-traveler-pop ${animationCycle}s ease-out infinite;
        }

        .${animationClass}-sparkles {
          opacity: 0;
          animation: ${animationClass}-burst ${animationCycle}s ease-out infinite;
        }

        .${animationClass}-sparkles circle,
        .${animationClass}-sparkles path {
          animation: ${animationClass}-spark-fade ${animationCycle}s ease-out infinite;
        }

        @keyframes ${animationClass}-spin {
          0% { transform: rotate(-90deg); opacity: 0; }
          1.4% { opacity: 1; }
          5.8% { transform: rotate(270deg); opacity: 1; }
          7.1% { transform: rotate(270deg); opacity: 0; }
          100% { transform: rotate(270deg); opacity: 0; }
        }

        @keyframes ${animationClass}-trail {
          0% { opacity: 0; }
          1.4% { opacity: 1; }
          5.4% { opacity: 0.9; }
          7.1% { opacity: 0; }
          100% { opacity: 0; }
        }

        @keyframes ${animationClass}-trail-core {
          0% { opacity: 0; }
          1.4% { opacity: 0.98; }
          5.4% { opacity: 0.92; }
          7.1% { opacity: 0; }
          100% { opacity: 0; }
        }

        @keyframes ${animationClass}-traveler-fill {
          0% { fill: #ffffff; }
          30% { fill: #eef7ff; }
          60% { fill: #d8e8ff; }
          100% { fill: #f7fbff; }
        }

        @keyframes ${animationClass}-traveler-pop {
          0% { opacity: 0; transform: scale(0.68); }
          1.6% { opacity: 1; transform: scale(1); }
          5.5% { opacity: 1; transform: scale(1.04); }
          7.1% { opacity: 0; transform: scale(0.74); }
          100% { opacity: 0; transform: scale(0.74); }
        }

        @keyframes ${animationClass}-burst {
          0%, 5.1% { opacity: 0; transform: scale(0.45); }
          6.1% { opacity: 0.95; transform: scale(0.8); }
          7.6% { opacity: 0; transform: scale(1.4); }
          100% { opacity: 0; transform: scale(1.4); }
        }

        @keyframes ${animationClass}-spark-fade {
          0%, 5.3% { opacity: 0; }
          6.2% { opacity: 1; }
          7.7% { opacity: 0; }
          100% { opacity: 0; }
        }
      `}</style>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <filter id={orbitGlowId} x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={sparkleGlowId} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="spark-blur" />
            <feMerge>
              <feMergeNode in="spark-blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={trailGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
            <stop offset="35%" stopColor="#edf6ff" stopOpacity="0.92" />
            <stop offset="72%" stopColor="#d8e6ff" stopOpacity="0.58" />
            <stop offset="100%" stopColor="#bfd7ff" stopOpacity="0.08" />
          </linearGradient>
          <radialGradient id={travelerGradientId} cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="42%" stopColor="#f4f9ff" stopOpacity="0.98" />
            <stop offset="74%" stopColor="#dce9ff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#acc8ff" stopOpacity="0.2" />
          </radialGradient>
        </defs>
        {ringGeometries.map(({ entry, r, circumference, fillLength, opacity, fillColor, strokeWidth }) => {
          const pct = entry.budgetAmount > 0 ? Math.min(1, entry.realAmount / entry.budgetAmount) : 0

          return (
            <g key={entry.id} onClick={() => onEntryClick(entry)} style={{ cursor: 'pointer' }}>
              {/* Budget background ring */}
              <circle
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={entry.color}
                strokeWidth={ringWidth}
                strokeOpacity={opacity * 0.15}
              />
              {/* Actual fill arc */}
              {pct > 0 && (
                <circle
                  cx={cx} cy={cy} r={r}
                  fill="none"
                  stroke={fillColor}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  strokeLinecap="round"
                  strokeDasharray={`${fillLength} ${circumference}`}
                  style={{
                    transform: `rotate(-90deg)`,
                    transformOrigin: `${cx}px ${cy}px`,
                    transition: 'stroke-opacity 0.2s ease, stroke-width 0.15s ease',
                  }}
                />
              )}
              {/* Larger invisible hit area */}
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="transparent" strokeWidth={ringWidth + 8} />
            </g>
          )
        })}
        {animatedOrbits.map((orbit) => (
          <g
            key={`orbit-${orbit.sequence}`}
            className={`${animationClass}-orbit`}
            style={{
              animationDelay: `${orbit.delay}s`,
              pointerEvents: 'none',
            }}
          >
            <circle
              className={`${animationClass}-trail-glow`}
              cx={cx}
              cy={cy}
              r={orbit.radius}
              fill="none"
              stroke={`url(#${trailGradientId})`}
              strokeWidth={6.5}
              strokeDasharray={`${orbit.trailLength} ${orbit.circumference}`}
              strokeLinecap="round"
              filter={`url(#${orbitGlowId})`}
              style={{ animationDelay: `${orbit.delay}s` }}
            />
            <circle
              className={`${animationClass}-trail-core`}
              cx={cx}
              cy={cy}
              r={orbit.radius}
              fill="none"
              stroke={`url(#${trailGradientId})`}
              strokeWidth={2.8}
              strokeDasharray={`${orbit.trailLength * 0.84} ${orbit.circumference}`}
              strokeLinecap="round"
              style={{ animationDelay: `${orbit.delay}s` }}
            />
            <circle
              className={`${animationClass}-traveler`}
              cx={cx}
              cy={cy - orbit.radius}
              r={4.6}
              fill={`url(#${travelerGradientId})`}
              filter={`url(#${orbitGlowId})`}
              style={{ animationDelay: `${orbit.delay}s, ${orbit.delay}s` }}
            />
            <g
              className={`${animationClass}-sparkles`}
              filter={`url(#${sparkleGlowId})`}
              style={{ animationDelay: `${orbit.delay}s` }}
            >
              <circle cx={cx} cy={cy - orbit.radius} r={1.6} fill="#ffffff" />
              <circle cx={cx - 6} cy={cy - orbit.radius - 2} r={1.3} fill="#eaf4ff" />
              <circle cx={cx + 7} cy={cy - orbit.radius - 1} r={1.35} fill="#d8e8ff" />
              <circle cx={cx - 3} cy={cy - orbit.radius - 7} r={1.05} fill="#f8fbff" />
              <circle cx={cx + 4} cy={cy - orbit.radius - 8} r={1.05} fill="#cfe1ff" />
              <path d={`M ${cx - 8} ${cy - orbit.radius + 2} l -3 2.5 M ${cx + 8} ${cy - orbit.radius + 2} l 3 2.5 M ${cx - 2} ${cy - orbit.radius - 9} l -1 -3.5 M ${cx + 2} ${cy - orbit.radius - 9} l 1 -3.5`} stroke="#f5fbff" strokeWidth="1.05" strokeLinecap="round" />
            </g>
          </g>
        ))}
      </svg>

      {/* Center — click opens forecast/detail modal */}
      <button
        type="button"
        onClick={onCenterClick}
        aria-label="Voir le détail"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: INNER_R * 2 - 8,
          height: INNER_R * 2 - 8,
          borderRadius: '50%',
          border: 'none',
          background: 'transparent',
          cursor: onCenterClick ? 'pointer' : 'default',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          pointerEvents: onCenterClick ? 'auto' : 'none',
          gap: 0,
        }}
      >
        {centerContent ?? defaultCenter}
      </button>
    </div>
  )
}
