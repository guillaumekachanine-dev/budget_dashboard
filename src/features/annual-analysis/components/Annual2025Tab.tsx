import { useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { useAnnual2025Analysis } from '@/features/annual-analysis/hooks/useAnnual2025Analysis'
import { useComparedAnalysis } from '@/features/annual-analysis/hooks/useComparedAnalysis'
import { AnnualKeyInsightsGrid } from './AnnualKeyInsightsGrid'
import { ComparedMonthlyChart } from './ComparedMonthlyChart'
import { ComparedBucketChart } from './ComparedBucketChart'
import { ComparedCategoryBars } from './ComparedCategoryBars'
import { ComparedVelocityCard } from './ComparedVelocityCard'
import { ComparedInsightStrip, type InsightData } from './ComparedInsightStrip'

const FLUX_SLIDE_FRAME_HEIGHT = 336
const REPARTITION_SLIDE_FRAME_HEIGHT = 438
const MAJOR_SECTION_GAP = 'var(--space-6)'
const SECTION_BORDER_WIDTH = '4px'
const KLEIN_BLUE = '#002FA7'
const DEEP_YELLOW = '#B8860B'

// ─── Insight data ─────────────────────────────────────────────────────────────

const FLUX_INSIGHTS: readonly [InsightData, InsightData] = [
  {
    id: 'f1-epargne-ciseau',
    badge: '−87%',
    title: "Épargne -87% : les dépenses n'ont pas bougé",
    subtitle: 'Revenus -55%, plancher opérationnel déjà atteint',
    level: 'alert',
    modal: {
      title: 'Ciseau revenus / épargne',
      lead: "Les revenus Jan–Avr ont chuté de 54,5% (42 141€ → 19 158€). Les dépenses courantes hors épargne n'ont progressé que de +9,3% (10 820€ → 11 823€). La quasi-totalité du choc a été absorbée par l'épargne seule : 33 500€ → 4 243€ (-87%). Il n'y a pas de dérive des dépenses à corriger — le levier est exclusivement du côté des revenus.",
      body: "Ce pattern révèle que le plancher opérationnel est déjà proche de sa limite structurelle : difficile de dépenser moins sans impact réel sur le quotidien. La capacité d'épargne est directement et quasi-exclusivement corrélée au volume des revenus perçus. Toute amélioration de l'épargne passe donc par une augmentation des revenus, non par une réduction des dépenses.",
      metrics: [
        { label: 'Revenus 2025', value: '42 141 €', delta: 'Jan–Avr' },
        { label: 'Revenus 2026', value: '19 158 €', delta: '−54,5%', highlight: true },
        { label: 'Épargne 2025', value: '33 500 €', delta: 'Jan–Avr' },
        { label: 'Épargne 2026', value: '4 243 €', delta: '−87,3%', highlight: true },
        { label: 'Dépenses hors épargne 2025', value: '10 820 €' },
        { label: 'Dépenses hors épargne 2026', value: '11 823 €', delta: '+9,3% seulement' },
      ],
    },
  },
  {
    id: 'f3-revenus-double-vitesse',
    badge: '−81%',
    title: 'Revenus hors-jan : −81%, pas −54%',
    subtitle: 'Deux dynamiques opposées derrière la moyenne',
    level: 'alert',
    modal: {
      title: 'La double vitesse des revenus',
      lead: "Le recul de −54,5% affiché en agrégé masque deux réalités opposées. Le pic de janvier a reculé de manière gérable : 27 439€ → 16 337€ (−40,4%). Mais les revenus des 3 mois suivants ont quasi-disparu : 14 703€ sur Fév–Avr 2025 → 2 820€ sur Fév–Avr 2026, soit −80,8%.",
      body: "Ce n'est pas le niveau absolu de revenus qui pose problème, c'est leur concentration sur un seul mois. Hors janvier, les revenus 2026 ne couvrent même pas le plancher opérationnel mensuel (~2 956€/mois), avec à peine 940€/mois sur Fév–Avr. La question structurelle : le modèle repose-t-il intentionnellement sur des revenus ponctuels concentrés, ou y a-t-il un déficit de revenus récurrents à combler ?",
      metrics: [
        { label: 'Janvier 2025', value: '27 439 €' },
        { label: 'Janvier 2026', value: '16 337 €', delta: '−40,4%' },
        { label: 'Fév–Avr 2025', value: '14 703 €' },
        { label: 'Fév–Avr 2026', value: '2 820 €', delta: '−80,8%', highlight: true },
        { label: 'Moy. Fév–Avr 2025', value: '4 901 €/mois' },
        { label: 'Moy. Fév–Avr 2026', value: '940 €/mois', delta: 'vs plancher 2 956€' },
      ],
    },
  },
] as const

const REPARTITION_INSIGHTS: readonly [InsightData, InsightData] = [
  {
    id: 'r3-achats-divers-illusion',
    badge: '−29%',
    title: "Achats divers : trompe-l’œil statistique",
    subtitle: 'La baisse apparente cache une hausse réelle de +15%',
    level: 'warning',
    modal: {
      title: 'Achats divers : illusion de −29%',
      lead: "Achats divers affiche 4 122€ → 2 936€ (−28,8%) en apparence. Mais mars 2025 concentrait un achat exceptionnel de 2 213€ qui gonfle la base de référence. Sans cet outlier, la moyenne mensuelle 2025 tombe à 636€/mois — contre 734€/mois en 2026.",
      body: "La réalité sous-jacente est une hausse de +15% du niveau de base des achats divers, non une baisse. L'amélioration affichée est un pur artefact comptable, pas un changement de comportement. Ce poste mérite une attention particulière en 2026 : si un achat exceptionnel du même ordre survient, le total annuel pourrait dépasser celui de 2025.",
      metrics: [
        { label: 'Achats divers 2025', value: '4 122 €', delta: 'dont mars 2 213€' },
        { label: 'Achats divers 2026', value: '2 936 €', delta: 'apparent −29%' },
        { label: 'Base 2025 hors mars', value: '1 909 €', delta: '3 mois → 636€/mois' },
        { label: 'Base 2026 (4 mois)', value: '2 936 €', delta: '734€/mois', highlight: true },
        { label: 'Δ réel sous-jacent', value: '+15%', highlight: true },
        { label: 'Outlier mars 2025', value: '2 213 €', delta: 'achat exceptionnel' },
      ],
    },
  },
  {
    id: 'r1-transport-x8',
    badge: '×8',
    title: 'Transport ×8 en un an',
    subtitle: '93€ → 745€ YTD — 5e poste opérationnel',
    level: 'alert',
    modal: {
      title: 'Transport : nouveau poste structurel',
      lead: "Le transport passe de 93€ → 745€ sur Jan–Avr (+701%). La hausse est régulière sur les 4 mois (Jan 147€ / Fév 275€ / Mar 253€ / Avr 71€), ce qui exclut un one-off ponctuel. Ce poste quasi-inexistant en 2025 est devenu le 5e poste opérationnel en volume.",
      body: "Projeté sur 12 mois au rythme 2026 : ~2 230€/an de nouveau coût structurel, absent du budget 2025. Un changement de mode de déplacement (véhicule, mobilité professionnelle, trajets réguliers) semble sous-jacent. La décrue d'avril (71€) reste à confirmer : normalisation ou simple saisonnalité ?",
      metrics: [
        { label: 'Transport Jan–Avr 2025', value: '93 €' },
        { label: 'Transport Jan–Avr 2026', value: '745 €', delta: '+701%', highlight: true },
        { label: 'Moy. mensuelle 2025', value: '23 €/mois' },
        { label: 'Moy. mensuelle 2026', value: '186 €/mois', highlight: true },
        { label: 'Part budget opérationnel 2025', value: '0,9%' },
        { label: 'Part budget opérationnel 2026', value: '6,3%', delta: 'projeté 2 230€/an' },
      ],
    },
  },
] as const
const MONTH_LABELS_UPPER = [
  'JANVIER',
  'FÉVRIER',
  'MARS',
  'AVRIL',
  'MAI',
  'JUIN',
  'JUILLET',
  'AOÛT',
  'SEPTEMBRE',
  'OCTOBRE',
  'NOVEMBRE',
  'DÉCEMBRE',
] as const

export function Annual2025Tab() {
  const { loading, error } =
    useAnnual2025Analysis()

  if (loading) {
    return <Annual2025Skeleton />
  }

  if (error) {
    return <Annual2025Error message={error} />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: 'grid', gap: 'var(--space-6)', paddingBottom: 'calc(var(--space-8) + 56px)', width: '100%', overflowX: 'clip' }}
    >
      <div style={{ display: 'grid', gap: 0 }}>
        <FluxCarouselSection />
        <ComparedInsightStrip
          insights={FLUX_INSIGHTS}
          accentColor={KLEIN_BLUE}
          labelColor="#7EA8FF"
          stripBg="linear-gradient(135deg, #070C1E 0%, #0A1230 100%)"
        />
      </div>

      <div style={{ display: 'grid', gap: 0 }}>
        <RepartitionCarouselSection />
        <ComparedInsightStrip
          insights={REPARTITION_INSIGHTS}
          accentColor={DEEP_YELLOW}
          stripBg="linear-gradient(135deg, #1A1206 0%, #221705 100%)"
        />
      </div>

      <AnnualProjectionSection />
    </motion.div>
  )
}

function FluxCarouselSection() {
  const [activeSlide, setActiveSlide] = useState<0 | 1>(0)
  const { flowRows, loading, error, flows2025, flows2026, fluxMetrics } = useComparedAnalysis()
  const monthCount = Math.max(1, Math.min(12, new Set(flowRows.map((row) => row.period_month)).size || 4))
  const analyzedPeriodLabel = `${MONTH_LABELS_UPPER[0]} -> ${MONTH_LABELS_UPPER[monthCount - 1]}`

  return (
    <section style={{ display: 'grid', gap: 0 }}>
      <div style={{ padding: '0 var(--space-6)', width: '100%', boxSizing: 'border-box' }}>
        <div style={{
          maxWidth: 600,
          margin: '0 auto',
          background: 'linear-gradient(135deg, color-mix(in oklab, var(--color-warning) 85%, #000 15%) 0%, color-mix(in oklab, var(--color-warning) 68%, #000 32%) 58%, color-mix(in oklab, var(--color-warning) 52%, #000 48%) 100%)',
          padding: '8px var(--space-5)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-3)',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0, width: '100%' }}>
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, minWidth: 0, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.03em' }}>
                période analysée :
              </span>
              <span style={{
                fontSize: 13,
                fontWeight: 800,
                color: '#fff',
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {analyzedPeriodLabel}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.03em' }}>
                ({monthCount} mois)
              </span>
            </span>
          </div>
        </div>
      </div>

      <MajorSectionHeading title="Analyse comparée des flux" marginTop={MAJOR_SECTION_GAP} />

      <div
        style={{
          position: 'relative',
          height: FLUX_SLIDE_FRAME_HEIGHT,
          marginTop: MAJOR_SECTION_GAP,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 'max(var(--space-6), calc((100% - 600px) / 2))',
            width: SECTION_BORDER_WIDTH,
            background: KLEIN_BLUE,
            borderRadius: 'var(--radius-full)',
            pointerEvents: 'none',
            zIndex: 4,
          }}
        />
        <div style={{ position: 'absolute', inset: 0, opacity: activeSlide === 0 ? 1 : 0, pointerEvents: activeSlide === 0 ? 'auto' : 'none' }}>
          <AnnualKeyInsightsGrid frameMinHeight={FLUX_SLIDE_FRAME_HEIGHT} headerless carouselMode />
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: activeSlide === 1 ? 1 : 0, pointerEvents: activeSlide === 1 ? 'auto' : 'none' }}>
          <ComparedMonthlySlide
            frameMinHeight={FLUX_SLIDE_FRAME_HEIGHT}
            loading={loading}
            error={error}
            flows2025={flows2025}
            flows2026={flows2026}
            fluxMetrics={fluxMetrics}
          />
        </div>
      </div>

      <div style={{ padding: '0 var(--space-6)', marginTop: 'var(--space-3)' }}>
        <div style={{
          maxWidth: 600,
          margin: '0 auto',
          padding: 4,
          borderRadius: 'var(--radius-full)',
          background: 'color-mix(in oklab, var(--primary-500) 10%, var(--neutral-0) 90%)',
          border: '1px solid color-mix(in oklab, var(--primary-500) 16%, var(--neutral-200) 84%)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 4,
        }}>
          <button
            type="button"
            onClick={() => setActiveSlide(0)}
            aria-label="Afficher la slide Principaux flux"
            aria-pressed={activeSlide === 0}
            style={slideNavButtonStyle(activeSlide === 0)}
          >
            Indicateurs
          </button>
          <button
            type="button"
            onClick={() => setActiveSlide(1)}
            aria-label="Afficher la slide Flux mensuels comparés"
            aria-pressed={activeSlide === 1}
            style={slideNavButtonStyle(activeSlide === 1)}
          >
            Courbes
          </button>
        </div>
      </div>
    </section>
  )
}

type ComparedMonthlySlideProps = {
  frameMinHeight: number
  loading: boolean
  error: string | null
  flows2025: ReturnType<typeof useComparedAnalysis>['flows2025']
  flows2026: ReturnType<typeof useComparedAnalysis>['flows2026']
  fluxMetrics: ReturnType<typeof useComparedAnalysis>['fluxMetrics']
}

function ComparedMonthlySlide({ frameMinHeight, loading, error, flows2025, flows2026, fluxMetrics }: ComparedMonthlySlideProps) {
  return (
    <section style={{ padding: '0 var(--space-6)', width: '100%', boxSizing: 'border-box', overflowX: 'clip', height: '100%' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {loading ? (
          <div style={{
            height: '100%',
            borderRadius: 'var(--radius-2xl)',
            background: 'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-150) 50%, var(--neutral-100) 75%)',
            backgroundSize: '200% 100%',
            animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
          }} />
        ) : null}

        {!loading && error ? (
          <div style={{
            minHeight: '100%',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-xl)',
            background: 'color-mix(in oklab, var(--color-error) 6%, var(--neutral-0) 94%)',
            border: '1px solid color-mix(in oklab, var(--color-error) 20%, transparent 80%)',
          }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-error)' }}>
              Erreur de chargement
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>
              {error}
            </p>
          </div>
        ) : null}

        {!loading && !error ? (
          <ComparedMonthlyChart
            flows2025={flows2025}
            flows2026={flows2026}
            fluxMetrics={fluxMetrics}
            minHeight={frameMinHeight}
          />
        ) : null}
      </div>
    </section>
  )
}

function RepartitionCarouselSection() {
  const [activeSlide, setActiveSlide] = useState<0 | 1>(0)
  const {
    loading,
    error,
    fluxMetrics,
    categoryMetrics,
    bucketMetrics,
    categoryRows,
  } = useComparedAnalysis()

  return (
    <section style={{ display: 'grid', gap: 0 }}>
      <MajorSectionHeading title="Analyse comparée de la répartition" marginTop={MAJOR_SECTION_GAP} />

      <div
        style={{
          position: 'relative',
          height: REPARTITION_SLIDE_FRAME_HEIGHT,
          marginTop: MAJOR_SECTION_GAP,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 'max(var(--space-6), calc((100% - 600px) / 2))',
            width: SECTION_BORDER_WIDTH,
            background: DEEP_YELLOW,
            borderRadius: 'var(--radius-full)',
            pointerEvents: 'none',
            zIndex: 4,
          }}
        />
        {loading ? (
          <section style={{ padding: '0 var(--space-6)', width: '100%', boxSizing: 'border-box', overflowX: 'clip', height: '100%' }}>
            <div style={{ maxWidth: 600, margin: '0 auto', height: '100%' }}>
              <div style={{
                height: '100%',
                borderRadius: 'var(--radius-2xl)',
                background: 'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-150) 50%, var(--neutral-100) 75%)',
                backgroundSize: '200% 100%',
                animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
              }} />
            </div>
          </section>
        ) : null}

        {!loading && error ? (
          <section style={{ padding: '0 var(--space-6)', width: '100%', boxSizing: 'border-box', overflowX: 'clip', height: '100%' }}>
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <div style={{
                minHeight: '100%',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-xl)',
                background: 'color-mix(in oklab, var(--color-error) 6%, var(--neutral-0) 94%)',
                border: '1px solid color-mix(in oklab, var(--color-error) 20%, transparent 80%)',
              }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-error)' }}>
                  Erreur de chargement
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>
                  {error}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {!loading && !error ? (
          <>
            <div style={{ position: 'absolute', inset: 0, opacity: activeSlide === 0 ? 1 : 0, pointerEvents: activeSlide === 0 ? 'auto' : 'none' }}>
              <section style={{ padding: '0 var(--space-6)', width: '100%', boxSizing: 'border-box', overflowX: 'clip', height: '100%' }}>
                <div style={{ maxWidth: 600, margin: '0 auto' }}>
                  <ComparedBucketChart metrics={bucketMetrics} fluxMetrics={fluxMetrics} />
                </div>
              </section>
            </div>
            <div style={{ position: 'absolute', inset: 0, opacity: activeSlide === 1 ? 1 : 0, pointerEvents: activeSlide === 1 ? 'auto' : 'none' }}>
              <section style={{ padding: '0 var(--space-6)', width: '100%', boxSizing: 'border-box', overflowX: 'clip', height: '100%' }}>
                <div style={{ maxWidth: 600, margin: '0 auto' }}>
                  <ComparedCategoryBars metrics={categoryMetrics} categoryRows={categoryRows} />
                </div>
              </section>
            </div>
          </>
        ) : null}
      </div>

      <div style={{ padding: '0 var(--space-6)', marginTop: 'var(--space-3)' }}>
        <div style={{
          maxWidth: 600,
          margin: '0 auto',
          padding: 4,
          borderRadius: 'var(--radius-full)',
          background: 'color-mix(in oklab, var(--primary-500) 10%, var(--neutral-0) 90%)',
          border: '1px solid color-mix(in oklab, var(--primary-500) 16%, var(--neutral-200) 84%)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 4,
        }}>
          <button
            type="button"
            onClick={() => setActiveSlide(0)}
            aria-label="Afficher la slide Répartition par bloc"
            aria-pressed={activeSlide === 0}
            style={slideNavButtonStyle(activeSlide === 0)}
          >
            Socles
          </button>
          <button
            type="button"
            onClick={() => setActiveSlide(1)}
            aria-label="Afficher la slide Répartition par catégorie"
            aria-pressed={activeSlide === 1}
            style={slideNavButtonStyle(activeSlide === 1)}
          >
            Catégories
          </button>
        </div>
      </div>

    </section>
  )
}

function AnnualProjectionSection() {
  const {
    loading,
    error,
    flows2025,
    flows2026,
    projectedExpense2025,
    projectedExpense2026,
    medianMonthly2025,
    medianMonthly2026,
    remainingMonths,
  } = useComparedAnalysis()

  if (loading || error) return null

  return (
    <section style={{ display: 'grid', gap: 0 }}>
      <MajorSectionHeading title="Projections annuelles comparées" marginTop="var(--space-8)" />
      <section style={{ padding: '0 var(--space-6)', width: '100%', boxSizing: 'border-box', overflowX: 'clip', marginTop: MAJOR_SECTION_GAP }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <ComparedVelocityCard
            expense2025={flows2025?.expense_total ?? 0}
            expense2026={flows2026?.expense_total ?? 0}
            projected2025={projectedExpense2025}
            projected2026={projectedExpense2026}
            medianMonthly2025={medianMonthly2025}
            medianMonthly2026={medianMonthly2026}
            remainingMonths={remainingMonths}
          />
        </div>
      </section>
    </section>
  )
}

function MajorSectionHeading({ title, marginTop }: { title: string; marginTop: string }) {
  return (
    <section style={{ padding: '0 var(--space-6)', marginTop, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-3)' }}>
        <div
          aria-hidden="true"
          style={{
            height: 2,
            width: '100%',
            background: '#121212',
            borderRadius: 'var(--radius-full)',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            aria-hidden="true"
            style={{
              width: 0,
              height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderLeft: '14px solid #121212',
              flexShrink: 0,
            }}
          />
          <h3 style={{
            margin: 0,
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--neutral-900)',
          }}>
            {title}
          </h3>
        </div>
      </div>
    </section>
  )
}

function slideNavButtonStyle(active: boolean): CSSProperties {
  return {
    border: active ? '1px solid color-mix(in oklab, var(--primary-600) 70%, var(--neutral-0) 30%)' : '1px solid transparent',
    background: active ? 'var(--neutral-0)' : 'transparent',
    color: active ? 'var(--primary-700)' : 'var(--neutral-600)',
    borderRadius: 'var(--radius-full)',
    padding: '6px 8px',
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'none',
    cursor: 'pointer',
    transition: 'all 160ms ease',
    whiteSpace: 'nowrap',
  }
}

function Annual2025Skeleton() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-6)', padding: '0 var(--space-6)', paddingBottom: 'calc(var(--space-8) + 56px)' }}>
      {/* Insights skeleton — 2-col */}
      <div style={{ maxWidth: 600, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        {[88, 80, 88, 80, 80].map((h, i) => (
          <SkeletonBlock key={i} height={h} radius="var(--radius-xl)" />
        ))}
      </div>

      {/* Chart skeletons */}
      <div style={{ maxWidth: 600, margin: '0 auto', width: '100%', display: 'grid', gap: 'var(--space-4)' }}>
        <SkeletonBlock height={280} radius="var(--radius-2xl)" />
        <SkeletonBlock height={240} radius="var(--radius-2xl)" />
        <SkeletonBlock height={200} radius="var(--radius-2xl)" />
      </div>
    </div>
  )
}

function SkeletonBlock({ height, radius }: { height: number; radius: string }) {
  return (
    <div style={{
      height,
      borderRadius: radius,
      background: 'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-150) 50%, var(--neutral-100) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
    }} />
  )
}

function Annual2025Error({ message }: { message: string }) {
  return (
    <div style={{ padding: '0 var(--space-6)' }}>
      <div style={{
        maxWidth: 600,
        margin: '0 auto',
        background: 'color-mix(in oklab, var(--color-error) 6%, var(--neutral-0) 94%)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid color-mix(in oklab, var(--color-error) 30%, transparent 70%)',
        padding: 'var(--space-5)',
      }}>
        <p style={{
          margin: 0,
          fontSize: 'var(--font-size-base)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-error)',
        }}>
          Erreur de chargement
        </p>
        <p style={{
          margin: '6px 0 0',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--neutral-600)',
        }}>
          {message}
        </p>
      </div>
    </div>
  )
}
