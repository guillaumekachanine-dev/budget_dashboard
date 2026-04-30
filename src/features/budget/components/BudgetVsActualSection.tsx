import type { BudgetActualsForPeriod, BudgetLineWithCategory, BudgetSummary } from '@/features/budget/types'
import {
  buildBudgetVsActualByCategory,
  buildBudgetVsActualByParent,
  computeBudgetConsumptionRatio,
  formatCurrency,
} from '@/features/budget/utils/budgetSelectors'

interface BudgetVsActualSectionProps {
  summary: BudgetSummary
  categoryLines: BudgetLineWithCategory[]
  actuals: BudgetActualsForPeriod | null
  hasActuals: boolean
}

export function BudgetVsActualSection({
  summary,
  categoryLines,
  actuals,
  hasActuals,
}: BudgetVsActualSectionProps) {
  if (!hasActuals || !actuals) {
    return (
      <section style={{ padding: '0 var(--space-6)' }}>
        <div
          style={{
            maxWidth: 600,
            margin: '0 auto',
            background: 'var(--neutral-0)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--neutral-150)',
            boxShadow: 'var(--shadow-card)',
            padding: 'var(--space-5)',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
            Consommé vs budget
          </h3>
          <p style={{ margin: 'var(--space-3) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
            Aucune dépense observée pour cette période pour l&apos;instant. Le réel sera visible une fois le mois alimenté.
          </p>
        </div>
      </section>
    )
  }

  const parentRows = buildBudgetVsActualByParent(categoryLines, actuals.categoryActuals)
  const categoryRows = buildBudgetVsActualByCategory(categoryLines, actuals.categoryActuals).slice(0, 8)
  const globalRatio = computeBudgetConsumptionRatio(summary.totalBudgetMonthly, actuals.totalActualExpense)
  const globalRatioPct = Math.round(globalRatio * 100)

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>
        <article style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--neutral-150)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-4)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
            Consommé vs budget
          </h3>

          <div style={{ marginTop: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 'var(--space-3)' }}>
              <div>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'var(--font-weight-bold)' }}>Budget</p>
                <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(summary.totalBudgetMonthly)}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'var(--font-weight-bold)' }}>Réel</p>
                <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(actuals.totalActualExpense)}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'var(--font-weight-bold)' }}>Conso</p>
                <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)', color: globalRatio > 1 ? 'var(--color-error)' : 'var(--color-success)', fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-mono)' }}>{`${globalRatioPct}%`}</p>
              </div>
            </div>

            <div style={{ width: '100%', height: 'var(--space-2)', borderRadius: 'var(--radius-pill)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, globalRatioPct)}%`, height: '100%', borderRadius: 'var(--radius-pill)', background: globalRatio > 1 ? 'var(--color-error)' : 'var(--color-success)', transition: 'width var(--transition-base)' }} />
            </div>
          </div>
        </article>

        <article style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--neutral-150)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-4)' }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', fontWeight: 'var(--font-weight-bold)' }}>Par famille</p>
          <div style={{ marginTop: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
            {parentRows.map((row) => {
              const ratioPct = Math.round(row.consumptionRatio * 100)

              return (
                <div key={row.id} style={{ display: 'grid', gap: 'var(--space-1)', borderTop: '1px solid var(--neutral-150)', paddingTop: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)' }}>{row.name}</p>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                      {`${formatCurrency(row.actualAmount)} / ${formatCurrency(row.budgetAmount)}`}
                    </p>
                  </div>
                  <div style={{ width: '100%', height: 'var(--space-2)', borderRadius: 'var(--radius-pill)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, ratioPct)}%`, height: '100%', borderRadius: 'var(--radius-pill)', background: ratioPct > 100 ? 'var(--color-error)' : 'var(--primary-500)', transition: 'width var(--transition-base)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </article>

        <article style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--neutral-150)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-4)' }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', fontWeight: 'var(--font-weight-bold)' }}>Top catégories</p>
          <div style={{ marginTop: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
            {categoryRows.map((row) => (
              <div key={row.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-3)', borderTop: '1px solid var(--neutral-150)', paddingTop: 'var(--space-2)' }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)' }}>{row.name}</p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-mono)' }}>
                  {`${formatCurrency(row.actualAmount)} / ${formatCurrency(row.budgetAmount)}`}
                </p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}
