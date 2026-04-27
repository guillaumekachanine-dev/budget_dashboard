import { supabaseBudget } from '@/lib/supabaseBudget'

export async function refreshBudgetAnalytics(userId: string): Promise<void> {
  const { error } = await supabaseBudget.rpc('refresh_budget_analytics', {
    p_user_id: userId,
  })

  if (error) {
    throw new Error(`refresh_budget_analytics failed: ${error.message}`)
  }
}
