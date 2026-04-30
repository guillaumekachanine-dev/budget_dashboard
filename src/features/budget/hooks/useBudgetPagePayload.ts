import { useCallback, useEffect, useRef, useState } from 'react'
import { getBudgetPagePayload } from '@/features/budget/api/getBudgetPagePayload'
import type { BudgetPagePayload } from '@/features/budget/types'

interface UseBudgetPagePayloadParams {
  periodYear: number
  periodMonth: number
  monthsBack?: number
}

interface UseBudgetPagePayloadResult {
  data: BudgetPagePayload | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useBudgetPagePayload({
  periodYear,
  periodMonth,
  monthsBack = 6,
}: UseBudgetPagePayloadParams): UseBudgetPagePayloadResult {
  const mountedRef = useRef(true)
  const runIdRef = useRef(0)

  const [data, setData] = useState<BudgetPagePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(async () => {
    const runId = ++runIdRef.current
    setLoading(true)
    setError(null)

    try {
      const nextData = await getBudgetPagePayload({
        periodYear,
        periodMonth,
        monthsBack,
      })

      if (!mountedRef.current || runId !== runIdRef.current) return

      setData(nextData)
      setLoading(false)
    } catch (loadError) {
      if (!mountedRef.current || runId !== runIdRef.current) return

      const message = loadError instanceof Error
        ? loadError.message
        : 'Impossible de charger le payload Budgets.'

      setError(message)
      setLoading(false)
    }
  }, [monthsBack, periodMonth, periodYear])

  useEffect(() => {
    void load()
  }, [load])

  return {
    data,
    loading,
    error,
    reload: load,
  }
}
