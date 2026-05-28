import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { budgetDb } from '@/lib/supabaseBudget'

export interface RevenuSource2026 {
  id: string
  name: string
  parentName: string | null
  value: number
}

async function fetchRevenueSources2026(userId: string): Promise<RevenuSource2026[]> {
  const { data, error } = await budgetDb
    .from('v_budget_transactions_enriched')
    .select('mapped_category_name,mapped_parent_category_name,pilotage_amount')
    .eq('user_id', userId)
    .eq('mapped_budget_bucket', 'revenu')
    .gt('pilotage_amount', 0)
    .gte('transaction_date', '2026-01-01')

  if (error) throw new Error(`useBudgetRevenueSources2026: ${error.message}`)

  const map = new Map<string, { name: string; parentName: string | null; value: number }>()
  for (const row of data ?? []) {
    const name = (row.mapped_category_name as string | null)?.trim() || 'Autres revenus'
    const amount = Number((row.pilotage_amount as number | null) ?? 0)
    if (!(amount > 0)) continue
    const existing = map.get(name)
    if (!existing) {
      map.set(name, {
        name,
        parentName: (row.mapped_parent_category_name as string | null)?.trim() || null,
        value: amount,
      })
    } else {
      existing.value += amount
    }
  }

  return [...map.values()]
    .sort((a, b) => b.value - a.value)
    .map((s, i) => ({ ...s, id: `${s.name}-${i}` }))
}

export function useBudgetRevenueSources2026() {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null

  const query = useQuery({
    queryKey: ['budget-revenue-sources-2026', userId],
    queryFn: () => fetchRevenueSources2026(userId!),
    enabled: !!userId && !authLoading,
    staleTime: 5 * 60_000,
  })

  return {
    loading: query.isPending || authLoading,
    data: query.data ?? [],
  }
}
