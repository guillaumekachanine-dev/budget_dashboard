import { useMemo } from 'react'
import type { BudgetActualCategoryMetric, BudgetLineWithCategory } from '@/features/budget/types'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { useCategories } from '@/hooks/useCategories'
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
  const { data: categories = [] } = useCategories('expense')
  const categoryIconKeyById = useMemo(() => new Map(categories.map((category) => [category.id, category.icon_key])), [categories])
  const actualByCategoryId = useMemo(() => {
    const map = new Map<string, number>()
    for (const metric of actualCategoryMetrics) {
      if (!metric.category_id) continue
      map.set(metric.category_id, (map.get(metric.category_id) ?? 0) + Number(metric.amount_total ?? 0))
    }
    return map
  }, [actualCategoryMetrics])

  return (
    <section style={{ padding: '0 var(--space-5)' }}>
      <h3 style={{ margin: '0 0 var(--space-6) 0', fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
        Répartition par catégorie
      </h3>

      {sorted.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>Aucune ligne de budget.</p>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-8)' }}>
          {sorted.map((line) => {
            const budgetAmount = Number(line.amount ?? 0)
            const actualAmount = hasActuals && line.category_id ? (actualByCategoryId.get(line.category_id) ?? 0) : 0
            const consumptionRatio = computeBudgetConsumptionRatio(budgetAmount, actualAmount)
            const progressPct = Math.min(100, Math.round(consumptionRatio * 100))
            const actualPct = Math.round(consumptionRatio * 100)
            const variance = budgetAmount - actualAmount
            const isOverBudget = variance < 0
            const resolvedIconKey = line.category_icon_key ?? (line.category_id ? (categoryIconKeyById.get(line.category_id) ?? null) : null)

            return (
              <div
                key={line.id}
                role={onLineClick ? 'button' : undefined}
                tabIndex={onLineClick ? 0 : undefined}
                onClick={onLineClick ? () => onLineClick(line) : undefined}
                onKeyDown={onLineClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onLineClick(line) } : undefined}
                style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 'var(--space-5)', cursor: onLineClick ? 'pointer' : undefined, transition: onLineClick ? 'opacity var(--transition-fast)' : undefined, opacity: onLineClick ? 1 : undefined }}
                onMouseEnter={onLineClick ? (e) => { e.currentTarget.style.opacity = '0.7' } : undefined}
                onMouseLeave={onLineClick ? (e) => { e.currentTarget.style.opacity = '1' } : undefined}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                  <CategoryIcon iconKey={resolvedIconKey} label={line.category_name ?? ''} size={56} />
                </div>

                <div style={{ display: 'grid', gap: 'var(--space-2)', minWidth: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--space-4)', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', fontWeight: 'var(--font-weight-bold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {line.category_name ?? 'Catégorie'}
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                      {formatCurrency(budgetAmount)}
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

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--space-4)', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(actualAmount)} <span style={{ color: 'var(--neutral-500)' }}>({actualPct}%)</span>
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: isOverBudget ? 'var(--color-error)' : 'var(--neutral-500)', fontFamily: 'var(--font-mono)', fontWeight: isOverBudget ? 700 : 400, flexShrink: 0 }}>
                      {hasActuals
                        ? (isOverBudget ? `Dépassement ${formatCurrency(Math.abs(variance))}` : `Restant ${formatCurrency(variance)}`)
                        : 'Pas encore de consommé'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
