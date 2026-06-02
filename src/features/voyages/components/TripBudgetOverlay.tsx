import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { formatCurrencyFloored } from '@/lib/utils'
import { lockDocumentScroll } from '@/lib/scrollLock'
import type { TripExpenseBarsMode, TripExpenseBarsRow } from '@/features/voyages/hooks/useTripExpenseBars'

// ─── Ring palette ─────────────────────────────────────────────────────────────
const PALETTE = [
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#0EA5E9',
  '#EF4444',
  '#14B8A6',
]

// ─── SVG geometry ─────────────────────────────────────────────────────────────
const CX = 145
const CY = 118
const R_OUTER = 90
const R_INNER = 54
const GAP_DEG = 3

function toRad(deg: number) { return (deg * Math.PI) / 180 }

function polar(r: number, a: number) {
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
}

function donutPath(rOuter: number, rInner: number, start: number, end: number): string {
  const large = end - start > Math.PI ? 1 : 0
  const s  = polar(rOuter, start)
  const e  = polar(rOuter, end)
  const si = polar(rInner, start)
  const ei = polar(rInner, end)
  return [
    `M ${s.x.toFixed(3)} ${s.y.toFixed(3)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`,
    `L ${ei.x.toFixed(3)} ${ei.y.toFixed(3)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${si.x.toFixed(3)} ${si.y.toFixed(3)}`,
    'Z',
  ].join(' ')
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface TripBudgetOverlayProps {
  open: boolean
  onClose: () => void
  mode: TripExpenseBarsMode
  rows: TripExpenseBarsRow[]
  tripName?: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TripBudgetOverlay({ open, onClose, mode, rows, tripName }: TripBudgetOverlayProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [ringMounted, setRingMounted] = useState(false)

  // Lock scroll when open
  useEffect(() => {
    if (open) return lockDocumentScroll()
  }, [open])

  // Animate ring in after overlay mounts
  useEffect(() => {
    if (!open) { setRingMounted(false); setSelected(null); return }
    const id = setTimeout(() => setRingMounted(true), 120)
    return () => clearTimeout(id)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (rows.length === 0) return null

  const getAmount = (r: TripExpenseBarsRow) =>
    mode === 'future' ? r.budgetAmount : r.consumedAmount

  const total = rows.reduce((s, r) => s + getAmount(r), 0)
  const modeLabel = mode === 'future' ? 'Budget prévu' : mode === 'ongoing' ? 'En cours' : 'Dépenses'

  // Build segments
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

  const selSeg   = segments.find(s => s.key === selected) ?? null
  const centerAmt = selSeg ? selSeg.amount : total
  const centerLabel = selSeg
    ? selSeg.name
    : modeLabel

  const toggle = (key: string) =>
    setSelected(prev => (prev === key ? null : key))

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 400,
            background: 'rgba(10, 8, 28, 0.62)',
            backdropFilter: 'blur(20px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 20px',
          }}
        >
          <motion.div
            key="overlay-card"
            initial={{ opacity: 0, scale: 0.86, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 380,
              borderRadius: 28,
              overflow: 'hidden',
              background: 'rgba(255, 255, 255, 0.72)',
              border: '1px solid rgba(255, 255, 255, 0.55)',
              boxShadow: '0 24px 64px rgba(10, 8, 40, 0.22), 0 1px 0 rgba(255,255,255,0.9) inset, 0 -1px 0 rgba(200,200,220,0.15) inset',
              backdropFilter: 'blur(40px) saturate(1.8) brightness(1.04)',
              WebkitBackdropFilter: 'blur(40px) saturate(1.8) brightness(1.04)',
            }}
          >
            {/* Frosted glass top highlight */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 30%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.9) 70%, transparent 100%)',
              pointerEvents: 'none',
              zIndex: 1,
            }} />
            {/* Atmospheric inner glow */}
            <div style={{
              position: 'absolute',
              top: -80,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 320,
              height: 200,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(160, 140, 240, 0.12) 0%, transparent 68%)',
              pointerEvents: 'none',
            }} />

            {/* ── Header ────────────────────────────────────────────── */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              padding: '20px 20px 0',
              position: 'relative',
            }}>
              <div>
                <p style={{
                  margin: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'rgba(110, 108, 130, 0.7)',
                }}>
                  Répartition du budget
                </p>
                {tripName ? (
                  <p style={{
                    margin: '3px 0 0',
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'rgba(22, 20, 38, 0.9)',
                    letterSpacing: '-0.01em',
                  }}>
                    {tripName}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '1px solid rgba(200, 200, 215, 0.55)',
                  background: 'rgba(235, 235, 245, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'rgba(90, 88, 110, 0.65)',
                  flexShrink: 0,
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(220, 220, 235, 0.9)'
                  e.currentTarget.style.color = 'rgba(22, 20, 38, 0.8)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(235, 235, 245, 0.7)'
                  e.currentTarget.style.color = 'rgba(90, 88, 110, 0.65)'
                }}
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>

            {/* ── Ring SVG ──────────────────────────────────────────── */}
            <svg
              viewBox="0 0 290 236"
              style={{ width: '100%', display: 'block', overflow: 'visible' }}
              role="img"
              aria-label="Répartition du budget voyage"
              onMouseLeave={() => setSelected(null)}
            >
              <defs>
                <filter id="tbo-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <radialGradient id="tbo-aura" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#6366F1" stopOpacity="0.07" />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity="0"    />
              </radialGradient>
              </defs>

              {/* Background aura */}
              <ellipse
                cx={CX} cy={CY}
                rx={R_OUTER + 24} ry={R_OUTER + 24}
                fill="url(#tbo-aura)"
              />

              {/* Segments */}
              {segments.map((seg) => {
                const isSel   = seg.key === selected
                const dimmed  = !!selected && !isSel
                const rOuter  = isSel ? R_OUTER + 9 : R_OUTER
                const rInner  = isSel ? R_INNER - 4 : R_INNER
                const path    = donutPath(rOuter, rInner, seg.startAngle, seg.endAngle)

                return (
                  <path
                    key={seg.key}
                    d={path}
                    fill={seg.color}
                    filter={isSel ? 'url(#tbo-glow)' : undefined}
                    onMouseEnter={() => setSelected(seg.key)}
                    onClick={() => toggle(seg.key)}
                    style={{
                      cursor: 'pointer',
                      transformOrigin: `${CX}px ${CY}px`,
                      transform: ringMounted ? 'scale(1)' : 'scale(0)',
                      opacity: ringMounted ? (dimmed ? 0.22 : 1) : 0,
                      transition: [
                        `transform 0.58s cubic-bezier(0.34,1.56,0.64,1) ${ringMounted ? 0 : seg.index * 65}ms`,
                        'opacity 0.22s ease',
                      ].join(', '),
                    }}
                  />
                )
              })}

              {/* Ongoing: inner consumption arcs */}
              {mode === 'ongoing' && segments.map((seg) => {
                const pct = seg.budgetAmount > 0
                  ? Math.min(1, seg.consumedAmount / seg.budgetAmount)
                  : 0
                if (pct <= 0.01) return null
                const sweep = (seg.endAngle - seg.startAngle) * pct
                const path  = donutPath(R_INNER - 7, R_INNER - 18, seg.startAngle, seg.startAngle + sweep)
                return (
                  <path
                    key={`inner-${seg.key}`}
                    d={path}
                    fill={seg.color}
                    style={{
                      transformOrigin: `${CX}px ${CY}px`,
                      transform: ringMounted ? 'scale(1)' : 'scale(0)',
                      opacity: ringMounted ? 0.5 : 0,
                      transition: 'transform 0.7s ease, opacity 0.4s ease',
                      pointerEvents: 'none',
                    }}
                  />
                )
              })}

              {/* Center amount */}
              <text
                x={CX} y={CY - 10}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontWeight={800}
                fontSize={24}
                fill="rgba(22, 20, 38, 0.88)"
                style={{ opacity: ringMounted ? 1 : 0, transition: 'opacity 0.4s ease 0.3s' }}
              >
                {formatCurrencyFloored(centerAmt)}
              </text>

              {/* Center label */}
              <text
                x={CX} y={CY + 14}
                textAnchor="middle"
                fontFamily="var(--font-ui, sans-serif)"
                fontWeight={selSeg ? 700 : 500}
                fontSize={selSeg ? 11 : 10}
                letterSpacing="0.03em"
                fill={selSeg ? selSeg.color : 'rgba(110, 108, 130, 0.5)'}
                style={{ opacity: ringMounted ? 1 : 0, transition: 'all 0.2s ease' }}
              >
                {centerLabel}
              </text>

              {/* Center percentage (on selection) */}
              {selSeg && (
                <text
                  x={CX} y={CY + 32}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontWeight={700}
                  fontSize={12}
                  fill={selSeg.color}
                  style={{ opacity: 0.65 }}
                >
                  {`${Math.round(selSeg.fraction * 100)} %`}
                </text>
              )}
            </svg>

            {/* ── Legend ────────────────────────────────────────────── */}
            <div style={{
              padding: '0 16px 20px',
              display: 'grid',
              gap: 2,
            }}>
              {segments.map((seg) => {
                const isSel   = seg.key === selected
                const dimmed  = !!selected && !isSel

                return (
                  <button
                    key={`leg-${seg.key}`}
                    type="button"
                    onClick={() => toggle(seg.key)}
                    onMouseEnter={() => setSelected(seg.key)}
                    onMouseLeave={() => setSelected(null)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '10px 1fr auto auto',
                      alignItems: 'center',
                      gap: 10,
                      padding: '7px 10px',
                      borderRadius: 12,
                      border: 'none',
                      background: isSel
                        ? `rgba(${hexToRgb(seg.color)}, 0.10)`
                        : 'rgba(255,255,255,0)',
                      backdropFilter: isSel ? 'blur(8px)' : 'none',
                      WebkitBackdropFilter: isSel ? 'blur(8px)' : 'none',
                      border: isSel ? `1px solid rgba(${hexToRgb(seg.color)}, 0.18)` : '1px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'background 0.18s ease, opacity 0.18s ease, border-color 0.18s ease',
                      opacity: dimmed ? 0.3 : 1,
                    }}
                  >
                    {/* Dot */}
                    <span style={{
                      display: 'block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: seg.color,
                      boxShadow: isSel ? `0 0 8px ${seg.color}` : 'none',
                      transition: 'box-shadow 0.2s ease',
                      flexShrink: 0,
                    }} />

                    {/* Name */}
                    <span style={{
                      fontSize: 12.5,
                      fontWeight: isSel ? 600 : 400,
                      color: isSel ? 'rgba(22, 20, 38, 0.92)' : 'rgba(80, 78, 100, 0.72)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      transition: 'color 0.15s, font-weight 0.15s',
                    }}>
                      {seg.name}
                    </span>

                    {/* Amount */}
                    <span style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: isSel ? seg.color : 'rgba(22, 20, 38, 0.78)',
                      whiteSpace: 'nowrap',
                      transition: 'color 0.15s',
                    }}>
                      {formatCurrencyFloored(seg.amount)}
                    </span>

                    {/* Percentage */}
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      color: isSel ? seg.color : 'rgba(110, 108, 130, 0.45)',
                      whiteSpace: 'nowrap',
                      minWidth: 32,
                      textAlign: 'right',
                      transition: 'color 0.15s',
                    }}>
                      {`${Math.round(seg.fraction * 100)} %`}
                    </span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Util: hex → "r,g,b" for rgba() ──────────────────────────────────────────
function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `${r},${g},${b}`
}
