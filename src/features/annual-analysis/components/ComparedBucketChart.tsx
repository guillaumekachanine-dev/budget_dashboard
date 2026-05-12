import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { ChevronRight, X } from 'lucide-react'
import { formatCurrencyRounded as fmt } from '@/lib/utils'
import { BUCKET_LABELS, PILOTAGE_BUCKET_ORDER, CHART_TOOLTIP_STYLE } from './_constants'
import type { ComparedBucketMetric } from '@/features/annual-analysis/types.compared'
import {
  getComparedBucketCategoryBreakdown,
  type BucketCategoryBreakdownRow,
} from '@/features/annual-analysis/api/getComparedBucketCategoryBreakdown'
import { CategoryIcon } from '@/components/ui/CategoryIcon'

// ─── Couleurs unifiées ────────────────────────────────────────────────────────
const COLOR_2025 = 'rgba(255,171,46,0.38)'
const COLOR_2026 = '#B8860B'

// ─── Couleurs d'en-tête par bloc (pour la modale détail) ─────────────────────
const BUCKET_HEADER_COLORS: Record<string, string> = {
  socle_fixe:           '#5B57F5',
  variable_essentielle: '#4CC9F0',
  provision:            '#FFAB2E',
  discretionnaire:      '#FF9F43',
  epargne:              '#2ED47A',
  hors_pilotage:        '#FC5A5A',
}

// ─── Labels courts pour l'axe X ──────────────────────────────────────────────
const BUCKET_SHORT: Record<string, string> = {
  socle_fixe:           'Socle fixe',
  variable_essentielle: 'Var. essen.',
  provision:            'Provisions',
  discretionnaire:      'Discrétion.',
  epargne:              'Épargne',
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ChartEntry = {
  name:   string
  bucket: string
  v2025:  number
  v2026:  number
}

type Props = { metrics: ComparedBucketMetric[] }

// ─── Component ────────────────────────────────────────────────────────────────

export function ComparedBucketChart({ metrics }: Props) {
  const [clickedBucket, setClickedBucket] = useState<string | null>(null)
  const [detailData,    setDetailData]    = useState<BucketCategoryBreakdownRow[] | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showDetail,    setShowDetail]    = useState(false)

  // Tous les blocs de pilotage, même à zéro
  const data: ChartEntry[] = [...PILOTAGE_BUCKET_ORDER].map((key) => {
    const m = metrics.find((m) => m.bucket === key)
    return {
      name:  BUCKET_SHORT[key] ?? (BUCKET_LABELS[key] ?? key),
      bucket: key,
      v2025: Math.round(m?.actual_2025 ?? 0),
      v2026: Math.round(m?.actual_2026 ?? 0),
    }
  })

  const clickedEntry  = data.find((d) => d.bucket === clickedBucket) ?? null
  const clickedMetric = metrics.find((m) => m.bucket === clickedBucket) ?? null

  // ── Clic sur une barre ────────────────────────────────────────────────────
  const handleChartClick = (chartData: { activePayload?: Array<{ payload: ChartEntry }> } | null) => {
    const bucket = chartData?.activePayload?.[0]?.payload?.bucket
    if (!bucket) return
    if (bucket === clickedBucket) {
      setClickedBucket(null)
      setDetailData(null)
      setShowDetail(false)
    } else {
      setClickedBucket(bucket)
      setDetailData(null)
      setShowDetail(false)
    }
  }

  // ── Charger le détail ──────────────────────────────────────────────────────
  const openDetail = async () => {
    if (!clickedBucket) return
    setDetailLoading(true)
    setShowDetail(true)
    try {
      const rows = await getComparedBucketCategoryBreakdown(clickedBucket)
      setDetailData(rows)
    } catch (e) {
      console.error(e)
      setDetailData([])
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setShowDetail(false)
    setDetailData(null)
  }

  return (
    <>
      <div style={{
        background: 'var(--neutral-0)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid var(--neutral-150)',
        padding: 'var(--space-5)',
      }}>
        {/* Titre */}
        <p style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-600)' }}>
          Dépenses YTD par bloc
        </p>

        {/* Chart — margin.left=0, YAxis.width=38 pour aligner avec le titre */}
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={data}
            barCategoryGap="28%"
            barGap={3}
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            onClick={handleChartClick}
            style={{ cursor: 'pointer' }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-100)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: 'var(--neutral-500)', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 9, fill: 'var(--neutral-400)' }}
              axisLine={false}
              tickLine={false}
              width={38}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [
                fmt(value),
                name === 'v2025' ? '2025' : '2026',
              ]}
              labelStyle={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}
              itemStyle={{ fontSize: 11 }}
            />

            <Bar dataKey="v2025" name="v2025" fill={COLOR_2025} radius={[3, 3, 0, 0]} />
            <Bar dataKey="v2026" name="v2026" fill={COLOR_2026} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* Légende unifiée */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-2)', justifyContent: 'center' }}>
          {[
            { label: '2025', color: COLOR_2025, border: 'rgba(255,171,46,0.7)' },
            { label: '2026', color: COLOR_2026, border: COLOR_2026 },
          ].map(({ label, color, border }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: color, border: `1.5px solid ${border}` }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-500)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Mini panel au clic d'un bloc */}
        {clickedEntry && (
          <BucketQuickPanel
            entry={clickedEntry}
            metric={clickedMetric}
            onClose={() => { setClickedBucket(null); setDetailData(null); setShowDetail(false) }}
            onDetail={openDetail}
          />
        )}
      </div>

      {/* Modale détail sous-catégories */}
      {showDetail && clickedBucket && (
        <BucketDetailModal
          bucket={clickedBucket}
          bucketLabel={BUCKET_LABELS[clickedBucket] ?? clickedBucket}
          headerColor={BUCKET_HEADER_COLORS[clickedBucket] ?? '#5B57F5'}
          rows={detailData}
          loading={detailLoading}
          onClose={closeDetail}
        />
      )}
    </>
  )
}

// ─── BucketQuickPanel ─────────────────────────────────────────────────────────

function BucketQuickPanel({
  entry, metric, onClose, onDetail,
}: {
  entry:    ChartEntry
  metric:   ComparedBucketMetric | null
  onClose:  () => void
  onDetail: () => void
}) {
  const delta    = metric ? metric.actual_2026 - metric.actual_2025 : entry.v2026 - entry.v2025
  const deltaPct = metric?.delta_pct ?? (entry.v2025 > 0 ? ((entry.v2026 - entry.v2025) / entry.v2025) * 100 : null)
  const isUp     = delta > 0

  return (
    <div style={{
      marginTop: 'var(--space-3)',
      borderTop: '1px solid var(--neutral-150)',
      paddingTop: 'var(--space-3)',
      position: 'relative',
    }}>
      {/* Fermer */}
      <button
        type="button"
        onClick={onClose}
        style={{
          position: 'absolute', top: 8, right: 0,
          border: 'none', background: 'transparent',
          color: 'var(--neutral-400)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, borderRadius: 'var(--radius-full)',
          padding: 0,
        }}
        aria-label="Fermer"
      >
        <X size={14} />
      </button>

      {/* Nom du bloc */}
      <p style={{ margin: '0 0 var(--space-3)', fontSize: 12, fontWeight: 800, color: 'var(--neutral-800)', paddingRight: 28 }}>
        {BUCKET_LABELS[entry.bucket] ?? entry.name}
      </p>

      {/* 2025 | delta | 2026 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>2025</p>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-600)' }}>{fmt(entry.v2025)}</p>
        </div>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: delta === 0 ? 'var(--neutral-400)' : isUp ? '#C0392B' : '#1A7A4A',
            background: delta === 0 ? 'var(--neutral-100)' : isUp ? 'rgba(252,90,90,0.10)' : 'rgba(46,212,122,0.12)',
            borderRadius: 'var(--radius-full)',
            padding: '2px 8px',
          }}>
            {delta === 0 ? '—' : isUp ? '▲' : '▼'} {deltaPct != null ? `${Math.abs(deltaPct).toFixed(1)}%` : ''}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: delta === 0 ? 'var(--neutral-400)' : isUp ? '#C0392B' : '#1A7A4A' }}>
            {delta > 0 ? '+' : ''}{fmt(delta)}
          </span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, color: COLOR_2026, textTransform: 'uppercase', letterSpacing: '0.06em' }}>2026</p>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>{fmt(entry.v2026)}</p>
        </div>
      </div>

      {/* Bouton Détails */}
      <button
        type="button"
        onClick={onDetail}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 'var(--radius-md)',
          border: `1.5px solid ${BUCKET_HEADER_COLORS[entry.bucket] ?? 'var(--primary-500)'}`,
          background: 'transparent',
          color: BUCKET_HEADER_COLORS[entry.bucket] ?? 'var(--primary-500)',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'background 150ms ease',
        }}
      >
        Détail par sous-catégorie
        <ChevronRight size={14} strokeWidth={2.5} />
      </button>
    </div>
  )
}

// ─── BucketDetailModal ────────────────────────────────────────────────────────

function BucketDetailModal({
  bucket: _bucket, bucketLabel, headerColor, rows, loading, onClose,
}: {
  bucket:       string
  bucketLabel:  string
  headerColor:  string
  rows:         BucketCategoryBreakdownRow[] | null
  loading:      boolean
  onClose:      () => void
}) {
  // Lignes non-nulles, triées décroissant sur amount_2026 (ou 2025)
  const sorted = (rows ?? []).filter((r) => r.amount_2025 > 0 || r.amount_2026 > 0)

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10,10,30,0.55)',
          backdropFilter: 'blur(3px)',
          zIndex: 1000,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-5)',
          pointerEvents: 'none',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(480px, 100%)',
            background: 'var(--neutral-0)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.30)',
            overflow: 'hidden',
            pointerEvents: 'auto',
            maxHeight: 'min(88dvh, 640px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header coloré */}
          <div style={{
            background: headerColor,
            padding: 'var(--space-4) var(--space-5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            flexShrink: 0,
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#fff' }}>
                {bucketLabel}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                Dépenses YTD Jan – Avr · 2025 vs 2026
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: 'none',
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                width: 30, height: 30,
                borderRadius: 'var(--radius-full)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Sous-headers colonnes */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 80px 80px',
            padding: '8px var(--space-5)',
            background: 'var(--neutral-50)',
            borderBottom: '1px solid var(--neutral-150)',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sous-catégorie</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>2025</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: `${COLOR_2026}`, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>2026</span>
          </div>

          {/* Liste */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)', fontSize: 13 }}>
                Chargement…
              </div>
            ) : sorted.length === 0 ? (
              <div style={{ padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)', fontSize: 13 }}>
                Aucune dépense sur cette période
              </div>
            ) : (
              sorted.map((row, i) => {
                const iconKey = row.parent_category_name
                  ? `${row.parent_category_name}_${row.category_name}`
                  : row.category_name
                const displayName = row.category_name
                const isLast = i === sorted.length - 1

                return (
                  <div
                    key={`${row.parent_category_name}__${row.category_name}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 80px 80px',
                      alignItems: 'center',
                      padding: '10px var(--space-5)',
                      borderBottom: isLast ? 'none' : '1px solid var(--neutral-100)',
                      gap: 8,
                    }}
                  >
                    {/* Icône + nom */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <CategoryIcon iconKey={iconKey} size={22} style={{ flexShrink: 0 }} />
                      <span style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--neutral-800)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {displayName}
                      </span>
                    </div>

                    {/* 2025 */}
                    <span style={{
                      fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)',
                      color: row.amount_2025 > 0 ? 'var(--neutral-500)' : 'var(--neutral-300)',
                      textAlign: 'right',
                    }}>
                      {row.amount_2025 > 0 ? fmt(row.amount_2025) : '—'}
                    </span>

                    {/* 2026 */}
                    <span style={{
                      fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
                      color: row.amount_2026 > 0 ? 'var(--neutral-900)' : 'var(--neutral-300)',
                      textAlign: 'right',
                    }}>
                      {row.amount_2026 > 0 ? fmt(row.amount_2026) : '—'}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </>
  )
}
