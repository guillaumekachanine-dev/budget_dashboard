import { memo, type ReactNode } from 'react'

type KpiFormat = 'currency' | 'percent' | 'number'
type KpiColor = 'default' | 'positive' | 'negative' | 'warning'

export interface KpiCardProps {
  label: string
  value: number
  delta?: number
  deltaLabel?: string
  format?: KpiFormat
  color?: KpiColor
  icon?: ReactNode
  subtitle?: string
  onClick?: () => void
  className?: string
}

const formatters = {
  currency: new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }),
  percent: new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }),
  number: new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }),
} as const

const valueColorClassNames: Record<KpiColor, string> = {
  default: 'text-[var(--neutral-900)]',
  positive: 'text-[var(--color-positive)]',
  negative: 'text-[var(--color-negative)]',
  warning: 'text-[var(--color-warning)]',
}

const deltaClassNames = {
  positive: 'bg-[#E8F5E9] text-[#2E7D32]',
  negative: 'bg-[#FDECEA] text-[#C0392B]',
  warning: 'bg-[#FFF3E0] text-[#E65100]',
} as const

function formatValue(value: number, format: KpiFormat): string {
  if (format === 'percent') {
    return `${formatters.percent.format(value)}%`
  }
  return formatters[format].format(value)
}

function formatDelta(delta: number, format: KpiFormat): string {
  const sign = delta > 0 ? '+' : ''
  if (format === 'percent') {
    return `${sign}${formatters.percent.format(delta)}%`
  }
  return `${sign}${formatters.number.format(delta)}`
}

function KpiCardComponent({
  label,
  value,
  delta,
  deltaLabel,
  format = 'currency',
  color = 'default',
  icon,
  subtitle,
  onClick,
  className,
}: KpiCardProps) {
  const deltaVariant = color === 'warning' ? 'warning' : (delta ?? 0) < 0 ? 'negative' : 'positive'

  const classes = [
    'rounded-[var(--radius-lg)] bg-[var(--neutral-0)] p-5 shadow-[var(--shadow-sm)]',
    'transition-transform [transition-duration:var(--transition-base)]',
    onClick ? 'cursor-pointer hover:scale-[1.02]' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classes}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2">
        {icon ? (
          <span className="inline-flex h-4 w-4 items-center justify-center text-[var(--neutral-500)]" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--neutral-400)]">{label}</p>
      </div>

      <p className={[ 'mt-2 m-0 text-[28px] font-extrabold leading-none [font-family:var(--font-mono)]', valueColorClassNames[color] ].join(' ')}>
        {formatValue(value, format)}
      </p>

      {subtitle ? <p className="mt-1 m-0 text-[12px] text-[var(--neutral-600)]">{subtitle}</p> : null}

      {delta !== undefined || deltaLabel ? (
        <div className="mt-3">
          <span className={[ 'inline-block rounded-[var(--radius-pill)] px-2 py-[2px] text-[12px] font-bold', deltaClassNames[deltaVariant] ].join(' ')}>
            {deltaLabel ?? (delta !== undefined ? formatDelta(delta, format) : '')}
          </span>
        </div>
      ) : null}
    </div>
  )
}

export const KpiCard = memo(KpiCardComponent)
KpiCard.displayName = 'KpiCard'
