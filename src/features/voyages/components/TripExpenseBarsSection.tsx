import { useEffect, useState } from 'react'
import { formatCurrencyFloored } from '@/lib/utils'
import type { TripExpenseBarsMode, TripExpenseBarsRow } from '@/features/voyages/hooks/useTripExpenseBars'

const PALETTE = [
  '#38BDF8',
  '#0EA5E9',
  '#6366F1',
  '#8B5CF6',
  '#F59E0B',
  '#10B981',
  '#EC4899',
  '#06B6D4',
]

const CX = 130
const CY = 108
const R_OUTER = 80
const R_INNER = 48
const GAP_DEG = 3

function toRad(deg: number) { return (deg * Math.PI) / 180 }

function polar(cx: number, cy: number, r: number, a: number) {
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function donutPath(
  cx: number, cy: number,
  rOuter: number, rInner: number,
  start: number, end: number,
): string {
  const large = end - start > Math.PI ? 1 : 0
  const s  = polar(cx, cy, rOuter, start)
  const e  = polar(cx, cy, rOuter, end)
  const si = polar(cx, cy, rInner, start)
  const ei = polar(cx, cy, rInner, end)
  return [
    `M ${s.x.toFixed(3)} ${s.y.toFixed(3)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`,
    `L ${ei.x.toFixed(3)} ${ei.y.toFixed(3)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${si.x.toFixed(3)} ${si.y.toFixed(3)}`,
    'Z',
  ].join(' ')
}

export function TripExpenseBarsSection({
  mode,
  rows,
}: {
  mode: TripExpenseBarsMode
  rows: TripExpenseBarsRow[]
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(id)
  }, [])

  if (rows.length === 0) return null

  const getAmount = (r: TripExpenseBarsRow) =>
    mode === 'future' ? r.budgetAmount : r.consumedAmount

  const total = rows.reduce((s, r) => s + getAmount(r), 0)

  const GAP_RAD = toRad(GAP_DEG)
  const available = 2 * Math.PI - GAP_RAD * rows.length

  let cursor = -Math.PI / 2
  const segments = rows.map((row, i) => {
    const amount = getAmount(row)
    const fraction = total > 0 ? amount / total : 1 / rows.length
    const sweep = fraction * available
    const startAngle = cursor + GAP_RAD / 2
    const endAngle   = startAngle + Math.max(sweep, 0.01)
    cursor += sweep + GAP_RAD
    return {
      ...row,
      amount,
      fraction,
      startAngle,
      endAngle,
      color: PALETTE[i % PALETTE.length],
      index: i,
    }
  })

  const hovSeg = segments.find(s => s.key === hovered) ?? null
  const centerAmt   = hovSeg ? hovSeg.amount : total
  const centerLabel = hovSeg
    ? hovSeg.name
    : mode === 'future' ? 'Budget' : 'Dépensé'

  return (
    <svg
      viewBox="0 0 260 216"
      style={{ width: '100%', display: 'block', overflow: 'visible' }}
      role="img"
      aria-label="Répartition du budget voyage par catégorie"
      onMouseLeave={() => setHovered(null)}
    >
      <defs>
        <filter id="tbf-glow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="tbf-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#38BDF8" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0"    />
        </radialGradient>
      </defs>

      <ellipse
        cx={CX} cy={CY}
        rx={R_OUTER + 20} ry={R_OUTER + 20}
        fill="url(#tbf-bg)"
      />

      {segments.map((seg) => {
        const isHov  = seg.key === hovered
        const rOuter = isHov ? R_OUTER + 7 : R_OUTER
        const rInner = isHov ? R_INNER - 3 : R_INNER
        const path   = donutPath(CX, CY, rOuter, rInner, seg.startAngle, seg.endAngle)
        const dimmed = !!hovered && !isHov

        return (
          <path
            key={seg.key}
            d={path}
            fill={seg.color}
            filter={isHov ? 'url(#tbf-glow)' : undefined}
            onMouseEnter={() => setHovered(seg.key)}
            style={{
              cursor: 'pointer',
              transformOrigin: `${CX}px ${CY}px`,
              transform: mounted ? 'scale(1)' : 'scale(0)',
              opacity: mounted ? (dimmed ? 0.28 : 1) : 0,
              transition: [
                `transform 0.55s cubic-bezier(0.34,1.56,0.64,1) ${mounted ? 0 : seg.index * 60}ms`,
                'opacity 0.22s ease',
              ].join(', '),
            }}
          />
        )
      })}

      {mode === 'ongoing' && segments.map((seg) => {
        const pct = seg.budgetAmount > 0
          ? Math.min(1, seg.consumedAmount / seg.budgetAmount)
          : 0
        if (pct <= 0.01) return null
        const sweep = (seg.endAngle - seg.startAngle) * pct
        const path  = donutPath(CX, CY, R_INNER - 6, R_INNER - 16, seg.startAngle, seg.startAngle + sweep)
        return (
          <path
            key={`inner-${seg.key}`}
            d={path}
            fill={seg.color}
            style={{
              transformOrigin: `${CX}px ${CY}px`,
              transform: mounted ? 'scale(1)' : 'scale(0)',
              opacity: mounted ? 0.55 : 0,
              transition: 'transform 0.7s ease, opacity 0.4s ease',
              pointerEvents: 'none',
            }}
          />
        )
      })}

      <text
        x={CX} y={CY - 10}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontWeight={800}
        fontSize={20}
        fill="var(--neutral-900)"
        style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease 0.3s' }}
      >
        {formatCurrencyFloored(centerAmt)}
      </text>
      <text
        x={CX} y={CY + 9}
        textAnchor="middle"
        fontFamily="var(--font-ui, sans-serif)"
        fontWeight={hovSeg ? 700 : 500}
        fontSize={hovSeg ? 10 : 9}
        letterSpacing="0.03em"
        fill={hovSeg ? hovSeg.color : 'var(--neutral-400)'}
        style={{ opacity: mounted ? 1 : 0, transition: 'all 0.2s ease' }}
      >
        {centerLabel}
      </text>
      {hovSeg && (
        <text
          x={CX} y={CY + 26}
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontWeight={700}
          fontSize={11}
          fill={hovSeg.color}
          style={{ opacity: 0.7 }}
        >
          {`${Math.round(hovSeg.fraction * 100)} %`}
        </text>
      )}
    </svg>
  )
}
