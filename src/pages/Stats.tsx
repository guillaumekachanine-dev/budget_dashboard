import { motion } from 'framer-motion'
import { getCurrentPeriod, getMonthLabel } from '@/lib/utils'
import { StatsBudgetAnalyticsPanel } from '@/features/budget/components/StatsBudgetAnalyticsPanel'
import { useBudgetSummaries } from '@/hooks/useBudgets'
import { PageHeader } from '@/components/layout/PageHeader'
import { HeroSection } from '@/components/layout/HeroSection'

function formatMoneyInteger(amount: number): string {
  if (!Number.isFinite(amount)) return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(0)

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.floor(amount))
}

export function Stats() {
  const { year, month } = getCurrentPeriod()
  const { data: summaries } = useBudgetSummaries(year, month)

  const monthBudget = summaries?.reduce((sum, row) => sum + Number(row.budget_amount), 0) ?? 0
  const monthSpent = summaries?.reduce((sum, row) => sum + Number(row.spent_amount), 0) ?? 0
  const monthRemaining = monthBudget - monthSpent

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom-offset))' }}>
      <PageHeader />

      <HeroSection
        bgColor="var(--color-success)"
        value={formatMoneyInteger(monthRemaining)}
        subtitle={`Reste ce mois · ${getMonthLabel(year, month)}`}
      />

      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '0 var(--space-6)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <StatsBudgetAnalyticsPanel year={year} />
        </div>
      </motion.section>
    </div>
  )
}
