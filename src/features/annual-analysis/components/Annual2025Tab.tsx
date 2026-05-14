import { useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { useAnnual2025Analysis } from '@/features/annual-analysis/hooks/useAnnual2025Analysis'
import { useComparedAnalysis } from '@/features/annual-analysis/hooks/useComparedAnalysis'
import { AnnualKeyInsightsGrid } from './AnnualKeyInsightsGrid'
import { ComparedMonthlyChart } from './ComparedMonthlyChart'
import { ComparedBucketChart } from './ComparedBucketChart'
import { ComparedCategoryBars } from './ComparedCategoryBars'
import { ComparedVelocityCard } from './ComparedVelocityCard'

const FLUX_SLIDE_FRAME_HEIGHT = 336
const REPARTITION_SLIDE_FRAME_HEIGHT = 438
const MAJOR_SECTION_GAP = 'var(--space-6)'
const SECTION_BORDER_WIDTH = '4px'
const KLEIN_BLUE = '#002FA7'
const DEEP_YELLOW = '#B8860B'
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
      <FluxCarouselSection />
      <RepartitionCarouselSection />
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
