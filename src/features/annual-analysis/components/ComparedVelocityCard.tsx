import { useState, type CSSProperties } from 'react'
import { formatCurrencyRounded as fmt } from '@/lib/utils'

// Atterrissage réel connu pour 2025 (année clôturée)
const REAL_2025_ANNUAL = 38_144
const ASSURED_INCOME_2026_MONTHLY = 3334
const ASSURED_INCOME_2026_MONTHS = 7

type Props = {
  income2025Ytd: number
  income2026Ytd: number
  annualIncome2025: number | null
  expense2025: number
  expense2026: number
  projected2025: number | null
  projected2026: number | null
  medianMonthly2025: number | null
  medianMonthly2026: number | null
  remainingMonths: number
}

export function ComparedVelocityCard({
  income2025Ytd,
  income2026Ytd,
  annualIncome2025,
  expense2025,
  expense2026,
  projected2025,
  projected2026,
  medianMonthly2025,
  medianMonthly2026,
  remainingMonths,
}: Props) {
  const [openExpenseModal, setOpenExpenseModal] = useState<null | '2025' | '2026'>(null)
  const [isIncome2025ModalOpen, setIsIncome2025ModalOpen] = useState(false)
  const [isIncome2026ModalOpen, setIsIncome2026ModalOpen] = useState(false)

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

  const incomeYtdDeltaPct = income2025Ytd > 0
    ? ((income2026Ytd - income2025Ytd) / income2025Ytd) * 100
    : null

  const totalIncome2025 = annualIncome2025 ?? REAL_2025_ANNUAL
  const projectedIncome2026 = income2026Ytd + (ASSURED_INCOME_2026_MONTHLY * ASSURED_INCOME_2026_MONTHS)

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, #1e1c4a 0%, #2d2a6e 100%)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-5)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 80% 20%, rgba(91,87,245,0.25) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        <p style={{
          margin: '0 0 var(--space-4)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 700,
          color: '#fff',
          position: 'relative',
        }}>
          Projection des revenus
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
          alignItems: 'stretch',
        }}>
          <RevenueProjectionItem
            title="2025 - revenus YTD"
            ytdAmount={income2025Ytd}
            annualAmount={totalIncome2025}
            annualCaption="revenus totaux 2025"
            accentColor="rgba(99, 241, 171, 0.95)"
            cardBg="rgba(46,212,122,0.12)"
            valueColor="#FFFFFF"
            onClick={() => setIsIncome2025ModalOpen(true)}
          />
          <RevenueProjectionItem
            title="2026 - revenus YTD"
            ytdAmount={income2026Ytd}
            annualAmount={projectedIncome2026}
            annualCaption="revenus totaux 2026"
            accentColor="rgba(255, 176, 120, 0.95)"
            cardBg="rgba(255,171,46,0.12)"
            valueColor="#FFFFFF"
            onClick={() => setIsIncome2026ModalOpen(true)}
          />
        </div>

        <div style={{ marginTop: 'var(--space-2)' }}>
          <p style={{
            margin: '0 0 var(--space-4)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 700,
            color: '#fff',
            position: 'relative',
          }}>
            Célérité de dépenses · Projection fin d'année
          </p>

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
              onClick={() => setOpenExpenseModal('2025')}
            />
            <VelocityItem
              year="2026"
              ytd={expense2026}
              projected={projected2026}
              accentColor="rgba(76,201,240,0.9)"
              cardBg="rgba(76,201,240,0.11)"
              projColor="#fff"
              onClick={() => setOpenExpenseModal('2026')}
            />
          </div>
        </div>

        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          position: 'relative',
        }}>
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

      {openExpenseModal != null && (
        <CalcModal
          year={openExpenseModal}
          ytd={openExpenseModal === '2025' ? expense2025 : expense2026}
          medianMonthly={openExpenseModal === '2025' ? medianMonthly2025 : medianMonthly2026}
          remainingMonths={remainingMonths}
          projected={openExpenseModal === '2025' ? projected2025 : projected2026}
          onClose={() => setOpenExpenseModal(null)}
        />
      )}

      {isIncome2025ModalOpen ? (
        <Revenue2025Modal
          incomeYtd2025={income2025Ytd}
          incomeAnnual2025={totalIncome2025}
          incomeYtdDeltaPct={incomeYtdDeltaPct}
          onClose={() => setIsIncome2025ModalOpen(false)}
        />
      ) : null}

      {isIncome2026ModalOpen ? (
        <Revenue2026Modal
          incomeYtd2026={income2026Ytd}
          assuredMonthlyIncome={ASSURED_INCOME_2026_MONTHLY}
          assuredMonths={ASSURED_INCOME_2026_MONTHS}
          projectedIncome2026={projectedIncome2026}
          onClose={() => setIsIncome2026ModalOpen(false)}
        />
      ) : null}
    </>
  )
}

function RevenueProjectionItem({
  title,
  ytdAmount,
  annualAmount,
  annualCaption,
  accentColor,
  cardBg,
  valueColor,
  onClick,
}: {
  title: string
  ytdAmount: number
  annualAmount: number | null
  annualCaption: string
  accentColor: string
  cardBg: string
  valueColor: string
  onClick?: () => void
}) {
  const cardStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 2,
    background: cardBg,
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-3)',
    border: `1px solid ${accentColor.replace('0.95', '0.24')}`,
    textAlign: 'left' as const,
    width: '100%',
  }

  const content = (
    <>
      <p style={{ margin: '0 0 var(--space-1)', fontSize: 9, fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {title}
      </p>
      <p style={{ margin: '0 0 4px', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.55)' }}>
        {fmt(ytdAmount)} encaissés
      </p>
      <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-base)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: valueColor, lineHeight: 1 }}>
        {annualAmount != null ? fmt(annualAmount) : '\u00A0'}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>
        {annualCaption}
      </p>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...cardStyle,
          cursor: 'pointer',
          transition: 'background 150ms ease, border-color 150ms ease',
        }}
      >
        {content}
      </button>
    )
  }

  return <div style={cardStyle}>{content}</div>
}

function VelocityItem({
  year,
  ytd,
  projected,
  accentColor,
  cardBg,
  projColor,
  onClick,
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
        projeté fin d'année
      </p>
    </button>
  )
}

function Revenue2025Modal({
  incomeYtd2025,
  incomeAnnual2025,
  incomeYtdDeltaPct,
  onClose,
}: {
  incomeYtd2025: number
  incomeAnnual2025: number
  incomeYtdDeltaPct: number | null
  onClose: () => void
}) {
  const accentColor = '#FFAB2E'
  const deltaText = incomeYtdDeltaPct == null
    ? '—'
    : `${incomeYtdDeltaPct > 0 ? '+' : ''}${incomeYtdDeltaPct.toFixed(1)}%`

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
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
        <div style={{ marginBottom: 'var(--space-4)', borderBottom: `2px solid ${accentColor}`, paddingBottom: 'var(--space-3)' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)' }}>
            détail du calcul - 2025
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--neutral-400)' }}>
            rappel des revenus constatés sur l’année 2025
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DetailLine label="revenus janvier-avril 2025" value={fmt(incomeYtd2025)} />
          <DetailLine label="revenus constaté fin d’année 2025" value={fmt(incomeAnnual2025)} />
          <DetailLine label="écart revenus 2025-2026 YTD" value={deltaText} />
          <div style={{ borderTop: '1px dashed var(--neutral-200)', margin: '2px 0' }} />
          <DetailLine label="total revenus 2025" value={fmt(incomeAnnual2025)} bold />
        </div>

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
            marginTop: 'var(--space-4)',
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  )
}

function Revenue2026Modal({
  incomeYtd2026,
  assuredMonthlyIncome,
  assuredMonths,
  projectedIncome2026,
  onClose,
}: {
  incomeYtd2026: number
  assuredMonthlyIncome: number
  assuredMonths: number
  projectedIncome2026: number
  onClose: () => void
}) {
  const accentColor = '#FFAB2E'

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
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
        <div style={{ marginBottom: 'var(--space-4)', borderBottom: `2px solid ${accentColor}`, paddingBottom: 'var(--space-3)' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)' }}>
            détail du calcul - 2026
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--neutral-400)' }}>
            projection des revenus 2026
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DetailLine label="revenus 2026 YTD" value={fmt(incomeYtd2026)} />
          <DetailLine label="revenus assurés" value={`${fmt(assuredMonthlyIncome)}/mois (Chômage)`} />
          <DetailLine label="période concernée" value={`mai-déc. (${assuredMonths} mois)`} />
          <div style={{ borderTop: '1px dashed var(--neutral-200)', margin: '2px 0' }} />
          <DetailLine label="projection 2026" value={fmt(projectedIncome2026)} bold />
        </div>

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
            marginTop: 'var(--space-4)',
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  )
}

function DetailLine({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 12, color: bold ? 'var(--neutral-900)' : 'var(--neutral-600)', fontWeight: bold ? 700 : 500 }}>
        {label} :
      </span>
      <span style={{
        fontSize: bold ? 14 : 12,
        fontWeight: bold ? 800 : 600,
        fontFamily: 'var(--font-mono)',
        color: bold ? '#FFAB2E' : 'var(--neutral-700)',
        flexShrink: 0,
      }}>
        {value}
      </span>
    </div>
  )
}

function CalcModal({
  year,
  ytd,
  medianMonthly,
  remainingMonths,
  projected,
  onClose,
}: {
  year: string
  ytd: number
  medianMonthly: number | null
  remainingMonths: number
  projected: number | null
  onClose: () => void
}) {
  const accentColor = year === '2025' ? '#FFAB2E' : '#4CC9F0'
  const nbMonths = 12 - remainingMonths

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
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
        <div style={{ marginBottom: 'var(--space-4)', borderBottom: `2px solid ${accentColor}`, paddingBottom: 'var(--space-3)' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)' }}>
            Détail du calcul · {year}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--neutral-400)' }}>
            YTD réel + médiane × mois restants
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <StepRow
            step="①"
            label={`Consommé réel Jan–Avr (${nbMonths} mois)`}
            value={fmt(ytd)}
            accent={accentColor}
            bold={false}
          />
          <StepRow
            step="②"
            label={`Médiane mensuelle sur ${nbMonths} mois`}
            value={medianMonthly != null ? fmt(medianMonthly) : '—'}
            accent={accentColor}
            bold={false}
          />
          <StepRow
            step="③"
            label={`Médiane × ${remainingMonths} mois restants`}
            value={medianMonthly != null ? fmt(medianMonthly * remainingMonths) : '—'}
            accent={accentColor}
            bold={false}
          />
          <div style={{ borderTop: '1px dashed var(--neutral-200)', margin: '2px 0' }} />
          <StepRow
            step="="
            label="Projection fin d'année"
            value={projected != null ? fmt(projected) : '—'}
            accent={accentColor}
            bold
          />
        </div>

        <p style={{ margin: 'var(--space-4) 0 var(--space-4)', fontSize: 10, color: 'var(--neutral-400)', lineHeight: 1.5 }}>
          La médiane neutralise les mois exceptionnels non reproductibles, contrairement à la moyenne.
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

function StepRow({
  step,
  label,
  value,
  accent,
  bold,
}: {
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
