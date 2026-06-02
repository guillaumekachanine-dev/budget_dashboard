import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

type DetailModalProps = {
  open: boolean
  title: string
  subtitle?: string
  accentColor?: string
  closeLabel?: string
  onClose: () => void
  children: ReactNode
}


export function DetailModal({
  open,
  title,
  subtitle,
  accentColor = '#F97316',
  closeLabel = 'Fermer',
  onClose,
  children,
}: DetailModalProps) {
  if (!open) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,30,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-5)',
      }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        onClick={(event) => event.stopPropagation()}
        style={{
          background: 'var(--neutral-0)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-5)',
          maxWidth: 320,
          width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            marginBottom: 'var(--space-4)',
            paddingBottom: 'var(--space-3)',
            borderBottom: `2px solid ${accentColor}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)' }}>
            {title}
          </p>
          {subtitle ? (
            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--neutral-400)' }}>
              {subtitle}
            </p>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxHeight: '260px',
            overflowY: 'auto',
            paddingRight: 'var(--space-2)',
          }}
          className="custom-scrollbar"
        >
          {children}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: '9px 0',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: accentColor,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            marginTop: 'var(--space-4)',
          }}
        >
          {closeLabel}
        </button>
      </motion.div>
    </motion.div>
  )
}

type DetailModalRowProps = {
  label: string
  value: string
  variant?: 'default' | 'total'
  glass?: boolean
}

export function DetailModalRow({
  label,
  value,
  variant = 'default',
  glass = false,
}: DetailModalRowProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 11, color: glass ? 'rgba(255, 255, 255, 0.55)' : 'var(--neutral-600)', lineHeight: 1.3 }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: variant === 'total' ? 800 : 600,
          fontFamily: 'var(--font-mono)',
          color: glass ? '#FFFFFF' : 'var(--neutral-900)',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  )
}

export function DetailModalSeparator({ glass = false }: { glass?: boolean }) {
  return <div style={{ borderTop: glass ? '1px dashed rgba(255, 255, 255, 0.15)' : '1px dashed var(--neutral-200)', margin: '2px 0' }} />
}
