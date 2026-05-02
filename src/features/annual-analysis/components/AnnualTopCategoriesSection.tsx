import type { Top5CategoryItem } from '@/features/annual-analysis/types'
import { formatCurrencyRounded as formatCurrency } from '@/lib/utils'
import { formatPct } from './_constants'

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
          <RankCard
            title="Top familles de dépenses"
            subtitle="Catégories parentes"
            items={top5ParentCategories}
            showParent={false}
          />
          <RankCard
            title="Top sous-catégories"
            subtitle="Postes les plus importants"
            items={top5LeafCategories}
            showParent
          />
        </div>
      </div>
    </section>
  )
}

function RankCard({
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
  const maxAmount = items.reduce((m, i) => Math.max(m, i.amount), 0)

  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>{title}</h3>
      <p style={styles.cardSubtitle}>{subtitle}</p>

      {items.length === 0 ? (
        <p style={styles.empty}>Aucune donnée disponible.</p>
      ) : (
        <div style={{ marginTop: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
          {items.map((item, index) => (
            <RankRow
              key={item.rank ?? index}
              item={item}
              showParent={showParent}
              maxAmount={maxAmount}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const RANK_ACCENTS = ['#5B57F5', '#7B77FF', '#9E9BFF', '#B0BEC5', '#CFD8DC']

function RankRow({
  item,
  showParent,
  maxAmount,
}: {
  item: Top5CategoryItem
  showParent: boolean
  maxAmount: number
}) {
  const barWidth = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0
  const rank = item.rank ?? 0
  const accentColor = RANK_ACCENTS[(rank - 1) % RANK_ACCENTS.length] ?? '#B0BEC5'

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: 10, alignItems: 'baseline' }}>
        {/* Rang */}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 700,
          color: accentColor,
          textAlign: 'right',
          lineHeight: 1,
        }}>
          {rank}
        </span>

        {/* Nom + parent */}
        <span style={{ minWidth: 0 }}>
          <span style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            color: 'var(--neutral-800)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
          }}>
            {item.category_name}
          </span>
          {showParent && item.parent_category_name ? (
            <span style={{
              display: 'block',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--neutral-400)',
              marginTop: 1,
            }}>
              {item.parent_category_name}
            </span>
          ) : null}
        </span>

        {/* % + montant */}
        <span style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{
            display: 'block',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--neutral-900)',
            whiteSpace: 'nowrap',
          }}>
            {formatCurrency(item.amount)}
          </span>
          <span style={{
            display: 'block',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--neutral-400)',
            fontFamily: 'var(--font-mono)',
            marginTop: 1,
          }}>
            {formatPct(item.pct)}%
          </span>
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        marginTop: 6,
        marginLeft: 30,
        height: 3,
        borderRadius: 99,
        background: 'var(--neutral-100)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${barWidth.toFixed(1)}%`,
          borderRadius: 99,
          background: accentColor,
          transition: 'width 0.4s ease',
        }} />
      </div>
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
    padding: 'var(--space-5)',
  } as React.CSSProperties,
  cardTitle: {
    margin: 0,
    fontSize: 'var(--font-size-base)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--neutral-900)',
  } as React.CSSProperties,
  cardSubtitle: {
    margin: '3px 0 0',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--neutral-400)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontWeight: 600,
  } as React.CSSProperties,
  empty: {
    margin: 'var(--space-4) 0 0',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--neutral-400)',
  } as React.CSSProperties,
}
