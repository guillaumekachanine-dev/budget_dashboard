import { useBudgetAnalytics } from '@/features/budget/hooks/useBudgetAnalytics'
import { formatDateTime } from '@/features/budget/utils/budgetAnalyticsSelectors'

interface BudgetAnalyticsMiniPanelProps {
  year?: number
}

export function BudgetAnalyticsMiniPanel({ year }: BudgetAnalyticsMiniPanelProps) {
  const {
    loading,
    refreshing,
    error,
    monthlyMetrics,
    variableCategorySummary,
    refreshedAt,
    refreshAndReload,
    reloadOnly,
  } = useBudgetAnalytics({ year, autoRefresh: false, autoLoad: true })

  return (
    <section
      style={{
        background: 'var(--neutral-0)',
        borderRadius: 'var(--radius-2xl)',
        boxShadow: 'var(--shadow-card)',
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--neutral-700)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Analytics budget
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--neutral-400)' }}>
            Dernier recalcul: {formatDateTime(refreshedAt)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => void refreshAndReload()}
            disabled={refreshing}
            style={{
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              background: 'var(--primary-500)',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              opacity: refreshing ? 0.65 : 1,
            }}
          >
            {refreshing ? 'Recalcul…' : 'Recalculer'}
          </button>
          <button
            type="button"
            onClick={() => void reloadOnly()}
            disabled={loading || refreshing}
            style={{
              border: '1px solid var(--neutral-200)',
              borderRadius: 'var(--radius-full)',
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--neutral-700)',
              background: '#fff',
              cursor: loading || refreshing ? 'not-allowed' : 'pointer',
              opacity: loading || refreshing ? 0.65 : 1,
            }}
          >
            Recharger
          </button>
        </div>
      </div>

      <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--neutral-600)' }}>
        {monthlyMetrics.length} mois analysés · {variableCategorySummary.length} catégories suivies
      </p>

      {loading && (
        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--neutral-400)' }}>
          Chargement des données analytics…
        </p>
      )}

      {error && (
        <p
          style={{
            margin: '10px 0 0',
            fontSize: 11,
            color: 'var(--color-negative)',
            background: '#FFF0F0',
            borderRadius: 'var(--radius-md)',
            padding: '8px 10px',
          }}
        >
          {error}
        </p>
      )}
    </section>
  )
}
