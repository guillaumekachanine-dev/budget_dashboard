import type { CSSProperties, ReactNode } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'

export type Tone = 'neutral' | 'info' | 'positive' | 'warning' | 'danger' | 'premium'

const STATS_SECTION_PADDING = 'clamp(var(--space-3), 4vw, var(--space-6))'
const STATS_SECTION_MAX_WIDTH = 600

const toneTokens: Record<Tone, { text: string; subtleBg: string; subtleBorder: string; heroGradient: string }> = {
  neutral: {
    text: 'var(--neutral-700)',
    subtleBg: 'var(--neutral-100)',
    subtleBorder: 'var(--neutral-200)',
    heroGradient: 'linear-gradient(135deg, color-mix(in oklab, var(--neutral-700) 88%, var(--neutral-900) 12%) 0%, color-mix(in oklab, var(--neutral-600) 82%, var(--neutral-900) 18%) 100%)',
  },
  info: {
    text: 'var(--primary-700)',
    subtleBg: 'color-mix(in oklab, var(--primary-500) 10%, var(--neutral-0) 90%)',
    subtleBorder: 'color-mix(in oklab, var(--primary-500) 24%, var(--neutral-0) 76%)',
    heroGradient: 'linear-gradient(135deg, color-mix(in oklab, var(--primary-700) 86%, var(--neutral-900) 14%) 0%, color-mix(in oklab, var(--primary-500) 80%, var(--neutral-900) 20%) 100%)',
  },
  positive: {
    text: 'var(--color-positive)',
    subtleBg: 'color-mix(in oklab, var(--color-positive) 10%, var(--neutral-0) 90%)',
    subtleBorder: 'color-mix(in oklab, var(--color-positive) 24%, var(--neutral-0) 76%)',
    heroGradient: 'linear-gradient(135deg, color-mix(in oklab, var(--color-positive) 82%, var(--primary-700) 18%) 0%, color-mix(in oklab, var(--color-positive) 88%, var(--primary-600) 12%) 100%)',
  },
  warning: {
    text: 'var(--color-warning)',
    subtleBg: 'color-mix(in oklab, var(--color-warning) 12%, var(--neutral-0) 88%)',
    subtleBorder: 'color-mix(in oklab, var(--color-warning) 26%, var(--neutral-0) 74%)',
    heroGradient: 'linear-gradient(135deg, color-mix(in oklab, var(--color-warning) 84%, var(--neutral-900) 16%) 0%, color-mix(in oklab, #f09a1a 86%, var(--neutral-900) 14%) 100%)',
  },
  danger: {
    text: 'var(--color-negative)',
    subtleBg: 'color-mix(in oklab, var(--color-negative) 10%, var(--neutral-0) 90%)',
    subtleBorder: 'color-mix(in oklab, var(--color-negative) 24%, var(--neutral-0) 76%)',
    heroGradient: 'linear-gradient(135deg, color-mix(in oklab, var(--color-negative) 84%, var(--neutral-900) 16%) 0%, color-mix(in oklab, #ea4e4e 86%, var(--neutral-900) 14%) 100%)',
  },
  premium: {
    text: 'var(--primary-700)',
    subtleBg: 'color-mix(in oklab, var(--primary-600) 10%, var(--neutral-0) 90%)',
    subtleBorder: 'color-mix(in oklab, var(--primary-600) 24%, var(--neutral-0) 76%)',
    heroGradient: 'linear-gradient(135deg, color-mix(in oklab, var(--primary-800) 86%, var(--neutral-900) 14%) 0%, color-mix(in oklab, var(--primary-600) 80%, var(--neutral-900) 20%) 100%)',
  },
}

type StatsSectionProps = {
  children: ReactNode
  gap?: string
  style?: CSSProperties
}

export function StatsSection({ children, gap = 'var(--space-3)', style }: StatsSectionProps) {
  return (
    <section style={{ padding: `0 ${STATS_SECTION_PADDING}` }}>
      <div
        style={{
          maxWidth: STATS_SECTION_MAX_WIDTH,
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          margin: '0 auto',
          display: 'grid',
          gap,
          ...style,
        }}
      >
        {children}
      </div>
    </section>
  )
}

type SectionHeaderProps = {
  title: string
  subtitle?: string | null
  rightSlot?: ReactNode
}

export function SectionHeader({ title, subtitle, rightSlot }: SectionHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)', overflowWrap: 'anywhere' }}>
          {title}
        </h2>
        {subtitle ? (
          <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {rightSlot ? <div style={{ flexShrink: 0 }}>{rightSlot}</div> : null}
    </div>
  )
}

type SurfaceCardProps = {
  children: ReactNode
  tone?: Tone
  padding?: string
  style?: CSSProperties
}

export function SurfaceCard({ children, tone = 'neutral', padding = 'var(--space-4)', style }: SurfaceCardProps) {
  const tokens = toneTokens[tone]
  return (
    <div
      style={{
        borderRadius: 'var(--radius-2xl)',
        border: `1px solid ${tokens.subtleBorder}`,
        background: 'var(--neutral-0)',
        boxShadow: 'var(--shadow-card)',
        padding,
        minWidth: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

type HeroMetricCardProps = {
  title: string
  value: string
  caption?: string
  tone?: Tone
  detail?: ReactNode
  metrics?: Array<{ label: string; value: string }>
  notice?: ReactNode
}

export function HeroMetricCard({
  title,
  value,
  caption,
  tone = 'info',
  detail,
  metrics = [],
  notice,
}: HeroMetricCardProps) {
  const tokens = toneTokens[tone]

  return (
    <div
      style={{
        borderRadius: 'var(--radius-2xl)',
        border: `1px solid ${tokens.subtleBorder}`,
        background: tokens.heroGradient,
        color: 'var(--neutral-0)',
        boxShadow: 'var(--shadow-card)',
        padding: 'var(--space-5)',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.9, fontWeight: 'var(--font-weight-bold)' }}>
        {title}
      </p>

      <p style={{ margin: '6px 0 0', fontSize: 'clamp(28px, 7vw, 34px)', lineHeight: 1.1, fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-extrabold)', overflowWrap: 'anywhere' }}>
        {value}
      </p>

      {caption ? (
        <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', opacity: 0.86 }}>
          {caption}
        </p>
      ) : null}

      {detail ? (
        <p style={{ margin: 'var(--space-3) 0 0', fontSize: 'var(--font-size-sm)', opacity: 0.92 }}>
          {detail}
        </p>
      ) : null}

      {metrics.length > 0 ? (
        <CompactStatGrid minItemWidth={138} style={{ marginTop: 'var(--space-4)' }}>
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              tone="neutral"
              onHero
            />
          ))}
        </CompactStatGrid>
      ) : null}

      {notice ? <div style={{ marginTop: 'var(--space-3)' }}>{notice}</div> : null}
    </div>
  )
}

type MetricCardProps = {
  label: string
  value: string
  detail?: string | null
  tone?: Tone
  compact?: boolean
  onHero?: boolean
}

export function MetricCard({ label, value, detail, tone = 'neutral', compact = false, onHero = false }: MetricCardProps) {
  const tokens = toneTokens[tone]

  return (
    <article
      style={{
        background: onHero ? 'color-mix(in oklab, var(--neutral-0) 12%, transparent)' : 'var(--neutral-0)',
        border: onHero ? `1px solid color-mix(in oklab, var(--neutral-0) 24%, transparent)` : `1px solid ${tokens.subtleBorder}`,
        borderRadius: 'var(--radius-md)',
        padding: compact ? '10px var(--space-3)' : 'var(--space-3)',
        minWidth: 0,
        display: 'grid',
        gap: '4px',
      }}
    >
      <p style={{ margin: 0, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: onHero ? 'rgba(255,255,255,0.82)' : 'var(--neutral-500)', fontWeight: 'var(--font-weight-semibold)' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: compact ? 'var(--font-size-sm)' : 'var(--font-size-md)', color: onHero ? 'var(--neutral-0)' : 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-bold)', overflowWrap: 'anywhere' }}>
        {value}
      </p>
      {detail ? (
        <p style={{ margin: 0, fontSize: '10px', color: onHero ? 'rgba(255,255,255,0.84)' : 'var(--neutral-500)' }}>
          {detail}
        </p>
      ) : null}
    </article>
  )
}

type InsightCardProps = {
  title: string
  value: string
  detail: string
  badge?: ReactNode
  tone?: Tone
}

export function InsightCard({ title, value, detail, badge, tone = 'info' }: InsightCardProps) {
  return (
    <SurfaceCard tone="neutral" padding="var(--space-4)">
      <div style={{ display: 'grid', gap: 'var(--space-2)', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 'var(--font-weight-semibold)' }}>
            {title}
          </p>
          {badge ? badge : null}
        </div>
        <p style={{ margin: 0, fontSize: 'var(--font-size-xl)', lineHeight: 1.2, fontWeight: 'var(--font-weight-extrabold)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', overflowWrap: 'anywhere' }}>
          {value}
        </p>
        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: toneTokens[tone].text }}>
          {detail}
        </p>
      </div>
    </SurfaceCard>
  )
}

type StatusBadgeProps = {
  label: string
  tone?: Tone
}

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  const tokens = toneTokens[tone]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 'var(--radius-full)',
        padding: '2px 8px',
        fontSize: '11px',
        lineHeight: 1.3,
        fontWeight: 'var(--font-weight-semibold)',
        color: tokens.text,
        background: tokens.subtleBg,
        border: `1px solid ${tokens.subtleBorder}`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

type CompactStatGridProps = {
  children: ReactNode
  minItemWidth?: number
  style?: CSSProperties
}

export function CompactStatGrid({ children, minItemWidth = 145, style }: CompactStatGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 'var(--space-2)',
        gridTemplateColumns: `repeat(auto-fit, minmax(${minItemWidth}px, 1fr))`,
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

type AmountDeltaProps = {
  amount: number | null
  formatted: string
}

export function AmountDelta({ amount, formatted }: AmountDeltaProps) {
  const tone: Tone = amount == null ? 'neutral' : amount >= 0 ? 'positive' : 'danger'

  return <span style={{ color: toneTokens[tone].text, fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-semibold)' }}>{formatted}</span>
}

type DataQualityNoticeProps = {
  title: string
  detail: string
  tone?: Tone
}

export function DataQualityNotice({ title, detail, tone = 'info' }: DataQualityNoticeProps) {
  return (
    <div
      style={{
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${toneTokens[tone].subtleBorder}`,
        background: toneTokens[tone].subtleBg,
        padding: 'var(--space-3)',
      }}
    >
      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', fontWeight: 'var(--font-weight-semibold)' }}>{title}</p>
      <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-600)' }}>{detail}</p>
    </div>
  )
}

type SkeletonCardProps = {
  heightClass?: string
  lines?: number
}

export function SkeletonCard({ heightClass = 'h-28', lines = 0 }: SkeletonCardProps) {
  return (
    <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--neutral-150)', background: 'var(--neutral-0)', padding: 'var(--space-4)', boxShadow: 'var(--shadow-card)', display: 'grid', gap: 'var(--space-2)' }}>
      <Skeleton className={`w-full ${heightClass}`} />
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={`skeleton-line-${index + 1}`} className="h-3 w-full" />
      ))}
    </div>
  )
}

type EmptyStateProps = {
  message: string
  detail?: string
}

export function EmptyState({ message, detail }: EmptyStateProps) {
  return (
    <SurfaceCard tone="neutral" padding="var(--space-4)">
      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-600)' }}>{message}</p>
      {detail ? <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>{detail}</p> : null}
    </SurfaceCard>
  )
}

type TimelineMetric = {
  label: string
  value: string
  tone?: Tone
}

type MonthlyTimelineItem = {
  key: string
  title: string
  badge?: ReactNode
  metrics: TimelineMetric[]
  detail?: string
}

type MonthlyTimelineProps = {
  items: MonthlyTimelineItem[]
}

export function MonthlyTimeline({ items }: MonthlyTimelineProps) {
  if (items.length === 0) {
    return <EmptyState message="—" />
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
      {items.map((item) => (
        <article key={item.key} style={{ border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)', background: 'var(--neutral-0)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>{item.title}</p>
            {item.badge ? item.badge : null}
          </div>

          <div style={{ display: 'grid', gap: 'var(--space-1)', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', minWidth: 0 }}>
            {item.metrics.map((metric) => (
              <div key={`${item.key}-${metric.label}`} style={{ display: 'contents' }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>{metric.label}</p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--font-size-xs)',
                    textAlign: 'right',
                    color: metric.tone ? toneTokens[metric.tone].text : 'var(--neutral-900)',
                    fontFamily: 'var(--font-mono)',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {metric.value}
                </p>
              </div>
            ))}
          </div>

          {item.detail ? <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-600)' }}>{item.detail}</p> : null}
        </article>
      ))}
    </div>
  )
}

type YearToggleProps = {
  years: number[]
  value: number
  onChange: (year: number) => void
}

export function YearToggle({ years, value, onChange }: YearToggleProps) {
  return (
    <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', borderRadius: 'var(--radius-full)', border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', boxShadow: 'var(--shadow-card)', maxWidth: '100%' }}>
      {years.map((year) => {
        const isActive = value === year
        return (
          <button
            key={year}
            type="button"
            onClick={() => onChange(year)}
            aria-pressed={isActive}
            style={{
              border: 'none',
              borderRadius: 'var(--radius-full)',
              minHeight: 30,
              minWidth: 56,
              padding: '0 12px',
              background: isActive ? 'var(--primary-500)' : 'transparent',
              color: isActive ? 'var(--neutral-0)' : 'var(--neutral-700)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-semibold)',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              transition: 'all var(--transition-base)',
            }}
          >
            {year}
          </button>
        )
      })}
    </div>
  )
}
