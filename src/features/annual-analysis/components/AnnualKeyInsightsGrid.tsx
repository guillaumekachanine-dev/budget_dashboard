import type { Annual2025InsightRow } from '@/features/annual-analysis/types'
import { formatCurrencyRounded as formatCurrency } from '@/lib/utils'
import { BUCKET_LABELS, LEVEL_CONFIG, formatPct } from './_constants'

function objPayload(row: Annual2025InsightRow): Record<string, unknown> {
  return Array.isArray(row.payload) ? {} : row.payload
}

function getPct(row: Annual2025InsightRow): number | undefined {
  const p = objPayload(row)
  const raw = p.pct ?? p.share_of_year_expense_pct
  return typeof raw === 'number' ? raw : undefined
}

type Props = {
  insightByKey: Record<string, Annual2025InsightRow>
}

const INSIGHT_KEYS_CONFIG = [
  {
    key: 'largest_leaf_expense',
    title: 'Plus gros poste',
    renderBody: (row: Annual2025InsightRow) => {
      const parentName = objPayload(row).parent_category_name as string | undefined
      const pct = getPct(row)
      const amount = row.value_numeric != null ? formatCurrency(row.value_numeric) : null
      const detail = pct != null ? `${formatPct(pct)}% des dépenses` : amount
      return { main: row.value_text ?? '—', sub: parentName ?? null, detail }
    },
  },
  {
    key: 'largest_parent_expense',
    title: 'Famille dominante',
    renderBody: (row: Annual2025InsightRow) => {
      const pct = getPct(row)
      const amount = row.value_numeric != null ? formatCurrency(row.value_numeric) : null
      const detail = pct != null ? `${formatPct(pct)}% des dépenses` : null
      return { main: row.value_text ?? '—', sub: amount, detail }
    },
  },
  {
    key: 'dominant_bucket',
    title: 'Bloc dominant',
    renderBody: (row: Annual2025InsightRow) => {
      const pct = getPct(row)
      const rawKey = row.value_text ?? ''
      const label = BUCKET_LABELS[rawKey] ?? rawKey
      const amount = row.value_numeric != null ? formatCurrency(row.value_numeric) : null
      const detail = pct != null ? `${formatPct(pct)}% du total` : null
      return { main: label || '—', sub: amount, detail }
    },
  },
  {
    key: 'hors_pilotage_alert',
    title: 'Hors pilotage',
    renderBody: (row: Annual2025InsightRow) => {
      const pct = getPct(row)
      const main = row.value_numeric != null ? formatCurrency(row.value_numeric) : (row.value_text ?? '—')
      const sub = pct != null ? `${formatPct(pct)}% des dépenses` : null
      return { main, sub, detail: null }
    },
  },
  {
    key: 'cash_withdrawals_alert',
    title: 'Retraits espèces',
    renderBody: (row: Annual2025InsightRow) => {
      const pct = getPct(row)
      const main = row.value_numeric != null ? formatCurrency(row.value_numeric) : (row.value_text ?? '—')
      const sub = pct != null ? `${formatPct(pct)}% des dépenses` : null
      const detail = row.value_text && row.value_numeric != null ? row.value_text : null
      return { main, sub, detail }
    },
  },
]

type InsightBody = { main: string; sub: string | null; detail: string | null }

export function AnnualKeyInsightsGrid({ insightByKey }: Props) {
  const presentInsights = INSIGHT_KEYS_CONFIG.filter((cfg) => insightByKey[cfg.key])

  if (presentInsights.length === 0) return null

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2 style={styles.sectionTitle}>Messages clés</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-3)',
        }}>
          {presentInsights.map((cfg) => {
            const row = insightByKey[cfg.key]
            const body = cfg.renderBody(row)
            return (
              <InsightCard key={cfg.key} title={cfg.title} row={row} body={body} />
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
  body,
}: {
  title: string
  row: Annual2025InsightRow
  body: InsightBody
}) {
  const level = row.insight_level in LEVEL_CONFIG ? row.insight_level : 'info'
  const cfg = LEVEL_CONFIG[level]

  return (
    <div style={{
      background: cfg.bg,
      borderRadius: 'var(--radius-xl)',
      border: `1px solid ${cfg.border}`,
      borderTopWidth: 3,
      borderTopColor: cfg.accent,
      padding: 'var(--space-3) var(--space-3) var(--space-4)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-1)',
      minWidth: 0,
    }}>
      {/* Badge inline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: 'var(--radius-full)',
          background: cfg.accent,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: cfg.accent,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
        }}>
          {cfg.label}
        </span>
      </div>

      {/* Title */}
      <p style={{
        margin: 0,
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--neutral-500)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {title}
      </p>

      {/* Main value */}
      <p style={{
        margin: '2px 0 0',
        fontSize: 'var(--font-size-base)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--neutral-900)',
        lineHeight: 1.25,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {body.main}
      </p>

      {/* Sub-value */}
      {body.sub ? (
        <p style={{
          margin: 0,
          fontSize: 'var(--font-size-sm)',
          color: 'var(--neutral-600)',
          fontWeight: 'var(--font-weight-medium)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {body.sub}
        </p>
      ) : null}

      {/* Detail */}
      {body.detail ? (
        <p style={{
          margin: 0,
          fontSize: 'var(--font-size-xs)',
          color: 'var(--neutral-400)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {body.detail}
        </p>
      ) : null}
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
}
