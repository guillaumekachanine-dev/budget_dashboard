import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useFinancialSecurity } from '@/features/savings/hooks/useFinancialSecurity'
import type { FinancialSecurityStatus } from '@/features/savings/types'
import {
  EmptyState,
  SkeletonCard,
  StatsSection,
  formatEuro,
  formatMonths,
  formatSignedEuro,
  asFiniteNumber,
  type Tone,
} from '@/features/stats/components/ui'
import { lockDocumentScroll } from '@/lib/scrollLock'
import { useEffect } from 'react'

function resolveStatusMeta(statusRaw: string | null | undefined): { label: string; tone: Tone } {
  const status = (statusRaw ?? 'insufficient_data') as FinancialSecurityStatus
  if (status === 'critical') return { label: 'Critique', tone: 'danger' }
  if (status === 'building') return { label: 'À renforcer', tone: 'warning' }
  if (status === 'comfortable') return { label: 'Confortable', tone: 'info' }
  if (status === 'premium_reached') return { label: 'Objectif atteint', tone: 'positive' }
  return { label: 'Données insuffisantes', tone: 'neutral' }
}

const TONE_COLORS: Record<Tone, { bg: string; border: string; text: string; badge: string; badgeText: string }> = {
  positive: { bg: 'rgba(46,212,122,0.08)', border: 'rgba(46,212,122,0.22)', text: '#1a7a4a', badge: 'rgba(46,212,122,0.15)', badgeText: '#1a7a4a' },
  warning: { bg: 'rgba(255,171,46,0.08)', border: 'rgba(255,171,46,0.22)', text: '#a06600', badge: 'rgba(255,171,46,0.15)', badgeText: '#a06600' },
  danger: { bg: 'rgba(252,90,90,0.08)', border: 'rgba(252,90,90,0.22)', text: '#c0392b', badge: 'rgba(252,90,90,0.15)', badgeText: '#c0392b' },
  info: { bg: 'rgba(91,87,245,0.06)', border: 'rgba(91,87,245,0.18)', text: 'var(--primary)', badge: 'rgba(91,87,245,0.10)', badgeText: 'var(--primary)' },
  premium: { bg: 'rgba(91,87,245,0.06)', border: 'rgba(91,87,245,0.18)', text: 'var(--primary)', badge: 'rgba(91,87,245,0.10)', badgeText: 'var(--primary)' },
  neutral: { bg: 'var(--neutral-50)', border: 'var(--neutral-150)', text: 'var(--neutral-700)', badge: 'var(--neutral-100)', badgeText: 'var(--neutral-600)' },
}

function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--neutral-500)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-900)', fontFamily: mono ? 'var(--font-mono)' : undefined, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function ModalContent({ onClose, data }: { onClose: () => void; data: NonNullable<ReturnType<typeof useFinancialSecurity>['data']> }) {
  useEffect(() => lockDocumentScroll(), [])

  const summary = data.summary!
  const statusMeta = resolveStatusMeta(summary.security_status)
  const colors = TONE_COLORS[statusMeta.tone]
  const premiumGap = asFiniteNumber(summary.premium_target_surplus_or_gap)
  const isPremiumReached = premiumGap != null ? premiumGap >= 0 : summary.security_status === 'premium_reached'
  const monthlyEffort = formatEuro(summary.monthly_effort_to_premium_target_in_12m)

  const gapLabel = premiumGap == null
    ? '—'
    : premiumGap >= 0
      ? `Excédent ${formatSignedEuro(premiumGap)}`
      : `Manque ${formatSignedEuro(premiumGap)}`

  const effortLabel = isPremiumReached
    ? 'Objectif 12 mois atteint'
    : (monthlyEffort === '—' ? '—' : `${monthlyEffort} / mois × 12 mois`)

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(13,13,31,0.48)', backdropFilter: 'blur(2px)' }}
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'fixed', inset: 0, zIndex: 81, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', pointerEvents: 'none' }}
      >
        <div style={{ width: 'min(420px, 100%)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', boxShadow: '0 24px 60px rgba(13,13,31,0.24)', overflow: 'hidden', pointerEvents: 'auto' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--neutral-100)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--neutral-900)' }}>
                Sécurité financière
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, background: colors.badge, color: colors.badgeText, borderRadius: 'var(--radius-full)', padding: '2px 8px' }}>
                {statusMeta.label}
              </span>
            </div>
            <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: 'var(--neutral-400)', display: 'flex' }}>
              <X size={16} />
            </button>
          </div>

          {/* Main metric */}
          <div style={{ padding: '16px 18px 0' }}>
            <p style={{ margin: 0, fontSize: 32, fontFamily: 'var(--font-mono)', fontWeight: 800, color: colors.text, lineHeight: 1 }}>
              {formatMonths(summary.security_months_reference)} mois
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--neutral-500)' }}>
              Sur la base de tes dépenses essentielles moyennes
            </p>
          </div>

          {/* Data rows */}
          <div style={{ padding: '14px 18px', display: 'grid', gap: 8, borderBottom: '1px solid var(--neutral-100)' }}>
            <Row label="Épargne liquide" value={formatEuro(summary.liquid_savings_total)} />
            <Row label="Dépenses essentielles" value={`${formatEuro(summary.reference_essential_monthly_spending)} / mois`} />
            <Row label="Objectif 6 mois" value={formatEuro(summary.comfort_target_amount)} />
            <Row label="Objectif 12 mois" value={formatEuro(summary.premium_target_amount)} />
            <div style={{ height: 1, background: 'var(--neutral-100)', margin: '2px 0' }} />
            <Row label="Écart objectif 12 mois" value={gapLabel} />
            <Row label="Effort nécessaire" value={effortLabel} mono={false} />
          </div>

          {/* Insight */}
          {summary.security_insight && (
            <div style={{ padding: '12px 18px', background: colors.bg }}>
              <p style={{ margin: 0, fontSize: 12, color: colors.text, lineHeight: 1.5 }}>
                {summary.security_insight}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}

export function FinancialSecurityCard() {
  const { data, isLoading, error } = useFinancialSecurity()
  const [open, setOpen] = useState(false)

  if (isLoading) {
    return (
      <StatsSection>
        <SkeletonCard heightClass="h-14" lines={1} />
      </StatsSection>
    )
  }

  if (error || !data?.summary) {
    return (
      <StatsSection>
        <EmptyState message="Impossible de charger le matelas de sécurité." />
      </StatsSection>
    )
  }

  const summary = data.summary
  const statusMeta = resolveStatusMeta(summary.security_status)
  const colors = TONE_COLORS[statusMeta.tone]

  return (
    <StatsSection>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: '100%',
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: 'var(--radius-lg)',
          padding: '12px 16px',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* Badge + months */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, background: colors.badge, color: colors.badgeText, borderRadius: 'var(--radius-full)', padding: '2px 7px', whiteSpace: 'nowrap' }}>
            {statusMeta.label}
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-mono)', color: colors.text, whiteSpace: 'nowrap' }}>
            {formatMonths(summary.security_months_reference)} mois
          </span>
        </div>

        {/* Divider */}
        <span style={{ width: 1, height: 28, background: colors.border, flexShrink: 0 }} />

        {/* Insight text */}
        <span style={{ fontSize: 12, color: colors.text, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {summary.security_insight ?? 'Sécurité financière — voir le détail'}
        </span>
      </button>

      <AnimatePresence>
        {open && <ModalContent onClose={() => setOpen(false)} data={data} />}
      </AnimatePresence>
    </StatsSection>
  )
}
