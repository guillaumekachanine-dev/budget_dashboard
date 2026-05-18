import type { StatsReferenceSnapshot } from '@/features/stats/types'
import { formatCurrency } from '@/features/stats/utils/statsReferenceSelectors'
import {
  CompactStatGrid,
  MetricCard,
  StatsSection,
  SurfaceCard,
  AmountDelta,
} from '@/features/stats/components/ui'

type StatsSavingsCardProps = {
  savingsSummary: StatsReferenceSnapshot['savingsSummary']
  savingsLines: StatsReferenceSnapshot['savingsLines']
}

export function StatsSavingsCard({ savingsSummary, savingsLines }: StatsSavingsCardProps) {
  return (
    <StatsSection>
      <SurfaceCard tone="neutral" padding="var(--space-4)">
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--neutral-900)' }}>Épargne cible / réalisée</h2>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
              Suivi séparé des objectifs d’épargne et du réalisé mensuel.
            </p>
          </div>

          <CompactStatGrid minItemWidth={135}>
            <MetricCard label="Cible totale" value={formatCurrency(savingsSummary.totalSavingsBudget)} compact />
            <MetricCard label="Réalisée" value={formatCurrency(savingsSummary.totalSavingsActual)} compact />
            <MetricCard
              label="Delta"
              value={formatCurrency(savingsSummary.deltaSavings)}
              detail={undefined}
              tone={savingsSummary.deltaSavings >= 0 ? 'positive' : 'danger'}
              compact
            />
          </CompactStatGrid>

          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            {savingsLines.map((line) => (
              <article key={line.categoryName} style={{ border: '1px solid var(--neutral-150)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)', minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-700)', fontWeight: 'var(--font-weight-semibold)' }}>
                  {line.categoryName}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-2)', minWidth: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '10px', color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Cible</p>
                    <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-800)', fontFamily: 'var(--font-mono)', overflowWrap: 'anywhere' }}>
                      {formatCurrency(line.targetSavingsAmountEur)}
                    </p>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '10px', color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Réalisée</p>
                    <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-800)', fontFamily: 'var(--font-mono)', overflowWrap: 'anywhere' }}>
                      {formatCurrency(line.actualSavingsAmountEur)}
                    </p>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '10px', color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Delta</p>
                    <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)' }}>
                      <AmountDelta
                        amount={line.deltaSavingsAmountEur}
                        formatted={formatCurrency(line.deltaSavingsAmountEur)}
                      />
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </SurfaceCard>
    </StatsSection>
  )
}
