import { Skeleton } from '@/components/ui/Skeleton'
import { useSavingsCurrentSummary } from '@/features/savings/hooks/useSavingsCurrentSummary'

function formatEuro(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  const normalized = Math.abs(value) <= 1 ? value * 100 : value
  return `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(normalized)} %`
}

type SavingsSplitTileProps = {
  label: string
  amount: number | null | undefined
  sharePct: number | null | undefined
}

function SavingsSplitTile({ label, amount, sharePct }: SavingsSplitTileProps) {
  return (
    <div
      style={{
        background: 'color-mix(in oklab, var(--neutral-0) 12%, transparent)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 'var(--font-size-xs)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          opacity: 0.82,
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: '4px 0 0',
          fontSize: 'var(--font-size-md)',
          lineHeight: 1.2,
          fontWeight: 'var(--font-weight-bold)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {formatEuro(amount)}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', opacity: 0.88 }}>
        {formatPercent(sharePct)}
      </p>
    </div>
  )
}

export function SavingsHeroCard() {
  const { data, isLoading, error } = useSavingsCurrentSummary()

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div
        style={{
          maxWidth: 600,
          margin: '0 auto',
          borderRadius: 'var(--radius-2xl)',
          background: 'linear-gradient(135deg, color-mix(in oklab, var(--color-positive) 78%, var(--primary-700) 22%) 0%, color-mix(in oklab, var(--color-positive) 84%, var(--primary-600) 16%) 100%)',
          color: 'var(--neutral-0)',
          boxShadow: 'var(--shadow-card)',
          padding: 'var(--space-5)',
          border: '1px solid color-mix(in oklab, var(--neutral-0) 16%, transparent)',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 'var(--font-size-sm)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            opacity: 0.86,
            fontWeight: 'var(--font-weight-bold)',
          }}
        >
          Patrimoine épargne
        </p>

        {isLoading ? (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Skeleton className="h-10 w-44 bg-white/20" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
              <Skeleton className="h-20 w-full bg-white/20" />
              <Skeleton className="h-20 w-full bg-white/20" />
            </div>
          </div>
        ) : (
          <>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: '34px',
                lineHeight: 1.1,
                fontFamily: 'var(--font-mono)',
                fontWeight: 'var(--font-weight-extrabold)',
              }}
            >
              {data ? formatEuro(data.total_savings) : '—'}
            </p>

            {error ? (
              <p style={{ margin: '8px 0 0', fontSize: 'var(--font-size-xs)', opacity: 0.9 }}>
                Données indisponibles pour le moment.
              </p>
            ) : null}

            {!error && !data ? (
              <p style={{ margin: '8px 0 0', fontSize: 'var(--font-size-sm)', opacity: 0.92 }}>
                Aucune donnée d’épargne disponible
              </p>
            ) : null}

            {data ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                <SavingsSplitTile label="Livrets" amount={data.livrets_total} sharePct={data.livrets_share_pct} />
                <SavingsSplitTile label="Placements" amount={data.placements_total} sharePct={data.placements_share_pct} />
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
