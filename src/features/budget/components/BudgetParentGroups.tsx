import type { BudgetParentGroup } from '@/features/budget/types'
import { formatCurrency } from '@/features/budget/utils/budgetSelectors'

interface BudgetParentGroupsProps {
  groups: BudgetParentGroup[]
}

export function BudgetParentGroups({ groups }: BudgetParentGroupsProps) {
  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
            Budget par famille
          </h3>
        </div>

        {groups.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>Aucune ligne budgétaire disponible pour cette période.</p>
        ) : (
          groups.map((group) => (
            <article
              key={group.parentCategoryId}
              style={{
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--neutral-150)',
                boxShadow: 'var(--shadow-card)',
                padding: 'var(--space-4)',
                display: 'grid',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-md)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)' }}>
                  {group.parentCategoryName}
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-md)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-extrabold)', fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(group.totalAmount)}
                </p>
              </div>

              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                {group.lines.map((line) => (
                  <div
                    key={line.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1fr) auto',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      borderTop: '1px solid var(--neutral-150)',
                      paddingTop: 'var(--space-2)',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)' }}>
                      {line.category_name ?? 'Catégorie'}
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(line.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
