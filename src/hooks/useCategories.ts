import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Category } from '@/lib/types'

async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw error
  return data
}

export function useCategories(flowType?: string) {
  return useQuery({
    queryKey: ['categories', flowType],
    queryFn: async () => {
      const cats = await fetchCategories()
      if (flowType) return cats.filter((c) => c.flow_type === flowType)
      return cats
    },
    staleTime: 60_000,
  })
}
