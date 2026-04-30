import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { StatsReferenceSnapshot } from '@/features/stats/types'
import { formatCurrency } from '@/features/stats/utils/statsReferenceSelectors'

type StatsMonthlyEvolutionCardProps = {
  rows: StatsReferenceSnapshot['monthlyEvolution2026']
}

const chartTooltipStyle = {
  background: '#fff',
  border: 'none',
  borderRadius: 12,
  boxShadow: '0 8px 20px rgba(28,28,58,0.14)',
  padding: '8px 10px',
  fontSize: 12,
}

export function StatsMonthlyEvolutionCard({ rows }: StatsMonthlyEvolutionCardProps) {
  const chartData = rows.map((row) => ({
    label: `${String(row.periodMonth).padStart(2, '0')}/26`,
    income: row.incomeTotal,
    fixed: row.fixedExpenseTotal,
    variable: row.variableExpenseTotal,
    savings: row.savingsCapacityObserved,
  }))

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--neutral-150)', padding: 'var(--space-4)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)' }}>Évolution mensuelle 2026</h2>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
          Revenus, dépenses fixes, dépenses variables et capacité d’épargne observée.
        </p>

        {chartData.length === 0 ? (
          <p style={{ margin: 'var(--space-4) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-400)' }}>
            Aucune donnée mensuelle disponible pour 2026.
          </p>
        ) : (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECECF4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8F8FA8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8F8FA8' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => formatCurrency(value)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="fixed" name="Fixe" fill="#A4A4BF" radius={[6, 6, 0, 0]} barSize={16} />
                <Bar dataKey="variable" name="Variable" fill="#5B57F5" radius={[6, 6, 0, 0]} barSize={16} />
                <Line type="monotone" dataKey="income" name="Revenus" stroke="#2ED47A" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="savings" name="Épargne" stroke="#FFAB2E" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  )
}
