import { useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, RotateCw } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrencyRounded as _fmt } from '@/lib/utils'

/** Supprime l'espace insécable avant le signe € (uniquement pour l'affichage grand format) */
function fmtCompact(v: number) {
  return _fmt(v).replace(/[\u00A0\u202F\s]€/, '€')
}
const fmt = _fmt   // alias normal pour tooltip etc.
import type { ComparedFluxMetric, YtdFlowSummary } from '@/features/annual-analysis/types.compared'
import { CARD_BASE } from './_constants'

// ─── Types ────────────────────────────────────────────────────────────────────

type MetricKey = 'expense' | 'income' | 'savings' | 'net'

const METRICS: Array<{
  key:       MetricKey
  label:     string
  shortLabel: string
  color:     string
  fluxLabel: string   // maps to ComparedFluxMetric.label
  key2025:   string
  key2026:   string
}> = [
  { key: 'expense', label: 'Dépenses', shortLabel: 'Dépenses', color: '#FC5A5A', fluxLabel: 'Dépenses',       key2025: 'exp2025', key2026: 'exp2026' },
  { key: 'income',  label: 'Revenus',  shortLabel: 'Revenus',  color: '#2ED47A', fluxLabel: 'Revenus',        key2025: 'inc2025', key2026: 'inc2026' },
  { key: 'savings', label: 'Épargne',  shortLabel: 'Épargne',  color: '#FFAB2E', fluxLabel: 'Épargne réalisée', key2025: 'sav2025', key2026: 'sav2026' },
  { key: 'net',     label: 'Cashflow', shortLabel: 'Cashflow', color: '#111111', fluxLabel: 'Cashflow net',   key2025: 'net2025', key2026: 'net2026' },
]

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr']
const MONTH_LABELS_FULL: Record<string, string> = {
  Jan: 'Janvier',
  Fév: 'Février',
  Mar: 'Mars',
  Avr: 'Avril',
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  flows2025:   YtdFlowSummary | null
  flows2026:   YtdFlowSummary | null
  fluxMetrics: ComparedFluxMetric[]
  minHeight?: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ComparedMonthlyChart({ flows2025, flows2026, fluxMetrics, minHeight }: Props) {
  const [focusedMetric, setFocusedMetric] = useState<MetricKey>('expense')
  const [enabledMetrics, setEnabledMetrics] = useState<MetricKey[]>(['expense', 'income', 'savings', 'net'])
  const [visibleYear, setVisibleYear] = useState<'2025' | '2026'>('2026')

  const focused = METRICS.find((m) => m.key === focusedMetric) ?? METRICS[0]
  const activeFlux = fluxMetrics.find((f) => f.label === focused.fluxLabel) ?? null
  const hasAnyMetricEnabled = enabledMetrics.length > 0

  // Build aligned 4-point chart data
  const chartData = [1, 2, 3, 4].map((month) => {
    const r25 = flows2025?.months.find((r) => r.period_month === month)
    const r26 = flows2026?.months.find((r) => r.period_month === month)
    return {
      label:   MONTH_LABELS[month - 1],
      exp2025: r25?.expense_total             ?? null,
      exp2026: r26?.expense_total             ?? null,
      inc2025: r25?.income_total              ?? null,
      inc2026: r26?.income_total              ?? null,
      sav2025: r25?.savings_realized_total ?? null,
      sav2026: r26?.savings_realized_total ?? null,
      net2025: r25 ? r25.income_total - r25.expense_total : null,
      net2026: r26 ? r26.income_total - r26.expense_total : null,
    }
  })

  const has2025 = (flows2025?.months?.length ?? 0) > 0
  const has2026 = (flows2026?.months?.length ?? 0) > 0
  const compactMode = minHeight != null
  const chartHeight = compactMode ? 176 : 200

  // Delta semantics
  const deltaEur   = activeFlux?.delta_eur ?? 0
  const deltaPct   = activeFlux?.delta_pct
  const positiveIs = activeFlux?.positive_is ?? 'down'
  const isGood     = positiveIs === 'up' ? deltaEur >= 0 : deltaEur <= 0
  const deltaColor = deltaEur === 0 ? 'var(--neutral-400)' : isGood ? '#1A7A4A' : '#C0392B'
  const deltaBg    = deltaEur === 0
    ? 'rgba(0,0,0,0.05)'
    : isGood
      ? 'rgba(46,212,122,0.12)'
      : 'rgba(252,90,90,0.10)'
  const arrow = deltaEur === 0 ? '—' : deltaEur > 0 ? '▲' : '▼'

  const renderMetricIcon = (key: MetricKey) => {
    if (key === 'expense') {
      return <ArrowUpCircle size={24} strokeWidth={2.2} color="#FC5A5A" />
    }
    if (key === 'income') {
      return <ArrowDownCircle size={24} strokeWidth={2.2} color="#2ED47A" />
    }
    if (key === 'savings') {
      return (
        <span style={{ fontSize: 11, fontWeight: 900, color: '#111111', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
          €
        </span>
      )
    }
    return <RotateCw size={13} strokeWidth={2.3} color="#FFFFFF" />
  }

  return (
    <div style={{ ...CARD_BASE, minHeight, padding: compactMode ? 'var(--space-4)' : CARD_BASE.padding }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-4)', display: 'grid', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{
              margin: 0,
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
              color: 'var(--neutral-700)',
            }}>
              Flux mensuels comparés
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 1 }}>
            {METRICS.map((m) => {
              const isEnabled = enabledMetrics.includes(m.key)
              const isFocused = m.key === focusedMetric
              const hasCircle = m.key === 'savings' || m.key === 'net'
              const background = m.key === 'savings'
                ? '#FFAB2E'
                : m.key === 'net'
                  ? '#111111'
                  : 'transparent'
              const borderColor = hasCircle && isEnabled
                ? m.key === 'savings'
                  ? '#FFAB2E'
                  : m.key === 'net'
                    ? '#111111'
                    : m.color
                : hasCircle
                  ? 'var(--neutral-200)'
                  : 'transparent'
              const iconOpacity = isEnabled ? 1 : 0.44

              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setFocusedMetric(m.key)
                    setEnabledMetrics((prev) => (
                      prev.includes(m.key)
                        ? prev.filter((key) => key !== m.key)
                        : [...prev, m.key]
                    ))
                  }}
                  aria-label={m.label}
                  title={m.label}
                  aria-pressed={isEnabled}
                  style={{
                    width: 28,
                    height: 28,
                    minWidth: 28,
                    minHeight: 28,
                    borderRadius: 'var(--radius-full)',
                    border: `1.5px solid ${borderColor}`,
                    background,
                    color: m.key === 'net' ? '#FFFFFF' : 'inherit',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: isFocused ? 'var(--shadow-card)' : 'none',
                    transform: isFocused ? 'translateY(-1px)' : 'none',
                    opacity: iconOpacity,
                    transition: 'all 140ms ease',
                    outline: 'none',
                    padding: 0,
                  }}
                >
                  {renderMetricIcon(m.key)}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button
              type="button"
              onClick={() => setVisibleYear('2025')}
              aria-pressed={visibleYear === '2025'}
              style={{
                border: 'none',
                background: 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: 0,
                cursor: 'pointer',
                opacity: visibleYear === '2025' ? 1 : 0.5,
              }}
            >
              <span style={{
                border: '1px solid var(--neutral-300)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 6px',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--neutral-700)',
                fontFamily: 'var(--font-mono)',
                background: visibleYear === '2025' ? 'var(--neutral-0)' : 'var(--neutral-100)',
              }}>
                2025
              </span>
              <span aria-hidden="true" style={{ width: 26, borderTop: `2px solid ${focused.color}` }} />
            </button>

            <button
              type="button"
              onClick={() => setVisibleYear('2026')}
              aria-pressed={visibleYear === '2026'}
              style={{
                border: 'none',
                background: 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: 0,
                cursor: 'pointer',
                opacity: visibleYear === '2026' ? 1 : 0.5,
              }}
            >
              <span style={{
                border: '1px solid var(--neutral-300)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 6px',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--neutral-700)',
                fontFamily: 'var(--font-mono)',
                background: visibleYear === '2026' ? 'var(--neutral-0)' : 'var(--neutral-100)',
              }}>
                2026
              </span>
              <span aria-hidden="true" style={{ width: 26, borderTop: `2px dashed ${focused.color}` }} />
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
          <defs>
            {METRICS.map((metric) => (
              <linearGradient key={`g25-${metric.key}`} id={`cmc-grad-25-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric.color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={metric.color} stopOpacity={0} />
              </linearGradient>
            ))}
            {METRICS.map((metric) => (
              <linearGradient key={`g26-${metric.key}`} id={`cmc-grad-26-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric.color} stopOpacity={0.1} />
                <stop offset="100%" stopColor={metric.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-100)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
          />
          <Tooltip
            trigger="click"
            content={
              <MonthlyFluxTooltip
                metricLabel={focused.label}
                accentColor={focused.color}
                valueKey2025={focused.key2025}
                valueKey2026={focused.key2026}
              />
            }
            cursor={{ stroke: 'var(--neutral-200)', strokeWidth: 1 }}
          />

          {METRICS.filter((metric) => enabledMetrics.includes(metric.key)).map((metric) => (
            <Area
              key={`y25-${metric.key}`}
              type="monotone"
              dataKey={metric.key2025}
              name={`${metric.shortLabel}-2025`}
              stroke={metric.color}
              strokeWidth={2}
              fill={`url(#cmc-grad-25-${metric.key})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: metric.color }}
              connectNulls
              hide={!has2025 || visibleYear !== '2025'}
            />
          ))}
          {METRICS.filter((metric) => enabledMetrics.includes(metric.key)).map((metric) => (
            <Area
              key={`y26-${metric.key}`}
              type="monotone"
              dataKey={metric.key2026}
              name={`${metric.shortLabel}-2026`}
              stroke={metric.color}
              strokeWidth={2}
              strokeDasharray="5 3"
              strokeOpacity={0.65}
              fill={`url(#cmc-grad-26-${metric.key})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: metric.color, fillOpacity: 0.65 }}
              connectNulls
              hide={!has2026 || visibleYear !== '2026'}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      {/* ── Active metric KPI — inline, no nested card ── */}
      {activeFlux != null && hasAnyMetricEnabled && (
        <div style={{
          marginTop: 'var(--space-4)',
        }}>
          {/* Top line: 2025 | flux name | 2026 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 2,
          }}>
            <p style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--neutral-400)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              textAlign: 'center',
            }}>
              2025
            </p>
            <p style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: focused.color,
              textAlign: 'center',
            }}>
              {focused.label}
            </p>
            <p style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--neutral-400)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              textAlign: 'center',
            }}>
              2026
            </p>
          </div>

          <div style={{
            borderTop: `1px solid color-mix(in oklab, ${focused.color} 20%, var(--neutral-100) 80%)`,
            marginBottom: 1,
          }} />

          {/* Amounts + delta below divider */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 6,
            marginTop: 5,
          }}>
            {/* 2025 */}
            <div style={{ textAlign: 'center' }}>
              <p style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: 'var(--neutral-600)',
                lineHeight: 1,
              }}>
                {fmtCompact(activeFlux.value_2025)}
              </p>
            </div>

            {/* Delta center */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 8px',
                minWidth: 74,
                height: 22,
                borderRadius: 'var(--radius-full)',
                background: deltaBg,
                fontSize: 10,
                fontWeight: 800,
                color: deltaColor,
                fontFamily: 'var(--font-mono)',
                lineHeight: 1,
              }}>
                <span style={{ width: 10, textAlign: 'center', display: 'inline-block' }}>{arrow}</span>
                <span>{deltaPct != null ? `${Math.round(Math.abs(deltaPct))}%` : '—'}</span>
              </span>
            </div>

            {/* 2026 */}
            <div style={{ textAlign: 'center' }}>
              <p style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: 'var(--neutral-600)',
                lineHeight: 1,
              }}>
                {fmtCompact(activeFlux.value_2026)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type MonthlyFluxTooltipProps = {
  active?: boolean
  payload?: Array<{ payload?: Record<string, number | string | null> }>
  label?: string
  metricLabel: string
  accentColor: string
  valueKey2025: string
  valueKey2026: string
}

function MonthlyFluxTooltip({
  active,
  payload,
  label,
  metricLabel,
  accentColor,
  valueKey2025,
  valueKey2026,
}: MonthlyFluxTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const row = payload[0]?.payload
  const raw2025 = row?.[valueKey2025]
  const raw2026 = row?.[valueKey2026]
  const v2025 = typeof raw2025 === 'number' ? raw2025 : null
  const v2026 = typeof raw2026 === 'number' ? raw2026 : null
  const delta = v2025 != null && v2026 != null ? v2026 - v2025 : null
  const deltaPct = v2025 != null && v2026 != null && v2025 !== 0
    ? ((v2026 - v2025) / v2025) * 100
    : null
  const isUp = (delta ?? 0) > 0
  const deltaColor = delta == null || delta === 0 ? 'var(--neutral-400)' : isUp ? '#C0392B' : '#1A7A4A'
  const deltaBg = delta == null || delta === 0 ? 'var(--neutral-100)' : isUp ? 'rgba(252,90,90,0.10)' : 'rgba(46,212,122,0.12)'
  const fullMonth = (label && MONTH_LABELS_FULL[label]) ? MONTH_LABELS_FULL[label] : (label ?? '')

  return (
    <div style={{
      background: 'var(--neutral-0)',
      border: '1px solid var(--neutral-200)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.13)',
      padding: '10px 12px',
      minWidth: 164,
      pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <p style={{
          margin: '0 0 8px',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--neutral-800)',
          lineHeight: 1.3,
        }}>
          {fullMonth} · {metricLabel}
        </p>
        <span style={{ fontSize: 11, color: 'var(--neutral-400)', lineHeight: 1 }}>×</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-400)' }}>2025</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--neutral-500)' }}>
          {v2025 != null ? fmt(v2025) : '—'}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: accentColor }}>2026</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-900)' }}>
          {v2026 != null ? fmt(v2026) : '—'}
        </span>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 5,
        borderTop: '1px solid var(--neutral-100)',
        gap: 8,
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-400)', flexShrink: 0 }}>Var.</span>
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: deltaColor,
          background: deltaBg,
          borderRadius: 'var(--radius-full)',
          padding: '2px 6px',
          marginLeft: 'auto',
          flexShrink: 0,
        }}>
          {delta == null || delta === 0 ? '—' : isUp ? '▲' : '▼'} {deltaPct != null ? `${Math.abs(deltaPct).toFixed(1)}%` : ''}
        </span>
      </div>
    </div>
  )
}
