import { useEffect, useState } from 'react'
import type {
  Annual2025Analysis,
  Annual2025InsightRow,
  AnnualTotalsPayload,
  MonthlyProfilePoint,
  Top5CategoryItem,
} from '@/features/annual-analysis/types'
import { getAnnual2025Insights } from '@/features/annual-analysis/api/getAnnual2025Insights'
import { getAnnual2025YearlyBuckets } from '@/features/annual-analysis/api/getAnnual2025YearlyBuckets'
import { getAnnual2025YearlyParentCategories } from '@/features/annual-analysis/api/getAnnual2025YearlyParentCategories'

function asNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function parseAnnualTotals(insight: Annual2025InsightRow | undefined): AnnualTotalsPayload | null {
  if (!insight) return null
  const p = insight.payload
  if (Array.isArray(p)) return null
  return {
    expense_total_year: asNumber(p.expense_total_year),
    income_total_year: asNumber(p.income_total_year),
    savings_total_year: asNumber(p.savings_total_year),
    net_cashflow_year: asNumber(p.net_cashflow_year),
    avg_monthly_expense: asNumber(p.avg_monthly_expense),
  }
}

function parseMonthlyProfile(insight: Annual2025InsightRow | undefined): MonthlyProfilePoint[] {
  if (!insight) return []
  const rows = insight.payload
  if (!Array.isArray(rows)) return []
  return rows.map((m: unknown) => {
    const item = m as Record<string, unknown>
    return {
      period_month: asNumber(item.period_month),
      month_label: typeof item.month_label === 'string' ? item.month_label : `M${asNumber(item.period_month)}`,
      expense_total: asNumber(item.expense_total),
      income_total: asNumber(item.income_total),
      savings_capacity: asNumber(item.savings_capacity),
      net_cashflow: asNumber(item.net_cashflow),
    }
  })
}

function parseTop5Categories(insight: Annual2025InsightRow | undefined): Top5CategoryItem[] {
  if (!insight) return []
  const rows = insight.payload
  if (!Array.isArray(rows)) return []
  return rows.map((c: unknown) => {
    const item = c as Record<string, unknown>
    return {
      rank: asNumber(item.rank),
      category_name: typeof item.category_name === 'string' ? item.category_name : '',
      parent_category_name: typeof item.parent_category_name === 'string' ? item.parent_category_name : null,
      amount: asNumber(item.amount),
      pct: asNumber(item.pct),
    }
  })
}

const INITIAL_STATE: Annual2025Analysis = {
  loading: true,
  error: null,
  annualTotals: null,
  insightByKey: {},
  yearlyBuckets: [],
  yearlyParentCategories: [],
  monthlyProfile: [],
  top5ParentCategories: [],
  top5LeafCategories: [],
}

export function useAnnual2025Analysis(): Annual2025Analysis {
  const [state, setState] = useState<Annual2025Analysis>(INITIAL_STATE)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const [insights, buckets, parentCategories] = await Promise.all([
          getAnnual2025Insights(),
          getAnnual2025YearlyBuckets(),
          getAnnual2025YearlyParentCategories(),
        ])

        if (cancelled) return

        const insightByKey = Object.fromEntries(insights.map((row) => [row.insight_key, row]))

        setState({
          loading: false,
          error: null,
          annualTotals: parseAnnualTotals(insightByKey['annual_totals']),
          insightByKey,
          yearlyBuckets: buckets,
          yearlyParentCategories: parentCategories,
          monthlyProfile: parseMonthlyProfile(insightByKey['monthly_profile']),
          top5ParentCategories: parseTop5Categories(insightByKey['top5_parent_categories']),
          top5LeafCategories: parseTop5Categories(insightByKey['top5_leaf_categories']),
        })
      } catch (err) {
        if (cancelled) return
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Erreur inconnue lors du chargement',
        }))
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
