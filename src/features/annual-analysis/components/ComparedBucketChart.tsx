import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { formatCurrencyRounded as fmt } from '@/lib/utils'
import { BUCKET_LABELS, BUCKET_COLORS, PILOTAGE_BUCKET_ORDER, CHART_TOOLTIP_STYLE } from './_constants'
import type { ComparedBucketMetric } from '@/features/annual-analysis/types.compared'

type Props = {
  metrics: ComparedBucketMetric[]
}

const CHART_H = 200

export function ComparedBucketChart({ metrics }: Props) {
  const ordered = [...PILOTAGE_BUCKET_ORDER]
    .map((key) => metrics.find((m) => m.bucket === key))
    .filter(Boolean) as ComparedBucketMetric[]

  if (ordered.length === 0) return null

  const data = ordered.map((m) => ({
    name:    BUCKET_LABELS[m.bucket] ?? m.bucket,
    bucket:  m.bucket,
    v2025:   Math.round(m.actual_2025),
    v2026:   Math.round(m.actual_2026),
    target:  Math.round(m.target_2026),
    delta:   Math.round(m.delta_eur),
    ratio:   m.consumption_ratio_2026,
  }))

  return (
    <div style={{
      background: 'var(--neutral-0)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-card)',
      border: '1px solid var(--neutral-150)',
      padding: 'var(--space-5)',
    }}>
      <p style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-600)' }}>
        Dépenses par bloc
      </p>

      <ResponsiveContainer width="100%" height={CHART_H}>
        <BarChart data={data} barCategoryGap="28%" barGap={3} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9, fill: 'var(--neutral-500)', fontWeight: 600 }}
            axisLine={false} tickLine={false}
            interval={0}
            width={60}
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'var(--neutral-400)' }}
            axisLine={false} tickLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value: number, name: string) => [
              fmt(value),
              name === 'v2025' ? '2025' : name === 'v2026' ? '2026' : 'Budget',
            ]}
            labelStyle={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}
            itemStyle={{ fontSize: 11 }}
          />

          <Bar dataKey="v2025" name="v2025" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.bucket} fill={BUCKET_COLORS[entry.bucket] ?? '#ccc'} opacity={0.4} />
            ))}
          </Bar>

          <Bar dataKey="v2026" name="v2026" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.bucket} fill={BUCKET_COLORS[entry.bucket] ?? '#ccc'} opacity={1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Légende */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-3)', justifyContent: 'center' }}>
        {[{ label: '2025', opacity: 0.4 }, { label: '2026', opacity: 1 }].map(({ label, opacity }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: '#5B57F5', opacity }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-500)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
