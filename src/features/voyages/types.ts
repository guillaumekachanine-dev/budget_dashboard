export interface Trip {
  id: string
  user_id: string
  name: string
  start_date: string
  end_date: string
  year: number
  emoji: string | null
  notes: string | null
  planned_budget: number | null
  created_at: string
  updated_at: string
}

export interface TripTransaction {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  transaction_date: string
  amount: number
  direction: string
  raw_label: string | null
  normalized_label: string | null
  merchant_name: string | null
  is_recurring: boolean
  notes: string | null
  personal_share_ratio: number | null
  personal_scope: string | null
  manual_trip_id: string | null
  trip_id: string
  trip_name: string
  trip_emoji: string | null
  trip_start: string
  trip_end: string
  trip_year: number
  is_manual: boolean
}

export interface TripCategoryBreakdown {
  categoryId: string
  categoryName: string
  amount: number
  pct: number
  txCount: number
}

export interface TripWithStats {
  trip: Trip
  total: number
  duration: number
  avgPerDay: number
  txCount: number
  transactions: TripTransaction[]
  byCategory: TripCategoryBreakdown[]
  rankByAvgPerDay: number
  hasData: boolean
}

export interface YearlyVoyagesStats {
  year: number
  total: number
  monthlyAvg: number
  tripCount: number
  tripsWithData: number
}

/**
 * Ligne de budget_dashboard.v_trip_match_candidates.
 * Champs numériques (numeric PostgreSQL) : coercés en number dans getMatchCandidates.
 */
export interface MatchCandidateRow {
  manual_expense_id:    string
  trip_id:              string
  user_id:              string
  expense_date:         string     // YYYY-MM-DD
  manual_amount:        number
  manual_label:         string
  manual_category_id:   string | null
  manual_category_name: string | null

  candidate_tx_id:  string
  tx_date:          string     // YYYY-MM-DD
  tx_amount:        number
  tx_label:         string | null
  tx_merchant:      string | null
  tx_category_id:   string | null
  tx_category_name: string | null

  amount_delta_pct: number
  date_delta_days:  number
  category_match:   boolean
  confidence_score: number
}

export type TripExpenseAssignmentMethod = 'explicit' | 'inferred_date_category' | 'manual_pending'

/**
 * Ligne de budget_dashboard.v_trip_expenses_unified.
 * Source unique de vérité : bank (transactions.trip_id) + manual pending.
 * Les manuelles matched sont déjà exclues par la vue.
 */
export interface TripExpenseRow {
  source_type:          'bank' | 'manual'
  source_id:            string
  trip_id:              string
  user_id:              string
  expense_date:         string
  amount:               number
  personal_amount:      number
  personal_share_ratio: number
  category_id:          string | null
  category_name:        string | null
  parent_category_id:   string | null
  parent_category_name: string | null
  label:                string
  notes:                string | null
  manual_expense_id:    string | null
  is_recurring:         boolean
  account_id:           string | null
  assignment_method?:   TripExpenseAssignmentMethod
  imputation_type?:     'personal' | 'joint'
}

/** Agrégat catégorie pour le breakdown dépenses */
export interface TripCategoryBreakdownFull {
  categoryId:         string
  categoryName:       string
  parentCategoryName: string | null
  amount:             number
  pct:                number
  count:              number
}

/** Groupe de candidats pour une dépense manuelle donnée */
export interface MatchGroup {
  manualExpenseId:    string
  tripId:             string
  expenseDate:        string
  manualAmount:       number
  manualLabel:        string
  manualCategoryId:   string | null
  manualCategoryName: string | null
  candidates:         MatchCandidateRow[]
}
