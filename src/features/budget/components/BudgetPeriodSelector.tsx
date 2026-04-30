import type { BudgetPeriodOption } from '@/features/budget/types'
import { formatPeriodLabel } from '@/features/budget/utils/budgetSelectors'

interface BudgetPeriodSelectorProps {
  periods: BudgetPeriodOption[]
  selectedPeriodId: string | null
  onSelectPeriod: (periodId: string) => void
  disabled?: boolean
}

export function BudgetPeriodSelector({
  periods,
  selectedPeriodId,
  onSelectPeriod,
  disabled = false,
}: BudgetPeriodSelectorProps) {
  if (periods.length <= 1) return null

  return (
    <label
      style={{
        display: 'grid',
        gap: 'var(--space-2)',
      }}
    >
      <span
        style={{
          margin: 0,
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--neutral-500)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Période budgétaire
      </span>
      <select
        value={selectedPeriodId ?? ''}
        onChange={(event) => onSelectPeriod(event.target.value)}
        disabled={disabled}
        style={{
          width: '100%',
          minHeight: 'var(--touch-target-min)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--neutral-200)',
          background: 'var(--neutral-0)',
          color: 'var(--neutral-900)',
          padding: '0 var(--space-4)',
          fontSize: 'var(--font-size-base)',
          fontWeight: 'var(--font-weight-semibold)',
        }}
      >
        {periods.map((period) => (
          <option key={period.id} value={period.id}>
            {formatPeriodLabel(period.period_year, period.period_month, period.label)}
          </option>
        ))}
      </select>
    </label>
  )
}
