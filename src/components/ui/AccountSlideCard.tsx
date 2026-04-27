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
  onSelect?: () => void
}

export function AccountSlideCard({ card, index, onSelect }: AccountSlideCardProps) {
  const { title, subtitle, amount, progress, referenceAmount, gradient } = card

  const pct = Math.min(Math.max(progress, 0), 100)
  const referenceLabel = referenceAmount > 0 ? `sur ${formatCompact(referenceAmount)}` : subtitle

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, duration: 0.35, ease: 'easeOut' }}
      whileTap={{ scale: 0.97 }}
      onClick={onSelect}
      style={{
        width: 164,
        minWidth: 164,
        height: 122,
        borderRadius: 4,
        background: 'var(--neutral-50)',
        padding: '12px 10px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
        border: 'none',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: gradient[0],
            opacity: 0.9,
          }}
        />
        <div style={{
          fontSize: 9,
          fontWeight: 500,
          color: 'var(--neutral-300)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 96,
        }}>
          {title}
        </div>
      </div>

      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 20,
        fontWeight: 700,
        color: 'var(--neutral-900)',
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
      }}>
        {formatCompact(amount)}
      </div>

      <div>
        <div style={{
          height: 3,
          background: 'var(--neutral-100)',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ delay: 0.3 + 0.05 * index, duration: 0.7, ease: 'easeOut' }}
            style={{
              height: '100%',
              background: 'var(--primary-500)',
              borderRadius: 2,
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
          <span style={{
            fontSize: 9,
            color: 'var(--neutral-400)',
          }}>
            {Math.round(pct)}% du total
          </span>
          <span style={{
            fontSize: 9,
            color: 'var(--neutral-400)',
          }}>
            {referenceLabel}
          </span>
        </div>
      </div>
    </motion.button>
  )
}
