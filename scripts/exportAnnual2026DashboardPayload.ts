// @ts-nocheck
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ANALYSIS_YEAR = 2026
const SCHEMA = 'budget_dashboard'
const REQUESTED_OUTPUT_PATH = '/mnt/data/annual_2026_dashboard_payload.live.json'

function asNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function asInt(value) {
  const n = Number(value)
  return Number.isInteger(n) ? n : null
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function byPeriodAsc(a, b) {
  if (a.period_year !== b.period_year) return a.period_year - b.period_year
  return a.period_month - b.period_month
}

function sum(values) {
  return values.reduce((acc, v) => acc + (asNumber(v) ?? 0), 0)
}

async function fetchAll(db, table, options = {}) {
  const { select = '*', filters = [], order = [], pageSize = 1000 } = options
  const rows = []
  let from = 0

  while (true) {
    let q = db.from(table).select(select).range(from, from + pageSize - 1)
    for (const f of filters) {
      if (f.op === 'eq') q = q.eq(f.col, f.val)
      if (f.op === 'gte') q = q.gte(f.col, f.val)
      if (f.op === 'lte') q = q.lte(f.col, f.val)
      if (f.op === 'in') q = q.in(f.col, f.val)
    }
    for (const o of order) q = q.order(o.col, { ascending: o.ascending ?? true })

    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }

  return rows
}

async function tryFetchAll(db, table, options = {}, missingSections, sectionLabel) {
  try {
    return await fetchAll(db, table, options)
  } catch {
    if (sectionLabel) missingSections.add(sectionLabel)
    return []
  }
}

function buildOutputPath() {
  return path.resolve(process.cwd(), 'mnt', 'data', 'annual_2026_dashboard_payload.live.json')
}

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase env credentials')

  const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const db = supabase.schema(SCHEMA)

  const missing = new Set()

  const budgetPeriods = await fetchAll(db, 'budget_periods', {
    select: 'id, user_id, period_year, period_month, label',
    filters: [{ op: 'eq', col: 'period_year', val: ANALYSIS_YEAR }],
    order: [{ col: 'period_month', ascending: true }],
  })

  const userCounts = new Map()
  for (const row of budgetPeriods) {
    if (!row.user_id) continue
    userCounts.set(row.user_id, (userCounts.get(row.user_id) ?? 0) + 1)
  }
  const primaryUserId = userCounts.size
    ? [...userCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    : null

  const periods2026 = budgetPeriods
    .filter((p) => !primaryUserId || p.user_id === primaryUserId)
    .map((p) => ({
      id: p.id,
      period_year: asInt(p.period_year),
      period_month: asInt(p.period_month),
      label: p.label ?? null,
    }))
    .filter((p) => p.period_year === ANALYSIS_YEAR && p.period_month && p.period_month >= 1 && p.period_month <= 12)
    .sort(byPeriodAsc)

  const periodIdByKey = new Map(periods2026.map((p) => [monthKey(p.period_year, p.period_month), p.id]))
  const periodLabelByKey = new Map(periods2026.map((p) => [monthKey(p.period_year, p.period_month), p.label]))

  const budgets = await fetchAll(db, 'budgets', {
    select: 'id, user_id, period_id, category_id, budget_kind, amount, currency, notes',
    order: [{ col: 'period_id', ascending: true }],
  })
  const categories = await fetchAll(db, 'categories', {
    select: 'id, user_id, name, parent_id, flow_type, budget_behavior',
  })
  const transactions = await fetchAll(db, 'transactions', {
    select: 'id, user_id, transaction_date, category_id, amount, flow_type, direction, budget_behavior, personal_share_ratio',
    filters: [{ op: 'gte', col: 'transaction_date', val: '2026-01-01' }, { op: 'lte', col: 'transaction_date', val: '2026-12-31' }],
    order: [{ col: 'transaction_date', ascending: true }],
  })

  const categoriesScoped = categories.filter((c) => !primaryUserId || c.user_id === primaryUserId)
  const categoryById = new Map(categoriesScoped.map((c) => [c.id, c]))

  const budgetsScoped = budgets.filter((b) => !primaryUserId || b.user_id === primaryUserId)
  const transactionsScoped = transactions.filter((t) => !primaryUserId || t.user_id === primaryUserId)

  const budgetByMonth = new Map()
  const budgetLineCountByPeriodId = new Map()
  for (const p of periods2026) {
    budgetByMonth.set(monthKey(p.period_year, p.period_month), {
      period_year: p.period_year,
      period_month: p.period_month,
      label: p.label,
      period_id: p.id,
      total_budget_monthly: 0,
      global_variable_budget: 0,
      category_budget_total: 0,
      buckets: [],
    })
  }

  for (const b of budgetsScoped) {
    const amount = asNumber(b.amount)
    if (amount == null) continue
    const period = periods2026.find((p) => p.id === b.period_id)
    if (!period) continue
    const key = monthKey(period.period_year, period.period_month)
    const row = budgetByMonth.get(key)
    if (!row) continue

    row.total_budget_monthly += amount
    if (b.budget_kind === 'global_variable') row.global_variable_budget += amount
    if (b.budget_kind === 'category') {
      row.category_budget_total += amount
      budgetLineCountByPeriodId.set(b.period_id, (budgetLineCountByPeriodId.get(b.period_id) ?? 0) + 1)
    }
  }

  const budgetMonthlySeries = [...budgetByMonth.values()].sort(byPeriodAsc)

  const availableMonths = [...new Set(budgetMonthlySeries.map((r) => r.period_month))].sort((a, b) => a - b)
  const getBudgetLinesForPeriodId = (periodId) => budgetsScoped
    .filter((b) => b.period_id === periodId && b.budget_kind === 'category')
    .map((b) => {
    const cat = b.category_id ? categoryById.get(b.category_id) : null
    const parent = cat?.parent_id ? categoryById.get(cat.parent_id) : null
    return {
      id: b.id,
      period_id: b.period_id,
      category_id: b.category_id,
      category_name: cat?.name ?? null,
      parent_category_id: cat?.parent_id ?? null,
      parent_category_name: parent?.name ?? null,
      flow_type: cat?.flow_type ?? null,
      budget_behavior: cat?.budget_behavior ?? null,
      budget_kind: b.budget_kind,
      amount: asNumber(b.amount) ?? 0,
      currency: b.currency ?? 'EUR',
      notes: b.notes ?? null,
    }
  })

  const txByMonth = new Map()
  for (const tx of transactionsScoped) {
    const d = new Date(`${tx.transaction_date}T00:00:00`)
    if (Number.isNaN(d.getTime())) continue
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    if (y !== ANALYSIS_YEAR) continue
    const key = monthKey(y, m)
    const arr = txByMonth.get(key) ?? []
    arr.push(tx)
    txByMonth.set(key, arr)
  }

  const actualsMonthlySeries = []
  const txCountByPeriodKey = new Map()
  for (const period of periods2026) {
    const key = monthKey(period.period_year, period.period_month)
    const txs = txByMonth.get(key) ?? []
    txCountByPeriodKey.set(key, txs.length)

    const expenseTx = txs.filter((t) => t.flow_type === 'expense')
    const incomeTx = txs.filter((t) => t.flow_type === 'income')
    const savingsTx = txs.filter((t) => t.flow_type === 'savings')

    const variableExpense = sum(expenseTx.filter((t) => t.budget_behavior === 'variable').map((t) => t.amount))
    const fixedExpense = sum(expenseTx.filter((t) => t.budget_behavior === 'fixed').map((t) => t.amount))
    const expenseTotal = sum(expenseTx.map((t) => t.amount))
    const incomeTotal = sum(incomeTx.map((t) => t.amount))
    const savingsTotal = sum(savingsTx.map((t) => t.amount))

    actualsMonthlySeries.push({
      month_start: `${period.period_year}-${String(period.period_month).padStart(2, '0')}-01`,
      period_year: period.period_year,
      period_month: period.period_month,
      variable_expense_total: variableExpense,
      fixed_expense_total: fixedExpense,
      expense_total: expenseTotal,
      income_total: incomeTotal,
      savings_total: savingsTotal,
      net_cashflow: incomeTotal - expenseTotal - savingsTotal,
      savings_capacity_observed: incomeTotal - expenseTotal,
      transaction_count: txs.length,
    })
  }

  const latestAvailablePeriod = (() => {
    const sorted = [...periods2026].sort(byPeriodAsc)
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      const p = sorted[i]
      const key = monthKey(p.period_year, p.period_month)
      const periodBudget = budgetMonthlySeries.find((r) => monthKey(r.period_year, r.period_month) === key)
      const periodActual = actualsMonthlySeries.find((r) => monthKey(r.period_year, r.period_month) === key)
      const lineCount = budgetLineCountByPeriodId.get(p.id) ?? 0
      const isExploitable =
        (periodBudget?.total_budget_monthly ?? 0) > 0 ||
        lineCount > 0 ||
        (txCountByPeriodKey.get(key) ?? 0) > 0 ||
        (periodActual?.income_total ?? 0) > 0 ||
        (periodActual?.expense_total ?? 0) > 0 ||
        (periodActual?.savings_total ?? 0) > 0
      if (isExploitable) return { period_year: p.period_year, period_month: p.period_month }
    }
    if (!sorted.length) return null
    return { period_year: sorted[sorted.length - 1].period_year, period_month: sorted[sorted.length - 1].period_month }
  })()
  const latestAvailableMonth = latestAvailablePeriod?.period_month ?? null
  const currentPeriodKey = latestAvailablePeriod ? monthKey(latestAvailablePeriod.period_year, latestAvailablePeriod.period_month) : null
  const currentPeriodId = currentPeriodKey ? periodIdByKey.get(currentPeriodKey) ?? null : null
  const budgetLinesCurrentMonth = currentPeriodId ? getBudgetLinesForPeriodId(currentPeriodId) : []

  const savingsBudgetVsActualByMonth = periods2026.map((period) => {
    const key = monthKey(period.period_year, period.period_month)
    const periodId = periodIdByKey.get(key)
    const savingsBudgetRows = budgetsScoped.filter((b) => {
      if (b.period_id !== periodId) return false
      if (b.budget_kind !== 'category') return false
      const cat = b.category_id ? categoryById.get(b.category_id) : null
      return cat?.flow_type === 'savings'
    })

    const target = sum(savingsBudgetRows.map((r) => r.amount))
    const actual = sum((txByMonth.get(key) ?? []).filter((t) => t.flow_type === 'savings').map((t) => t.amount))

    return {
      period_year: period.period_year,
      period_month: period.period_month,
      target_savings_amount_eur: target,
      actual_savings_amount_eur: actual,
      delta_savings_amount_eur: actual - target,
    }
  })

  const savingsLinesCurrentMonth = (() => {
    if (!currentPeriodId || !currentPeriodKey) return []
    const txMonth = txByMonth.get(currentPeriodKey) ?? []
    const actualByCategory = new Map()
    for (const tx of txMonth.filter((t) => t.flow_type === 'savings')) {
      const key = tx.category_id ?? '__none__'
      actualByCategory.set(key, (actualByCategory.get(key) ?? 0) + (asNumber(tx.amount) ?? 0))
    }

    const savingsBudgetRows = budgetsScoped.filter((b) => {
      if (b.period_id !== currentPeriodId) return false
      if (b.budget_kind !== 'category') return false
      const cat = b.category_id ? categoryById.get(b.category_id) : null
      return cat?.flow_type === 'savings'
    })

    return savingsBudgetRows.map((b) => {
      const cat = b.category_id ? categoryById.get(b.category_id) : null
      const actual = actualByCategory.get(b.category_id ?? '__none__') ?? 0
      const target = asNumber(b.amount) ?? 0
      return {
        category_id: b.category_id,
        category_name: cat?.name ?? null,
        target_savings_amount_eur: target,
        actual_savings_amount_eur: actual,
        delta_savings_amount_eur: actual - target,
      }
    }).sort((a, b) => b.target_savings_amount_eur - a.target_savings_amount_eur)
  })()

  const topCategoriesActualByMonth = periods2026.map((period) => {
    const key = monthKey(period.period_year, period.period_month)
    const txs = (txByMonth.get(key) ?? []).filter((t) => t.flow_type === 'expense')
    const catAgg = new Map()

    for (const tx of txs) {
      const cat = tx.category_id ? categoryById.get(tx.category_id) : null
      const parent = cat?.parent_id ? categoryById.get(cat.parent_id) : null
      const k = tx.category_id ?? '__none__'
      const row = catAgg.get(k) ?? {
        category_id: tx.category_id ?? null,
        category_name: cat?.name ?? null,
        parent_category_id: cat?.parent_id ?? null,
        parent_category_name: parent?.name ?? null,
        amount_total: 0,
      }
      row.amount_total += asNumber(tx.amount) ?? 0
      catAgg.set(k, row)
    }

    return {
      period_year: period.period_year,
      period_month: period.period_month,
      top_categories: [...catAgg.values()].sort((a, b) => b.amount_total - a.amount_total).slice(0, 10),
    }
  })

  const currentBudgetMonth = currentPeriodKey
    ? budgetMonthlySeries.find((r) => monthKey(r.period_year, r.period_month) === currentPeriodKey)
    : null

  const currentSavingsMonth = currentPeriodKey
    ? savingsBudgetVsActualByMonth.find((r) => monthKey(r.period_year, r.period_month) === currentPeriodKey)
    : null

  const currentReferenceMonth = {
    period_year: latestAvailablePeriod?.period_year ?? null,
    period_month: latestAvailablePeriod?.period_month ?? null,
    label: currentPeriodKey ? (periodLabelByKey.get(currentPeriodKey) ?? null) : null,
    expense_budget_total: currentBudgetMonth?.total_budget_monthly ?? null,
    savings_target_total: currentSavingsMonth?.target_savings_amount_eur ?? null,
    total_monthly_need:
      currentBudgetMonth || currentSavingsMonth
        ? (currentBudgetMonth?.total_budget_monthly ?? 0) + (currentSavingsMonth?.target_savings_amount_eur ?? 0)
        : null,
  }

  const parentTotals = new Map()
  for (const line of budgetLinesCurrentMonth) {
    const key = `${line.parent_category_id ?? 'none'}::${line.parent_category_name ?? 'Sans parent'}`
    const row = parentTotals.get(key) ?? {
      parent_category_id: line.parent_category_id,
      parent_category_name: line.parent_category_name,
      total_budget_amount: 0,
      line_count: 0,
    }
    row.total_budget_amount += line.amount
    row.line_count += 1
    parentTotals.set(key, row)
  }
  const budgetParentCategoryTotalsCurrentMonth = [...parentTotals.values()].sort((a, b) => b.total_budget_amount - a.total_budget_amount)

  const highestBudgetLineCurrentMonth = budgetLinesCurrentMonth.length
    ? (() => {
        const top = [...budgetLinesCurrentMonth].sort((a, b) => b.amount - a.amount)[0]
        return {
          label: top.category_name ?? 'N/A',
          value: top.amount,
          extra: {
            category_id: top.category_id,
            parent_category_name: top.parent_category_name,
            budget_behavior: top.budget_behavior,
          },
        }
      })()
    : null

  const dominantParentCategoryBudgetCurrentMonth = budgetParentCategoryTotalsCurrentMonth.length
    ? {
        label: budgetParentCategoryTotalsCurrentMonth[0].parent_category_name ?? 'Sans parent',
        value: budgetParentCategoryTotalsCurrentMonth[0].total_budget_amount,
        extra: {
          parent_category_id: budgetParentCategoryTotalsCurrentMonth[0].parent_category_id,
          line_count: budgetParentCategoryTotalsCurrentMonth[0].line_count,
        },
      }
    : null

  const highestActualMonth = actualsMonthlySeries.length
    ? (() => {
        const row = [...actualsMonthlySeries].sort((a, b) => b.expense_total - a.expense_total)[0]
        return {
          label: `${row.period_year}-${String(row.period_month).padStart(2, '0')}`,
          value: row.expense_total,
          extra: { income_total: row.income_total, net_cashflow: row.net_cashflow },
        }
      })()
    : null

  const lowestActualMonth = actualsMonthlySeries.length
    ? (() => {
        const row = [...actualsMonthlySeries].sort((a, b) => a.expense_total - b.expense_total)[0]
        return {
          label: `${row.period_year}-${String(row.period_month).padStart(2, '0')}`,
          value: row.expense_total,
          extra: { income_total: row.income_total, net_cashflow: row.net_cashflow },
        }
      })()
    : null

  const bucketBudgetVsActualByMonth = await tryFetchAll(
    db,
    'budget_bucket_budget_vs_actual_by_month',
    {
      select: '*',
      filters: [{ op: 'eq', col: 'period_year', val: ANALYSIS_YEAR }],
      order: [{ col: 'period_month', ascending: true }],
    },
    missing,
    'bucket_budget_vs_actual_by_month',
  )

  if (!budgetMonthlySeries.length) missing.add('budget_monthly_series')
  if (!budgetLinesCurrentMonth.length) missing.add('budget_lines_current_month')
  if (!budgetParentCategoryTotalsCurrentMonth.length) missing.add('budget_parent_category_totals_current_month')
  if (!actualsMonthlySeries.length) missing.add('actuals_monthly_series')
  if (!topCategoriesActualByMonth.length) missing.add('top_categories_actual_by_month')
  if (!savingsLinesCurrentMonth.length) missing.add('savings_budget.lines_current_month')
  if (!savingsBudgetVsActualByMonth.length) missing.add('savings_budget_vs_actual_by_month')

  const payload = {
    meta: {
      analysis_year: ANALYSIS_YEAR,
      currency: 'EUR',
      generated_at: new Date().toISOString(),
      source: 'supabase_live',
      ratio_fields_are_unit_ratios: true,
    },
    periods: {
      available_months: availableMonths,
      latest_available_month: latestAvailableMonth,
      latest_available_period: latestAvailablePeriod,
    },
    current_reference_month: currentReferenceMonth,
    budget_monthly_series: budgetMonthlySeries,
    budget_lines_current_month: budgetLinesCurrentMonth,
    budget_parent_category_totals_current_month: budgetParentCategoryTotalsCurrentMonth,
    savings_budget: {
      monthly_target_total: currentSavingsMonth?.target_savings_amount_eur ?? null,
      lines_current_month: savingsLinesCurrentMonth,
    },
    actuals_monthly_series: actualsMonthlySeries,
    bucket_budget_vs_actual_by_month: bucketBudgetVsActualByMonth,
    savings_budget_vs_actual_by_month: savingsBudgetVsActualByMonth,
    top_categories_actual_by_month: topCategoriesActualByMonth,
    insights: {
      dominant_budget_bucket_current_month: null,
      dominant_parent_category_budget_current_month: dominantParentCategoryBudgetCurrentMonth,
      highest_budget_line_current_month: highestBudgetLineCurrentMonth,
      highest_actual_month: highestActualMonth,
      lowest_actual_month: lowestActualMonth,
      quality_flags: [
        ...(!bucketBudgetVsActualByMonth.length ? ['bucket_views_not_accessible_or_empty'] : []),
      ],
    },
    data_quality: {
      actuals_available: actualsMonthlySeries.length > 0,
      actuals_month_count: actualsMonthlySeries.length,
      budget_month_count: budgetMonthlySeries.length,
      missing_sections: [...missing].sort(),
    },
  }

  let outputPath = REQUESTED_OUTPUT_PATH
  try {
    await mkdir('/mnt/data', { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  } catch {
    outputPath = buildOutputPath()
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  }

  console.log(JSON.stringify({
    requested_output_path: REQUESTED_OUTPUT_PATH,
    output_path: outputPath,
    user_id_scope: primaryUserId,
    budget_month_count: payload.data_quality.budget_month_count,
    actuals_month_count: payload.data_quality.actuals_month_count,
    missing_sections: payload.data_quality.missing_sections,
  }, null, 2))
}

main().catch((error) => {
  console.error('[exportAnnual2026DashboardPayload] failed:', error)
  process.exitCode = 1
})
