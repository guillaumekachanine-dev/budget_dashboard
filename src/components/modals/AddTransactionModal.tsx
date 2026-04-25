import { useState, useEffect, FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useAddTransaction } from '@/hooks/useTransactions'
import { useAuth } from '@/hooks/useAuth'
import type { Direction, FlowType, BudgetBehavior } from '@/lib/types'

interface AddTransactionModalProps {
  open: boolean
  onClose: () => void
}

type Tab = 'expense' | 'income' | 'savings'

const TABS: { key: Tab; label: string }[] = [
  { key: 'expense', label: 'Dépense' },
  { key: 'income', label: 'Revenu' },
  { key: 'savings', label: 'Épargne' },
]

const tabToDirection: Record<Tab, Direction> = {
  expense: 'expense',
  income: 'income',
  savings: 'savings',
}
const tabToFlowType: Record<Tab, FlowType> = {
  expense: 'expense',
  income: 'income',
  savings: 'savings',
}
const tabToBudgetBehavior: Record<Tab, BudgetBehavior> = {
  expense: 'variable',
  income: 'excluded',
  savings: 'excluded',
}

export function AddTransactionModal({ open, onClose }: AddTransactionModalProps) {
  const { user } = useAuth()
  const { data: accounts } = useAccounts()
  const { mutateAsync: addTransaction, isPending } = useAddTransaction()

  const [tab, setTab] = useState<Tab>('expense')
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)

  const { data: categories } = useCategories(tab)

  useEffect(() => {
    if (accounts?.length && !accountId) {
      const checking = accounts.find((a) => a.account_type === 'checking')
      setAccountId(checking?.id ?? accounts[0]?.id ?? '')
    }
  }, [accounts, accountId])

  useEffect(() => {
    setCategoryId('')
  }, [tab])

  const reset = () => {
    setAmount('')
    setLabel('')
    setDate(new Date().toISOString().slice(0, 10))
    setCategoryId('')
    setIsRecurring(false)
    setTab('expense')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || !accountId || !amount) return

    await addTransaction({
      user_id: user.id,
      account_id: accountId,
      category_id: categoryId || null,
      income_source_id: null,
      import_batch_id: null,
      staging_row_id: null,
      transaction_date: date,
      amount: parseFloat(amount),
      currency: 'EUR',
      direction: tabToDirection[tab],
      flow_type: tabToFlowType[tab],
      budget_behavior: tabToBudgetBehavior[tab],
      raw_label: label,
      normalized_label: label,
      merchant_name: null,
      external_id: null,
      is_recurring: isRecurring,
      is_verified: true,
      is_hidden: false,
      notes: null,
      meta: null,
    })

    handleClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-lg safe-bottom max-w-lg mx-auto"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-neutral-200" />
            </div>

            <div className="px-5 pb-8 pt-2">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-neutral-900">Nouvelle opération</h2>
                <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100">
                  <X size={16} className="text-neutral-500" />
                </button>
              </div>

              {/* Tab selector */}
              <div className="flex bg-neutral-100 rounded-2xl p-1 mb-5">
                {TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                      tab === key ? 'bg-white text-neutral-800 shadow-sm' : 'text-neutral-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Amount */}
                <div className="bg-neutral-50 rounded-2xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-2xl text-neutral-300 font-mono">€</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0,00"
                      className="text-4xl font-bold font-mono text-neutral-900 bg-transparent border-none outline-none w-full text-center placeholder-neutral-300"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                {/* Label */}
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Libellé de l'opération"
                  className="w-full px-4 py-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />

                {/* Date */}
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-neutral-50 border border-neutral-200 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  required
                />

                {/* Account select */}
                <div className="relative">
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-4 py-3 pr-10 rounded-xl bg-neutral-50 border border-neutral-200 text-sm focus:outline-none focus:border-primary-400 appearance-none"
                    required
                  >
                    {(accounts ?? []).map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                </div>

                {/* Category select */}
                {tab !== 'savings' && (
                  <div className="relative">
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full px-4 py-3 pr-10 rounded-xl bg-neutral-50 border border-neutral-200 text-sm focus:outline-none focus:border-primary-400 appearance-none"
                    >
                      <option value="">Catégorie (optionnel)</option>
                      {(categories ?? []).map((c) => (
                        <option key={c.id} value={c.id}>{c.icon_name} {c.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                  </div>
                )}

                {/* Recurring toggle */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm text-neutral-600">Opération récurrente</span>
                  <button
                    type="button"
                    onClick={() => setIsRecurring(!isRecurring)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${isRecurring ? 'bg-primary-500' : 'bg-neutral-200'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isRecurring ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isPending || !amount || !accountId}
                  className="w-full py-4 rounded-2xl bg-primary-500 text-white font-semibold text-base hover:bg-primary-600 active:scale-[0.98] transition-all disabled:opacity-60 shadow-sm mt-2"
                >
                  {isPending ? 'Enregistrement…' : 'Ajouter l\'opération'}
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
