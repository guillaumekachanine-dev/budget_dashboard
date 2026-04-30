import { formatCurrency } from '@/features/stats/utils/statsReferenceSelectors'

type StatsTotalNeedCardProps = {
  totalExpenseBudget: number
  totalSavingsBudget: number
  totalMonthlyNeed: number
}

export function StatsTotalNeedCard({
  totalExpenseBudget,
  totalSavingsBudget,
  totalMonthlyNeed,
}: StatsTotalNeedCardProps) {
  const needLabel = 'Besoin mensuel total'
  const expenseLabel = 'Budget dépenses'
  const savingsLabel = 'Épargne cible'

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', borderRadius: 'var(--radius-2xl)', background: 'linear-gradient(135deg, var(--primary-700) 0%, var(--primary-500) 100%)', color: 'var(--neutral-0)', boxShadow: 'var(--shadow-lg)', padding: 'var(--space-5)' }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.85, fontWeight: 'var(--font-weight-bold)' }}>
          {needLabel}
        </p>
        <p style={{ margin: '6px 0 0', fontSize: '34px', lineHeight: 1.1, fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-extrabold)' }}>
          {formatCurrency(totalMonthlyNeed)}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
          <div style={{ background: 'color-mix(in oklab, var(--neutral-0) 12%, transparent)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', opacity: 0.78 }}>{expenseLabel}</p>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-md)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-bold)' }}>{formatCurrency(totalExpenseBudget)}</p>
          </div>
          <div style={{ background: 'color-mix(in oklab, var(--neutral-0) 12%, transparent)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', opacity: 0.78 }}>{savingsLabel}</p>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-md)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-bold)' }}>{formatCurrency(totalSavingsBudget)}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
