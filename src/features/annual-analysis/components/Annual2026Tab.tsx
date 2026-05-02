import { motion } from 'framer-motion'
import { useAnnual2026Analysis } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { Annual2026Hero } from './Annual2026Hero'
import { Annual2026InsightsGrid } from './Annual2026InsightsGrid'
import { Annual2026BudgetDNA } from './Annual2026BudgetDNA'
import { Annual2026CategoryRanking } from './Annual2026CategoryRanking'
import { Annual2026Seasonality } from './Annual2026Seasonality'
import { Annual2026Optimization } from './Annual2026Optimization'

export function Annual2026Tab() {
  const {
    loading,
    error,
    summary,
    buckets,
    categories,
    insights,
    optimizations,
    monthlyProfile,
  } = useAnnual2026Analysis()

  if (loading) {
    return <Annual2026Skeleton />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      style={{ display: 'grid', gap: 'var(--space-7)', paddingBottom: 'calc(var(--space-8) + 56px)' }}
    >
      {/* Message d'avertissement si données statiques */}
      {error ? (
        <div style={{ padding: '0 var(--space-6)' }}>
          <div style={{
            maxWidth: 600, margin: '0 auto',
            background: 'color-mix(in oklab, var(--color-warning) 8%, var(--neutral-0) 92%)',
            border: '1px solid color-mix(in oklab, var(--color-warning) 25%, transparent)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-600)' }}>
              <strong>Données statiques affichées</strong> — Les données réelles de la base n'ont pas pu être chargées.{' '}
              <span style={{ color: 'var(--neutral-400)' }}>{error}</span>
            </p>
          </div>
        </div>
      ) : null}

      {/* Section 1 — Hero */}
      {summary ? (
        <Annual2026Hero summary={summary} />
      ) : null}

      {/* Section 2 — Messages clés */}
      {insights.length > 0 ? (
        <Annual2026InsightsGrid insights={insights} />
      ) : null}

      {/* Section 3 — Anatomie du budget (DNA) */}
      {buckets.length > 0 && summary ? (
        <Annual2026BudgetDNA
          buckets={buckets}
          categories={categories}
          totalMonthly={summary.totalMonthlyBudget}
        />
      ) : null}

      {/* Section 4 — Classement des postes */}
      {categories.length > 0 ? (
        <Annual2026CategoryRanking categories={categories} />
      ) : null}

      {/* Section 5 — Saisonnalité YTD */}
      {monthlyProfile.length > 0 && buckets.length > 0 ? (
        <Annual2026Seasonality monthlyProfile={monthlyProfile} buckets={buckets} />
      ) : null}

      {/* Section 6 — Optimisations */}
      {optimizations.length > 0 && summary ? (
        <Annual2026Optimization
          scenarios={optimizations}
          totalMonthlyBudget={summary.totalMonthlyBudget}
          totalSavings={summary.totalSavingsBudget}
        />
      ) : null}
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Annual2026Skeleton() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-7)', padding: '0 var(--space-6)', paddingBottom: 'calc(var(--space-8) + 56px)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', width: '100%', display: 'grid', gap: 'var(--space-3)' }}>
        <SkeletonBlock height={20} radius="var(--radius-full)" width="40%" />
        <SkeletonBlock height={180} radius="var(--radius-2xl)" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
          <SkeletonBlock height={72} radius="var(--radius-xl)" />
          <SkeletonBlock height={72} radius="var(--radius-xl)" />
          <SkeletonBlock height={72} radius="var(--radius-xl)" />
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        {[90, 82, 90, 82, 82].map((h, i) => (
          <SkeletonBlock key={i} height={h} radius="var(--radius-xl)" />
        ))}
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', width: '100%', display: 'grid', gap: 'var(--space-4)' }}>
        <SkeletonBlock height={260} radius="var(--radius-2xl)" />
        <SkeletonBlock height={200} radius="var(--radius-2xl)" />
        <SkeletonBlock height={280} radius="var(--radius-2xl)" />
      </div>
    </div>
  )
}

function SkeletonBlock({ height, radius, width = '100%' }: { height: number; radius: string; width?: string }) {
  return (
    <div style={{
      height, borderRadius: radius, width,
      background: 'linear-gradient(90deg, var(--neutral-100) 25%, var(--neutral-150) 50%, var(--neutral-100) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
    }} />
  )
}
