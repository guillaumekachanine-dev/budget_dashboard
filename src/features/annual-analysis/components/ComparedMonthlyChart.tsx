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
  return _fmt(v).replace(/[  \s]€/, '€')
}
const fmt = _fmt   // alias normal pour tooltip etc.
import type { ComparedFluxMetric, YtdFlowSummary } from '@/features/annual-analysis/types.compared'
import { CHART_TOOLTIP_STYLE, CARD_BASE } from './_constants'

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
  { key: 'savings', label: 'Épargne',  shortLabel: 'Épargne',  color: '#FFAB2E', fluxLabel: 'Capacité épar.', key2025: 'sav2025', key2026: 'sav2026' },
  { key: 'net',     label: 'Cashflow', shortLabel: 'Cashflow', color: '#111111', fluxLabel: 'Cashflow net',   key2025: 'net2025', key2026: 'net2026' },
]

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr']

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  flows2025:   YtdFlowSummary | null
  flows2026:   YtdFlowSummary | null
  fluxMetrics: ComparedFluxMetric[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ComparedMonthlyChart({ flows2025, flows2026, fluxMetrics }: Props) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>('expense')

  const active     = METRICS.find((m) => m.key === activeMetric) ?? METRICS[0]
  const activeFlux = fluxMetrics.find((f) => f.label === active.fluxLabel) ?? null

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
      sav2025: r25?.savings_capacity_observed ?? null,
      sav2026: r26?.savings_capacity_observed ?? null,
      net2025: r25 ? r25.income_total - r25.expense_total : null,
      net2026: r26 ? r26.income_total - r26.expense_total : null,
    }
  })

  const gradId25 = `cmc-grad-25-${active.key}`
  const gradId26 = `cmc-grad-26-${active.key}`

  const has2025 = (flows2025?.months?.length ?? 0) > 0
  const has2026 = (flows2026?.months?.length ?? 0) > 0

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
  const deltaSign = deltaEur === 0 ? '—' : deltaEur > 0 ? '+' : '-'

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
    <div style={CARD_BASE}>
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
            <div style={{
              marginTop: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--neutral-500)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.04em',
              }}>
                2025
                <span
                  aria-hidden="true"
                  style={{
                    width: 26,
                    borderTop: `2px solid ${active.color}`,
                    opacity: 0.95,
                  }}
                />
              </span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--neutral-500)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.04em',
              }}>
                2026
                <span
                  aria-hidden="true"
                  style={{
                    width: 26,
                    borderTop: `2px dashed ${active.color}`,
                    opacity: 0.7,
                  }}
                />
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 1 }}>
            {METRICS.map((m) => {
              const isActive = m.key === activeMetric
              const hasCircle = m.key === 'savings' || m.key === 'net'
              const background = m.key === 'savings'
                ? '#FFAB2E'
                : m.key === 'net'
                  ? '#111111'
                  : 'transparent'
              const borderColor = hasCircle && isActive
                ? m.key === 'savings'
                  ? '#FFAB2E'
                  : m.key === 'net'
                    ? '#111111'
                    : m.color
                : hasCircle
                  ? 'var(--neutral-200)'
                  : 'transparent'
              const iconOpacity = isActive ? 1 : 0.82

              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setActiveMetric(m.key)}
                  aria-label={m.label}
                  title={m.label}
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
                    boxShadow: hasCircle && isActive ? 'var(--shadow-card)' : 'none',
                    transform: isActive ? 'translateY(-1px)' : 'none',
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
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id={gradId25} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={active.color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={active.color} stopOpacity={0}    />
            </linearGradient>
            <linearGradient id={gradId26} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={active.color} stopOpacity={0.10} />
              <stop offset="100%" stopColor={active.color} stopOpacity={0}    />
            </linearGradient>
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
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value: number, name: string) => [fmt(value), name === '2025' ? '2025' : '2026']}
            cursor={{ stroke: 'var(--neutral-200)', strokeWidth: 1 }}
          />

          {has2025 && (
            <Area
              type="monotone"
              dataKey={active.key2025}
              name="2025"
              stroke={active.color}
              strokeWidth={2}
              fill={`url(#${gradId25})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: active.color }}
              connectNulls
            />
          )}
          {has2026 && (
            <Area
              type="monotone"
              dataKey={active.key2026}
              name="2026"
              stroke={active.color}
              strokeWidth={2}
              strokeDasharray="5 3"
              strokeOpacity={0.65}
              fill={`url(#${gradId26})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: active.color, fillOpacity: 0.65 }}
              connectNulls
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      {/* ── Active metric KPI — inline, no nested card ── */}
      {activeFlux != null && (
        <div style={{
          marginTop: 'var(--space-2)',
          paddingTop: 'var(--space-2)',
          borderTop: `1px solid color-mix(in oklab, ${active.color} 20%, var(--neutral-100) 80%)`,
        }}>
          {/* Metric name */}
          <p style={{
            margin: '0 0 var(--space-2)',
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.10em',
            color: active.color,
            textAlign: 'center',
          }}>
            {active.label}
          </p>

          {/* 2025 | delta | 2026 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}>
            {/* 2025 */}
            <div style={{ textAlign: 'center', transform: 'translateY(-4px)' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                2025
              </p>
              <p style={{
                margin: 0,
                fontSize: 17,
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
                width: 104,
                height: 24,
                borderRadius: 'var(--radius-full)',
                background: deltaBg,
                fontSize: 11,
                fontWeight: 800,
                color: deltaColor,
                fontFamily: 'var(--font-mono)',
                lineHeight: 1,
              }}>
                <span style={{ width: 12, textAlign: 'center', display: 'inline-block' }}>{arrow}</span>
                <span>{deltaPct != null ? `${Math.abs(deltaPct).toFixed(1)}%` : '—'}</span>
              </span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 104,
                height: 24,
                borderRadius: 'var(--radius-full)',
                background: deltaBg,
                fontSize: 11,
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: deltaColor,
                lineHeight: 1,
              }}>
                <span style={{ width: 12, textAlign: 'center', display: 'inline-block' }}>{deltaSign}</span>
                <span>{fmtCompact(Math.abs(deltaEur))}</span>
              </span>
            </div>

            {/* 2026 */}
            <div style={{ textAlign: 'center', transform: 'translateY(-4px)' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                2026
              </p>
              <p style={{
                margin: 0,
                fontSize: 17,
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
