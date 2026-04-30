import type { StatsReferenceSnapshot } from '@/features/stats/types'
import { formatCurrency } from '@/features/stats/utils/statsReferenceSelectors'

type StatsSavingsCardProps = {
  savingsSummary: StatsReferenceSnapshot['savingsSummary']
  savingsLines: StatsReferenceSnapshot['savingsLines']
}

export function StatsSavingsCard({ savingsSummary, savingsLines }: StatsSavingsCardProps) {
  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--neutral-150)', padding: 'var(--space-4)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)' }}>Épargne cible / réalisée</h2>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
          Suivi séparé des objectifs d’épargne et du réalisé mensuel.
        </p>

        <div style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-2)' }}>
            <div style={{ background: 'var(--neutral-50)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Cible totale</p>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-bold)' }}>{formatCurrency(savingsSummary.totalSavingsBudget)}</p>
            </div>
            <div style={{ background: 'var(--neutral-50)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Réalisée</p>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-bold)' }}>{formatCurrency(savingsSummary.totalSavingsActual)}</p>
            </div>
            <div style={{ background: 'var(--neutral-50)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Delta</p>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: savingsSummary.deltaSavings >= 0 ? 'var(--color-positive)' : 'var(--color-negative)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-bold)' }}>{formatCurrency(savingsSummary.deltaSavings)}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            {savingsLines.map((line) => (
              <div key={line.categoryName} style={{ borderTop: '1px solid var(--neutral-150)', paddingTop: 'var(--space-2)', display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) repeat(3, minmax(0, 0.9fr))', gap: 'var(--space-2)', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)', fontWeight: 'var(--font-weight-semibold)' }}>{line.categoryName}</p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textAlign: 'right', color: 'var(--neutral-800)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(line.targetSavingsAmountEur)}</p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textAlign: 'right', color: 'var(--neutral-800)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(line.actualSavingsAmountEur)}</p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textAlign: 'right', color: line.deltaSavingsAmountEur >= 0 ? 'var(--color-positive)' : 'var(--color-negative)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(line.deltaSavingsAmountEur)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
