import type { ReactNode } from 'react'
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
          ? 'var(--color-error)'
          : overallPct > 85
            ? 'var(--color-warning)'
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
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        {data.map((entry, i) => {
          const r = OUTER_R - i * (ringWidth + ringGap) - ringWidth / 2
          const circumference = 2 * Math.PI * r
          const isOverBudget = entry.budgetAmount > 0 && entry.realAmount > entry.budgetAmount
          const pct = entry.budgetAmount > 0 ? Math.min(1, entry.realAmount / entry.budgetAmount) : 0
          const fillLength = pct * circumference
          const isSelected = selectedId === entry.id
          const opacity = hasSelection ? (isSelected ? 1 : 0.28) : 1
          const fillColor = isOverBudget ? 'var(--color-error)' : entry.color

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
                  strokeWidth={isSelected ? ringWidth + 2 : ringWidth}
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
