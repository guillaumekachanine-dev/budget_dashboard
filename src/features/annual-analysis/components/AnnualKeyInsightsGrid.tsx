import type { Annual2025InsightRow } from '@/features/annual-analysis/types'
import { formatCurrency } from '@/features/stats/utils/statsReferenceSelectors'
import { LEVEL_CONFIG } from './_constants'

type Props = {
  insightByKey: Record<string, Annual2025InsightRow>
}

const INSIGHT_KEYS_CONFIG = [
  {
    key: 'largest_leaf_expense',
    title: 'Plus gros poste annuel',
    renderBody: (row: Annual2025InsightRow) => {
      const parentName = row.payload.parent_category_name as string | undefined
      return (
        <>
          <p style={styles.insightValue}>{row.value_text ?? '—'}</p>
          {parentName ? (
            <p style={styles.insightSub}>{parentName}</p>
          ) : null}
          {row.value_numeric != null ? (
            <p style={styles.insightAmount}>{formatCurrency(row.value_numeric)}</p>
          ) : null}
        </>
      )
    },
  },
  {
    key: 'largest_parent_expense',
    title: 'Famille dominante',
    renderBody: (row: Annual2025InsightRow) => {
      const pct = row.payload.pct as number | undefined
      return (
        <>
          <p style={styles.insightValue}>{row.value_text ?? '—'}</p>
          {row.value_numeric != null ? (
            <p style={styles.insightAmount}>{formatCurrency(row.value_numeric)}</p>
          ) : null}
          {pct != null ? (
            <p style={styles.insightSub}>{pct.toFixed(1)}% des dépenses annuelles</p>
          ) : null}
        </>
      )
    },
  },
  {
    key: 'dominant_bucket',
    title: 'Bloc dominant',
    renderBody: (row: Annual2025InsightRow) => {
      const pct = row.payload.pct as number | undefined
      return (
        <>
          <p style={styles.insightValue}>{row.value_text ?? '—'}</p>
          {row.value_numeric != null ? (
            <p style={styles.insightAmount}>{formatCurrency(row.value_numeric)}</p>
          ) : null}
          {pct != null ? (
            <p style={styles.insightSub}>{pct.toFixed(1)}% du total</p>
          ) : null}
        </>
      )
    },
  },
  {
    key: 'hors_pilotage_alert',
    title: 'Hors pilotage',
    renderBody: (row: Annual2025InsightRow) => {
      const pct = row.payload.pct as number | undefined
      return (
        <>
          {row.value_numeric != null ? (
            <p style={styles.insightAmount}>{formatCurrency(row.value_numeric)}</p>
          ) : null}
          {pct != null ? (
            <p style={styles.insightValue}>{pct.toFixed(1)}% des dépenses</p>
          ) : null}
          {row.value_text ? (
            <p style={styles.insightSub}>{row.value_text}</p>
          ) : null}
        </>
      )
    },
  },
  {
    key: 'cash_withdrawals_alert',
    title: 'Retraits espèces',
    renderBody: (row: Annual2025InsightRow) => {
      const pct = row.payload.pct as number | undefined
      return (
        <>
          {row.value_numeric != null ? (
            <p style={styles.insightAmount}>{formatCurrency(row.value_numeric)}</p>
          ) : null}
          {pct != null ? (
            <p style={styles.insightValue}>{pct.toFixed(1)}% des dépenses</p>
          ) : null}
          {row.value_text ? (
            <p style={styles.insightSub}>{row.value_text}</p>
          ) : null}
        </>
      )
    },
  },
]

export function AnnualKeyInsightsGrid({ insightByKey }: Props) {
  const presentInsights = INSIGHT_KEYS_CONFIG.filter((cfg) => insightByKey[cfg.key])

  if (presentInsights.length === 0) {
    return null
  }

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2 style={styles.sectionTitle}>Messages clés</h2>
        <div style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
          {presentInsights.map((cfg) => {
            const row = insightByKey[cfg.key]
            return (
              <InsightCard key={cfg.key} title={cfg.title} row={row}>
                {cfg.renderBody(row)}
              </InsightCard>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function InsightCard({
  title,
  row,
  children,
}: {
  title: string
  row: Annual2025InsightRow
  children: React.ReactNode
}) {
  const level = row.insight_level in LEVEL_CONFIG ? row.insight_level : 'info'
  const cfg = LEVEL_CONFIG[level]

  return (
    <div style={{
      background: cfg.bg,
      borderRadius: 'var(--radius-xl)',
      border: `1px solid ${cfg.accent}`,
      borderLeftWidth: 4,
      padding: 'var(--space-4)',
      display: 'grid',
      gap: 'var(--space-1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
        <LevelDot color={cfg.accent} />
        <p style={{
          margin: 0,
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-bold)',
          color: cfg.accent,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          {cfg.label}
        </p>
      </div>
      <p style={{
        margin: 0,
        fontSize: 'var(--font-size-base)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--neutral-800)',
      }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function LevelDot({ color }: { color: string }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 7,
      height: 7,
      borderRadius: 'var(--radius-full)',
      background: color,
      flexShrink: 0,
    }} />
  )
}

const styles = {
  sectionTitle: {
    margin: 0,
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--neutral-900)',
  } as React.CSSProperties,
  insightValue: {
    margin: '4px 0 0',
    fontSize: 'var(--font-size-base)',
    fontWeight: 'var(--font-weight-semibold)',
    color: 'var(--neutral-800)',
  } as React.CSSProperties,
  insightAmount: {
    margin: '4px 0 0',
    fontSize: 'var(--font-size-xl)',
    fontWeight: 'var(--font-weight-bold)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--neutral-900)',
    lineHeight: 1.2,
  } as React.CSSProperties,
  insightSub: {
    margin: '3px 0 0',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--neutral-500)',
  } as React.CSSProperties,
}
