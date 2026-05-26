import { useState, useMemo, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, MapPin, Clock, ChevronDown } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { budgetDb } from '@/lib/supabaseBudget'
import { useAuth } from '@/hooks/useAuth'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { QK } from '@/lib/queryKeys'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import type { TripTransaction, TripWithStats } from '../types'

// ─── constants ────────────────────────────────────────────────────────────────

const VOYAGE_SUBCATEGORY_BLUEPRINTS = [
  { key: 'trajet', name: 'Trajet', emoji: '🚂', aliases: ['trajet', 'trajets'] },
  { key: 'logement', name: 'Logement', emoji: '🏨', aliases: ['logement', 'hebergement', 'hébergement'] },
  { key: 'repas', name: 'Repas', emoji: '🍽️', aliases: ['repas', 'restaurant'] },
  { key: 'activites', name: 'Activités', emoji: '🎭', aliases: ['activites', 'activités', 'activite', 'activité'] },
  { key: 'sorties', name: 'Sorties', emoji: '🥂', aliases: ['sorties', 'sortie'] },
  { key: 'extras', name: 'Extras', emoji: '🛍️', aliases: ['extras', 'extra', 'froustilles', 'froustilles voyage'] },
] as const

type Ambiance = 'city_lights' | 'sunset' | 'natural' | 'city_trip'

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
  city_trip: {
    label: 'City Trip',
    emoji: '🏙️',
    pillBg: 'rgba(194,24,91,0.22)',
    pillText: '#F48FB1',
    accentDot: '#E91E63',
    background: 'linear-gradient(185deg, #0A0118 0%, #160834 18%, #2B1060 36%, #6A1F8A 52%, #C0185A 68%, #E64A19 84%, #FF6E00 100%)',
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

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  mode?: 'create' | 'edit'
  tripToEdit?: TripWithStats | null
}

type SubBudgets = Record<string, string>
type SubJointFlags = Record<string, boolean>

function resolveAmbianceFromEmoji(emoji: string | null | undefined): Ambiance {
  if (emoji === AMBIANCE_CONFIG.sunset.emoji) return 'sunset'
  if (emoji === AMBIANCE_CONFIG.natural.emoji) return 'natural'
  if (emoji === AMBIANCE_CONFIG.city_trip.emoji) return 'city_trip'
  return 'city_lights'
}

function toIsoToday(): string {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function getSupabaseErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const maybe = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const message = typeof maybe.message === 'string' ? maybe.message.trim() : ''
    const details = typeof maybe.details === 'string' ? maybe.details.trim() : ''
    const hint = typeof maybe.hint === 'string' ? maybe.hint.trim() : ''
    const code = typeof maybe.code === 'string' ? maybe.code.trim() : ''

    const parts = [message, details, hint].filter((part) => part.length > 0)
    if (parts.length > 0) return parts.join(' — ')
    if (code.length > 0) return `Erreur Supabase (${code})`
  }
  return 'Une erreur est survenue'
}

export function PlanVoyageModal({ open, onClose, mode = 'create', tripToEdit = null }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const accountsQuery = useAccounts()
  const categoriesQuery = useCategories()

  const [tripName, setTripName] = useState('')
  const [destination, setDestination] = useState('')
  const [ambiance, setAmbiance] = useState<Ambiance>('city_lights')
  const [ambianceMenuOpen, setAmbianceMenuOpen] = useState(false)
  const ambianceMenuRef = useRef<HTMLDivElement>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [subBudgets, setSubBudgets] = useState<SubBudgets>({})
  const [subJointFlags, setSubJointFlags] = useState<SubJointFlags>({})
  const [tripNotes, setTripNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isLoadingPrefill, setIsLoadingPrefill] = useState(false)
  const [realizedCategoryTxModal, setRealizedCategoryTxModal] = useState<{
    open: boolean
    title: string
    transactions: TripTransaction[]
  }>({ open: false, title: '', transactions: [] })
  const [selectedTripTransaction, setSelectedTripTransaction] = useState<TripTransaction | null>(null)

  const isEditMode = mode === 'edit' && tripToEdit != null
  const editingTrip = tripToEdit?.trip ?? null
  const isPastTrip = useMemo(() => {
    if (!editingTrip) return false
    return editingTrip.end_date < toIsoToday()
  }, [editingTrip])
  const personalAccountId = useMemo(() => {
    const accounts = accountsQuery.data ?? []
    if (!accounts.length) return null
    const withoutJoint = accounts.filter((account) => !/joint/i.test(account.name))
    return (
      withoutJoint.find((account) => account.account_type === 'checking')?.id
      ?? withoutJoint[0]?.id
      ?? accounts.find((account) => account.account_type === 'checking')?.id
      ?? accounts[0]?.id
      ?? null
    )
  }, [accountsQuery.data])
  const jointAccountId = useMemo(() => {
    const accounts = accountsQuery.data ?? []
    return accounts.find((account) => /joint/i.test(account.name))?.id ?? null
  }, [accountsQuery.data])
  const voyageSubcategories = useMemo(() => {
    const categories = categoriesQuery.data ?? []
    const expenseCategories = categories.filter((category) => category.flow_type === 'expense')
    const voyagesRoot = expenseCategories.find(
      (category) => category.parent_id === null && normalizeToken(category.name) === 'voyages',
    ) ?? null
    const preferredPool = voyagesRoot
      ? expenseCategories.filter((category) => category.parent_id === voyagesRoot.id)
      : expenseCategories
    const preferredPoolOrdered = [...preferredPool].sort((a, b) => a.sort_order - b.sort_order)

    return VOYAGE_SUBCATEGORY_BLUEPRINTS.map((blueprint, index) => {
      const aliases = blueprint.aliases as readonly string[]
      const direct = preferredPool.find((category) => aliases.includes(normalizeToken(category.name)))
      const fallback = expenseCategories.find((category) => aliases.includes(normalizeToken(category.name)))
      const fallbackByIndex = preferredPoolOrdered[index] ?? null
      const matched = direct ?? fallback ?? fallbackByIndex

      return {
        ...blueprint,
        id: matched?.id ?? null,
        label: matched?.name ?? blueprint.name,
      }
    })
  }, [categoriesQuery.data])
  const voyageSubcategoryIds = useMemo(
    () => voyageSubcategories.map((sub) => sub.id).filter((id): id is string => Boolean(id)),
    [voyageSubcategories],
  )
  const voyageSubcategoryById = useMemo(() => {
    const map = new Map<string, (typeof voyageSubcategories)[number]>()
    for (const sub of voyageSubcategories) {
      if (!sub.id) continue
      map.set(sub.id, sub)
    }
    return map
  }, [voyageSubcategories])

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

  useEffect(() => {
    if (!open) return
    if (!isEditMode || !editingTrip || !user?.id) return

    setTripName(editingTrip.name ?? '')
    setDestination(editingTrip.notes ?? '')
    setAmbiance(resolveAmbianceFromEmoji(editingTrip.emoji))
    setStartDate(editingTrip.start_date ?? '')
    setEndDate(editingTrip.end_date ?? '')
    setSubmitError(null)

    if (isPastTrip) return

    let cancelled = false
    const loadPlannedOperations = async () => {
      setIsLoadingPrefill(true)
      try {
        const categoryIds = voyageSubcategoryIds
        if (categoryIds.length === 0) {
          if (cancelled) return
          setSubBudgets({})
          setSubJointFlags({})
          setTripNotes('')
          return
        }
        const { data, error } = await budgetDb
          .from('planned_operations')
          .select('category_id, planned_amount, notes, personal_share_ratio, is_joint_expense')
          .eq('user_id', user.id)
          .eq('label', editingTrip.name)
          .gte('planned_date', editingTrip.start_date)
          .lte('planned_date', editingTrip.end_date)
          .in('category_id', categoryIds)

        if (error) throw error
        if (cancelled) return

        const nextBudgets: SubBudgets = {}
        const nextJointFlags: SubJointFlags = {}
        let nextTripNotes: string | null = null

        for (const row of data ?? []) {
          const catId = String(row.category_id ?? '')
          if (!catId) continue
          const matchedSub = voyageSubcategoryById.get(catId)
          if (!matchedSub) continue
          const amount = Number(row.planned_amount ?? 0)
          nextBudgets[matchedSub.key] = String((Number(nextBudgets[matchedSub.key] ?? '0') || 0) + amount)
          if (Boolean(row.is_joint_expense) || Number(row.personal_share_ratio ?? 1) < 1) {
            nextJointFlags[matchedSub.key] = true
          }
          if (nextTripNotes == null && typeof row.notes === 'string' && row.notes.trim()) nextTripNotes = row.notes.trim()
        }

        setSubBudgets(nextBudgets)
        setSubJointFlags(nextJointFlags)
        setTripNotes(nextTripNotes ?? '')
      } catch {
        if (cancelled) return
        setSubBudgets({})
        setSubJointFlags({})
        setTripNotes('')
      } finally {
        if (!cancelled) setIsLoadingPrefill(false)
      }
    }

    void loadPlannedOperations()
    return () => {
      cancelled = true
    }
  }, [editingTrip, isEditMode, isPastTrip, open, user?.id, voyageSubcategoryById, voyageSubcategoryIds])

  const duration = useMemo(() => dateDiffDays(startDate, endDate), [startDate, endDate])
  const personalImputedBudget = useMemo(
    () => voyageSubcategories.reduce((sum, sub) => {
      const amount = parseFloat(subBudgets[sub.key] ?? '0') || 0
      const ratio = subJointFlags[sub.key] ? 0.5 : 1
      return sum + amount * ratio
    }, 0),
    [subBudgets, subJointFlags, voyageSubcategories],
  )
  const realizedTotalsByCategory = useMemo(() => {
    if (!tripToEdit) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const tx of tripToEdit.transactions) {
      const key = tx.category_id ?? '__unknown__'
      map.set(key, (map.get(key) ?? 0) + Number(tx.amount ?? 0))
    }
    return map
  }, [tripToEdit])
  const realizedTotal = useMemo(
    () => voyageSubcategories.reduce((sum, sub) => sum + (sub.id ? (realizedTotalsByCategory.get(sub.id) ?? 0) : 0), 0),
    [realizedTotalsByCategory, voyageSubcategories],
  )
  const displayedBudgetTotal = isEditMode && isPastTrip ? realizedTotal : personalImputedBudget
  const categoryIconKeyById = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const category of categoriesQuery.data ?? []) {
      map.set(category.id, category.icon_key ?? null)
    }
    return map
  }, [categoriesQuery.data])

  function handleSubBudget(catId: string, val: string) {
    setSubBudgets((prev) => ({ ...prev, [catId]: val }))
  }

  function handleSubJointFlag(catId: string, next: boolean) {
    setSubJointFlags((prev) => ({ ...prev, [catId]: next }))
  }

  async function handleSubmit() {
    if (!user?.id || !tripName.trim() || !startDate) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const accountId = personalAccountId ?? jointAccountId
      if (!accountId) {
        throw new Error('Aucun compte disponible pour enregistrer ce voyage.')
      }
      const normalizedTripName = tripName.trim()
      const normalizedDestination = destination.trim() || null
      const normalizedTripNotes = tripNotes.trim() || null
      const resolvedEndDate = endDate || startDate
      const nonZeroSubs = voyageSubcategories.filter(
        (sub): sub is (typeof voyageSubcategories)[number] & { id: string } =>
          Boolean(sub.id) && (parseFloat(subBudgets[sub.key] ?? '0') || 0) > 0,
      )
      const computedPlannedBudget = nonZeroSubs.reduce(
        (sum, sub) => {
          const amount = parseFloat(subBudgets[sub.key] ?? '0') || 0
          const ratio = subJointFlags[sub.key] ? 0.5 : 1
          return sum + amount * ratio
        },
        0,
      )
      const nextPlannedBudget = isEditMode && isPastTrip
        ? editingTrip?.planned_budget ?? null
        : (computedPlannedBudget > 0 ? computedPlannedBudget : null)

      if (isEditMode && editingTrip) {
        const { error: updateTripErr } = await budgetDb
          .from('trips')
          .update({
            name: normalizedTripName,
            start_date: startDate,
            end_date: resolvedEndDate,
            emoji: AMBIANCE_CONFIG[ambiance].emoji,
            notes: normalizedDestination,
            planned_budget: nextPlannedBudget,
          })
          .eq('id', editingTrip.id)
          .eq('user_id', user.id)
        if (updateTripErr) throw updateTripErr

        if (!isPastTrip) {
          const oldCategoryIds = voyageSubcategoryIds
          const { data: existingPlannedRows, error: existingPlannedErr } = oldCategoryIds.length > 0
            ? await budgetDb
              .from('planned_operations')
              .select('id, category_id')
              .eq('user_id', user.id)
              .eq('label', editingTrip.name)
              .gte('planned_date', editingTrip.start_date)
              .lte('planned_date', editingTrip.end_date)
              .in('category_id', oldCategoryIds)
            : { data: [], error: null }
          if (existingPlannedErr) throw existingPlannedErr

          const existingRowsByCategory = new Map<string, string[]>()
          for (const row of existingPlannedRows ?? []) {
            const catId = typeof row.category_id === 'string' ? row.category_id : null
            if (!catId) continue
            const prev = existingRowsByCategory.get(catId) ?? []
            prev.push(row.id)
            existingRowsByCategory.set(catId, prev)
          }

          const reusedRowIds = new Set<string>()

          for (const sub of nonZeroSubs) {
            const amt = parseFloat(subBudgets[sub.key] ?? '0') || 0
            const isJointExpense = Boolean(subJointFlags[sub.key])
            const personalShareRatio = isJointExpense ? 0.5 : 1
            const categoryRowIds = existingRowsByCategory.get(sub.id) ?? []
            const rowIdToReuse = categoryRowIds.shift()
            existingRowsByCategory.set(sub.id, categoryRowIds)

            if (rowIdToReuse) {
              reusedRowIds.add(rowIdToReuse)
              const { error: opUpdateErr } = await budgetDb
                .from('planned_operations')
                .update({
                  account_id: accountId,
                  category_id: sub.id,
                  label: normalizedTripName,
                  planned_date: startDate,
                  planned_amount: amt,
                  personal_share_ratio: personalShareRatio,
                  notes: normalizedTripNotes,
                  is_joint_expense: isJointExpense,
                  recurrence_day_of_month: null,
                  recurrence_start_date: null,
                  recurrence_end_date: null,
                })
                .eq('id', rowIdToReuse)
                .eq('user_id', user.id)

              if (opUpdateErr) throw opUpdateErr
            } else {
              const { error: opInsertErr } = await budgetDb.from('planned_operations').insert({
                user_id: user.id,
                account_id: accountId,
                category_id: sub.id,
                merchant_name: null,
                label: normalizedTripName,
                planned_date: startDate,
                planned_amount: amt,
                currency: 'EUR',
                flow_type: 'expense',
                status: 'planned',
                budget_impact: 'additional_commitment',
                personal_share_ratio: personalShareRatio,
                matched_transaction_id: null,
                notes: normalizedTripNotes,
                is_joint_expense: isJointExpense,
                is_recurring: false,
                recurrence_frequency: 'none',
                recurrence_day_of_month: null,
                recurrence_start_date: null,
                recurrence_end_date: null,
              })
              if (opInsertErr) throw opInsertErr
            }
          }

          const rowIdsToDelete = (existingPlannedRows ?? [])
            .map((row) => row.id)
            .filter((id) => !reusedRowIds.has(id))

          if (rowIdsToDelete.length > 0) {
            const { error: deleteErr } = await budgetDb
              .from('planned_operations')
              .delete()
              .in('id', rowIdsToDelete)
              .eq('user_id', user.id)
            if (deleteErr) throw deleteErr
          }
        }

        void queryClient.invalidateQueries({ queryKey: [QK.VOYAGES] })
        void queryClient.invalidateQueries({ queryKey: [QK.VOYAGES_TRANSACTIONS] })
        void queryClient.invalidateQueries({ queryKey: [QK.PLANNED_OPERATIONS] })

        resetForm()
        onClose()
        return
      }

      const { error: tripErr } = await budgetDb.from('trips').insert({
        user_id: user.id,
        name: normalizedTripName,
        start_date: startDate,
        end_date: resolvedEndDate,
        emoji: AMBIANCE_CONFIG[ambiance].emoji,
        notes: normalizedDestination,
        planned_budget: computedPlannedBudget > 0 ? computedPlannedBudget : null,
      })
      if (tripErr) throw tripErr

      for (const sub of nonZeroSubs) {
        const amt = parseFloat(subBudgets[sub.key] ?? '0') || 0
        const isJointExpense = Boolean(subJointFlags[sub.key])
        const personalShareRatio = isJointExpense ? 0.5 : 1
        const { error: opErr } = await budgetDb.from('planned_operations').insert({
          user_id: user.id,
          account_id: accountId,
          category_id: sub.id,
          merchant_name: null,
          label: normalizedTripName,
          planned_date: startDate,
          planned_amount: amt,
          currency: 'EUR',
          flow_type: 'expense',
          status: 'planned',
          budget_impact: 'additional_commitment',
          personal_share_ratio: personalShareRatio,
          matched_transaction_id: null,
          notes: normalizedTripNotes,
          is_joint_expense: isJointExpense,
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
      setSubmitError(getSupabaseErrorMessage(e))
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
    setSubJointFlags({})
    setTripNotes('')
    setSubmitError(null)
    setIsLoadingPrefill(false)
    setRealizedCategoryTxModal({ open: false, title: '', transactions: [] })
    setSelectedTripTransaction(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }
  function closeRealizedCategoryModal() {
    setRealizedCategoryTxModal((prev) => ({ ...prev, open: false }))
  }

  function closeTripTransactionModal() {
    setSelectedTripTransaction(null)
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
            aria-label={isEditMode ? 'Modifier un voyage' : 'Planifier un voyage'}
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
              style={{ padding: '16px 18px 16px', position: 'relative', flexShrink: 0 }}
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

              {/* ── City Trip scene ── */}
              {ambiance === 'city_trip' && (
                <>
                  <style>{`
                    @keyframes ct-sign-a { 0%,100%{opacity:.88} 44%,53%{opacity:.22} }
                    @keyframes ct-sign-b { 0%,100%{opacity:.8} 20%,30%{opacity:.18} 68%,75%{opacity:.48} }
                    @keyframes ct-sign-c { 0%,100%{opacity:.74} 54%,64%{opacity:.16} }
                    @keyframes ct-car-r  { from{transform:translateX(-110px)} to{transform:translateX(620px)} }
                    @keyframes ct-car-l  { from{transform:translateX(620px)}  to{transform:translateX(-110px)} }
                    @keyframes ct-ped-l  { from{transform:translateX(130px)}  to{transform:translateX(-80px)} }
                    @keyframes ct-ped-r  { from{transform:translateX(-80px)}  to{transform:translateX(130px)} }
                  `}</style>

                  {/* Atmosphere blobs */}
                  <div style={{ position:'absolute', top:-30, left:-20, width:160, height:160, borderRadius:'50%', background:'rgba(107,31,138,0.4)', filter:'blur(50px)', pointerEvents:'none' }} />
                  <div style={{ position:'absolute', top:-20, right:0, width:130, height:130, borderRadius:'50%', background:'rgba(194,24,91,0.3)', filter:'blur(42px)', pointerEvents:'none' }} />
                  <div style={{ position:'absolute', bottom:-30, right:-20, width:150, height:150, borderRadius:'50%', background:'rgba(230,74,25,0.2)', filter:'blur(48px)', pointerEvents:'none' }} />
                  <div style={{ position:'absolute', top:0, left:'44%', width:55, height:55, borderRadius:'50%', background:'rgba(194,24,91,0.28)', filter:'blur(18px)', pointerEvents:'none' }} />

                  {/* Street scene SVG */}
                  <svg viewBox="0 0 500 120" preserveAspectRatio="none" style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}>
                    <defs>
                      <linearGradient id="ct-road" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#100528" stopOpacity="1"/>
                        <stop offset="100%" stopColor="#0A0320" stopOpacity="1"/>
                      </linearGradient>
                      <radialGradient id="ct-vp" cx="50%" cy="20%" r="28%">
                        <stop offset="0%" stopColor="#C2185B" stopOpacity="0.45"/>
                        <stop offset="100%" stopColor="#C2185B" stopOpacity="0"/>
                      </radialGradient>
                      <radialGradient id="ct-lamp-l" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#FDE047" stopOpacity="0.65"/>
                        <stop offset="100%" stopColor="#FDE047" stopOpacity="0"/>
                      </radialGradient>
                      <radialGradient id="ct-lamp-r" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#FDE047" stopOpacity="0.65"/>
                        <stop offset="100%" stopColor="#FDE047" stopOpacity="0"/>
                      </radialGradient>
                    </defs>

                    {/* Building facades */}
                    <rect x="0" y="0" width="178" height="120" fill="#130828"/>
                    <rect x="0" y="0" width="10" height="120" fill="#0D0420"/>
                    <rect x="155" y="0" width="23" height="88" fill="#180A35"/>
                    <rect x="322" y="0" width="178" height="120" fill="#130828"/>
                    <rect x="490" y="0" width="10" height="120" fill="#0D0420"/>
                    <rect x="322" y="0" width="23" height="88" fill="#180A35"/>

                    {/* Street */}
                    <polygon points="178,120 322,120 275,0 225,0" fill="url(#ct-road)"/>
                    <polygon points="178,120 322,120 275,0 225,0" fill="rgba(194,24,91,0.11)"/>
                    <rect x="0" y="0" width="500" height="120" fill="url(#ct-vp)"/>

                    {/* Road center dashes */}
                    <rect x="249" y="96" width="2.2" height="9" fill="rgba(255,140,180,0.35)"/>
                    <rect x="249.5" y="77" width="1.8" height="7" fill="rgba(255,140,180,0.25)"/>
                    <rect x="249.8" y="60" width="1.5" height="6" fill="rgba(255,140,180,0.17)"/>
                    <rect x="250" y="46" width="1.2" height="5" fill="rgba(255,140,180,0.11)"/>
                    <rect x="250" y="35" width="1" height="4" fill="rgba(255,140,180,0.07)"/>

                    {/* Sidewalks */}
                    <polygon points="0,88 178,120 0,120" fill="#160434" opacity="0.88"/>
                    <polygon points="500,88 322,120 500,120" fill="#160434" opacity="0.88"/>

                    {/* Left windows */}
                    {([
                      [8,5],[22,5],[36,5],[50,5],[64,5],[78,5],[92,5],[106,5],[120,5],[134,5],[148,5],[162,5],
                      [8,17],[36,17],[64,17],[78,17],[106,17],[134,17],[148,17],
                      [8,29],[22,29],[50,29],[78,29],[92,29],[120,29],[148,29],
                      [8,41],[36,41],[64,41],[92,41],[120,41],[148,41],
                      [22,53],[50,53],[78,53],[106,53],[134,53],
                      [8,65],[36,65],[64,65],[92,65],[120,65],
                      [22,77],[64,77],[106,77],[148,77],
                      [8,89],[50,89],[92,89],[134,89],
                    ] as [number,number][]).map(([x,y],i) => (
                      <rect key={i} x={x} y={y} width="9" height="6"
                        fill={['#E91E63','#7C3AED','#22D3EE','#F59E0B','#C2185B','#06B6D4'][i%6]}
                        opacity={0.18+((i*17)%12)*0.04}/>
                    ))}

                    {/* Right windows */}
                    {([
                      [330,5],[344,5],[358,5],[372,5],[386,5],[400,5],[414,5],[428,5],[442,5],[456,5],[470,5],[484,5],
                      [330,17],[358,17],[386,17],[414,17],[442,17],[470,17],
                      [344,29],[372,29],[400,29],[428,29],[456,29],[484,29],
                      [330,41],[358,41],[400,41],[428,41],[456,41],
                      [344,53],[386,53],[428,53],[470,53],
                      [330,65],[372,65],[414,65],[456,65],
                      [344,77],[400,77],[456,77],[484,77],
                      [330,89],[386,89],[442,89],[484,89],
                    ] as [number,number][]).map(([x,y],i) => (
                      <rect key={i} x={x} y={y} width="9" height="6"
                        fill={['#C2185B','#6D28D9','#06B6D4','#EA580C','#E91E63','#7C3AED'][i%6]}
                        opacity={0.18+((i*19)%12)*0.04}/>
                    ))}

                    {/* Neon signs — left */}
                    <rect x="6" y="96" width="64" height="13" rx="3" fill="#E91E63" opacity="0.88" style={{animation:'ct-sign-a 3.2s ease-in-out infinite'}}/>
                    <rect x="7" y="97" width="62" height="11" rx="2" fill="none" stroke="rgba(255,192,210,0.55)" strokeWidth="0.8"/>
                    <rect x="12" y="100" width="18" height="2" rx="1" fill="rgba(255,255,255,0.38)"/>
                    <rect x="12" y="104" width="11" height="1.5" rx="0.75" fill="rgba(255,255,255,0.22)"/>
                    <rect x="82" y="91" width="48" height="10" rx="2" fill="#7C3AED" opacity="0.82" style={{animation:'ct-sign-b 4.3s ease-in-out infinite 0.8s'}}/>
                    <rect x="83" y="92" width="46" height="8" rx="1.5" fill="none" stroke="rgba(192,160,255,0.4)" strokeWidth="0.7"/>
                    <rect x="138" y="94" width="34" height="10" rx="2" fill="#FF6F00" opacity="0.75" style={{animation:'ct-sign-c 5.1s ease-in-out infinite 1.6s'}}/>

                    {/* Neon signs — right */}
                    <rect x="430" y="96" width="64" height="13" rx="3" fill="#C2185B" opacity="0.88" style={{animation:'ct-sign-b 3.8s ease-in-out infinite 0.4s'}}/>
                    <rect x="431" y="97" width="62" height="11" rx="2" fill="none" stroke="rgba(255,160,200,0.55)" strokeWidth="0.8"/>
                    <rect x="470" y="100" width="18" height="2" rx="1" fill="rgba(255,255,255,0.32)"/>
                    <rect x="370" y="91" width="48" height="10" rx="2" fill="#6D28D9" opacity="0.82" style={{animation:'ct-sign-a 4.7s ease-in-out infinite 1.2s'}}/>
                    <rect x="328" y="94" width="34" height="10" rx="2" fill="#EA580C" opacity="0.75" style={{animation:'ct-sign-c 5.7s ease-in-out infinite 0.7s'}}/>

                    {/* Street lamp — left */}
                    <rect x="169" y="56" width="3" height="64" fill="#251060" opacity="0.92"/>
                    <rect x="162" y="56" width="10" height="3" fill="#251060" opacity="0.85"/>
                    <ellipse cx="162" cy="57" rx="17" ry="13" fill="url(#ct-lamp-l)" opacity="0.78"/>
                    <circle cx="162" cy="57" r="5" fill="rgba(253,224,71,0.88)"/>
                    <circle cx="162" cy="57" r="2.2" fill="#FFFDE7"/>

                    {/* Street lamp — right */}
                    <rect x="328" y="56" width="3" height="64" fill="#251060" opacity="0.92"/>
                    <rect x="328" y="56" width="10" height="3" fill="#251060" opacity="0.85"/>
                    <ellipse cx="338" cy="57" rx="17" ry="13" fill="url(#ct-lamp-r)" opacity="0.78"/>
                    <circle cx="338" cy="57" r="5" fill="rgba(253,224,71,0.88)"/>
                    <circle cx="338" cy="57" r="2.2" fill="#FFFDE7"/>
                  </svg>

                  {/* Car headlights going right */}
                  <div style={{ position:'absolute', bottom:28, left:0, pointerEvents:'none', animation:'ct-car-r 5.5s linear infinite 0.5s', width:72, height:2.5, borderRadius:4, background:'linear-gradient(90deg,transparent,rgba(255,230,100,0.9),rgba(255,255,220,0.7),transparent)' }} />
                  {/* Car taillights going left */}
                  <div style={{ position:'absolute', bottom:20, right:0, pointerEvents:'none', animation:'ct-car-l 7s linear infinite 3s', width:56, height:2, borderRadius:4, background:'linear-gradient(90deg,transparent,rgba(239,68,68,0.8),rgba(239,68,68,0.55),transparent)' }} />

                  {/* Pedestrians left sidewalk */}
                  <div style={{ position:'absolute', bottom:6, left:85, pointerEvents:'none', animation:'ct-ped-l 8s linear infinite', width:5, height:20, borderRadius:'3px 3px 0 0', background:'rgba(0,0,0,0.72)' }} />
                  <div style={{ position:'absolute', bottom:6, left:50, pointerEvents:'none', animation:'ct-ped-l 10s linear infinite 3.5s', width:4, height:17, borderRadius:'3px 3px 0 0', background:'rgba(0,0,0,0.62)' }} />
                  {/* Pedestrian right sidewalk */}
                  <div style={{ position:'absolute', bottom:6, right:85, pointerEvents:'none', animation:'ct-ped-r 9s linear infinite 1.5s', width:5, height:20, borderRadius:'3px 3px 0 0', background:'rgba(0,0,0,0.72)' }} />
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

              {/* Nom du voyage + destination + meta */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  paddingTop: 2,
                  minHeight: 112,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 5,
                }}
              >
                <input
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  placeholder="Nom du voyage…"
                  maxLength={80}
                  style={{
                    width: '100%', border: 'none', background: 'transparent', outline: 'none',
                    fontSize: 28, fontWeight: 800, color: 'rgba(255,255,255,0.97)',
                    letterSpacing: '-0.02em', caretColor: '#FBBF24',
                    lineHeight: 1.08, display: 'block', paddingRight: 42,
                    transform: 'scale(1.08)', transformOrigin: 'left center',
                    textShadow: '0 1px 8px rgba(0,0,0,0.35)',
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
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

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 29 }}>
                  {duration > 0 ? (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 10px 5px 8px',
                        background: 'rgba(255,255,255,0.18)',
                        border: '1px solid rgba(255,255,255,0.28)',
                        borderRadius: 999,
                      }}
                    >
                      <Clock size={10} color="rgba(255,255,255,0.92)" strokeWidth={2.2} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.95)', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                        {duration} jour{duration > 1 ? 's' : ''}
                      </span>
                    </div>
                  ) : (
                    <span aria-hidden="true" style={{ width: 1, height: 1 }} />
                  )}

                  {/* Sélecteur d'ambiance */}
                  <div ref={ambianceMenuRef} style={{ position: 'relative', zIndex: 50, display: 'inline-block' }}>
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

                    <AnimatePresence>
                      {ambianceMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.97 }}
                          transition={{ duration: 0.14 }}
                          style={{
                            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
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
                </div>
              </div>
            </motion.div>

            {/* ── Body (scrollable) ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 8px' }}>

              {/* Dates */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label
                      style={{ fontSize: 11, color: 'var(--neutral-500)', display: 'block', marginBottom: 4, fontWeight: 600 }}
                    >
                      Départ
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{
                        width: '100%', border: '1.5px solid var(--neutral-200)', borderRadius: 10,
                        padding: '7px 10px', fontSize: 12, color: 'var(--neutral-800)',
                        background: 'var(--neutral-50)', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{ fontSize: 11, color: 'var(--neutral-500)', display: 'block', marginBottom: 4, fontWeight: 600 }}
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
                        padding: '7px 10px', fontSize: 12, color: 'var(--neutral-800)',
                        background: 'var(--neutral-50)', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Budget / Réalisé par sous-catégorie */}
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
                    {isEditMode && isPastTrip ? 'Dépenses réalisées' : 'Budget prévu'}
                  </p>
                  <span
                    style={{
                      fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)',
                      color: displayedBudgetTotal > 0 ? '#7C3AED' : 'var(--neutral-300)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {fmt(displayedBudgetTotal)}
                  </span>
                </div>

                {isEditMode && isPastTrip ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {voyageSubcategories.map((sub) => {
                      const amount = sub.id ? (realizedTotalsByCategory.get(sub.id) ?? 0) : 0
                      const txRows = sub.id
                        ? (tripToEdit?.transactions ?? []).filter((tx) => tx.category_id === sub.id)
                        : []
                      const hasVal = amount > 0
                      return (
                        <button
                          key={sub.key}
                          type="button"
                          onClick={() => setRealizedCategoryTxModal({
                            open: true,
                            title: sub.label,
                            transactions: txRows.sort((a, b) => `${a.transaction_date}::${a.id}`.localeCompare(`${b.transaction_date}::${b.id}`)),
                          })}
                          style={{
                            border: `1.5px solid ${hasVal ? 'color-mix(in oklab, #7C3AED 32%, white)' : 'var(--neutral-200)'}`,
                            borderRadius: 10, padding: '6px 8px',
                            background: hasVal ? 'color-mix(in oklab, #7C3AED 5%, white)' : 'var(--neutral-0)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 6,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <CategoryIcon
                              iconKey={sub.id ? (categoryIconKeyById.get(sub.id) ?? null) : null}
                              label={sub.label}
                              size={16}
                              style={{ flexShrink: 0 }}
                            />
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: hasVal ? '#5B21B6' : 'var(--neutral-500)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {sub.label}
                            </span>
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: hasVal ? '#7C3AED' : 'var(--neutral-400)' }}>
                            {fmt(amount)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {voyageSubcategories.map((sub) => {
                      const amountInputId = `sub-amount-${sub.key}`
                      const jointInputId = `sub-joint-${sub.key}`
                      const val = subBudgets[sub.key] ?? ''
                      const isSubJoint = Boolean(subJointFlags[sub.key])
                      const hasVal = (parseFloat(val) || 0) > 0
                      return (
                        <div
                          key={sub.key}
                          style={{
                            border: `1.5px solid ${hasVal ? 'color-mix(in oklab, #7C3AED 32%, white)' : 'var(--neutral-200)'}`,
                            borderRadius: 10, padding: '5px 9px',
                            background: hasVal ? 'color-mix(in oklab, #7C3AED 5%, white)' : 'var(--neutral-0)',
                            display: 'flex', flexDirection: 'column', gap: 4,
                            transition: 'border-color 0.15s, background 0.15s',
                          }}
                        >
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
                              {sub.label}
                            </span>
                            <input
                              id={amountInputId}
                              type="number"
                              min="0"
                              step="10"
                              value={val}
                              onChange={(e) => handleSubBudget(sub.key, e.target.value)}
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

                          <label
                            htmlFor={jointInputId}
                            style={{
                              marginTop: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: 6,
                              cursor: 'pointer',
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                textTransform: 'lowercase',
                                color: isSubJoint ? '#6D28D9' : 'var(--neutral-400)',
                              }}
                            >
                              joint
                            </span>
                            <input
                              id={jointInputId}
                              type="checkbox"
                              checked={isSubJoint}
                              onChange={(e) => handleSubJointFlag(sub.key, e.target.checked)}
                              style={{ width: 13, height: 13, accentColor: '#6D28D9', cursor: 'pointer' }}
                              aria-label={`Dépense jointe pour ${sub.label}`}
                            />
                          </label>
                        </div>
                      )
                    })}
                  </div>
                )}
                {isLoadingPrefill && !(isEditMode && isPastTrip) ? (
                  <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--neutral-500)' }}>
                    Chargement des données prévues...
                  </p>
                ) : null}
              </div>

              {!(isEditMode && isPastTrip) ? (
                <div style={{ marginBottom: 12 }}>
                  <label
                    htmlFor="trip-global-notes"
                    style={{
                      margin: '0 0 7px',
                      display: 'block',
                      fontSize: 10.5,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      color: 'var(--neutral-400)',
                    }}
                  >
                    Notes
                  </label>
                  <textarea
                    id="trip-global-notes"
                    value={tripNotes}
                    onChange={(e) => setTripNotes(e.target.value)}
                    placeholder="Ajouter une note pour ce voyage…"
                    maxLength={500}
                    rows={3}
                    style={{
                      width: '100%',
                      resize: 'vertical',
                      border: '1.5px solid var(--neutral-200)',
                      borderRadius: 10,
                      padding: '8px 10px',
                      fontSize: 12,
                      color: 'var(--neutral-800)',
                      background: 'var(--neutral-0)',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>
              ) : null}

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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderRadius: 12,
                    padding: '10px 12px',
                    background: 'linear-gradient(135deg, #F97316 0%, #EF4444 100%)',
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: isSubmitting ? 'default' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderRadius: 12,
                    padding: '10px 12px',
                    background: canSubmit
                      ? 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 55%, #6D28D9 100%)'
                      : 'var(--neutral-150)',
                    color: canSubmit ? 'white' : 'var(--neutral-400)',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: canSubmit ? 'pointer' : 'default',
                    boxShadow: canSubmit ? '0 4px 14px rgba(124,58,237,0.35)' : 'none',
                    transition: 'all 0.2s',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </motion.section>

          <AnimatePresence>
            {realizedCategoryTxModal.open ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                style={{ position: 'fixed', inset: 0, zIndex: 145, background: 'rgba(12,10,62,0.42)', display: 'grid', placeItems: 'center', padding: '16px', pointerEvents: 'auto' }}
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) closeRealizedCategoryModal()
                }}
              >
                <motion.div
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 12, opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 'min(520px, 100%)', maxHeight: '78vh', background: 'var(--neutral-0)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', boxShadow: '0 8px 30px rgba(12,10,62,0.2)', display: 'grid', gridTemplateRows: 'auto 1fr' }}
                >
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--neutral-150)', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--neutral-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {realizedCategoryTxModal.title}
                    </p>
                    <button
                      type="button"
                      onClick={closeRealizedCategoryModal}
                      aria-label="Fermer la liste des dépenses"
                      style={{ width: 28, height: 28, border: 'none', borderRadius: 'var(--radius-full)', background: 'var(--neutral-100)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div style={{ overflowY: 'auto', padding: '6px 14px 14px' }}>
                    {realizedCategoryTxModal.transactions.length === 0 ? (
                      <p style={{ margin: 'var(--space-4) 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
                        Aucune dépense sur ce poste budgétaire.
                      </p>
                    ) : realizedCategoryTxModal.transactions.map((tx) => (
                      <button
                        key={tx.id}
                        type="button"
                        onClick={() => setSelectedTripTransaction(tx)}
                        style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--neutral-100)', background: 'transparent', padding: '8px 0', display: 'grid', gridTemplateColumns: '84px minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <span style={{ fontSize: 11, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>
                          {new Date(`${tx.transaction_date}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                        <span style={{ minWidth: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {(tx.normalized_label ?? tx.merchant_name ?? tx.raw_label ?? 'Opération').trim() || 'Opération'}
                        </span>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', whiteSpace: 'nowrap' }}>
                          {fmt(Number(tx.amount)).replace(/\s+€/, '€')}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {selectedTripTransaction ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                style={{ position: 'fixed', inset: 0, zIndex: 146, background: 'rgba(12,10,62,0.4)', display: 'grid', placeItems: 'center', padding: '16px', pointerEvents: 'auto' }}
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) closeTripTransactionModal()
                }}
              >
                <motion.div
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 12, opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 'min(460px, 100%)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-xl)', boxShadow: '0 8px 30px rgba(12,10,62,0.2)', overflow: 'hidden' }}
                >
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--neutral-150)', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--neutral-900)' }}>
                      Détail opération
                    </p>
                    <button
                      type="button"
                      onClick={closeTripTransactionModal}
                      aria-label="Fermer le détail opération"
                      style={{ width: 28, height: 28, border: 'none', borderRadius: 'var(--radius-full)', background: 'var(--neutral-100)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div style={{ padding: '14px', display: 'grid', gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-500)' }}>
                      {new Date(`${selectedTripTransaction.transaction_date}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-900)' }}>
                      {(selectedTripTransaction.normalized_label ?? selectedTripTransaction.merchant_name ?? selectedTripTransaction.raw_label ?? 'Opération').trim() || 'Opération'}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-600)' }}>
                      {selectedTripTransaction.merchant_name ?? selectedTripTransaction.raw_label ?? '—'}
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                      {fmt(Number(selectedTripTransaction.amount)).replace(/\s+€/, '€')}
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
