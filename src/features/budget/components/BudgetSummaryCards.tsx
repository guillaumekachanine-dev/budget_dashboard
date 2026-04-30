import type { BudgetSummary } from '@/features/budget/types'
import { formatCurrency } from '@/features/budget/utils/budgetSelectors'

interface BudgetSummaryCardsProps {
  summary: BudgetSummary
}

interface CardData {
  id: string
  label: string
  amount: number
  accent: string
}

function buildBlockRows(summary: BudgetSummary): CardData[] {
  return [
    { id: 'socle', label: 'Socle fixe', amount: summary.socleFixeBudget, accent: 'var(--primary-500)' },
    { id: 'essentiel', label: 'Variable essentielle', amount: summary.variableEssentielleBudget, accent: 'var(--color-success)' },
    { id: 'provision', label: 'Provision', amount: summary.provisionBudget, accent: 'var(--color-warning)' },
    { id: 'discretionnaire', label: 'Discrétionnaire', amount: summary.discretionnaireBudget, accent: 'var(--color-error)' },
    { id: 'projet', label: 'Cagnotte projet', amount: summary.cagnotteProjetBudget, accent: 'var(--neutral-700)' },
  ]
}

export function BudgetSummaryCards({ summary }: BudgetSummaryCardsProps) {
  const blockRows = buildBlockRows(summary)
  const total = summary.totalBudgetMonthly

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-3)' }}>
          <article style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--neutral-150)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-4)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--neutral-500)', fontWeight: 'var(--font-weight-bold)' }}>Budget total</p>
            <p style={{ margin: 'var(--space-2) 0 0', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--neutral-900)' }}>
              {formatCurrency(summary.totalBudgetMonthly)}
            </p>
          </article>

          <article style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--neutral-150)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-4)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--neutral-500)', fontWeight: 'var(--font-weight-bold)' }}>Budget variable</p>
            <p style={{ margin: 'var(--space-2) 0 0', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--neutral-900)' }}>
              {formatCurrency(summary.globalVariableBudget)}
            </p>
          </article>

          <article style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--neutral-150)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-4)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--neutral-500)', fontWeight: 'var(--font-weight-bold)' }}>Socle fixe</p>
            <p style={{ margin: 'var(--space-2) 0 0', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--neutral-900)' }}>
              {formatCurrency(summary.socleFixeBudget)}
            </p>
          </article>

          <article style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--neutral-150)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-4)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--neutral-500)', fontWeight: 'var(--font-weight-bold)' }}>Provisions + projets</p>
            <p style={{ margin: 'var(--space-2) 0 0', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--neutral-900)' }}>
              {formatCurrency(summary.provisionBudget + summary.cagnotteProjetBudget)}
            </p>
          </article>
        </div>

        <article style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--neutral-150)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-4)' }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--neutral-500)', fontWeight: 'var(--font-weight-bold)' }}>
            Répartition par blocs
          </p>

          <div style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
            {blockRows.map((row) => {
              const share = total > 0 ? (row.amount / total) * 100 : 0
              const width = `${Math.min(100, Math.max(0, share)).toFixed(1)}%`

              return (
                <div key={row.id} style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', fontWeight: 'var(--font-weight-semibold)' }}>
                      {row.label}
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(row.amount)}
                    </p>
                  </div>

                  <div style={{ width: '100%', height: 'var(--space-2)', borderRadius: 'var(--radius-pill)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                    <div style={{ width, height: '100%', background: row.accent, borderRadius: 'var(--radius-pill)', transition: 'width var(--transition-base)' }} />
                  </div>

                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                    {`${share.toFixed(1)}% du budget total`}
                  </p>
                </div>
              )
            })}
          </div>
        </article>
      </div>
    </section>
  )
}
