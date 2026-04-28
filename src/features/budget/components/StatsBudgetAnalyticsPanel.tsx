import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Line,
} from 'recharts'
import { useBudgetAnalytics } from '@/features/budget/hooks/useBudgetAnalytics'
import {
  computeDeltaPct,
  formatCurrency,
  formatDateTime,
  getBudgetInsights,
  getLatestMonthMetrics,
  getLatestMonthVariableBreakdown,
  getPreviousMonthMetrics,
  getTopVariableCategories,
} from '@/features/budget/utils/budgetAnalyticsSelectors'

interface StatsBudgetAnalyticsPanelProps {
  year?: number
}

type KpiCardProps = {
  label: string
  value: number
  deltaPct: number | null
}

function KpiCard({ label, value, deltaPct }: KpiCardProps) {
  const deltaText = deltaPct == null
    ? 'Pas assez d’historique'
    : `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}% vs mois précédent`
  const deltaColor = deltaPct == null
    ? 'var(--neutral-400)'
    : deltaPct > 0
      ? 'var(--color-negative)'
      : deltaPct < 0
        ? 'var(--color-positive)'
        : 'var(--color-warning)'

  return (
    <div style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-card)', padding: '14px 14px 12px' }}>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--neutral-900)' }}>
        {formatCurrency(value)}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: deltaColor, fontWeight: 600 }}>{deltaText}</p>
    </div>
  )
}

const chartTooltipStyle = {
  background: '#fff',
  border: 'none',
  borderRadius: 12,
  boxShadow: '0 8px 20px rgba(28,28,58,0.14)',
  padding: '8px 10px',
  fontSize: 12,
}

export function StatsBudgetAnalyticsPanel({ year }: StatsBudgetAnalyticsPanelProps) {
  const {
    loading,
    refreshing,
    error,
    monthlyMetrics,
    monthlyVariableCategories,
    variableCategorySummary,
    refreshedAt,
    refreshAndReload,
    reloadOnly,
  } = useBudgetAnalytics({ autoRefresh: false, autoLoad: true })

  const latest = useMemo(() => getLatestMonthMetrics(monthlyMetrics), [monthlyMetrics])
  const previous = useMemo(() => getPreviousMonthMetrics(monthlyMetrics), [monthlyMetrics])
  const topCategories = useMemo(() => getTopVariableCategories(variableCategorySummary, 7), [variableCategorySummary])
  const latestBreakdown = useMemo(
    () => getLatestMonthVariableBreakdown(monthlyVariableCategories, 7),
    [monthlyVariableCategories],
  )
  const insights = useMemo(() => getBudgetInsights(variableCategorySummary), [variableCategorySummary])

  const effectiveYear = useMemo(() => {
    if (monthlyMetrics.length === 0) return year ?? null
    const availableYears = [...new Set(monthlyMetrics.map((row) => row.period_year))].sort((a, b) => b - a)
    if (year && availableYears.includes(year)) return year
    return availableYears[0] ?? null
  }, [monthlyMetrics, year])

  const chartData = useMemo(
    () => monthlyMetrics
      .filter((row) => (effectiveYear ? row.period_year === effectiveYear : true))
      .map((row) => ({
        label: `${String(row.period_month).padStart(2, '0')}/${String(row.period_year).slice(-2)}`,
        income: Number(row.income_total),
        fixed: Number(row.fixed_expense_total),
        variable: Number(row.variable_expense_total),
        savings: Number(row.savings_capacity_observed),
      })),
    [monthlyMetrics, effectiveYear],
  )

  const latestLabel = latest ? `${String(latest.period_month).padStart(2, '0')}/${latest.period_year}` : '—'
  const breakdownTotal = latestBreakdown.reduce((sum, row) => sum + row.amount, 0)

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-card)', padding: '16px 16px 14px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.1, color: 'var(--neutral-900)' }}>Statistiques financières</h2>
            <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--neutral-500)' }}>
              Analyse premium de vos revenus, dépenses et tendances budgétaires.
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--neutral-400)' }}>
              Dernier recalcul: {formatDateTime(refreshedAt)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => void refreshAndReload()}
              disabled={refreshing}
              style={{
                border: 'none',
                borderRadius: 'var(--radius-full)',
                padding: '7px 12px',
                fontSize: 11,
                fontWeight: 700,
                color: '#fff',
                background: 'var(--primary-500)',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                opacity: refreshing ? 0.65 : 1,
              }}
            >
              {refreshing ? 'Recalcul…' : 'Recalculer les analytics'}
            </button>
            <button
              type="button"
              onClick={() => void reloadOnly()}
              disabled={loading || refreshing}
              style={{
                border: '1px solid var(--neutral-200)',
                borderRadius: 'var(--radius-full)',
                padding: '7px 12px',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--neutral-700)',
                background: '#fff',
                cursor: loading || refreshing ? 'not-allowed' : 'pointer',
                opacity: loading || refreshing ? 0.65 : 1,
              }}
            >
              Recharger
            </button>
          </div>
        </div>

        {loading && <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--neutral-500)' }}>Chargement analytics…</p>}
        {error && (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--color-negative)', background: '#FFF0F0', borderRadius: 'var(--radius-md)', padding: '8px 10px' }}>
            {error}
          </p>
        )}
      </motion.div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <KpiCard
          label="Variable ce mois"
          value={Number(latest?.variable_expense_total ?? 0)}
          deltaPct={computeDeltaPct(Number(latest?.variable_expense_total ?? 0), previous?.variable_expense_total)}
        />
        <KpiCard
          label="Fixe ce mois"
          value={Number(latest?.fixed_expense_total ?? 0)}
          deltaPct={computeDeltaPct(Number(latest?.fixed_expense_total ?? 0), previous?.fixed_expense_total)}
        />
        <KpiCard
          label="Revenus ce mois"
          value={Number(latest?.income_total ?? 0)}
          deltaPct={computeDeltaPct(Number(latest?.income_total ?? 0), previous?.income_total)}
        />
        <KpiCard
          label="Épargne observée"
          value={Number(latest?.savings_capacity_observed ?? 0)}
          deltaPct={computeDeltaPct(Number(latest?.savings_capacity_observed ?? 0), previous?.savings_capacity_observed)}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-card)', padding: '14px 14px 12px' }}
      >
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--neutral-700)' }}>
          Évolution mensuelle {effectiveYear ?? ''}
        </h3>
        <p style={{ margin: '2px 0 10px', fontSize: 11, color: 'var(--neutral-400)' }}>
          Revenus, dépenses fixes, dépenses variables et capacité d’épargne.
        </p>
        {chartData.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-400)' }}>Aucune donnée mensuelle disponible.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECECF4" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8F8FA8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8F8FA8' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="fixed" name="Fixe" fill="#A4A4BF" radius={[6, 6, 0, 0]} barSize={16} />
              <Bar dataKey="variable" name="Variable" fill="#5B57F5" radius={[6, 6, 0, 0]} barSize={16} />
              <Line type="monotone" dataKey="income" name="Revenus" stroke="#2ED47A" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="savings" name="Épargne" stroke="#FFAB2E" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
        <div style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-card)', padding: '14px' }}>
          <h3 style={{ margin: 0, fontSize: 14, color: 'var(--neutral-700)' }}>Top catégories variables</h3>
          <p style={{ margin: '2px 0 10px', fontSize: 11, color: 'var(--neutral-400)' }}>Classement cumulé de vos postes variables.</p>
          {topCategories.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-400)' }}>Aucune catégorie variable disponible.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {topCategories.map((row) => (
                <div key={row.category_id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--neutral-700)' }}>{row.category_name}</p>
                  <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--neutral-800)' }}>{formatCurrency(Number(row.total_amount))}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-500)' }}>{row.pctOfVariableTotal.toFixed(1)}%</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-card)', padding: '14px' }}>
          <h3 style={{ margin: 0, fontSize: 14, color: 'var(--neutral-700)' }}>Répartition du dernier mois</h3>
          <p style={{ margin: '2px 0 10px', fontSize: 11, color: 'var(--neutral-400)' }}>
            Mois analysé: {latestLabel} · Total variable: {formatCurrency(breakdownTotal)}
          </p>
          {latestBreakdown.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-400)' }}>Aucune répartition mensuelle disponible.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {latestBreakdown.map((row) => (
                <div key={row.categoryId} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--neutral-700)', fontWeight: 600 }}>{row.categoryName}</p>
                  <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--neutral-800)' }}>{formatCurrency(row.amount)}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-500)' }}>{row.pctOfMonthVariable.toFixed(1)}%</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-card)', padding: '14px' }}>
          <h3 style={{ margin: 0, fontSize: 14, color: 'var(--neutral-700)' }}>Points d’attention</h3>
          <p style={{ margin: '2px 0 10px', fontSize: 11, color: 'var(--neutral-400)' }}>Synthèse automatique de vos tendances variables.</p>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ border: '1px solid var(--neutral-100)', borderRadius: 'var(--radius-lg)', padding: '9px 10px' }}>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-400)' }}>Poste principal</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--neutral-700)', fontWeight: 600 }}>
                {insights.mainCategory ? `${insights.mainCategory.category_name} · ${formatCurrency(Number(insights.mainCategory.total_amount))}` : '—'}
              </p>
            </div>
            <div style={{ border: '1px solid var(--neutral-100)', borderRadius: 'var(--radius-lg)', padding: '9px 10px' }}>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-400)' }}>Catégorie la plus volatile</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--neutral-700)', fontWeight: 600 }}>
                {insights.mostVolatileCategory
                  ? `${insights.mostVolatileCategory.category_name} · écart ${formatCurrency(insights.mostVolatileCategory.volatility)}`
                  : '—'}
              </p>
            </div>
            <div style={{ border: '1px solid var(--neutral-100)', borderRadius: 'var(--radius-lg)', padding: '9px 10px' }}>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-400)' }}>Catégorie la plus récurrente</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--neutral-700)', fontWeight: 600 }}>
                {insights.mostRecurringCategory
                  ? `${insights.mostRecurringCategory.category_name} · ${insights.mostRecurringCategory.active_months_count} mois actifs`
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <details style={{ marginTop: 2 }}>
        <summary style={{ fontSize: 12, color: 'var(--neutral-500)', cursor: 'pointer' }}>Debug analytics</summary>
        <pre
          style={{
            marginTop: 6,
            background: 'var(--neutral-50)',
            border: '1px solid var(--neutral-100)',
            borderRadius: 'var(--radius-md)',
            padding: 10,
            maxHeight: 220,
            overflow: 'auto',
            fontSize: 11,
            color: 'var(--neutral-700)',
          }}
        >
          {JSON.stringify(
            {
              monthlyMetrics: monthlyMetrics.length,
              monthlyVariableCategories: monthlyVariableCategories.length,
              variableCategorySummary: variableCategorySummary.length,
              latestMonth: latest?.month_start ?? null,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </section>
  )
}
