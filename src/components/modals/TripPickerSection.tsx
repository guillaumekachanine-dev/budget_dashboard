import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { X, ArrowRight } from 'lucide-react'
import { QK, STALE } from '@/lib/queryKeys'
import { getAllTrips } from '@/features/voyages/api/getVoyagesData'
import { useAssignTripToTransaction } from '@/hooks/useTransactions'
import type { Transaction } from '@/lib/types'
import type { Trip } from '@/features/voyages/types'

// ─── constantes ───────────────────────────────────────────────────────────────

const VOYAGE_ACCENT = '#38BDF8'

const MONTHS_FR = [
  'jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
]

function fmtDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

function fmtRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${MONTHS_FR[s.getMonth()]} ${s.getFullYear()}`
  }
  return `${fmtDateShort(start)} → ${fmtDateShort(end)}`
}

// ─── ranking ──────────────────────────────────────────────────────────────────

type Rank = 'matching' | 'close' | 'other'

interface RankedTrip extends Trip {
  rank: Rank
  daysDistance: number
}

function rankTrips(trips: Trip[], txDateStr: string): RankedTrip[] {
  const txMs = new Date(`${txDateStr}T00:00:00`).getTime()

  const ranked = trips.map<RankedTrip>((trip) => {
    const startMs = new Date(`${trip.start_date}T00:00:00`).getTime()
    const endMs   = new Date(`${trip.end_date}T00:00:00`).getTime()

    // Dans la période du voyage
    if (txMs >= startMs && txMs <= endMs) {
      return { ...trip, rank: 'matching', daysDistance: 0 }
    }

    // Nombre de jours depuis le début ou la fin (le plus proche)
    const daysToStart = Math.abs(txMs - startMs) / 86_400_000
    const daysFromEnd = Math.abs(txMs - endMs)   / 86_400_000
    const daysDistance = Math.min(daysToStart, daysFromEnd)

    const rank: Rank = daysDistance <= 30 ? 'close' : 'other'
    return { ...trip, rank, daysDistance }
  })

  const rankOrder: Record<Rank, number> = { matching: 0, close: 1, other: 2 }

  return ranked.sort((a, b) => {
    if (rankOrder[a.rank] !== rankOrder[b.rank]) {
      return rankOrder[a.rank] - rankOrder[b.rank]
    }
    // À rang égal : plus proche en date d'abord
    return a.daysDistance - b.daysDistance
  })
}

// ─── sous-composant : ligne voyage dans le picker ─────────────────────────────

function TripOption({
  trip,
  isSelected,
  isSaving,
  onSelect,
}: {
  trip: RankedTrip
  isSelected: boolean
  isSaving: boolean
  onSelect: () => void
}) {
  const rankLabel: Record<Rank, string | null> = {
    matching: '✓ Période',
    close:    'Proche',
    other:    null,
  }
  const hint = rankLabel[trip.rank]

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isSaving}
      aria-pressed={isSelected}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-3)',
        background: isSelected ? 'rgba(56,189,248,0.10)' : 'transparent',
        border: `1px solid ${isSelected ? VOYAGE_ACCENT : 'var(--neutral-150, var(--neutral-200))'}`,
        borderRadius: 'var(--radius-sm)',
        cursor: isSaving ? 'wait' : 'pointer',
        textAlign: 'left',
        transition: 'background 100ms ease, border-color 100ms ease',
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{trip.emoji ?? '✈️'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--neutral-900)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {trip.name}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-500)' }}>
          {fmtRange(trip.start_date, trip.end_date)}
        </p>
      </div>
      {hint ? (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: trip.rank === 'matching' ? VOYAGE_ACCENT : 'var(--neutral-400)',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {hint}
        </span>
      ) : null}
    </button>
  )
}

// ─── composant principal ──────────────────────────────────────────────────────

interface TripPickerSectionProps {
  transaction: Transaction
  pickerOpen: boolean
  setPickerOpen: (open: boolean) => void
}

export function TripPickerSection({ transaction, pickerOpen, setPickerOpen }: TripPickerSectionProps) {
  const navigate = useNavigate()
  const [saveError, setSaveError] = useState<string | null>(null)
  // État local optimiste : mis à jour immédiatement après mutation,
  // en avance sur la re-prop du parent (qui arrive après invalidation + refetch).
  const [localTripId, setLocalTripId] = useState<string | null>(transaction.trip_id ?? null)

  // Sync quand la prop change (navigation vers une autre transaction)
  useEffect(() => {
    setLocalTripId(transaction.trip_id ?? null)
  }, [transaction.id, transaction.trip_id])

  // Ne proposer l'affectation que sur les dépenses
  if (transaction.flow_type !== 'expense') return null

  const tripsQuery = useQuery({
    queryKey: [QK.VOYAGES_ALL],
    queryFn: getAllTrips,
    staleTime: STALE.ANALYTICS,
  })

  const trips = tripsQuery.data ?? []

  const rankedTrips = useMemo(
    () => rankTrips(trips, transaction.transaction_date),
    [trips, transaction.transaction_date],
  )

  // Utilise l'état local optimiste (pas la prop stale) pour l'affichage immédiat
  const currentTrip = useMemo(
    () => trips.find(t => t.id === localTripId) ?? null,
    [trips, localTripId],
  )

  const assignMutation = useAssignTripToTransaction()
  const isSaving = assignMutation.isPending

  async function handleAssign(tripId: string | null) {
    setSaveError(null)
    try {
      await assignMutation.mutateAsync({ txId: transaction.id, tripId })
      // Mise à jour optimiste immédiate — le refetch du cache se fait en arrière-plan
      setLocalTripId(tripId)
      setPickerOpen(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    }
  }

  if (!currentTrip && !pickerOpen && !saveError) return null

  return (
    <div
      style={{
        borderTop: '1px solid var(--neutral-150, var(--neutral-200))',
        paddingTop: 'var(--space-3)',
        marginTop: 'var(--space-1)',
        display: 'grid',
        gap: 'var(--space-2)',
      }}
    >
      {/* ── Voyage actuel (si rattaché) ─────────────────────────────────── */}
      {currentTrip ? (
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              background: 'rgba(56,189,248,0.07)',
              border: `1px solid rgba(56,189,248,0.25)`,
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>{currentTrip.emoji ?? '✈️'}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--neutral-900)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {currentTrip.name}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-500)' }}>
                {fmtRange(currentTrip.start_date, currentTrip.end_date)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/voyages/${currentTrip.id}`)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 700,
              color: VOYAGE_ACCENT,
              background: 'transparent',
              border: `1px solid rgba(56,189,248,0.35)`,
              borderRadius: 'var(--radius-full)',
              padding: '3px 10px',
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            Voir le voyage
            <ArrowRight size={10} />
          </button>
        </div>
      ) : null}

      {/* ── Picker: liste déroulante de voyages ─────────────────────────── */}
      {pickerOpen ? (
        <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
          {rankedTrips.length === 0 ? (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-400)', textAlign: 'center', padding: 'var(--space-2) 0' }}>
              Aucun voyage enregistré
            </p>
          ) : (
            <>
              {currentTrip && (
                <button
                  type="button"
                  onClick={() => handleAssign(null)}
                  disabled={isSaving}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'transparent',
                    border: '1px dashed var(--neutral-300)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: isSaving ? 'wait' : 'pointer',
                    textAlign: 'left',
                    color: 'var(--neutral-500)',
                    fontSize: 12,
                    fontWeight: 600,
                    transition: 'all 100ms ease',
                  }}
                >
                  <X size={14} />
                  Retirer l&apos;affectation au voyage
                </button>
              )}
              {rankedTrips.map(trip => (
                <TripOption
                  key={trip.id}
                  trip={trip}
                  isSelected={trip.id === localTripId}
                  isSaving={isSaving}
                  onSelect={() => handleAssign(trip.id === localTripId ? null : trip.id)}
                />
              ))}
            </>
          )}
        </div>
      ) : null}

      {/* ── Erreur ─────────────────────────────────────────────────────── */}
      {saveError ? (
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: 'var(--color-error)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {saveError}
        </p>
      ) : null}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
