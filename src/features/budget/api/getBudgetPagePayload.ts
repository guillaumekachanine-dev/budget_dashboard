import { supabase } from '@/lib/supabase'
import { budgetDb } from '@/lib/supabaseBudget'
import type { BudgetPagePayload } from '@/features/budget/types'

interface GetBudgetPagePayloadParams {
  periodYear: number
  periodMonth: number
  monthsBack?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasBudgetPayloadShape(value: unknown): value is BudgetPagePayload {
  if (!isRecord(value)) return false

  const requiredKeys = [
    'selected_period',
    'summary',
    'by_bucket',
    'by_parent_category',
    'by_category',
    'history_last_6m',
  ]

  return requiredKeys.every((key) => key in value)
}

function unwrapRpcPayload(data: unknown): BudgetPagePayload | null {
  if (hasBudgetPayloadShape(data)) return data

  if (Array.isArray(data) && data.length > 0) {
    const firstRow = data[0]
    if (hasBudgetPayloadShape(firstRow)) return firstRow
    if (isRecord(firstRow) && hasBudgetPayloadShape(firstRow.get_budget_page_payload)) {
      return firstRow.get_budget_page_payload
    }
  }

  if (isRecord(data) && hasBudgetPayloadShape(data.get_budget_page_payload)) {
    return data.get_budget_page_payload
  }

  return null
}

export async function getBudgetPagePayload({
  periodYear,
  periodMonth,
  monthsBack = 6,
}: GetBudgetPagePayloadParams): Promise<BudgetPagePayload> {
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError) {
    throw new Error(`getBudgetPagePayload failed (auth): ${userError.message}`)
  }

  const userId = userData.user?.id
  if (!userId) {
    throw new Error('getBudgetPagePayload failed: user not authenticated')
  }

  const { data, error } = await budgetDb().rpc('get_budget_page_payload', {
    p_user_id: userId,
    p_period_year: periodYear,
    p_period_month: periodMonth,
    p_months_back: monthsBack,
  })

  if (error) {
    throw new Error(`getBudgetPagePayload failed (rpc): ${error.message}`)
  }

  const payload = unwrapRpcPayload(data)
  if (!payload) {
    throw new Error('getBudgetPagePayload failed: invalid RPC payload')
  }

  return payload
}
