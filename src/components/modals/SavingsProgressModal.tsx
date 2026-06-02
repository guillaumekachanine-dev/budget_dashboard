import { useMemo } from 'react'
import { Check, X } from 'lucide-react'

interface SavingsProgressModalProps {
  savingsYtdDisplay: number
  savingsAnnualGoalDisplay: number
  savingsYtdProgressPct: number
  savingsMonthlyGoalDisplay: number
  savingsGoalReached: boolean
  savingsMonthLabel: string
  formatCurrencyFloored: (n: number) => string
  onClose: () => void
}

// Cubic-bezier sine-wave approximation: numPeriods × 200 SVG units wide.
// Fills from wave surface down to y=200 (bottom of 200×200 viewBox).
function buildWavePath(meanY: number, amp: number, numPeriods: number): string {
  const period = 200
  const parts: string[] = [`M 0 ${meanY}`]
  for (let i = 0; i < numPeriods; i++) {
    const x = i * period
    parts.push(`C ${x + 50} ${meanY - amp} ${x + 50} ${meanY - amp} ${x + 100} ${meanY}`)
    parts.push(`C ${x + 150} ${meanY + amp} ${x + 150} ${meanY + amp} ${x + 200} ${meanY}`)
  }
  parts.push(`L ${period * numPeriods} 200 L 0 200 Z`)
  return parts.join(' ')
}

export function SavingsProgressModal({
  savingsYtdDisplay,
  savingsAnnualGoalDisplay,
  savingsYtdProgressPct,
  savingsMonthlyGoalDisplay,
  savingsGoalReached,
  savingsMonthLabel,
  formatCurrencyFloored,
  onClose,
}: SavingsProgressModalProps) {
  const progress = Math.max(0, Math.min(100, savingsYtdProgressPct))

  const AMP = 7
  // Y of the mean water line: 0 = circle full, 200 = circle empty
  const waveY = useMemo(() => {
    const raw = 200 * (1 - progress / 100)
    return Math.max(AMP + 14, Math.min(200 - AMP - 10, raw))
  }, [progress])

  // Wave 1: 2 periods (0→400), animated from x=0 to x=-200 (one seamless period)
  const wave1Path = buildWavePath(waveY, AMP, 2)
  // Wave 2: 3 periods (0→600), animated from x=-100 to x=-300 (same seamless distance)
  const wave2Path = buildWavePath(waveY, AMP * 0.55, 3)

  return (
    <div style={{ padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Annual YTD — Liquid Wave Circle ─────────────────────── */}
      <div style={{
        background: 'linear-gradient(150deg, #0C0B22 0%, #160F35 60%, #1A1245 100%)',
        borderRadius: 20,
        padding: '28px 20px 22px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 12px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}>
        {/* Ambient glow behind circle */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 70% 55% at 50% 95%, rgba(255,171,46,0.09) 0%, transparent 70%)',
        }} />

        {/* ── Close button — top-right corner of the card ── */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 10,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.65)',
            width: 28,
            height: 28,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X size={13} strokeWidth={2} />
        </button>

        {/* Liquid Wave SVG — 172×172 render, 200×200 viewBox */}
        <svg
          viewBox="0 0 200 200"
          width={172}
          height={172}
          style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}
        >
          <defs>
            <clipPath id="spm-circle-clip">
              <circle cx="100" cy="100" r="88" />
            </clipPath>
            <radialGradient id="spm-bg" cx="50%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#1E1645" />
              <stop offset="100%" stopColor="#080618" />
            </radialGradient>
            {/* Amber gradient for wave fill */}
            <linearGradient id="spm-wave-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFCA60" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#F59B10" stopOpacity="0.98" />
            </linearGradient>
            {/* Outer ring gradient */}
            <linearGradient id="spm-ring-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,202,96,0.6)" />
              <stop offset="100%" stopColor="rgba(255,171,46,0.15)" />
            </linearGradient>
          </defs>

          {/* Dark background */}
          <circle cx="100" cy="100" r="88" fill="url(#spm-bg)" />

          {/* Clipped wave area */}
          <g clipPath="url(#spm-circle-clip)">
            {/* Wave 2 — pale shimmer, slower */}
            <path d={wave2Path} fill="rgba(255,202,80,0.26)">
              <animateTransform
                attributeName="transform"
                type="translate"
                from="-100,0"
                to="-300,0"
                dur="3.2s"
                repeatCount="indefinite"
              />
            </path>
            {/* Wave 1 — main amber fill, faster */}
            <path d={wave1Path} fill="url(#spm-wave-fill)">
              <animateTransform
                attributeName="transform"
                type="translate"
                from="0,0"
                to="-200,0"
                dur="4.5s"
                repeatCount="indefinite"
              />
            </path>
          </g>

          {/* Outer decorative ring */}
          <circle cx="100" cy="100" r="88" fill="none" stroke="url(#spm-ring-grad)" strokeWidth="1.5" />
          {/* Inner subtle ring */}
          <circle cx="100" cy="100" r="83" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />

          {/* Readability backdrop oval */}
          <ellipse cx="100" cy="102" rx="68" ry="46" fill="rgba(6,4,26,0.5)" />

          {/* YTD amount */}
          <text
            x="100" y="90"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="20"
            fontWeight="800"
            fontFamily="'Nunito Variable', sans-serif"
          >
            {formatCurrencyFloored(savingsYtdDisplay)}
          </text>

          {/* Goal label */}
          <text
            x="100" y="108"
            textAnchor="middle"
            fill="rgba(255,255,255,0.4)"
            fontSize="11"
            fontFamily="'Nunito Variable', sans-serif"
          >
            sur {formatCurrencyFloored(savingsAnnualGoalDisplay)}
          </text>

          {/* Progress percentage */}
          <text
            x="100" y="130"
            textAnchor="middle"
            fill="#FFCA60"
            fontSize="17"
            fontWeight="800"
            fontFamily="'Nunito Variable', sans-serif"
          >
            {progress.toFixed(0)} %
          </text>
        </svg>

        {/* ── Caption: "Objectif épargne {month}" ── */}
        <p style={{
          margin: 0,
          fontSize: 10,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.52)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          whiteSpace: 'nowrap',
        }}>
          Objectif épargne {savingsMonthLabel}
        </p>

        {/* ── Monthly amount with watermark icon behind ── */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -8,
        }}>
          {/* Watermark icon centred behind the amount */}
          <div style={{
            position: 'absolute',
            opacity: 0.28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            {savingsGoalReached
              ? <Check size={44} color="#2ED47A" strokeWidth={2.5} />
              : <X size={44} color="#FC5A5A" strokeWidth={2.5} />
            }
          </div>
          {/* Amount / fallback text */}
          <div style={{
            fontSize: 17,
            fontWeight: 700,
            color: savingsGoalReached ? '#2ED47A' : 'rgba(255,255,255,0.82)',
            letterSpacing: '-0.01em',
            position: 'relative',
            zIndex: 1,
          }}>
            {savingsMonthlyGoalDisplay > 0
              ? formatCurrencyFloored(savingsMonthlyGoalDisplay)
              : <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.48)', letterSpacing: 0 }}>Pas d&apos;épargne</span>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
