import { useCallback, useMemo, useRef, type CSSProperties } from 'react'
import { Calendar } from 'lucide-react'

type StableDateFieldProps = {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  disabled?: boolean
  min?: string
  max?: string
  required?: boolean
  placeholder?: string
  fullWidth?: boolean
  width?: CSSProperties['width']
  buttonStyle?: CSSProperties
  textStyle?: CSSProperties
  wrapperStyle?: CSSProperties
  showIcon?: boolean
  iconSize?: number
  iconColor?: string
  textAlign?: 'left' | 'center' | 'right'
}

function formatShortDate(value: string, placeholder: string): string {
  if (!value) return placeholder
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return placeholder
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function StableDateField({
  value,
  onChange,
  ariaLabel,
  disabled = false,
  min,
  max,
  required = false,
  placeholder = 'jj/mm/aaaa',
  fullWidth = false,
  width,
  buttonStyle,
  textStyle,
  wrapperStyle,
  showIcon = true,
  iconSize = 15,
  iconColor,
  textAlign = 'right',
}: StableDateFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const displayValue = useMemo(() => formatShortDate(value, placeholder), [placeholder, value])

  const openDatePicker = useCallback(() => {
    if (disabled) return
    const input = inputRef.current
    if (!input) return

    if ('showPicker' in input && typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }

    input.focus()
    input.click()
  }, [disabled])

  return (
    <div
      style={{
        position: 'relative',
        width: fullWidth ? '100%' : width,
        minWidth: 0,
        ...wrapperStyle,
      }}
    >
      <button
        type="button"
        onClick={openDatePicker}
        disabled={disabled}
        aria-label={value ? `${ariaLabel}: ${displayValue}` : ariaLabel}
        style={{
          width: fullWidth ? '100%' : width ?? 'auto',
          minWidth: 0,
          border: 'none',
          background: 'transparent',
          padding: 0,
          margin: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: textAlign === 'left' ? 'flex-start' : textAlign === 'center' ? 'center' : 'flex-end',
          gap: 6,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          color: disabled ? 'var(--neutral-400)' : value ? 'var(--neutral-900)' : 'var(--neutral-400)',
          opacity: disabled ? 0.7 : 1,
          ...buttonStyle,
        }}
      >
        <span
          style={{
            whiteSpace: 'nowrap',
            textAlign,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 'var(--line-height-tight)',
            ...textStyle,
          }}
        >
          {displayValue}
        </span>
        {showIcon ? <Calendar size={iconSize} strokeWidth={2.1} color={iconColor} style={{ flexShrink: 0 }} /> : null}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        min={min}
        max={max}
        required={required}
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
          border: 0,
          opacity: 0.001,
          pointerEvents: 'none',
          WebkitAppearance: 'none',
          appearance: 'none',
        }}
      />
    </div>
  )
}
