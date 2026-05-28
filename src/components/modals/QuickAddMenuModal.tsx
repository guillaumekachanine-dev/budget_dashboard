import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Upload } from 'lucide-react'

interface QuickAddMenuModalProps {
  open: boolean
  onClose: () => void
  onAddTransaction: () => void
  onOpenUpdate: () => void
}

type ActionItemProps = {
  label: string
  icon: 'plus' | 'upload'
  onClick: () => void
}

function ActionItem({ label, icon, onClick }: ActionItemProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      style={{
        border: 'none',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
        cursor: 'pointer',
        minWidth: 116,
      }}
    >
      <motion.span
        aria-hidden="true"
        whileHover={{ scale: 1.04 }}
        style={{
          width: 72,
          height: 72,
          borderRadius: 'var(--radius-full)',
          border: '1.5px solid color-mix(in oklab, var(--primary-500) 26%, var(--neutral-0))',
          background: 'var(--neutral-0)',
          color: 'var(--primary-600)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-card)',
          transition: 'transform 140ms ease-out, box-shadow 140ms ease-out',
        }}
      >
        {icon === 'plus' ? <Plus size={28} strokeWidth={2.4} /> : <Upload size={26} strokeWidth={2.3} />}
      </motion.span>
      <span
        style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 700,
          color: 'var(--neutral-800)',
          textAlign: 'center',
          lineHeight: 1.15,
        }}
      >
        {label}
      </span>
    </motion.button>
  )
}

export function QuickAddMenuModal({ open, onClose, onAddTransaction, onOpenUpdate }: QuickAddMenuModalProps) {
  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 60,
              border: 'none',
              background: 'rgba(14,16,34,0.28)',
              padding: 0,
              cursor: 'pointer',
            }}
            aria-label="Fermer le menu rapide"
            onClick={onClose}
          />

          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 'calc(var(--nav-height) + var(--space-2))',
              zIndex: 61,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
              paddingLeft: 'var(--space-3)',
              paddingRight: 'var(--space-3)',
            }}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-label="Choisir une action"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ duration: 0.17, ease: [0.4, 0, 1, 1] }}
              style={{
                width: 'min(370px, calc(100vw - 22px))',
                minHeight: 162,
                borderRadius: 'var(--radius-xl)',
                border: '1px solid color-mix(in oklab, var(--neutral-200) 70%, var(--neutral-0))',
                background: 'var(--neutral-0)',
                boxShadow: 'var(--shadow-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-evenly',
                padding: 'var(--space-4) var(--space-3)',
                willChange: 'transform, opacity',
                pointerEvents: 'auto',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <ActionItem label="Mettre à jour" icon="upload" onClick={onOpenUpdate} />
              <ActionItem label="Ajouter transaction" icon="plus" onClick={onAddTransaction} />
            </motion.section>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
