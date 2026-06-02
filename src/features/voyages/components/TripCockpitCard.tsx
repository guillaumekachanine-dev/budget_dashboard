import { useMemo } from 'react'
import { ArrowRightLeft, ArrowRight, Plane, ShoppingBag } from 'lucide-react'
import { useTripExpenses } from '../hooks/useTripExpenses'
import type { TripExpenseRow } from '../types'
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

// ─── Utilitaires locaux ───────────────────────────────────────────────────────

function fmtDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`
}



function daysElapsed(isoStart: string): number {
  const start = new Date(`${isoStart}T00:00:00`)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((now.getTime() - start.getTime()) / 86_400_000))
}

function TripProgressRing({
  pct,
  size = 136,
  amountText,
  label = 'Reste utile'
}: {
  pct: number
  size?: number
  amountText: string
  label?: string
}) {
  const sw = 10
  const r = (size - sw) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const progress = Math.max(0, Math.min(1, pct / 100))
  const dashOffset = circumference * (1 - progress)

  const trackColor = 'rgba(255, 255, 255, 0.12)'
  const arcColor = pct > 100 ? '#FC5A5A' : '#FB923C'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ display: 'block', transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={sw} />
        {progress > 0 ? (
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arcColor}
            strokeWidth={sw}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        ) : null}
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', width: '100%', padding: '0 8px', boxSizing: 'border-box' }}>
        <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#FFFFFF', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
          {amountText}
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
          {label}
        </span>
      </div>
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
  const consumedPct = trip.consumed_pct ?? 0
  const hasPlannedBudget = trip.planned_budget != null && trip.planned_budget > 0
  const showMatch = trip.pending_match_count > 0

  const dateRange = useMemo(() => {
    return `${fmtDateShort(trip.start_date)} → ${fmtDateShort(trip.end_date)}`
  }, [trip.start_date, trip.end_date])

  const contextLine = useMemo(() => {
    if (trip.trip_status === 'ongoing') {
      const elapsed = daysElapsed(trip.start_date)
      return `Jour ${elapsed + 1} / ${trip.days_total}`
    }
    return null
  }, [trip.trip_status, trip.start_date, trip.days_total])

  const budget = trip.planned_budget ?? 0
  const consumed = trip.total_actual
  const resteUtile = budget - consumed

  return (
    <div
      style={{
        background: 'radial-gradient(120% 90% at 14% -8%, rgba(251, 146, 60, 0.25) 0%, rgba(251, 146, 60, 0) 58%), radial-gradient(98% 82% at 100% 100%, rgba(244, 63, 94, 0.15) 0%, rgba(244, 63, 94, 0) 62%), linear-gradient(145deg, #171210 0%, #241D1A 47%, #3E2F2A 100%)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid rgba(251, 146, 60, 0.2)',
        overflow: 'hidden',
        padding: 'var(--space-4)',
        display: 'grid',
        gap: 'var(--space-4)',
      }}
    >
      {/* ── Header: Nom + Dates ───────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
        {/* 1. Nom seul — sans émoji ni pastille statut */}
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {trip.name}
          </h3>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
            {dateRange}
          </span>
          {contextLine && (
            <p style={{ margin: '2px 0 0', fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
              {contextLine}
            </p>
          )}
        </div>
      </div>

      {/* ── Central Progress Ring ───────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-2) 0' }}>
        <TripProgressRing
          pct={consumedPct}
          amountText={formatCurrencyFloored(resteUtile)}
        />
      </div>

      {/* ── 2. Ligne consommation unifiée ─────────────────────────────── */}
      <div style={{ textAlign: 'center', display: 'grid', gap: 2 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>
          {hasPlannedBudget ? (
            <>
              {'Consommé : '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrencyFloored(consumed)}</span>
            </>
          ) : (
            <>
              {'Dépensé\u00a0: '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrencyFloored(consumed)}</span>
              {'\u00a0€'}
            </>
          )}
        </p>
        {hasPlannedBudget && (
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
            {consumedPct.toFixed(0)}% consommé
          </p>
        )}
      </div>

      {/* ── 3. CTAs — mêmes dimensions, même ligne ──────────── */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
        {onAddExpense ? (
          <button
            type="button"
            onClick={onAddExpense}
            style={{
              flex: '1 1 0',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              border: '1px solid color-mix(in oklab, var(--color-warning) 48%, rgba(255,255,255,0.22) 52%)',
              background: 'color-mix(in oklab, var(--color-warning) 8%, rgba(255,255,255,0.04) 92%)',
              color: 'rgba(255,255,255,0.94)',
              borderRadius: 'var(--radius-button)',
              padding: '8px var(--space-3)',
              minHeight: 40,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 120ms ease, border-color 120ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'color-mix(in oklab, var(--color-warning) 13%, rgba(255,255,255,0.05) 87%)'
              e.currentTarget.style.borderColor = 'color-mix(in oklab, var(--color-warning) 62%, rgba(255,255,255,0.24) 38%)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'color-mix(in oklab, var(--color-warning) 8%, rgba(255,255,255,0.04) 92%)'
              e.currentTarget.style.borderColor = 'color-mix(in oklab, var(--color-warning) 48%, rgba(255,255,255,0.22) 52%)'
            }}
          >
            + dépense
          </button>
        ) : null}

        <button
          type="button"
          onClick={onViewDetail}
          style={{
            flex: '1 1 0',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.1)',
            color: '#FFFFFF',
            borderRadius: 'var(--radius-button)',
            padding: '8px var(--space-3)',
            minHeight: 40,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 120ms ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.18)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
          }}
        >
          Voir détails
          <ArrowRight size={12} />
        </button>

        {showMatch && onMatch ? (
          <button
            type="button"
            onClick={onMatch}
            style={{
              flex: '1 1 0',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              border: '1px solid rgba(255,171,46,0.4)',
              background: 'rgba(255,171,46,0.12)',
              color: '#FFAB2E',
              borderRadius: 'var(--radius-button)',
              padding: '8px var(--space-3)',
              minHeight: 40,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 120ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,171,46,0.2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,171,46,0.12)'
            }}
          >
            <ArrowRightLeft size={12} />
            {`Rapprocher (${trip.pending_match_count})`}
          </button>
        ) : null}
      </div>
    </div>
  )
}

// ─── Composant interne : dernières transactions du voyage ─────────────────────

function RecentTransactions({
  expenses,
  isLoading,
}: {
  expenses: TripExpenseRow[]
  isLoading: boolean
}) {
  const recent = useMemo(() => expenses.slice(0, 5), [expenses])

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-3)',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--neutral-500)',
          }}
        >
          Dernières transactions
        </p>
      </div>

      {/* Body */}
      {isLoading ? (
        /* Skeleton */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {[70, 90, 55].map((w, i) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              style={{
                height: 44,
                background: 'var(--neutral-100)',
                borderRadius: 'var(--radius-md)',
                width: `${w}%`,
                animation: 'pulse 1.4s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      ) : recent.length === 0 ? (
        /* Empty state */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-5) var(--space-4)',
            background: 'rgba(255,255,255,0.04)',
            border: '1px dashed rgba(255,255,255,0.12)',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
          }}
        >
          <ShoppingBag size={20} color="rgba(255,255,255,0.3)" />
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            Aucune transaction pour ce voyage
          </p>
        </div>
      ) : (
        /* Transaction list */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {recent.map((tx, idx) => {
            const dateStr = new Date(`${tx.expense_date}T00:00:00`).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
            })
            const isLast = idx === recent.length - 1
            return (
              <div
                key={`${tx.source_type}-${tx.source_id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: '10px var(--space-3)',
                  borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {/* Date badge */}
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 10,
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    color: 'rgba(255,255,255,0.45)',
                    width: 38,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {dateStr}
                </span>

                {/* Label */}
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.9)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tx.label || tx.category_name || '—'}
                </span>

                {/* Amount */}
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 13,
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: '#FB923C',
                  }}
                >
                  {formatCurrencyFloored(tx.personal_amount)}
                </span>
              </div>
            )
          })}
        </div>
      )}
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
   * Navigue vers /voyages/:tripId si tripId fourni, sinon /voyages.
   * Désactivé si non fourni.
   */
  onViewDetail?: (tripId?: string) => void
  /**
   * Ouvre la modale de saisie d'une dépense manuelle.
   * Non affiché si non fourni (feature à venir).
   */
  onAddExpense?: (tripId: string) => void
  /**
   * Ouvre le workflow de rapprochement manuel↔bancaire.
   * Non affiché si non fourni (feature à venir).
   */
  /** tripId + tripName pour pré-filtrer et titrer le sheet de rapprochement */
  onMatch?: (tripId: string, tripName: string) => void
}

export function TripCockpitCard({ onViewDetail, onAddExpense, onMatch }: TripCockpitCardProps) {
  const { selectedTrip, isLoading, error } = useTripCockpit()
  const { expenses: tripExpenses, isLoading: expensesLoading } = useTripExpenses(
    selectedTrip?.trip_id ?? null
  )

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
        onViewDetail={onViewDetail ? () => onViewDetail(selectedTrip.trip_id) : undefined}
        onAddExpense={onAddExpense ? () => onAddExpense(selectedTrip.trip_id) : undefined}
        onMatch={onMatch ? () => onMatch(selectedTrip.trip_id, selectedTrip.name) : undefined}
      />
      <RecentTransactions
        expenses={tripExpenses}
        isLoading={expensesLoading}
      />
    </div>
  )
}
