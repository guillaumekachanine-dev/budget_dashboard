import {
  forwardRef,
  memo,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

type CardVariant = 'default' | 'elevated' | 'outlined'
type CardPadding = 'none' | 'sm' | 'md' | 'lg'
type CardTag = 'div' | 'section' | 'article'

type NativeCardProps = Omit<HTMLAttributes<HTMLElement>, 'onClick' | 'children' | 'className'>

export interface CardProps extends NativeCardProps {
  children: ReactNode
  className?: string
  variant?: CardVariant
  padding?: CardPadding
  hover?: boolean
  onClick?: () => void
  as?: CardTag
}

const baseClassName = [
  'bg-[var(--neutral-0)] rounded-[var(--radius-lg)]',
  '[transition:transform_var(--transition-base),box-shadow_var(--transition-base),border-color_var(--transition-base)]',
].join(' ')

const variantClassNames: Record<CardVariant, string> = {
  default: 'shadow-[var(--shadow-sm)] border border-transparent',
  elevated: 'shadow-[var(--shadow-md)] border border-transparent',
  outlined: 'shadow-none border border-[var(--neutral-200)]',
}

const paddingClassNames: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-[var(--space-3)]',
  md: 'p-[var(--space-5)]',
  lg: 'p-[var(--space-6)]',
}

const CardBase = forwardRef<HTMLElement, CardProps>(function Card(
  {
    children,
    className,
    variant = 'default',
    padding = 'md',
    hover = false,
    onClick,
    as = 'div',
    ...rest
  },
  ref,
) {
  const isInteractive = typeof onClick === 'function'

  const classNames = [
    baseClassName,
    variantClassNames[variant],
    paddingClassNames[padding],
    hover ? 'hover:scale-[1.02]' : '',
    isInteractive ? 'cursor-pointer' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const handleKeyDown = isInteractive
    ? (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }
    : undefined

  const Component = as

  return (
    <Component
      ref={ref as never}
      className={classNames}
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {children}
    </Component>
  )
})

export const Card = memo(CardBase)
Card.displayName = 'Card'
