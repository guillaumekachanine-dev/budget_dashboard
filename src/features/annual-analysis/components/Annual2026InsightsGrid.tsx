import type { Budget2026InsightCard } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { LEVEL_CONFIG } from './_constants'

type Props = {
  insights: Budget2026InsightCard[]
}

export function Annual2026InsightsGrid({ insights }: Props) {
  if (insights.length === 0) return null

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <SectionHeader
          title="Messages clés"
          subtitle="Lecture rapide de votre plan budgétaire 2026"
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-3)',
        }}>
          {insights.map((card) => (
            <InsightCard key={card.key} card={card} />
          ))}
        </div>
      </div>
    </section>
  )
}

function InsightCard({ card }: { card: Budget2026InsightCard }) {
  const cfg = LEVEL_CONFIG[card.level] ?? LEVEL_CONFIG.info

  return (
    <div style={{
      background: cfg.bg,
      borderRadius: 'var(--radius-xl)',
      border: `1px solid ${cfg.border}`,
      borderTopWidth: 3,
      borderTopColor: cfg.accent,
      padding: 'var(--space-3) var(--space-3) var(--space-4)',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minWidth: 0,
    }}>
      {/* Niveau */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span style={{
          display: 'inline-block', width: 6, height: 6,
          borderRadius: 'var(--radius-full)', background: cfg.accent, flexShrink: 0,
        }} />
        <span style={{
          fontSize: 10, fontWeight: 700, color: cfg.accent,
          textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>
          {cfg.label}
        </span>
      </div>

      {/* Titre */}
      <p style={{
        margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 600,
        color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {card.title}
      </p>

      {/* Valeur principale */}
      <p style={{
        margin: '2px 0 0', fontSize: 'var(--font-size-base)', fontWeight: 800,
        color: 'var(--neutral-900)', lineHeight: 1.2,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {card.main}
      </p>

      {/* Sous-valeur */}
      {card.sub ? (
        <p style={{
          margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-600)',
          fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {card.sub}
        </p>
      ) : null}

      {/* Détail */}
      {card.detail ? (
        <p style={{
          margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-400)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {card.detail}
        </p>
      ) : null}
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 style={{
        margin: 0, fontSize: 'var(--font-size-lg)',
        fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)',
      }}>
        {title}
      </h2>
      <p style={{
        margin: '3px 0 0', fontSize: 'var(--font-size-xs)',
        color: 'var(--neutral-400)', letterSpacing: '0.05em',
        textTransform: 'uppercase', fontWeight: 600,
      }}>
        {subtitle}
      </p>
    </div>
  )
}
