import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CategoryIcon } from '@/components/ui/CategoryIcon'

// ── Compact gauge geometry (two cards side-by-side) ───────────────
const G = {
  w: 140, h: 74,
  cx: 70, cy: 68,   // pivot near the bottom
  r: 58,            // arc radius
  sw: 9,            // stroke width
}

function arcPoint(p: number): { x: number; y: number } {
  const a = -Math.PI + p * Math.PI
  return { x: G.cx + G.r * Math.cos(a), y: G.cy + G.r * Math.sin(a) }
}

function fullArc(): string {
  return `M ${G.cx - G.r} ${G.cy} A ${G.r} ${G.r} 0 0 0 ${G.cx + G.r} ${G.cy}`
}

// sweep-flag=0 (CCW) for partial arcs; switch to CW (sweep=1) for the full 180°
// to avoid the degenerate case where both endpoints share y=G.cy.
function filledArc(p: number): string {
  if (p <= 0) return ''
  if (p >= 1) {
    return `M ${G.cx - G.r} ${G.cy} A ${G.r} ${G.r} 0 0 1 ${G.cx + G.r} ${G.cy}`
  }
  const end = arcPoint(p)
  return `M ${G.cx - G.r} ${G.cy} A ${G.r} ${G.r} 0 0 0 ${end.x} ${end.y}`
}

function statusColor(pct: number): string {
  if (pct >= 100) return '#FC5A5A'
  if (pct >= 75)  return '#FFAB2E'
  return '#2ED47A'
}

const TICKS = [0.25, 0.5, 0.75, 1.0]

// ── Interfaces ────────────────────────────────────────────────────
interface OptimizationRow {
  label: string
  iconKey: string
  consumedAmount: number
  objectiveAmount: number
  progressPct: number
  barColor: string
}

// ── Compact gauge card ────────────────────────────────────────────
function GaugeCard({
  row,
  idx,
  formatCurrencyFloored,
  slideIndex,
}: {
  row: OptimizationRow
  idx: number
  formatCurrencyFloored: (n: number) => string
  slideIndex: number
}) {
  const p     = Math.min(1, Math.max(0, row.progressPct / 100))
  const color = statusColor(row.progressPct)
  const dot   = arcPoint(p)
  const gid   = `og-grad-${idx}`
  const glid  = `og-glow-${idx}`

  const entryDelay = 0.05 + (idx % 2) * 0.1
  const fillDelay  = entryDelay + 0.2

  return (
    <motion.div
      key={`card-${slideIndex}-${idx}`}
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: -8 }}
      transition={{
        delay: entryDelay,
        duration: 0.5,
        ease: [0.23, 0.86, 0.39, 0.96],
      }}
      style={{
        background: 'linear-gradient(140deg, #0B1120 0%, #111A2E 55%, #0D1628 100%)',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        aspectRatio: '1 / 1',
      }}
    >
      {/* Animated ambient corner glow */}
      <motion.div
        style={{
          position: 'absolute', top: -20, right: -20,
          width: 90, height: 90, borderRadius: '50%',
          background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: fillDelay, duration: 0.6 }}
      />

      {/* ── Header: icon + label + % badge ─────────────────────── */}
      <div style={{
        padding: '12px 12px 0',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>

        {/* Icon with pronounced vignette */}
        <div style={{
          position: 'relative',
          width: 40, height: 40,
          borderRadius: 12, overflow: 'hidden',
          flexShrink: 0,
        }}>
          <CategoryIcon iconKey={row.iconKey} label={row.label} size={40} />
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(circle at 50% 50%, transparent 20%, rgba(7,10,28,0.6) 65%, rgba(5,7,22,0.92) 100%)`,
            borderRadius: 12,
            pointerEvents: 'none',
          }} />
        </div>

        {/* Category name */}
        <span style={{
          fontSize: 11, fontWeight: 800,
          color: 'rgba(255,255,255,0.8)',
          letterSpacing: '-0.01em',
          flex: 1, minWidth: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {row.label}
        </span>

        {/* Status % pill */}
        <motion.span
          style={{
            fontSize: 10, fontWeight: 800, color,
            background: `${color}18`, border: `1px solid ${color}40`,
            borderRadius: 999, padding: '3px 7px',
            letterSpacing: '0.03em', flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: fillDelay + 0.15, duration: 0.4 }}
        >
          {row.progressPct.toFixed(0)}%
        </motion.span>
      </div>

      {/* ── SVG Arc Gauge ────────────────────────────────────────── */}
      <svg viewBox={`0 0 ${G.w} ${G.h}`} style={{ width: '100%', display: 'block', flex: 1 }} aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#2ED47A" />
            <stop offset="70%"  stopColor="#FFAB2E" />
            <stop offset="100%" stopColor="#FC5A5A" />
          </linearGradient>
          <filter id={glid} x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track */}
        <path d={fullArc()} fill="none" stroke="rgba(255,255,255,0.08)"
          strokeWidth={G.sw} strokeLinecap="round" />

        {/* Filled arc */}
        <motion.path
          d={filledArc(p)}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={G.sw}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: fillDelay, duration: 0.8, ease: 'easeOut' }}
        />

        {/* Tick marks */}
        {TICKS.map((t) => {
          const pt = arcPoint(t)
          return (
            <motion.circle
              key={t}
              cx={pt.x} cy={pt.y}
              r={t === 1.0 ? 2.5 : 1.5}
              fill={t >= 1.0 ? '#FC5A5A55' : t >= 0.75 ? '#FFAB2E55' : 'rgba(255,255,255,0.16)'}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: fillDelay + 0.3, duration: 0.3 }}
            />
          )
        })}

        {/* Indicator dot */}
        <motion.circle
          cx={dot.x} cy={dot.y}
          r={G.sw / 2 + 2.5}
          fill={color}
          filter={`url(#${glid})`}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: fillDelay + 0.45, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        />
        <motion.circle
          cx={dot.x} cy={dot.y} r={3}
          fill="rgba(255,255,255,0.95)"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: fillDelay + 0.5, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
        />

        {/* Centre percentage text */}
        <motion.text
          x={G.cx} y={G.cy - 20} textAnchor="middle"
          fill={color} fontSize={16} fontWeight={800}
          fontFamily="'Nunito Variable', sans-serif"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: fillDelay + 0.2, duration: 0.4 }}
        >
          {row.progressPct.toFixed(0)}%
        </motion.text>
      </svg>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <motion.div
        style={{ padding: '8px 12px 14px', marginTop: 'auto' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: fillDelay + 0.1, duration: 0.4 }}
      >
        <p style={{
          margin: '0 0 4px',
          fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.75)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          letterSpacing: '-0.01em',
        }}>
          {row.label}
        </p>
        <p style={{
          margin: 0,
          fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
          fontFamily: "'Nunito Variable', sans-serif",
        }}>
          <span style={{ color, fontWeight: 800 }}>
            {formatCurrencyFloored(row.consumedAmount)}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>
            {' '}/{' '}
          </span>
          {formatCurrencyFloored(row.objectiveAmount)}
        </p>
      </motion.div>
    </motion.div>
  )
}

// ── Public export ─────────────────────────────────────────────────
interface OptimizationsModalProps {
  data: OptimizationRow[]
  formatCurrencyFloored: (n: number) => string
}

export function OptimizationsModal({ data, formatCurrencyFloored }: OptimizationsModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0)

  // Show 1 card per slide, limit to 8 total cards
  const displayData = data.slice(0, 8)
  const totalSlides = displayData.length

  const canGoPrev = currentSlide > 0
  const canGoNext = currentSlide < totalSlides - 1

  const handlePrev = () => {
    if (canGoPrev) setCurrentSlide(currentSlide - 1)
  }

  const handleNext = () => {
    if (canGoNext) setCurrentSlide(currentSlide + 1)
  }

  // Get the current slide's card
  const startIdx = currentSlide
  const currentCards = displayData.slice(startIdx, startIdx + 1)

  return (
    <div style={{
      padding: '16px 14px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Carousel Container */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        {/* Left Arrow */}
        <motion.button
          onClick={handlePrev}
          disabled={!canGoPrev}
          aria-label="Slide précédent"
          whileHover={canGoPrev ? { scale: 1.08 } : {}}
          whileTap={canGoPrev ? { scale: 0.94 } : {}}
          style={{
            flexShrink: 0,
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: `1.5px solid ${canGoPrev ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
            background: canGoPrev
              ? 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)'
              : 'rgba(255,255,255,0.02)',
            color: canGoPrev
              ? 'rgba(255,255,255,0.7)'
              : 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: canGoPrev ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(8px)',
          }}
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </motion.button>

        {/* Cards Grid */}
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 12,
          overflow: 'hidden',
        }}>
          <AnimatePresence mode="wait">
            {currentCards.map((row, i) => (
              <GaugeCard
                key={`${currentSlide}-${startIdx + i}`}
                row={row}
                idx={startIdx + i}
                formatCurrencyFloored={formatCurrencyFloored}
                slideIndex={currentSlide}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Right Arrow */}
        <motion.button
          onClick={handleNext}
          disabled={!canGoNext}
          aria-label="Slide suivant"
          whileHover={canGoNext ? { scale: 1.08 } : {}}
          whileTap={canGoNext ? { scale: 0.94 } : {}}
          style={{
            flexShrink: 0,
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: `1.5px solid ${canGoNext ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
            background: canGoNext
              ? 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)'
              : 'rgba(255,255,255,0.02)',
            color: canGoNext
              ? 'rgba(255,255,255,0.7)'
              : 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: canGoNext ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(8px)',
          }}
        >
          <ChevronRight size={20} strokeWidth={2.5} />
        </motion.button>
      </div>

      {/* Slide Indicators */}
      {totalSlides > 1 && (
        <motion.div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            marginTop: 2,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          {Array.from({ length: totalSlides }).map((_, i) => (
            <motion.button
              key={i}
              onClick={() => setCurrentSlide(i)}
              aria-label={`Aller au slide ${i + 1}`}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              style={{
                width: currentSlide === i ? 10 : 7,
                height: 7,
                borderRadius: '50%',
                border: 'none',
                background: currentSlide === i
                  ? 'rgba(255,255,255,0.8)'
                  : 'rgba(255,255,255,0.25)',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            />
          ))}
        </motion.div>
      )}
    </div>
  )
}
