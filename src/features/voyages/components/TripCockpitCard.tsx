import { useMemo } from 'react'
import { MapPin, Plus, ArrowRightLeft, ArrowRight, Plane } from 'lucide-react'
import { useTripCockpit } from '../hooks/useTripCockpit'
import type { TripCockpitRow } from '@/lib/types'
import { formatCurrencyFloored } from '@/lib/utils'

// ─── Constantes ───────────────────────────────────────────────────────────────

const MONTHS_FR = [
  'jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
]

const VOYAGE_ACCENT = '#38BDF8'  // --bucket-voyage
const VOYAGE_ACCENT_DARK = '#0284C7'

const STATUS_LABEL: Record<TripCockpitRow['trip_status'], string> = {
  ongoing: 'En cours',
  future:  'À venir',
  past:    'Passé',
}

const STATUS_BADGE: Record<TripCockpitRow['trip_status'], { bg: string; color: string }> = {
  ongoing: { bg: 'rgba(56,189,248,0.15)', color: VOYAGE_ACCENT_DARK },
  future:  { bg: 'rgba(91,87,245,0.10)', color: 'var(--primary-600)' },
  past:    { bg: 'var(--neutral-100)',   color: 'var(--neutral-500)' },
}

// ─── Utilitaires locaux ───────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  const m = MONTHS_FR[d.getMonth()]
  return `${d.getDate()} ${m} ${d.getFullYear()}`
}

function fmtDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`
}

function daysUntil(isoDate: string): number {
  const target = new Date(`${isoDate}T00:00:00`)
  const now    = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((target.getTime() - now.getTime()) / 86_400_000))
}

function daysElapsed(isoStart: string): number {
  const start = new Date(`${isoStart}T00:00:00`)
  const now   = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((now.getTime() - start.getTime()) / 86_400_000))
}

// ─── Composant interne : barre de progression ─────────────────────────────────

function ProgressBar({ pct, accent }: { pct: number; accent: string }) {
  const clamped = Math.min(100, Math.max(0, pct))
  const overBudget = pct > 100
  const barColor = overBudget ? 'var(--color-error)' : accent

  return (
    <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          height: 6,
          borderRadius: 'var(--radius-full)',
          background: 'var(--neutral-100)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${clamped}%`,
            borderRadius: 'var(--radius-full)',
            background: barColor,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  )
}

// ─── Composant interne : tuile KPI ────────────────────────────────────────────

function KpiTile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        background: accent ? `rgba(56,189,248,0.08)` : 'var(--neutral-50)',
        border: `1px solid ${accent ? 'rgba(56,189,248,0.22)' : 'var(--neutral-150, var(--neutral-200))'}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-2) var(--space-3)',
        display: 'grid',
        gap: 2,
        textAlign: 'center',
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--neutral-500)',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: 'var(--neutral-900)',
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ─── Composant interne : carte voyage principal ───────────────────────────────

function TripCard({
  trip,
  onViewDetail,
  onAddExpense,
  onMatch,
}: {
  trip: TripCockpitRow
  onViewDetail?: () => void
  onAddExpense?: () => void
  onMatch?: () => void
}) {
  const badge = STATUS_BADGE[trip.trip_status]
  const consumedPct = trip.consumed_pct ?? 0
  const hasPlannedBudget = trip.planned_budget != null && trip.planned_budget > 0
  const showMatch = trip.pending_match_count > 0

  const dateRange = useMemo(() => {
    const sameYear = trip.start_date.slice(0, 4) === trip.end_date.slice(0, 4)
    return sameYear
      ? `${fmtDateShort(trip.start_date)} → ${fmtDate(trip.end_date)}`
      : `${fmtDate(trip.start_date)} → ${fmtDate(trip.end_date)}`
  }, [trip.start_date, trip.end_date])

  const contextLine = useMemo(() => {
    if (trip.trip_status === 'ongoing') {
      const elapsed = daysElapsed(trip.start_date)
      return `Jour ${elapsed + 1} / ${trip.days_total}`
    }
    if (trip.trip_status === 'future') {
      const d = daysUntil(trip.start_date)
      return d === 0 ? 'Départ aujourd\'hui !' : d === 1 ? 'Départ demain' : `Dans ${d} jours`
    }
    return null
  }, [trip.trip_status, trip.start_date, trip.days_total])

  return (
    <div
      style={{
        background: 'var(--neutral-0)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid var(--neutral-100)',
        overflow: 'hidden',
      }}
    >
      {/* Barre d'accent colorée en haut */}
      <div style={{ height: 3, background: VOYAGE_ACCENT }} />

      <div style={{ padding: 'var(--space-4)' }}>
        {/* ── En-tête: emoji + nom + badge + dates ─────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1.3, flexShrink: 0 }}>
            {trip.emoji ?? '✈️'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Nom + badge sur la même ligne, badge wrap naturellement */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
                marginBottom: 3,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--neutral-900)',
                  lineHeight: 1.2,
                }}
              >
                {trip.name}
              </p>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-full)',
                  background: badge.bg,
                  color: badge.color,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {STATUS_LABEL[trip.trip_status]}
              </span>
            </div>
            {/* Dates + contexte sur une ligne */}
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: 'var(--neutral-500)',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '4px 6px',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <MapPin size={10} style={{ flexShrink: 0 }} />
                {dateRange}
              </span>
              {contextLine ? (
                <span style={{ fontWeight: 600, color: 'var(--neutral-600)' }}>
                  · {contextLine}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {/* ── Barre budget (seulement si planned_budget renseigné) ─────── */}
        {hasPlannedBudget ? (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 'var(--space-1)',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-500)' }}>
                Budget
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: consumedPct > 100 ? 'var(--color-error)' : 'var(--neutral-700)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {`${formatCurrencyFloored(trip.total_actual)} / ${formatCurrencyFloored(trip.planned_budget!)}`}
                {consumedPct > 0 && ` · ${consumedPct.toFixed(0)}%`}
              </span>
            </div>
            <ProgressBar pct={consumedPct} accent={VOYAGE_ACCENT} />
          </div>
        ) : null}

        {/* ── Grille KPI ───────────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: hasPlannedBudget ? 'repeat(3, minmax(0,1fr))' : 'repeat(2, minmax(0,1fr))',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-3)',
          }}
        >
          <KpiTile label="Dépensé" value={formatCurrencyFloored(trip.total_actual)} accent />
          {hasPlannedBudget && trip.remaining != null ? (
            <KpiTile
              label="Reste"
              value={formatCurrencyFloored(Math.max(0, trip.remaining))}
            />
          ) : null}
          {trip.trip_status !== 'future' && trip.avg_per_day > 0 ? (
            <KpiTile label="Moy/j" value={formatCurrencyFloored(trip.avg_per_day)} />
          ) : hasPlannedBudget && trip.days_total > 0 ? (
            <KpiTile
              label="Budget/j"
              value={formatCurrencyFloored((trip.planned_budget ?? 0) / trip.days_total)}
            />
          ) : null}
        </div>

        {/* ── Ligne méta: compteurs ─────────────────────────────────────── */}
        <p
          style={{
            margin: '0 0 var(--space-3) 0',
            fontSize: 11,
            color: 'var(--neutral-400)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
          }}
        >
          <span>{`${trip.expense_count} dépense${trip.expense_count !== 1 ? 's' : ''}`}</span>
          {trip.pending_match_count > 0 ? (
            <>
              <span style={{ color: 'var(--neutral-300)' }}>·</span>
              <span style={{ color: '#D97706', fontWeight: 600 }}>
                {`${trip.pending_match_count} à rapprocher`}
              </span>
            </>
          ) : null}
          {trip.has_pending_manual && trip.pending_match_count === 0 ? (
            <>
              <span style={{ color: 'var(--neutral-300)' }}>·</span>
              <span style={{ color: 'var(--neutral-400)' }}>saisies en attente</span>
            </>
          ) : null}
        </p>

        {/* ── CTAs ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {/* Voir détail — navigue vers /budgets (VoyagesFeaturePage) */}
          <button
            type="button"
            onClick={onViewDetail}
            style={{
              flex: '1 1 auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              border: `1px solid ${VOYAGE_ACCENT}`,
              background: 'transparent',
              color: VOYAGE_ACCENT_DARK,
              borderRadius: 'var(--radius-button)',
              padding: '8px var(--space-3)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 120ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(56,189,248,0.08)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            Voir détail
            <ArrowRight size={12} />
          </button>

          {/* + Dépense — disponible seulement si callback fourni */}
          {onAddExpense ? (
            <button
              type="button"
              onClick={onAddExpense}
              style={{
                flex: '0 0 auto',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                border: '1px solid var(--neutral-200)',
                background: 'var(--neutral-50)',
                color: 'var(--neutral-700)',
                borderRadius: 'var(--radius-button)',
                padding: '8px var(--space-3)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background 120ms ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--neutral-100)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--neutral-50)'
              }}
            >
              <Plus size={12} />
              Dépense
            </button>
          ) : null}

          {/* Rapprocher — uniquement si pending_match_count > 0 ET callback fourni */}
          {showMatch && onMatch ? (
            <button
              type="button"
              onClick={onMatch}
              style={{
                flex: '0 0 auto',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                border: '1px solid rgba(217,119,6,0.4)',
                background: 'rgba(245,158,11,0.08)',
                color: '#D97706',
                borderRadius: 'var(--radius-button)',
                padding: '8px var(--space-3)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background 120ms ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(245,158,11,0.14)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(245,158,11,0.08)'
              }}
            >
              <ArrowRightLeft size={12} />
              {`Rapprocher (${trip.pending_match_count})`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Composant interne : chips voyages à venir ────────────────────────────────

function UpcomingChips({
  trips,
  currentTripId,
}: {
  trips: TripCockpitRow[]
  currentTripId: string
}) {
  const others = trips.filter(t => t.trip_id !== currentTripId).slice(0, 3)
  if (others.length === 0) return null

  return (
    <div>
      <p
        style={{
          margin: '0 0 var(--space-2) 0',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'var(--neutral-400)',
        }}
      >
        Prochains voyages
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {others.map(t => (
          <div
            key={t.trip_id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              background: 'var(--neutral-0)',
              border: '1px solid var(--neutral-100)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-3)',
              boxShadow: '0 1px 4px rgba(28,28,58,0.04)',
            }}
          >
            <span style={{ fontSize: 16 }}>{t.emoji ?? '✈️'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--neutral-800)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.name}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-400)' }}>
                {fmtDate(t.start_date)}
              </p>
            </div>
            {t.planned_budget != null ? (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--neutral-600)',
                  flexShrink: 0,
                }}
              >
                {formatCurrencyFloored(t.planned_budget)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Composant interne : skeleton loading ─────────────────────────────────────

function TripSkeleton() {
  return (
    <div
      style={{
        background: 'var(--neutral-0)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid var(--neutral-100)',
        overflow: 'hidden',
      }}
    >
      <div style={{ height: 3, background: 'var(--neutral-100)' }} />
      <div style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
        {[80, 50, 100, 60].map((w, i) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            style={{
              height: i === 0 ? 20 : i === 2 ? 40 : 14,
              width: `${w}%`,
              background: 'var(--neutral-100)',
              borderRadius: 'var(--radius-sm)',
              animation: 'pulse 1.4s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Composant interne : état vide ────────────────────────────────────────────

function EmptyState({ onViewDetail }: { onViewDetail?: () => void }) {
  return (
    <div
      style={{
        background: 'var(--neutral-0)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid var(--neutral-100)',
        padding: 'var(--space-6)',
        display: 'grid',
        gap: 'var(--space-3)',
        justifyItems: 'center',
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: 36 }}>✈️</span>
      <div>
        <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--neutral-800)' }}>
          Aucun voyage planifié
        </p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-400)', lineHeight: 1.5 }}>
          Planifie ton prochain voyage pour suivre ton budget en temps réel.
        </p>
      </div>
      {onViewDetail ? (
        <button
          type="button"
          onClick={onViewDetail}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: `1px solid ${VOYAGE_ACCENT}`,
            background: 'transparent',
            color: VOYAGE_ACCENT_DARK,
            borderRadius: 'var(--radius-button)',
            padding: '8px var(--space-4)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Plane size={13} />
          Créer un voyage
        </button>
      ) : null}
    </div>
  )
}

// ─── Export principal ─────────────────────────────────────────────────────────

export interface TripCockpitCardProps {
  /**
   * Navigue vers la page de détail voyage (VoyagesFeaturePage dans /budgets).
   * Désactivé si non fourni.
   */
  onViewDetail?: () => void
  /**
   * Ouvre la modale de saisie d'une dépense manuelle.
   * Non affiché si non fourni (feature à venir).
   */
  onAddExpense?: (tripId: string) => void
  /**
   * Ouvre le workflow de rapprochement manuel↔bancaire.
   * Non affiché si non fourni (feature à venir).
   */
  onMatch?: (tripId: string) => void
}

export function TripCockpitCard({ onViewDetail, onAddExpense, onMatch }: TripCockpitCardProps) {
  const { selectedTrip, upcomingTrips, isLoading, error } = useTripCockpit()

  if (isLoading) return <TripSkeleton />

  if (error) {
    return (
      <div
        style={{
          background: 'var(--neutral-0)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--neutral-100)',
          padding: 'var(--space-4)',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-error)' }}>
          Erreur lors du chargement des voyages.
        </p>
      </div>
    )
  }

  if (!selectedTrip) {
    return <EmptyState onViewDetail={onViewDetail} />
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <TripCard
        trip={selectedTrip}
        onViewDetail={onViewDetail}
        onAddExpense={onAddExpense ? () => onAddExpense(selectedTrip.trip_id) : undefined}
        onMatch={onMatch ? () => onMatch(selectedTrip.trip_id) : undefined}
      />
      {upcomingTrips.length > 0 ? (
        <UpcomingChips trips={upcomingTrips} currentTripId={selectedTrip.trip_id} />
      ) : null}
    </div>
  )
}
