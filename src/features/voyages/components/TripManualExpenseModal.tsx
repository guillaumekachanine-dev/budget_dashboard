import { useState, useMemo, useEffect } from 'react'
import { Plane, CheckCircle } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useAllTrips } from '@/features/voyages/hooks/useAllTrips'
import { useCategories } from '@/hooks/useCategories'
import { useCreateTripManualExpense } from '../hooks/useCreateTripManualExpense'

// ─── constantes ───────────────────────────────────────────────────────────────

const VOYAGE_ACCENT      = '#38BDF8'
const VOYAGE_ACCENT_DARK = '#0284C7'
const VOYAGES_PARENT_ID  = 'a975a6e6-62d9-4686-8107-f4d76a7bd93d'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── styles réutilisables ─────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--neutral-500)',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--neutral-900)',
  background: 'var(--neutral-50)',
  border: '1px solid var(--neutral-200)',
  borderRadius: 'var(--radius-md)',
  padding: '10px var(--space-3)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  transition: 'border-color 120ms ease',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 32,
  cursor: 'pointer',
}

// ─── props ────────────────────────────────────────────────────────────────────

interface TripManualExpenseModalProps {
  open: boolean
  onClose: () => void
  /** Pré-sélectionne ce voyage à l'ouverture */
  initialTripId?: string | null
}

// ─── composant ────────────────────────────────────────────────────────────────

export function TripManualExpenseModal({
  open,
  onClose,
  initialTripId,
}: TripManualExpenseModalProps) {
  // ── données de référence ────────────────────────────────────────────────────
  const { trips } = useAllTrips()
  const { data: allCategories = [] } = useCategories('expense')

  const voyageCategories = useMemo(
    () => allCategories.filter(
      c => c.parent_id === VOYAGES_PARENT_ID && c.is_active,
    ).sort((a, b) => a.sort_order - b.sort_order),
    [allCategories],
  )

  const voyagesRootCategory = useMemo(
    () => allCategories.find(c => c.id === VOYAGES_PARENT_ID) ?? null,
    [allCategories],
  )

  // ── état du formulaire ──────────────────────────────────────────────────────
  const [tripId,     setTripId]     = useState<string>('')
  const [date,       setDate]       = useState(todayIso())
  const [amountStr,  setAmountStr]  = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [label,      setLabel]      = useState('')
  const [notes,      setNotes]      = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success,    setSuccess]    = useState(false)

  // Réinitialise le formulaire à chaque ouverture
  useEffect(() => {
    if (!open) return
    setTripId(initialTripId ?? trips[0]?.id ?? '')
    setDate(todayIso())
    setAmountStr('')
    setCategoryId(voyageCategories[0]?.id ?? voyagesRootCategory?.id ?? '')
    setLabel('')
    setNotes('')
    setSubmitError(null)
    setSuccess(false)
  }, [open, initialTripId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Met à jour le voyage pré-sélectionné si les données arrivent après l'ouverture
  useEffect(() => {
    if (!open || tripId) return
    setTripId(initialTripId ?? trips[0]?.id ?? '')
  }, [trips, initialTripId, open, tripId])

  // Met à jour la catégorie par défaut quand les catégories sont chargées
  useEffect(() => {
    if (!open || categoryId) return
    setCategoryId(voyageCategories[0]?.id ?? voyagesRootCategory?.id ?? '')
  }, [voyageCategories, voyagesRootCategory, open, categoryId])

  // ── mutation ────────────────────────────────────────────────────────────────
  const createMutation = useCreateTripManualExpense()
  const isSaving = createMutation.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    const amount = parseFloat(amountStr.replace(',', '.'))

    if (!tripId) { setSubmitError('Sélectionne un voyage.'); return }
    if (!date)   { setSubmitError('La date est requise.');    return }
    if (isNaN(amount) || amount <= 0) { setSubmitError('Montant invalide (doit être > 0).'); return }
    if (!label.trim()) { setSubmitError('Le libellé est requis.'); return }

    try {
      await createMutation.mutateAsync({
        tripId,
        categoryId: categoryId || null,
        date,
        amount,
        label,
        notes: notes.trim() || null,
      })
      setSuccess(true)
      // Ferme après un bref retour visuel
      setTimeout(() => {
        onClose()
        setSuccess(false)
      }, 900)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.')
    }
  }

  // ── rendu ───────────────────────────────────────────────────────────────────
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Dépense voyage"
      maxHeight="92dvh"
      zIndex={260}
    >
      <form
        onSubmit={handleSubmit}
        style={{ padding: 'var(--space-4) var(--space-5) var(--space-8)', display: 'grid', gap: 'var(--space-4)' }}
      >
        {/* ── Voyage ──────────────────────────────────────────────────────── */}
        <div>
          <label htmlFor="tme-trip" style={labelStyle}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Plane size={11} />
              Voyage
            </span>
          </label>
          {trips.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--neutral-400)' }}>
              Aucun voyage enregistré.
            </p>
          ) : (
            <select
              id="tme-trip"
              value={tripId}
              onChange={e => setTripId(e.target.value)}
              required
              style={selectStyle}
            >
              <option value="">— Choisir un voyage —</option>
              {trips.map(t => (
                <option key={t.id} value={t.id}>
                  {t.emoji ? `${t.emoji} ` : ''}{t.name}
                  {` · ${t.start_date.slice(0, 7)}`}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ── Date + Montant (2 colonnes) ──────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label htmlFor="tme-date" style={labelStyle}>Date</label>
            <input
              id="tme-date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="tme-amount" style={labelStyle}>Montant (€)</label>
            <input
              id="tme-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              required
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
            />
          </div>
        </div>

        {/* ── Catégorie ───────────────────────────────────────────────────── */}
        <div>
          <label htmlFor="tme-category" style={labelStyle}>Catégorie</label>
          {voyageCategories.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--neutral-400)' }}>
              Catégories voyage non trouvées.
            </p>
          ) : (
            <select
              id="tme-category"
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              style={selectStyle}
            >
              {voyagesRootCategory ? (
                <option value={voyagesRootCategory.id}>
                  {voyagesRootCategory.name} (général)
                </option>
              ) : null}
              {voyageCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* ── Libellé ─────────────────────────────────────────────────────── */}
        <div>
          <label htmlFor="tme-label" style={labelStyle}>Libellé</label>
          <input
            id="tme-label"
            type="text"
            placeholder="Ex : Hôtel, Restaurant, Billet de train…"
            value={label}
            onChange={e => setLabel(e.target.value)}
            required
            maxLength={120}
            style={inputStyle}
          />
        </div>

        {/* ── Notes (optionnel) ───────────────────────────────────────────── */}
        <div>
          <label htmlFor="tme-notes" style={labelStyle}>
            Notes
            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--neutral-400)' }}>
              optionnel
            </span>
          </label>
          <textarea
            id="tme-notes"
            placeholder="Détails, nom du marchand, réf. réservation…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            style={{
              ...inputStyle,
              resize: 'vertical',
              minHeight: 60,
              lineHeight: 1.5,
            }}
          />
        </div>

        {/* ── Erreur ──────────────────────────────────────────────────────── */}
        {submitError ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-error)', lineHeight: 1.4 }}>
            {submitError}
          </p>
        ) : null}

        {/* ── Bouton submit ────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={isSaving || success || trips.length === 0}
          style={{
            width: '100%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            fontSize: 14,
            fontWeight: 800,
            borderRadius: 'var(--radius-button)',
            border: 'none',
            cursor: isSaving || success ? 'not-allowed' : 'pointer',
            background: success
              ? 'var(--color-success)'
              : isSaving
                ? 'var(--neutral-300)'
                : VOYAGE_ACCENT_DARK,
            color: 'var(--neutral-0)',
            transition: 'background 200ms ease',
            minHeight: 44,
          }}
        >
          {success ? (
            <>
              <CheckCircle size={16} />
              Dépense enregistrée !
            </>
          ) : isSaving ? (
            'Enregistrement…'
          ) : (
            <>
              <Plane size={15} />
              Ajouter la dépense
            </>
          )}
        </button>

        {/* Note: status = 'pending', personal_share_ratio = 1 (implicite côté DB) */}
      </form>
    </BottomSheet>
  )
}
