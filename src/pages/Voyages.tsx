import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Plus, Pencil, ArrowRightLeft, Plane,
  ReceiptText, AlertCircle, X, Link,
} from 'lucide-react'
import { useTripCockpit, selectDefaultTrip } from '@/features/voyages/hooks/useTripCockpit'
import { useTripExpenses } from '@/features/voyages/hooks/useTripExpenses'
import { useMatchCandidates } from '@/features/voyages/hooks/useMatchCandidates'
import { useUpdateTripBudget } from '@/features/voyages/hooks/useUpdateTripBudget'
import { TripManualExpenseModal } from '@/features/voyages/components/TripManualExpenseModal'
import { TripExpenseMatchingSheet } from '@/features/voyages/components/TripExpenseMatchingSheet'
import { formatCurrencyFloored } from '@/lib/utils'
import type { TripCockpitRow } from '@/lib/types'
import { AmbianceBgScene, tripAmbianceBackground } from '@/features/voyages/components/AmbianceBgScene'
import { useEffect } from 'react'
import { useVoyagesData } from '@/features/voyages/hooks/useVoyagesData'
import { useTransaction } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { TransactionDetailsModal } from '@/components/modals/TransactionDetailsModal'
import { TripTransactionRattachementModal } from '@/features/voyages/components/TripTransactionRattachementModal'

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
}function stripVoyageSuffix(name: string): string {
  return name.replace(/\s+voyage$/i, '').trim()
}

const STATUS_BADGE: Record<TripCockpitRow['trip_status'], { label: string; bg: string; color: string }> = {
  ongoing: { label: 'en cours',  bg: 'rgba(56,189,248,0.15)', color: VOYAGE_ACCENT_DARK },
  future:  { label: 'À venir',   bg: 'rgba(91,87,245,0.12)',  color: 'var(--primary-600)' },
  past:    { label: 'Passé',     bg: 'var(--neutral-100)',    color: 'var(--neutral-500)' },
}

// ─── sous-composants ─────────────────────────────────────────────────────────

// Carte dans le rail horizontal de sélection (format carré avec ambiance graphique)
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
  const tripEmoji = trip.emoji?.trim() || '✈️'

  // Resolve ambiance background color
  const ambianceBg = tripAmbianceBackground(trip.emoji)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      style={{
        display:       'flex',
        flexDirection: 'column',
        padding:       0,
        background:    'var(--neutral-0)',
        border:        `1.5px solid ${isSelected ? VOYAGE_ACCENT : 'var(--neutral-150, var(--neutral-200))'}`,
        borderRadius:  'var(--radius-lg)',
        cursor:        'pointer',
        textAlign:     'left',
        width:         150,
        height:        148,
        flexShrink:    0,
        overflow:      'hidden',
        transition:    'border-color 120ms ease, box-shadow 120ms ease',
        boxShadow:     isSelected ? '0 0 0 2px rgba(56,189,248,0.15), var(--shadow-card)' : 'var(--shadow-card)',
      }}
    >
      {/* Zone supérieure colorée : nom centré, pas d'emoji */}
      <div
        style={{
          position:       'relative',
          width:          '100%',
          height:         88,
          background:     ambianceBg,
          overflow:       'hidden',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          flexShrink:     0,
        }}
      >
        <AmbianceBgScene emoji={tripEmoji} />

        {/* Voile sombre pour garantir la lisibilité du texte */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)' }} />

        {/* Badge statut */}
        <span
          style={{
            position:      'absolute',
            top:           6,
            right:         6,
            zIndex:        2,
            fontSize:      9,
            fontWeight:    700,
            textTransform: trip.trip_status === 'ongoing' ? 'none' : 'uppercase',
            letterSpacing: '0.07em',
            padding:       '1.5px 5px',
            borderRadius:  'var(--radius-sm)',
            background:    trip.trip_status === 'ongoing' ? 'rgba(56,189,248,0.9)' : trip.trip_status === 'future' ? 'rgba(91,87,245,0.9)' : 'rgba(255,255,255,0.85)',
            color:         trip.trip_status === 'past' ? 'var(--neutral-600)' : 'var(--neutral-0)',
            whiteSpace:    'nowrap',
            boxShadow:     '0 1px 3px rgba(0,0,0,0.12)',
          }}
        >
          {badge.label}
        </span>

        {/* Nom centré */}
        <p style={{
          position:     'relative',
          zIndex:       2,
          margin:       0,
          fontSize:     13,
          fontWeight:   800,
          color:        '#fff',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          lineHeight:   1.2,
          textShadow:   '0 1px 4px rgba(0,0,0,0.5)',
          maxWidth:     'calc(100% - 12px)',
          textAlign:    'center',
        }}>
          {trip.name}
        </p>
      </div>

      {/* Partie inférieure : dates + budget, centrés */}
      <div style={{ padding: 'var(--space-1.5) var(--space-3)', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', boxSizing: 'border-box', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 10, color: 'var(--neutral-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
          {fmtDateShort(trip.start_date)} → {fmtDateShort(trip.end_date)}
        </p>
        <div style={{ marginTop: 4 }}>
          {trip.planned_budget ? (
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>
              {hasData
                ? `${formatCurrencyFloored(trip.total_actual)} / ${formatCurrencyFloored(trip.planned_budget)}`
                : formatCurrencyFloored(trip.planned_budget)}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 10, color: 'var(--neutral-400)' }}>
              Sans budget
            </p>
          )}
        </div>
      </div>
    </button>
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

  const {
    allTrips,
    isLoading: tripsLoading,
  } = useTripCockpit()

  // ── Année sélectionnée et filtrage ──────────────────────────────────────
  const [selectedYear, setSelectedYear] = useState<number>(2026)

  // Sync selectedYear if urlTripId is present and matches a trip in allTrips
  useEffect(() => {
    if (urlTripId) {
      const found = allTrips.find(t => t.trip_id === urlTripId)
      if (found) {
        const tripYear = found.year || new Date(`${found.start_date}T00:00:00`).getFullYear()
        if (tripYear === 2025 || tripYear === 2026) {
          setSelectedYear(tripYear)
        }
      }
    }
  }, [urlTripId, allTrips])

  const filteredTrips = useMemo(() => {
    return allTrips.filter(t => t.year === selectedYear || t.start_date.startsWith(String(selectedYear)))
  }, [allTrips, selectedYear])

  // Sélection : URL > auto-sélection parmi les voyages filtrés
  const selectedTrip = useMemo<TripCockpitRow | null>(() => {
    if (urlTripId) {
      const found = allTrips.find(t => t.trip_id === urlTripId)
      if (found) return found
    }
    return selectDefaultTrip(filteredTrips) || selectDefaultTrip(allTrips)
  }, [allTrips, filteredTrips, urlTripId])

  const tripNotFound = !tripsLoading && Boolean(urlTripId) && !allTrips.find(t => t.trip_id === urlTripId)

  // ── Données du voyage sélectionné ───────────────────────────────────────
  const { expenses, categoryBreakdown, isLoading: expLoading } =
    useTripExpenses(selectedTrip?.trip_id ?? null)

  const { groups: matchGroups } =
    useMatchCandidates(selectedTrip?.trip_id ?? undefined)

  // ── États UI ─────────────────────────────────────────────────────────────
  const [addExpenseOpen,   setAddExpenseOpen]   = useState(false)
  const [matchSheetOpen,   setMatchSheetOpen]   = useState(false)
  const [editingBudget,    setEditingBudget]    = useState(false)
  const [annualBudgetModalOpen, setAnnualBudgetModalOpen] = useState(false)
  const [monthlyAverageModalOpen, setMonthlyAverageModalOpen] = useState(false)
  const [transactionsListModalOpen, setTransactionsListModalOpen] = useState(false)
  const [rattachementModalOpen, setRattachementModalOpen] = useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)

  const { data: categories = [] } = useCategories()
  const { data: activeTransaction } = useTransaction(selectedTransactionId)

  // ── Données pour la modale Moyen/mois (sous-catégories voyage de l'année) ──
  const { tripsWithStats } = useVoyagesData(selectedYear)

  const categoryAverages = useMemo(() => {
    const targets = ['Trajet', 'Repas', 'Logement', 'Activités', 'Froustilles']
    const map = new Map<string, number>()
    targets.forEach(t => map.set(t, 0))

    for (const tripStat of tripsWithStats) {
      for (const cat of tripStat.byCategory) {
        const shortName = cat.categoryName
        if (map.has(shortName)) {
          map.set(shortName, map.get(shortName)! + cat.amount)
        } else {
          const matchedTarget = targets.find(t => t.toLowerCase() === shortName.toLowerCase())
          if (matchedTarget) {
            map.set(matchedTarget, map.get(matchedTarget)! + cat.amount)
          }
        }
      }
    }

    const result = targets.map(name => {
      const totalAmount = map.get(name) || 0
      const avgMonthly = totalAmount / 12
      return {
        name,
        totalAmount,
        avgMonthly,
      }
    })

    const maxVal = Math.max(...result.map(r => r.avgMonthly), 0)

    return {
      items: result,
      maxVal,
      hasData: result.some(r => r.totalAmount > 0)
    }
  }, [tripsWithStats])

  const totalMonthlyAverage = useMemo(() => {
    return categoryAverages.items.reduce((sum, item) => sum + item.avgMonthly, 0)
  }, [categoryAverages])

  const handleSelectTrip = useCallback((trip: TripCockpitRow) => {
    navigate(`/voyages/${trip.trip_id}`, { replace: true })
  }, [navigate])

  // ── Calcul des Budgets de l'année sélectionnée ──────────────────────────
  const annualBudget = useMemo(() => {
    return filteredTrips.reduce((sum, t) => sum + (t.planned_budget ?? 0), 0)
  }, [filteredTrips])


  // ── Tri unifié du carrousel de voyages de l'année sélectionnée ──────────
  const sortedTrips = useMemo(() => {
    const ongoing = filteredTrips.filter(t => t.trip_status === 'ongoing')
    const future = filteredTrips.filter(t => t.trip_status === 'future').sort((a, b) => a.start_date.localeCompare(b.start_date))
    const past = filteredTrips.filter(t => t.trip_status === 'past').sort((a, b) => b.end_date.localeCompare(a.end_date))
    return [...ongoing, ...future, ...past]
  }, [filteredTrips])

  // ── KPIs du voyage sélectionné (nouveau design) ───────────────────────────
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
          paddingTop:    'var(--safe-top)',
          paddingRight:  PAGE_GUTTER,
          paddingBottom: 'var(--space-4)',
          paddingLeft:   PAGE_GUTTER,
          boxSizing:     'border-box',
        }}
      >
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', minHeight: 44 }}>
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
        style={{ flex: 1, padding: `var(--space-2) 0 var(--space-4)` }}
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
              {/* ── Titre Centré type Budgets ── */}
              <h2 style={{ margin: 'var(--space-1) 0 var(--space-2)', fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--neutral-900)', letterSpacing: '-0.01em', textAlign: 'center' }}>
                Voyages
              </h2>

              {/* ── Sélecteur d'année type Budgets ── */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedYear(selectedYear === 2026 ? 2025 : 2026)}
                    aria-label="Année précédente"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      width: 24,
                      height: 24,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      opacity: 1,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 0,
                        height: 0,
                        borderTop: '5px solid transparent',
                        borderBottom: '5px solid transparent',
                        borderRight: '7px solid var(--neutral-600)',
                        marginLeft: -1,
                      }}
                    />
                  </button>

                  <span
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 700,
                      color: 'var(--neutral-700)',
                      letterSpacing: '0.01em',
                      minWidth: 44,
                      textAlign: 'center',
                    }}
                  >
                    {selectedYear}
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedYear(selectedYear === 2025 ? 2026 : 2025)}
                    aria-label="Année suivante"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      width: 24,
                      height: 24,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      opacity: 1,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 0,
                        height: 0,
                        borderTop: '5px solid transparent',
                        borderBottom: '5px solid transparent',
                        borderLeft: '7px solid var(--neutral-600)',
                        marginRight: -1,
                      }}
                    />
                  </button>
                </div>
              </div>

              {/* ── Rail unique de sélection des voyages de l'année ── */}
              {sortedTrips.length === 0 ? (
                <div style={{ margin: `0 ${PAGE_GUTTER} var(--space-6)`, padding: 'var(--space-8) var(--space-4)', background: 'var(--neutral-0)', border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--neutral-400)', boxShadow: 'var(--shadow-card)' }}>
                  <Plane size={24} style={{ margin: '0 auto var(--space-2)', color: 'var(--neutral-300)' }} />
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--neutral-700)' }}>Aucun voyage en {selectedYear}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--neutral-400)' }}>Modifiez l'année ou créez un voyage.</p>
                </div>
              ) : (
                <section style={{ marginBottom: 'var(--space-5)' }}>
                  <div
                    className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    style={{ paddingLeft: PAGE_GUTTER, paddingRight: PAGE_GUTTER }}
                  >
                    <div style={{ display: 'inline-flex', gap: 'var(--space-3)', paddingBottom: 4 }}>
                      {sortedTrips.map(trip => (
                        <TripRailCard
                          key={trip.trip_id}
                          trip={trip}
                          isSelected={selectedTrip?.trip_id === trip.trip_id}
                          onSelect={() => handleSelectTrip(trip)}
                        />
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {selectedTrip ? (
                <>
                  {/* ── Carte détail voyage ──────────────────────────── */}
                  <section
                    style={{
                      margin:       `0 ${PAGE_GUTTER} var(--space-4)`,
                      background:   'var(--neutral-0)',
                      border:       '1px solid var(--neutral-200)',
                      borderRadius: 'var(--radius-card)',
                      boxShadow:    'var(--shadow-card)',
                      overflow:     'hidden',
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
                            borderRadius: 'var(--radius-md)',
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

                      {/* Right: amount & actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', zIndex: 1, flexShrink: 0 }}>
                        {editingBudget ? (
                          <BudgetEditor
                            currentBudget={selectedTrip.planned_budget}
                            tripId={selectedTrip.trip_id}
                            onDone={() => setEditingBudget(false)}
                          />
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingBudget(true)}
                              aria-label="Modifier le budget"
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
                                cursor: 'pointer',
                                padding: 0,
                                flexShrink: 0,
                              }}
                            >
                              <Pencil size={11} />
                            </button>
                            <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                              {selectedTrip.planned_budget != null ? formatCurrencyFloored(selectedTrip.planned_budget) : '—'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div style={{ padding: 'var(--space-4)', background: 'var(--neutral-25, #fafafa)' }}>
                      {/* 3 KPI pills */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                        {/* KPI spent */}
                        <div
                          style={{
                            background: 'var(--neutral-0)',
                            border: '1px solid var(--neutral-150)',
                            borderRadius: 'var(--radius-lg)',
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
                            borderRadius: 'var(--radius-lg)',
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
                          <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: isRemainingKpiNegative ? 'var(--color-error)' : 'var(--neutral-800)', whiteSpace: 'nowrap' }}>
                            {remainingKpi}
                          </span>
                        </div>

                        {/* KPI budget/day */}
                        <div
                          style={{
                            background: 'var(--neutral-0)',
                            border: '1px solid var(--neutral-150)',
                            borderRadius: 'var(--radius-lg)',
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
                                color:      (selectedTrip.consumed_pct ?? 0) > 100 ? 'var(--color-error)' : 'var(--neutral-700)',
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
                            onClick={() => setEditingBudget(true)}
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
                              cursor:       'pointer',
                            }}
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
                            borderRadius: 'var(--radius-button)',
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
                            borderRadius: 'var(--radius-button)',
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
                            borderRadius: 'var(--radius-button)',
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
                      {categoryBreakdown.length > 0 ? (
                        <div style={{ display: 'grid', gap: 'var(--space-2.5)', borderTop: '1px solid var(--neutral-100)', paddingTop: 'var(--space-3)' }}>
                          <p style={{ margin: '0 0 var(--space-1)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--neutral-400)' }}>
                            Par poste de dépense
                          </p>
                          {categoryBreakdown.map(cat => {
                            const shortName = stripVoyageSuffix(cat.categoryName)
                            const maxAmount = categoryBreakdown[0]?.amount ?? 1
                            const pct = maxAmount > 0 ? (cat.amount / maxAmount) * 100 : 0
                            return (
                              <div
                                key={cat.categoryId}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '80px 1fr 64px',
                                  alignItems: 'center',
                                  gap: 'var(--space-3)',
                                }}
                              >
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-600)' }}>
                                  {shortName}
                                </span>
                                <div style={{ height: 6, borderRadius: 'var(--radius-full)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${Math.max(0, Math.min(pct, 100))}%`,
                                      height: '100%',
                                      borderRadius: 'var(--radius-full)',
                                      background: '#F59E0B',
                                      transition: 'width 0.3s ease',
                                    }}
                                  />
                                </div>
                                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-850)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  {formatCurrencyFloored(cat.amount)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
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

      {selectedTrip && (
        <TripTransactionRattachementModal
          open={rattachementModalOpen}
          onClose={() => setRattachementModalOpen(false)}
          tripId={selectedTrip.trip_id}
          tripName={selectedTrip.name}
        />
      )}

      <TransactionDetailsModal
        transaction={activeTransaction ?? null}
        categories={categories}
        onClose={() => setSelectedTransactionId(null)}
      />

      {/* Modale détail "Budget annuel" */}
      <AnimatePresence>
        {annualBudgetModalOpen ? (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setAnnualBudgetModalOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 200,
                background: 'rgba(13, 13, 31, 0.52)',
                backdropFilter: 'blur(3px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 var(--space-4)', // Marges horizontales
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
                  maxWidth: 420,
                  background: 'var(--neutral-0)',
                  borderRadius: 'var(--radius-xl)',
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
                    Budget annuel {selectedYear}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAnnualBudgetModalOpen(false)}
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
                <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
                  {filteredTrips.length === 0 ? (
                    <p style={{ margin: 'var(--space-4) 0', fontSize: 13, color: 'var(--neutral-500)', textAlign: 'center' }}>
                      Aucun voyage prévu pour cette année.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3.5)' }}>
                      {filteredTrips.map(trip => (
                        <div
                          key={trip.trip_id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingTop: 'var(--space-1)',
                            paddingBottom: 'var(--space-3)' ,
                            borderBottom: '1px solid var(--neutral-100)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0, flex: 1 }}>
                            <span style={{ fontSize: 18, flexShrink: 0 }}>{trip.emoji?.trim() || '✈️'}</span>
                            <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)', flex: 1 }}>
                              <span style={{ fontSize: 13, fontWeight: 750, color: 'var(--neutral-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {trip.name}
                              </span>
                              <span style={{ fontSize: 10, color: 'var(--neutral-400)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                ({fmtDateShort(trip.start_date)} → {fmtDateShort(trip.end_date)})
                              </span>
                            </div>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', flexShrink: 0, marginLeft: 'var(--space-2)' }}>
                            {trip.planned_budget != null ? formatCurrencyFloored(trip.planned_budget) : '—'}
                          </span>
                        </div>
                      ))}

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingTop: 'var(--space-2)',
                          borderTop: '2.5px double var(--neutral-200)',
                          marginTop: 'var(--space-1)',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)' }}>Total</span>
                        <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                          {formatCurrencyFloored(annualBudget)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {/* Modale détail "Moyen/mois" */}
      <AnimatePresence>
        {monthlyAverageModalOpen ? (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setMonthlyAverageModalOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 200,
                background: 'rgba(13, 13, 31, 0.52)',
                backdropFilter: 'blur(3px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 var(--space-4)', // Marges horizontales
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
                  maxWidth: 420,
                  background: 'var(--neutral-0)',
                  borderRadius: 'var(--radius-xl)',
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
                    Moyenne mensuelle {selectedYear}
                  </p>
                  <button
                    type="button"
                    onClick={() => setMonthlyAverageModalOpen(false)}
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
                <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
                  {!categoryAverages.hasData ? (
                    <p style={{ margin: 'var(--space-4) 0', fontSize: 13, color: 'var(--neutral-500)', textAlign: 'center' }}>
                      Aucune dépense voyage disponible pour cette année.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                      {categoryAverages.items.map(item => {
                        const pct = categoryAverages.maxVal > 0 ? (item.avgMonthly / categoryAverages.maxVal) * 100 : 0
                        return (
                          <div
                            key={item.name}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '80px 1fr 64px',
                              alignItems: 'center',
                              gap: 'var(--space-3)',
                            }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-700)' }}>
                              {item.name}
                            </span>
                            <div style={{ height: 8, borderRadius: 'var(--radius-full)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${Math.max(0, Math.min(pct, 100))}%`,
                                  height: '100%',
                                  borderRadius: 'var(--radius-full)',
                                  background: '#F59E0B',
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-900)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {formatCurrencyFloored(item.avgMonthly)}
                            </span>
                          </div>
                        )
                      })}

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingTop: 'var(--space-2)',
                          borderTop: '2.5px double var(--neutral-200)',
                          marginTop: 'var(--space-1)',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)' }}>Total</span>
                        <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                          {formatCurrencyFloored(totalMonthlyAverage)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {/* Modale liste des Transactions du voyage */}
      <AnimatePresence>
        {transactionsListModalOpen && selectedTrip ? (
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
                  borderRadius: 'var(--radius-xl)',
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
        @keyframes spin { to { transform: rotate(360deg); } }
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
    </div>
  )
}
