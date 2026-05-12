import { useState } from 'react'
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
  { key: 'net',     label: 'Cashflow', shortLabel: 'Cash',     color: '#5B57F5', fluxLabel: 'Cashflow net',   key2025: 'net2025', key2026: 'net2026' },
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

  return (
    <div style={CARD_BASE}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <p style={{
          margin: 0,
          fontSize: 'var(--font-size-sm)',
          fontWeight: 700,
          color: 'var(--neutral-700)',
        }}>
          Flux mensuels comparés
        </p>
        <p style={{
          margin: '2px 0 0',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--neutral-400)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.04em',
        }}>
          2025 vs 2026
        </p>
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

      {/* Year legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 'var(--space-4)',
        marginTop: 'var(--space-2)',
      }}>
        {([{ label: '2025', dashed: false }, { label: '2026', dashed: true }] as const).map(({ label, dashed }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width={22} height={8}>
              <line
                x1="0" y1="4" x2="22" y2="4"
                stroke={active.color}
                strokeWidth={2}
                strokeDasharray={dashed ? '5 3' : undefined}
                strokeOpacity={dashed ? 0.65 : 1}
              />
            </svg>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Metric toggles — single row ── */}
      <div style={{
        display: 'flex',
        gap: 6,
        justifyContent: 'center',
        marginTop: 'var(--space-4)',
      }}>
        {METRICS.map((m) => {
          const isActive = m.key === activeMetric
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setActiveMetric(m.key)}
              style={{
                flex: '1 1 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '5px 6px',
                borderRadius: 'var(--radius-full)',
                border: `1.5px solid ${isActive ? m.color : 'var(--neutral-200)'}`,
                background: isActive
                  ? `color-mix(in oklab, ${m.color} 10%, var(--neutral-0) 90%)`
                  : 'var(--neutral-50)',
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: isActive ? 700 : 600,
                color: isActive ? m.color : 'var(--neutral-500)',
                transition: 'all 150ms ease',
                outline: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                border: `1.5px solid ${isActive ? m.color : 'var(--neutral-300)'}`,
                background: isActive ? m.color : 'transparent',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {isActive && (
                  <svg width="5" height="4" viewBox="0 0 5 4">
                    <polyline
                      points="0.5,2 2,3.5 4.5,0.5"
                      stroke="#fff"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              {m.shortLabel}
            </button>
          )
        })}
      </div>

      {/* ── Active metric KPI — inline, no nested card ── */}
      {activeFlux != null && (
        <div style={{
          marginTop: 'var(--space-4)',
          paddingTop: 'var(--space-4)',
          borderTop: `1px solid color-mix(in oklab, ${active.color} 20%, var(--neutral-100) 80%)`,
        }}>
          {/* Metric name */}
          <p style={{
            margin: '0 0 var(--space-3)',
            fontSize: 12,
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
            gap: 'var(--space-3)',
          }}>
            {/* 2025 */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                2025
              </p>
              <p style={{
                margin: 0,
                fontSize: 20,
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
                gap: 3,
                padding: '3px 9px',
                borderRadius: 'var(--radius-full)',
                background: deltaBg,
                fontSize: 11,
                fontWeight: 800,
                color: deltaColor,
                fontFamily: 'var(--font-mono)',
              }}>
                {arrow} {deltaPct != null ? `${Math.abs(deltaPct).toFixed(1)}%` : '—'}
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: deltaColor,
              }}>
                {deltaEur > 0 ? '+' : ''}{fmt(deltaEur)}
              </span>
            </div>

            {/* 2026 */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--primary-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                2026
              </p>
              <p style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: 'var(--neutral-900)',
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
