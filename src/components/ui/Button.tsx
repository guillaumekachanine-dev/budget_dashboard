import {
  forwardRef,
  memo,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'success' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type' | 'children'>

export interface ButtonProps extends NativeButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
  type?: 'button' | 'submit' | 'reset'
  children: ReactNode
  onClick?: () => void
  className?: string
}

const baseClassName = [
  'relative inline-flex items-center justify-center gap-2',
  'font-medium leading-none whitespace-nowrap select-none',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--primary-500)]',
  'shadow-[var(--shadow-sm)]',
  'hover:scale-[1.01] active:scale-[0.99]',
  '[transition:background-color_var(--transition-base),color_var(--transition-base),border-color_var(--transition-base),box-shadow_var(--transition-base),transform_var(--transition-base),opacity_var(--transition-base)]',
].join(' ')

const variantClassNames: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--primary-500)] text-white border border-transparent hover:bg-[var(--primary-600)] active:bg-[var(--primary-700)]',
  secondary:
    'bg-[var(--primary-50)] text-[var(--primary-700)] border border-[var(--primary-200)] hover:bg-[var(--primary-100)] active:bg-[var(--primary-200)]',
  outline:
    'bg-transparent text-[var(--primary-600)] border border-[var(--primary-300)] hover:bg-[var(--primary-50)] active:bg-[var(--primary-100)]',
  ghost:
    'bg-transparent text-[var(--primary-600)] border border-transparent hover:bg-[var(--primary-50)] active:bg-[var(--primary-100)] shadow-none',
  success:
    'bg-[var(--success,var(--color-success))] text-white border border-transparent hover:brightness-95 active:brightness-90',
  danger:
    'bg-[var(--color-error)] text-white border border-transparent hover:brightness-95 active:brightness-90',
}

const sizeClassNames: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-[52px] px-5 text-base',
}

const ButtonBase = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    type = 'button',
    children,
    onClick,
    className,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading

  const classes = [
    baseClassName,
    variantClassNames[variant],
    sizeClassNames[size],
    'rounded-[var(--radius-button)]',
    fullWidth ? 'w-full' : '',
    isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={loading}
      onClick={onClick}
      {...rest}
    >
      {loading && (
        <span
          className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      <span
        className={[
          'inline-flex items-center justify-center gap-2',
          loading ? 'opacity-0' : 'opacity-100',
          '[transition:opacity_var(--transition-base)]',
        ].join(' ')}
      >
        {leftIcon ? <span className="inline-flex h-4 w-4 items-center justify-center">{leftIcon}</span> : null}
        <span>{children}</span>
        {rightIcon ? <span className="inline-flex h-4 w-4 items-center justify-center">{rightIcon}</span> : null}
      </span>
    </button>
  )
})

const areEqual = (prevProps: ButtonProps, nextProps: ButtonProps) =>
  prevProps.variant === nextProps.variant &&
  prevProps.size === nextProps.size &&
  prevProps.disabled === nextProps.disabled &&
  prevProps.loading === nextProps.loading &&
  prevProps.leftIcon === nextProps.leftIcon &&
  prevProps.rightIcon === nextProps.rightIcon &&
  prevProps.fullWidth === nextProps.fullWidth &&
  prevProps.type === nextProps.type &&
  prevProps.children === nextProps.children &&
  prevProps.onClick === nextProps.onClick &&
  prevProps.className === nextProps.className

export const Button = memo(ButtonBase, areEqual)
Button.displayName = 'Button'
