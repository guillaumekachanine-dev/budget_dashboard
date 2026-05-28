import { useMemo } from 'react'
import { useSavingsActualsByMonth } from '@/features/savings/hooks/useSavingsActualsByMonth'
import { useSavingsPlanningMonthDetails } from '@/features/savings/hooks/useSavingsPlanningMonthDetails'

export type SavingsObjectiveMonthRow = {
  monthId: string
  monthLabel: string
  typeLabel: 'Réalisé' | 'Objectif'
  amount: number
  isPast: boolean
}

type SavingsObjective2026Details = {
  rows: SavingsObjectiveMonthRow[]
  pastRows: SavingsObjectiveMonthRow[]
  futureRows: SavingsObjectiveMonthRow[]
  totalUpdatedObjective: number
}

const MONTHS_2026 = [
  { month: 1, label: 'Janvier' },
  { month: 2, label: 'Février' },
  { month: 3, label: 'Mars' },
  { month: 4, label: 'Avril' },
  { month: 5, label: 'Mai' },
  { month: 6, label: 'Juin' },
  { month: 7, label: 'Juillet' },
  { month: 8, label: 'Août' },
  { month: 9, label: 'Septembre' },
  { month: 10, label: 'Octobre' },
  { month: 11, label: 'Novembre' },
  { month: 12, label: 'Décembre' },
] as const

function getCurrentMonthId(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function useSavingsObjective2026Details(userId?: string): SavingsObjective2026Details {
  const { byMonth } = useSavingsActualsByMonth(userId, 2026)
  const { data: planningRows = [] } = useSavingsPlanningMonthDetails(userId, 2026)

  return useMemo(() => {
    const currentMonthId = getCurrentMonthId()
    const objectiveByMonth = new Map<number, number>()
    for (const row of planningRows) {
      objectiveByMonth.set(row.period_month, Number(row.monthly_objective_amount ?? 0))
    }

    const rows: SavingsObjectiveMonthRow[] = MONTHS_2026.map(({ month, label }) => {
      const monthId = `2026-${String(month).padStart(2, '0')}`
      const isPast = monthId < currentMonthId
      const amount = isPast
        ? Number(byMonth[month]?.actual_savings_amount_eur ?? 0)
        : Number(objectiveByMonth.get(month) ?? 0)

      return {
        monthId,
        monthLabel: label,
        typeLabel: isPast ? 'Réalisé' : 'Objectif',
        amount,
        isPast,
      }
    })

    const pastRows = rows.filter((row) => row.isPast)
    const futureRows = rows.filter((row) => !row.isPast)
    const totalUpdatedObjective = rows.reduce((sum, row) => sum + row.amount, 0)

    return {
      rows,
      pastRows,
      futureRows,
      totalUpdatedObjective,
    }
  }, [byMonth, planningRows])
}

