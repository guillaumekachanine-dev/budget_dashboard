import { formatCurrencyFloored } from '@/lib/utils'
import type { TripExpenseBarsMode, TripExpenseBarsRow } from '@/features/voyages/hooks/useTripExpenseBars'

const VOYAGE_ACCENT = '#38BDF8'
const VOYAGE_ACCENT_DARK = '#0284C7'

export function TripExpenseBarsSection({
  mode,
  rows,
}: {
  mode: TripExpenseBarsMode
  rows: TripExpenseBarsRow[]
}) {
  if (rows.length === 0) return null

  const maxAmount = Math.max(
    ...rows.map((row) => mode === 'future' ? row.budgetAmount : Math.max(row.budgetAmount, row.consumedAmount)),
    1,
  )

  return (
    <div style={{ display: 'grid', gap: 'var(--space-2.5)', borderTop: '1px solid var(--neutral-100)', paddingTop: 'var(--space-3)' }}>
      <p style={{ margin: '0 0 var(--space-1)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--neutral-400)' }}>
        Par poste de dépense
      </p>
      {rows.map((cat) => {
        const budgetPct = maxAmount > 0 ? (cat.budgetAmount / maxAmount) * 100 : 0
        const consumedPct = maxAmount > 0 ? (cat.consumedAmount / maxAmount) * 100 : 0
        const consumedVsBudgetPct = cat.budgetAmount > 0 ? (cat.consumedAmount / cat.budgetAmount) * 100 : 0

        return (
          <div
            key={cat.key}
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 64px',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-600)' }}>
              {cat.name}
            </span>
            <div style={{ height: 6, borderRadius: 'var(--radius-full)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
              {mode === 'future' ? (
                <div
                  style={{
                    width: `${Math.max(0, Math.min(budgetPct, 100))}%`,
                    height: '100%',
                    borderRadius: 'var(--radius-full)',
                    background: VOYAGE_ACCENT,
                    transition: 'width 0.3s ease',
                  }}
                />
              ) : mode === 'ongoing' ? (
                <div style={{ position: 'relative', height: '100%' }}>
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(budgetPct, 100))}%`,
                      height: '100%',
                      borderRadius: 'var(--radius-full)',
                      background: VOYAGE_ACCENT,
                      transition: 'width 0.3s ease',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: `${Math.max(0, Math.min(consumedPct, 100))}%`,
                      height: '100%',
                      borderRadius: 'var(--radius-full)',
                      background: '#F59E0B',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: `${Math.max(0, Math.min(consumedPct, 100))}%`,
                    height: '100%',
                    borderRadius: 'var(--radius-full)',
                    background: VOYAGE_ACCENT_DARK,
                    transition: 'width 0.3s ease',
                  }}
                />
              )}
            </div>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-850)', textAlign: 'right', whiteSpace: 'nowrap' }}>
              {mode === 'ongoing'
                ? `${Math.round(Math.max(0, consumedVsBudgetPct))}%`
                : formatCurrencyFloored(mode === 'future' ? cat.budgetAmount : cat.consumedAmount)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
