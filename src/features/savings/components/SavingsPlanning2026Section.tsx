import { useEffect, useMemo, useState } from 'react'
import { useCanonicalPeriod, generateMonthMilestones } from '@/lib/period'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Pencil, X } from 'lucide-react'
import { StatsSection } from '@/features/stats/components/ui'
import { useSavingsAnalytics } from '@/features/savings/hooks/useSavingsAnalytics'
import { useMonthlyBudgetForecast } from '@/features/savings/hooks/useMonthlyBudgetForecast'
import type { MonthlyBudgetForecastRow } from '@/features/savings/hooks/useMonthlyBudgetForecast'
import { useBudgetPagePayload } from '@/features/budget/hooks/useBudgetPagePayload'
import { PILOTAGE_BUCKET_ORDER } from '@/features/annual-analysis/components/_constants'
import type { SavingsMonthlyMetric } from '@/features/savings/types'
import { useSavingsActualsByMonth } from '@/features/savings/hooks/useSavingsActualsByMonth'
import {
  useSavingsPlanningMonthDetails,
  useUpsertSavingsPlanningMonthDetails,
} from '@/features/savings/hooks/useSavingsPlanningMonthDetails'
import { useAccounts } from '@/hooks/useAccounts'
import { useAuth } from '@/hooks/useAuth'
import { usePlannedOperationsForFlow } from '@/hooks/usePlannedOperations'
import { StableDateField } from '@/components/ui/StableDateField'

// ─── Types ───────────────────────────────────────────────────────────────────

type SavingsMonthMilestone = {
  id: string
  shortLabel: string
  fullLabel: string
}

type MonthPlanningData = {
  objectif: number
  revenus: number
  budgetDepenses: number
  depensesReelles?: number        // uniquement mois révolus
  epargneMontant: number          // "versée" (révolus) ou "prévue" (à venir)
  virement: {
    date: string
    montant: number
    compteSource: string
    destination: string
    pctObjectif: number
  }
  facteursDeTerminants: string
}

type EditablePlanningDraft = {
  objectif: string
  epargneMontant: string
  virementDateIso: string
  virementMontant: string
  compteSource: string
  destination: string
  remarques: string
}

type ForwardCommitmentDisplay = {
  id: string
  label: string
  amount: number
  isVoyage: boolean
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Données placeholder — à brancher sur Supabase */
const PLANNING_DATA: Record<string, MonthPlanningData> = {
  '2026-01': {
    objectif: 1200,
    revenus: 3400,
    budgetDepenses: 2000,
    depensesReelles: 1847,
    epargneMontant: 1350,
    virement: { date: '15 janv. 2026', montant: 1350, compteSource: 'Compte courant', destination: 'Livret A', pctObjectif: 112 },
    facteursDeTerminants: "Mois sans dépenses exceptionnelles. Prime de performance versée en janvier, ayant permis de dépasser l'objectif.",
  },
  '2026-02': {
    objectif: 1000,
    revenus: 3400,
    budgetDepenses: 2200,
    depensesReelles: 2150,
    epargneMontant: 980,
    virement: { date: '14 févr. 2026', montant: 980, compteSource: 'Compte courant', destination: 'Livret A', pctObjectif: 98 },
    facteursDeTerminants: "Saint-Valentin : dépenses de sortie restaurant (~80 €). Légèrement en dessous de l'objectif.",
  },
  '2026-03': {
    objectif: 1000,
    revenus: 3400,
    budgetDepenses: 2200,
    depensesReelles: 2390,
    epargneMontant: 820,
    virement: { date: '17 mars 2026', montant: 820, compteSource: 'Compte courant', destination: 'Livret A', pctObjectif: 82 },
    facteursDeTerminants: 'Renouvellement assurance voiture (~190 €) et achat matériel informatique (~200 €). Dépassement budget.',
  },
  '2026-04': {
    objectif: 1000,
    revenus: 3400,
    budgetDepenses: 2200,
    depensesReelles: 2040,
    epargneMontant: 1060,
    virement: { date: '15 avr. 2026', montant: 1060, compteSource: 'Compte courant', destination: 'Livret A', pctObjectif: 106 },
    facteursDeTerminants: 'Mois calme. Légère économie sur les courses alimentaires.',
  },
  '2026-05': {
    objectif: 1000,
    revenus: 3400,
    budgetDepenses: 2200,
    epargneMontant: 500,
    virement: { date: '31 mai 2026', montant: 500, compteSource: 'Compte courant', destination: 'PEA', pctObjectif: 50 },
    facteursDeTerminants: 'Réception tardive de mes indemnités ayant conduit à un décalage de trésorerie.',
  },
  '2026-06': {
    objectif: 800,
    revenus: 3400,
    budgetDepenses: 2400,
    epargneMontant: 800,
    virement: { date: '15 juin 2026', montant: 800, compteSource: 'Compte courant', destination: 'Livret A', pctObjectif: 100 },
    facteursDeTerminants: "Vacances d'été prévues — budget loisirs/voyages en hausse. Objectif volontairement réduit.",
  },
  '2026-07': {
    objectif: 500,
    revenus: 3400,
    budgetDepenses: 2700,
    epargneMontant: 500,
    virement: { date: '15 juil. 2026', montant: 500, compteSource: 'Compte courant', destination: 'Livret A', pctObjectif: 100 },
    facteursDeTerminants: 'Pic de dépenses vacances. Objectif minimum de précaution.',
  },
  '2026-08': {
    objectif: 600,
    revenus: 3400,
    budgetDepenses: 2600,
    epargneMontant: 600,
    virement: { date: '15 août 2026', montant: 600, compteSource: 'Compte courant', destination: 'Livret A', pctObjectif: 100 },
    facteursDeTerminants: 'Rentrée scolaire / équipement à prévoir.',
  },
  '2026-09': {
    objectif: 1000,
    revenus: 3400,
    budgetDepenses: 2200,
    epargneMontant: 1000,
    virement: { date: '15 sept. 2026', montant: 1000, compteSource: 'Compte courant', destination: 'Livret A', pctObjectif: 100 },
    facteursDeTerminants: "Retour au rythme normal après l'été.",
  },
  '2026-10': {
    objectif: 1200,
    revenus: 3400,
    budgetDepenses: 2000,
    epargneMontant: 1200,
    virement: { date: '15 oct. 2026', montant: 1200, compteSource: 'Compte courant', destination: 'Livret A', pctObjectif: 100 },
    facteursDeTerminants: 'À planifier.',
  },
  '2026-11': {
    objectif: 1000,
    revenus: 3400,
    budgetDepenses: 2200,
    epargneMontant: 1000,
    virement: { date: '15 nov. 2026', montant: 1000, compteSource: 'Compte courant', destination: 'Livret A', pctObjectif: 100 },
    facteursDeTerminants: "Black Friday — budget shopping à surveiller. Cadeaux de fin d'année à anticiper.",
  },
  '2026-12': {
    objectif: 700,
    revenus: 3400,
    budgetDepenses: 2500,
    epargneMontant: 700,
    virement: { date: '12 déc. 2026', montant: 700, compteSource: 'Compte courant', destination: 'Livret A', pctObjectif: 100 },
    facteursDeTerminants: "Fêtes de fin d'année : cadeaux, repas familiaux, voyages. Objectif réduit en conséquence.",
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPastMonth(id: string, currentMonthKey: string): boolean {
  return id < currentMonthKey
}

/** '2026-05' → 5 */
function monthNumFromId(id: string): number {
  return parseInt(id.split('-')[1] ?? '0', 10)
}

function formatMoney(n: number): string {
  return Math.round(n).toLocaleString('fr-FR') + ' €'
}

/** Format compact pour le YTD — jamais de décimales */
function formatYtd(n: number): string {
  const rounded = Math.round(n)
  if (rounded >= 10_000) return `${Math.round(rounded / 1000).toLocaleString('fr-FR')} k€`
  return rounded.toLocaleString('fr-FR') + ' €'
}

const FRENCH_MONTH_MAP: Record<string, number> = {
  janv: 1,
  janvier: 1,
  fevr: 2,
  fevrier: 2,
  févr: 2,
  février: 2,
  mars: 3,
  avr: 4,
  avril: 4,
  mai: 5,
  juin: 6,
  juil: 7,
  juillet: 7,
  aout: 8,
  août: 8,
  sept: 9,
  septembre: 9,
  oct: 10,
  octobre: 10,
  nov: 11,
  novembre: 11,
  dec: 12,
  déc: 12,
  decembre: 12,
  décembre: 12,
}

function normalizeWholeAmountInput(value: string): string {
  const cleaned = value.replace(',', '.').trim()
  if (cleaned.length === 0) return ''
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) return ''
  return String(Math.max(0, Math.round(parsed)))
}

function toIsoDate(value: string): string {
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const normalized = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const parts = normalized.split(' ')
  if (parts.length < 3) return ''
  const day = Number(parts[0])
  const month = FRENCH_MONTH_MAP[parts[1]] ?? 0
  const year = Number(parts[2])
  if (!Number.isFinite(day) || !Number.isFinite(year) || month < 1 || month > 12) return ''
  if (day < 1 || day > 31 || year < 1900) return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatDateDisplay(value: string): string {
  const iso = toIsoDate(value)
  if (!iso) return value
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return value
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isVoyageCommitment(row: { parent_category_name?: string | null; budget_bucket?: string | null }): boolean {
  const bucket = (row.budget_bucket ?? '').trim().toLowerCase()
  const parentName = (row.parent_category_name ?? '').trim()
  const parentNormalized = parentName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return bucket === 'voyage' || parentNormalized.includes('voyage')
}

function toCommitmentDisplayLabel(row: { label?: string | null; category_name?: string | null; parent_category_name?: string | null; budget_bucket?: string | null }): string {
  const label = (row.label ?? '').trim()
  const categoryName = (row.category_name ?? '').trim()
  const parentName = (row.parent_category_name ?? '').trim()
  const isVoyage = isVoyageCommitment(row)
  if (isVoyage) return label || categoryName || 'Voyage'
  return label || categoryName || parentName || 'Engagement'
}

function createPlanningDraft(data: MonthPlanningData): EditablePlanningDraft {
  return {
    objectif: String(Math.round(data.objectif)),
    epargneMontant: String(Math.round(data.epargneMontant)),
    virementDateIso: toIsoDate(data.virement.date),
    virementMontant: String(Math.round(data.virement.montant)),
    compteSource: data.virement.compteSource,
    destination: data.virement.destination,
    remarques: data.facteursDeTerminants ?? '',
  }
}

function computeMonthlyBalance({
  revenus,
  depenses,
  epargne,
}: {
  revenus: number
  depenses: number
  epargne: number
}): number {
  const normalizedRevenus = Number.isFinite(revenus) ? revenus : 0
  const normalizedDepenses = Math.abs(Number.isFinite(depenses) ? depenses : 0)
  const normalizedEpargne = Math.abs(Number.isFinite(epargne) ? epargne : 0)
  return normalizedRevenus - normalizedDepenses - normalizedEpargne
}

// ─── UI atoms ────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-2)' }}>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--neutral-700)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          paddingBottom: 5,
          borderBottom: '1px solid var(--neutral-200)',
        }}
      >
        {children}
      </p>
    </div>
  )
}

function FluxRow({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 'var(--space-3)',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--neutral-500)', fontWeight: 500 }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          color: valueColor ?? 'var(--neutral-800)',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function VirementRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 'var(--space-3)',
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--neutral-400)', fontWeight: 500 }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: 'var(--neutral-700)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ─── Modale ──────────────────────────────────────────────────────────────────

function PlanningModal({
  milestone,
  onClose,
  metric,
  forecast,
  monthData,
  actualSavingsAmount,
  accountNames,
  annualGlobalObjective,
  onSave,
  forwardCommitments,
  currentMonthKey,
}: {
  milestone: SavingsMonthMilestone
  onClose: () => void
  metric: SavingsMonthlyMetric | undefined
  forecast: MonthlyBudgetForecastRow | undefined
  monthData: MonthPlanningData
  actualSavingsAmount: number | null
  accountNames: string[]
  annualGlobalObjective: number
  onSave: (nextData: MonthPlanningData) => void
  forwardCommitments: ForwardCommitmentDisplay[]
  currentMonthKey: string
}) {
  const data = monthData
  const past = isPastMonth(milestone.id, currentMonthKey)
  const [milestoneYear, milestoneMonth] = milestone.id.split('-').map(Number)
  const { data: budgetPayload } = useBudgetPagePayload({
    periodYear: milestoneYear,
    periodMonth: milestoneMonth,
    monthsBack: 1,
  })
  const [isEditing, setIsEditing] = useState(false)
  const [isPlannedTransferConfirmed, setIsPlannedTransferConfirmed] = useState(false)
  const [draft, setDraft] = useState<EditablePlanningDraft>(() => createPlanningDraft(data))

  useEffect(() => {
    setIsEditing(false)
    setIsPlannedTransferConfirmed(false)
    setDraft(createPlanningDraft(data))
  }, [milestone.id, data])

  // Revenus : réels si mois passé et donnée disponible, sinon budget prévisionnel
  const revenus = metric?.income_total ?? forecast?.projected_income ?? data.revenus

  // Budget dépenses : somme des buckets de pilotage — même source que la page Budgets
  const pilotageSet = new Set<string>(PILOTAGE_BUCKET_ORDER as readonly string[])
  const budgetFromPayload = (budgetPayload?.by_bucket ?? [])
    .filter(r => pilotageSet.has(String(r.budget_bucket ?? '')))
    .reduce((sum, r) => sum + Number(r.budget_amount ?? 0), 0)
  const budgetDepenses = budgetFromPayload > 0
    ? budgetFromPayload
    : (forecast?.projected_non_savings_expenses ?? data.budgetDepenses)

  // Engagements futurs (hors budget standard)
  const forwardAmount = forecast?.forward_commitments_amount ?? 0

  // Dépenses réelles : actual_total_to_date — même source que la page Budgets (mois révolus uniquement)
  const depensesReelles: number | undefined = past
    ? (budgetPayload?.summary?.actual_total_to_date ?? data.depensesReelles)
    : undefined

  // Épargne et objectif
  // For closed months, missing actual savings means 0.
  // Never fallback to planned values, otherwise realized savings is overstated.
  const epargneMontant = past ? (actualSavingsAmount ?? 0) : data.epargneMontant
  const objectif = data.objectif
  const effectiveDepenses = past && depensesReelles !== undefined
    ? depensesReelles
    : budgetDepenses + forwardAmount
  const monthlyBalance = computeMonthlyBalance({
    revenus,
    depenses: effectiveDepenses,
    epargne: epargneMontant,
  })
  const pctObjectif = annualGlobalObjective > 0
    ? Math.round((data.virement.montant / annualGlobalObjective) * 100)
    : 0

  const annualObjectiveLabel = annualGlobalObjective > 0 ? formatMoney(annualGlobalObjective) : '—'
  const sourceOptions = useMemo(() => {
    const unique = new Set<string>(accountNames.filter((name) => name.trim().length > 0))
    if (data.virement.compteSource.trim().length > 0) unique.add(data.virement.compteSource)
    return [...unique]
  }, [accountNames, data.virement.compteSource])
  const destinationOptions = useMemo(() => {
    const unique = new Set<string>(accountNames.filter((name) => name.trim().length > 0))
    if (data.virement.destination.trim().length > 0) unique.add(data.virement.destination)
    return [...unique]
  }, [accountNames, data.virement.destination])

  function applyDraftValue(field: keyof EditablePlanningDraft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  function handleCancelEdit() {
    setDraft(createPlanningDraft(data))
    setIsEditing(false)
  }

  function handleValidateEdit() {
    const nextObjectif = Number(normalizeWholeAmountInput(draft.objectif)) || 0
    const nextEpargne = past
      ? (actualSavingsAmount ?? 0)
      : (Number(normalizeWholeAmountInput(draft.epargneMontant)) || 0)
    const nextVirementMontant = Number(normalizeWholeAmountInput(draft.virementMontant)) || 0
    const nextDateIso = draft.virementDateIso || toIsoDate(data.virement.date)

    onSave({
      ...data,
      objectif: nextObjectif,
      epargneMontant: nextEpargne,
      virement: {
        ...data.virement,
        date: nextDateIso || data.virement.date,
        montant: nextVirementMontant,
        compteSource: draft.compteSource || data.virement.compteSource,
        destination: draft.destination || data.virement.destination,
      },
      facteursDeTerminants: draft.remarques.trim(),
    })
    setIsEditing(false)
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Planning épargne ${milestone.fullLabel}`}
      initial={{ opacity: 0, scale: 0.97, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 12 }}
      transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        pointerEvents: 'auto',
        width: '100%',
        maxWidth: 480,
        maxHeight: 'min(88vh, 720px)',
        overflowY: 'auto',
        background: 'var(--neutral-0)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 20px 60px rgba(13,13,31,0.28)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Header coloré ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--primary-700) 0%, var(--primary-500) 100%)',
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
          padding: 'var(--space-4) var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          flexShrink: 0,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--font-size-lg)',
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-0.01em',
          }}
        >
          {milestone.fullLabel}
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          {!isEditing ? (
            <button
              type="button"
              aria-label="Éditer la modale"
              onClick={() => setIsEditing(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'rgba(255,255,255,0.18)',
                color: '#fff',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.32)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.18)'
              }}
            >
              <Pencil size={14} />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'rgba(255,255,255,0.18)',
              color: '#fff',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.32)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.18)'
            }}
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* ── Corps ── */}
      <div
        style={{
          padding: isEditing ? 'var(--space-3)' : 'var(--space-4)',
          display: 'grid',
          gap: isEditing ? 'var(--space-3)' : 'var(--space-4)',
          overflowY: 'auto',
        }}
      >
        {/* Objectif mensuel */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: '#0E7490',
            }}
          >
            Objectif :{' '}
            <span
              style={{
                color: '#D97706',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
              }}
            >
              {isEditing ? (
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={draft.objectif}
                  onChange={(e) => applyDraftValue('objectif', normalizeWholeAmountInput(e.target.value))}
                  style={{
                    width: 110,
                    marginLeft: 4,
                    height: 32,
                    padding: '4px 8px',
                    borderRadius: 8,
                    border: '1px solid var(--primary-300)',
                    background: '#fff',
                    color: '#D97706',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                />
              ) : (
                formatMoney(objectif)
              )}
            </span>
          </p>

        </div>

        {/* ── Section Flux mensuels ── */}
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          <SectionLabel>Flux mensuels</SectionLabel>
          {revenus > 0 && (
            <FluxRow label="Revenus" value={formatMoney(revenus)} valueColor="var(--color-positive)" />
          )}
          <FluxRow label="Budget dépenses" value={formatMoney(budgetDepenses)} valueColor="var(--neutral-600)" />
          {forwardAmount > 0 && (
            forwardCommitments.length > 0 ? (
              forwardCommitments.map((commitment) => (
                <FluxRow
                  key={commitment.id}
                  label={commitment.label}
                  value={`+ ${formatMoney(commitment.amount)}`}
                  valueColor="var(--color-warning)"
                />
              ))
            ) : (
              <FluxRow
                label="Engagement"
                value={`+ ${formatMoney(forwardAmount)}`}
                valueColor="var(--color-warning)"
              />
            )
          )}
          {past && depensesReelles !== undefined && (
            <FluxRow
              label="Dépenses réelles"
              value={formatMoney(depensesReelles)}
              valueColor={
                depensesReelles > budgetDepenses
                  ? 'var(--color-negative)'
                  : 'var(--neutral-700)'
              }
            />
          )}
          <FluxRow
            label={past ? 'Épargne versée' : 'Épargne prévue'}
            value={isEditing ? '' : formatMoney(epargneMontant)}
            valueColor={'var(--primary-600)'}
          />
          {isEditing && !past ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={draft.epargneMontant}
                onChange={(e) => applyDraftValue('epargneMontant', normalizeWholeAmountInput(e.target.value))}
                style={{
                  width: 132,
                  height: 32,
                  padding: '4px 8px',
                  borderRadius: 8,
                  border: '1px solid var(--primary-300)',
                  background: '#fff',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: 'var(--primary-700)',
                  textAlign: 'right',
                }}
              />
            </div>
          ) : null}
          <div
            style={{
              marginTop: 'var(--space-1)',
              paddingTop: 'var(--space-2)',
              borderTop: '1px solid var(--neutral-200)',
            }}
          >
            <FluxRow
              label="Balance"
              value={formatMoney(monthlyBalance)}
              valueColor={monthlyBalance >= 0 ? 'var(--primary-700)' : 'var(--color-negative)'}
            />
          </div>
        </div>

        {/* ── Section Virement ── */}
        <div
          style={{
            display: 'grid',
            gap: isEditing ? 'var(--space-1)' : 'var(--space-2)',
            background: 'var(--neutral-50)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            border: '1px solid var(--neutral-150)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--neutral-700)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {past ? 'Virement effectué' : 'Virement prévu'}
            </p>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: 'var(--neutral-600)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              <span>Prévu</span>
              <input
                type="checkbox"
                checked={isPlannedTransferConfirmed}
                aria-label={`Confirmer qu'un virement d'épargne est prévu pour ${milestone.fullLabel}`}
                onChange={(e) => setIsPlannedTransferConfirmed(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
            </label>
          </div>
          {isPlannedTransferConfirmed ? (
            <>
              {isEditing ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ fontSize: 11, color: 'var(--neutral-400)', fontWeight: 500 }}>Date</span>
                    <StableDateField
                      value={draft.virementDateIso}
                      onChange={(value) => applyDraftValue('virementDateIso', value)}
                      ariaLabel={`Date du virement pour ${milestone.fullLabel}`}
                      width={154}
                      textStyle={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                      buttonStyle={{
                        width: 154,
                        height: 32,
                        padding: '4px 8px',
                        borderRadius: 8,
                        border: '1px solid var(--neutral-250)',
                        background: 'transparent',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ fontSize: 11, color: 'var(--neutral-400)', fontWeight: 500 }}>Montant</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={draft.virementMontant}
                      onChange={(e) => applyDraftValue('virementMontant', normalizeWholeAmountInput(e.target.value))}
                      style={{
                        width: 120,
                        height: 32,
                        padding: '4px 8px',
                        borderRadius: 8,
                        border: '1px solid var(--neutral-250)',
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                        textAlign: 'right',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ fontSize: 11, color: 'var(--neutral-400)', fontWeight: 500 }}>Compte source</span>
                    <select
                      value={draft.compteSource}
                      onChange={(e) => applyDraftValue('compteSource', e.target.value)}
                      style={{
                        width: 170,
                        height: 32,
                        padding: '4px 8px',
                        borderRadius: 8,
                        border: '1px solid var(--neutral-250)',
                        fontSize: 12,
                        color: 'var(--neutral-700)',
                        background: '#fff',
                      }}
                    >
                      {sourceOptions.map((name) => (
                        <option key={`source-${name}`} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ fontSize: 11, color: 'var(--neutral-400)', fontWeight: 500 }}>Destination</span>
                    <select
                      value={draft.destination}
                      onChange={(e) => applyDraftValue('destination', e.target.value)}
                      style={{
                        width: 170,
                        height: 32,
                        padding: '4px 8px',
                        borderRadius: 8,
                        border: '1px solid var(--neutral-250)',
                        fontSize: 12,
                        color: 'var(--neutral-700)',
                        background: '#fff',
                      }}
                    >
                      {destinationOptions.map((name) => (
                        <option key={`dest-${name}`} value={name}>
                          {name}
                        </option>
                      ))}
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <VirementRow label="Date" value={formatDateDisplay(data.virement.date)} />
                  <VirementRow label="Montant" value={formatMoney(data.virement.montant)} />
                  <VirementRow label="Compte source" value={data.virement.compteSource} />
                  <VirementRow label="Destination" value={data.virement.destination} />
                </>
              )}
              <VirementRow
                label="% de l'objectif"
                value={`${pctObjectif} % (${annualObjectiveLabel})`}
              />
            </>
          ) : null}
        </div>

        {/* ── Section Remarques ── */}
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          <SectionLabel>Remarques</SectionLabel>
          {isEditing ? (
            <textarea
              value={draft.remarques}
              onChange={(e) => applyDraftValue('remarques', e.target.value)}
              rows={3}
              placeholder="Ajouter des remarques…"
              style={{
                width: '100%',
                resize: 'vertical',
                border: '1px solid var(--neutral-250)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 8px',
                fontSize: 12,
                color: 'var(--neutral-700)',
                lineHeight: 1.35,
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: 'var(--neutral-600)',
                lineHeight: 1.6,
                fontStyle: data.facteursDeTerminants ? 'normal' : 'italic',
              }}
            >
              {data.facteursDeTerminants || 'Aucune remarque renseignée pour ce mois.'}
            </p>
          )}
        </div>

        {isEditing ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={handleCancelEdit}
              style={{
                minWidth: 110,
                border: '1px solid var(--neutral-250)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--neutral-0)',
                color: 'var(--neutral-700)',
                fontSize: 13,
                fontWeight: 700,
                padding: '8px 14px',
                cursor: 'pointer',
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleValidateEdit}
              style={{
                minWidth: 110,
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: 'var(--primary-600)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                padding: '8px 14px',
                cursor: 'pointer',
              }}
            >
              Valider
            </button>
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function SavingsPlanning2026Section() {
  const { currentYear, currentMonthKey } = useCanonicalPeriod()

  const [activeMilestone, setActiveMilestone] = useState<SavingsMonthMilestone | null>(null)
  const [planningDataByMonth, setPlanningDataByMonth] = useState<Record<string, MonthPlanningData>>(
    () => Object.fromEntries(
      Object.entries(PLANNING_DATA).map(([key, value]) => [
        key,
        {
          ...value,
          virement: { ...value.virement },
        },
      ]),
    ),
  )

  const monthMilestones = useMemo(() => generateMonthMilestones(currentYear), [currentYear])

  const { data: analyticsData } = useSavingsAnalytics(currentYear)
  const { data: forecastRows } = useMonthlyBudgetForecast(currentYear)
  const { user } = useAuth()
  const { data: accounts = [] } = useAccounts()
  const { byMonth: savingsActualsByMonth } = useSavingsActualsByMonth(user?.id, currentYear)
  const { data: persistedPlanningRows = [] } = useSavingsPlanningMonthDetails(user?.id, currentYear)
  const upsertPlanningMonthDetails = useUpsertSavingsPlanningMonthDetails()
  const { data: upcomingPlannedOperations = [] } = usePlannedOperationsForFlow({
    userId: user?.id,
    startDate: `${currentYear}-01-01`,
    endDate: `${currentYear}-12-31`,
    includePast: false,
    includeFuture: true,
    flowType: 'expense',
    mode: 'general',
    enabled: Boolean(user?.id),
    ascending: true,
  })

  /** Map period_month (1-12) → SavingsMonthlyMetric */
  const metricsMap = useMemo(() => {
    const map = new Map<number, SavingsMonthlyMetric>()
    for (const m of (analyticsData?.monthlyMetrics ?? [])) {
      if (m.period_month !== null) map.set(m.period_month, m)
    }
    return map
  }, [analyticsData])

  /** Map period_month (1-12) → MonthlyBudgetForecastRow */
  const forecastMap = useMemo(() => {
    const map = new Map<number, MonthlyBudgetForecastRow>()
    for (const row of (forecastRows ?? [])) {
      map.set(row.period_month, row)
    }
    return map
  }, [forecastRows])

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const account of accounts) {
      if (!account.id || !account.name?.trim()) continue
      map.set(account.id, account.name.trim())
    }
    return map
  }, [accounts])

  const accountIdByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const account of accounts) {
      const name = account.name?.trim()
      if (!name || !account.id) continue
      map.set(name.toLowerCase(), account.id)
    }
    return map
  }, [accounts])

  const accountNames = useMemo(() => {
    const set = new Set<string>()
    for (const account of accounts) {
      if (account.name?.trim()) set.add(account.name.trim())
    }
    return [...set]
  }, [accounts])

  useEffect(() => {
    if (persistedPlanningRows.length === 0) return
    setPlanningDataByMonth((prev) => {
      const next = { ...prev }
      for (const row of persistedPlanningRows) {
        const monthId = `${row.period_year}-${String(row.period_month).padStart(2, '0')}`
        const existing = next[monthId]
        if (!existing) continue
        const sourceLabel =
          (row.source_account_id ? accountNameById.get(row.source_account_id) : null)
          ?? row.source_account_label
          ?? existing.virement.compteSource
        const destinationLabel =
          (row.destination_account_id ? accountNameById.get(row.destination_account_id) : null)
          ?? row.destination_label
          ?? existing.virement.destination

        next[monthId] = {
          ...existing,
          objectif: Math.round(Number(row.monthly_objective_amount ?? existing.objectif)),
          epargneMontant: Math.round(Number(row.planned_savings_amount ?? existing.epargneMontant)),
          virement: {
            ...existing.virement,
            date: row.transfer_date ?? existing.virement.date,
            montant: Math.round(Number(row.transfer_amount ?? existing.virement.montant)),
            compteSource: sourceLabel,
            destination: destinationLabel,
          },
          facteursDeTerminants: row.notes ?? existing.facteursDeTerminants,
        }
      }
      return next
    })
  }, [persistedPlanningRows, accountNameById])

  const annualGlobalObjective = useMemo(
    () => Object.values(planningDataByMonth).reduce((sum, row) => sum + Number(row.objectif ?? 0), 0),
    [planningDataByMonth],
  )
  const forwardCommitmentsByMonth = useMemo(() => {
    const map = new Map<string, ForwardCommitmentDisplay[]>()
    const grouped = new Map<string, { monthKey: string; label: string; amount: number; isVoyage: boolean }>()

    for (const row of upcomingPlannedOperations) {
      if (row.budget_impact !== 'additional_commitment') continue
      const monthKey = (row.month_start ?? '').slice(0, 7)
      if (!monthKey) continue
      const nextLabel = toCommitmentDisplayLabel(row)
      const isVoyage = isVoyageCommitment(row)
      const amount = Number(row.planned_personal_amount ?? row.planned_amount ?? 0)
      const groupKey = `${monthKey}::${isVoyage ? 'voyage' : 'other'}::${nextLabel.toLowerCase()}`
      const prev = grouped.get(groupKey)
      if (prev) {
        prev.amount += amount
      } else {
        grouped.set(groupKey, {
          monthKey,
          label: nextLabel,
          amount,
          isVoyage,
        })
      }
    }

    for (const [groupKey, entry] of grouped.entries()) {
      const rowId = `commitment-${groupKey}`
      const next: ForwardCommitmentDisplay = {
        id: rowId,
        label: entry.label,
        amount: entry.amount,
        isVoyage: entry.isVoyage,
      }
      const existing = map.get(entry.monthKey) ?? []
      map.set(entry.monthKey, [...existing, next])
    }

    for (const [monthKey, rows] of map.entries()) {
      const sorted = [...rows].sort((a, b) => {
        if (a.isVoyage !== b.isVoyage) return a.isVoyage ? -1 : 1
        return a.label.localeCompare(b.label, 'fr')
      })
      map.set(monthKey, sorted)
    }
    return map
  }, [upcomingPlannedOperations])

  return (
    <>
      <StatsSection>
        <div>
          <div
            style={{
              position: 'relative',
              maxWidth: 560,
              margin: '0 auto',
              display: 'grid',
              rowGap: 7,
              padding: 'var(--space-2) 0',
              marginTop: 'var(--space-3)',
            }}
          >
            {/* Ligne verticale centrale */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 6,
                bottom: 6,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 2,
                borderRadius: 'var(--radius-full)',
                background: 'color-mix(in oklab, var(--primary-500) 45%, var(--neutral-200) 55%)',
                zIndex: 0,
              }}
            />

            {monthMilestones.map((month, index) => {
              const isLeftSide = index % 2 === 0
              const past       = isPastMonth(month.id, currentMonthKey)
              const monthNum   = monthNumFromId(month.id)
              const metric     = metricsMap.get(monthNum)
              const forecast   = forecastMap.get(monthNum)

              // ── Indicateur de réussite (mois révolus avec données réelles)
              const hasRealData = past && metric !== undefined
              const savedAmount = metric?.saved_amount ?? null
              const targetAmount = metric?.savings_budget_total ?? planningDataByMonth[month.id]?.objectif ?? 0
              const achieved    = hasRealData && savedAmount !== null && targetAmount > 0 && savedAmount >= targetAmount

              // ── Cumul YTD (uniquement si donnée disponible)
              const ytdAmount = metric?.ytd_saved_amount ?? null

              // ── Styles ──────────────────────────────────────────────────────
              const pillStyle: React.CSSProperties = {
                border: `1px solid ${past
                  ? 'color-mix(in oklab, var(--primary-500) 40%, var(--neutral-200) 60%)'
                  : 'color-mix(in oklab, var(--primary-500) 24%, var(--neutral-200) 76%)'}`,
                background: past ? 'var(--primary-50)' : 'var(--neutral-0)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 12px 7px',
                minWidth: 114,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0,
              }

              // Dot : pastille colorée pour les mois révolus avec données, simple cercle sinon
              const dotStyle: React.CSSProperties = hasRealData
                ? {
                    width: 22,
                    height: 22,
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    background: achieved ? 'var(--color-positive)' : 'var(--color-negative)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: achieved
                      ? '0 0 0 3px color-mix(in oklab, var(--color-positive) 22%, transparent)'
                      : '0 0 0 3px color-mix(in oklab, var(--color-negative) 22%, transparent)',
                    flexShrink: 0,
                    position: 'relative',
                    zIndex: 2,
                  }
                : {
                    width: 12,
                    height: 12,
                    borderRadius: 'var(--radius-full)',
                    border: `2px solid ${past ? 'var(--primary-600)' : 'var(--primary-500)'}`,
                    background: past ? 'var(--primary-500)' : 'var(--neutral-0)',
                    cursor: 'pointer',
                    padding: 0,
                    flexShrink: 0,
                    position: 'relative',
                    zIndex: 2,
                  }

              const connectorStyle: React.CSSProperties = {
                width: 26,
                height: 1,
                borderRadius: 'var(--radius-full)',
                background: 'color-mix(in oklab, var(--primary-500) 32%, var(--neutral-200) 68%)',
                flexShrink: 0,
              }

              // Forward commitments indicator on the pill (future months)
              const hasForwardCommitments = !past && (forecast?.forward_commitments_amount ?? 0) > 0

              const pill = (
                <button type="button" onClick={() => setActiveMilestone(month)} style={pillStyle}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: past ? 'var(--primary-700)' : 'var(--neutral-800)',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}>
                    {month.fullLabel.replace(` ${currentYear}`, '')}
                    {hasForwardCommitments && (
                      <span
                        aria-label="Engagements futurs"
                        style={{
                          display: 'inline-block',
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: 'var(--color-warning)',
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </span>
                  {/* Montant mensuel versé avec signe + en vert profond — mois révolus uniquement */}
                  {past && savedAmount !== null && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: '#15803d',
                      fontFamily: 'var(--font-mono)',
                      lineHeight: 1.3,
                      marginTop: 1,
                    }}>
                      +{formatYtd(savedAmount)}
                    </span>
                  )}
                </button>
              )

              /** Cumul YTD affiché en dehors du cadre, côté opposé à l'axe */
              const ytdLabel = ytdAmount !== null ? (
                <span
                  aria-label={`Cumul YTD ${formatYtd(ytdAmount)}`}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--neutral-400)',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap',
                    letterSpacing: '-0.01em',
                    flexShrink: 0,
                    marginInline: 'var(--space-2)',
                  }}
                >
                  {formatYtd(ytdAmount)}
                </span>
              ) : null

              return (
                <div
                  key={month.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    columnGap: 0,
                  }}
                >
                  {/* ── Cellule gauche ───────────────────────────────────
                   * Mois gauche : [pill ── connecteur →] dot
                   * Mois droit  : dot [← YTD]              (côté opposé au pill)
                   */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    minWidth: 0,
                  }}>
                    {isLeftSide ? (
                      <>
                        {pill}
                        <div aria-hidden="true" style={connectorStyle} />
                      </>
                    ) : (
                      /* YTD du mois droit, juste à gauche du dot */
                      ytdLabel
                    )}
                  </div>

                  {/* Dot central / indicateur réussite */}
                  <button
                    type="button"
                    aria-label={`Ouvrir ${month.fullLabel}`}
                    onClick={() => setActiveMilestone(month)}
                    style={dotStyle}
                  >
                    {hasRealData && (
                      achieved
                        ? <Check size={11} color="white" strokeWidth={3} />
                        : <X size={11} color="white" strokeWidth={3} />
                    )}
                  </button>

                  {/* ── Cellule droite ───────────────────────────────────
                   * Mois droit  : dot [← connecteur ── pill]
                   * Mois gauche : [YTD →]              (côté opposé au pill)
                   */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    minWidth: 0,
                  }}>
                    {!isLeftSide ? (
                      <>
                        <div aria-hidden="true" style={connectorStyle} />
                        {pill}
                      </>
                    ) : (
                      /* YTD du mois gauche, juste à droite du dot */
                      ytdLabel
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </StatsSection>


      {/* ── Overlay + Modale ── */}
      <AnimatePresence>
        {activeMilestone ? (
          <>
            {/* Backdrop */}
            <motion.button
              type="button"
              aria-label="Fermer la modale"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveMilestone(null)}
              style={{
                position: 'fixed',
                inset: 0,
                border: 'none',
                padding: 0,
                margin: 0,
                background: 'rgba(13,13,31,0.52)',
                zIndex: 95,
                cursor: 'pointer',
              }}
            />

            {/* Conteneur centré */}
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 96,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                pointerEvents: 'none',
              }}
            >
              <PlanningModal
                key={activeMilestone.id}
                milestone={activeMilestone}
                onClose={() => setActiveMilestone(null)}
                metric={metricsMap.get(monthNumFromId(activeMilestone.id))}
                forecast={forecastMap.get(monthNumFromId(activeMilestone.id))}
                monthData={planningDataByMonth[activeMilestone.id]}
                actualSavingsAmount={savingsActualsByMonth[monthNumFromId(activeMilestone.id)]?.actual_savings_amount_eur ?? null}
                accountNames={accountNames}
                annualGlobalObjective={annualGlobalObjective}
                forwardCommitments={forwardCommitmentsByMonth.get(activeMilestone.id) ?? []}
                currentMonthKey={currentMonthKey}
                onSave={(nextData) => {
                  const monthId = activeMilestone.id
                  setPlanningDataByMonth((prev) => ({
                    ...prev,
                    [monthId]: {
                      ...nextData,
                      virement: { ...nextData.virement },
                    },
                  }))

                  if (!user?.id) return
                  const sourceAccountId = accountIdByName.get((nextData.virement.compteSource ?? '').trim().toLowerCase()) ?? null
                  const destinationAccountId = accountIdByName.get((nextData.virement.destination ?? '').trim().toLowerCase()) ?? null
                  const [periodYearRaw, periodMonthRaw] = monthId.split('-')
                  const periodYear = Number(periodYearRaw)
                  const periodMonth = Number(periodMonthRaw)
                  if (!Number.isFinite(periodYear) || !Number.isFinite(periodMonth)) return

                  upsertPlanningMonthDetails.mutate({
                    user_id: user.id,
                    period_year: periodYear,
                    period_month: periodMonth,
                    monthly_objective_amount: Math.round(nextData.objectif),
                    planned_savings_amount: Math.round(nextData.epargneMontant),
                    transfer_date: toIsoDate(nextData.virement.date) || null,
                    transfer_amount: Math.round(nextData.virement.montant),
                    source_account_id: sourceAccountId,
                    source_account_label: nextData.virement.compteSource || null,
                    destination_account_id: destinationAccountId,
                    destination_label: nextData.virement.destination || null,
                    notes: nextData.facteursDeTerminants || null,
                  })
                }}
              />
            </div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
