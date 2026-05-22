import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { StatsSection } from '@/features/stats/components/ui'
import { useSavingsAnalytics } from '@/features/savings/hooks/useSavingsAnalytics'
import type { SavingsMonthlyMetric } from '@/features/savings/types'

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

// ─── Constantes ───────────────────────────────────────────────────────────────

const CURRENT_MONTH_ID = '2026-05'

const MONTH_MILESTONES_2026: SavingsMonthMilestone[] = [
  { id: '2026-01', shortLabel: 'Jan', fullLabel: 'Janvier 2026' },
  { id: '2026-02', shortLabel: 'Fév', fullLabel: 'Février 2026' },
  { id: '2026-03', shortLabel: 'Mar', fullLabel: 'Mars 2026' },
  { id: '2026-04', shortLabel: 'Avr', fullLabel: 'Avril 2026' },
  { id: '2026-05', shortLabel: 'Mai', fullLabel: 'Mai 2026' },
  { id: '2026-06', shortLabel: 'Juin', fullLabel: 'Juin 2026' },
  { id: '2026-07', shortLabel: 'Juil', fullLabel: 'Juillet 2026' },
  { id: '2026-08', shortLabel: 'Août', fullLabel: 'Août 2026' },
  { id: '2026-09', shortLabel: 'Sep', fullLabel: 'Septembre 2026' },
  { id: '2026-10', shortLabel: 'Oct', fullLabel: 'Octobre 2026' },
  { id: '2026-11', shortLabel: 'Nov', fullLabel: 'Novembre 2026' },
  { id: '2026-12', shortLabel: 'Déc', fullLabel: 'Décembre 2026' },
]

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
    epargneMontant: 1000,
    virement: { date: '15 mai 2026', montant: 1000, compteSource: 'Compte courant', destination: 'Livret A', pctObjectif: 100 },
    facteursDeTerminants: "Mois en cours. Pas d'événement exceptionnel anticipé.",
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

function isPastMonth(id: string): boolean {
  return id < CURRENT_MONTH_ID
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
}: {
  milestone: SavingsMonthMilestone
  onClose: () => void
  metric: SavingsMonthlyMetric | undefined
}) {
  const data = PLANNING_DATA[milestone.id]
  const past = isPastMonth(milestone.id)

  if (!data) return null

  // Valeurs réelles si disponibles, sinon placeholder
  const realSaved   = metric?.saved_amount         ?? null
  const realObjectif = metric?.savings_budget_total ?? null
  const epargneMontant = realSaved ?? data.epargneMontant
  const objectif       = realObjectif ?? data.objectif
  const pctObjectif    = objectif > 0
    ? Math.round((epargneMontant / objectif) * 100)
    : data.virement.pctObjectif

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

        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          style={{
            flexShrink: 0,
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

      {/* ── Corps ── */}
      <div
        style={{
          padding: 'var(--space-4)',
          display: 'grid',
          gap: 'var(--space-4)',
          overflowY: 'auto',
        }}
      >
        {/* Objectif mensuel */}
        <p
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 700,
            color: '#0E7490',           /* bleu canard */
          }}
        >
          Objectif :{' '}
          <span
            style={{
              color: '#D97706',         /* jaune doré */
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
            }}
          >
            {formatMoney(objectif)}
          </span>
        </p>

        {/* ── Section Flux mensuels ── */}
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          <SectionLabel>Flux mensuels</SectionLabel>
          <FluxRow label="Revenus" value={formatMoney(data.revenus)} valueColor="var(--color-positive)" />
          <FluxRow label="Budget dépenses" value={formatMoney(data.budgetDepenses)} valueColor="var(--neutral-600)" />
          {past && data.depensesReelles !== undefined && (
            <FluxRow
              label="Dépenses réelles"
              value={formatMoney(data.depensesReelles)}
              valueColor={
                data.depensesReelles > data.budgetDepenses
                  ? 'var(--color-negative)'
                  : 'var(--neutral-700)'
              }
            />
          )}
          <FluxRow
            label={past ? 'Épargne versée' : 'Épargne prévue'}
            value={formatMoney(epargneMontant)}
            valueColor={
              past && realSaved !== null
                ? (epargneMontant >= objectif ? 'var(--color-positive)' : 'var(--color-negative)')
                : 'var(--primary-600)'
            }
          />
        </div>

        {/* ── Section Virement ── */}
        <div
          style={{
            display: 'grid',
            gap: 'var(--space-2)',
            background: 'var(--neutral-50)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            border: '1px solid var(--neutral-150)',
          }}
        >
          <SectionLabel>{past ? 'Virement effectué' : 'Virement prévu'}</SectionLabel>
          <VirementRow label="Date" value={data.virement.date} />
          <VirementRow label="Montant" value={formatMoney(realSaved ?? data.virement.montant)} />
          <VirementRow label="Compte source" value={data.virement.compteSource} />
          <VirementRow label="Destination" value={data.virement.destination} />
          <VirementRow
            label="% de l'objectif"
            value={`${pctObjectif} %`}
          />
        </div>

        {/* ── Section Facteurs déterminants ── */}
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          <SectionLabel>Facteurs déterminants</SectionLabel>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--neutral-600)',
              lineHeight: 1.6,
              fontStyle: data.facteursDeTerminants ? 'normal' : 'italic',
            }}
          >
            {data.facteursDeTerminants || 'Aucun facteur renseigné pour ce mois.'}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function SavingsPlanning2026Section() {
  const [activeMilestone, setActiveMilestone] = useState<SavingsMonthMilestone | null>(null)

  const { data: analyticsData } = useSavingsAnalytics(2026)

  /** Map period_month (1-12) → SavingsMonthlyMetric */
  const metricsMap = useMemo(() => {
    const map = new Map<number, SavingsMonthlyMetric>()
    for (const m of (analyticsData?.monthlyMetrics ?? [])) {
      if (m.period_month !== null) map.set(m.period_month, m)
    }
    return map
  }, [analyticsData])

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
              }}
            />

            {MONTH_MILESTONES_2026.map((month, index) => {
              const isLeftSide = index % 2 === 0
              const past       = isPastMonth(month.id)
              const monthNum   = monthNumFromId(month.id)
              const metric     = metricsMap.get(monthNum)

              // ── Indicateur de réussite (mois révolus avec données réelles)
              const hasRealData = past && metric !== undefined
              const savedAmount = metric?.saved_amount ?? null
              const targetAmount = metric?.savings_budget_total ?? PLANNING_DATA[month.id]?.objectif ?? 0
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
                padding: '4px 10px 5px',
                minWidth: 72,
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
                  }

              const connectorStyle: React.CSSProperties = {
                width: 26,
                height: 1,
                borderRadius: 'var(--radius-full)',
                background: 'color-mix(in oklab, var(--primary-500) 32%, var(--neutral-200) 68%)',
                flexShrink: 0,
              }

              const pill = (
                <button type="button" onClick={() => setActiveMilestone(month)} style={pillStyle}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: past ? 'var(--primary-700)' : 'var(--neutral-800)',
                    lineHeight: 1.2,
                  }}>
                    {month.shortLabel}
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
                    fontSize: 9,
                    fontWeight: 600,
                    color: 'var(--neutral-400)',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap',
                    letterSpacing: '-0.01em',
                    flexShrink: 0,
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
                milestone={activeMilestone}
                onClose={() => setActiveMilestone(null)}
                metric={metricsMap.get(monthNumFromId(activeMilestone.id))}
              />
            </div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
