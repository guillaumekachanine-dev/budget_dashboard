import { motion } from 'framer-motion'
import { getCurrentPeriod, getMonthLabel } from '@/lib/utils'
import { StatsBudgetAnalyticsPanel } from '@/features/budget/components/StatsBudgetAnalyticsPanel'

export function Stats() {
  const { year, month } = getCurrentPeriod()

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-nav">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-widest mb-0.5">
          {getMonthLabel(year, month)}
        </p>
      </motion.div>

      <StatsBudgetAnalyticsPanel year={year} />
    </div>
  )
}
