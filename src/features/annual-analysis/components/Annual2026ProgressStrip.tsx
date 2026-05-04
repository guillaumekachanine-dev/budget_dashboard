import type { Annual2026Summary } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'

type Props = {
  summary: Annual2026Summary
}

export function Annual2026ProgressStrip({ summary }: Props) {
  return (
    <div style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(140deg, #FFFFFF 0%, #F8F9FF 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-4) var(--space-5)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--neutral-150)',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Avancement YTD
            </span>
            <span style={{ fontSize: 11, color: 'var(--primary-700)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {summary.ytdMonths} / 12 mois
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--neutral-100)', overflow: 'hidden', border: '1px solid var(--neutral-150)' }}>
            <div style={{
              height: '100%',
              width: `${(summary.ytdMonths / 12) * 100}%`,
              borderRadius: 4,
              background: 'linear-gradient(90deg, #2ED47A, #5B57F5)',
              transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}
