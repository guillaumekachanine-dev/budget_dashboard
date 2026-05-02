import type { Top5CategoryItem } from '@/features/annual-analysis/types'
import { formatCurrency } from '@/features/stats/utils/statsReferenceSelectors'

type Props = {
  top5ParentCategories: Top5CategoryItem[]
  top5LeafCategories: Top5CategoryItem[]
}

export function AnnualTopCategoriesSection({ top5ParentCategories, top5LeafCategories }: Props) {
  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2 style={styles.sectionTitle}>Classements 2025</h2>
        <div style={{ display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
          <TopListCard
            title="Top 5 catégories"
            subtitle="Familles de dépenses les plus importantes"
            items={top5ParentCategories}
            showParent={false}
          />
          <TopListCard
            title="Top 5 sous-catégories"
            subtitle="Postes les plus importants toutes familles confondues"
            items={top5LeafCategories}
            showParent
          />
        </div>
      </div>
    </section>
  )
}

function TopListCard({
  title,
  subtitle,
  items,
  showParent,
}: {
  title: string
  subtitle: string
  items: Top5CategoryItem[]
  showParent: boolean
}) {
  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>{title}</h3>
      <p style={styles.cardSubtitle}>{subtitle}</p>

      {items.length === 0 ? (
        <p style={styles.empty}>Aucune donnée disponible.</p>
      ) : (
        <div style={{ marginTop: 'var(--space-4)', display: 'grid', gap: 0 }}>
          {/* Header */}
          <div style={{ ...styles.row, borderBottom: '1px solid var(--neutral-200)', paddingBottom: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
            <span style={styles.headerCell}>#</span>
            <span style={{ ...styles.headerCell, textAlign: 'left' }}>Catégorie</span>
            <span style={{ ...styles.headerCell, textAlign: 'right' }}>%</span>
            <span style={{ ...styles.headerCell, textAlign: 'right' }}>Montant</span>
          </div>

          {items.map((item, index) => (
            <RankRow key={item.rank ?? index} item={item} showParent={showParent} isLast={index === items.length - 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function RankRow({ item, showParent, isLast }: { item: Top5CategoryItem; showParent: boolean; isLast: boolean }) {
  const rankColors = ['var(--primary-500)', 'var(--neutral-700)', 'var(--neutral-500)', 'var(--neutral-400)', 'var(--neutral-400)']
  const rankColor = rankColors[(item.rank ?? 1) - 1] ?? 'var(--neutral-400)'

  return (
    <div style={{
      ...styles.row,
      borderBottom: isLast ? 'none' : '1px solid var(--neutral-100)',
      padding: '10px 0',
    }}>
      {/* Rang */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontWeight: 'var(--font-weight-bold)',
        fontSize: 'var(--font-size-sm)',
        color: rankColor,
        textAlign: 'center',
      }}>
        {item.rank ?? '—'}
      </span>

      {/* Nom */}
      <span style={{ display: 'grid', gap: 1 }}>
        <span style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--neutral-800)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {item.category_name}
        </span>
        {showParent && item.parent_category_name ? (
          <span style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--neutral-400)',
          }}>
            {item.parent_category_name}
          </span>
        ) : null}
      </span>

      {/* % */}
      <span style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--neutral-500)',
        fontFamily: 'var(--font-mono)',
        textAlign: 'right',
        whiteSpace: 'nowrap',
      }}>
        {item.pct.toFixed(1)}%
      </span>

      {/* Montant */}
      <span style={{
        fontSize: 'var(--font-size-sm)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--neutral-900)',
        fontFamily: 'var(--font-mono)',
        textAlign: 'right',
        whiteSpace: 'nowrap',
      }}>
        {formatCurrency(item.amount)}
      </span>
    </div>
  )
}

const styles = {
  sectionTitle: {
    margin: 0,
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--neutral-900)',
  } as React.CSSProperties,
  card: {
    background: 'var(--neutral-0)',
    borderRadius: 'var(--radius-2xl)',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--neutral-150)',
    padding: 'var(--space-4)',
  } as React.CSSProperties,
  cardTitle: {
    margin: 0,
    fontSize: 'var(--font-size-md)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--neutral-900)',
  } as React.CSSProperties,
  cardSubtitle: {
    margin: '3px 0 0',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--neutral-500)',
  } as React.CSSProperties,
  row: {
    display: 'grid',
    gridTemplateColumns: '28px 1fr 44px 80px',
    alignItems: 'center',
    gap: 'var(--space-2)',
  } as React.CSSProperties,
  headerCell: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--neutral-500)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  empty: {
    margin: 'var(--space-4) 0 0',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--neutral-400)',
  } as React.CSSProperties,
}
