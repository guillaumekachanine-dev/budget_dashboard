import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, ArrowRightLeft, ReceiptText, X, Link } from 'lucide-react'
import { useTripCockpit } from '@/features/voyages/hooks/useTripCockpit'
import { useTripExpenses } from '@/features/voyages/hooks/useTripExpenses'
import { useTripExpenseBars } from '@/features/voyages/hooks/useTripExpenseBars'
import { useMatchCandidates } from '@/features/voyages/hooks/useMatchCandidates'
import { TripManualExpenseModal } from '@/features/voyages/components/TripManualExpenseModal'
import { TripExpenseMatchingSheet } from '@/features/voyages/components/TripExpenseMatchingSheet'
import { PlanVoyageModal } from '@/features/voyages/components/PlanVoyageModal'
import { TripExpenseBarsSection } from '@/features/voyages/components/TripExpenseBarsSection'
import { formatCurrencyFloored } from '@/lib/utils'
import { AmbianceBgScene, tripAmbianceBackground } from '@/features/voyages/components/AmbianceBgScene'
import { useVoyagesData } from '@/features/voyages/hooks/useVoyagesData'
import { useTransaction } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { TransactionDetailsModal } from '@/components/modals/TransactionDetailsModal'
import { TripTransactionRattachementModal } from '@/features/voyages/components/TripTransactionRattachementModal'

const MONTHS_FR = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin',
                   'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const VOYAGE_ACCENT_DARK = '#0284C7'
const VOYAGE_ACCENT = '#38BDF8'

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

function fmtDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`
}

function fmtDateRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${MONTHS_FR[s.getMonth()]} ${s.getFullYear()}`
  }
  return `${fmtDateShort(start)} → ${fmtDate(end)}`
}

function stripVoyageSuffix(name: string): string {
  return name.replace(/\s+voyage$/i, '').trim()
}

interface TripDetailsModalProps {
  tripId: string | null
  isOpen: boolean
  onClose: () => void
}

export function TripDetailsModal({ tripId, isOpen, onClose }: TripDetailsModalProps) {
  const { allTrips } = useTripCockpit()

  // Find the trip
  const selectedTrip = useMemo(() => {
    if (!tripId) return null
    return allTrips.find(t => t.trip_id === tripId) ?? null
  }, [tripId, allTrips])

  const selectedYear = useMemo(() => {
    if (!selectedTrip) return new Date().getFullYear()
    return selectedTrip.year || new Date(`${selectedTrip.start_date}T00:00:00`).getFullYear()
  }, [selectedTrip])

  // Données du voyage sélectionné
  const { expenses, categoryBreakdown, isLoading: expLoading } =
    useTripExpenses(tripId)

  const { groups: matchGroups } =
    useMatchCandidates(tripId ?? undefined)

  // États UI
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [matchSheetOpen, setMatchSheetOpen] = useState(false)
  const [editTripModalOpen, setEditTripModalOpen] = useState(false)
  const [transactionsListModalOpen, setTransactionsListModalOpen] = useState(false)
  const [rattachementModalOpen, setRattachementModalOpen] = useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)

  const { data: categories = [] } = useCategories()
  const { data: activeTransaction } = useTransaction(selectedTransactionId)
  const { tripsWithStats } = useVoyagesData(selectedYear)
  const selectedTripWithStats = useMemo(
    () => tripsWithStats.find((item) => item.trip.id === tripId) ?? null,
    [tripId, tripsWithStats],
  )
  const expenseBars = useTripExpenseBars(selectedTrip)

  const spentKpi = useMemo(() => {
    if (!selectedTrip) return ''
    return formatCurrencyFloored(selectedTrip.total_actual)
  }, [selectedTrip])

  const remainingKpi = useMemo(() => {
    if (!selectedTrip) return '—'
    if (selectedTrip.planned_budget == null || selectedTrip.remaining == null) return '—'
    return selectedTrip.remaining < 0
      ? `-${formatCurrencyFloored(Math.abs(selectedTrip.remaining))}`
      : formatCurrencyFloored(selectedTrip.remaining)
  }, [selectedTrip])

  const isRemainingKpiNegative = useMemo(() => {
    if (!selectedTrip) return false
    return selectedTrip.planned_budget != null && selectedTrip.remaining != null && selectedTrip.remaining < 0
  }, [selectedTrip])

  const budgetPerDayKpi = useMemo(() => {
    if (!selectedTrip) return '—'
    return selectedTrip.planned_budget && selectedTrip.days_total > 0
      ? formatCurrencyFloored(selectedTrip.planned_budget / selectedTrip.days_total)
      : '—'
  }, [selectedTrip])

  return (
    <AnimatePresence>
      {isOpen && selectedTrip ? (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              background: 'rgba(13, 13, 31, 0.52)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 var(--space-4)',
            }}
          >
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 440,
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--neutral-150)',
                overflow: 'hidden',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header voyage avec ambiance */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  background: tripAmbianceBackground(selectedTrip.emoji),
                  padding: '12px var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  overflow: 'hidden',
                }}
              >
                <AmbianceBgScene emoji={selectedTrip.emoji ?? '✈️'} />
                
                {/* Left: icon + info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', zIndex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                      flexShrink: 0,
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    {selectedTrip.emoji?.trim() || '✈️'}
                  </div>
                  
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedTrip.name}
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.2 }}>
                      {fmtDateRange(selectedTrip.start_date, selectedTrip.end_date)}
                      {` · ${selectedTrip.days_total} jour${selectedTrip.days_total > 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>

                {/* Right: Close button & amount */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', zIndex: 2 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1.5)',
                      background: 'rgba(31, 41, 55, 0.68)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      borderRadius: 'var(--radius-full)',
                      padding: '4px 8px',
                      backdropFilter: 'blur(2px)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedTripWithStats) return
                        setEditTripModalOpen(true)
                      }}
                      aria-label="Modifier le budget"
                      disabled={!selectedTripWithStats}
                      style={{
                        width: 22,
                        height: 22,
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: 'var(--radius-full)',
                        background: 'rgba(255, 255, 255, 0.15)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        cursor: selectedTripWithStats ? 'pointer' : 'default',
                        padding: 0,
                        flexShrink: 0,
                        opacity: selectedTripWithStats ? 1 : 0.6,
                      }}
                    >
                      <Pencil size={11} />
                    </button>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                      {selectedTrip.planned_budget != null ? formatCurrencyFloored(selectedTrip.planned_budget) : '—'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fermer"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Content Section */}
              <div style={{ padding: 'var(--space-4)', background: 'var(--neutral-25, #fafafa)', overflowY: 'auto', flex: 1 }}>
                {/* 3 KPI pills */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                  {/* KPI spent */}
                  <div
                    style={{
                      background: 'var(--neutral-0)',
                      border: '1px solid var(--neutral-150)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 'var(--space-2.5) var(--space-2)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-400)', letterSpacing: '0.05em', marginBottom: 2 }}>
                      Dépensé
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-800)', whiteSpace: 'nowrap' }}>
                      {spentKpi}
                    </span>
                  </div>

                  {/* KPI remaining */}
                  <div
                    style={{
                      background: 'var(--neutral-0)',
                      border: '1px solid var(--neutral-150)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 'var(--space-2.5) var(--space-2)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-400)', letterSpacing: '0.05em', marginBottom: 2 }}>
                      Reste
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: isRemainingKpiNegative ? 'var(--color-error-text)' : 'var(--neutral-800)', whiteSpace: 'nowrap' }}>
                      {remainingKpi}
                    </span>
                  </div>

                  {/* KPI budget/day */}
                  <div
                    style={{
                      background: 'var(--neutral-0)',
                      border: '1px solid var(--neutral-150)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 'var(--space-2.5) var(--space-2)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--neutral-400)', letterSpacing: '0.05em', marginBottom: 2 }}>
                      Budget / j
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-800)', whiteSpace: 'nowrap' }}>
                      {budgetPerDayKpi}
                    </span>
                  </div>
                </div>

                {/* Progression globale */}
                {selectedTrip.planned_budget != null ? (
                  <div style={{ marginBottom: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1.5)' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)' }}>Progression budget</span>
                      <span
                        style={{
                          fontSize:   11,
                          fontWeight: 800,
                          color:      (selectedTrip.consumed_pct ?? 0) > 100 ? 'var(--color-error-text)' : 'var(--neutral-700)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {selectedTrip.consumed_pct != null ? `${selectedTrip.consumed_pct.toFixed(0)}%` : ''}
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 'var(--radius-full)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height:     '100%',
                          width:      `${Math.min(100, selectedTrip.consumed_pct ?? 0)}%`,
                          background: (selectedTrip.consumed_pct ?? 0) > 100 ? 'var(--color-error)' : VOYAGE_ACCENT_DARK,
                          borderRadius: 'var(--radius-full)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedTripWithStats) return
                        setEditTripModalOpen(true)
                      }}
                      style={{
                        display:      'inline-flex',
                        alignItems:   'center',
                        gap:          6,
                        fontSize:     11,
                        fontWeight:   600,
                        color:        VOYAGE_ACCENT_DARK,
                        background:   'transparent',
                        border:       `1px dashed ${VOYAGE_ACCENT}`,
                        borderRadius: 'var(--radius-sm)',
                        padding:      '4px 10px',
                        cursor:       selectedTripWithStats ? 'pointer' : 'default',
                        opacity:      selectedTripWithStats ? 1 : 0.6,
                      }}
                      disabled={!selectedTripWithStats}
                    >
                      <Plus size={10} />
                      Définir un budget
                    </button>
                  </div>
                )}

                {/* Action buttons grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                  <button
                    type="button"
                    onClick={() => setAddExpenseOpen(true)}
                    style={{
                      display:      'inline-flex',
                      alignItems:   'center',
                      justifyContent: 'center',
                      gap:          'var(--space-1.5)',
                      background:   VOYAGE_ACCENT_DARK,
                      color:        '#fff',
                      border:       'none',
                      borderRadius: 'var(--radius-sm)',
                      padding:      '10px var(--space-1)',
                      fontSize:     12,
                      fontWeight:   700,
                      cursor:       'pointer',
                      width:        '100%',
                    }}
                  >
                    <Plus size={13} />
                    Dépense
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransactionsListModalOpen(true)}
                    style={{
                      display:      'inline-flex',
                      alignItems:   'center',
                      justifyContent: 'center',
                      gap:          'var(--space-1.5)',
                      background:   'var(--neutral-50)',
                      color:        'var(--neutral-700)',
                      border:       '1px solid var(--neutral-200)',
                      borderRadius: 'var(--radius-sm)',
                      padding:      '10px var(--space-1)',
                      fontSize:     12,
                      fontWeight:   600,
                      cursor:       'pointer',
                      width:        '100%',
                    }}
                  >
                    <ReceiptText size={13} />
                    Transactions
                  </button>
                  <button
                    type="button"
                    onClick={() => setRattachementModalOpen(true)}
                    style={{
                      display:      'inline-flex',
                      alignItems:   'center',
                      justifyContent: 'center',
                      gap:          'var(--space-1.5)',
                      background:   'var(--neutral-50)',
                      color:        'var(--neutral-700)',
                      border:       '1px solid var(--neutral-200)',
                      borderRadius: 'var(--radius-sm)',
                      padding:      '10px var(--space-1)',
                      fontSize:     12,
                      fontWeight:   600,
                      cursor:       'pointer',
                      width:        '100%',
                    }}
                  >
                    <Link size={13} />
                    Affilier
                  </button>
                </div>

                {/* Category progress bars */}
                <TripExpenseBarsSection mode={expenseBars.mode} rows={expenseBars.rows} />

                {/* Rapprochements en attente */}
                {matchGroups.length > 0 ? (
                  <div style={{ borderTop: '1px solid var(--neutral-100)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--neutral-400)' }}>
                        {`Rapprochements (${matchGroups.length})`}
                      </p>
                      <button
                        type="button"
                        onClick={() => setMatchSheetOpen(true)}
                        style={{
                          fontSize:     11,
                          fontWeight:   700,
                          color:        '#D97706',
                          background:   'transparent',
                          border:       '1px solid rgba(245,158,11,0.35)',
                          borderRadius: 'var(--radius-full)',
                          padding:      '3px 10px',
                          cursor:       'pointer',
                        }}
                      >
                        Voir tout
                      </button>
                    </div>
                    <div
                      style={{
                        background:   'rgba(245,158,11,0.07)',
                        border:       '1px solid rgba(245,158,11,0.25)',
                        borderRadius: 'var(--radius-sm)',
                        padding:      'var(--space-3)',
                        display:      'flex',
                        alignItems:   'center',
                        gap:          'var(--space-2)',
                      }}
                    >
                      <ArrowRightLeft size={16} color="#D97706" style={{ flexShrink: 0 }} />
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--neutral-800)' }}>
                          {`${matchGroups.length} dépense${matchGroups.length > 1 ? 's' : ''} manuelle${matchGroups.length > 1 ? 's' : ''} en attente`}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--neutral-500)' }}>
                          Rapproche-les avec les transactions bancaires importées.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>

          {/* Sub Modals */}
          <TripManualExpenseModal
            open={addExpenseOpen}
            onClose={() => setAddExpenseOpen(false)}
            initialTripId={tripId}
          />

          <TripExpenseMatchingSheet
            open={matchSheetOpen}
            onClose={() => setMatchSheetOpen(false)}
            tripId={tripId}
            tripName={selectedTrip.name}
          />

          {selectedTripWithStats ? (
            <PlanVoyageModal
              open={editTripModalOpen}
              onClose={() => setEditTripModalOpen(false)}
              mode="edit"
              tripToEdit={selectedTripWithStats}
              realizedCategoryBreakdown={categoryBreakdown.map((row) => ({
                categoryId: row.categoryId,
                categoryName: row.categoryName,
                amount: row.amount,
              }))}
            />
          ) : null}

          <TripTransactionRattachementModal
            open={rattachementModalOpen}
            onClose={() => setRattachementModalOpen(false)}
            tripId={selectedTrip.trip_id}
            tripName={selectedTrip.name}
          />

          <TransactionDetailsModal
            transaction={activeTransaction ?? null}
            categories={categories}
            onClose={() => setSelectedTransactionId(null)}
          />

          {/* Modale liste des Transactions du voyage */}
          <AnimatePresence>
            {transactionsListModalOpen ? (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setTransactionsListModalOpen(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 300,
                    background: 'rgba(13, 13, 31, 0.52)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 var(--space-4)',
                  }}
                >
                  {/* Modal Box */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 8 }}
                    transition={{ duration: 0.15 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      maxWidth: 440,
                      background: 'var(--neutral-0)',
                      borderRadius: 'var(--radius-sm)',
                      boxShadow: 'var(--shadow-xl)',
                      border: '1px solid var(--neutral-150)',
                      overflow: 'hidden',
                      maxHeight: '80vh',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {/* Header */}
                    <div
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        background: 'rgba(56, 189, 248, 0.08)',
                        borderBottom: '1px solid var(--neutral-150)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-900)' }}>
                        Transactions — {selectedTrip.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => setTransactionsListModalOpen(false)}
                        aria-label="Fermer"
                        style={{
                          border: 'none',
                          background: 'var(--neutral-100)',
                          color: 'var(--neutral-600)',
                          width: 28,
                          height: 28,
                          borderRadius: 'var(--radius-full)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-2) var(--space-4) var(--space-4)' }}>
                      {expLoading ? (
                        <p style={{ margin: 'var(--space-4) 0', fontSize: 13, color: 'var(--neutral-500)', textAlign: 'center' }}>
                          Chargement des transactions…
                        </p>
                      ) : expenses.length === 0 ? (
                        <p style={{ margin: 'var(--space-4) 0', fontSize: 13, color: 'var(--neutral-500)', textAlign: 'center' }}>
                          Aucune transaction rattachée à ce voyage.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {[...expenses]
                            .sort((a, b) => b.expense_date.localeCompare(a.expense_date))
                            .map(expense => {
                              const isBank = expense.source_type === 'bank'
                              return (
                                <div
                                  key={expense.source_id}
                                  className={isBank ? 'txn-row-clickable' : ''}
                                  onClick={isBank ? () => setSelectedTransactionId(expense.source_id) : undefined}
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '50px minmax(0, 1fr) auto',
                                    gap: 'var(--space-2)',
                                    alignItems: 'center',
                                    padding: '6px var(--space-2)',
                                    margin: '0 -var(--space-2)',
                                    borderBottom: '1px solid var(--neutral-100)',
                                    cursor: isBank ? 'pointer' : 'default',
                                    borderRadius: 'var(--radius-sm)',
                                    transition: 'background 100ms ease',
                                  }}
                                >
                                  <span style={{ fontSize: 11, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                    {fmtDateShort(expense.expense_date)}
                                  </span>
                                  <div style={{ minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--neutral-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {expense.label}
                                    </p>
                                    <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--neutral-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {expense.category_name ? stripVoyageSuffix(expense.category_name) : 'Autre'}
                                      <span style={{ color: 'var(--neutral-200)' }}> · </span>
                                      <span style={{ color: expense.source_type === 'manual' ? '#D97706' : VOYAGE_ACCENT_DARK, fontWeight: 600 }}>
                                        {expense.source_type === 'manual' ? 'manuel' : 'banque'}
                                      </span>
                                    </p>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, marginLeft: 'var(--space-2)' }}>
                                    <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                                      {formatCurrencyFloored(expense.personal_amount)}
                                    </span>
                                    {expense.personal_amount !== expense.amount && (
                                      <span style={{ fontSize: 9, color: 'var(--neutral-400)', marginTop: 2 }}>
                                        total {formatCurrencyFloored(expense.amount)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>

          <style>{`
            .txn-row-clickable {
              transition: background-color 120ms ease;
            }
            .txn-row-clickable:hover {
              background-color: var(--neutral-100);
            }
            .txn-row-clickable:active {
              background-color: var(--neutral-150);
            }
          `}</style>
        </>
      ) : null}
    </AnimatePresence>
  )
}
