import { motion } from 'framer-motion'
import { formatCompact } from '@/lib/utils'

export interface SlideCardData {
  id: string
  title: string
  subtitle: string
  amount: number
  progress: number             // 0-100
  referenceAmount: number
  gradient: [string, string]
}

interface AccountSlideCardProps {
  card: SlideCardData
  index: number
}

export function AccountSlideCard({ card, index }: AccountSlideCardProps) {
  const { title, subtitle, amount, progress, referenceAmount, gradient } = card

  const pct = Math.min(Math.max(progress, 0), 100)
  const referenceLabel = referenceAmount > 0 ? `sur ${formatCompact(referenceAmount)}` : subtitle

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, duration: 0.35, ease: 'easeOut' }}
      whileTap={{ scale: 0.97 }}
      style={{
        width: 176,
        minWidth: 176,
        height: 136,
        borderRadius: 22,
        background: `linear-gradient(155deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`,
        padding: '14px 14px 12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 8px 24px ${gradient[1]}55`,
      }}
    >
      {/* Decorative circle */}
      <div style={{
        position: 'absolute', top: -28, right: -28,
        width: 90, height: 90,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.72)',
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 110,
        }}>
          {title}
        </div>
        <div style={{
          borderRadius: 'var(--radius-full)',
          background: 'rgba(255,255,255,0.94)',
          color: gradient[1],
          fontSize: 10,
          fontWeight: 700,
          padding: '4px 10px',
          lineHeight: 1,
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
        }}>
          {subtitle}
        </div>
      </div>

      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 34,
        fontWeight: 700,
        color: '#fff',
        letterSpacing: '-1px',
        lineHeight: 0.95,
      }}>
        {formatCompact(amount)}
      </div>

      <div>
        <div style={{
          height: 7,
          background: 'rgba(255,255,255,0.28)',
          borderRadius: 9999,
          overflow: 'hidden',
        }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ delay: 0.3 + 0.05 * index, duration: 0.7, ease: 'easeOut' }}
            style={{
              height: '100%',
              background: 'rgba(255,255,255,0.9)',
              borderRadius: 9999,
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
          <span style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.75)',
            fontFamily: 'var(--font-mono)',
          }}>
            {Math.round(pct)}% du total
          </span>
          <span style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.75)',
            fontFamily: 'var(--font-mono)',
          }}>
            {referenceLabel}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
