import { motion } from 'framer-motion'
import { useAnnual2026Analysis } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { Annual2026Hero } from './Annual2026Hero'
import { Annual2026BudgetDNA } from './Annual2026BudgetDNA'
import { Annual2026CategoryRanking, AnnualProjectionCard } from './Annual2026CategoryRanking'
import { Annual2026MonthlyTable } from './Annual2026MonthlyTable'
import { ConfiguredBudgetPilotagePanel } from '@/features/budget/components/ConfiguredBudgetPilotagePanel'

export function Annual2026Tab() {
  const {
    loading,
    error,
    summary,
    buckets,
    categories,
    insights,
    monthlyProfile,
  } = useAnnual2026Analysis()
  void insights

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

      {/* 1ère partie : Vue d'ensemble - 2026 */}
      {summary && buckets.length > 0 ? (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <Annual2026Hero summary={summary} buckets={buckets} />
          <SectionTitle title="Vue d'ensemble 2026" />
          <Annual2026MonthlyTable monthlyProfile={monthlyProfile} />
          {categories.length > 0 ? <AnnualProjectionCard categories={categories} /> : null}
        </div>
      ) : null}

      {/* 2ème partie : Anatomie du budget YTD */}
      {buckets.length > 0 && summary ? (
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <SectionTitle title="Enveloppes budgétaires 2026" />
          <Annual2026BudgetDNA
            buckets={buckets}
            categories={categories}
            totalMonthly={summary.totalMonthlyBudget}
          />
          {categories.length > 0 ? <Annual2026CategoryRanking categories={categories} /> : null}
        </div>
      ) : null}

      <ConfiguredBudgetPilotagePanel />
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Annual2026Skeleton() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-7)', padding: '0 var(--space-6)', paddingBottom: 'calc(var(--space-8) + 56px)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', width: '100%', display: 'grid', gap: 'var(--space-3)' }}>
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

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ padding: '0 var(--space-6)', marginTop: 'var(--space-2)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2 style={{
          margin: 0, fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)',
          letterSpacing: '-0.02em'
        }}>
          {title}
        </h2>
      </div>
    </div>
  )
}
