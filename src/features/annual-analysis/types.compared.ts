// ─── Types — Analyse comparée 2025 vs 2026 (Jan-Avr) ─────────────────────────

export const COMPARED_MONTHS = [1, 2, 3, 4] as const
export const COMPARED_YEARS  = [2025, 2026] as const
export type  ComparedYear    = 2025 | 2026

// ── Flux globaux ──────────────────────────────────────────────────────────────

export interface YtdFlowRow {
  period_year:              number
  period_month:             number
  expense_total:            number
  income_total:             number
  fixed_expense_total:      number
  variable_expense_total:   number
  savings_capacity_observed: number
}

/** Totaux YTD agrégés pour une année */
export interface YtdFlowSummary {
  year:                   ComparedYear
  expense_total:          number
  income_total:           number
  fixed_expense_total:    number
  variable_expense_total: number
  savings_total:          number
  net_cashflow:           number
  months:                 YtdFlowRow[]
}

// ── Buckets ───────────────────────────────────────────────────────────────────

export interface YtdBucketRow {
  period_year:             number
  period_month:            number
  budget_bucket:           string
  target_budget_bucket_eur: number
  actual_budget_bucket_eur: number
  delta_budget_bucket_eur:  number
  consumption_ratio:        number
}

/** Agrégat YTD par bucket pour une année */
export interface YtdBucketSummary {
  bucket:           string
  year:             ComparedYear
  target:           number
  actual:           number
  delta:            number
  consumption_ratio: number   // actual / target × mois
}

// ── Catégories ────────────────────────────────────────────────────────────────

export interface YtdCategoryRow {
  period_year:          number
  period_month:         number
  category_name:        string
  parent_category_name: string | null
  flow_type:            string
  budget_behavior:      string
  amount_total:         number
}

/** Agrégat YTD par catégorie parente pour une année */
export interface YtdCategorySummary {
  parent_category_name: string
  year:                 ComparedYear
  total:                number
  tx_count?:            number
}

// ── Métriques comparées dérivées ──────────────────────────────────────────────

export interface ComparedCategoryMetric {
  parent_category_name: string
  total_2025:           number
  total_2026:           number
  delta_eur:            number
  delta_pct:            number | null   // null si 2025 = 0
}

export interface ComparedBucketMetric {
  bucket:               string
  actual_2025:          number
  actual_2026:          number
  target_2026:          number
  delta_eur:            number           // 2026 - 2025
  delta_pct:            number | null
  consumption_ratio_2026: number
}

export interface ComparedFluxMetric {
  label:       string
  value_2025:  number
  value_2026:  number
  delta_eur:   number
  delta_pct:   number | null
  positive_is: 'up' | 'down'            // revenus = up positif / dépenses = down positif
}

// ── État du hook ──────────────────────────────────────────────────────────────

export interface ComparedAnalysis {
  loading:              boolean
  error:                string | null

  // Raw rows
  flowRows:             YtdFlowRow[]
  bucketRows:           YtdBucketRow[]
  categoryRows:         YtdCategoryRow[]

  // Agrégats YTD par année
  flows2025:            YtdFlowSummary | null
  flows2026:            YtdFlowSummary | null

  // Métriques comparées
  fluxMetrics:          ComparedFluxMetric[]
  categoryMetrics:      ComparedCategoryMetric[]
  bucketMetrics:        ComparedBucketMetric[]

  // Projection fin d'année (YTD + médiane × mois restants)
  projectedExpense2025:  number | null
  projectedExpense2026:  number | null
  medianMonthly2025:     number | null
  medianMonthly2026:     number | null
  remainingMonths:       number          // 12 - nbMonths dans la fenêtre comparée
}
