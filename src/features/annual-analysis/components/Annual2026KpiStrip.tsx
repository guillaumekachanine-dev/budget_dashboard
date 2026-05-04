import type { Annual2026Summary, Budget2026BucketSummary } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'

type Props = {
  summary: Annual2026Summary
  buckets: Budget2026BucketSummary[]
}

const fmt2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

export function Annual2026KpiStrip({ summary, buckets }: Props) {
  return (
    <div style={{ padding: '0 var(--space-6)' }}>
      <div style={{
        maxWidth: 600, margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--space-2)',
        background: 'var(--neutral-50)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-3) var(--space-4)',
        border: '1px solid var(--neutral-150)',
      }}>
        <CondensedKpi
          label="Discrétionnaire"
          main={buckets.find(b => b.key === 'discretionnaire') ? fmt2(buckets.find(b => b.key === 'discretionnaire')!.monthlyBudget) : '0 €'}
          sub={buckets.find(b => b.key === 'discretionnaire') ? `${(buckets.find(b => b.key === 'discretionnaire')!.pctOfTotal * 100).toFixed(0)}%` : ''}
          color={buckets.find(b => b.key === 'discretionnaire')?.color ?? '#FFAB2E'}
        />
        <CondensedKpi
          label="Fixe vs Disc."
          main={`${((buckets.find(b => b.key === 'socle_fixe')?.monthlyBudget ?? 0) / (buckets.find(b => b.key === 'discretionnaire')?.monthlyBudget || 1)).toFixed(1)}×`}
          sub="ratio"
          color={((buckets.find(b => b.key === 'socle_fixe')?.monthlyBudget ?? 0) / (buckets.find(b => b.key === 'discretionnaire')?.monthlyBudget || 1)) > 1.5 ? '#FC5A5A' : '#2ED47A'}
        />
        <CondensedKpi
          label="Épargne YTD"
          main={fmt2(summary.ytdSavingsTotal)}
          sub={`${summary.totalMonthlyNeed > 0 ? ((summary.totalSavingsBudget / summary.totalMonthlyNeed) * 100).toFixed(0) : '0'}% cible`}
          color="#2ED47A"
        />
        <CondensedKpi
          label="Provisions"
          main={buckets.find(b => b.key === 'provision') ? `${(buckets.find(b => b.key === 'provision')!.pctOfTotal * 100).toFixed(0)}%` : '0%'}
          sub={`${fmt2((buckets.find(b => b.key === 'provision')?.monthlyBudget ?? 0) * 12)}/an`}
          color={buckets.find(b => b.key === 'provision') && buckets.find(b => b.key === 'provision')!.pctOfTotal >= 0.15 ? '#2ED47A' : '#FFAB2E'}
        />
      </div>
    </div>
  )
}

function CondensedKpi({ label, main, sub, color }: { label: string; main: string; sub: string; color: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{
        margin: 0, fontSize: 9, fontWeight: 700, color: 'var(--neutral-400)',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
      }}>
        {label}
      </p>
      <p style={{
        margin: '1px 0 0', fontSize: 13, fontWeight: 800,
        fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)',
        lineHeight: 1.1
      }}>
        {main}
      </p>
      <p style={{
        margin: 0, fontSize: 9, color,
        fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
      }}>
        {sub}
      </p>
    </div>
  )
}
