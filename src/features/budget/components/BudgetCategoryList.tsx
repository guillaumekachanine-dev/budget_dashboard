import { useMemo } from 'react'
import type { BudgetActualCategoryMetric, BudgetLineWithCategory } from '@/features/budget/types'
import {
  computeBudgetConsumptionRatio,
  formatCurrency,
  sortBudgetLinesForDisplay,
} from '@/features/budget/utils/budgetSelectors'

interface BudgetCategoryListProps {
  lines: BudgetLineWithCategory[]
  actualCategoryMetrics: BudgetActualCategoryMetric[]
  hasActuals: boolean
  onLineClick?: (line: BudgetLineWithCategory) => void
}

export function BudgetCategoryList({ lines, actualCategoryMetrics, hasActuals, onLineClick }: BudgetCategoryListProps) {
  const sorted = sortBudgetLinesForDisplay(lines)
  const actualByCategoryId = useMemo(() => {
    const map = new Map<string, number>()
    for (const metric of actualCategoryMetrics) {
      if (!metric.category_id) continue
      map.set(metric.category_id, (map.get(metric.category_id) ?? 0) + Number(metric.amount_total ?? 0))
    }
    return map
  }, [actualCategoryMetrics])

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <article style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--neutral-150)', boxShadow: 'var(--shadow-card)', padding: 'var(--space-4)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
            Détail des sous-catégories
          </h3>

          {sorted.length === 0 ? (
            <p style={{ margin: 'var(--space-3) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>Aucune ligne de budget.</p>
          ) : (
            <div style={{ marginTop: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
              {sorted.map((line) => {
                const budgetAmount = Number(line.amount ?? 0)
                const actualAmount = hasActuals && line.category_id ? (actualByCategoryId.get(line.category_id) ?? 0) : 0
                const consumptionRatio = computeBudgetConsumptionRatio(budgetAmount, actualAmount)
                const progressPct = Math.min(100, Math.round(consumptionRatio * 100))
                const variance = budgetAmount - actualAmount
                const isOverBudget = variance < 0

                return (
                  <div
                    key={line.id}
                    role={onLineClick ? 'button' : undefined}
                    tabIndex={onLineClick ? 0 : undefined}
                    onClick={onLineClick ? () => onLineClick(line) : undefined}
                    onKeyDown={onLineClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onLineClick(line) } : undefined}
                    style={{ display: 'grid', gap: 'var(--space-2)', borderTop: '1px solid var(--neutral-150)', paddingTop: 'var(--space-2)', cursor: onLineClick ? 'pointer' : undefined, borderRadius: onLineClick ? 'var(--radius-sm)' : undefined, transition: onLineClick ? 'background var(--transition-fast)' : undefined }}
                    onMouseEnter={onLineClick ? (e) => { e.currentTarget.style.background = 'var(--neutral-50)' } : undefined}
                    onMouseLeave={onLineClick ? (e) => { e.currentTarget.style.background = '' } : undefined}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--space-3)', alignItems: 'center' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {line.category_name ?? 'Catégorie'}
                        </p>
                        <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>
                          {line.parent_category_name ?? 'Autres'}
                        </p>
                      </div>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-mono)' }}>
                        {`${formatCurrency(actualAmount)} / ${formatCurrency(budgetAmount)}`}
                      </p>
                    </div>

                    <div style={{ width: '100%', height: 'var(--space-2)', borderRadius: 'var(--radius-pill)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${progressPct}%`,
                          height: '100%',
                          borderRadius: 'var(--radius-pill)',
                          background: isOverBudget ? 'var(--color-error)' : 'var(--primary-500)',
                          transition: 'width var(--transition-base)',
                        }}
                      />
                    </div>

                    <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: isOverBudget ? 'var(--color-error)' : 'var(--neutral-500)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                      {hasActuals
                        ? (isOverBudget ? `Dépassement ${formatCurrency(Math.abs(variance))}` : `Restant ${formatCurrency(variance)}`)
                        : 'Pas encore de consommé'}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </article>
      </div>
    </section>
  )
}
