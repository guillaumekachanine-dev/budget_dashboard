import { memo, type ReactNode } from 'react'

type BadgeVariant = 'success' | 'error' | 'warning' | 'neutral' | 'primary' | 'info'
type BadgeSize = 'sm' | 'md'

export interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  icon?: ReactNode
  onClick?: () => void
  className?: string
}

const variantClassNames: Record<BadgeVariant, string> = {
  success: 'bg-[#E8F5E9] text-[var(--color-success)]',
  error: 'bg-[#FDECEA] text-[var(--color-error)]',
  warning: 'bg-[#FFF3E0] text-[var(--color-warning)]',
  neutral: 'bg-[var(--neutral-100)] text-[var(--neutral-700)]',
  primary: 'bg-[var(--primary-50)] text-[var(--primary-700)]',
  info: 'bg-[var(--primary-50)] text-[var(--primary-600)]',
}

const sizeStyles: Record<BadgeSize, { padding: string; fontSize: string; fontWeight: number }> = {
  sm: { padding: '4px 10px', fontSize: '12px', fontWeight: 600 },
  md: { padding: '6px 12px', fontSize: '13px', fontWeight: 600 },
}

function BadgeComponent({
  children,
  variant = 'neutral',
  size = 'sm',
  icon,
  onClick,
  className,
}: BadgeProps) {
  const style = sizeStyles[size]

  const classes = [
    'inline-flex items-center rounded-[var(--radius-pill)] leading-none whitespace-nowrap select-none',
    'transition-all duration-200',
    variantClassNames[variant],
    onClick
      ? 'cursor-pointer hover:brightness-95 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-500)] focus-visible:ring-offset-2'
      : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      {icon ? (
        <span className="inline-flex items-center justify-center shrink-0" style={{ width: 12, height: 12 }}>
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        style={{
          padding: style.padding,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          gap: '6px',
          transition: 'all var(--transition-base)',
        }}
        onClick={onClick}
      >
        {content}
      </button>
    )
  }

  return (
    <span
      className={classes}
      style={{
        padding: style.padding,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        gap: '6px',
      }}
    >
      {content}
    </span>
  )
}

export const Badge = memo(BadgeComponent)
Badge.displayName = 'Badge'
