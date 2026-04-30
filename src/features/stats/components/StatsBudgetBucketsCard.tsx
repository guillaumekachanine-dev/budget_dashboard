import type { StatsReferenceSnapshot } from '@/features/stats/types'
import { formatCurrency } from '@/features/stats/utils/statsReferenceSelectors'

type StatsBudgetBucketsCardProps = {
  budgetSummary: StatsReferenceSnapshot['budgetSummary']
}

export function StatsBudgetBucketsCard({ budgetSummary }: StatsBudgetBucketsCardProps) {
  const rows = [
    { label: 'Socle fixe', value: budgetSummary.socleFixeBudget },
    { label: 'Variable essentielle', value: budgetSummary.variableEssentielleBudget },
    { label: 'Provision', value: budgetSummary.provisionBudget },
    { label: 'Discrétionnaire', value: budgetSummary.discretionnaireBudget },
    { label: 'Cagnotte projet', value: budgetSummary.cagnotteProjetBudget },
  ]

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--neutral-150)', padding: 'var(--space-4)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)' }}>Budget par bucket</h2>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
          Répartition des enveloppes de dépenses par bucket métier.
        </p>

        <div style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
          {rows.map((row) => {
            const ratio = budgetSummary.totalExpenseBudget > 0
              ? (row.value / budgetSummary.totalExpenseBudget) * 100
              : 0

            return (
              <div key={row.label} style={{ display: 'grid', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)', fontWeight: 'var(--font-weight-semibold)' }}>{row.label}</p>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-bold)' }}>{formatCurrency(row.value)}</p>
                </div>
                <div style={{ height: 8, width: '100%', borderRadius: 'var(--radius-full)', background: 'var(--neutral-100)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(Math.max(ratio, 0), 100)}%`, height: '100%', borderRadius: 'var(--radius-full)', background: 'var(--primary-500)' }} />
                </div>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>{ratio.toFixed(1)}% du budget dépenses</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
