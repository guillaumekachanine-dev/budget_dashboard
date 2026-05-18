export interface Trip {
  id: string
  user_id: string
  name: string
  start_date: string
  end_date: string
  year: number
  emoji: string | null
  notes: string | null
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
