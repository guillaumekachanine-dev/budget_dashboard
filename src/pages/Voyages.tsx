import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Plus, Pencil, CheckCircle2, ArrowRightLeft, Plane,
  ReceiptText, AlertCircle,
} from 'lucide-react'
import { useTripCockpit, selectDefaultTrip } from '@/features/voyages/hooks/useTripCockpit'
import { useTripExpenses } from '@/features/voyages/hooks/useTripExpenses'
import { useMatchCandidates } from '@/features/voyages/hooks/useMatchCandidates'
import { useUpdateTripBudget } from '@/features/voyages/hooks/useUpdateTripBudget'
import { TripManualExpenseModal } from '@/features/voyages/components/TripManualExpenseModal'
import { TripExpenseMatchingSheet } from '@/features/voyages/components/TripExpenseMatchingSheet'
import { formatCurrencyFloored } from '@/lib/utils'
import type { TripCockpitRow } from '@/lib/types'
import type { TripExpenseRow } from '@/features/voyages/types'

// ─── constantes ───────────────────────────────────────────────────────────────

const MONTHS_FR = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin',
                   'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const VOYAGE_ACCENT      = '#38BDF8'
const VOYAGE_ACCENT_DARK = '#0284C7'

const PAGE_GUTTER = 'var(--space-5)'

// ─── utilitaires ─────────────────────────────────────────────────────────────

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

const STATUS_BADGE: Record<TripCockpitRow['trip_status'], { label: string; bg: string; color: string }> = {
  ongoing: { label: 'En cours',  bg: 'rgba(56,189,248,0.15)', color: VOYAGE_ACCENT_DARK },
  future:  { label: 'À venir',   bg: 'rgba(91,87,245,0.12)',  color: 'var(--primary-600)' },
  past:    { label: 'Passé',     bg: 'var(--neutral-100)',    color: 'var(--neutral-500)' },
}

// ─── sous-composants ─────────────────────────────────────────────────────────

// Carte dans le rail horizontal de sélection
function TripRailCard({
  trip,
  isSelected,
  onSelect,
}: {
  trip: TripCockpitRow
  isSelected: boolean
  onSelect: () => void
}) {
  const badge = STATUS_BADGE[trip.trip_status]
  const hasData = trip.expense_count > 0

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      style={{
        display:       'grid',
        gap:           'var(--space-1)',
        padding:       'var(--space-3)',
        background:    isSelected ? 'rgba(56,189,248,0.10)' : 'var(--neutral-0)',
        border:        `1.5px solid ${isSelected ? VOYAGE_ACCENT : 'var(--neutral-150, var(--neutral-200))'}`,
        borderRadius:  'var(--radius-md)',
        cursor:        'pointer',
        textAlign:     'left',
        minWidth:      150,
        maxWidth:      160,
        flexShrink:    0,
        transition:    'border-color 120ms ease, background 120ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <span style={{ fontSize: 18 }}>{trip.emoji ?? '✈️'}</span>
        <span
          style={{
            fontSize:      9,
            fontWeight:    700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            padding:       '2px 6px',
            borderRadius:  'var(--radius-full)',
            background:    badge.bg,
            color:         badge.color,
            whiteSpace:    'nowrap',
          }}
        >
          {badge.label}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {trip.name}
      </p>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-500)' }}>
        {fmtDateShort(trip.start_date)} → {fmtDateShort(trip.end_date)}
      </p>
      {trip.planned_budget ? (
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>
          {hasData
            ? `${formatCurrencyFloored(trip.total_actual)} / ${formatCurrencyFloored(trip.planned_budget)}`
            : formatCurrencyFloored(trip.planned_budget)}
        </p>
      ) : null}
    </button>
  )
}

// Section KPI 3-colonnes
function KpiGrid({ items }: { items: { label: string; value: string; accent?: boolean }[] }) {
  return (
    <div
      style={{
        display:               'grid',
        gridTemplateColumns:   `repeat(${items.length}, minmax(0,1fr))`,
        gap:                   'var(--space-2)',
      }}
    >
      {items.map(({ label, value, accent }) => (
        <div
          key={label}
          style={{
            background:   accent ? 'rgba(56,189,248,0.09)' : 'var(--neutral-50)',
            border:       `1px solid ${accent ? 'rgba(56,189,248,0.22)' : 'var(--neutral-200)'}`,
            borderRadius: 'var(--radius-md)',
            padding:      'var(--space-2) var(--space-3)',
            display:      'grid',
            gap:          2,
            textAlign:    'center',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-500)' }}>{label}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}

// Ligne dépense dans la liste
function ExpenseRow({ expense }: { expense: TripExpenseRow }) {
  const isManual = expense.source_type === 'manual'
  return (
    <div
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:         'var(--space-2)',
        padding:     'var(--space-2) 0',
        borderBottom:'1px solid var(--neutral-100)',
      }}
    >
      {isManual ? (
        <span
          style={{
            fontSize:      9,
            fontWeight:    700,
            color:         '#D97706',
            background:    'rgba(245,158,11,0.10)',
            border:        '1px solid rgba(245,158,11,0.25)',
            borderRadius:  'var(--radius-full)',
            padding:       '2px 5px',
            flexShrink:    0,
            textTransform: 'uppercase',
          }}
        >
          Manuel
        </span>
      ) : (
        <span
          style={{
            fontSize:     9,
            fontWeight:   700,
            color:        VOYAGE_ACCENT_DARK,
            background:   'rgba(56,189,248,0.10)',
            border:       `1px solid rgba(56,189,248,0.20)`,
            borderRadius: 'var(--radius-full)',
            padding:      '2px 5px',
            flexShrink:   0,
            textTransform:'uppercase',
          }}
        >
          Banque
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--neutral-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {expense.label}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-400)' }}>
          {fmtDateShort(expense.expense_date)}
          {expense.category_name ? ` · ${expense.category_name}` : ''}
        </p>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
        {formatCurrencyFloored(expense.amount)}
      </span>
    </div>
  )
}

// Inline budget editor
function BudgetEditor({
  currentBudget,
  tripId,
  onDone,
}: {
  currentBudget: number | null
  tripId: string
  onDone: () => void
}) {
  const [value, setValue] = useState(String(currentBudget ?? ''))
  const mutation = useUpdateTripBudget()

  async function handleSave() {
    const n = parseFloat(value.replace(',', '.'))
    if (isNaN(n) || n < 0) return
    await mutation.mutateAsync({ tripId, plannedBudget: n })
    onDone()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <input
        type="number"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="0"
        min="0"
        step="10"
        style={{
          flex:         1,
          background:   'var(--neutral-50)',
          border:       `1px solid ${VOYAGE_ACCENT}`,
          borderRadius: 'var(--radius-sm)',
          padding:      '6px var(--space-2)',
          fontSize:     14,
          fontWeight:   700,
          fontFamily:   'var(--font-mono)',
          color:        'var(--neutral-900)',
          outline:      'none',
          width:        90,
        }}
        autoFocus
      />
      <span style={{ fontSize: 13, color: 'var(--neutral-500)' }}>€</span>
      <button
        type="button"
        onClick={handleSave}
        disabled={mutation.isPending}
        style={{
          background:   VOYAGE_ACCENT_DARK,
          color:        '#fff',
          border:       'none',
          borderRadius: 'var(--radius-sm)',
          padding:      '6px 12px',
          fontSize:     12,
          fontWeight:   700,
          cursor:       'pointer',
        }}
      >
        {mutation.isPending ? '…' : 'OK'}
      </button>
      <button
        type="button"
        onClick={onDone}
        style={{
          background:   'transparent',
          border:       '1px solid var(--neutral-200)',
          borderRadius: 'var(--radius-sm)',
          padding:      '6px 10px',
          fontSize:     12,
          color:        'var(--neutral-500)',
          cursor:       'pointer',
        }}
      >
        ✕
      </button>
    </div>
  )
}

// ─── État vide ────────────────────────────────────────────────────────────────

function NoTripsState({ onCreateTrip }: { onCreateTrip: () => void }) {
  return (
    <div
      style={{
        display:       'grid',
        gap:           'var(--space-4)',
        justifyItems:  'center',
        textAlign:     'center',
        padding:       'var(--space-12) var(--space-6)',
      }}
    >
      <span style={{ fontSize: 48 }}>✈️</span>
      <div>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--neutral-800)' }}>
          Aucun voyage planifié
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--neutral-400)', lineHeight: 1.5 }}>
          Crée ton premier voyage pour suivre ton budget en temps réel.
        </p>
      </div>
      <button
        type="button"
        onClick={onCreateTrip}
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            'var(--space-2)',
          background:     VOYAGE_ACCENT_DARK,
          color:          '#fff',
          border:         'none',
          borderRadius:   'var(--radius-button)',
          padding:        '10px var(--space-5)',
          fontSize:       14,
          fontWeight:     700,
          cursor:         'pointer',
        }}
      >
        <Plus size={14} />
        Nouveau voyage
      </button>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function Voyages() {
  const navigate  = useNavigate()
  const { tripId: urlTripId } = useParams<{ tripId?: string }>()

  // ── Données globales (parallel load — pas de waterfall) ─────────────────
  const {
    allTrips,
    upcomingTrips,
    activeTrip,
    recentCompletedTrips,
    isLoading: tripsLoading,
  } = useTripCockpit()

  // Sélection : URL > auto-sélection
  const selectedTrip = useMemo<TripCockpitRow | null>(() => {
    if (urlTripId) {
      const found = allTrips.find(t => t.trip_id === urlTripId)
      if (found) return found
      // tripId invalide → fallback silencieux + auto-sélection
    }
    return selectDefaultTrip(allTrips)
  }, [allTrips, urlTripId])

  const tripNotFound = !tripsLoading && Boolean(urlTripId) && !allTrips.find(t => t.trip_id === urlTripId)

  // ── Données du voyage sélectionné ───────────────────────────────────────
  const { expenses, recentExpenses, categoryBreakdown, isLoading: expLoading } =
    useTripExpenses(selectedTrip?.trip_id ?? null)

  const { groups: matchGroups, isLoading: matchLoading } =
    useMatchCandidates(selectedTrip?.trip_id ?? undefined)

  // ── États UI ─────────────────────────────────────────────────────────────
  const [addExpenseOpen,   setAddExpenseOpen]   = useState(false)
  const [matchSheetOpen,   setMatchSheetOpen]   = useState(false)
  const [editingBudget,    setEditingBudget]    = useState(false)

  const handleSelectTrip = useCallback((trip: TripCockpitRow) => {
    navigate(`/voyages/${trip.trip_id}`, { replace: true })
  }, [navigate])

  // ── Groupes de voyages pour le rail ─────────────────────────────────────
  const tripGroups = useMemo(() => [
    { label: 'En cours',    trips: activeTrip ? [activeTrip] : [] },
    { label: 'À venir',     trips: upcomingTrips },
    { label: 'Passés',      trips: recentCompletedTrips },
  ].filter(g => g.trips.length > 0), [activeTrip, upcomingTrips, recentCompletedTrips])

  // ── KPIs du voyage sélectionné ───────────────────────────────────────────
  const kpiItems = useMemo(() => {
    if (!selectedTrip) return []
    const { total_actual, remaining, avg_per_day, planned_budget, trip_status, days_total } = selectedTrip
    const items = [
      { label: 'Dépensé',   value: formatCurrencyFloored(total_actual),            accent: true },
      { label: 'Reste',     value: remaining != null ? formatCurrencyFloored(Math.max(0, remaining)) : '—' },
    ]
    if (trip_status !== 'future' && avg_per_day > 0) {
      items.push({ label: 'Moy/j', value: formatCurrencyFloored(avg_per_day) })
    } else if (planned_budget && days_total > 0) {
      items.push({ label: 'Budget/j', value: formatCurrencyFloored(planned_budget / days_total) })
    }
    return items
  }, [selectedTrip])

  // ────────────────────────────────────────────────────────────────────────
  // Rendu
  // ────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--neutral-50)' }}>

      {/* ── Header sticky ──────────────────────────────────────────────── */}
      <header
        style={{
          position:      'sticky',
          top:           0,
          zIndex:        100,
          background:    `linear-gradient(135deg, var(--primary-700) 0%, var(--primary-500) 100%)`,
          paddingTop:    'calc(var(--safe-top) + 10px)',
          paddingRight:  PAGE_GUTTER,
          paddingBottom: 'var(--space-4)',
          paddingLeft:   PAGE_GUTTER,
          boxSizing:     'border-box',
        }}
      >
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Retour"
              style={{
                background:   'rgba(255,255,255,0.18)',
                border:       '1px solid rgba(255,255,255,0.30)',
                borderRadius: 'var(--radius-full)',
                width:        36,
                height:       36,
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                cursor:       'pointer',
                color:        'var(--neutral-0)',
                flexShrink:   0,
              }}
            >
              <ArrowLeft size={16} />
            </button>
            <h1
              style={{
                margin:      0,
                fontSize:    'var(--font-size-2xl)',
                fontWeight:  'var(--font-weight-extrabold)',
                color:       'var(--neutral-0)',
                letterSpacing: '-0.02em',
              }}
            >
              Voyages
            </h1>
          </div>

          {/* Bouton Nouveau voyage → ouvre PlanVoyageModal depuis Budgets pour l'instant */}
          <button
            type="button"
            onClick={() => navigate('/budgets')}
            aria-label="Nouveau voyage"
            title="Créer un voyage (depuis Budgets)"
            style={{
              background:    'rgba(255,255,255,0.18)',
              border:        '1px solid rgba(255,255,255,0.30)',
              borderRadius:  'var(--radius-full)',
              width:         36,
              height:        36,
              display:       'flex',
              alignItems:    'center',
              justifyContent:'center',
              cursor:        'pointer',
              color:         'var(--neutral-0)',
            }}
          >
            <Plus size={16} />
          </button>
        </div>
      </header>

      {/* ── Corps de la page ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ flex: 1, padding: `var(--space-4) 0 120px` }}
      >
        <div style={{ maxWidth: 600, margin: '0 auto' }}>

          {/* ── Alerte tripId invalide ────────────────────────────────── */}
          {tripNotFound ? (
            <div
              style={{
                margin:       `0 ${PAGE_GUTTER} var(--space-3)`,
                padding:      'var(--space-2) var(--space-3)',
                background:   'rgba(252,90,90,0.08)',
                border:       '1px solid rgba(252,90,90,0.25)',
                borderRadius: 'var(--radius-sm)',
                display:      'flex',
                alignItems:   'center',
                gap:          'var(--space-2)',
              }}
            >
              <AlertCircle size={14} color="var(--color-error)" style={{ flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-error)' }}>
                Voyage introuvable — affichage du voyage par défaut.
              </p>
            </div>
          ) : null}

          {/* ── Loading ───────────────────────────────────────────────── */}
          {tripsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12) 0' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${VOYAGE_ACCENT}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : allTrips.length === 0 ? (
            <NoTripsState onCreateTrip={() => navigate('/budgets')} />
          ) : (
            <>
              {/* ── Rail de sélection des voyages ────────────────────── */}
              <section style={{ marginBottom: 'var(--space-4)' }}>
                {tripGroups.map(group => (
                  <div key={group.label} style={{ marginBottom: 'var(--space-2)' }}>
                    <p
                      style={{
                        margin:        `0 0 var(--space-2) ${PAGE_GUTTER}`,
                        fontSize:      11,
                        fontWeight:    700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        color:         'var(--neutral-400)',
                      }}
                    >
                      {group.label}
                    </p>
                    <div
                      className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                      style={{ paddingLeft: PAGE_GUTTER, paddingRight: PAGE_GUTTER }}
                    >
                      <div style={{ display: 'inline-flex', gap: 'var(--space-2)', paddingBottom: 4 }}>
                        {group.trips.map(trip => (
                          <TripRailCard
                            key={trip.trip_id}
                            trip={trip}
                            isSelected={selectedTrip?.trip_id === trip.trip_id}
                            onSelect={() => handleSelectTrip(trip)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </section>

              {selectedTrip ? (
                <>
                  {/* ── Carte détail voyage ──────────────────────────── */}
                  <section
                    style={{
                      margin:       `0 ${PAGE_GUTTER} var(--space-4)`,
                      background:   'var(--neutral-0)',
                      borderRadius: 'var(--radius-card)',
                      boxShadow:    'var(--shadow-card)',
                      overflow:     'hidden',
                    }}
                  >
                    {/* Accent top */}
                    <div style={{ height: 3, background: VOYAGE_ACCENT }} />

                    <div style={{ padding: 'var(--space-4)' }}>
                      {/* Titre + badge */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                        <span style={{ fontSize: 24, lineHeight: 1.3, flexShrink: 0 }}>{selectedTrip.emoji ?? '✈️'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--neutral-900)' }}>{selectedTrip.name}</p>
                            <span
                              style={{
                                fontSize:      10,
                                fontWeight:    700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.07em',
                                padding:       '2px 7px',
                                borderRadius:  'var(--radius-full)',
                                background:    STATUS_BADGE[selectedTrip.trip_status].bg,
                                color:         STATUS_BADGE[selectedTrip.trip_status].color,
                                flexShrink:    0,
                              }}
                            >
                              {STATUS_BADGE[selectedTrip.trip_status].label}
                            </span>
                          </div>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--neutral-500)' }}>
                            {fmtDateRange(selectedTrip.start_date, selectedTrip.end_date)}
                            {selectedTrip.trip_status === 'ongoing'
                              ? ` · Jour ${Math.max(1, Math.floor((Date.now() - new Date(`${selectedTrip.start_date}T00:00:00`).getTime()) / 86_400_000) + 1)} / ${selectedTrip.days_total}`
                              : selectedTrip.trip_status === 'future'
                                ? ` · Dans ${Math.max(1, Math.ceil((new Date(`${selectedTrip.start_date}T00:00:00`).getTime() - Date.now()) / 86_400_000))} j`
                                : null}
                          </p>
                        </div>
                      </div>

                      {/* Budget + barre progression */}
                      {selectedTrip.planned_budget != null ? (
                        <div style={{ marginBottom: 'var(--space-3)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                            {editingBudget ? (
                              <BudgetEditor
                                currentBudget={selectedTrip.planned_budget}
                                tripId={selectedTrip.trip_id}
                                onDone={() => setEditingBudget(false)}
                              />
                            ) : (
                              <>
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-500)' }}>Budget</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                                  <span
                                    style={{
                                      fontSize:   11,
                                      fontWeight: 700,
                                      color:      (selectedTrip.consumed_pct ?? 0) > 100 ? 'var(--color-error)' : 'var(--neutral-700)',
                                      fontFamily: 'var(--font-mono)',
                                    }}
                                  >
                                    {`${formatCurrencyFloored(selectedTrip.total_actual)} / ${formatCurrencyFloored(selectedTrip.planned_budget)}`}
                                    {selectedTrip.consumed_pct != null ? ` · ${selectedTrip.consumed_pct.toFixed(0)}%` : ''}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setEditingBudget(true)}
                                    aria-label="Modifier le budget"
                                    style={{ background: 'transparent', border: 'none', padding: 2, cursor: 'pointer', color: 'var(--neutral-400)', display: 'flex' }}
                                  >
                                    <Pencil size={11} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                          {!editingBudget ? (
                            <div style={{ height: 5, borderRadius: 'var(--radius-full)', background: 'var(--neutral-100)', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height:     '100%',
                                  width:      `${Math.min(100, selectedTrip.consumed_pct ?? 0)}%`,
                                  background: (selectedTrip.consumed_pct ?? 0) > 100 ? 'var(--color-error)' : VOYAGE_ACCENT,
                                  borderRadius: 'var(--radius-full)',
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingBudget(true)}
                          style={{
                            display:      'inline-flex',
                            alignItems:   'center',
                            gap:          4,
                            fontSize:     11,
                            fontWeight:   600,
                            color:        VOYAGE_ACCENT_DARK,
                            background:   'transparent',
                            border:       `1px dashed ${VOYAGE_ACCENT}`,
                            borderRadius: 'var(--radius-sm)',
                            padding:      '4px 10px',
                            cursor:       'pointer',
                            marginBottom: 'var(--space-3)',
                          }}
                        >
                          <Plus size={10} />
                          Définir un budget
                        </button>
                      )}

                      {/* KPIs */}
                      <KpiGrid items={kpiItems} />

                      {/* Méta */}
                      <p
                        style={{
                          margin:     'var(--space-3) 0 0',
                          fontSize:   11,
                          color:      'var(--neutral-400)',
                          display:    'flex',
                          flexWrap:   'wrap',
                          gap:        'var(--space-2)',
                        }}
                      >
                        <span>{`${selectedTrip.expense_count} dépense${selectedTrip.expense_count !== 1 ? 's' : ''}`}</span>
                        {selectedTrip.bank_expense_count > 0 ? (
                          <>
                            <span style={{ color: 'var(--neutral-200)' }}>·</span>
                            <span>{`${selectedTrip.bank_expense_count} bancaire${selectedTrip.bank_expense_count !== 1 ? 's' : ''}`}</span>
                          </>
                        ) : null}
                        {selectedTrip.pending_match_count > 0 ? (
                          <>
                            <span style={{ color: 'var(--neutral-200)' }}>·</span>
                            <span style={{ color: '#D97706', fontWeight: 600 }}>
                              {`${selectedTrip.pending_match_count} à rapprocher`}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </section>

                  {/* ── Barre d'actions ──────────────────────────────── */}
                  <div
                    style={{
                      display:  'flex',
                      gap:      'var(--space-2)',
                      margin:   `0 ${PAGE_GUTTER} var(--space-4)`,
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* + Dépense */}
                    <button
                      type="button"
                      onClick={() => setAddExpenseOpen(true)}
                      style={{
                        flex:         '1 0 auto',
                        display:      'inline-flex',
                        alignItems:   'center',
                        justifyContent: 'center',
                        gap:          'var(--space-1)',
                        background:   VOYAGE_ACCENT_DARK,
                        color:        '#fff',
                        border:       'none',
                        borderRadius: 'var(--radius-button)',
                        padding:      '10px var(--space-3)',
                        fontSize:     13,
                        fontWeight:   700,
                        cursor:       'pointer',
                      }}
                    >
                      <Plus size={13} />
                      Dépense
                    </button>

                    {/* Rapprocher */}
                    {(selectedTrip.pending_match_count > 0 || (!matchLoading && matchGroups.length > 0)) ? (
                      <button
                        type="button"
                        onClick={() => setMatchSheetOpen(true)}
                        style={{
                          flex:         '1 0 auto',
                          display:      'inline-flex',
                          alignItems:   'center',
                          justifyContent: 'center',
                          gap:          'var(--space-1)',
                          background:   'rgba(245,158,11,0.10)',
                          color:        '#D97706',
                          border:       '1px solid rgba(245,158,11,0.35)',
                          borderRadius: 'var(--radius-button)',
                          padding:      '10px var(--space-3)',
                          fontSize:     13,
                          fontWeight:   700,
                          cursor:       'pointer',
                        }}
                      >
                        <ArrowRightLeft size={13} />
                        {`Rapprocher (${matchGroups.length})`}
                      </button>
                    ) : null}

                    {/* Transactions bancaires → Flux filtré */}
                    {selectedTrip.bank_expense_count > 0 ? (
                      <button
                        type="button"
                        onClick={() => navigate('/flux')}
                        title="Voir les transactions dans Flux"
                        style={{
                          flex:         '0 0 auto',
                          display:      'inline-flex',
                          alignItems:   'center',
                          justifyContent: 'center',
                          gap:          'var(--space-1)',
                          background:   'var(--neutral-50)',
                          color:        'var(--neutral-600)',
                          border:       '1px solid var(--neutral-200)',
                          borderRadius: 'var(--radius-button)',
                          padding:      '10px var(--space-3)',
                          fontSize:     13,
                          fontWeight:   600,
                          cursor:       'pointer',
                        }}
                      >
                        <ReceiptText size={13} />
                        Transactions
                      </button>
                    ) : null}
                  </div>

                  {/* ── Breakdown par catégorie ───────────────────────── */}
                  {categoryBreakdown.length > 0 ? (
                    <section style={{ margin: `0 ${PAGE_GUTTER} var(--space-4)` }}>
                      <p style={{ margin: '0 0 var(--space-2)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--neutral-400)' }}>
                        Par catégorie
                      </p>
                      <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                        {categoryBreakdown.slice(0, 6).map(cat => (
                          <div
                            key={cat.categoryId}
                            style={{
                              display:      'flex',
                              alignItems:   'center',
                              gap:          'var(--space-2)',
                              background:   'var(--neutral-0)',
                              border:       '1px solid var(--neutral-100)',
                              borderRadius: 'var(--radius-sm)',
                              padding:      'var(--space-2) var(--space-3)',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--neutral-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {cat.categoryName}
                              </p>
                              <div
                                style={{
                                  marginTop:    3,
                                  height:       3,
                                  borderRadius: 'var(--radius-full)',
                                  background:   'var(--neutral-100)',
                                  overflow:     'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    height:       '100%',
                                    width:        `${cat.pct}%`,
                                    background:   VOYAGE_ACCENT,
                                    borderRadius: 'var(--radius-full)',
                                  }}
                                />
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>
                                {formatCurrencyFloored(cat.amount)}
                              </p>
                              <p style={{ margin: 0, fontSize: 10, color: 'var(--neutral-400)' }}>
                                {`${cat.pct.toFixed(0)}% · ${cat.count} dép.`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {/* ── Dernières dépenses ────────────────────────────── */}
                  <section style={{ margin: `0 ${PAGE_GUTTER} var(--space-4)` }}>
                    <p style={{ margin: '0 0 var(--space-2)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--neutral-400)' }}>
                      Dernières dépenses
                    </p>

                    {expLoading ? (
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--neutral-400)' }}>Chargement…</p>
                    ) : recentExpenses.length === 0 ? (
                      <div
                        style={{
                          background:   'var(--neutral-0)',
                          border:       '1px solid var(--neutral-100)',
                          borderRadius: 'var(--radius-md)',
                          padding:      'var(--space-5)',
                          textAlign:    'center',
                          display:      'grid',
                          gap:          'var(--space-2)',
                          justifyItems: 'center',
                        }}
                      >
                        <Plane size={24} color="var(--neutral-300)" />
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--neutral-400)' }}>
                          Aucune dépense enregistrée.
                        </p>
                        <button
                          type="button"
                          onClick={() => setAddExpenseOpen(true)}
                          style={{
                            fontSize:     12,
                            fontWeight:   700,
                            color:        VOYAGE_ACCENT_DARK,
                            background:   'transparent',
                            border:       `1px solid ${VOYAGE_ACCENT}`,
                            borderRadius: 'var(--radius-full)',
                            padding:      '5px 12px',
                            cursor:       'pointer',
                          }}
                        >
                          Ajouter une dépense
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          background:   'var(--neutral-0)',
                          border:       '1px solid var(--neutral-100)',
                          borderRadius: 'var(--radius-md)',
                          padding:      '0 var(--space-3)',
                        }}
                      >
                        {recentExpenses.map(e => <ExpenseRow key={e.source_id} expense={e} />)}
                        {expenses.length > 15 ? (
                          <p style={{ margin: 'var(--space-2) 0', fontSize: 11, color: 'var(--neutral-400)', textAlign: 'center' }}>
                            {`+ ${expenses.length - 15} autres dépenses`}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </section>

                  {/* ── Rapprochements en attente ─────────────────────── */}
                  {matchGroups.length > 0 ? (
                    <section style={{ margin: `0 ${PAGE_GUTTER} var(--space-4)` }}>
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
                          borderRadius: 'var(--radius-md)',
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
                    </section>
                  ) : selectedTrip.expense_count > 0 ? (
                    <section style={{ margin: `0 ${PAGE_GUTTER} var(--space-4)` }}>
                      <div
                        style={{
                          background:   'rgba(46,212,122,0.07)',
                          border:       '1px solid rgba(46,212,122,0.25)',
                          borderRadius: 'var(--radius-md)',
                          padding:      'var(--space-3)',
                          display:      'flex',
                          alignItems:   'center',
                          gap:          'var(--space-2)',
                        }}
                      >
                        <CheckCircle2 size={16} color="var(--color-success)" style={{ flexShrink: 0 }} />
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--neutral-700)' }}>
                          Tout est à jour — aucun rapprochement en attente.
                        </p>
                      </div>
                    </section>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </div>
      </motion.div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <TripManualExpenseModal
        open={addExpenseOpen}
        onClose={() => setAddExpenseOpen(false)}
        initialTripId={selectedTrip?.trip_id}
      />

      <TripExpenseMatchingSheet
        open={matchSheetOpen}
        onClose={() => setMatchSheetOpen(false)}
        tripId={selectedTrip?.trip_id}
        tripName={selectedTrip?.name}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
