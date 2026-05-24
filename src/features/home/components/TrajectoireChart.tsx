import { useState, useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useDailyCashflowForecast } from '@/features/home/hooks/useDailyCashflowForecast'
import type { DailyCashflowRow } from '@/features/home/hooks/useDailyCashflowForecast'

const MONTHS: { value: number; label: string }[] = [
  { value: 6, label: 'Juin' },
  { value: 7, label: 'Juil.' },
  { value: 8, label: 'Août' },
  { value: 9, label: 'Sept.' },
  { value: 10, label: 'Oct.' },
  { value: 11, label: 'Nov.' },
  { value: 12, label: 'Déc.' },
]

const FORECAST_YEAR = 2026

const FORMAT_CURRENCY = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatCurrency(v: number) {
  return FORMAT_CURRENCY.format(v)
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: number
}) {
  if (!active || !payload?.length) return null
  const cashflow = payload.find((p) => p.name === 'cashflow')
  const expenses = payload.find((p) => p.name === 'expenses')
  return (
    <div
      style={{
        background: 'var(--neutral-0)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-md)',
        padding: '6px 10px',
        boxShadow: 'var(--shadow-card)',
        fontSize: 11,
        display: 'grid',
        gap: 3,
        minWidth: 130,
      }}
    >
      <p style={{ margin: 0, fontWeight: 700, color: 'var(--neutral-600)', fontSize: 10 }}>
        {`Jour ${label}`}
      </p>
      {cashflow && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ color: 'var(--neutral-600)' }}>Cashflow</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: cashflow.value >= 0 ? 'var(--color-success)' : 'var(--color-error)',
            }}
          >
            {formatCurrency(cashflow.value)}
          </span>
        </div>
      )}
      {expenses && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ color: 'var(--neutral-600)' }}>Dépenses cum.</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: 'var(--neutral-700)',
            }}
          >
            {formatCurrency(expenses.value)}
          </span>
        </div>
      )}
    </div>
  )
}

function getEndCashflow(rows: DailyCashflowRow[]): number | null {
  if (!rows.length) return null
  return rows[rows.length - 1].cumulative_cashflow
}

export function TrajectoireChart() {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const defaultMonth = currentMonth >= 6 && currentMonth <= 12 ? currentMonth : 6
  const [selectedMonth, setSelectedMonth] = useState<number>(defaultMonth)

  const { data: rows = [], isLoading } = useDailyCashflowForecast(FORECAST_YEAR, selectedMonth)

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        dom: r.day_of_month,
        cashflow: r.cumulative_cashflow,
        expenses: r.cumulative_expenses,
        income: r.daily_income > 0 ? r.day_of_month : null,
      })),
    [rows],
  )

  const endCashflow = useMemo(() => getEndCashflow(rows), [rows])

  const yMin = useMemo(() => {
    if (!chartData.length) return -1000
    const min = Math.min(...chartData.map((d) => d.cashflow))
    return Math.floor(Math.min(min, 0) * 1.15 / 100) * 100
  }, [chartData])

  const yMax = useMemo(() => {
    if (!chartData.length) return 4000
    const max = Math.max(...chartData.map((d) => d.cashflow))
    return Math.ceil(max * 1.1 / 100) * 100
  }, [chartData])

  const incomeDay = useMemo(() => {
    const r = rows.find((row) => row.daily_income > 0)
    return r?.day_of_month ?? null
  }, [rows])

  const isPositive = endCashflow !== null && endCashflow >= 0
  const cashflowColor = isPositive ? 'var(--color-success)' : 'var(--color-error)'
  const areaStroke = '#5B57F5'
  const areaFill = 'url(#cashflowGradient)'

  return (
    <div
      style={{
        background: 'var(--neutral-0)',
        border: '1px solid var(--neutral-150)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        padding: 'var(--space-4)',
        display: 'grid',
        gap: 'var(--space-3)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <div style={{ display: 'grid', gap: 2 }}>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--neutral-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Trajectoire
            </p>
            {endCashflow !== null && !isLoading ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: cashflowColor,
                  lineHeight: 1.1,
                }}
              >
                {formatCurrency(endCashflow)}
              </p>
            ) : (
              <div
                style={{
                  width: 80,
                  height: 22,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--neutral-100)',
                }}
              />
            )}
            <p style={{ margin: 0, fontSize: 10, color: 'var(--neutral-500)' }}>
              cashflow fin de mois
            </p>
          </div>
        </div>

        {/* Month chips — single scrollable row */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 2,
          }}
        >
          {MONTHS.map((m) => {
            const active = m.value === selectedMonth
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setSelectedMonth(m.value)}
                style={{
                  flexShrink: 0,
                  border: `1.5px solid ${active ? 'var(--primary-400)' : 'var(--neutral-200)'}`,
                  background: active
                    ? 'color-mix(in oklab, var(--primary-500) 10%, var(--neutral-0) 90%)'
                    : 'var(--neutral-50)',
                  borderRadius: 'var(--radius-full)',
                  padding: '3px 10px',
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--primary-600)' : 'var(--neutral-600)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 120ms ease',
                }}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 168, marginLeft: -8, marginRight: -4 }}>
        {isLoading ? (
          <div
            style={{
              height: '100%',
              background: 'var(--neutral-50)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-400)' }}>Chargement…</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cashflowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5B57F5" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#5B57F5" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--neutral-150)"
                vertical={false}
              />

              <XAxis
                dataKey="dom"
                tick={{ fontSize: 9, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={false}
                interval={4}
                tickFormatter={(v: number) => String(v)}
              />

              <YAxis
                domain={[yMin, yMax]}
                tick={{ fontSize: 9, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v: number) => {
                  if (v === 0) return '0'
                  const abs = Math.abs(v)
                  const sign = v < 0 ? '-' : ''
                  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k€`
                  return `${sign}${Math.round(abs)}€`
                }}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Zero reference */}
              <ReferenceLine
                y={0}
                stroke="var(--neutral-300)"
                strokeDasharray="4 3"
                strokeWidth={1}
              />

              {/* Income day marker */}
              {incomeDay !== null && (
                <ReferenceLine
                  x={incomeDay}
                  stroke="var(--color-success)"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{
                    value: `J${incomeDay}`,
                    position: 'insideTopRight',
                    fontSize: 8,
                    fill: 'var(--color-success)',
                    fontWeight: 700,
                  }}
                />
              )}

              {/* Cumulative expenses (secondary, dashed) */}
              <Area
                type="monotone"
                dataKey="expenses"
                name="expenses"
                stroke="var(--neutral-300)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="none"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />

              {/* Cashflow main line */}
              <Area
                type="monotone"
                dataKey="cashflow"
                name="cashflow"
                stroke={areaStroke}
                strokeWidth={2}
                fill={areaFill}
                dot={false}
                activeDot={{ r: 4, fill: areaStroke, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div
            style={{
              width: 16,
              height: 2,
              borderRadius: 1,
              background: '#5B57F5',
            }}
          />
          <span style={{ fontSize: 9, color: 'var(--neutral-500)', fontWeight: 500 }}>Cashflow net</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div
            style={{
              width: 16,
              height: 0,
              border: '1px dashed var(--neutral-300)',
            }}
          />
          <span style={{ fontSize: 9, color: 'var(--neutral-500)', fontWeight: 500 }}>Dépenses cum.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div
            style={{
              width: 10,
              height: 0,
              border: '1px dashed var(--color-success)',
            }}
          />
          <span style={{ fontSize: 9, color: 'var(--neutral-500)', fontWeight: 500 }}>Revenu</span>
        </div>
      </div>
    </div>
  )
}
