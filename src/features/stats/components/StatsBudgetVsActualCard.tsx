import type { StatsReferenceSnapshot } from '@/features/stats/types'
import { formatCurrency } from '@/features/stats/utils/statsReferenceSelectors'

type StatsBudgetVsActualCardProps = {
  budgetSummary: StatsReferenceSnapshot['budgetSummary']
  rows: StatsReferenceSnapshot['budgetBucketVsActual']
}

function formatRatio(value: number | null): string {
  if (value == null) return '—'
  const normalized = value <= 1 ? value * 100 : value
  return `${normalized.toFixed(1)}%`
}

function normalizeBucketLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

export function StatsBudgetVsActualCard({ budgetSummary, rows }: StatsBudgetVsActualCardProps) {
  const budgetsByBucket = [
    { bucketKey: 'socle_fixe', label: 'Socle fixe', budget: budgetSummary.socleFixeBudget },
    { bucketKey: 'variable_essentielle', label: 'Variable essentielle', budget: budgetSummary.variableEssentielleBudget },
    { bucketKey: 'provision', label: 'Provision', budget: budgetSummary.provisionBudget },
    { bucketKey: 'discretionnaire', label: 'Discrétionnaire', budget: budgetSummary.discretionnaireBudget },
    { bucketKey: 'cagnotte_projet', label: 'Cagnotte projet', budget: budgetSummary.cagnotteProjetBudget },
  ] as const

  const rowByBucketKey = new Map<string, StatsReferenceSnapshot['budgetBucketVsActual'][number]>()
  for (const row of rows) {
    rowByBucketKey.set(normalizeBucketLabel(row.budgetBucket), row)
  }

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--neutral-150)', padding: 'var(--space-4)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)' }}>Consommé vs budget par bucket</h2>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
          Pilotage mensuel des écarts et du ratio de consommation.
        </p>

        <div style={{ marginTop: 'var(--space-4)', display: 'grid', gap: 'var(--space-2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) repeat(4, minmax(0,0.85fr))', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: '10px', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 'var(--font-weight-bold)' }}>Bucket</span>
            <span style={{ fontSize: '10px', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 'var(--font-weight-bold)', textAlign: 'right' }}>Budget</span>
            <span style={{ fontSize: '10px', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 'var(--font-weight-bold)', textAlign: 'right' }}>Réel</span>
            <span style={{ fontSize: '10px', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 'var(--font-weight-bold)', textAlign: 'right' }}>Écart</span>
            <span style={{ fontSize: '10px', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 'var(--font-weight-bold)', textAlign: 'right' }}>Ratio</span>
          </div>

          {budgetsByBucket.map((bucket) => {
            const row = rowByBucketKey.get(bucket.bucketKey)
            const hasActual = row != null && (row.actualBudgetBucketEur !== 0 || row.consumptionRatio != null)
            return (
              <div key={bucket.bucketKey} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) repeat(4, minmax(0,0.85fr))', gap: 'var(--space-2)', borderTop: '1px solid var(--neutral-150)', paddingTop: 'var(--space-2)', alignItems: 'center' }}>
                <span style={{ minWidth: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--neutral-700)' }}>{bucket.label}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{formatCurrency(bucket.budget)}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: hasActual ? 'var(--neutral-900)' : 'var(--neutral-400)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{hasActual && row ? formatCurrency(row.actualBudgetBucketEur) : '—'}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: row && row.deltaBudgetBucketEur > 0 ? 'var(--color-negative)' : row && row.deltaBudgetBucketEur < 0 ? 'var(--color-positive)' : 'var(--neutral-600)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{hasActual && row ? formatCurrency(row.deltaBudgetBucketEur) : '—'}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: hasActual ? 'var(--neutral-700)' : 'var(--neutral-400)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{hasActual && row ? formatRatio(row.consumptionRatio) : '—'}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
