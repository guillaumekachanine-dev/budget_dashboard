import { motion } from 'framer-motion'
import { useAnnual2025Analysis } from '@/features/annual-analysis/hooks/useAnnual2025Analysis'
import { AnnualOverviewHero } from './AnnualOverviewHero'
import { AnnualKeyInsightsGrid } from './AnnualKeyInsightsGrid'
import { AnnualSpendingStructureSection } from './AnnualSpendingStructureSection'
import { AnnualTopCategoriesSection } from './AnnualTopCategoriesSection'
import { AnnualSeasonalitySection } from './AnnualSeasonalitySection'

export function Annual2025Tab() {
  const { loading, error, annualTotals, insightByKey, yearlyBuckets, yearlyParentCategories, monthlyProfile, top5ParentCategories, top5LeafCategories } =
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
      style={{ display: 'grid', gap: 'var(--space-7)', paddingBottom: 'calc(var(--space-8) + 56px)' }}
    >
      {annualTotals ? (
        <AnnualOverviewHero data={annualTotals} />
      ) : (
        <EmptyCard message="Les totaux annuels ne sont pas encore disponibles." />
      )}

      <AnnualKeyInsightsGrid insightByKey={insightByKey} />

      {yearlyBuckets.length > 0 || yearlyParentCategories.length > 0 ? (
        <AnnualSpendingStructureSection
          buckets={yearlyBuckets}
          parentCategories={yearlyParentCategories}
        />
      ) : null}

      {top5ParentCategories.length > 0 || top5LeafCategories.length > 0 ? (
        <AnnualTopCategoriesSection
          top5ParentCategories={top5ParentCategories}
          top5LeafCategories={top5LeafCategories}
        />
      ) : null}

      <AnnualSeasonalitySection
        insightByKey={insightByKey}
        monthlyProfile={monthlyProfile}
      />
    </motion.div>
  )
}

function Annual2025Skeleton() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-7)', padding: '0 var(--space-6)', paddingBottom: 'calc(var(--space-8) + 56px)' }}>
      {/* Hero skeleton */}
      <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
        <SkeletonBlock height={168} radius="var(--radius-2xl)" />
      </div>

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

function EmptyCard({ message }: { message: string }) {
  return (
    <div style={{ padding: '0 var(--space-6)' }}>
      <div style={{
        maxWidth: 600,
        margin: '0 auto',
        minHeight: 100,
        borderRadius: 'var(--radius-xl)',
        border: '1px dashed var(--neutral-300)',
        background: 'var(--neutral-50)',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-5)',
      }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)', textAlign: 'center' }}>
          {message}
        </p>
      </div>
    </div>
  )
}
