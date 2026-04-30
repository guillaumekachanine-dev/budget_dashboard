import { formatPeriodLabel } from '@/features/stats/utils/statsReferenceSelectors'
import type { StatsSelectedPeriod } from '@/features/stats/types'

type StatsHeaderProps = {
  selectedPeriod: StatsSelectedPeriod | null
  loadedAt: string | null
  loading: boolean
  error: string | null
  onRefresh: () => void
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Jamais'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('fr-FR')
}

export function StatsHeader({ selectedPeriod, loadedAt, loading, error, onRefresh }: StatsHeaderProps) {
  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--neutral-150)', padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <div>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 'var(--font-weight-bold)' }}>
              Période active
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-extrabold)', textTransform: 'capitalize' }}>
              {selectedPeriod ? formatPeriodLabel(selectedPeriod) : 'Période indisponible'}
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            style={{
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: '8px 14px',
              background: 'var(--primary-500)',
              color: 'var(--neutral-0)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-bold)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.65 : 1,
            }}
          >
            {loading ? 'Chargement…' : 'Refresh'}
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
          Snapshot chargé: {formatDateTime(loadedAt)}
        </p>

        {error ? (
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-negative)', background: 'color-mix(in oklab, var(--color-negative) 10%, var(--neutral-0) 90%)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)' }}>
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}
