import type {
  BudgetBucketTotalSourceRow,
  BudgetBucketVsActualSourceRow,
  MonthlyEvolutionRow,
  SavingsBudgetLineSourceRow,
  SavingsBudgetTotalsSourceRow,
  SavingsBudgetVsActualSourceRow,
  StatsBudgetBucketKey,
  StatsMonthlyReference,
  StatsPeriodOption,
  StatsReferenceSnapshot,
  StatsSelectedPeriod,
} from '@/features/stats/types'

export const BUDGET_BUCKET_CONFIG: Array<{ key: StatsBudgetBucketKey; label: string }> = [
  { key: 'socle_fixe', label: 'Socle fixe' },
  { key: 'variable_essentielle', label: 'Variable essentielle' },
  { key: 'provision', label: 'Provision' },
  { key: 'discretionnaire', label: 'Discrétionnaire' },
  { key: 'cagnotte_projet', label: 'Cagnotte projet' },
]

const SAVINGS_CATEGORY_DEFAULTS = ['Réserve sécurité', 'Projet / apport', 'Investissement']

function asNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMonthYearLabel(year: number, month: number): string {
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

function readString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return null
}

function readNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (!(key in row)) continue
    const parsed = Number(row[key])
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeBudgetBucket(value: string | null): StatsBudgetBucketKey | null {
  if (!value) return null
  const key = normalizeKey(value)

  if (['socle_fixe', 'soclefixe', 'fixed', 'fixed_expense', 'fixed_expenses'].includes(key)) {
    return 'socle_fixe'
  }

  if (['variable_essentielle', 'variable_essentiale', 'variable_essentiel', 'essential_variable'].includes(key)) {
    return 'variable_essentielle'
  }

  if (['provision', 'provisions'].includes(key)) {
    return 'provision'
  }

  if (['discretionnaire', 'discretionary'].includes(key)) {
    return 'discretionnaire'
  }

  if (['cagnotte_projet', 'project_bucket', 'project_pot'].includes(key)) {
    return 'cagnotte_projet'
  }

  return null
}

function getBudgetBucketLabel(key: StatsBudgetBucketKey): string {
  return BUDGET_BUCKET_CONFIG.find((item) => item.key === key)?.label ?? key
}

export function buildBudgetSummary(
  budgetBucketTotals: BudgetBucketTotalSourceRow[],
  totalExpenseBudget: number,
  globalVariableBudget: number,
): StatsReferenceSnapshot['budgetSummary'] {
  const byBucket = new Map<StatsBudgetBucketKey, number>()

  for (const row of budgetBucketTotals) {
    const bucketRaw = typeof row.budget_bucket === 'string' ? row.budget_bucket : null
    const bucket = normalizeBudgetBucket(bucketRaw)
    if (!bucket) continue
    const amount = asNumber((row as Record<string, unknown>).total_budget_bucket_eur)
    byBucket.set(bucket, amount)
  }

  const socleFixeBudget = byBucket.get('socle_fixe') ?? 0
  const variableEssentielleBudget = byBucket.get('variable_essentielle') ?? 0
  const provisionBudget = byBucket.get('provision') ?? 0
  const discretionnaireBudget = byBucket.get('discretionnaire') ?? 0
  const cagnotteProjetBudget = byBucket.get('cagnotte_projet') ?? 0

  const derivedExpenseTotal =
    socleFixeBudget + variableEssentielleBudget + provisionBudget + discretionnaireBudget + cagnotteProjetBudget

  return {
    totalExpenseBudget: totalExpenseBudget > 0 ? totalExpenseBudget : derivedExpenseTotal,
    globalVariableBudget,
    socleFixeBudget,
    variableEssentielleBudget,
    provisionBudget,
    discretionnaireBudget,
    cagnotteProjetBudget,
  }
}

export function buildBudgetBucketVsActual(
  rows: BudgetBucketVsActualSourceRow[],
): StatsReferenceSnapshot['budgetBucketVsActual'] {
  const byBucket = new Map<StatsBudgetBucketKey, StatsReferenceSnapshot['budgetBucketVsActual'][number]>()

  for (const item of BUDGET_BUCKET_CONFIG) {
    byBucket.set(item.key, {
      budgetBucket: item.label,
      targetBudgetBucketEur: 0,
      actualBudgetBucketEur: 0,
      deltaBudgetBucketEur: 0,
      consumptionRatio: null,
    })
  }

  for (const row of rows) {
    const bucketRaw = readString(row, ['budget_bucket', 'bucket', 'bucket_name', 'budget_bucket_name'])
    const normalizedBucket = normalizeBudgetBucket(bucketRaw)
    if (!normalizedBucket) continue

    const target = asNumber(readNumber(row, ['target_budget_bucket_eur', 'budget_amount_eur', 'target_amount_eur']))
    const actual = asNumber(readNumber(row, ['actual_budget_bucket_eur', 'actual_amount_eur', 'actual_amount']))
    const providedDelta = readNumber(row, ['delta_budget_bucket_eur', 'delta_amount_eur', 'delta_amount'])
    const ratio = readNumber(row, ['consumption_ratio', 'consumption_ratio_pct', 'consumption_pct'])

    byBucket.set(normalizedBucket, {
      budgetBucket: getBudgetBucketLabel(normalizedBucket),
      targetBudgetBucketEur: target,
      actualBudgetBucketEur: actual,
      deltaBudgetBucketEur: providedDelta ?? actual - target,
      consumptionRatio: ratio ?? (target > 0 ? actual / target : null),
    })
  }

  return BUDGET_BUCKET_CONFIG
    .map((item) => byBucket.get(item.key))
    .filter((row): row is StatsReferenceSnapshot['budgetBucketVsActual'][number] => Boolean(row))
}

function extractSavingsTargetTotal(
  totalsRows: SavingsBudgetTotalsSourceRow[],
  savingsLinesRows: SavingsBudgetLineSourceRow[],
): number {
  const directTotal = totalsRows
    .map((row) => readNumber(row, [
      'total_savings_budget_eur',
      'target_savings_total_eur',
      'target_total_eur',
      'budget_total_eur',
    ]))
    .find((value): value is number => value != null)

  if ((directTotal ?? 0) > 0) return asNumber(directTotal)

  return savingsLinesRows.reduce((sum, row) => {
    const value = readNumber(row, ['target_savings_amount_eur', 'target_amount_eur', 'budget_amount_eur', 'amount'])
    return sum + asNumber(value)
  }, 0)
}

function extractSavingsActualTotal(vsActualRows: SavingsBudgetVsActualSourceRow[]): number {
  const totalRow = vsActualRows.find((row) => {
    const totalValue = readNumber(row, [
      'total_actual_savings_eur',
      'actual_savings_total_eur',
      'actual_total_eur',
    ])
    return totalValue != null
      && !readString(row, ['category_name', 'savings_category_name', 'line_name'])
  })

  if (totalRow) {
    return asNumber(readNumber(totalRow, [
      'total_actual_savings_eur',
      'actual_savings_total_eur',
      'actual_total_eur',
    ]))
  }

  return vsActualRows.reduce((sum, row) => {
    const hasLineCategory = Boolean(readString(row, ['category_name', 'savings_category_name', 'line_name']))
    if (!hasLineCategory) return sum
    const value = readNumber(row, ['actual_savings_amount_eur', 'actual_amount_eur', 'actual_amount'])
    return sum + asNumber(value)
  }, 0)
}

export function buildSavingsSummary(
  savingsBudgetTotals: SavingsBudgetTotalsSourceRow[],
  savingsBudgetVsActual: SavingsBudgetVsActualSourceRow[],
  savingsBudgetLines: SavingsBudgetLineSourceRow[],
): StatsReferenceSnapshot['savingsSummary'] {
  const totalSavingsBudget = extractSavingsTargetTotal(savingsBudgetTotals, savingsBudgetLines)
  const totalSavingsActual = extractSavingsActualTotal(savingsBudgetVsActual)

  return {
    totalSavingsBudget,
    totalSavingsActual,
    deltaSavings: totalSavingsActual - totalSavingsBudget,
  }
}

function normalizeSavingsCategoryName(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return 'Sans catégorie'

  const key = normalizeKey(trimmed)
  if (['reserve_securite', 'reserve_de_securite'].includes(key)) return 'Réserve sécurité'
  if (['projet_apport', 'projet', 'apport'].includes(key)) return 'Projet / apport'
  if (['investissement', 'investissements'].includes(key)) return 'Investissement'

  return trimmed
}

export function buildSavingsLines(
  savingsBudgetLines: SavingsBudgetLineSourceRow[],
  savingsBudgetVsActual: SavingsBudgetVsActualSourceRow[],
): StatsReferenceSnapshot['savingsLines'] {
  const map = new Map<string, StatsReferenceSnapshot['savingsLines'][number]>()

  const upsert = (categoryName: string, patch: Partial<StatsReferenceSnapshot['savingsLines'][number]>) => {
    const current = map.get(categoryName) ?? {
      categoryName,
      targetSavingsAmountEur: 0,
      actualSavingsAmountEur: 0,
      deltaSavingsAmountEur: 0,
    }

    const next = {
      ...current,
      ...patch,
    }

    next.deltaSavingsAmountEur = next.actualSavingsAmountEur - next.targetSavingsAmountEur
    map.set(categoryName, next)
  }

  for (const row of savingsBudgetLines) {
    const categoryRaw = readString(row, ['category_name', 'savings_category_name', 'line_name'])
    if (!categoryRaw) continue

    const categoryName = normalizeSavingsCategoryName(categoryRaw)
    const target = asNumber(readNumber(row, ['target_savings_amount_eur', 'target_amount_eur', 'budget_amount_eur', 'amount']))
    upsert(categoryName, { targetSavingsAmountEur: target })
  }

  for (const row of savingsBudgetVsActual) {
    const categoryRaw = readString(row, ['category_name', 'savings_category_name', 'line_name'])
    if (!categoryRaw) continue

    const categoryName = normalizeSavingsCategoryName(categoryRaw)
    const actual = asNumber(readNumber(row, ['actual_savings_amount_eur', 'actual_amount_eur', 'actual_amount']))
    const maybeTarget = readNumber(row, ['target_savings_amount_eur', 'target_amount_eur', 'budget_amount_eur'])

    upsert(categoryName, {
      actualSavingsAmountEur: actual,
      ...(maybeTarget != null ? { targetSavingsAmountEur: asNumber(maybeTarget) } : {}),
    })
  }

  for (const categoryName of SAVINGS_CATEGORY_DEFAULTS) {
    if (!map.has(categoryName)) {
      upsert(categoryName, {})
    }
  }

  const defaultOrder = new Map(SAVINGS_CATEGORY_DEFAULTS.map((name, index) => [name, index]))

  return [...map.values()]
    .sort((a, b) => {
      const aRank = defaultOrder.get(a.categoryName) ?? 999
      const bRank = defaultOrder.get(b.categoryName) ?? 999
      if (aRank !== bRank) return aRank - bRank
      return a.categoryName.localeCompare(b.categoryName)
    })
}

export function buildTotalMonthlyNeed(totalExpenseBudget: number, totalSavingsBudget: number): number {
  return asNumber(totalExpenseBudget) + asNumber(totalSavingsBudget)
}

export function buildStatsPeriodOptions(
  monthlyReferences: StatsMonthlyReference[],
): StatsPeriodOption[] {
  if (monthlyReferences.length === 0) return []

  const latestYear = monthlyReferences[0].periodYear
  const months = monthlyReferences
    .filter((row) => row.periodYear === latestYear)
    .sort((a, b) => b.periodMonth - a.periodMonth)

  const monthOptions: StatsPeriodOption[] = months.map((row) => ({
    key: `month-${row.periodYear}-${row.periodMonth}`,
    mode: 'month',
    periodYear: row.periodYear,
    periodMonth: row.periodMonth,
    label: row.label || formatMonthYearLabel(row.periodYear, row.periodMonth),
  }))

  const yearOption: StatsPeriodOption = {
    key: `year-${latestYear}`,
    mode: 'year',
    periodYear: latestYear,
    periodMonth: null,
    label: `Année ${latestYear}`,
  }

  return [...monthOptions, yearOption]
}

export function aggregateBudgetSummary(
  monthlyReferences: StatsMonthlyReference[],
): StatsReferenceSnapshot['budgetSummary'] {
  return monthlyReferences.reduce<StatsReferenceSnapshot['budgetSummary']>((acc, row) => ({
    totalExpenseBudget: acc.totalExpenseBudget + row.budgetSummary.totalExpenseBudget,
    globalVariableBudget: acc.globalVariableBudget + row.budgetSummary.globalVariableBudget,
    socleFixeBudget: acc.socleFixeBudget + row.budgetSummary.socleFixeBudget,
    variableEssentielleBudget: acc.variableEssentielleBudget + row.budgetSummary.variableEssentielleBudget,
    provisionBudget: acc.provisionBudget + row.budgetSummary.provisionBudget,
    discretionnaireBudget: acc.discretionnaireBudget + row.budgetSummary.discretionnaireBudget,
    cagnotteProjetBudget: acc.cagnotteProjetBudget + row.budgetSummary.cagnotteProjetBudget,
  }), {
    totalExpenseBudget: 0,
    globalVariableBudget: 0,
    socleFixeBudget: 0,
    variableEssentielleBudget: 0,
    provisionBudget: 0,
    discretionnaireBudget: 0,
    cagnotteProjetBudget: 0,
  })
}

export function aggregateBudgetBucketVsActual(
  monthlyReferences: StatsMonthlyReference[],
): StatsReferenceSnapshot['budgetBucketVsActual'] {
  const map = new Map<string, StatsReferenceSnapshot['budgetBucketVsActual'][number]>()

  for (const row of monthlyReferences) {
    for (const bucketRow of row.budgetBucketVsActual) {
      const existing = map.get(bucketRow.budgetBucket) ?? {
        budgetBucket: bucketRow.budgetBucket,
        targetBudgetBucketEur: 0,
        actualBudgetBucketEur: 0,
        deltaBudgetBucketEur: 0,
        consumptionRatio: null,
      }

      existing.targetBudgetBucketEur += asNumber(bucketRow.targetBudgetBucketEur)
      existing.actualBudgetBucketEur += asNumber(bucketRow.actualBudgetBucketEur)
      existing.deltaBudgetBucketEur = existing.actualBudgetBucketEur - existing.targetBudgetBucketEur
      existing.consumptionRatio = existing.targetBudgetBucketEur > 0
        ? existing.actualBudgetBucketEur / existing.targetBudgetBucketEur
        : null

      map.set(bucketRow.budgetBucket, existing)
    }
  }

  return BUDGET_BUCKET_CONFIG
    .map((item) => map.get(item.label) ?? {
      budgetBucket: item.label,
      targetBudgetBucketEur: 0,
      actualBudgetBucketEur: 0,
      deltaBudgetBucketEur: 0,
      consumptionRatio: null,
    })
}

export function aggregateSavingsSummary(
  monthlyReferences: StatsMonthlyReference[],
): StatsReferenceSnapshot['savingsSummary'] {
  const totalSavingsBudget = monthlyReferences.reduce((sum, row) => sum + row.savingsSummary.totalSavingsBudget, 0)
  const totalSavingsActual = monthlyReferences.reduce((sum, row) => sum + row.savingsSummary.totalSavingsActual, 0)

  return {
    totalSavingsBudget,
    totalSavingsActual,
    deltaSavings: totalSavingsActual - totalSavingsBudget,
  }
}

export function aggregateSavingsLines(
  monthlyReferences: StatsMonthlyReference[],
): StatsReferenceSnapshot['savingsLines'] {
  const map = new Map<string, StatsReferenceSnapshot['savingsLines'][number]>()

  for (const row of monthlyReferences) {
    for (const line of row.savingsLines) {
      const existing = map.get(line.categoryName) ?? {
        categoryName: line.categoryName,
        targetSavingsAmountEur: 0,
        actualSavingsAmountEur: 0,
        deltaSavingsAmountEur: 0,
      }

      existing.targetSavingsAmountEur += asNumber(line.targetSavingsAmountEur)
      existing.actualSavingsAmountEur += asNumber(line.actualSavingsAmountEur)
      existing.deltaSavingsAmountEur = existing.actualSavingsAmountEur - existing.targetSavingsAmountEur
      map.set(line.categoryName, existing)
    }
  }

  const defaultOrder = new Map(SAVINGS_CATEGORY_DEFAULTS.map((name, index) => [name, index]))
  return [...map.values()].sort((a, b) => {
    const aRank = defaultOrder.get(a.categoryName) ?? 999
    const bRank = defaultOrder.get(b.categoryName) ?? 999
    if (aRank !== bRank) return aRank - bRank
    return a.categoryName.localeCompare(b.categoryName)
  })
}

export function buildMonthlyEvolution2026(rows: MonthlyEvolutionRow[]): StatsReferenceSnapshot['monthlyEvolution2026'] {
  return rows
    .map((row) => ({
      monthStart: row.month_start,
      periodYear: asNumber(row.period_year),
      periodMonth: asNumber(row.period_month),
      variableExpenseTotal: asNumber(row.variable_expense_total),
      fixedExpenseTotal: asNumber(row.fixed_expense_total),
      expenseTotal: asNumber(row.expense_total),
      incomeTotal: asNumber(row.income_total),
      savingsCapacityObserved: asNumber(row.savings_capacity_observed),
    }))
    .sort((a, b) => {
      if (a.periodYear !== b.periodYear) return a.periodYear - b.periodYear
      return a.periodMonth - b.periodMonth
    })
}

export function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asNumber(value))
}

export function formatPeriodLabel(period: StatsSelectedPeriod): string {
  if (period.mode === 'year') return period.label
  if (period.label) return period.label
  return formatMonthYearLabel(period.periodYear, period.periodMonth)
}
