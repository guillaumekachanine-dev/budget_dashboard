import { useQuery } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import { QK, STALE } from '@/lib/queryKeys'

export type SavingsTransferYtdRow = {
  id: string
  transactionDate: string
  label: string
  personalAmount: number
  sourceAccount: string
  destination: string
}

type SavingsTransactionRow = {
  id: string | null
  transaction_date: string | null
  amount: number | null
  personal_share_ratio: number | null
  raw_label: string | null
  normalized_label: string | null
  merchant_name: string | null
  account_id: string | null
  category_id: string | null
}

type AccountNameRow = {
  id: string | null
  name: string | null
}

type CategoryNameRow = {
  id: string | null
  name: string | null
  parent_id: string | null
}

type SavingsTransfersYtdResult = {
  transfers: SavingsTransferYtdRow[]
  totalAmount: number
  count: number
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toDisplayDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return isoDate
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function useSavingsTransfersYtd(userId?: string, year = 2026) {
  return useQuery<SavingsTransfersYtdResult>({
    queryKey: [QK.SAVINGS, 'transfers-ytd', year, userId],
    enabled: Boolean(userId),
    staleTime: STALE.LIVE,
    queryFn: async () => {
      const startDate = `${year}-01-01`
      const endDate = toLocalIsoDate(new Date())

      const { data: txData, error: txError } = await budgetDb
        .from('transactions')
        .select('id,transaction_date,amount,personal_share_ratio,raw_label,normalized_label,merchant_name,account_id,category_id')
        .eq('user_id', userId as string)
        .eq('flow_type', 'savings')
        .eq('is_hidden', false)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: true })

      if (txError) throw txError

      const transactions = (txData ?? []) as SavingsTransactionRow[]
      if (transactions.length === 0) return { transfers: [], totalAmount: 0, count: 0 }

      const accountIds = [...new Set(
        transactions
          .map((row) => row.account_id)
          .filter((id): id is string => Boolean(id)),
      )]
      const categoryIds = [...new Set(
        transactions
          .map((row) => row.category_id)
          .filter((id): id is string => Boolean(id)),
      )]

      const [accountsRes, categoriesRes] = await Promise.all([
        accountIds.length > 0
          ? budgetDb.from('accounts').select('id,name').in('id', accountIds)
          : Promise.resolve({ data: [], error: null }),
        categoryIds.length > 0
          ? budgetDb.from('categories').select('id,name,parent_id').in('id', categoryIds)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (accountsRes.error) throw accountsRes.error
      if (categoriesRes.error) throw categoriesRes.error

      const accountNameById = new Map<string, string>(
        ((accountsRes.data ?? []) as AccountNameRow[])
          .filter((row) => row.id && row.name)
          .map((row) => [row.id as string, row.name as string]),
      )
      const categories = (categoriesRes.data ?? []) as CategoryNameRow[]
      const categoryById = new Map<string, CategoryNameRow>(
        categories.filter((row) => row.id).map((row) => [row.id as string, row]),
      )

      const parentCategoryIds = [...new Set(
        categories
          .map((row) => row.parent_id)
          .filter((id): id is string => Boolean(id)),
      )]
      let parentNameById = new Map<string, string>()
      if (parentCategoryIds.length > 0) {
        const parentRes = await budgetDb.from('categories').select('id,name').in('id', parentCategoryIds)
        if (parentRes.error) throw parentRes.error
        parentNameById = new Map(
          ((parentRes.data ?? []) as AccountNameRow[])
            .filter((row) => row.id && row.name)
            .map((row) => [row.id as string, row.name as string]),
        )
      }

      const transfers: SavingsTransferYtdRow[] = transactions.map((row) => {
        const date = String(row.transaction_date ?? '').slice(0, 10)
        const personalAmount = toNumber(row.amount) * toNumber(row.personal_share_ratio ?? 1)
        const sourceAccount = row.account_id ? (accountNameById.get(row.account_id) ?? '—') : '—'

        const category = row.category_id ? categoryById.get(row.category_id) : null
        const parentName = category?.parent_id ? (parentNameById.get(category.parent_id) ?? null) : null
        const categoryName = category?.name ?? null

        const labelRaw = (row.raw_label ?? '').trim()
        const labelNormalized = (row.normalized_label ?? '').trim()
        const labelMerchant = (row.merchant_name ?? '').trim()
        const label = labelRaw || labelNormalized || labelMerchant || 'Virement épargne'

        const destination = parentName
          ?? categoryName
          ?? labelMerchant
          ?? labelNormalized
          ?? labelRaw
          ?? '—'

        return {
          id: String(row.id ?? `savings-${date}`),
          transactionDate: toDisplayDate(date),
          label,
          personalAmount,
          sourceAccount,
          destination,
        }
      })

      const totalAmount = transfers.reduce((sum, row) => sum + row.personalAmount, 0)
      return { transfers, totalAmount, count: transfers.length }
    },
  })
}

