import { useState, useMemo, useEffect } from 'react'
import { Plane, CheckCircle, ChevronDown, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useAllTrips } from '@/features/voyages/hooks/useAllTrips'
import { useCategories } from '@/hooks/useCategories'
import { useCreateTripManualExpense } from '../hooks/useCreateTripManualExpense'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { StableDateField } from '@/components/ui/StableDateField'

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

// ─── props ────────────────────────────────────────────────────────────────────

interface TripManualExpenseModalProps {
  open: boolean
  onClose: () => void
  /** Pré-sélectionne ce voyage à l'ouverture */
  initialTripId?: string | null
  glass?: boolean
  glassBackground?: string
  glassBorder?: string
  /** 'dark' (défaut) = textes blancs sur fond sombre | 'light' = textes graphite sur fond crème/champagne */
  glassTone?: 'dark' | 'light'
  /** Remplace le sélecteur voyage par un titre fixe quand l'appelant impose le voyage courant. */
  lockTripSelector?: boolean
  lockedTripName?: string | null
}

// ─── composant ────────────────────────────────────────────────────────────────

export function TripManualExpenseModal({
  open,
  onClose,
  initialTripId,
  glass = false,
  glassBackground,
  glassBorder,
  glassTone = 'dark',
  lockTripSelector = false,
  lockedTripName,
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

  // derived tone helpers
  const isLight = glass && glassTone === 'light'
  const glassText      = isLight ? 'rgba(40, 32, 20, 0.90)' : 'rgba(255, 255, 255, 0.92)'
  const glassSubtext   = isLight ? 'rgba(100, 80, 45, 0.62)' : 'rgba(255, 255, 255, 0.48)'
  const glassMuted     = isLight ? 'rgba(140, 110, 60, 0.45)' : 'rgba(255, 255, 255, 0.4)'
  const glassInputBg   = isLight ? 'rgba(255, 252, 245, 0.70)' : 'rgba(255, 255, 255, 0.06)'
  const glassInputBdr  = isLight ? 'rgba(200, 175, 120, 0.40)' : 'rgba(255, 255, 255, 0.12)'
  const glassToggleBg  = isLight ? 'rgba(220, 200, 160, 0.28)' : 'rgba(255, 255, 255, 0.08)'
  const glassSelBg     = isLight ? 'rgba(210, 180, 110, 0.18)' : 'rgba(255, 255, 255, 0.05)'
  const glassSelBdr    = isLight ? 'rgba(190, 155, 80, 0.35)' : 'rgba(255, 255, 255, 0.1)'
  const glassDivider   = isLight ? 'rgba(190, 160, 90, 0.20)' : 'rgba(255, 255, 255, 0.1)'
  const glassActiveBg  = isLight ? 'rgba(200, 165, 80, 0.22)' : 'rgba(255, 255, 255, 0.12)'
  const glassCloseBg   = isLight ? 'rgba(220, 200, 155, 0.45)' : 'rgba(255, 255, 255, 0.1)'
  const glassCloseBdr  = isLight ? 'rgba(185, 155, 80, 0.30)' : 'rgba(255, 255, 255, 0.12)'
  const glassCloseClr  = isLight ? 'rgba(80, 55, 15, 0.70)' : 'rgba(255, 255, 255, 0.75)'

  // dynamic styles
  const currentLabelStyle = useMemo<React.CSSProperties>(() => ({
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: glass ? glassSubtext : 'var(--neutral-500)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }), [glass, glassSubtext])

  const currentInputStyle = useMemo<React.CSSProperties>(() => ({
    width: '100%',
    boxSizing: 'border-box',
    fontSize: 14,
    fontWeight: 600,
    color: glass ? glassText : 'var(--neutral-900)',
    background: glass ? glassInputBg : 'var(--neutral-50)',
    border: glass ? `1px solid ${glassInputBdr}` : '1px solid var(--neutral-200)',
    borderRadius: 'var(--radius-md)',
    padding: '10px var(--space-3)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    transition: 'border-color 120ms ease',
  }), [glass, glassText, glassInputBg, glassInputBdr])

  const currentSelectFieldStyle = useMemo<React.CSSProperties>(() => ({
    ...currentInputStyle,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    minHeight: 40,
  }), [currentInputStyle])

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
  const [imputationType, setImputationType] = useState<'personal' | 'joint'>('personal')
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
  const lockedTripHeaderLabel = useMemo(() => {
    if (lockedTripName?.trim()) return lockedTripName.trim()
    if (selectedTripObject) {
      return formatTripNameWithMonthYear(selectedTripObject.name, selectedTripObject.start_date || selectedTripObject.end_date)
    }
    return 'Voyage en cours'
  }, [lockedTripName, selectedTripObject])

  // Réinitialise le formulaire à chaque ouverture
  useEffect(() => {
    if (!open) return
    setTripId(initialTripId ?? sortedTripsForSelect[0]?.id ?? '')
    setDate(todayIso())
    setAmountStr('')
    setCategoryId(voyageCategories[0]?.id ?? voyagesRootCategory?.id ?? '')
    setLabel('')
    setImputationType('personal')
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
        notes: null,
        imputationType,
        personalShareRatio: imputationType === 'joint' ? 0.5 : 1.0,
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
        maxHeight="92dvh"
        zIndex={260}
        variant="center"
        glass={glass}
        glassBackground={glassBackground}
        glassBorder={glassBorder}
        header={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', minHeight: lockTripSelector ? 42 : undefined }}>
            {/* Sélecteur voyage en position titre */}
            {lockTripSelector ? (
              <>
                <span aria-hidden="true" style={{ width: 26, minWidth: 26 }} />
                <p
                  style={{
                    margin: 0,
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'center',
                    fontSize: 'var(--font-size-md)',
                    fontWeight: 800,
                    color: glass ? glassText : 'var(--neutral-900)',
                    letterSpacing: '-0.01em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {lockedTripHeaderLabel}
                </p>
              </>
            ) : trips.length === 0 ? (
              <p style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 800, color: glass ? 'rgba(255,255,255,0.90)' : 'var(--neutral-900)', letterSpacing: '-0.01em' }}>
                Dépense voyage
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setTripPickerOpen(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '3px 10px 3px 10px',
                  borderRadius: 'var(--radius-full)',
                  border: glass ? `1px solid ${isLight ? 'rgba(185,155,80,0.35)' : 'rgba(255,255,255,0.22)'}` : '1px solid var(--neutral-200)',
                  background: glass ? (isLight ? 'rgba(220,200,155,0.32)' : 'rgba(255,255,255,0.10)') : 'var(--neutral-50)',
                  cursor: 'pointer', flex: 1, minWidth: 0,
                  transition: 'background 120ms ease',
                  textAlign: 'left',
                }}
              >
                <span style={{
                  fontSize: 'var(--font-size-md)', fontWeight: 800,
                  color: glass ? glassText : 'var(--neutral-900)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  letterSpacing: '-0.01em', flex: 1,
                }}>
                  {selectedTripObject
                    ? formatTripNameWithMonthYear(selectedTripObject.name, selectedTripObject.start_date || selectedTripObject.end_date)
                    : '— Choisir un voyage —'}
                </span>
                <ChevronDown size={12} style={{ color: glass ? glassMuted : 'var(--neutral-400)', flexShrink: 0 }} />
              </button>
            )}
            {/* Bouton fermer */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              style={{
                flexShrink: 0,
                border: glass ? `1px solid ${glassCloseBdr}` : '1px solid var(--neutral-300)',
                background: glass ? glassCloseBg : 'var(--neutral-100)',
                color: glass ? glassCloseClr : 'var(--neutral-700)',
                width: 26, height: 26, minWidth: 26, minHeight: 26,
                borderRadius: 'var(--radius-full)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
            >
              <X size={11} />
            </button>
          </div>
        }
      >
        <form
          onSubmit={handleSubmit}
          style={{ padding: 'var(--space-4) var(--space-5) var(--space-8)', display: 'grid', gap: 'var(--space-4)' }}
        >
          {/* ── Date + Montant (2 colonnes côte à côte) ──────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              <label style={currentLabelStyle}>Date</label>
              <StableDateField
                value={date}
                onChange={setDate}
                ariaLabel="Date de la dépense manuelle"
                required
                fullWidth
                textAlign="left"
                textStyle={{ fontSize: 14, fontWeight: 600, color: glass ? glassText : 'var(--neutral-900)' }}
                buttonStyle={{ ...currentInputStyle, minWidth: 0, width: '100%', justifyContent: 'space-between' }}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <label htmlFor="tme-amount" style={currentLabelStyle}>Montant (€)</label>
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
                style={{ ...currentInputStyle, fontFamily: 'var(--font-mono)', minWidth: 0, width: '100%' }}
              />
            </div>
          </div>

          {/* Aperçu dynamique de l'imputation */}
          {parseFloat(amountStr.replace(',', '.')) > 0 && (
            <div style={{ fontSize: 11, fontWeight: 700, color: glass ? glassSubtext : 'var(--neutral-500)', marginTop: -6, paddingLeft: 2 }}>
              {imputationType === 'personal' ? (
                <span>Imputé : {parseFloat(amountStr.replace(',', '.')).toFixed(2)} €</span>
              ) : (
                <span>Imputé : {(parseFloat(amountStr.replace(',', '.')) * 0.5).toFixed(2)} € sur {parseFloat(amountStr.replace(',', '.')).toFixed(2)} €</span>
              )}
            </div>
          )}

          {/* ── Imputation ────────────────────────────────────────────────── */}
          <div>
            <label style={currentLabelStyle}>Imputation</label>
            <div style={{ display: 'flex', background: glass ? glassToggleBg : 'var(--neutral-100)', borderRadius: 'var(--radius-md)', padding: 3, gap: 4 }}>
              <button
                type="button"
                onClick={() => setImputationType('personal')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: 'center',
                  borderRadius: 'calc(var(--radius-md) - 2px)',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                  border: 'none',
                  background: imputationType === 'personal' ? (glass ? glassActiveBg : 'var(--neutral-0)') : 'transparent',
                  color: imputationType === 'personal' ? (glass ? glassText : 'var(--neutral-900)') : (glass ? glassSubtext : 'var(--neutral-500)'),
                  boxShadow: imputationType === 'personal' ? (glass ? (isLight ? '0 1px 4px rgba(120,90,20,0.12)' : 'none') : '0 1px 3px rgba(0,0,0,0.08)') : 'none',
                }}
              >
                Personnelle
              </button>
              <button
                type="button"
                onClick={() => setImputationType('joint')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: 'center',
                  borderRadius: 'calc(var(--radius-md) - 2px)',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                  border: 'none',
                  background: imputationType === 'joint' ? (glass ? glassActiveBg : 'var(--neutral-0)') : 'transparent',
                  color: imputationType === 'joint' ? (glass ? glassText : 'var(--neutral-900)') : (glass ? glassSubtext : 'var(--neutral-500)'),
                  boxShadow: imputationType === 'joint' ? (glass ? (isLight ? '0 1px 4px rgba(120,90,20,0.12)' : 'none') : '0 1px 3px rgba(0,0,0,0.08)') : 'none',
                }}
              >
                Jointe
              </button>
            </div>
          </div>

          {/* ── Catégorie ───────────────────────────────────────────────────── */}
          <div>
            <label style={currentLabelStyle}>Catégorie</label>
            {voyageCategories.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: glass ? glassMuted : 'var(--neutral-400)' }}>
                Catégories voyage non trouvées.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setCategoryPickerOpen(true)}
                style={currentSelectFieldStyle}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                  {selectedCategoryObject && (
                    <CategoryIcon iconKey={selectedCategoryObject.icon_key} label={selectedCategoryObject.name} size={18} />
                  )}
                  <span style={{ fontWeight: 600 }}>
                    {selectedCategoryObject ? stripVoyageSuffix(selectedCategoryObject.name) : 'Choisir une catégorie'}
                  </span>
                </span>
                <ChevronDown size={14} style={{ color: glass ? glassMuted : 'var(--neutral-400)', flexShrink: 0 }} />
              </button>
            )}
          </div>

          {/* ── Libellé ─────────────────────────────────────────────────────── */}
          <div>
            <label htmlFor="tme-label" style={currentLabelStyle}>Libellé</label>
            <input
              id="tme-label"
              type="text"
              placeholder="Ex : Hôtel, Restaurant, Billet de train…"
              value={label}
              onChange={e => setLabel(e.target.value)}
              required
              maxLength={120}
              style={currentInputStyle}
            />
          </div>

          {/* ── Erreur ──────────────────────────────────────────────────────── */}
          {submitError ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-error-text)', lineHeight: 1.4 }}>
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
                  ? (glass ? (isLight ? 'rgba(180,145,70,0.25)' : 'rgba(255, 255, 255, 0.12)') : 'var(--neutral-300)')
                  : (isLight ? 'linear-gradient(135deg, #8B5E14 0%, #A67420 100%)' : VOYAGE_ACCENT_DARK),
              color: isSaving && glass ? (isLight ? 'rgba(100,75,20,0.5)' : 'rgba(255, 255, 255, 0.3)') : 'var(--neutral-0)',
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
                background: glass ? 'rgba(10, 10, 30, 0.45)' : 'rgba(13, 13, 31, 0.45)',
                backdropFilter: glass ? 'blur(4px)' : 'blur(2px)',
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
                background: glass ? (isLight ? 'rgba(252, 248, 238, 0.95)' : 'rgba(20, 20, 45, 0.95)') : 'var(--neutral-0)',
                backdropFilter: glass ? (isLight ? 'blur(24px) saturate(1.4)' : 'blur(20px)') : undefined,
                border: glass ? `1px solid ${isLight ? 'rgba(200,170,100,0.30)' : 'rgba(255, 255, 255, 0.12)'}` : undefined,
                boxShadow: 'var(--shadow-lg)',
                borderRadius: 'var(--radius-2xl) var(--radius-2xl) 0 0',
                padding: 'var(--space-4) var(--space-5) calc(var(--space-6) + var(--safe-bottom-offset, 16px))',
                boxSizing: 'border-box',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: glass ? (isLight ? glassText : '#FFFFFF') : 'var(--neutral-900)' }}>
                  Choisir une catégorie
                </p>
                <button
                  type="button"
                  onClick={() => setCategoryPickerOpen(false)}
                  style={{
                    border: glass ? `1px solid ${glassCloseBdr}` : 'none',
                    background: glass ? glassCloseBg : 'var(--neutral-100)',
                    color: glass ? glassCloseClr : 'var(--neutral-600)',
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
                        background: isSelected ? (isLight ? 'rgba(180,140,60,0.18)' : 'rgba(2, 132, 199, 0.15)') : (glass ? glassSelBg : 'var(--neutral-50)'),
                        border: isSelected
                          ? `1.5px solid ${isLight ? 'rgba(170,130,50,0.55)' : 'var(--primary-600)'}`
                          : `1.5px solid ${glass ? glassSelBdr : 'var(--neutral-200)'}`,
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
                          color: isSelected ? (isLight ? '#7A5010' : '#38BDF8') : (glass ? (isLight ? glassText : 'rgba(255, 255, 255, 0.8)') : 'var(--neutral-700)'),
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
                background: glass ? 'rgba(10, 10, 30, 0.45)' : 'rgba(13, 13, 31, 0.45)',
                backdropFilter: glass ? 'blur(4px)' : 'blur(2px)',
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
                background: glass ? (isLight ? 'rgba(252, 248, 238, 0.95)' : 'rgba(20, 20, 45, 0.95)') : 'var(--neutral-0)',
                backdropFilter: glass ? (isLight ? 'blur(24px) saturate(1.4)' : 'blur(20px)') : undefined,
                border: glass ? `1px solid ${isLight ? 'rgba(200,170,100,0.30)' : 'rgba(255, 255, 255, 0.12)'}` : undefined,
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
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: glass ? '#FFFFFF' : 'var(--neutral-900)' }}>
                  Choisir un voyage
                </p>
                <button
                  type="button"
                  onClick={() => setTripPickerOpen(false)}
                  style={{
                    border: glass ? `1px solid ${glassCloseBdr}` : 'none',
                    background: glass ? glassCloseBg : 'var(--neutral-100)',
                    color: glass ? glassCloseClr : 'var(--neutral-600)',
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
                  <p style={{ margin: 0, fontSize: 13, color: glass ? (isLight ? glassSubtext : 'rgba(255, 255, 255, 0.4)') : 'var(--neutral-500)', textAlign: 'center' }}>
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
                            <div style={{ flex: 1, height: 1, background: glass ? glassDivider : 'var(--neutral-200)' }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: glass ? (isLight ? glassSubtext : 'rgba(255, 255, 255, 0.4)') : 'var(--neutral-400)', letterSpacing: '0.05em' }}>2025</span>
                            <div style={{ flex: 1, height: 1, background: glass ? glassDivider : 'var(--neutral-200)' }} />
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
                            background: isSelected ? (isLight ? 'rgba(180,140,60,0.18)' : 'rgba(2, 132, 199, 0.15)') : (glass ? glassSelBg : 'var(--neutral-50)'),
                            border: isSelected
                              ? `1.5px solid ${isLight ? 'rgba(170,130,50,0.55)' : 'var(--primary-600)'}`
                              : `1.5px solid ${glass ? glassSelBdr : 'var(--neutral-150)'}`,
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          <span style={{ fontSize: 18 }}>{t.emoji?.trim() || '✈️'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: isSelected ? 800 : 700, color: isSelected ? (isLight ? '#7A5010' : '#38BDF8') : (glass ? (isLight ? glassText : 'rgba(255, 255, 255, 0.8)') : 'var(--neutral-800)'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
