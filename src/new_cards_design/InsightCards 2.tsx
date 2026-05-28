/**
 * InsightCards.tsx — Handoff composants
 *
 * Remplace InsightCard + RepartitionInsightCard + leurs panneaux
 * dans BudgetsAnalyticsTab.tsx.
 *
 * Rechercher tous les TODO: et brancher les vraies données.
 * Les composants de graphiques existants sont conservés — voir README.
 */

import { useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronRight } from 'lucide-react'

// ─── TODO: importer tes hooks de données ────────────────────────
// import { useComparedAnalysis } from '@/features/annual-analysis/hooks/useComparedAnalysis'
// import { useAnnual2025Analysis } from '@/features/annual-analysis/hooks/useAnnual2025Analysis'
// import { useAnnual2026Analysis } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
// import { useBudgetRevenueAnalytics } from '@/features/budget/hooks/useBudgetRevenueAnalytics'
// import { useSavingsAnalytics } from '@/features/savings/hooks/useSavingsAnalytics'
// import { useMonthlyBudgetForecast } from '@/features/savings/hooks/useMonthlyBudgetForecast'

// ─── TODO: importer tes composants graphiques existants ─────────
// import { IncomeFullYearProjectedChart } from './IncomeFullYearProjectedChart'
// import { SavingsInsightKpis } from './SavingsInsightKpis'
// import { AchatsDiversExpandedContent } from './AchatsDiversExpandedContent'
// import { TransportExpandedContent } from './TransportExpandedContent'


// ═══════════════════════════════════════════════════════════════
// TOKENS — ajouter dans ton fichier CSS global (insight-tokens.css)
// ═══════════════════════════════════════════════════════════════
//
// --color-bordeaux:      #7c2130;
// --color-petrol:        #1a5c74;
// --color-cyan-insight:  #0097b2;
// --color-teal-insight:  #1d7a6d;
//
// Ces valeurs sont utilisées ci-dessous via les constantes COLORS.
// Une fois les tokens définis dans ton CSS global, remplace les
// valeurs hexadécimales par var(--color-bordeaux) etc.

const COLORS = {
  bordeaux: '#7c2130',  // signal critique
  petrol:   '#1a5c74',  // vigilance / référence 2025
  cyan:     '#0097b2',  // projections / revenus 2026
  teal:     '#1d7a6d',  // valeur positive
  slate:    '#5a626f',  // référence neutre
} as const


// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type InsightSignal = 'bordeaux' | 'petrol'

type KpiItem = {
  label: string
  value: string
  note?: string
  color: string
}

type InsightCardConfig = {
  id: string
  value: string          // ex: '−87%'
  label: string          // ex: 'épargne YTD'
  badge: string          // ex: 'Critique'
  signal: InsightSignal
  sparkData: number[]    // 4-5 valeurs relatives, normalisées dans le composant
  kpis: KpiItem[]
}

type ExpandableCardId = 'savings' | 'income' | 'achats-divers' | 'transport'


// ═══════════════════════════════════════════════════════════════
// CONFIGURATION DES CARTES
// Les valeurs statiques viennent d'ici.
// Les valeurs dynamiques (pourcentages réels) doivent être
// calculées depuis les hooks et passées en props ou via un hook dédié.
// ═══════════════════════════════════════════════════════════════

const CARDS_CONFIG: InsightCardConfig[] = [
  {
    id: 'savings',
    value: '−87%',      // TODO: calculer depuis useSavingsAnalytics
    label: 'épargne YTD',
    badge: 'Critique',
    signal: 'bordeaux',
    sparkData: [100, 82, 58, 35, 13], // TODO: épargne mensuelle YTD normalisée
    kpis: [
      { label: 'Revenus',  value: '−81%', note: 'hors jan.', color: COLORS.bordeaux }, // TODO: valeur réelle
      { label: 'Dépenses', value: '+9%',  note: 'YTD',       color: COLORS.petrol   }, // TODO: valeur réelle
      { label: 'Épargne',  value: '−87%', note: 'YTD',       color: COLORS.bordeaux }, // TODO: valeur réelle
    ],
  },
  {
    id: 'income',
    value: '÷2',         // TODO: calculer depuis useComparedAnalysis
    label: 'revenus 2026',
    badge: 'Critique',
    signal: 'bordeaux',
    sparkData: [100, 11, 17, 15], // TODO: revenus mensuels 2026 normalisés
    kpis: [
      { label: 'YTD 2025', value: '42k€', note: 'jan–avr', color: COLORS.petrol   }, // TODO: annualTotals
      { label: 'YTD 2026', value: '19k€', note: 'jan–avr', color: COLORS.bordeaux }, // TODO: flows2026.income_total
      { label: 'Δ N-1',    value: '−54%', note: 'YTD',     color: COLORS.bordeaux }, // TODO: calculé
    ],
  },
  {
    id: 'achats-divers',
    value: '−29%',       // TODO: depuis useComparedAnalysis bucket 'achats-divers'
    label: 'achats divers',
    badge: 'Vigilance',
    signal: 'petrol',
    sparkData: [58, 100, 40, 65], // TODO: dépenses mensuelles achats-divers normalisées
    kpis: [
      { label: '2025 brut',    value: '4 122€', note: 'YTD',  color: COLORS.slate   }, // TODO: flows2025
      { label: '2026 YTD',     value: '2 936€', note: 'YTD',  color: COLORS.teal    }, // TODO: flows2026
      { label: 'Hors outlier', value: '+15%',   note: 'réel', color: COLORS.bordeaux }, // TODO: calculé
    ],
  },
  {
    id: 'transport',
    value: '+3',         // statique
    label: 'postes structurels',
    badge: 'Vigilance',
    signal: 'petrol',
    sparkData: [5, 18, 32, 48], // TODO: dépenses transport mensuelles normalisées
    kpis: [
      { label: 'Transport', value: '×8',    note: 'YTD',   color: COLORS.bordeaux },
      { label: 'Abonn.',    value: '×2,5',  note: 'YTD',   color: COLORS.petrol   },
      { label: 'Enfant',    value: '+110€', note: '/mois', color: COLORS.petrol   },
    ],
  },
]


// ═══════════════════════════════════════════════════════════════
// COMPOSANT : Sparkline SVG
// ═══════════════════════════════════════════════════════════════

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const W = 52, H = 20
  const max = Math.max(...data), min = Math.min(...data), rng = max - min || 1
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - ((v - min) / rng) * (H - 3) - 1.5,
  ])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <path d={d} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}


// ═══════════════════════════════════════════════════════════════
// COMPOSANT : InsightCard (replié)
// ═══════════════════════════════════════════════════════════════

function InsightCard({
  config,
  isOpen,
  onToggle,
  compact = false,
}: {
  config: InsightCardConfig
  isOpen: boolean
  onToggle: () => void
  compact?: boolean
}) {
  const signalColor = config.signal === 'bordeaux' ? COLORS.bordeaux : COLORS.petrol

  const cardStyle: CSSProperties = {
    position: 'relative',
    background: 'var(--insight-card)',
    border: `1px solid ${isOpen ? 'var(--insight-border-active)' : 'var(--insight-border)'}`,
    borderRadius: 'var(--radius-xl)',
    padding: compact ? '18px 16px 15px' : '22px 18px 17px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: isOpen
      ? '0 4px 24px rgba(0,0,0,0.07)'
      : '0 1px 4px rgba(0,0,0,0.04)',
    cursor: 'pointer',
    userSelect: 'none',
    overflow: 'hidden',
    transition: 'box-shadow 0.22s ease, transform 0.22s ease, border-color 0.2s ease',
  }

  return (
    <article
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      aria-label={`${config.value} ${config.label} — ${isOpen ? 'réduire' : 'développer'}`}
      onClick={onToggle}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}
      style={cardStyle}
    >
      {/* Accent strip — 2px, couleur signal */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: isOpen ? 'var(--insight-border-active)' : signalColor,
        borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        transition: 'background 0.22s',
      }} />

      {/* Badge */}
      <span style={{
        fontSize: 8, fontWeight: 700, letterSpacing: '0.13em',
        textTransform: 'uppercase',
        color: isOpen ? 'var(--insight-dim)' : signalColor,
        marginBottom: compact ? 12 : 16,
        transition: 'color 0.22s',
      }}>
        {config.badge}
      </span>

      {/* Valeur principale */}
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: compact ? 'clamp(36px, 10vw, 44px)' : 'clamp(42px, 11.5vw, 54px)',
        fontWeight: 600,
        color: 'var(--insight-text)',
        lineHeight: 0.92,
        letterSpacing: '-0.04em',
        marginBottom: compact ? 8 : 10,
      }}>
        {config.value}
      </p>

      {/* Label */}
      <p style={{
        fontSize: compact ? 10.5 : 12,
        fontWeight: 500,
        color: 'var(--insight-muted)',
        lineHeight: 1.35,
        flex: 1,
        marginBottom: compact ? 16 : 22,
      }}>
        {config.label}
      </p>

      {/* Footer : sparkline + bouton */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Sparkline data={config.sparkData} color={isOpen ? 'var(--neutral-300)' : signalColor} />

        <div style={{
          width: 28, height: 28, borderRadius: 14,
          background: isOpen ? 'var(--insight-border-active)' : 'var(--insight-btn-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.22s',
          flexShrink: 0,
        }}>
          {isOpen
            ? <ChevronDown size={14} strokeWidth={2.5} color="#ffffff" />
            : <ChevronRight size={14} strokeWidth={2.5} color="var(--insight-muted)" />
          }
        </div>
      </div>
    </article>
  )
}


// ═══════════════════════════════════════════════════════════════
// COMPOSANT : KpiRow — sans boîtes, avec hairlines
// ═══════════════════════════════════════════════════════════════

function KpiRow({ kpis, compact = false }: { kpis: KpiItem[]; compact?: boolean }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      borderTop: '1px solid var(--insight-divider)',
      borderBottom: '1px solid var(--insight-divider)',
      padding: compact ? '16px 0' : '22px 0',
    }}>
      {kpis.map((kpi, i) => (
        <div key={`${kpi.label}-${i}`} style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          borderLeft: i > 0 ? '1px solid var(--insight-divider)' : 'none',
          padding: '0 12px',
        }}>
          <span style={{
            fontSize: 8.5,
            fontWeight: 700,
            color: 'var(--insight-dim)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textAlign: 'center',
            lineHeight: 1.2,
          }}>
            {kpi.label}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 20,
            fontWeight: 600,
            color: kpi.color,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>
            {kpi.value}
          </span>
          {kpi.note && (
            <span style={{ fontSize: 9, color: 'var(--insight-dim)', lineHeight: 1 }}>
              {kpi.note}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// COMPOSANT : ExpandedPanel — données réelles depuis les hooks
// ═══════════════════════════════════════════════════════════════

function ExpandedPanel({ insightId, compact = false }: { insightId: ExpandableCardId; compact?: boolean }) {
  const config = CARDS_CONFIG.find(c => c.id === insightId)
  if (!config) return null

  // TODO: récupérer les données réelles selon l'insightId
  // Exemple pour 'savings':
  //   const { flows2025, flows2026 } = useComparedAnalysis()
  //   const { data: savingsData } = useSavingsAnalytics(2026)
  //
  // Exemple pour 'income':
  //   const { data: revenueData } = useBudgetRevenueAnalytics()
  //   const { data: planningRows } = useMonthlyBudgetForecast(2026)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Texte d'insight */}
      <p style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--insight-muted)', fontWeight: 400 }}>
        {/* TODO: texte depuis FLUX_INSIGHTS[insightId].detailBody ou REPARTITION_INSIGHTS */}
        Insight text placeholder — brancher le vrai texte depuis les constantes existantes.
      </p>

      {/* KPI Row — sans boîtes */}
      <KpiRow kpis={config.kpis} compact={compact} />

      {/* Graphique — utiliser le composant existant */}
      {/* Supprimer le <div> wrapper avec border/background autour du chart */}
      <div>
        {insightId === 'savings' && (
          // TODO: <SavingsInsightKpis /> — restyler couleurs (voir README)
          <div style={{ color: 'var(--neutral-400)', fontSize: 12 }}>
            TODO: {'<SavingsInsightKpis />'}
          </div>
        )}
        {insightId === 'income' && (
          // TODO: <IncomeFullYearProjectedChart ... /> — props existantes, restyler couleurs
          <div style={{ color: 'var(--neutral-400)', fontSize: 12 }}>
            TODO: {'<IncomeFullYearProjectedChart ... />'}
          </div>
        )}
        {insightId === 'achats-divers' && (
          // TODO: <AchatsDiversExpandedContent /> — restyler couleurs
          <div style={{ color: 'var(--neutral-400)', fontSize: 12 }}>
            TODO: {'<AchatsDiversExpandedContent />'}
          </div>
        )}
        {insightId === 'transport' && (
          // TODO: <TransportExpandedContent /> — restyler couleurs
          <div style={{ color: 'var(--neutral-400)', fontSize: 12 }}>
            TODO: {'<TransportExpandedContent />'}
          </div>
        )}
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// COMPOSANT : InsightRow — 2 cartes + panneau déplié animé
// ═══════════════════════════════════════════════════════════════

function InsightRow({
  configs,
  expandedId,
  onToggle,
  compact = false,
}: {
  configs: InsightCardConfig[]
  expandedId: ExpandableCardId | null
  onToggle: (id: ExpandableCardId) => void
  compact?: boolean
}) {
  const expandedConfig = configs.find(c => c.id === expandedId) ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Rangée de cartes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: compact ? 10 : 13 }}>
        {configs.map(config => (
          <InsightCard
            key={config.id}
            config={config}
            isOpen={expandedId === config.id}
            onToggle={() => onToggle(config.id as ExpandableCardId)}
            compact={compact}
          />
        ))}
      </div>

      {/* Panneau déplié — Framer Motion height: auto */}
      <AnimatePresence mode="wait" initial={false}>
        {expandedConfig && (
          <motion.div
            key={expandedConfig.id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              background: 'var(--insight-panel-bg)',
              borderRadius: 'var(--radius-xl)',
              padding: compact ? '20px 18px 18px' : '28px 22px 24px',
              boxShadow: '0 2px 28px rgba(0,0,0,0.07)',
            }}>
              <ExpandedPanel insightId={expandedConfig.id as ExpandableCardId} compact={compact} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL : InsightSection
// Remplace le bloc "analyse" dans BudgetsAnalyticsTab
// ═══════════════════════════════════════════════════════════════

export function InsightSection({ compact = false }: { compact?: boolean }) {
  const [expandedId, setExpandedId] = useState<ExpandableCardId | null>(null)

  const toggle = (id: ExpandableCardId) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  const fluxCards       = CARDS_CONFIG.filter(c => c.id === 'savings' || c.id === 'income')
  const repartitionCards= CARDS_CONFIG.filter(c => c.id === 'achats-divers' || c.id === 'transport')

  const expandedInFlux        = fluxCards.some(c => c.id === expandedId) ? expandedId : null
  const expandedInRepartition = repartitionCards.some(c => c.id === expandedId) ? expandedId : null

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* Section : Flux financiers */}
      <SectionLabel label="Flux financiers" />
      <InsightRow
        configs={fluxCards}
        expandedId={expandedInFlux}
        onToggle={toggle}
        compact={compact}
      />

      {/* Section : Répartition */}
      <SectionLabel label="Répartition des dépenses" />
      <InsightRow
        configs={repartitionCards}
        expandedId={expandedInRepartition}
        onToggle={toggle}
        compact={compact}
      />

    </section>
  )
}


// ─── Helper : séparateur de section ─────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, height: 1, background: 'var(--insight-divider)' }} />
      <span style={{
        fontSize: 9, fontWeight: 700,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'var(--insight-dim)', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--insight-divider)' }} />
    </div>
  )
}
