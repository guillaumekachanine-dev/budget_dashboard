import { useState } from 'react'
import { formatCurrencyRounded as fmt } from '@/lib/utils'

// Atterrissage réel connu pour 2025 (année clôturée)
const REAL_2025_ANNUAL = 38_144

type Props = {
  expense2025:   number
  expense2026:   number
  projected2025: number | null
  projected2026: number | null
}

export function ComparedVelocityCard({ expense2025, expense2026, projected2025, projected2026 }: Props) {
  const [openModal, setOpenModal] = useState<null | '2025' | '2026'>(null)

  const delta = projected2026 != null && projected2025 != null
    ? projected2026 - projected2025
    : null
  const isHigher = delta != null && delta > 0

  const burnRatePct = projected2026 != null && projected2025 != null && projected2025 > 0
    ? ((projected2026 - projected2025) / projected2025) * 100
    : null

  const realVsProjectedPct = projected2025 != null && projected2025 > 0
    ? ((REAL_2025_ANNUAL - projected2025) / projected2025) * 100
    : null

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, #1e1c4a 0%, #2d2a6e 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-5)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Halo décoratif */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 80% 20%, rgba(91,87,245,0.25) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Titre unique */}
        <p style={{
          margin: '0 0 var(--space-4)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 700,
          color: '#fff',
          position: 'relative',
        }}>
          Célérité de dépenses · Projection fin d'année
        </p>

        {/* Deux cartes alignées */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
          alignItems: 'stretch',
        }}>
          <VelocityItem
            year="2025"
            ytd={expense2025}
            projected={projected2025}
            accentColor="rgba(255,171,46,0.9)"
            cardBg="rgba(255,171,46,0.10)"
            projColor="rgba(255,255,255,0.9)"
            onClick={() => setOpenModal('2025')}
          />
          <VelocityItem
            year="2026"
            ytd={expense2026}
            projected={projected2026}
            accentColor="rgba(76,201,240,0.9)"
            cardBg="rgba(76,201,240,0.11)"
            projColor="#fff"
            onClick={() => setOpenModal('2026')}
          />
        </div>

        {/* Section basse */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          position: 'relative',
        }}>
          {/* Écart de projection */}
          {delta != null && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                Écart de projection{' '}
                <span style={{ opacity: 0.55, fontSize: 10 }}>2025 vs 2026</span>
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                    color: isHigher ? 'rgba(252,90,90,0.85)' : 'rgba(46,212,122,0.85)',
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

          {/* Atterrissage réel 2025 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
              Atterrissage réel 2025
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: '#fff',
              }}>
                {fmt(REAL_2025_ANNUAL)}
              </span>
              {realVsProjectedPct != null && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: realVsProjectedPct > 0 ? 'rgba(252,90,90,0.8)' : 'rgba(46,212,122,0.8)',
                  background: realVsProjectedPct > 0 ? 'rgba(252,90,90,0.12)' : 'rgba(46,212,122,0.12)',
                  borderRadius: 'var(--radius-full)',
                  padding: '2px 7px',
                }}>
                  {realVsProjectedPct > 0 ? '+' : ''}{realVsProjectedPct.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modale calcul */}
      {openModal != null && (
        <CalcModal
          year={openModal}
          ytd={openModal === '2025' ? expense2025 : expense2026}
          projected={openModal === '2025' ? projected2025 : projected2026}
          onClose={() => setOpenModal(null)}
        />
      )}
    </>
  )
}

// ─── VelocityItem ──────────────────────────────────────────────────────────────

function VelocityItem({
  year, ytd, projected, accentColor, cardBg, projColor, onClick,
}: {
  year: string
  ytd: number
  projected: number | null
  accentColor: string
  cardBg: string
  projColor: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        background: cardBg,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3)',
        cursor: 'pointer',
        border: `1px solid ${accentColor.replace('0.9', '0.2').replace('0.10', '0.2').replace('0.11', '0.2')}`,
        transition: 'background 150ms ease, border-color 150ms ease',
        textAlign: 'left',
        width: '100%',
        outline: 'none',
      }}
    >
      <p style={{ margin: '0 0 var(--space-1)', fontSize: 9, fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {year} · YTD réel
      </p>
      <p style={{ margin: '0 0 4px', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.55)' }}>
        {fmt(ytd)} dépensés
      </p>
      {projected != null && (
        <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-base)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: projColor, lineHeight: 1 }}>
          {fmt(projected)}
        </p>
      )}
      <p style={{ margin: '4px 0 0', fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>
        projeté fin d'année · <span style={{ opacity: 0.7 }}>cliquer pour le détail</span>
      </p>
    </button>
  )
}

// ─── CalcModal ─────────────────────────────────────────────────────────────────

function CalcModal({ year, ytd, projected, onClose }: {
  year: string
  ytd: number
  projected: number | null
  onClose: () => void
}) {
  const monthly = ytd / 4
  const accentColor = year === '2025' ? '#FFAB2E' : '#4CC9F0'

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(10,10,30,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-5)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--neutral-0)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-5)',
          maxWidth: 320,
          width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        }}
      >
        {/* En-tête */}
        <div style={{ marginBottom: 'var(--space-4)', borderBottom: `2px solid ${accentColor}`, paddingBottom: 'var(--space-3)' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)' }}>
            Détail du calcul · {year}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--neutral-400)' }}>
            Extrapolation linéaire Jan – Avr → fin d'année
          </p>
        </div>

        {/* Étapes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <StepRow
            step="①"
            label="Total dépenses Jan – Avr"
            value={fmt(ytd)}
            accent={accentColor}
            bold={false}
          />
          <StepRow
            step="②"
            label="Moyenne mensuelle (÷ 4)"
            value={fmt(monthly)}
            accent={accentColor}
            bold={false}
          />
          <div style={{ borderTop: '1px dashed var(--neutral-200)', margin: '2px 0' }} />
          <StepRow
            step="③"
            label="Projection annuelle (× 12)"
            value={projected != null ? fmt(projected) : '—'}
            accent={accentColor}
            bold
          />
        </div>

        <p style={{ margin: 'var(--space-4) 0 var(--space-4)', fontSize: 10, color: 'var(--neutral-400)', lineHeight: 1.5 }}>
          Hypothèse : le rythme de dépense de janvier à avril se maintient sur les 8 mois restants.
        </p>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: '9px 0',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: accentColor,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  )
}

function StepRow({ step, label, value, accent, bold }: {
  step: string
  label: string
  value: string
  accent: string
  bold: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
        <span style={{ fontSize: 13, color: accent, flexShrink: 0 }}>{step}</span>
        <span style={{ fontSize: 12, color: bold ? 'var(--neutral-900)' : 'var(--neutral-600)', fontWeight: bold ? 700 : 500 }}>
          {label}
        </span>
      </div>
      <span style={{
        fontSize: bold ? 14 : 12,
        fontWeight: bold ? 800 : 600,
        fontFamily: 'var(--font-mono)',
        color: bold ? accent : 'var(--neutral-700)',
        flexShrink: 0,
      }}>
        {value}
      </span>
    </div>
  )
}
