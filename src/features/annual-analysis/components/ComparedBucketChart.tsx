import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip } from 'recharts'
import { ChevronRight, X } from 'lucide-react'
import { formatCurrencyRounded as fmt } from '@/lib/utils'
import { BUCKET_LABELS, PILOTAGE_BUCKET_ORDER, CHART_TOOLTIP_STYLE } from './_constants'
import type { ComparedBucketMetric } from '@/features/annual-analysis/types.compared'
import {
  getComparedBucketCategoryBreakdown,
  type BucketCategoryBreakdownRow,
} from '@/features/annual-analysis/api/getComparedBucketCategoryBreakdown'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { useCategories } from '@/hooks/useCategories'

// ─── Types ────────────────────────────────────────────────────────────────────
type ChartEntry = {
  name:   string
  bucket: string
  v2025:  number
  v2026:  number
}

// ─── Couleurs unifiées ────────────────────────────────────────────────────────
const COLOR_2025 = 'rgba(255,171,46,0.38)'
const COLOR_2026 = '#B8860B'

// ─── Couleurs d'accent par bloc ───────────────────────────────────────────────
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

type Props = { metrics: ComparedBucketMetric[] }

function formatVariation(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${Math.round(value)}%`
}

function formatTightEuro(value: number): string {
  return fmt(value).replace(/[\u00A0\u202F ]+€$/u, '€')
}

// ─── Component principal ──────────────────────────────────────────────────────

export function ComparedBucketChart({ metrics }: Props) {
  const [clickedBucket, setClickedBucket] = useState<string | null>(null)
  const [clickedCoord,  setClickedCoord]  = useState<{ x: number; y: number } | null>(null)
  const [detailData,    setDetailData]    = useState<BucketCategoryBreakdownRow[] | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showDetail,    setShowDetail]    = useState(false)

  const data: ChartEntry[] = [...PILOTAGE_BUCKET_ORDER].map((key) => {
    const m = metrics.find((m) => m.bucket === key)
    return {
      name:   BUCKET_SHORT[key] ?? (BUCKET_LABELS[key] ?? key),
      bucket: key,
      v2025:  Math.round(m?.actual_2025 ?? 0),
      v2026:  Math.round(m?.actual_2026 ?? 0),
    }
  })

  const clickedEntry  = data.find((d) => d.bucket === clickedBucket) ?? null
  const clickedMetric = metrics.find((m) => m.bucket === clickedBucket) ?? null

  // ── Clic sur une barre : mémorise le bucket + la coordonnée SVG ───────────
  const handleChartClick = (chartData: {
    activePayload?: Array<{ payload: ChartEntry }>
    activeCoordinate?: { x: number; y: number }
  } | null) => {
    const bucket = chartData?.activePayload?.[0]?.payload?.bucket
    const coord  = chartData?.activeCoordinate
    if (!bucket) return

    if (bucket === clickedBucket) {
      setClickedBucket(null)
      setClickedCoord(null)
    } else {
      setClickedBucket(bucket)
      setClickedCoord(coord ? { x: coord.x, y: coord.y } : null)
      setShowDetail(false)
      setDetailData(null)
    }
  }

  // ── Ouvrir la modale de détail sous-catégories ────────────────────────────
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

  const closeAll = () => {
    setClickedBucket(null)
    setClickedCoord(null)
    setShowDetail(false)
    setDetailData(null)
  }

  const closeDetail = () => {
    setShowDetail(false)
    setDetailData(null)
    setClickedBucket(null)
    setClickedCoord(null)
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

        {/* Wrapper relatif : permet de positionner le tooltip custom en absolu */}
        <div style={{ position: 'relative' }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={data}
              barCategoryGap="22%"
              barGap={3}
              margin={{ top: 4, right: 4, left: -22, bottom: 0 }}
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
              {/* Tooltip hover masqué quand un bloc est sélectionné */}
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value: number, name: string) => [formatTightEuro(value), name === 'v2025' ? '2025' : '2026']}
                labelStyle={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}
                itemStyle={{ fontSize: 11 }}
                wrapperStyle={{ opacity: clickedBucket ? 0 : 1, pointerEvents: 'none', transition: 'opacity 100ms' }}
              />
              <Bar dataKey="v2025" name="v2025" fill={COLOR_2025} radius={[3, 3, 0, 0]} />
              <Bar dataKey="v2026" name="v2026" fill={COLOR_2026} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Tooltip custom sticky — positionné sur la barre cliquée */}
          {clickedEntry && clickedCoord && (
            <ClickedTooltip
              entry={clickedEntry}
              metric={clickedMetric}
              coord={clickedCoord}
              onClose={closeAll}
              onDetail={openDetail}
            />
          )}
        </div>

        {/* Légende */}
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
      </div>

      {/* Modale détail sous-catégories */}
      {showDetail && clickedBucket && (
        <BucketDetailModal
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

// ─── ClickedTooltip — tooltip sticky positionné en absolu sur la barre ────────

function ClickedTooltip({
  entry, metric, coord, onClose, onDetail,
}: {
  entry:    ChartEntry
  metric:   ComparedBucketMetric | null
  coord:    { x: number; y: number }
  onClose:  () => void
  onDetail: () => void
}) {
  const delta    = metric ? metric.actual_2026 - metric.actual_2025 : entry.v2026 - entry.v2025
  const deltaPct = metric?.delta_pct ?? (entry.v2025 > 0 ? ((entry.v2026 - entry.v2025) / entry.v2025) * 100 : null)
  const isUp     = delta > 0

  const deltaColor = delta === 0 ? 'var(--neutral-400)' : isUp ? '#C0392B' : '#1A7A4A'
  const deltaBg    = delta === 0 ? 'var(--neutral-100)' : isUp ? 'rgba(252,90,90,0.10)' : 'rgba(46,212,122,0.12)'

  // Affiche au-dessus si la barre est assez haute, sinon en dessous
  const showAbove = coord.y >= 110

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position:    'absolute',
        left:        coord.x,
        top:         coord.y,
        transform:   showAbove
          ? 'translate(-50%, calc(-100% - 8px))'
          : 'translate(-50%, 8px)',
        background:  'var(--neutral-0)',
        border:      '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-lg)',
        boxShadow:   '0 4px 20px rgba(0,0,0,0.13)',
        padding:     '10px 12px',
        minWidth:    158,
        zIndex:      20,
        pointerEvents: 'auto',
      }}
    >
      {/* Bouton fermer */}
      <button
        type="button"
        onClick={onClose}
        style={{
          position: 'absolute', top: 6, right: 6,
          border: 'none', background: 'transparent',
          color: 'var(--neutral-400)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', padding: 0,
        }}
        aria-label="Fermer"
      >
        <X size={11} />
      </button>

      {/* Nom du bloc */}
      <p style={{
        margin: '0 0 8px',
        fontSize: 11, fontWeight: 700,
        color: 'var(--neutral-800)',
        paddingRight: 14,
        lineHeight: 1.3,
      }}>
        {BUCKET_LABELS[entry.bucket] ?? entry.name}
      </p>

      {/* Ligne 2025 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-400)' }}>2025</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--neutral-500)' }}>
          {entry.v2025 > 0 ? formatTightEuro(entry.v2025) : '—'}
        </span>
      </div>

      {/* Ligne 2026 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: COLOR_2026 }}>2026</span>
        <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--neutral-900)' }}>
          {entry.v2026 > 0 ? formatTightEuro(entry.v2026) : '—'}
        </span>
      </div>

      {/* Ligne Var. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        marginBottom: 8,
        paddingTop: 5,
        borderTop: '1px solid var(--neutral-100)',
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-400)', flexShrink: 0 }}>Var.</span>
        <span style={{
          fontSize: 9, fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: deltaColor,
          background: deltaBg,
          borderRadius: 'var(--radius-full)',
          padding: '2px 6px',
          flexShrink: 0,
        }}>
          {delta === 0 ? '—' : isUp ? '▲' : '▼'}{' '}
          {deltaPct != null ? `${Math.abs(deltaPct).toFixed(1)}%` : ''}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          color: deltaColor,
        }}>
          {delta !== 0 ? `${delta > 0 ? '+' : ''}${formatTightEuro(delta)}` : ''}
        </span>
      </div>

      {/* Bouton Détails — bordure bleue */}
      <button
        type="button"
        onClick={onDetail}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          padding: '5px 8px',
          borderRadius: 'var(--radius-sm)',
          border: '1.5px solid #5B57F5',
          background: 'transparent',
          color: '#5B57F5',
          fontSize: 10,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Détails
        <ChevronRight size={11} strokeWidth={2.5} />
      </button>
    </div>
  )
}

// ─── BucketDetailModal ────────────────────────────────────────────────────────

function BucketDetailModal({
  bucketLabel, headerColor, rows, loading, onClose,
}: {
  bucketLabel:  string
  headerColor:  string
  rows:         BucketCategoryBreakdownRow[] | null
  loading:      boolean
  onClose:      () => void
}) {
  const { data: categories = [] } = useCategories('expense')
  const iconByCategoryId = useMemo(
    () => new Map(categories.map((category) => [category.id, category.icon_key])),
    [categories],
  )
  const sorted = (rows ?? []).filter((r) => r.amount_2025 > 0 || r.amount_2026 > 0)

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10,10,30,0.55)',
          backdropFilter: 'blur(3px)',
          zIndex: 1000,
        }}
      />
      <div style={{
        position: 'fixed', inset: 0,
        zIndex: 1001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-5)',
        pointerEvents: 'none',
      }}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(520px, 100%)',
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
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#fff' }}>{bucketLabel}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                Dépenses YTD Jan – Avr · 2025 vs 2026
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff',
                width: 30, height: 30, borderRadius: 'var(--radius-full)',
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
            display: 'grid', gridTemplateColumns: 'minmax(0,1fr) max-content max-content max-content',
            padding: '8px var(--space-5)',
            background: 'var(--neutral-50)',
            borderBottom: '1px solid var(--neutral-150)',
            columnGap: 2,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sous-catégorie</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>2025</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Var.</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: COLOR_2026, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>2026</span>
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
                const directIconKey = row.category_id ? iconByCategoryId.get(row.category_id) ?? null : null
                const inferredIconKey = row.parent_category_name ? `${row.parent_category_name}_${row.category_name}` : row.category_name
                const iconKey = directIconKey ?? inferredIconKey
                const isLast    = i === sorted.length - 1
                const hasBothYears = row.amount_2025 > 0 && row.amount_2026 > 0
                const variationPct = hasBothYears && row.amount_2025 !== 0
                  ? ((row.amount_2026 - row.amount_2025) / row.amount_2025) * 100
                  : null
                const variationColor = variationPct != null && variationPct < 0 ? '#1A7A4A' : '#C0392B'
                return (
                  <div
                    key={`${row.category_id ?? ''}__${row.parent_category_name}__${row.category_name}`}
                    style={{
                      display: 'grid', gridTemplateColumns: 'minmax(0,1fr) max-content max-content max-content',
                      alignItems: 'center',
                      padding: '10px var(--space-5)',
                      borderBottom: isLast ? 'none' : '1px solid var(--neutral-100)',
                      columnGap: 2,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <CategoryIcon iconKey={iconKey} size={22} style={{ flexShrink: 0 }} />
                      <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--neutral-800)',
                        lineHeight: 1.2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {row.category_name}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', color: row.amount_2025 > 0 ? 'var(--neutral-500)' : 'var(--neutral-300)', textAlign: 'right', justifySelf: 'end' }}>
                      {row.amount_2025 > 0 ? formatTightEuro(row.amount_2025) : '—'}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        color: variationPct == null ? 'var(--neutral-300)' : variationColor,
                        textAlign: 'right',
                        justifySelf: 'end',
                        lineHeight: 1.1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {variationPct == null ? '—' : formatVariation(variationPct)}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: row.amount_2026 > 0 ? 'var(--neutral-900)' : 'var(--neutral-300)', textAlign: 'right', justifySelf: 'end' }}>
                      {row.amount_2026 > 0 ? formatTightEuro(row.amount_2026) : '—'}
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
