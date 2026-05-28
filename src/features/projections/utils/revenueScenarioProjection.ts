export const REVENUE_SCENARIO_GUARANTEED_MONTHLY_INCOME = 3338
export const REVENUE_SCENARIO_2_SALARY_AND_PRIME_MONTHLY_INCOME = 6500
export const REVENUE_SCENARIO_2_UNEMPLOYMENT_MONTHS = 4
export const REVENUE_SCENARIO_2_SALARY_MONTHS = 3
export const REVENUE_SCENARIO_DEFAULT_INCOME_DAY = 4

function clampMonth(month: number): number {
  return Math.min(12, Math.max(1, month))
}

export function getRevenueScenario1ProjectedAnnualTotal(ytdRevenue: number, ytdMonths: number): number {
  const remainingMonths = Math.max(0, 12 - Math.max(0, ytdMonths))
  return ytdRevenue + REVENUE_SCENARIO_GUARANTEED_MONTHLY_INCOME * remainingMonths
}

export function getRevenueScenario2ProjectedMonthAmount(params: {
  month: number
  ytdMonths: number
  actualMonthAmount?: number | null
}): number {
  const month = clampMonth(params.month)
  const ytdMonths = Math.max(0, params.ytdMonths)
  const actualMonthAmount = Number(params.actualMonthAmount ?? 0)

  if (month < ytdMonths) return 0
  if (month === ytdMonths) return actualMonthAmount > 0 ? actualMonthAmount : REVENUE_SCENARIO_GUARANTEED_MONTHLY_INCOME

  const projectedMonthOffset = month - ytdMonths
  if (projectedMonthOffset <= REVENUE_SCENARIO_2_UNEMPLOYMENT_MONTHS) {
    return REVENUE_SCENARIO_GUARANTEED_MONTHLY_INCOME
  }
  if (projectedMonthOffset <= REVENUE_SCENARIO_2_UNEMPLOYMENT_MONTHS + REVENUE_SCENARIO_2_SALARY_MONTHS) {
    return REVENUE_SCENARIO_2_SALARY_AND_PRIME_MONTHLY_INCOME
  }
  return 0
}

export function getRevenueScenario2ProjectedAnnualTotal(ytdRevenue: number): number {
  return ytdRevenue
    + REVENUE_SCENARIO_GUARANTEED_MONTHLY_INCOME * REVENUE_SCENARIO_2_UNEMPLOYMENT_MONTHS
    + REVENUE_SCENARIO_2_SALARY_AND_PRIME_MONTHLY_INCOME * REVENUE_SCENARIO_2_SALARY_MONTHS
}
