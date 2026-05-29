import { useState, useMemo } from 'react'
import { Search, Calendar, Link, AlertTriangle, Loader, CheckCircle } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useTransactions, useAssignTripToTransaction } from '@/hooks/useTransactions'
import { useQuery } from '@tanstack/react-query'
import { QK, STALE } from '@/lib/queryKeys'
import { getAllTrips } from '@/features/voyages/api/getVoyagesData'
import { formatCurrencyFloored } from '@/lib/utils'
import type { Transaction } from '@/lib/types'

const VOYAGE_ACCENT_DARK = '#0284C7'
const VOYAGE_ACCENT = '#38BDF8'

interface TripTransactionRattachementModalProps {
  open: boolean
  onClose: () => void
  tripId: string
  tripName: string
}

export function TripTransactionRattachementModal({
  open,
  onClose,
  tripId,
  tripName,
}: TripTransactionRattachementModalProps) {
  const [searchText, setSearchText] = useState('')
  const [searchAmount, setSearchAmount] = useState('')
  const [searchDate, setSearchDate] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // 1. Fetch transactions (expenses only)
  const { data: transactions = [], isLoading: txLoading } = useTransactions(
    { flowType: 'expense' },
    { enabled: open }
  )

  // 2. Fetch all trips to display linked trip names
  const { data: allTrips = [] } = useQuery({
    queryKey: [QK.VOYAGES_ALL],
    queryFn: getAllTrips,
    staleTime: STALE.ANALYTICS,
    enabled: open,
  })

  // Create a map of tripId -> Trip for quick lookup
  const tripsMap = useMemo(() => {
    return new Map(allTrips.map((t) => [t.id, t]))
  }, [allTrips])

  // 3. Client-side search and filtering with tolerance rules
  const filteredTransactions = useMemo(() => {
    if (!open) return []

    return transactions
      .filter((tx) => {
        // Exclude manual transactions if they don't reside in the primary transactions table
        // Or if they are verified/hidden, etc. (already handled by default query)
        
        // 1. Label Search
        if (searchText.trim()) {
          const term = searchText.toLowerCase()
          const labelMatch =
            (tx.normalized_label?.toLowerCase().includes(term)) ||
            (tx.raw_label?.toLowerCase().includes(term)) ||
            (tx.merchant_name?.toLowerCase().includes(term))
          if (!labelMatch) return false
        }

        // 2. Amount Search (Tolerance ±1 € or ±5%)
        if (searchAmount.trim()) {
          const amt = parseFloat(searchAmount.replace(',', '.'))
          if (!isNaN(amt)) {
            const txAmt = Math.abs(Number(tx.amount))
            const diff = Math.abs(txAmt - amt)
            const matchesAmount = diff <= 1 || diff <= amt * 0.05
            if (!matchesAmount) return false
          }
        }

        // 3. Date Search (Tolerance ±5 days)
        if (searchDate) {
          const txTime = new Date(`${tx.transaction_date}T00:00:00`).getTime()
          const searchTime = new Date(`${searchDate}T00:00:00`).getTime()
          const diffDays = Math.abs(txTime - searchTime) / (1000 * 60 * 60 * 24)
          if (diffDays > 5) return false
        }

        return true
      })
      .sort((a, b) => {
        // Prioritize trip_id IS NULL first, then sort by date descending
        const aLinked = a.trip_id != null
        const bLinked = b.trip_id != null
        if (aLinked !== bLinked) {
          return aLinked ? 1 : -1
        }
        return b.transaction_date.localeCompare(a.transaction_date)
      })
  }, [transactions, searchText, searchAmount, searchDate, open])

  // 4. Assign mutation
  const assignMutation = useAssignTripToTransaction()
  const isSaving = assignMutation.isPending

  const handleAttach = async (tx: Transaction) => {
    setErrorMessage(null)

    // Check if already linked to another trip
    if (tx.trip_id && tx.trip_id !== tripId) {
      const otherTrip = tripsMap.get(tx.trip_id)
      const otherTripName = otherTrip?.name ?? 'un autre voyage'
      const confirm = window.confirm(
        `Cette transaction est déjà rattachée au voyage "${otherTripName}". Voulez-vous la rattacher à "${tripName}" à la place ?`
      )
      if (!confirm) return
    }

    try {
      await assignMutation.mutateAsync({ txId: tx.id, tripId })
      onClose()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erreur lors du rattachement')
    }
  }

  const formatShortDate = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="92dvh"
      zIndex={260}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1 }}>
          <Link size={16} color={VOYAGE_ACCENT_DARK} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 850, color: 'var(--neutral-900)' }}>
            Rattacher une transaction à {tripName}
          </p>
        </div>
      }
    >
      <div style={{ padding: 'var(--space-4) var(--space-5) var(--space-8)', display: 'grid', gap: 'var(--space-4)' }}>
        
        {/* Search Inputs Grid */}
        <div style={{ display: 'grid', gap: 'var(--space-3)', background: 'var(--neutral-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--neutral-150)' }}>
          {/* Label Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--neutral-400)' }} />
            <input
              type="text"
              placeholder="Rechercher par nom..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px var(--space-3) 10px 34px',
                fontSize: 13,
                fontWeight: 600,
                background: 'var(--neutral-0)',
                border: '1px solid var(--neutral-200)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--neutral-900)',
                outline: 'none',
              }}
            />
          </div>

          {/* Amount and Date Search */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            {/* Amount Search */}
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: 10, fontSize: 13, fontWeight: 700, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}>€</span>
              <input
                type="text"
                placeholder="Montant (ex: 25)"
                value={searchAmount}
                onChange={(e) => setSearchAmount(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px var(--space-3) 10px 26px',
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'var(--neutral-0)',
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--neutral-900)',
                  outline: 'none',
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </div>

            {/* Date Search */}
            <div style={{ position: 'relative' }}>
              <Calendar size={14} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--neutral-400)', pointerEvents: 'none' }} />
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px var(--space-2) 8px 32px',
                  fontSize: 13,
                  fontWeight: 650,
                  background: 'var(--neutral-0)',
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--neutral-900)',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* Mutation/Fetch errors */}
        {(errorMessage) && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} />
            {errorMessage}
          </p>
        )}

        {/* Transaction results list */}
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          <p style={{ margin: 'var(--space-1) 0 var(--space-2)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--neutral-400)' }}>
            {txLoading ? 'Chargement des transactions...' : `${filteredTransactions.length} transaction${filteredTransactions.length > 1 ? 's' : ''} disponible${filteredTransactions.length > 1 ? 's' : ''}`}
          </p>

          {txLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8) 0' }}>
              <Loader size={20} color={VOYAGE_ACCENT} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)', border: '1px dashed var(--neutral-200)', borderRadius: 'var(--radius-md)', color: 'var(--neutral-400)' }}>
              Aucune transaction ne correspond aux critères.
            </div>
          ) : (
            <div
              style={{
                maxHeight: '40vh',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid var(--neutral-150)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--neutral-0)',
              }}
            >
              {filteredTransactions.map((tx) => {
                const linkedTrip = tx.trip_id ? tripsMap.get(tx.trip_id) : null
                const label = (tx.normalized_label ?? tx.raw_label ?? 'Opération').trim()
                const categoryName = tx.category?.name ?? 'Autre'
                const isLinkedToCurrent = tx.trip_id === tripId

                return (
                  <div
                    key={tx.id}
                    className="txn-row-clickable"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '60px minmax(0, 1fr) auto',
                      gap: 'var(--space-3)',
                      alignItems: 'center',
                      padding: '10px var(--space-4)',
                      borderBottom: '1px solid var(--neutral-100)',
                      cursor: isSaving ? 'wait' : 'pointer',
                      transition: 'background 100ms ease',
                    }}
                    onClick={() => !isSaving && handleAttach(tx)}
                  >
                    {/* Date */}
                    <span style={{ fontSize: 11, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {formatShortDate(tx.transaction_date)}
                    </span>

                    {/* Label and Trip link indicator */}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 750, color: 'var(--neutral-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {label}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--neutral-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {categoryName}
                        {linkedTrip ? (
                          <>
                            <span style={{ color: 'var(--neutral-200)' }}> · </span>
                            <span
                              style={{
                                color: isLinkedToCurrent ? 'var(--color-success)' : 'var(--color-warning)',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 2,
                              }}
                            >
                              {isLinkedToCurrent ? (
                                <CheckCircle size={10} />
                              ) : (
                                <AlertTriangle size={10} />
                              )}
                              {isLinkedToCurrent ? 'Rattaché' : `Lié à ${linkedTrip.name}`}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>

                    {/* Amount */}
                    <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', marginLeft: 'var(--space-2)' }}>
                      {formatCurrencyFloored(tx.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </BottomSheet>
  )
}
