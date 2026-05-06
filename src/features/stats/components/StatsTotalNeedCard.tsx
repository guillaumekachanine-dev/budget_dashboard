import { formatCurrency } from '@/features/stats/utils/statsReferenceSelectors'
import {
  HeroMetricCard,
  StatsSection,
} from '@/features/stats/components/ui'

type StatsTotalNeedCardProps = {
  totalExpenseBudget: number
  totalSavingsBudget: number
  totalMonthlyNeed: number
}

export function StatsTotalNeedCard({
  totalExpenseBudget,
  totalSavingsBudget,
  totalMonthlyNeed,
}: StatsTotalNeedCardProps) {
  return (
    <StatsSection>
      <HeroMetricCard
        title="Besoin mensuel total"
        value={formatCurrency(totalMonthlyNeed)}
        tone="premium"
        metrics={[
          { label: 'Budget dépenses', value: formatCurrency(totalExpenseBudget) },
          { label: 'Épargne cible', value: formatCurrency(totalSavingsBudget) },
        ]}
      />
    </StatsSection>
  )
}
