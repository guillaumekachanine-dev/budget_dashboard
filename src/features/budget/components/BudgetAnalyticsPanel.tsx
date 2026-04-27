import { useMemo } from 'react'
import { useBudgetAnalytics } from '@/features/budget/hooks/useBudgetAnalytics'

interface BudgetAnalyticsPanelProps {
  year?: number
}

export function BudgetAnalyticsPanel({ year }: BudgetAnalyticsPanelProps) {
  const {
    loading,
    refreshing,
    error,
    monthlyMetrics,
    monthlyVariableCategories,
    variableCategorySummary,
    refreshedAt,
    refreshAndReload,
    reloadOnly,
  } = useBudgetAnalytics({ year, autoRefresh: false, autoLoad: true })

  const refreshedAtLabel = useMemo(() => {
    if (!refreshedAt) return '—'
    const date = new Date(refreshedAt)
    if (Number.isNaN(date.getTime())) return refreshedAt
    return date.toLocaleString('fr-FR')
  }, [refreshedAt])

  return (
    <section
      style={{
        background: 'var(--neutral-0)',
        borderRadius: 'var(--radius-2xl)',
        boxShadow: 'var(--shadow-card)',
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
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
            Budget Analytics
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--neutral-400)' }}>
            Refreshed at: {refreshedAtLabel}
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
            {refreshing ? 'Recalcul…' : 'Recalculer les analytics'}
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

      {loading && (
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--neutral-500)' }}>
          Chargement des analytics…
        </p>
      )}

      {error && (
        <p
          style={{
            margin: '12px 0 0',
            fontSize: 12,
            color: 'var(--color-negative)',
            background: '#FFF0F0',
            borderRadius: 'var(--radius-md)',
            padding: '8px 10px',
          }}
        >
          {error}
        </p>
      )}

      <div
        style={{
          marginTop: 12,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 8,
        }}
      >
        <div style={{ background: 'var(--neutral-50)', borderRadius: 'var(--radius-md)', padding: '8px 10px' }}>
          <p style={{ margin: 0, fontSize: 10, color: 'var(--neutral-400)' }}>monthlyMetrics</p>
          <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: 'var(--neutral-800)' }}>{monthlyMetrics.length}</p>
        </div>
        <div style={{ background: 'var(--neutral-50)', borderRadius: 'var(--radius-md)', padding: '8px 10px' }}>
          <p style={{ margin: 0, fontSize: 10, color: 'var(--neutral-400)' }}>monthlyVariableCategories</p>
          <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: 'var(--neutral-800)' }}>{monthlyVariableCategories.length}</p>
        </div>
        <div style={{ background: 'var(--neutral-50)', borderRadius: 'var(--radius-md)', padding: '8px 10px' }}>
          <p style={{ margin: 0, fontSize: 10, color: 'var(--neutral-400)' }}>variableCategorySummary</p>
          <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: 'var(--neutral-800)' }}>{variableCategorySummary.length}</p>
        </div>
      </div>

      <details style={{ marginTop: 10 }}>
        <summary style={{ fontSize: 12, color: 'var(--neutral-600)', cursor: 'pointer' }}>Debug data</summary>
        <pre
          style={{
            marginTop: 8,
            background: 'var(--neutral-50)',
            border: '1px solid var(--neutral-100)',
            borderRadius: 'var(--radius-md)',
            padding: 10,
            maxHeight: 260,
            overflow: 'auto',
            fontSize: 11,
            lineHeight: 1.45,
            color: 'var(--neutral-700)',
          }}
        >
          {JSON.stringify(
            {
              monthlyMetrics,
              monthlyVariableCategories,
              variableCategorySummary,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </section>
  )
}
