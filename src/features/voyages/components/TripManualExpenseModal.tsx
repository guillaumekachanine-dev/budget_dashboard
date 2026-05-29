import { useState, useMemo, useEffect } from 'react'
import { Plane, CheckCircle, ChevronDown, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useAllTrips } from '@/features/voyages/hooks/useAllTrips'
import { useCategories } from '@/hooks/useCategories'
import { useCreateTripManualExpense } from '../hooks/useCreateTripManualExpense'
import { CategoryIcon } from '@/components/ui/CategoryIcon'

// ─── constantes ───────────────────────────────────────────────────────────────

const VOYAGE_ACCENT_DARK = '#0284C7'
const VOYAGES_PARENT_ID  = 'a975a6e6-62d9-4686-8107-f4d76a7bd93d'

const FULL_MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
]

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function stripVoyageSuffix(name: string): string {
  return name.replace(/\s+voyage$/i, '').trim()
}

function formatTripNameWithMonthYear(name: string, startDateIso?: string): string {
  if (!startDateIso) return name
  const d = new Date(`${startDateIso}T00:00:00`)
  if (isNaN(d.getTime())) return name
  const month = FULL_MONTHS_FR[d.getMonth()]
  const year = d.getFullYear()
  return name ? `${name} - ${month} ${year}` : `${month} ${year}`
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

const customSelectFieldStyle: React.CSSProperties = {
  ...inputStyle,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  background: 'var(--neutral-50)',
  border: '1px solid var(--neutral-200)',
  borderRadius: 'var(--radius-md)',
  padding: '10px var(--space-3)',
  minHeight: 40,
  width: '100%',
  textAlign: 'left',
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

  // Tri voyages : récent → ancien
  const sortedTripsForSelect = useMemo(() => {
    return [...trips].sort((a, b) => {
      const dateA = a.start_date || a.end_date || ''
      const dateB = b.start_date || b.end_date || ''
      return dateB.localeCompare(dateA)
    })
  }, [trips])

  // Exactement 6 choix pour les catégories (Général + 5 sous-catégories)
  const categoryChoices = useMemo(() => {
    const choices = []
    if (voyagesRootCategory) {
      choices.push({
        id: voyagesRootCategory.id,
        name: 'Général',
        icon_key: voyagesRootCategory.icon_key || 'voyages'
      })
    }
    voyageCategories.forEach(c => {
      choices.push({
        id: c.id,
        name: stripVoyageSuffix(c.name),
        icon_key: c.icon_key
      })
    })
    return choices.slice(0, 6)
  }, [voyagesRootCategory, voyageCategories])

  // ── état du formulaire ──────────────────────────────────────────────────────
  const [tripId,     setTripId]     = useState<string>('')
  const [date,       setDate]       = useState(todayIso())
  const [amountStr,  setAmountStr]  = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [label,      setLabel]      = useState('')
  const [notes,      setNotes]      = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success,    setSuccess]    = useState(false)

  // États pour les mini modales de sélection
  const [tripPickerOpen, setTripPickerOpen] = useState(false)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)

  // Objets sélectionnés
  const selectedTripObject = useMemo(() => {
    return trips.find(t => t.id === tripId) || null
  }, [trips, tripId])

  const selectedCategoryObject = useMemo(() => {
    if (categoryId === voyagesRootCategory?.id) return voyagesRootCategory
    return voyageCategories.find(c => c.id === categoryId) || null
  }, [voyageCategories, voyagesRootCategory, categoryId])

  // Réinitialise le formulaire à chaque ouverture
  useEffect(() => {
    if (!open) return
    setTripId(initialTripId ?? sortedTripsForSelect[0]?.id ?? '')
    setDate(todayIso())
    setAmountStr('')
    setCategoryId(voyageCategories[0]?.id ?? voyagesRootCategory?.id ?? '')
    setLabel('')
    setNotes('')
    setSubmitError(null)
    setSuccess(false)
    setTripPickerOpen(false)
    setCategoryPickerOpen(false)
  }, [open, initialTripId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Met à jour le voyage pré-sélectionné si les données arrivent après l'ouverture
  useEffect(() => {
    if (!open || tripId) return
    setTripId(initialTripId ?? sortedTripsForSelect[0]?.id ?? '')
  }, [sortedTripsForSelect, initialTripId, open, tripId])

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
    <>
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
            <label style={labelStyle}>
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
              <button
                type="button"
                onClick={() => setTripPickerOpen(true)}
                style={customSelectFieldStyle}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                  <span>{selectedTripObject?.emoji || '✈️'}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {selectedTripObject ? formatTripNameWithMonthYear(selectedTripObject.name, selectedTripObject.start_date || selectedTripObject.end_date) : '— Choisir un voyage —'}
                  </span>
                </span>
                <ChevronDown size={14} style={{ color: 'var(--neutral-400)', flexShrink: 0 }} />
              </button>
            )}
          </div>

          {/* ── Date + Montant (2 colonnes côte à côte) ──────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              <label htmlFor="tme-date" style={labelStyle}>Date</label>
              <input
                id="tme-date"
                type="date"
                value={date}
                className="tme-date-input"
                onChange={e => setDate(e.target.value)}
                required
                style={{ ...inputStyle, minWidth: 0, width: '100%' }}
              />
            </div>
            <div style={{ minWidth: 0 }}>
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
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)', minWidth: 0, width: '100%' }}
              />
            </div>
          </div>

          {/* ── Catégorie ───────────────────────────────────────────────────── */}
          <div>
            <label style={labelStyle}>Catégorie</label>
            {voyageCategories.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--neutral-400)' }}>
                Catégories voyage non trouvées.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setCategoryPickerOpen(true)}
                style={customSelectFieldStyle}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                  {selectedCategoryObject && (
                    <CategoryIcon iconKey={selectedCategoryObject.icon_key} label={selectedCategoryObject.name} size={18} />
                  )}
                  <span style={{ fontWeight: 600 }}>
                    {selectedCategoryObject ? stripVoyageSuffix(selectedCategoryObject.name) : 'Choisir une catégorie'}
                  </span>
                </span>
                <ChevronDown size={14} style={{ color: 'var(--neutral-400)', flexShrink: 0 }} />
              </button>
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
        </form>
      </BottomSheet>

      {/* Mini Modale Catégorie */}
      <AnimatePresence>
        {categoryPickerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setCategoryPickerOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 300,
                background: 'rgba(13, 13, 31, 0.45)',
                backdropFilter: 'blur(2px)',
              }}
            />

            {/* Panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 301,
                margin: '0 auto',
                width: '100%',
                maxWidth: 420,
                background: 'var(--neutral-0)',
                boxShadow: 'var(--shadow-lg)',
                borderRadius: 'var(--radius-2xl) var(--radius-2xl) 0 0',
                padding: 'var(--space-4) var(--space-5) calc(var(--space-6) + var(--safe-bottom-offset, 16px))',
                boxSizing: 'border-box',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-900)' }}>
                  Choisir une catégorie
                </p>
                <button
                  type="button"
                  onClick={() => setCategoryPickerOpen(false)}
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

              {/* Grid 2x3 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 'var(--space-3)',
                }}
              >
                {categoryChoices.map(choice => {
                  const isSelected = choice.id === categoryId
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => {
                        setCategoryId(choice.id)
                        setCategoryPickerOpen(false)
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: '12px var(--space-2)',
                        background: isSelected ? 'rgba(2, 132, 199, 0.08)' : 'var(--neutral-50)',
                        border: `1.5px solid ${isSelected ? 'var(--primary-600)' : 'var(--neutral-200)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <CategoryIcon iconKey={choice.icon_key} label={choice.name} size={30} />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? 800 : 700,
                          color: isSelected ? 'var(--primary-700)' : 'var(--neutral-700)',
                          textAlign: 'center',
                        }}
                      >
                        {choice.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mini Modale Voyage */}
      <AnimatePresence>
        {tripPickerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setTripPickerOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 300,
                background: 'rgba(13, 13, 31, 0.45)',
                backdropFilter: 'blur(2px)',
              }}
            />

            {/* Panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 301,
                margin: '0 auto',
                width: '100%',
                maxWidth: 420,
                background: 'var(--neutral-0)',
                boxShadow: 'var(--shadow-lg)',
                borderRadius: 'var(--radius-2xl) var(--radius-2xl) 0 0',
                padding: 'var(--space-4) var(--space-5) calc(var(--space-6) + var(--safe-bottom-offset, 16px))',
                boxSizing: 'border-box',
                maxHeight: '60dvh',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-900)' }}>
                  Choisir un voyage
                </p>
                <button
                  type="button"
                  onClick={() => setTripPickerOpen(false)}
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

              {/* List */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {sortedTripsForSelect.length === 0 ? (
                  <p style={{ margin: 'var(--space-4) 0', fontSize: 13, color: 'var(--neutral-500)', textAlign: 'center' }}>
                    Aucun voyage disponible.
                  </p>
                ) : (
                  sortedTripsForSelect.map((t, index) => {
                    const isSelected = t.id === tripId
                    const displayName = formatTripNameWithMonthYear(t.name, t.start_date || t.end_date)
                    const year = new Date(`${t.start_date || t.end_date}T00:00:00`).getFullYear()

                    let showDivider = false
                    if (index > 0) {
                      const prevTrip = sortedTripsForSelect[index - 1]
                      const prevYear = new Date(`${prevTrip.start_date || prevTrip.end_date}T00:00:00`).getFullYear()
                      if (prevYear === 2026 && year === 2025) {
                        showDivider = true
                      }
                    }

                    return (
                      <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {showDivider && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', margin: '8px 0 var(--space-2)' }}>
                            <div style={{ flex: 1, height: 1, background: 'var(--neutral-200)' }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-400)', letterSpacing: '0.05em' }}>2025</span>
                            <div style={{ flex: 1, height: 1, background: 'var(--neutral-200)' }} />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setTripId(t.id)
                            setTripPickerOpen(false)
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-3)',
                            padding: '10px var(--space-3)',
                            background: isSelected ? 'rgba(2, 132, 199, 0.08)' : 'var(--neutral-50)',
                            border: `1.5px solid ${isSelected ? 'var(--primary-600)' : 'var(--neutral-150)'}`,
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          <span style={{ fontSize: 18 }}>{t.emoji?.trim() || '✈️'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: isSelected ? 800 : 700, color: 'var(--neutral-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {displayName}
                            </p>
                          </div>
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
