export const REVENUE_SCENARIO_GUARANTEED_MONTHLY_INCOME = 3338
export const REVENUE_SCENARIO_2_SALARY_AND_PRIME_MONTHLY_INCOME = 6500
export const REVENUE_SCENARIO_2_UNEMPLOYMENT_MONTHS = 4
export const REVENUE_SCENARIO_2_SALARY_MONTHS = 3
export const REVENUE_SCENARIO_DEFAULT_INCOME_DAY = 4

export type RevenueScenarioConfig = {
  guaranteedMonthlyIncome?: number
  salaryAndPrimeMonthlyIncome?: number
  unemploymentMonths?: number
  salaryMonths?: number
}

function clampMonth(month: number): number {
  return Math.min(12, Math.max(1, month))
}

export function getRevenueScenario1ProjectedAnnualTotal(ytdRevenue: number, ytdMonths: number, config?: RevenueScenarioConfig): number {
  const guaranteedMonthlyIncome = config?.guaranteedMonthlyIncome ?? REVENUE_SCENARIO_GUARANTEED_MONTHLY_INCOME
  const remainingMonths = Math.max(0, 12 - Math.max(0, ytdMonths))
  return ytdRevenue + guaranteedMonthlyIncome * remainingMonths
}

export function getRevenueScenario2ProjectedMonthAmount(params: {
  month: number
  ytdMonths: number
  actualMonthAmount?: number | null
  config?: RevenueScenarioConfig
}): number {
  const guaranteedMonthlyIncome = params.config?.guaranteedMonthlyIncome ?? REVENUE_SCENARIO_GUARANTEED_MONTHLY_INCOME
  const salaryAndPrimeMonthlyIncome = params.config?.salaryAndPrimeMonthlyIncome ?? REVENUE_SCENARIO_2_SALARY_AND_PRIME_MONTHLY_INCOME
  const unemploymentMonths = params.config?.unemploymentMonths ?? REVENUE_SCENARIO_2_UNEMPLOYMENT_MONTHS
  const salaryMonths = params.config?.salaryMonths ?? REVENUE_SCENARIO_2_SALARY_MONTHS

  const month = clampMonth(params.month)
  const ytdMonths = Math.max(0, params.ytdMonths)
  const actualMonthAmount = Number(params.actualMonthAmount ?? 0)

  if (month < ytdMonths) return 0
  if (month === ytdMonths) return actualMonthAmount > 0 ? actualMonthAmount : guaranteedMonthlyIncome

  const projectedMonthOffset = month - ytdMonths
  if (projectedMonthOffset <= unemploymentMonths) {
    return guaranteedMonthlyIncome
  }
  if (projectedMonthOffset <= unemploymentMonths + salaryMonths) {
    return salaryAndPrimeMonthlyIncome
  }
  return 0
}

export function getRevenueScenario2ProjectedAnnualTotal(ytdRevenue: number, config?: RevenueScenarioConfig): number {
  const guaranteedMonthlyIncome = config?.guaranteedMonthlyIncome ?? REVENUE_SCENARIO_GUARANTEED_MONTHLY_INCOME
  const salaryAndPrimeMonthlyIncome = config?.salaryAndPrimeMonthlyIncome ?? REVENUE_SCENARIO_2_SALARY_AND_PRIME_MONTHLY_INCOME
  const unemploymentMonths = config?.unemploymentMonths ?? REVENUE_SCENARIO_2_UNEMPLOYMENT_MONTHS
  const salaryMonths = config?.salaryMonths ?? REVENUE_SCENARIO_2_SALARY_MONTHS
  return ytdRevenue
    + guaranteedMonthlyIncome * unemploymentMonths
    + salaryAndPrimeMonthlyIncome * salaryMonths
}
