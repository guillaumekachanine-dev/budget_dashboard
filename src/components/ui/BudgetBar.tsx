import { motion } from 'framer-motion'
import { formatCurrency, clamp } from '@/lib/utils'
import type { CategoryBudgetSummary } from '@/lib/types'
import { CategoryIcon } from '@/components/ui/CategoryIcon'

interface BudgetBarProps {
  summary: CategoryBudgetSummary
  index: number
}

function progressClass(pct: number): string {
  if (pct >= 100) return 'red'
  if (pct >= 80)  return 'orange'
  if (pct >= 50)  return 'blue'
  return 'green'
}

export function BudgetBar({ summary, index }: BudgetBarProps) {
  const { category, budget_amount, spent_amount, remaining, percentage } = summary
  const pct = clamp(percentage, 0, 100)
  const isNearLimit = percentage >= 80

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="budget-item"
    >
      <div className="budget-item-top">
        <div className="budget-item-left">
          <CategoryIcon iconKey={category.icon_key} label={category.name} size={32} />
          <div>
            <div className="budget-item-name">{category.name}</div>
            <div
              className="budget-item-sub"
              style={isNearLimit ? { color: 'var(--color-negative)' } : undefined}
            >
              {remaining >= 0
                ? `Reste ${formatCurrency(remaining)}`
                : `Dépassé de ${formatCurrency(Math.abs(remaining))}`}
              {percentage >= 90 && ' ⚠'}
            </div>
          </div>
        </div>
        <div className="budget-item-amount">{formatCurrency(budget_amount)}</div>
      </div>

      <div className="progress-track">
        <motion.div
          className={`progress-fill ${progressClass(percentage)}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: 0.15 + index * 0.05, duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--neutral-400)' }}>
          {formatCurrency(spent_amount)} dépensé
        </span>
        <span style={{ fontSize: 11, color: 'var(--neutral-400)' }}>
          {pct.toFixed(0)}%
        </span>
      </div>
    </motion.div>
  )
}
