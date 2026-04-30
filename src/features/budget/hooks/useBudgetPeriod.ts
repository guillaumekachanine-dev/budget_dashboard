import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getActualsForBudgetPeriod } from '@/features/budget/api/getActualsForBudgetPeriod'
import { getBudgetLinesForPeriod } from '@/features/budget/api/getBudgetLinesForPeriod'
import { getBudgetPeriods } from '@/features/budget/api/getBudgetPeriods'
import { getLatestBudgetPeriod } from '@/features/budget/api/getLatestBudgetPeriod'
import { budgetDb } from '@/lib/supabaseBudget'
import { getCurrentPeriod } from '@/lib/utils'
import type {
  BudgetActualsForPeriod,
  BudgetLineWithCategory,
  BudgetParentGroup,
  BudgetPeriodOption,
  BudgetSummary,
  GlobalVariableBudgetLine,
} from '@/features/budget/types'
import { buildBudgetSummary, groupBudgetLinesByParent } from '@/features/budget/utils/budgetSelectors'

interface UseBudgetPeriodState {
  selectedPeriod: BudgetPeriodOption | null
  availablePeriods: BudgetPeriodOption[]
  loading: boolean
  error: string | null
  summary: BudgetSummary
  categoryLines: BudgetLineWithCategory[]
  parentGroups: BudgetParentGroup[]
  actuals: BudgetActualsForPeriod | null
  hasActuals: boolean
}

interface UseBudgetPeriodResult extends UseBudgetPeriodState {
  setSelectedPeriod: (period: BudgetPeriodOption | null) => void
  reload: () => Promise<void>
}

const EMPTY_SUMMARY: BudgetSummary = {
  totalBudgetMonthly: 0,
  globalVariableBudget: 0,
  socleFixeBudget: 0,
  variableEssentielleBudget: 0,
  provisionBudget: 0,
  discretionnaireBudget: 0,
  cagnotteProjetBudget: 0,
  horsPilotageBudget: 0,
}

const EMPTY_ACTUALS: BudgetActualsForPeriod = {
  monthlyMetrics: null,
  categoryActuals: [],
  totalActualExpense: 0,
}

export function useBudgetPeriod(): UseBudgetPeriodResult {
  const mountedRef = useRef(true)
  const runIdRef = useRef(0)

  const [state, setState] = useState<UseBudgetPeriodState>({
    selectedPeriod: null,
    availablePeriods: [],
    loading: true,
    error: null,
    summary: EMPTY_SUMMARY,
    categoryLines: [],
    parentGroups: [],
    actuals: null,
    hasActuals: false,
  })

  const [selectedPeriod, setSelectedPeriodState] = useState<BudgetPeriodOption | null>(null)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  const applyPeriodData = useCallback((
    period: BudgetPeriodOption,
    categoryLines: BudgetLineWithCategory[],
    globalVariableLine: GlobalVariableBudgetLine | null,
    actuals: BudgetActualsForPeriod,
  ) => {
    const summary = buildBudgetSummary(categoryLines, globalVariableLine)
    const parentGroups = groupBudgetLinesByParent(categoryLines)
    const hasActuals = Boolean(actuals.monthlyMetrics || actuals.categoryActuals.length > 0)

    setState((prev) => ({
      ...prev,
      selectedPeriod: period,
      summary,
      categoryLines,
      parentGroups,
      actuals,
      hasActuals,
      loading: false,
      error: null,
    }))
  }, [])

  const loadPeriodData = useCallback(async (period: BudgetPeriodOption) => {
    const runId = ++runIdRef.current

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const budgetData = await getBudgetLinesForPeriod({ periodId: period.id })
      let actuals = EMPTY_ACTUALS

      try {
        actuals = await getActualsForBudgetPeriod(period.period_year, period.period_month)
      } catch {
        actuals = EMPTY_ACTUALS
      }

      if (!mountedRef.current || runId !== runIdRef.current) return

      applyPeriodData(period, budgetData.categoryLines, budgetData.globalVariableLine, actuals)
    } catch (error) {
      if (!mountedRef.current || runId !== runIdRef.current) return
      const message = error instanceof Error ? error.message : 'Impossible de charger les données budgétaires.'
      setState((prev) => ({ ...prev, loading: false, error: message }))
    }
  }, [applyPeriodData])

  const loadInitialData = useCallback(async () => {
    const runId = ++runIdRef.current

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const periods = await getBudgetPeriods()
      const latest = periods[0] ?? (await getLatestBudgetPeriod())
      const periodIds = periods.map((period) => period.id)

      let periodIdsWithBudget = new Set<string>()
      if (periodIds.length > 0) {
        const { data: budgetRows } = await budgetDb()
          .from('budgets')
          .select('period_id')
          .in('period_id', periodIds)

        periodIdsWithBudget = new Set(
          ((budgetRows ?? []) as Array<{ period_id: string | null }>)
            .map((row) => row.period_id)
            .filter((value): value is string => Boolean(value)),
        )
      }

      if (!mountedRef.current || runId !== runIdRef.current) return

      if (!latest) {
        setState((prev) => ({
          ...prev,
          availablePeriods: periods,
          selectedPeriod: null,
          summary: EMPTY_SUMMARY,
          categoryLines: [],
          parentGroups: [],
          actuals: null,
          hasActuals: false,
          loading: false,
          error: null,
        }))
        return
      }

      const { year: currentYear, month: currentMonth } = getCurrentPeriod()
      const nextSelectedPeriod = periods.find((period) => (
        period.period_year === currentYear
        && period.period_month === currentMonth
        && periodIdsWithBudget.has(period.id)
      ))
        ?? periods.find((period) => periodIdsWithBudget.has(period.id))
        ?? latest

      setState((prev) => ({ ...prev, availablePeriods: periods }))
      setSelectedPeriodState(nextSelectedPeriod)
    } catch (error) {
      if (!mountedRef.current || runId !== runIdRef.current) return
      const message = error instanceof Error ? error.message : 'Impossible de charger les périodes budgétaires.'
      setState((prev) => ({ ...prev, loading: false, error: message }))
    }
  }, [])

  useEffect(() => {
    void loadInitialData()
  }, [loadInitialData])

  useEffect(() => {
    if (!selectedPeriod) return
    void loadPeriodData(selectedPeriod)
  }, [loadPeriodData, selectedPeriod])

  const reload = useCallback(async () => {
    if (!selectedPeriod) {
      await loadInitialData()
      return
    }

    await loadPeriodData(selectedPeriod)
  }, [loadInitialData, loadPeriodData, selectedPeriod])

  const setSelectedPeriod = useCallback((period: BudgetPeriodOption | null) => {
    setSelectedPeriodState(period)
    if (!period) {
      setState((prev) => ({
        ...prev,
        selectedPeriod: null,
        summary: EMPTY_SUMMARY,
        categoryLines: [],
        parentGroups: [],
        actuals: null,
        hasActuals: false,
      }))
    }
  }, [])

  return useMemo(() => ({
    ...state,
    setSelectedPeriod,
    reload,
  }), [reload, setSelectedPeriod, state])
}
