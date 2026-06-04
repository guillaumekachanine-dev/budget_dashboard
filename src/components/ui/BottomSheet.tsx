import { type ReactNode, useRef } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  /** Custom header replaces the default title+close row */
  header?: ReactNode
  children: ReactNode
  maxHeight?: string
  /** zIndex for backdrop; sheet will be zIndex+1 */
  zIndex?: number
  variant?: 'sheet' | 'center'
  /** Apply frosted-glass effect to the sheet (center variant only) */
  glass?: boolean
  /** Override glass background color — e.g. 'rgba(25,14,5,0.52)' for warm tint */
  glassBackground?: string
  /** Override glass border color — e.g. 'rgba(255,171,46,0.14)' for amber accent */
  glassBorder?: string
  /** layoutId for shared layout animations with Framer Motion */
  layoutId?: string
  motionPreset?: 'default' | 'heroAction'
  onExitComplete?: () => void
}

const SWIPE_CLOSE_THRESHOLD_Y = 72
const SWIPE_CLOSE_VELOCITY = 400

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  header,
  children,
  maxHeight = '85dvh',
  zIndex = 200,
  variant = 'sheet',
  glass = false,
  glassBackground,
  glassBorder,
  layoutId,
  motionPreset = 'default',
  onExitComplete,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const isCenter = variant === 'center'

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > SWIPE_CLOSE_THRESHOLD_Y || info.velocity.y > SWIPE_CLOSE_VELOCITY) {
      onClose()
    }
  }

  const hasHeader = title != null || header != null || subtitle != null

  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex,
    background: 'rgba(13, 13, 31, 0.52)',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
  }

  const isGlass = glass && isCenter

  const sheetStyle: React.CSSProperties = isCenter
    ? {
        position: 'relative',
        zIndex: zIndex + 1,
        width: 'calc(100% - 32px)',
        maxWidth: 480,
        background: isGlass
          ? (glassBackground ?? 'rgba(10, 12, 30, 0.52)')
          : 'var(--neutral-0)',
        backdropFilter: isGlass ? 'blur(var(--blur-lg)) saturate(160%)' : undefined,
        WebkitBackdropFilter: isGlass ? 'blur(var(--blur-lg)) saturate(160%)' : undefined,
        borderRadius: 'var(--radius-xl)',
        border: isGlass ? `1px solid ${glassBorder ?? 'rgba(255,255,255,0.1)'}` : undefined,
        boxShadow: isGlass
          ? `0 8px 48px rgba(0,0,0,0.55), inset 0 1px 0 ${glassBorder ?? 'rgba(255,255,255,0.08)'}, inset 0 -1px 0 rgba(255,255,255,0.03)`
          : 'var(--shadow-xl)',
        maxHeight,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        touchAction: 'auto',
        pointerEvents: 'auto',
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

  const centerAnimProps = motionPreset === 'heroAction'
    ? {
        initial: { scale: 0.9, opacity: 0, y: 18, filter: 'blur(8px)' },
        animate: { scale: 1, opacity: 1, y: 0, filter: 'blur(0px)' },
        exit: { scale: 0.94, opacity: 0, y: 18, filter: 'blur(6px)' },
        transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
      }
    : {
        initial: { scale: 0.08, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: 0.08, opacity: 0 },
        transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
      }

  const animProps = layoutId
    ? {
        layoutId,
        transition: { type: 'spring' as const, stiffness: 280, damping: 34, mass: 0.9 },
      }
    : isCenter
    ? centerAnimProps
    : {
        initial: { y: '100%' },
        animate: { y: 0 },
        exit: { y: '100%' },
        transition: { type: 'spring', damping: 32, stiffness: 340, mass: 0.9 },
      }

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
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
          {(() => {
            const sheetElement = (
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
                      padding: '8px var(--space-5)',
                      borderBottom: isGlass ? `1px solid ${glassBorder ?? 'rgba(255,255,255,0.08)'}` : '1px solid var(--neutral-150)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-3)',
                      flexShrink: 0,
                    }}
                  >
                    {header ?? (
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                        <p style={{
                          margin: 0,
                          fontSize: 'var(--font-size-md)',
                          fontWeight: 800,
                          color: isGlass ? 'rgba(255,255,255,0.88)' : 'var(--neutral-900)',
                          letterSpacing: isGlass ? '-0.01em' : undefined,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {title}
                        </p>
                        {subtitle && (
                          <p style={{
                            margin: '2px 0 0',
                            fontSize: 'var(--font-size-xs)',
                            color: isGlass ? 'rgba(255,255,255,0.48)' : 'var(--neutral-500)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {subtitle}
                          </p>
                        )}
                      </div>
                    )}
                    {!header ? (
                      <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fermer"
                        style={{
                          flexShrink: 0,
                          border: isGlass ? '1px solid rgba(255,255,255,0.14)' : 'none',
                          background: isGlass ? 'rgba(255,255,255,0.09)' : 'var(--neutral-100)',
                          color: isGlass ? 'rgba(255,255,255,0.6)' : 'var(--neutral-600)',
                          width: 32,
                          height: 32,
                          minWidth: 32,
                          minHeight: 32,
                          borderRadius: 'var(--radius-full)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <X size={11} />
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
            )

            if (isCenter) {
              return (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: zIndex + 1,
                    pointerEvents: 'none',
                  }}
                >
                  {sheetElement}
                </div>
              )
            }

            return sheetElement
          })()}
        </>
      ) : null}
    </AnimatePresence>
  )
}
