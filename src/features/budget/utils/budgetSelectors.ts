import type {
  BudgetActualCategoryMetric,
  BudgetLineWithCategory,
  BudgetParentGroup,
  BudgetSummary,
  BudgetVsActualRow,
  GlobalVariableBudgetLine,
} from '@/features/budget/types'

const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function normalizeBucket(value: string | null): string {
  if (!value) return ''

  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_')
}

export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return currencyFormatter.format(0)
  return currencyFormatter.format(value)
}

export function formatPeriodLabel(periodYear: number, periodMonth: number, label?: string | null): string {
  if (label && label.trim()) return label

  const date = new Date(periodYear, Math.max(0, periodMonth - 1), 1)
  return monthFormatter.format(date)
}

export function computeBudgetConsumptionRatio(budgetAmount: number, actualAmount: number): number {
  if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) {
    return actualAmount > 0 ? 1 : 0
  }

  return Math.max(0, actualAmount / budgetAmount)
}

export function buildBudgetSummary(
  categoryLines: BudgetLineWithCategory[],
  globalVariableLine: GlobalVariableBudgetLine | null,
): BudgetSummary {
  const summary = {
    totalBudgetMonthly: 0,
    globalVariableBudget: globalVariableLine?.amount ?? 0,
    socleFixeBudget: 0,
    variableEssentielleBudget: 0,
    provisionBudget: 0,
    discretionnaireBudget: 0,
    cagnotteProjetBudget: 0,
    horsPilotageBudget: 0,
  } satisfies BudgetSummary

  for (const line of categoryLines) {
    const amount = Number(line.amount ?? 0)
    const bucket = normalizeBucket(line.budget_bucket)

    summary.totalBudgetMonthly += amount

    if (bucket === 'socle_fixe') {
      summary.socleFixeBudget += amount
      continue
    }

    if (bucket === 'variable_essentielle') {
      summary.variableEssentielleBudget += amount
      continue
    }

    if (bucket === 'provision') {
      summary.provisionBudget += amount
      continue
    }

    if (bucket === 'discretionnaire') {
      summary.discretionnaireBudget += amount
      continue
    }

    if (bucket === 'cagnotte_projet') {
      summary.cagnotteProjetBudget += amount
      continue
    }

    if (bucket === 'hors_pilotage') {
      summary.horsPilotageBudget += amount
    }
  }

  return summary
}

export function sortBudgetLinesForDisplay(lines: BudgetLineWithCategory[]): BudgetLineWithCategory[] {
  return [...lines].sort((a, b) => {
    const parentNameA = a.parent_category_name ?? a.category_name ?? ''
    const parentNameB = b.parent_category_name ?? b.category_name ?? ''

    if (parentNameA !== parentNameB) return parentNameA.localeCompare(parentNameB, 'fr')

    const byAmount = Number(b.amount ?? 0) - Number(a.amount ?? 0)
    if (byAmount !== 0) return byAmount

    return (a.category_name ?? '').localeCompare(b.category_name ?? '', 'fr')
  })
}

export function groupBudgetLinesByParent(lines: BudgetLineWithCategory[]): BudgetParentGroup[] {
  const map = new Map<string, BudgetParentGroup>()

  for (const line of sortBudgetLinesForDisplay(lines)) {
    const fallbackId = line.category_id ?? line.id
    const parentId = line.parent_category_id ?? `self:${fallbackId}`
    const parentName = line.parent_category_name ?? line.category_name ?? 'Autres'

    const existing = map.get(parentId)

    if (existing) {
      existing.totalAmount += Number(line.amount ?? 0)
      existing.lines.push(line)
      continue
    }

    map.set(parentId, {
      parentCategoryId: parentId,
      parentCategoryName: parentName,
      totalAmount: Number(line.amount ?? 0),
      lines: [line],
    })
  }

  return [...map.values()].sort((a, b) => b.totalAmount - a.totalAmount)
}

export function buildBudgetVsActualByCategory(
  categoryLines: BudgetLineWithCategory[],
  actualCategoryMetrics: BudgetActualCategoryMetric[],
): BudgetVsActualRow[] {
  const actualByCategoryId = new Map<string, number>()

  for (const metric of actualCategoryMetrics) {
    if (!metric.category_id) continue
    actualByCategoryId.set(metric.category_id, (actualByCategoryId.get(metric.category_id) ?? 0) + Number(metric.amount_total ?? 0))
  }

  return sortBudgetLinesForDisplay(categoryLines).map((line) => {
    const actualAmount = line.category_id ? actualByCategoryId.get(line.category_id) ?? 0 : 0
    const budgetAmount = Number(line.amount ?? 0)

    return {
      id: line.id,
      name: line.category_name ?? 'Catégorie',
      budgetAmount,
      actualAmount,
      varianceAmount: budgetAmount - actualAmount,
      consumptionRatio: computeBudgetConsumptionRatio(budgetAmount, actualAmount),
    }
  })
}

export function buildBudgetVsActualByParent(
  categoryLines: BudgetLineWithCategory[],
  actualCategoryMetrics: BudgetActualCategoryMetric[],
): BudgetVsActualRow[] {
  const byParent = new Map<string, { name: string; budgetAmount: number; actualAmount: number }>()

  for (const line of categoryLines) {
    const fallbackId = line.category_id ?? line.id
    const parentId = line.parent_category_id ?? `self:${fallbackId}`
    const parentName = line.parent_category_name ?? line.category_name ?? 'Autres'
    const entry = byParent.get(parentId) ?? { name: parentName, budgetAmount: 0, actualAmount: 0 }
    entry.budgetAmount += Number(line.amount ?? 0)
    byParent.set(parentId, entry)
  }

  for (const metric of actualCategoryMetrics) {
    const fallbackId = metric.category_id ?? metric.category_name ?? 'unknown'
    const parentId = metric.parent_category_id ?? `self:${fallbackId}`
    const parentName = metric.parent_category_name ?? metric.category_name ?? 'Autres'
    const entry = byParent.get(parentId) ?? { name: parentName, budgetAmount: 0, actualAmount: 0 }
    entry.actualAmount += Number(metric.amount_total ?? 0)
    byParent.set(parentId, entry)
  }

  return [...byParent.entries()]
    .map(([id, entry]) => ({
      id,
      name: entry.name,
      budgetAmount: entry.budgetAmount,
      actualAmount: entry.actualAmount,
      varianceAmount: entry.budgetAmount - entry.actualAmount,
      consumptionRatio: computeBudgetConsumptionRatio(entry.budgetAmount, entry.actualAmount),
    }))
    .sort((a, b) => b.budgetAmount - a.budgetAmount)
}
