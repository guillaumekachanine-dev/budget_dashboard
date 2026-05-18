import { useQuery } from '@tanstack/react-query'
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
      savings_capacity: asNumber(item.savings_capacity ?? item.savings_total),
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
      rank: asNumber(item.rank ?? item.rank_in_year),
      category_name: typeof item.category_name === 'string' ? item.category_name : '',
      parent_category_name: typeof item.parent_category_name === 'string' ? item.parent_category_name : null,
      amount: asNumber(item.amount ?? item.amount_total_year),
      pct: asNumber(item.pct ?? item.share_of_year_expense_pct),
    }
  })
}

type Annual2025Data = Omit<Annual2025Analysis, 'loading' | 'error'>

async function fetchAnnual2025Analysis(): Promise<Annual2025Data> {
  const [insights, buckets, parentCategories] = await Promise.all([
    getAnnual2025Insights(),
    getAnnual2025YearlyBuckets(),
    getAnnual2025YearlyParentCategories(),
  ])

  const insightByKey = Object.fromEntries(insights.map((row) => [row.insight_key, row]))

  return {
    annualTotals: parseAnnualTotals(insightByKey['annual_totals']),
    insightByKey,
    yearlyBuckets: buckets,
    yearlyParentCategories: parentCategories,
    monthlyProfile: parseMonthlyProfile(insightByKey['monthly_profile']),
    top5ParentCategories: parseTop5Categories(insightByKey['top5_parent_categories']),
    top5LeafCategories: parseTop5Categories(insightByKey['top5_leaf_categories']),
  }
}

export function useAnnual2025Analysis(): Annual2025Analysis {
  const query = useQuery({
    queryKey: ['annual-2025-analysis'],
    queryFn: fetchAnnual2025Analysis,
    staleTime: 15 * 60_000,
  })

  return {
    loading: query.isPending,
    error: query.error?.message ?? null,
    annualTotals: query.data?.annualTotals ?? null,
    insightByKey: query.data?.insightByKey ?? {},
    yearlyBuckets: query.data?.yearlyBuckets ?? [],
    yearlyParentCategories: query.data?.yearlyParentCategories ?? [],
    monthlyProfile: query.data?.monthlyProfile ?? [],
    top5ParentCategories: query.data?.top5ParentCategories ?? [],
    top5LeafCategories: query.data?.top5LeafCategories ?? [],
  }
}
