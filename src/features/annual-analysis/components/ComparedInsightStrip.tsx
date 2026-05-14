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
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'rgba(10,12,28,0.60)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
        }}
      />

      {/* Panel */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={insight.modal.title}
        initial={{ y: '100%', opacity: 0.8 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: 'var(--space-3)',
          right: 'var(--space-3)',
          bottom: 'calc(var(--safe-bottom-offset, 0px) + 56px + var(--space-3))',
          zIndex: 61,
          maxWidth: 560,
          margin: '0 auto',
          background: 'var(--neutral-0)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: '0 -8px 48px rgba(10,12,28,0.22), 0 2px 12px rgba(10,12,28,0.10)',
          overflow: 'hidden',
          maxHeight: '72dvh',
          overflowY: 'auto',
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            height: 4,
            background: `linear-gradient(90deg, ${badgeColor} 0%, ${accentColor} 100%)`,
            flexShrink: 0,
          }}
        />

        {/* Header */}
        <div
          style={{
            padding: 'var(--space-5) var(--space-5) 0',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Big badge */}
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 38,
                fontWeight: 800,
                color: badgeColor,
                lineHeight: 1,
                letterSpacing: '-0.03em',
                marginBottom: 8,
              }}
            >
              {insight.badge}
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 'var(--font-size-base)',
                fontWeight: 700,
                color: 'var(--neutral-900)',
                lineHeight: 1.35,
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
              flexShrink: 0,
              marginTop: 4,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Divider */}
        <div
          style={{
            margin: 'var(--space-4) var(--space-5) 0',
            height: 1,
            background: 'var(--neutral-150)',
          }}
        />

        {/* Body */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-5) var(--space-5)',
            display: 'grid',
            gap: 'var(--space-4)',
          }}
        >
          {/* Lead */}
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              color: 'var(--neutral-800)',
              lineHeight: 1.65,
            }}
          >
            {insight.modal.lead}
          </p>

          {/* Metrics grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 'var(--space-2)',
            }}
          >
            {insight.modal.metrics.map((metric, i) => (
              <MetricCell
                key={i}
                metric={metric}
                badgeColor={badgeColor}
              />
            ))}
          </div>

          {/* Detail paragraph */}
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-size-xs)',
              color: 'var(--neutral-500)',
              lineHeight: 1.7,
            }}
          >
            {insight.modal.body}
          </p>
        </div>
      </motion.div>
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
          ? `color-mix(in oklab, ${badgeColor} 8%, var(--neutral-50) 92%)`
          : 'var(--neutral-50)',
        border: metric.highlight
          ? `1px solid color-mix(in oklab, ${badgeColor} 22%, transparent 78%)`
          : '1px solid var(--neutral-150)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 9,
          fontWeight: 700,
          color: 'var(--neutral-400)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: 5,
        }}
      >
        {metric.label}
      </p>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 800,
          color: metric.highlight ? badgeColor : 'var(--neutral-900)',
          lineHeight: 1.2,
        }}
      >
        {metric.value}
      </p>
      {metric.delta ? (
        <p
          style={{
            margin: '3px 0 0',
            fontSize: 9,
            color: 'var(--neutral-400)',
            fontWeight: 500,
          }}
        >
          {metric.delta}
        </p>
      ) : null}
    </div>
  )
}
