import { formatCurrencyRounded as fmt } from '@/lib/utils'

type Props = {
  expense2025:   number
  expense2026:   number
  projected2025: number | null
  projected2026: number | null
}

export function ComparedVelocityCard({ expense2025, expense2026, projected2025, projected2026 }: Props) {
  const delta = projected2026 != null && projected2025 != null
    ? projected2026 - projected2025
    : null

  const isHigher = delta != null && delta > 0

  const burnRatePct = projected2026 != null && projected2025 != null && projected2025 > 0
    ? ((projected2026 - projected2025) / projected2025) * 100
    : null

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e1c4a 0%, #2d2a6e 100%)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--space-5)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Noise décoratif */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 80% 20%, rgba(91,87,245,0.25) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <p style={{ margin: '0 0 var(--space-1)', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Célérité de dépense · Jan–Avr
      </p>
      <p style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.5)' }}>
        Projection fin d'année au rythme actuel
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <VelocityItem
          label="2025 · YTD réel"
          ytd={expense2025}
          projected={projected2025}
          color="rgba(255,255,255,0.55)"
          projColor="rgba(255,255,255,0.8)"
        />
        <VelocityItem
          label="2026 · YTD réel"
          ytd={expense2026}
          projected={projected2026}
          color="rgba(76,201,240,0.9)"
          projColor="#fff"
          highlight
        />
      </div>

      {delta != null && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: 'var(--space-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            Écart de projection
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              color: isHigher ? '#FC5A5A' : '#2ED47A',
            }}>
              {isHigher ? '+' : ''}{fmt(delta)}
            </span>
            {burnRatePct != null && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: isHigher ? 'rgba(252,90,90,0.8)' : 'rgba(46,212,122,0.8)',
                background: isHigher ? 'rgba(252,90,90,0.12)' : 'rgba(46,212,122,0.12)',
                borderRadius: 'var(--radius-full)',
                padding: '2px 7px',
              }}>
                {isHigher ? '▲' : '▼'} {Math.abs(burnRatePct).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function VelocityItem({
  label, ytd, projected, color, projColor, highlight = false,
}: {
  label: string
  ytd: number
  projected: number | null
  color: string
  projColor: string
  highlight?: boolean
}) {
  return (
    <div style={{
      background: highlight ? 'rgba(255,255,255,0.07)' : 'transparent',
      borderRadius: 'var(--radius-lg)',
      padding: highlight ? 'var(--space-3)' : 0,
    }}>
      <p style={{ margin: '0 0 var(--space-1)', fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </p>
      <p style={{ margin: '0 0 2px', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.55)' }}>
        {fmt(ytd)} dépensés
      </p>
      {projected != null && (
        <p style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: projColor }}>
          {fmt(projected)}
        </p>
      )}
      <p style={{ margin: '2px 0 0', fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>
        projeté fin d'année
      </p>
    </div>
  )
}
