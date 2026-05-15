import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { lockDocumentScroll } from '@/lib/scrollLock'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InsightLevel = 'alert' | 'warning' | 'info' | 'positive'

export type InsightKeyMetric = {
  label: string
  value: string
  delta?: string
  highlight?: boolean
}

export type InsightData = {
  id: string
  badge: string
  title: string
  subtitle: string
  level: InsightLevel
  modal: {
    title: string
    lead: string
    body: string
    metrics: InsightKeyMetric[]
  }
}

type Props = {
  insights: readonly [InsightData, InsightData]
  accentColor: string
  stripBg: string
  labelColor?: string
}

// ─── Badge colors ─────────────────────────────────────────────────────────────

const BADGE_COLOR: Record<InsightLevel, string> = {
  alert:    '#FC5A5A',
  warning:  '#FFAB2E',
  info:     '#5B57F5',
  positive: '#2ED47A',
}

// ─── Strip ────────────────────────────────────────────────────────────────────

export function ComparedInsightStrip({ insights, accentColor, stripBg, labelColor }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const openInsight = insights.find((i) => i.id === openId) ?? null

  useEffect(() => {
    if (!openInsight) return
    return lockDocumentScroll()
  }, [openInsight])

  return (
    <>
      <div
        style={{
          padding: '0 var(--space-6)',
          marginTop: 'var(--space-3)',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative' }}>
          {/* Vertical "Insights" label — straddles left border */}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateX(-50%) translateY(-50%) rotate(-90deg)',
              transformOrigin: 'center center',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 300,
              textTransform: 'uppercase',
              letterSpacing: '0.40em',
              color: 'transparent',
              WebkitTextStroke: `1px ${labelColor ?? accentColor}`,
              opacity: 0.55,
              lineHeight: 1,
              pointerEvents: 'none',
              userSelect: 'none',
              zIndex: 3,
            }}
          >
            Insights
          </span>

          <div
            style={{
              background: stripBg,
              borderRadius: 'var(--radius-xl)',
              padding: '10px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
            }}
          >
            {insights.map((insight) => (
              <InsightChip
                key={insight.id}
                insight={insight}
                onClick={() => setOpenId(insight.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {openInsight ? (
          <InsightModal
            key={openInsight.id}
            insight={openInsight}
            accentColor={accentColor}
            onClose={() => setOpenId(null)}
          />
        ) : null}
      </AnimatePresence>
    </>
  )
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function InsightChip({
  insight,
  onClick,
}: {
  insight: InsightData
  onClick: () => void
}) {
  const badgeColor = BADGE_COLOR[insight.level]

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '10px',
        padding: '10px 10px 10px 11px',
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 150ms ease',
      }}
    >
      {/* Expand dot */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 7,
          right: 7,
          width: 14,
          height: 14,
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.10)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 8,
          color: 'rgba(255,255,255,0.50)',
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        ↗
      </span>

      {/* Badge */}
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 22,
          fontWeight: 800,
          color: badgeColor,
          lineHeight: 1,
          letterSpacing: '-0.025em',
        }}
      >
        {insight.badge}
      </span>

      {/* Title */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#FFFFFF',
          lineHeight: 1.3,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {insight.title}
      </span>

      {/* Subtitle */}
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.45)',
          lineHeight: 1.25,
          display: '-webkit-box',
          WebkitLineClamp: 1,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          marginTop: 1,
        }}
      >
        {insight.subtitle}
      </span>
    </button>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function InsightModal({
  insight,
  accentColor,
  onClose,
}: {
  insight: InsightData
  accentColor: string
  onClose: () => void
}) {
  const badgeColor = BADGE_COLOR[insight.level]

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'rgba(10,12,28,0.52)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
        }}
      />

      {/* Centering wrapper — keeps motion.div's transform clean */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 61,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 28px',
          pointerEvents: 'none',
        }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={insight.modal.title}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          style={{
            pointerEvents: 'auto',
            width: '100%',
            maxWidth: 440,
            maxHeight: '85dvh',
            overflowY: 'auto',
            background: 'var(--neutral-0)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--neutral-150)',
            boxShadow: '0 8px 40px rgba(10,12,28,0.18), 0 2px 8px rgba(10,12,28,0.08)',
            overflow: 'hidden',
          }}
        >
          {/* Top accent stripe */}
          <div
            style={{
              height: 3,
              background: `linear-gradient(90deg, ${badgeColor} 0%, ${accentColor} 100%)`,
              flexShrink: 0,
            }}
          />

          {/* Header */}
          <div
            style={{
              padding: '14px 16px 0',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Badge value inline with level indicator */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 26,
                    fontWeight: 800,
                    color: badgeColor,
                    lineHeight: 1,
                    letterSpacing: '-0.03em',
                  }}
                >
                  {insight.badge}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: badgeColor,
                    opacity: 0.7,
                    lineHeight: 1,
                  }}
                >
                  {insight.level}
                </span>
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--neutral-900)',
                  lineHeight: 1.3,
                }}
              >
                {insight.modal.title}
              </h2>
            </div>

            <button
              type="button"
              aria-label="Fermer"
              onClick={onClose}
              style={{
                border: '1px solid var(--neutral-200)',
                background: 'var(--neutral-0)',
                color: 'var(--neutral-500)',
                width: 26,
                height: 26,
                borderRadius: 'var(--radius-full)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <X size={12} />
            </button>
          </div>

          {/* Lead */}
          <p
            style={{
              margin: '10px 16px 0',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--neutral-700)',
              lineHeight: 1.6,
            }}
          >
            {insight.modal.lead}
          </p>

          {/* Divider */}
          <div style={{ margin: '12px 16px', height: 1, background: 'var(--neutral-100)' }} />

          {/* Metrics grid */}
          <div
            style={{
              padding: '0 16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 6,
            }}
          >
            {insight.modal.metrics.map((metric, i) => (
              <MetricCell key={i} metric={metric} badgeColor={badgeColor} />
            ))}
          </div>

          {/* Detail paragraph */}
          <p
            style={{
              margin: '12px 16px 16px',
              fontSize: 11,
              color: 'var(--neutral-400)',
              lineHeight: 1.65,
            }}
          >
            {insight.modal.body}
          </p>
        </motion.div>
      </div>
    </>
  )
}

// ─── MetricCell ───────────────────────────────────────────────────────────────

function MetricCell({
  metric,
  badgeColor,
}: {
  metric: InsightKeyMetric
  badgeColor: string
}) {
  return (
    <div
      style={{
        background: metric.highlight
          ? `color-mix(in oklab, ${badgeColor} 7%, var(--neutral-50) 93%)`
          : 'var(--neutral-50)',
        border: metric.highlight
          ? `1px solid color-mix(in oklab, ${badgeColor} 20%, transparent 80%)`
          : '1px solid var(--neutral-100)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 10px',
      }}
    >
      <p
        style={{
          margin: '0 0 3px',
          fontSize: 9,
          fontWeight: 700,
          color: 'var(--neutral-400)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
        }}
      >
        {metric.label}
      </p>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 800,
          color: metric.highlight ? badgeColor : 'var(--neutral-900)',
          lineHeight: 1.2,
        }}
      >
        {metric.value}
      </p>
      {metric.delta ? (
        <p style={{ margin: '2px 0 0', fontSize: 9, color: 'var(--neutral-400)', fontWeight: 500 }}>
          {metric.delta}
        </p>
      ) : null}
    </div>
  )
}
