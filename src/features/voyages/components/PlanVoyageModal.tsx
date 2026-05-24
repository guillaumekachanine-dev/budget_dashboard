import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, MapPin, Clock } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import { useAuth } from '@/hooks/useAuth'
import { QK } from '@/lib/queryKeys'

// ─── constants ────────────────────────────────────────────────────────────────

const VOYAGE_SUBCATEGORIES = [
  { id: 'fc0e644a-6082-42d0-b2d4-c947b4d7f8a2', name: 'Trajet', emoji: '🚂' },
  { id: '1e0fbcd1-1183-42af-a73a-4e5ffd7dea62', name: 'Logement', emoji: '🏨' },
  { id: 'a64508ca-1f7f-4a62-a5d4-7adcc6061fc3', name: 'Repas', emoji: '🍽️' },
  { id: 'acacac44-fecb-46f3-972f-e0c54704c6b3', name: 'Activités', emoji: '🎭' },
  { id: '39adc1a6-713d-4821-af5b-14fa46dfa60d', name: 'Extras', emoji: '🛍️' },
  { id: '74e08170-3b7e-429d-a90e-2e0766bd41a6', name: 'Autres', emoji: '📦' },
] as const

const ACCOUNT_PERSO_ID = 'bcffa4d1-92b0-4feb-a492-51ea328cfce2'
const ACCOUNT_JOINT_ID = 'bdf30750-6152-4ffa-9bd6-b2d7859cd509'

const TRIP_EMOJIS = ['✈️', '🌍', '🏖️', '⛷️', '🏔️', '🗼', '🌴', '🚢', '🏝️', '🎒', '🧳', '🗺️']

const STARS = [
  { top: '12%', left: '8%', size: 1.5 },
  { top: '6%', left: '30%', size: 2 },
  { top: '18%', left: '50%', size: 1.5 },
  { top: '8%', left: '70%', size: 2.5 },
  { top: '24%', left: '86%', size: 1.5 },
  { top: '40%', left: '93%', size: 2 },
  { top: '52%', left: '74%', size: 1.5 },
  { top: '46%', left: '18%', size: 2 },
  { top: '62%', left: '38%', size: 1.5 },
  { top: '56%', left: '56%', size: 2 },
]

// ─── helpers ──────────────────────────────────────────────────────────────────

function dateDiffDays(start: string, end: string): number {
  if (!start || !end) return 0
  const a = new Date(`${start}T00:00:00`)
  const b = new Date(`${end}T00:00:00`)
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1)
}

function fmt(n: number) {
  return (
    new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) +
    ' €'
  )
}

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
}

type SubBudgets = Record<string, string>

export function PlanVoyageModal({ open, onClose }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [tripName, setTripName] = useState('')
  const [destination, setDestination] = useState('')
  const [selectedEmoji, setSelectedEmoji] = useState('✈️')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [subBudgets, setSubBudgets] = useState<SubBudgets>({})
  const [isJoint, setIsJoint] = useState(false)
  const [shareRatio, setShareRatio] = useState(50)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const duration = useMemo(() => dateDiffDays(startDate, endDate), [startDate, endDate])
  const totalBudget = useMemo(
    () =>
      VOYAGE_SUBCATEGORIES.reduce(
        (sum, s) => sum + (parseFloat(subBudgets[s.id] ?? '0') || 0),
        0,
      ),
    [subBudgets],
  )

  function handleSubBudget(catId: string, val: string) {
    setSubBudgets((prev) => ({ ...prev, [catId]: val }))
  }

  async function handleSubmit() {
    if (!user?.id || !tripName.trim() || !startDate) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const year = parseInt(startDate.slice(0, 4))
      const accountId = isJoint ? ACCOUNT_JOINT_ID : ACCOUNT_PERSO_ID
      const personalShareRatio = isJoint ? shareRatio / 100 : 1

      const { error: tripErr } = await budgetDb.from('trips').insert({
        user_id: user.id,
        name: tripName.trim(),
        start_date: startDate,
        end_date: endDate || startDate,
        year,
        emoji: selectedEmoji,
        notes: destination.trim() || null,
      })
      if (tripErr) throw tripErr

      const nonZeroSubs = VOYAGE_SUBCATEGORIES.filter(
        (s) => (parseFloat(subBudgets[s.id] ?? '0') || 0) > 0,
      )
      for (const sub of nonZeroSubs) {
        const amt = parseFloat(subBudgets[sub.id] ?? '0') || 0
        const { error: opErr } = await budgetDb.from('planned_operations').insert({
          user_id: user.id,
          account_id: accountId,
          category_id: sub.id,
          merchant_name: null,
          label: tripName.trim(),
          planned_date: startDate,
          planned_amount: amt,
          currency: 'EUR',
          flow_type: 'expense',
          status: 'planned',
          budget_impact: 'additional_commitment',
          personal_share_ratio: personalShareRatio,
          matched_transaction_id: null,
          notes: destination.trim() || null,
          is_recurring: false,
          recurrence_frequency: 'none',
          recurrence_day_of_month: null,
          recurrence_start_date: null,
          recurrence_end_date: null,
        })
        if (opErr) throw opErr
      }

      void queryClient.invalidateQueries({ queryKey: [QK.VOYAGES] })
      void queryClient.invalidateQueries({ queryKey: [QK.PLANNED_OPERATIONS] })

      resetForm()
      onClose()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Une erreur est survenue')
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetForm() {
    setTripName('')
    setDestination('')
    setSelectedEmoji('✈️')
    setStartDate('')
    setEndDate('')
    setSubBudgets({})
    setIsJoint(false)
    setShareRatio(50)
    setSubmitError(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  const canSubmit = tripName.trim().length > 0 && startDate.length > 0 && !isSubmitting

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0"
            style={{ background: 'rgba(12,10,62,0.55)', zIndex: 140, backdropFilter: 'blur(2px)' }}
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Planifier un voyage"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-[500px] overflow-hidden rounded-t-[var(--radius-xl)] shadow-[var(--shadow-lg)]"
            style={{ zIndex: 141, maxHeight: '92dvh', display: 'flex', flexDirection: 'column', background: 'var(--neutral-0)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Dreamy header ── */}
            <div
              style={{
                background:
                  'linear-gradient(150deg, #0C0A3E 0%, #2D1B69 35%, #5B21B6 68%, #7C3AED 100%)',
                padding: '20px 20px 28px',
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {/* Glow blobs */}
              <div
                style={{
                  position: 'absolute', top: -32, right: -22, width: 140, height: 140,
                  borderRadius: '50%', background: 'rgba(139,92,246,0.38)', filter: 'blur(38px)',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute', bottom: -18, left: 28, width: 96, height: 96,
                  borderRadius: '50%', background: 'rgba(59,130,246,0.24)', filter: 'blur(30px)',
                  pointerEvents: 'none',
                }}
              />

              {/* Stars */}
              {STARS.map((s, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute', top: s.top, left: s.left,
                    width: s.size, height: s.size, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.78)',
                    boxShadow: `0 0 ${s.size * 2.5}px rgba(255,255,255,0.55)`,
                    pointerEvents: 'none',
                  }}
                />
              ))}

              {/* Emoji picker + close */}
              <div
                style={{
                  position: 'relative', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', marginBottom: 18,
                }}
              >
                <div
                  style={{
                    display: 'flex', gap: 5, flexWrap: 'nowrap', overflowX: 'auto',
                    maxWidth: 'calc(100% - 44px)', scrollbarWidth: 'none',
                  }}
                >
                  {TRIP_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setSelectedEmoji(e)}
                      style={{
                        fontSize: 17, padding: '5px 7px', border: 'none', flexShrink: 0,
                        background:
                          selectedEmoji === e
                            ? 'rgba(255,255,255,0.22)'
                            : 'rgba(255,255,255,0.06)',
                        borderRadius: 8, cursor: 'pointer',
                        transform: selectedEmoji === e ? 'scale(1.2)' : 'scale(1)',
                        transition: 'transform 0.12s ease, background 0.12s ease',
                        outline: selectedEmoji === e ? '1.5px solid rgba(255,255,255,0.38)' : 'none',
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    border: 'none', background: 'rgba(255,255,255,0.12)', borderRadius: '50%',
                    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'white', flexShrink: 0, marginLeft: 8,
                    transition: 'background 0.12s',
                  }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Trip name + destination */}
              <div style={{ position: 'relative' }}>
                <input
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  placeholder="Nom du voyage…"
                  maxLength={80}
                  style={{
                    width: '100%', border: 'none', background: 'transparent', outline: 'none',
                    fontSize: 26, fontWeight: 800, color: 'rgba(255,255,255,0.97)',
                    fontFamily: 'var(--font-ui, inherit)', letterSpacing: '-0.02em',
                    caretColor: '#F59E0B', lineHeight: 1.2, display: 'block',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7 }}>
                  <MapPin size={13} color="rgba(255,255,255,0.5)" strokeWidth={2} />
                  <input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Destination…"
                    maxLength={100}
                    style={{
                      flex: 1, border: 'none', background: 'transparent', outline: 'none',
                      fontSize: 14, color: 'rgba(255,255,255,0.62)', caretColor: '#F59E0B',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ── Body (scrollable) ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>

              {/* Dates */}
              <div style={{ marginBottom: 22 }}>
                <p
                  style={{
                    margin: '0 0 10px', fontSize: 10.5, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--neutral-400)',
                  }}
                >
                  Dates
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label
                      style={{ fontSize: 11, color: 'var(--neutral-500)', display: 'block', marginBottom: 5, fontWeight: 600 }}
                    >
                      Départ
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{
                        width: '100%', border: '1.5px solid var(--neutral-200)', borderRadius: 10,
                        padding: '9px 10px', fontSize: 13, color: 'var(--neutral-800)',
                        background: 'var(--neutral-50)', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{ fontSize: 11, color: 'var(--neutral-500)', display: 'block', marginBottom: 5, fontWeight: 600 }}
                    >
                      Retour
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      style={{
                        width: '100%', border: '1.5px solid var(--neutral-200)', borderRadius: 10,
                        padding: '9px 10px', fontSize: 13, color: 'var(--neutral-800)',
                        background: 'var(--neutral-50)', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
                {duration > 0 && (
                  <div
                    style={{
                      marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: 'color-mix(in oklab, #7C3AED 7%, white)',
                      border: '1px solid color-mix(in oklab, #7C3AED 22%, white)',
                      borderRadius: 20, padding: '4px 11px',
                    }}
                  >
                    <Clock size={11} color="#7C3AED" strokeWidth={2.2} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>
                      {duration} jour{duration > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Budget per subcategory */}
              <div style={{ marginBottom: 22 }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}
                >
                  <p
                    style={{
                      margin: 0, fontSize: 10.5, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--neutral-400)',
                    }}
                  >
                    Budget prévu
                  </p>
                  {totalBudget > 0 && (
                    <span
                      style={{
                        fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)',
                        color: '#7C3AED', letterSpacing: '-0.02em',
                      }}
                    >
                      {fmt(totalBudget)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {VOYAGE_SUBCATEGORIES.map((sub) => {
                    const val = subBudgets[sub.id] ?? ''
                    const hasVal = (parseFloat(val) || 0) > 0
                    return (
                      <label
                        key={sub.id}
                        style={{
                          border: `1.5px solid ${hasVal ? 'color-mix(in oklab, #7C3AED 32%, white)' : 'var(--neutral-200)'}`,
                          borderRadius: 12, padding: '10px 12px',
                          background: hasVal ? 'color-mix(in oklab, #7C3AED 5%, white)' : 'var(--neutral-0)',
                          cursor: 'text', display: 'block',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                          <span style={{ fontSize: 15 }}>{sub.emoji}</span>
                          <span
                            style={{
                              fontSize: 11, fontWeight: 600,
                              color: hasVal ? '#5B21B6' : 'var(--neutral-500)',
                            }}
                          >
                            {sub.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={val}
                            onChange={(e) => handleSubBudget(sub.id, e.target.value)}
                            placeholder="0"
                            style={{
                              width: '100%', border: 'none', background: 'transparent', outline: 'none',
                              fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-mono)',
                              color: hasVal ? '#7C3AED' : 'var(--neutral-300)',
                              letterSpacing: '-0.02em',
                            }}
                          />
                          <span
                            style={{
                              fontSize: 12, fontWeight: 600, marginLeft: 1,
                              color: hasVal ? '#9D77C4' : 'var(--neutral-300)',
                            }}
                          >
                            €
                          </span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Account */}
              <div style={{ marginBottom: 12 }}>
                <p
                  style={{
                    margin: '0 0 10px', fontSize: 10.5, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--neutral-400)',
                  }}
                >
                  Compte
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { joint: false, label: 'Personnel', emoji: '👤' },
                    { joint: true, label: 'Partagé', emoji: '👥' },
                  ].map(({ joint, label, emoji: btnEmoji }) => (
                    <button
                      key={String(joint)}
                      type="button"
                      onClick={() => setIsJoint(joint)}
                      style={{
                        border: '1.5px solid',
                        borderColor: isJoint === joint
                          ? 'color-mix(in oklab, #7C3AED 42%, white)'
                          : 'var(--neutral-200)',
                        background: isJoint === joint
                          ? 'color-mix(in oklab, #7C3AED 8%, white)'
                          : 'var(--neutral-0)',
                        borderRadius: 10, padding: '9px 12px',
                        fontSize: 13, fontWeight: 600,
                        color: isJoint === joint ? '#5B21B6' : 'var(--neutral-500)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 6, transition: 'all 0.15s',
                      }}
                    >
                      <span>{btnEmoji}</span> {label}
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {isJoint && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      style={{ marginTop: 10, overflow: 'hidden' }}
                    >
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          marginBottom: 5,
                        }}
                      >
                        <label style={{ fontSize: 12, color: 'var(--neutral-500)', fontWeight: 500 }}>
                          Ma part
                        </label>
                        <span
                          style={{
                            fontSize: 13, fontWeight: 700, color: '#7C3AED',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {shareRatio}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={shareRatio}
                        onChange={(e) => setShareRatio(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: '#7C3AED' }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {submitError && (
                <p
                  style={{
                    fontSize: 12, color: '#EF4444',
                    background: 'rgba(239,68,68,0.08)', borderRadius: 8,
                    padding: '8px 12px', marginTop: 8,
                  }}
                >
                  {submitError}
                </p>
              )}
            </div>

            {/* ── Footer ── */}
            <div
              style={{
                padding: '14px 20px 28px', borderTop: '1px solid var(--neutral-100)',
                flexShrink: 0, background: 'var(--neutral-0)',
              }}
            >
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  width: '100%', border: 'none', borderRadius: 14, padding: '15px',
                  background: canSubmit
                    ? 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 55%, #6D28D9 100%)'
                    : 'var(--neutral-150)',
                  color: canSubmit ? 'white' : 'var(--neutral-400)',
                  fontSize: 15, fontWeight: 700,
                  cursor: canSubmit ? 'pointer' : 'default',
                  boxShadow: canSubmit ? '0 4px 20px rgba(124,58,237,0.4)' : 'none',
                  transition: 'all 0.2s',
                  letterSpacing: '-0.01em',
                }}
              >
                {isSubmitting
                  ? 'En cours…'
                  : tripName
                    ? `Planifier · ${selectedEmoji} ${tripName}`
                    : 'Planifier ce voyage'}
              </button>
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  )
}
