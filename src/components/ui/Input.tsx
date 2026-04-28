import {
  forwardRef,
  memo,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'

type InputType = 'text' | 'email' | 'password' | 'number' | 'date' | 'search'
type InputSize = 'sm' | 'md' | 'lg'

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'size' | 'type' | 'value' | 'onChange'
>

export interface InputProps extends NativeInputProps {
  type?: InputType
  placeholder?: string
  value?: string
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  error?: boolean
  errorMessage?: string
  label?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  className?: string
  size?: InputSize
}

const sizeStyles: Record<InputSize, { paddingY: number; paddingX: number }> = {
  sm: { paddingY: 8, paddingX: 12 },
  md: { paddingY: 12, paddingX: 16 },
  lg: { paddingY: 14, paddingX: 18 },
}

const InputBase = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    type = 'text',
    placeholder,
    value,
    onChange,
    disabled = false,
    error = false,
    errorMessage,
    label,
    leftIcon,
    rightIcon,
    className,
    size = 'md',
    id,
    ...rest
  },
  ref,
) {
  const inputId = id ?? rest.name
  const hasLeftIcon = Boolean(leftIcon)
  const hasRightIcon = Boolean(rightIcon)
  const spacing = sizeStyles[size]

  const paddingLeft = hasLeftIcon ? spacing.paddingX + 20 : spacing.paddingX
  const paddingRight = hasRightIcon ? spacing.paddingX + 20 : spacing.paddingX

  const inputClasses = [
    'w-full rounded-[var(--radius-input)] border bg-[var(--neutral-0)]',
    'text-[var(--font-size-base)] font-normal [font-family:var(--font-sans)] leading-none',
    'placeholder:text-[var(--neutral-700)] placeholder:opacity-60',
    'focus:outline-none',
    disabled ? 'bg-[var(--neutral-100)] opacity-60 cursor-not-allowed' : '',
    error
      ? 'border-[var(--color-error)] text-[var(--color-error)]'
      : 'border-[var(--neutral-200)] text-[var(--neutral-700)] focus:border-[var(--primary-500)]',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1 block text-[12px] font-semibold text-[var(--neutral-700)] [font-family:var(--font-sans)]"
        >
          {label}
        </label>
      ) : null}

      <div className="relative">
        {hasLeftIcon ? (
          <span
            className="pointer-events-none absolute left-2 top-1/2 inline-flex h-3 w-3 -translate-y-1/2 items-center justify-center text-[var(--neutral-700)]"
            aria-hidden="true"
          >
            {leftIcon}
          </span>
        ) : null}

        <input
          ref={ref}
          id={inputId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={error}
          className={inputClasses}
          style={{
            paddingTop: spacing.paddingY,
            paddingBottom: spacing.paddingY,
            paddingLeft,
            paddingRight,
            boxShadow: 'none',
            transition:
              'border-color var(--transition-fast), box-shadow var(--transition-fast), background-color var(--transition-fast), color var(--transition-fast)',
          }}
          onFocus={(event) => {
            if (!error) {
              event.currentTarget.style.boxShadow = '0 0 0 3px rgba(67,97,238,0.1)'
            }
            rest.onFocus?.(event)
          }}
          onBlur={(event) => {
            event.currentTarget.style.boxShadow = 'none'
            rest.onBlur?.(event)
          }}
          {...rest}
        />

        {hasRightIcon ? (
          <span
            className="pointer-events-none absolute right-2 top-1/2 inline-flex h-3 w-3 -translate-y-1/2 items-center justify-center text-[var(--neutral-700)]"
            aria-hidden="true"
          >
            {rightIcon}
          </span>
        ) : null}
      </div>

      {error && errorMessage ? (
        <p className="mt-1 text-[11px] text-[var(--color-error)] [font-family:var(--font-sans)]">{errorMessage}</p>
      ) : null}
    </div>
  )
})

export const Input = memo(InputBase)
Input.displayName = 'Input'
