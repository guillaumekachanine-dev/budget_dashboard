import { PageHeader } from '@/components/layout/PageHeader'
import type { BudgetPeriodOption } from '@/features/budget/types'
import { formatPeriodLabel } from '@/features/budget/utils/budgetSelectors'
import { BudgetPeriodSelector } from '@/features/budget/components/BudgetPeriodSelector'

interface BudgetPageHeaderProps {
  selectedPeriod: BudgetPeriodOption | null
  availablePeriods: BudgetPeriodOption[]
  onSelectPeriod: (periodId: string) => void
  loading: boolean
}

export function BudgetPageHeader({
  selectedPeriod,
  availablePeriods,
  onSelectPeriod,
  loading,
}: BudgetPageHeaderProps) {
  const periodLabel = selectedPeriod
    ? formatPeriodLabel(selectedPeriod.period_year, selectedPeriod.period_month, selectedPeriod.label)
    : 'Aucune période'

  return (
    <>
      <PageHeader title="Budgets" actionDisabled />

      <section style={{ padding: '0 var(--space-6)', marginTop: 'calc(var(--space-8) * -1)' }}>
        <div
          style={{
            maxWidth: 600,
            margin: '0 auto',
            background: 'var(--neutral-0)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--neutral-150)',
            boxShadow: 'var(--shadow-card)',
            padding: 'var(--space-5)',
            display: 'grid',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)', fontWeight: 'var(--font-weight-semibold)' }}>
              Budget mensuel configuré
            </p>
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-extrabold)' }}>
              {periodLabel}
            </h2>
          </div>

          <BudgetPeriodSelector
            periods={availablePeriods}
            selectedPeriodId={selectedPeriod?.id ?? null}
            onSelectPeriod={onSelectPeriod}
            disabled={loading}
          />
        </div>
      </section>
    </>
  )
}
