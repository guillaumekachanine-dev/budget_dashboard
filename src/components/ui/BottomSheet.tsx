import { type ReactNode, useRef } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  /** Custom header replaces the default title+close row */
  header?: ReactNode
  children: ReactNode
  maxHeight?: string
  /** zIndex for backdrop; sheet will be zIndex+1 */
  zIndex?: number
  variant?: 'sheet' | 'center'
}

const SWIPE_CLOSE_THRESHOLD_Y = 72
const SWIPE_CLOSE_VELOCITY = 400

export function BottomSheet({
  open,
  onClose,
  title,
  header,
  children,
  maxHeight = '85dvh',
  zIndex = 200,
  variant = 'sheet',
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const isCenter = variant === 'center'

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > SWIPE_CLOSE_THRESHOLD_Y || info.velocity.y > SWIPE_CLOSE_VELOCITY) {
      onClose()
    }
  }

  const hasHeader = title != null || header != null

  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex,
    background: 'rgba(13, 13, 31, 0.52)',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
  }

  const sheetStyle: React.CSSProperties = isCenter
    ? {
        position: 'fixed',
        left: '50%',
        top: '50%',
        zIndex: zIndex + 1,
        width: 'calc(100% - 32px)',
        maxWidth: 480,
        background: 'var(--neutral-0)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)',
        maxHeight: '90dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        touchAction: 'auto',
      }
    : {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: zIndex + 1,
        maxWidth: 'var(--page-max-width)',
        margin: '0 auto',
        background: 'var(--neutral-0)',
        borderRadius: 'var(--radius-2xl) var(--radius-2xl) 0 0',
        boxShadow: 'var(--shadow-xl)',
        maxHeight,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        paddingBottom: 'var(--safe-bottom)',
        touchAction: 'none',
      }

  const animProps = isCenter
    ? {
        initial: { scale: 0.08, opacity: 0, x: '-50%', y: '-50%' },
        animate: { scale: 1, opacity: 1, x: '-50%', y: '-50%' },
        exit: { scale: 0.08, opacity: 0, x: '-50%', y: '-50%' },
        transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
      }
    : {
        initial: { y: '100%' },
        animate: { y: 0 },
        exit: { y: '100%' },
        transition: { type: 'spring', damping: 32, stiffness: 340, mass: 0.9 },
      }

  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* Backdrop */}
          <motion.div
            key="bs-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={backdropStyle}
          />

          {/* Sheet */}
          <motion.div
            key="bs-sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            drag={isCenter ? false : 'y'}
            dragConstraints={isCenter ? undefined : { top: 0 }}
            dragElastic={isCenter ? undefined : { top: 0, bottom: 0.15 }}
            onDragEnd={isCenter ? undefined : handleDragEnd}
            {...animProps}
            style={sheetStyle}
          >
            {/* Drag handle */}
            {!isCenter && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  paddingTop: 10,
                  paddingBottom: hasHeader ? 6 : 10,
                  flexShrink: 0,
                  cursor: 'grab',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 4,
                    background: 'var(--neutral-300)',
                    borderRadius: 'var(--radius-full)',
                  }}
                />
              </div>
            )}

            {/* Header */}
            {hasHeader ? (
              <div
                style={{
                  padding: 'var(--space-3) var(--space-5) var(--space-3)',
                  borderBottom: '1px solid var(--neutral-150)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  flexShrink: 0,
                }}
              >
                {header ?? (
                  <p style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--neutral-900)' }}>
                    {title}
                  </p>
                )}
                {!header ? (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fermer"
                    style={{
                      flexShrink: 0,
                      border: 'none',
                      background: 'var(--neutral-100)',
                      color: 'var(--neutral-600)',
                      minWidth: 44,
                      minHeight: 44,
                      borderRadius: 'var(--radius-full)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* Close button for headless centered modals */}
            {isCenter && !hasHeader && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px 0 0', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  style={{
                    border: 'none',
                    background: 'var(--neutral-100)',
                    color: 'var(--neutral-600)',
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-full)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Scrollable content */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y',
              }}
            >
              {children}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
