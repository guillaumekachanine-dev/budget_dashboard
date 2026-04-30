import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  titleAriaLabel?: string
  onTitleClick?: () => void
  centerLabel?: string
  rightLabel?: string
  rightSlot?: ReactNode
  actionIcon?: ReactNode
  actionAriaLabel?: string
  onActionClick?: () => void
  actionDisabled?: boolean
}

export function PageHeader({
  title,
  titleAriaLabel,
  onTitleClick,
  centerLabel,
  rightLabel,
  rightSlot,
  actionIcon,
  actionAriaLabel = 'Action',
  onActionClick,
  actionDisabled = false,
}: PageHeaderProps) {
  const triggerAction = () => {
    if (actionDisabled || !onActionClick) return
    onActionClick()
  }

  return (
    <header
      style={{
        padding: 'calc(var(--safe-top-offset) + var(--space-2)) var(--page-gutter) var(--space-4)',
        background: 'linear-gradient(135deg, var(--primary-700) 0%, var(--primary-500) 100%)',
        borderBottom: '1px solid color-mix(in oklab, var(--primary-800) 35%, var(--primary-500) 65%)',
        position: 'relative',
        zIndex: 120,
        isolation: 'isolate',
        overflow: 'visible',
        marginBottom: 'var(--space-6)',
      }}
    >
      <div
        style={{
          maxWidth: 600,
          margin: '0 auto',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          minHeight: 'calc(var(--space-6) + var(--space-1))',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 'var(--font-size-2xl)',
            lineHeight: 'var(--line-height-tight)',
            fontWeight: 'var(--font-weight-extrabold)',
            color: 'var(--neutral-0)',
            letterSpacing: '-0.02em',
          }}
        >
          {onTitleClick ? (
            <button
              type="button"
              aria-label={titleAriaLabel ?? title}
              onClick={onTitleClick}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                font: 'inherit',
                letterSpacing: 'inherit',
                padding: 0,
                margin: 0,
                cursor: 'pointer',
              }}
            >
              {title}
            </button>
          ) : (
            title
          )}
        </h1>

        {centerLabel ? (
          <p
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              margin: 0,
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'color-mix(in oklab, var(--neutral-0) 92%, var(--primary-100) 8%)',
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
            }}
          >
            {centerLabel}
          </p>
        ) : null}

        {rightSlot ? (
          <div
            style={{
              position: 'absolute',
              right: 0,
            }}
          >
            {rightSlot}
          </div>
        ) : rightLabel ? (
          <p
            style={{
              position: 'absolute',
              right: 0,
              margin: 0,
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'color-mix(in oklab, var(--neutral-0) 92%, var(--primary-100) 8%)',
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
            }}
          >
            {rightLabel}
          </p>
        ) : null}
      </div>

      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 0,
          transform: 'translate(-50%, 50%)',
          zIndex: 121,
          pointerEvents: 'auto',
        }}
      >
        <button
          type="button"
          aria-label={actionAriaLabel}
          onClick={triggerAction}
          disabled={actionDisabled}
          style={{
            width: 'var(--space-16)',
            height: 'var(--space-16)',
            borderRadius: 'var(--radius-full)',
            border: '2px solid color-mix(in oklab, var(--neutral-0) 58%, var(--primary-200) 42%)',
            background: 'var(--neutral-200)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary-600)',
            boxShadow: 'var(--shadow-fab)',
            cursor: actionDisabled ? 'default' : 'pointer',
            transition: 'transform var(--transition-base), box-shadow var(--transition-base)',
          }}
        >
          {actionIcon ?? null}
        </button>
      </div>
    </header>
  )
}
