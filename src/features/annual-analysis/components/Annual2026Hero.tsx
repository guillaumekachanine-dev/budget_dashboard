import type { Annual2026Summary } from '@/features/annual-analysis/hooks/useAnnual2026Analysis'
import { formatCurrencyRounded as fmt } from '@/lib/utils'

type Props = {
  summary: Annual2026Summary
}

const fmt2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

export function Annual2026Hero({ summary }: Props) {
  const savingsRatePct = summary.totalMonthlyNeed > 0
    ? ((summary.totalSavingsBudget / summary.totalMonthlyNeed) * 100).toFixed(1)
    : '0'
  const expenseRatePct = summary.totalMonthlyNeed > 0
    ? ((summary.totalMonthlyBudget / summary.totalMonthlyNeed) * 100).toFixed(1)
    : '0'

  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* ── Tag barre supérieure ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 'var(--space-3)',
        }}>
          <span style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--primary-600)',
            background: 'color-mix(in oklab, var(--primary-600) 10%, var(--neutral-0) 90%)',
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid color-mix(in oklab, var(--primary-600) 25%, transparent)',
          }}>
            Plan 2026 · Jan – Mai
          </span>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--neutral-400)',
            letterSpacing: '0.06em',
          }}>
            {summary.ytdMonths} mois · Budget annualisé
          </span>
        </div>

        {/* ── Hero card ── */}
        <div style={{
          background: 'linear-gradient(140deg, #1A1730 0%, #2D2B6B 45%, #3D3AB8 100%)',
          borderRadius: 'var(--radius-2xl)',
          padding: 'var(--space-6)',
          boxShadow: '0 12px 40px rgba(91,87,245,0.32), 0 2px 8px rgba(0,0,0,0.2)',
          position: 'relative',
          overflow: 'hidden',
        }}>

          {/* Watermark géant */}
          <span style={{
            position: 'absolute', right: -16, bottom: -20,
            fontSize: 110, fontWeight: 900,
            fontFamily: 'var(--font-mono)',
            color: 'rgba(255,255,255,0.04)',
            lineHeight: 1, userSelect: 'none', pointerEvents: 'none',
            letterSpacing: '-0.04em',
          }}>2026</span>

          {/* Cercle décoratif */}
          <div style={{
            position: 'absolute', top: -60, right: -60,
            width: 200, height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(91,87,245,0.25) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Row 1 — label + badges */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <p style={{
              margin: 0, fontSize: 11, fontWeight: 700,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              Budget mensuel · Plan 2026
            </p>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <HeroBadge label="Épargne" value={`${savingsRatePct}%`} color="rgba(46,212,122,0.95)" />
              <HeroBadge label="Dépenses" value={`${expenseRatePct}%`} color="rgba(252,90,90,0.8)" />
            </div>
          </div>

          {/* Montant principal */}
          <p style={{
            margin: '10px 0 0',
            fontSize: 'clamp(30px, 9vw, 44px)',
            fontWeight: 800, fontFamily: 'var(--font-mono)',
            color: '#FFFFFF', lineHeight: 1.05, letterSpacing: '-0.025em',
          }}>
            {fmt2(summary.totalMonthlyBudget)}
          </p>
          <p style={{
            margin: '4px 0 0',
            fontSize: 12, fontWeight: 500,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.04em',
          }}>
            de dépenses planifiées / mois
          </p>

          {/* Séparateur */}
          <div style={{ margin: 'var(--space-5) 0 var(--space-4)', height: 1, background: 'rgba(255,255,255,0.1)' }} />

          {/* 4 KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
            <HeroKpi label="+ Épargne" value={fmt2(summary.totalSavingsBudget)} />
            <HeroKpi label="Besoin total" value={fmt2(summary.totalMonthlyNeed)} highlight="accent" />
            <HeroKpi label="YTD dépenses" value={fmt(summary.ytdBudgetTotal)} />
            <HeroKpi label="YTD total" value={fmt(summary.ytdTotalNeed)} />
          </div>

          {/* Barre YTD avancement */}
          <div style={{ marginTop: 'var(--space-5)' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              marginBottom: 6,
            }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Avancement YTD
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>
                {summary.ytdMonths} / 12 mois
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(summary.ytdMonths / 12) * 100}%`,
                borderRadius: 3,
                background: 'linear-gradient(90deg, rgba(46,212,122,0.7), rgba(91,87,245,0.9))',
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        </div>

        {/* ── 3 blocs inline sous le hero ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--space-3)', marginTop: 'var(--space-3)',
        }}>
          <SubMetricCard
            label="Besoin jour"
            value={fmt2(summary.totalMonthlyNeed / 30)}
            sub="/ jour calendaire"
            color="#5B57F5"
          />
          <SubMetricCard
            label="Flex budget"
            value={fmt2(summary.totalMonthlyBudget * 0.25)}
            sub="25% piloté actif"
            color="#FFAB2E"
          />
          <SubMetricCard
            label="YTD épargne"
            value={fmt2(summary.ytdSavingsTotal)}
            sub={`${summary.ytdMonths} mois × ${fmt2(summary.totalSavingsBudget)}`}
            color="#2ED47A"
          />
        </div>
      </div>
    </section>
  )
}

function HeroBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.22)', borderRadius: 20, padding: '4px 9px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', lineHeight: 1 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color, lineHeight: 1.4 }}>{value}</span>
    </div>
  )
}

function HeroKpi({ label, value, highlight }: { label: string; value: string; highlight?: 'accent' }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </p>
      <p style={{
        margin: '3px 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        color: highlight === 'accent' ? 'rgba(255,213,80,0.95)' : 'rgba(255,255,255,0.9)',
        lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {value}
      </p>
    </div>
  )
}

function SubMetricCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      background: 'var(--neutral-0)',
      borderRadius: 'var(--radius-xl)',
      border: `1px solid color-mix(in oklab, ${color} 18%, var(--neutral-150) 82%)`,
      borderTopWidth: 3, borderTopColor: color,
      padding: 'var(--space-3)',
      boxShadow: 'var(--shadow-card)',
    }}>
      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
      <p style={{ margin: '5px 0 0', fontSize: 'var(--font-size-base)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1.2 }}>{value}</p>
      <p style={{ margin: '2px 0 0', fontSize: 9, color: 'var(--neutral-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</p>
    </div>
  )
}
