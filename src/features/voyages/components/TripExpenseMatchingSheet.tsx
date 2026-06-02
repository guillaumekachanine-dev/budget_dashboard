import { useState, useMemo } from 'react'
import { CheckCircle2, XCircle, ArrowRightLeft, Loader } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useMatchCandidates } from '../hooks/useMatchCandidates'
import { useMatchTripExpense, useDismissTripExpense } from '../hooks/useMatchTripExpense'
import { formatCurrencyFloored } from '@/lib/utils'
import type { MatchCandidateRow, MatchGroup } from '../types'

// ─── constantes ───────────────────────────────────────────────────────────────

const VOYAGE_ACCENT      = '#38BDF8'
const VOYAGE_ACCENT_DARK = '#0284C7'

const MONTHS_FR = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin',
                   'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`
}

// ─── raisons du score ─────────────────────────────────────────────────────────

function scoreReasons(c: MatchCandidateRow): string[] {
  const r: string[] = []
  if (c.amount_delta_pct  <= 5)  r.push('Montant quasi-identique')
  else if (c.amount_delta_pct <= 30) r.push('Montant proche (±30%)')
  if (c.date_delta_days   === 0) r.push('Même jour')
  else if (c.date_delta_days <= 3)   r.push('Date très proche (±3j)')
  else if (c.date_delta_days <= 7)   r.push('Date proche (±7j)')
  else if (c.date_delta_days <= 14)  r.push('Date dans ±14j')
  if (c.category_match)              r.push('Même catégorie')
  return r
}

function scoreColor(score: number): string {
  if (score >= 80) return '#16A34A'  // vert fort
  if (score >= 50) return VOYAGE_ACCENT_DARK
  return 'var(--neutral-400)'
}

// ─── sous-composant : une carte candidat ─────────────────────────────────────

function CandidateCard({
  candidate,
  onMatch,
  isBusy,
  glass = false,
}: {
  candidate: MatchCandidateRow
  onMatch:   () => void
  isBusy:    boolean
  glass?:    boolean
}) {
  const reasons = useMemo(() => scoreReasons(candidate), [candidate])
  const color   = scoreColor(candidate.confidence_score)
  const txLabel = candidate.tx_merchant ?? candidate.tx_label ?? '—'

  return (
    <div
      style={{
        border:       glass ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--neutral-150, var(--neutral-200))',
        borderRadius: 'var(--radius-md)',
        background:   glass ? 'rgba(255, 255, 255, 0.05)' : 'var(--neutral-0)',
        overflow:     'hidden',
      }}
    >
      {/* Score header bar */}
      <div
        style={{
          height:     3,
          background: color,
          width:      `${Math.min(100, candidate.confidence_score)}%`,
        }}
      />

      <div style={{ padding: 'var(--space-3)' }}>
        {/* Score + info principale */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)', gap: 'var(--space-2)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin:        0,
                fontSize:      14,
                fontWeight:    700,
                color:         glass ? '#FFFFFF' : 'var(--neutral-900)',
                overflow:      'hidden',
                textOverflow:  'ellipsis',
                whiteSpace:    'nowrap',
              }}
            >
              {txLabel}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: glass ? 'rgba(255, 255, 255, 0.5)' : 'var(--neutral-500)' }}>
              {fmtDate(candidate.tx_date)}
              {candidate.tx_category_name ? ` · ${candidate.tx_category_name}` : ''}
            </p>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p
              style={{
                margin:     0,
                fontSize:   15,
                fontWeight: 800,
                color:      glass ? '#FFFFFF' : 'var(--neutral-900)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {formatCurrencyFloored(candidate.tx_amount)}
            </p>
            <p
              style={{
                margin:     '2px 0 0',
                fontSize:   10,
                fontWeight: 700,
                color,
              }}
            >
              {`Score ${candidate.confidence_score}/100`}
            </p>
          </div>
        </div>

        {/* Raisons du score */}
        {reasons.length > 0 ? (
          <div
            style={{
              display:    'flex',
              flexWrap:   'wrap',
              gap:        'var(--space-1)',
              marginBottom: 'var(--space-3)',
            }}
          >
            {reasons.map((r) => (
              <span
                key={r}
                style={{
                  fontSize:        10,
                  fontWeight:      600,
                  padding:         '2px 6px',
                  borderRadius:    'var(--radius-full)',
                  background:      glass ? 'rgba(56, 189, 248, 0.15)' : `${color}18`,
                  color:           glass ? '#38BDF8' : color,
                  border:          `1px solid ${glass ? 'rgba(56, 189, 248, 0.25)' : `${color}30`}`,
                  whiteSpace:      'nowrap',
                }}
              >
                {r}
              </span>
            ))}
          </div>
        ) : null}

        {/* Différences si notable */}
        {(candidate.amount_delta_pct > 5 || candidate.date_delta_days > 3) ? (
          <p
            style={{
              margin:     '0 0 var(--space-2)',
              fontSize:   11,
              color:      glass ? 'rgba(255, 255, 255, 0.4)' : 'var(--neutral-400)',
            }}
          >
            {candidate.amount_delta_pct > 5
              ? `Écart montant : ${candidate.amount_delta_pct.toFixed(1)}%`
              : ''}
            {candidate.amount_delta_pct > 5 && candidate.date_delta_days > 3 ? ' · ' : ''}
            {candidate.date_delta_days > 3
              ? `Écart date : ${candidate.date_delta_days}j`
              : ''}
          </p>
        ) : null}

        {/* CTA Rapprocher */}
        <button
          type="button"
          onClick={onMatch}
          disabled={isBusy}
          style={{
            width:          '100%',
            display:        'inline-flex',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            'var(--space-2)',
            padding:        '8px var(--space-3)',
            fontSize:       13,
            fontWeight:     700,
            borderRadius:   'var(--radius-button)',
            border:         `1px solid ${VOYAGE_ACCENT}`,
            background:     isBusy
              ? (glass ? 'rgba(255, 255, 255, 0.06)' : 'var(--neutral-100)')
              : (glass ? 'rgba(56, 189, 248, 0.12)' : 'rgba(56,189,248,0.08)'),
            color:          isBusy
              ? (glass ? 'rgba(255, 255, 255, 0.3)' : 'var(--neutral-400)')
              : VOYAGE_ACCENT_DARK,
            cursor:         isBusy ? 'wait' : 'pointer',
            transition:     'background 120ms ease',
          }}
        >
          {isBusy ? (
            <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <CheckCircle2 size={13} />
          )}
          Rapprocher
        </button>
      </div>
    </div>
  )
}

// ─── sous-composant : un groupe de dépense manuelle ──────────────────────────

function ExpenseGroup({
  group,
  busyManualId,
  onMatch,
  onDismiss,
  glass = false,
}: {
  group:         MatchGroup
  busyManualId:  string | null
  onMatch:       (manualId: string, txId: string, tripId: string) => void
  onDismiss:     (manualId: string) => void
  glass?:        boolean
}) {
  const isBusy = busyManualId === group.manualExpenseId

  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      {/* Dépense manuelle (source) */}
      <div
        style={{
          background:   glass ? 'rgba(56, 189, 248, 0.12)' : 'rgba(56,189,248,0.07)',
          border:       `1px solid ${glass ? 'rgba(56, 189, 248, 0.25)' : 'rgba(56,189,248,0.22)'}`,
          borderRadius: 'var(--radius-md)',
          padding:      'var(--space-3)',
          display:      'flex',
          justifyContent: 'space-between',
          alignItems:   'center',
          gap:          'var(--space-2)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: glass ? '#FFFFFF' : 'var(--neutral-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {group.manualLabel}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: glass ? 'rgba(255, 255, 255, 0.5)' : 'var(--neutral-500)' }}>
            Saisie manuelle · {fmtDate(group.expenseDate)}
            {group.manualCategoryName ? ` · ${group.manualCategoryName}` : ''}
          </p>
        </div>
        <p
          style={{
            margin:     0,
            fontSize:   15,
            fontWeight: 800,
            color:      glass ? '#FFFFFF' : 'var(--neutral-900)',
            fontFamily: 'var(--font-mono)',
            flexShrink: 0,
          }}
        >
          {formatCurrencyFloored(group.manualAmount)}
        </p>
      </div>

      {/* Liste des candidats */}
      {group.candidates.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: glass ? 'rgba(255, 255, 255, 0.5)' : 'var(--neutral-400)', textAlign: 'center', padding: 'var(--space-2) 0' }}>
          Aucune transaction bancaire correspondante trouvée.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          {group.candidates.map((c) => (
            <CandidateCard
              key={c.candidate_tx_id}
              candidate={c}
              isBusy={isBusy}
              glass={glass}
              onMatch={() => onMatch(group.manualExpenseId, c.candidate_tx_id, group.tripId)}
            />
          ))}
        </div>
      )}

      {/* Ignorer toute cette dépense */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => onDismiss(group.manualExpenseId)}
          disabled={isBusy}
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            gap:            4,
            fontSize:       11,
            fontWeight:     600,
            color:          glass ? 'rgba(255, 255, 255, 0.6)' : 'var(--neutral-400)',
            background:     'transparent',
            border:         `1px solid ${glass ? 'rgba(255, 255, 255, 0.15)' : 'var(--neutral-200)'}`,
            borderRadius:   'var(--radius-full)',
            padding:        '4px 10px',
            cursor:         isBusy ? 'wait' : 'pointer',
          }}
        >
          <XCircle size={11} />
          Ignorer cette dépense
        </button>
      </div>
    </div>
  )
}

// ─── composant principal ──────────────────────────────────────────────────────

interface TripExpenseMatchingSheetProps {
  open:      boolean
  onClose:   () => void
  /** Si fourni, filtre les candidats sur ce voyage */
  tripId?:   string | null
  tripName?: string | null
  glass?:    boolean
  glassBackground?: string
  glassBorder?: string
}

export function TripExpenseMatchingSheet({
  open,
  onClose,
  tripId,
  tripName,
  glass = false,
  glassBackground,
  glassBorder,
}: TripExpenseMatchingSheetProps) {
  const { groups, totalPending, isLoading, error } = useMatchCandidates(tripId ?? undefined)

  const matchMutation   = useMatchTripExpense()
  const dismissMutation = useDismissTripExpense()

  // L'id de la dépense manuelle en cours de traitement (pour désactiver les boutons)
  const [busyManualId, setBusyManualId] = useState<string | null>(null)
  const [actionError,  setActionError]  = useState<string | null>(null)

  const isBusy = matchMutation.isPending || dismissMutation.isPending

  async function handleMatch(manualId: string, txId: string, tId: string) {
    setActionError(null)
    setBusyManualId(manualId)
    try {
      await matchMutation.mutateAsync({ manualExpenseId: manualId, transactionId: txId, tripId: tId })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur lors du rapprochement.')
    } finally {
      setBusyManualId(null)
    }
  }

  async function handleDismiss(manualId: string) {
    setActionError(null)
    setBusyManualId(manualId)
    try {
      await dismissMutation.mutateAsync({ manualExpenseId: manualId })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur lors de la mise à jour.')
    } finally {
      setBusyManualId(null)
    }
  }

  const headerTitle = useMemo(() => {
    const prefix = tripName ? `${tripName} · ` : ''
    if (isLoading) return `${prefix}Chargement…`
    if (totalPending === 0) return `${prefix}Aucun rapprochement en attente`
    return `${prefix}${totalPending} dépense${totalPending > 1 ? 's' : ''} à rapprocher`
  }, [isLoading, totalPending, tripName])

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="92dvh"
      zIndex={260}
      variant={glass ? "center" : "sheet"}
      glass={glass}
      glassBackground={glassBackground}
      glassBorder={glassBorder}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1 }}>
          <ArrowRightLeft size={16} color={VOYAGE_ACCENT_DARK} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 800, color: glass ? 'rgba(255, 255, 255, 0.88)' : 'var(--neutral-900)' }}>
            {headerTitle}
          </p>
        </div>
      }
    >
      <div style={{ padding: 'var(--space-4) var(--space-5) var(--space-8)', display: 'grid', gap: 'var(--space-6)' }}>

        {/* Erreur globale */}
        {(error ?? actionError) ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-error)' }}>
            {actionError ?? (error instanceof Error ? error.message : 'Erreur de chargement.')}
          </p>
        ) : null}

        {/* Loading */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8) 0' }}>
            <Loader size={24} color={VOYAGE_ACCENT} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : groups.length === 0 ? (
          /* État vide */
          <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', display: 'grid', gap: 'var(--space-3)' }}>
            <CheckCircle2 size={36} color="var(--color-success)" style={{ margin: '0 auto' }} />
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: glass ? '#FFFFFF' : 'var(--neutral-800)' }}>
                Tout est à jour !
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: glass ? 'rgba(255, 255, 255, 0.5)' : 'var(--neutral-400)', lineHeight: 1.5 }}>
                Aucune dépense manuelle en attente de rapprochement.
              </p>
            </div>
          </div>
        ) : (
          /* Groupes de candidats */
          <>
            <p style={{ margin: 0, fontSize: 12, color: glass ? 'rgba(255, 255, 255, 0.6)' : 'var(--neutral-500)', lineHeight: 1.5 }}>
              Chaque dépense saisie manuellement est rapprochée avec une transaction bancaire importée.
              Une fois rapprochée, elle ne sera plus comptée en double dans le cockpit.
            </p>

            {groups.map((group) => (
              <ExpenseGroup
                key={group.manualExpenseId}
                group={group}
                busyManualId={isBusy ? busyManualId : null}
                glass={glass}
                onMatch={handleMatch}
                onDismiss={handleDismiss}
              />
            ))}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </BottomSheet>
  )
}
