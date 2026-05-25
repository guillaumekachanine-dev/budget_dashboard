import { useState, useMemo, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, MapPin, Clock, ChevronDown } from 'lucide-react'
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
  { id: '74e08170-3b7e-429d-a90e-2e0766bd41a6', name: 'Sorties', emoji: '🥂' },
  { id: '39adc1a6-713d-4821-af5b-14fa46dfa60d', name: 'Extras', emoji: '🛍️' },
] as const

const ACCOUNT_PERSO_ID = 'bcffa4d1-92b0-4feb-a492-51ea328cfce2'
const ACCOUNT_JOINT_ID = 'bdf30750-6152-4ffa-9bd6-b2d7859cd509'

type Ambiance = 'city_lights' | 'sunset' | 'natural'

const AMBIANCE_CONFIG: Record<Ambiance, {
  label: string
  emoji: string
  pillBg: string
  pillText: string
  accentDot: string
  background: string
}> = {
  city_lights: {
    label: 'City Lights',
    emoji: '🌃',
    pillBg: 'rgba(14,165,233,0.18)',
    pillText: '#7DD3FC',
    accentDot: '#38BDF8',
    background: 'linear-gradient(180deg, #010C1F 0%, #061B3A 28%, #0C1F54 58%, #11153F 82%, #0D0B2E 100%)',
  },
  sunset: {
    label: 'Sunset',
    emoji: '🌅',
    pillBg: 'rgba(251,146,60,0.2)',
    pillText: '#FED7AA',
    accentDot: '#FB923C',
    background: 'linear-gradient(175deg, #1C0733 0%, #6B21A8 14%, #BE4E11 32%, #EA7316 46%, #F5A623 60%, #FADA6A 74%, #FEF3C7 100%)',
  },
  natural: {
    label: 'Natural',
    emoji: '🌿',
    pillBg: 'rgba(74,222,128,0.15)',
    pillText: '#86EFAC',
    accentDot: '#4ADE80',
    background: 'linear-gradient(180deg, #071A03 0%, #0F3308 18%, #1A5210 38%, #226B14 56%, #2F8A1C 72%, #64C832 87%, #A3E635 100%)',
  },
}

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
  const [ambiance, setAmbiance] = useState<Ambiance>('city_lights')
  const [ambianceMenuOpen, setAmbianceMenuOpen] = useState(false)
  const ambianceMenuRef = useRef<HTMLDivElement>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [subBudgets, setSubBudgets] = useState<SubBudgets>({})
  const [subNotes, setSubNotes] = useState<Record<string, string>>({})
  const [isJoint, setIsJoint] = useState(false)
  const [shareRatio, setShareRatio] = useState(50)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Ferme le menu ambiance sur clic extérieur
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ambianceMenuRef.current && !ambianceMenuRef.current.contains(e.target as Node)) {
        setAmbianceMenuOpen(false)
      }
    }
    if (ambianceMenuOpen) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [ambianceMenuOpen])

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

  function handleSubNote(catId: string, val: string) {
    setSubNotes((prev) => ({ ...prev, [catId]: val }))
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
        emoji: AMBIANCE_CONFIG[ambiance].emoji,
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
    setAmbiance('city_lights')
    setAmbianceMenuOpen(false)
    setStartDate('')
    setEndDate('')
    setSubBudgets({})
    setSubNotes({})
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

          {/* Centering wrapper */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 141,
              display: 'grid',
              placeItems: 'center',
              padding: '20px 16px',
              pointerEvents: 'none',
            }}
          >
          {/* Modal */}
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Planifier un voyage"
            initial={{ scale: 0.96, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            style={{
              zIndex: 141,
              width: 'min(500px, 100%)',
              maxHeight: 'calc(100dvh - 40px)',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--neutral-0)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 8px 48px rgba(12,10,62,0.24), 0 2px 12px rgba(12,10,62,0.12)',
              overflow: 'hidden',
              pointerEvents: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ambiance ── */}
            <motion.div
              animate={{ background: AMBIANCE_CONFIG[ambiance].background }}
              transition={{ duration: 0.7, ease: 'easeInOut' }}
              style={{ padding: '18px 18px 20px', position: 'relative', flexShrink: 0 }}
            >
              {/* Calque de clip pour les scènes visuelles — isolé pour ne pas clipper le dropdown */}
              <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit', pointerEvents: 'none' }}>
              {/* ── City Lights scene ── */}
              {ambiance === 'city_lights' && (
                <>
                  {/* Stars */}
                  {[
                    [8,8,1.4],[18,25,0.9],[28,6,1.8],[38,19,1.1],[50,11,2.0],
                    [60,4,0.9],[67,27,1.5],[74,9,1.7],[82,16,1.0],[90,7,1.6],
                    [94,24,0.8],[22,38,0.7],[44,34,1.2],[58,40,0.6],[12,42,1.0],
                    [78,38,1.3],[96,14,0.9],[32,14,0.8],[55,22,1.1],[85,31,0.7],
                  ].map(([l, t, r], i) => (
                    <div key={i} style={{ position: 'absolute', left: `${l}%`, top: `${t}%`, width: r, height: r, borderRadius: '50%', background: 'rgba(255,255,255,0.82)', boxShadow: `0 0 ${(r as number)*3}px rgba(200,220,255,0.6)`, pointerEvents: 'none' }} />
                  ))}
                  {/* Neon cyan glow top-right */}
                  <div style={{ position: 'absolute', top: -30, right: -20, width: 130, height: 130, borderRadius: '50%', background: 'rgba(6,182,212,0.22)', filter: 'blur(36px)', pointerEvents: 'none' }} />
                  {/* Neon magenta glow bottom-left */}
                  <div style={{ position: 'absolute', bottom: -10, left: -10, width: 100, height: 100, borderRadius: '50%', background: 'rgba(217,70,239,0.18)', filter: 'blur(30px)', pointerEvents: 'none' }} />
                  {/* Skyline SVG */}
                  <svg viewBox="0 0 500 72" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 72, pointerEvents: 'none' }}>
                    {/* Building silhouettes */}
                    <rect x="0" y="28" width="38" height="44" fill="#060D2E"/>
                    <rect x="4" y="14" width="12" height="14" fill="#060D2E"/>
                    <rect x="42" y="36" width="28" height="36" fill="#07102A"/>
                    <rect x="44" y="22" width="8" height="14" fill="#07102A"/>
                    <rect x="74" y="18" width="22" height="54" fill="#050E28"/>
                    <rect x="76" y="10" width="6" height="8" fill="#050E28"/>
                    <rect x="100" y="32" width="34" height="40" fill="#060F2C"/>
                    <rect x="138" y="10" width="18" height="62" fill="#040C24"/>
                    <rect x="140" y="4" width="5" height="6" fill="#040C24"/>
                    <rect x="160" y="30" width="28" height="42" fill="#070E2A"/>
                    <rect x="192" y="20" width="24" height="52" fill="#050D26"/>
                    <rect x="194" y="12" width="7" height="8" fill="#050D26"/>
                    <rect x="220" y="34" width="32" height="38" fill="#06102C"/>
                    <rect x="256" y="16" width="20" height="56" fill="#040B22"/>
                    <rect x="280" y="26" width="30" height="46" fill="#060E2A"/>
                    <rect x="314" y="8" width="24" height="64" fill="#050C24"/>
                    <rect x="316" y="2" width="6" height="6" fill="#050C24"/>
                    <rect x="342" y="28" width="28" height="44" fill="#060F28"/>
                    <rect x="374" y="18" width="22" height="54" fill="#040D26"/>
                    <rect x="400" y="32" width="36" height="40" fill="#070E2C"/>
                    <rect x="440" y="12" width="26" height="60" fill="#050C22"/>
                    <rect x="470" y="24" width="30" height="48" fill="#06102A"/>
                    {/* Neon window lights */}
                    <rect x="8" y="32" width="3" height="2" fill="#22D3EE" opacity="0.9"/>
                    <rect x="14" y="32" width="3" height="2" fill="#22D3EE" opacity="0.7"/>
                    <rect x="8" y="38" width="3" height="2" fill="#F0ABFC" opacity="0.8"/>
                    <rect x="78" y="24" width="3" height="2" fill="#67E8F9" opacity="0.9"/>
                    <rect x="84" y="24" width="3" height="2" fill="#67E8F9" opacity="0.6"/>
                    <rect x="78" y="30" width="3" height="2" fill="#E879F9" opacity="0.8"/>
                    <rect x="142" y="16" width="3" height="2" fill="#22D3EE" opacity="0.9"/>
                    <rect x="142" y="22" width="3" height="2" fill="#F0ABFC" opacity="0.7"/>
                    <rect x="148" y="16" width="3" height="2" fill="#67E8F9" opacity="0.8"/>
                    <rect x="196" y="18" width="3" height="2" fill="#22D3EE" opacity="0.9"/>
                    <rect x="196" y="24" width="3" height="2" fill="#F0ABFC" opacity="0.6"/>
                    <rect x="258" y="22" width="3" height="2" fill="#67E8F9" opacity="0.8"/>
                    <rect x="264" y="22" width="3" height="2" fill="#E879F9" opacity="0.9"/>
                    <rect x="316" y="10" width="3" height="2" fill="#22D3EE" opacity="0.9"/>
                    <rect x="322" y="16" width="3" height="2" fill="#F0ABFC" opacity="0.7"/>
                    <rect x="376" y="24" width="3" height="2" fill="#67E8F9" opacity="0.8"/>
                    <rect x="382" y="24" width="3" height="2" fill="#22D3EE" opacity="0.6"/>
                    <rect x="442" y="18" width="3" height="2" fill="#E879F9" opacity="0.9"/>
                    <rect x="448" y="18" width="3" height="2" fill="#67E8F9" opacity="0.7"/>
                  </svg>
                </>
              )}

              {/* ── Sunset scene ── */}
              {ambiance === 'sunset' && (
                <>
                  {/* Sun */}
                  <div style={{ position: 'absolute', top: '18%', right: '22%', width: 58, height: 58, borderRadius: '50%', background: 'radial-gradient(circle, #FFFDE7 0%, #FFD54F 35%, #FF8F00 65%, transparent 100%)', boxShadow: '0 0 48px 20px rgba(255,180,0,0.35)', pointerEvents: 'none' }} />
                  {/* Light rays from sun */}
                  <div style={{ position: 'absolute', top: 0, right: 0, width: '65%', height: '100%', background: 'radial-gradient(ellipse at 75% 35%, rgba(255,214,0,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
                  {/* Atmospheric haze */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(0deg, rgba(255,220,120,0.28) 0%, transparent 100%)', pointerEvents: 'none' }} />
                  {/* Ocean & beach SVG */}
                  <svg viewBox="0 0 500 60" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 60, pointerEvents: 'none' }}>
                    {/* Water */}
                    <path d="M0 40 Q60 30 120 38 Q180 46 240 36 Q300 26 360 38 Q420 46 500 34 L500 60 L0 60 Z" fill="rgba(251,191,36,0.55)"/>
                    <path d="M0 48 Q80 38 160 46 Q240 54 320 42 Q400 32 500 44 L500 60 L0 60 Z" fill="rgba(245,158,11,0.45)"/>
                    {/* Sand */}
                    <path d="M0 54 Q120 48 250 52 Q380 56 500 50 L500 60 L0 60 Z" fill="rgba(253,230,138,0.6)"/>
                    {/* Sun reflection on water */}
                    <ellipse cx="350" cy="45" rx="18" ry="4" fill="rgba(255,245,130,0.5)"/>
                  </svg>
                  {/* Warm glow top-left */}
                  <div style={{ position: 'absolute', top: -20, left: -10, width: 100, height: 80, borderRadius: '50%', background: 'rgba(120,30,90,0.35)', filter: 'blur(28px)', pointerEvents: 'none' }} />
                </>
              )}

              {/* ── Natural scene ── */}
              {ambiance === 'natural' && (
                <>
                  {/* Sun top-right */}
                  <div style={{ position: 'absolute', top: -18, right: -10, width: 80, height: 80, borderRadius: '50%', background: 'radial-gradient(circle, #FEF08A 0%, #FDE047 40%, #FACC15 65%, transparent 100%)', boxShadow: '0 0 40px 16px rgba(253,224,71,0.3)', pointerEvents: 'none' }} />
                  {/* Sun rays */}
                  <div style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%', background: 'radial-gradient(ellipse at 90% 10%, rgba(253,224,71,0.2) 0%, transparent 65%)', pointerEvents: 'none' }} />
                  {/* Hills SVG */}
                  <svg viewBox="0 0 500 70" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 70, pointerEvents: 'none' }}>
                    {/* Back hills */}
                    <path d="M-10 55 Q60 10 130 40 Q200 68 270 28 Q340 -4 420 38 Q470 60 510 42 L510 70 L-10 70 Z" fill="rgba(22,101,52,0.7)"/>
                    {/* Front hills */}
                    <path d="M-10 62 Q70 30 150 50 Q230 68 310 38 Q380 14 460 50 Q490 62 510 55 L510 70 L-10 70 Z" fill="rgba(20,83,45,0.85)"/>
                    {/* Ground */}
                    <rect x="-10" y="62" width="520" height="10" fill="rgba(15,68,36,0.9)"/>
                    {/* Flowers (yellow dots) */}
                    {[28,68,108,152,196,240,288,332,380,428,468].map((x, i) => (
                      <circle key={i} cx={x} cy={60 + (i % 3) * 2} r="2.2" fill="#FDE047" opacity="0.95"/>
                    ))}
                    {[45,90,136,178,222,268,315,358,405,445].map((x, i) => (
                      <circle key={i} cx={x} cy={58 + (i % 2) * 3} r="1.6" fill="#A3E635" opacity="0.8"/>
                    ))}
                    {/* Tree trunks + canopy */}
                    <rect x="58" y="46" width="4" height="16" fill="rgba(10,40,20,0.8)"/>
                    <ellipse cx="60" cy="42" rx="9" ry="10" fill="rgba(22,163,74,0.75)"/>
                    <rect x="174" y="44" width="4" height="18" fill="rgba(10,40,20,0.8)"/>
                    <ellipse cx="176" cy="40" rx="10" ry="11" fill="rgba(21,128,61,0.7)"/>
                    <rect x="310" y="42" width="4" height="20" fill="rgba(10,40,20,0.8)"/>
                    <ellipse cx="312" cy="38" rx="11" ry="12" fill="rgba(22,163,74,0.72)"/>
                    <rect x="430" y="44" width="4" height="18" fill="rgba(10,40,20,0.8)"/>
                    <ellipse cx="432" cy="40" rx="9" ry="10" fill="rgba(20,83,45,0.7)"/>
                  </svg>
                  {/* Deep green atmosphere bottom */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 36, background: 'linear-gradient(0deg, rgba(10,40,18,0.55) 0%, transparent 100%)', pointerEvents: 'none' }} />
                </>
              )}

              </div>{/* fin calque clip scène */}

              {/* Close button — toujours en haut à droite */}
              <button
                type="button"
                onClick={handleClose}
                style={{
                  position: 'absolute', top: 12, right: 12,
                  border: 'none', background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(4px)',
                  borderRadius: '50%', width: 30, height: 30,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'rgba(255,255,255,0.85)', zIndex: 2,
                  transition: 'background 0.15s',
                }}
              >
                <X size={14} />
              </button>

              {/* Nom du voyage + destination */}
              <div style={{ position: 'relative', zIndex: 1, paddingTop: 2 }}>
                <input
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  placeholder="Nom du voyage…"
                  maxLength={80}
                  style={{
                    width: '100%', border: 'none', background: 'transparent', outline: 'none',
                    fontSize: 24, fontWeight: 800, color: 'rgba(255,255,255,0.97)',
                    letterSpacing: '-0.02em', caretColor: '#FBBF24',
                    lineHeight: 1.2, display: 'block', paddingRight: 42,
                    textShadow: '0 1px 8px rgba(0,0,0,0.35)',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                  <MapPin size={12} color="rgba(255,255,255,0.5)" strokeWidth={2} />
                  <input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Destination…"
                    maxLength={100}
                    style={{
                      flex: 1, border: 'none', background: 'transparent', outline: 'none',
                      fontSize: 13, color: 'rgba(255,255,255,0.65)', caretColor: '#FBBF24',
                    }}
                  />
                </div>
              </div>

              {/* Sélecteur d'ambiance */}
              <div ref={ambianceMenuRef} style={{ position: 'relative', zIndex: 50, marginTop: 14, display: 'inline-block' }}>
                <button
                  type="button"
                  onClick={() => setAmbianceMenuOpen((v) => !v)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px 5px 8px',
                    background: AMBIANCE_CONFIG[ambiance].pillBg,
                    backdropFilter: 'blur(8px)',
                    border: `1px solid ${AMBIANCE_CONFIG[ambiance].accentDot}44`,
                    borderRadius: 999, cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Dot couleur */}
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: AMBIANCE_CONFIG[ambiance].accentDot, boxShadow: `0 0 6px ${AMBIANCE_CONFIG[ambiance].accentDot}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: AMBIANCE_CONFIG[ambiance].pillText, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                    {AMBIANCE_CONFIG[ambiance].label}
                  </span>
                  <ChevronDown
                    size={10}
                    color={AMBIANCE_CONFIG[ambiance].pillText}
                    style={{ transition: 'transform 0.2s', transform: ambianceMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>

                {/* Dropdown */}
                <AnimatePresence>
                  {ambianceMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.14 }}
                      style={{
                        position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                        background: 'rgba(8,12,36,0.92)', backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12, overflow: 'hidden',
                        minWidth: 150, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                      }}
                    >
                      {(Object.entries(AMBIANCE_CONFIG) as [Ambiance, typeof AMBIANCE_CONFIG[Ambiance]][]).map(([key, cfg]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setAmbiance(key); setAmbianceMenuOpen(false) }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            width: '100%', padding: '9px 14px', border: 'none',
                            background: ambiance === key ? 'rgba(255,255,255,0.08)' : 'transparent',
                            cursor: 'pointer', transition: 'background 0.12s', textAlign: 'left',
                          }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.accentDot, boxShadow: `0 0 6px ${cfg.accentDot}`, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: ambiance === key ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>
                            {cfg.label}
                          </span>
                          <span style={{ fontSize: 14, marginLeft: 'auto' }}>{cfg.emoji}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

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
                {/* Header : titre + total sur la même ligne */}
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
                  <span
                    style={{
                      fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)',
                      color: totalBudget > 0 ? '#7C3AED' : 'var(--neutral-300)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {fmt(totalBudget)}
                  </span>
                </div>

                {/* Cartes : 2 colonnes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {VOYAGE_SUBCATEGORIES.map((sub) => {
                    const amountInputId = `sub-amount-${sub.id}`
                    const val = subBudgets[sub.id] ?? ''
                    const note = subNotes[sub.id] ?? ''
                    const hasVal = (parseFloat(val) || 0) > 0
                    return (
                      <div
                        key={sub.id}
                        style={{
                          border: `1.5px solid ${hasVal ? 'color-mix(in oklab, #7C3AED 32%, white)' : 'var(--neutral-200)'}`,
                          borderRadius: 10, padding: '5px 9px',
                          background: hasVal ? 'color-mix(in oklab, #7C3AED 5%, white)' : 'var(--neutral-0)',
                          display: 'flex', flexDirection: 'column', gap: 4,
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                      >
                        {/* Ligne unique : emoji + label (cliquable → focus montant) + montant + € */}
                        <label
                          htmlFor={amountInputId}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'text', margin: 0 }}
                        >
                          <span style={{ fontSize: 14, flexShrink: 0 }}>{sub.emoji}</span>
                          <span
                            style={{
                              flex: 1, fontSize: 11, fontWeight: 600, minWidth: 0,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              color: hasVal ? '#5B21B6' : 'var(--neutral-500)',
                            }}
                          >
                            {sub.name}
                          </span>
                          <input
                            id={amountInputId}
                            type="number"
                            min="0"
                            step="10"
                            value={val}
                            onChange={(e) => handleSubBudget(sub.id, e.target.value)}
                            placeholder="0"
                            style={{
                              width: 52, border: 'none', background: 'transparent', outline: 'none',
                              fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)',
                              color: hasVal ? '#7C3AED' : 'var(--neutral-300)',
                              letterSpacing: '-0.02em', textAlign: 'right', flexShrink: 0,
                              cursor: 'text',
                            }}
                          />
                          <span
                            style={{
                              fontSize: 11, fontWeight: 600, flexShrink: 0,
                              color: hasVal ? '#9D77C4' : 'var(--neutral-300)',
                            }}
                          >
                            €
                          </span>
                        </label>

                        {/* Champ notes libre */}
                        <input
                          type="text"
                          value={note}
                          onChange={(e) => handleSubNote(sub.id, e.target.value)}
                          placeholder="note…"
                          maxLength={120}
                          style={{
                            width: '100%', border: 'none', outline: 'none',
                            borderBottom: `1px solid ${note ? 'color-mix(in oklab, #7C3AED 22%, white)' : 'var(--neutral-150)'}`,
                            background: 'transparent', fontSize: 10.5, fontWeight: 500,
                            color: note ? '#5B21B6' : 'var(--neutral-400)',
                            padding: '2px 0', boxSizing: 'border-box',
                            transition: 'border-color 0.15s, color 0.15s',
                          }}
                        />
                      </div>
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
                padding: '14px 20px 16px', borderTop: '1px solid var(--neutral-100)',
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
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
