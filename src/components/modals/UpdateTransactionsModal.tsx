import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

interface UpdateTransactionsModalProps {
  open: boolean
  onClose: () => void
}

export function UpdateTransactionsModal({ open, onClose }: UpdateTransactionsModalProps) {
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
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              inset: 0,
              border: 'none',
              zIndex: 104,
              background: 'rgba(13,13,31,0.45)',
              padding: 0,
              cursor: 'pointer',
            }}
            aria-label="Fermer"
            onClick={onClose}
          />

          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 105,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-4)',
              pointerEvents: 'none',
            }}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-label="Mettre à jour les transactions"
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{
                width: 'min(480px, 100%)',
                minHeight: 220,
                borderRadius: 'var(--radius-xl)',
                background: 'var(--neutral-0)',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--neutral-200)',
                padding: 'var(--space-5)',
                position: 'relative',
                pointerEvents: 'auto',
                willChange: 'transform, opacity',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 12,
                  width: 34,
                  height: 34,
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  background: 'var(--neutral-100)',
                  color: 'var(--neutral-700)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>

              <h2
                style={{
                  margin: 0,
                  fontSize: 'var(--font-size-xl)',
                  fontWeight: 800,
                  color: 'var(--neutral-900)',
                }}
              >
                Mettre à jour
              </h2>
              <p
                style={{
                  margin: 'var(--space-2) 0 0',
                  fontSize: 'var(--font-size-base)',
                  color: 'var(--neutral-600)',
                }}
              >
                Modale vide en place. Le flux d’upload d’images sera branché ici.
              </p>
            </motion.section>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
