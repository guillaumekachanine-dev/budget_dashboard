import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useSavingsEvolutionFiveYears } from '@/features/savings/hooks/useSavingsEvolutionFiveYears'
import { EmptyState, SkeletonCard, StatsSection } from '@/features/stats/components/ui'
import type { SavingsEvolutionFiveYearsSeries } from '@/features/savings/types'

const EURO_COMPACT = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const EURO_ROUNDED = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

type TooltipPayloadItem = {
  color?: string
  name?: string
  dataKey?: string
  value?: number | string
}

type EvolutionTooltipProps = {
  active?: boolean
  label?: string | number
  payload?: TooltipPayloadItem[]
  seriesByKey: Map<string, SavingsEvolutionFiveYearsSeries>
}

function EvolutionTooltip({ active, label, payload, seriesByKey }: EvolutionTooltipProps) {
  if (!active || !payload?.length) return null

  const lines = payload
    .map((item) => {
      const key = typeof item.dataKey === 'string' ? item.dataKey : ''
      const series = seriesByKey.get(key)
      const value = Number(item.value ?? 0)
      if (!series || !Number.isFinite(value)) return null

      return {
        key: series.key,
        label: series.label,
        color: series.color,
        value,
      }
    })
    .filter((item): item is { key: string; label: string; color: string; value: number } => item != null)

  if (lines.length === 0) return null

  return (
    <div
      style={{
        background: 'var(--neutral-0)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        padding: '10px 12px',
        minWidth: 188,
      }}
    >
      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--neutral-800)' }}>
        {label}
      </p>

      <div style={{ display: 'grid', gap: 6 }}>
        {lines.map((line) => (
          <div key={line.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: line.color, flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: 10, color: 'var(--neutral-700)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {line.label}
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {EURO_ROUNDED.format(line.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SavingsEvolutionFiveYearsChart() {
  const { data, isLoading, error } = useSavingsEvolutionFiveYears()

  if (isLoading) {
    return (
      <StatsSection>
        <SkeletonCard heightClass="h-72" lines={2} />
      </StatsSection>
    )
  }

  if (error) {
    return (
      <StatsSection>
        <EmptyState message="Impossible de charger l’évolution de l’épargne." />
      </StatsSection>
    )
  }

  const rows = data?.rows ?? []
  const series = data?.series ?? []

  if (rows.length === 0 || series.length === 0) {
    return (
      <StatsSection>
        <EmptyState message="Aucune donnée disponible sur les 5 dernières années." />
      </StatsSection>
    )
  }

  const seriesByKey = new Map(series.map((entry) => [entry.key, entry]))

  return (
    <StatsSection>
      <div
        style={{
          border: '1px solid var(--neutral-150)',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--neutral-0)',
          boxShadow: 'var(--shadow-card)',
          padding: 'var(--space-4)',
          display: 'grid',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)' }}>
            Evolution de l'épargne (5yrs)
          </h3>

          {data?.isFallback ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--neutral-600)',
                background: 'var(--neutral-100)',
                borderRadius: 'var(--radius-full)',
                padding: '2px 8px',
                whiteSpace: 'nowrap',
              }}
            >
              Données simulées
            </span>
          ) : null}
        </div>

        <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-500)' }}>
          Solde de chaque compte d’épargne/placement, clôture annuelle sur 5 ans.
        </p>

        <div style={{ marginTop: 'var(--space-1)' }}>
          <ResponsiveContainer width="100%" height={286}>
            <LineChart data={rows} margin={{ top: 6, right: 10, left: 0, bottom: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-150)" vertical={false} />
              <XAxis
                dataKey="year"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--neutral-500)' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={56}
                tick={{ fontSize: 11, fill: 'var(--neutral-500)' }}
                tickFormatter={(value: number) => EURO_COMPACT.format(value)}
              />
              <Tooltip content={<EvolutionTooltip seriesByKey={seriesByKey} />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ fontSize: 10, color: 'var(--neutral-600)', paddingBottom: 8 }}
              />
              {series.map((entry) => (
                <Line
                  key={entry.key}
                  type="monotone"
                  dataKey={entry.key}
                  name={entry.label}
                  stroke={entry.color}
                  strokeWidth={2.2}
                  dot={{ r: 2, strokeWidth: 0, fill: entry.color }}
                  activeDot={{ r: 4, strokeWidth: 0, fill: entry.color }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </StatsSection>
  )
}
