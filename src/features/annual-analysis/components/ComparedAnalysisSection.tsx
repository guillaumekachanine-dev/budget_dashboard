import { useComparedAnalysis } from '@/features/annual-analysis/hooks/useComparedAnalysis'
import { ComparedBucketChart } from './ComparedBucketChart'
import { ComparedCategoryBars } from './ComparedCategoryBars'
import { ComparedVelocityCard } from './ComparedVelocityCard'
import { ComparedMonthlyChart } from './ComparedMonthlyChart'

export function ComparedAnalysisSection() {
  const {
    loading, error,
    fluxMetrics, categoryMetrics, bucketMetrics,
    flows2025, flows2026,
    projectedExpense2025, projectedExpense2026,
    medianMonthly2025, medianMonthly2026, remainingMonths,
  } = useComparedAnalysis()

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* En-tête de section */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h3 style={{
            margin: 0,
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--neutral-900)',
          }}>
            Analyse comparée
          </h3>
        </div>

        {/* États loading / error */}
        {loading && <SectionSkeleton />}
        {!loading && error && <SectionError message={error} />}

        {/* Contenu */}
        {!loading && !error && (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <ComparedMonthlyChart
              flows2025={flows2025}
              flows2026={flows2026}
              fluxMetrics={fluxMetrics}
            />

            <ComparedVelocityCard
              expense2025={flows2025?.expense_total ?? 0}
              expense2026={flows2026?.expense_total ?? 0}
              projected2025={projectedExpense2025}
              projected2026={projectedExpense2026}
              medianMonthly2025={medianMonthly2025}
              medianMonthly2026={medianMonthly2026}
              remainingMonths={remainingMonths}
            />

            <ComparedBucketChart metrics={bucketMetrics} />

            <ComparedCategoryBars metrics={categoryMetrics} />
          </div>
        )}
      </div>
    </section>
  )
}

function SectionSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      {[72, 120, 200, 280].map((h, i) => (
        <div
          key={i}
          style={{
            height: h,
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-150) 50%, var(--neutral-100) 75%)',
            backgroundSize: '200% 100%',
            animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  )
}

function SectionError({ message }: { message: string }) {
  return (
    <div style={{
      padding: 'var(--space-4)',
      borderRadius: 'var(--radius-xl)',
      background: 'color-mix(in oklab, var(--color-error) 6%, var(--neutral-0) 94%)',
      border: '1px solid color-mix(in oklab, var(--color-error) 20%, transparent 80%)',
    }}>
      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-error)' }}>
        Erreur de chargement
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-500)' }}>
        {message}
      </p>
    </div>
  )
}
