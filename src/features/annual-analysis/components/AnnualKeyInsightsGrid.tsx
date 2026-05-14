import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, RotateCw } from 'lucide-react'
import { formatCurrencyRounded as formatCurrency } from '@/lib/utils'
import { getComparedYtdFlows } from '@/features/annual-analysis/api/getComparedYtdFlows'
import { useAnnual2025Analysis } from '@/features/annual-analysis/hooks/useAnnual2025Analysis'
import { useAnnualProjectionOverview2026 } from '@/features/annual-analysis/hooks/useAnnualProjectionOverview2026'
import type { YtdFlowRow } from '@/features/annual-analysis/types.compared'
import { CARD_BASE } from './_constants'

type YtdSummary = {
  income: number
  savings: number
  expense: number
  avgMonthly: number
  monthCount: number
  savingsRatePct: number
  expenseRatePct: number
}

type KpiSourceSummary = {
  income: number | null
  savings: number | null
  expense: number | null
  avgMonthly: number | null
  monthCount: number | null
  savingsRatePct: number | null
  expenseRatePct: number | null
}

type CardFaceData = {
  title: string
  amount: number | null
  variationPct: number | null
  amountColor?: string
  secondaryText?: string
  watermark: 'expense' | 'income' | 'savings' | 'net'
  tone: KpiBlueTone
}

type KpiBlueTone = 'mist' | 'sky' | 'ocean' | 'ink'

const EMERALD_COLOR = '#0F8B5F'
const CARMINE_COLOR = '#B0303A'
const MONTH_LABELS_UPPER = [
  'JANVIER',
  'FÉVRIER',
  'MARS',
  'AVRIL',
  'MAI',
  'JUIN',
  'JUILLET',
  'AOÛT',
  'SEPTEMBRE',
  'OCTOBRE',
  'NOVEMBRE',
  'DÉCEMBRE',
] as const

const KPI_BLUE_CAMAIEU: Record<
  KpiBlueTone,
  {
    cardBackground: string
    cardBorder: string
    headerBackground: string
    headerBorder: string
  }
> = {
  mist: {
    cardBackground:
      'linear-gradient(156deg, color-mix(in oklab, var(--primary-100) 58%, var(--neutral-0) 42%) 0%, color-mix(in oklab, var(--primary-300) 44%, var(--neutral-0) 56%) 100%)',
    cardBorder: 'color-mix(in oklab, var(--primary-300) 62%, var(--neutral-0) 38%)',
    headerBackground:
      'linear-gradient(135deg, color-mix(in oklab, var(--primary-200) 78%, var(--neutral-0) 22%) 0%, color-mix(in oklab, var(--primary-400) 64%, var(--neutral-0) 36%) 100%)',
    headerBorder: 'color-mix(in oklab, var(--primary-300) 74%, var(--neutral-0) 26%)',
  },
  sky: {
    cardBackground:
      'linear-gradient(156deg, color-mix(in oklab, var(--primary-200) 55%, var(--neutral-0) 45%) 0%, color-mix(in oklab, var(--primary-400) 48%, var(--neutral-0) 52%) 100%)',
    cardBorder: 'color-mix(in oklab, var(--primary-400) 60%, var(--neutral-0) 40%)',
    headerBackground:
      'linear-gradient(135deg, color-mix(in oklab, var(--primary-300) 76%, var(--neutral-0) 24%) 0%, color-mix(in oklab, var(--primary-500) 66%, var(--neutral-0) 34%) 100%)',
    headerBorder: 'color-mix(in oklab, var(--primary-400) 72%, var(--neutral-0) 28%)',
  },
  ocean: {
    cardBackground:
      'linear-gradient(156deg, color-mix(in oklab, var(--primary-300) 52%, var(--neutral-0) 48%) 0%, color-mix(in oklab, var(--primary-500) 52%, var(--neutral-0) 48%) 100%)',
    cardBorder: 'color-mix(in oklab, var(--primary-500) 58%, var(--neutral-0) 42%)',
    headerBackground:
      'linear-gradient(135deg, color-mix(in oklab, var(--primary-400) 72%, var(--neutral-0) 28%) 0%, color-mix(in oklab, var(--primary-600) 64%, var(--neutral-0) 36%) 100%)',
    headerBorder: 'color-mix(in oklab, var(--primary-500) 70%, var(--neutral-0) 30%)',
  },
  ink: {
    cardBackground:
      'linear-gradient(156deg, color-mix(in oklab, var(--primary-400) 46%, var(--neutral-0) 54%) 0%, color-mix(in oklab, var(--primary-600) 55%, var(--neutral-0) 45%) 100%)',
    cardBorder: 'color-mix(in oklab, var(--primary-600) 56%, var(--neutral-0) 44%)',
    headerBackground:
      'linear-gradient(135deg, color-mix(in oklab, var(--primary-500) 72%, var(--neutral-0) 28%) 0%, color-mix(in oklab, var(--primary-700) 62%, var(--neutral-0) 38%) 100%)',
    headerBorder: 'color-mix(in oklab, var(--primary-600) 70%, var(--neutral-0) 30%)',
  },
}

function computeVariationPct(current: number, reference: number): number | null {
  if (reference === 0) return null
  return ((current - reference) / reference) * 100
}

function computeVariationPctNullable(current: number | null, reference: number | null): number | null {
  if (current == null || reference == null) return null
  if (!Number.isFinite(current) || !Number.isFinite(reference)) return null
  return computeVariationPct(current, reference)
}

function formatVariationPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${Math.round(value)}%`
}

function buildYtdSummaries(rows: YtdFlowRow[]): { ytd2025: YtdSummary; ytd2026: YtdSummary } {
  const acc: Record<number, { income: number; savings: number; expense: number; months: Set<number> }> = {
    2025: { income: 0, savings: 0, expense: 0, months: new Set() },
    2026: { income: 0, savings: 0, expense: 0, months: new Set() },
  }

  for (const row of rows) {
    const y = row.period_year
    if (!acc[y]) continue
    acc[y].income += row.income_total
    acc[y].savings += row.savings_realized_total
    acc[y].expense += row.expense_total
    acc[y].months.add(row.period_month)
  }

  const build = (y: number): YtdSummary => {
    const a = acc[y]
    const monthCount = a.months.size || 1
    return {
      income: a.income,
      savings: a.savings,
      expense: a.expense,
      avgMonthly: a.expense / monthCount,
      monthCount,
      savingsRatePct: a.income > 0 ? Math.round((a.savings / a.income) * 100) : 0,
      expenseRatePct: a.income > 0 ? Math.round((a.expense / a.income) * 100) : 0,
    }
  }

  return { ytd2025: build(2025), ytd2026: build(2026) }
}

function toKpiSourceFromYtd(summary: YtdSummary): KpiSourceSummary {
  return {
    income: summary.income,
    savings: summary.savings,
    expense: summary.expense,
    avgMonthly: summary.avgMonthly,
    monthCount: summary.monthCount,
    savingsRatePct: summary.savingsRatePct,
    expenseRatePct: summary.expenseRatePct,
  }
}

type CardId = 'revenus' | 'epargne' | 'depenses' | 'moy-depenses'

type AnnualKeyInsightsGridProps = {
  frameMinHeight?: number
  headerless?: boolean
  carouselMode?: boolean
}

export function AnnualKeyInsightsGrid({
  frameMinHeight,
  headerless = false,
  carouselMode = false,
}: AnnualKeyInsightsGridProps = {}) {
  const [selectedYear, setSelectedYear] = useState<2025 | 2026>(2025)
  const [isFullYearMode, setIsFullYearMode] = useState(false)
  const [modeFlipTick, setModeFlipTick] = useState(0)

  const { data: flowRows = [] } = useQuery({
    queryKey: ['compared-ytd-flows-kpi-cards'],
    queryFn: getComparedYtdFlows,
    staleTime: 15 * 60_000,
  })
  const { annualTotals } = useAnnual2025Analysis()
  const { data: projection2026 } = useAnnualProjectionOverview2026(2026)

  const { ytd2025, ytd2026 } = useMemo(() => buildYtdSummaries(flowRows), [flowRows])

  const ytd2025Summary = useMemo(() => toKpiSourceFromYtd(ytd2025), [ytd2025])
  const ytd2026Summary = useMemo(() => toKpiSourceFromYtd(ytd2026), [ytd2026])

  const full2025Summary = useMemo<KpiSourceSummary>(() => {
    if (!annualTotals) return {
      income: null,
      savings: null,
      expense: null,
      avgMonthly: null,
      monthCount: 12,
      savingsRatePct: null,
      expenseRatePct: null,
    }

    const income = annualTotals.income_total_year
    const savings = annualTotals.savings_total_year
    const expense = annualTotals.expense_total_year

    return {
      income,
      savings,
      expense,
      avgMonthly: annualTotals.avg_monthly_expense,
      monthCount: 12,
      savingsRatePct: income > 0 ? Math.round((savings / income) * 100) : 0,
      expenseRatePct: income > 0 ? Math.round((expense / income) * 100) : 0,
    }
  }, [annualTotals])

  const full2026Summary = useMemo<KpiSourceSummary>(() => {
    const income = projection2026?.projectedRevenueAmount ?? null
    const savings = projection2026?.projectedSavingsAmount ?? null
    const expense = projection2026?.projectedTotalExpensesAmount ?? null

    return {
      income,
      savings,
      expense,
      avgMonthly: expense != null ? expense / 12 : null,
      monthCount: 12,
      savingsRatePct: income != null && income > 0 && savings != null
        ? Math.round((savings / income) * 100)
        : null,
      expenseRatePct: income != null && income > 0 && expense != null
        ? Math.round((expense / income) * 100)
        : null,
    }
  }, [projection2026])

  const shown2025 = isFullYearMode ? full2025Summary : ytd2025Summary
  const shown2026 = isFullYearMode ? full2026Summary : ytd2026Summary
  const cardsFlipped = selectedYear === 2026

  const handleYearSelect = (year: 2025 | 2026) => {
    setSelectedYear(year)
  }

  const frontCards: Array<{ id: CardId; face: CardFaceData }> = [
    {
      id: 'revenus',
      face: {
        title: 'Revenus',
        amount: shown2025.income,
        variationPct: computeVariationPctNullable(shown2025.income, shown2026.income),
        amountColor: 'var(--primary-600)',
        secondaryText: `sur ${shown2025.monthCount ?? 0} mois`,
        watermark: 'income',
        tone: 'mist',
      },
    },
    {
      id: 'epargne',
      face: {
        title: 'Épargne',
        amount: shown2025.savings,
        variationPct: computeVariationPctNullable(shown2025.savings, shown2026.savings),
        amountColor: EMERALD_COLOR,
        secondaryText: shown2025.savingsRatePct == null ? undefined : `${shown2025.savingsRatePct}% des revenus`,
        watermark: 'savings',
        tone: 'sky',
      },
    },
    {
      id: 'depenses',
      face: {
        title: 'Dépenses',
        amount: shown2025.expense,
        variationPct: computeVariationPctNullable(shown2025.expense, shown2026.expense),
        amountColor: CARMINE_COLOR,
        secondaryText: shown2025.expenseRatePct == null ? undefined : `${shown2025.expenseRatePct}% des revenus`,
        watermark: 'expense',
        tone: 'ocean',
      },
    },
    {
      id: 'moy-depenses',
      face: {
        title: 'Moyenne',
        amount: shown2025.avgMonthly,
        variationPct: computeVariationPctNullable(shown2025.avgMonthly, shown2026.avgMonthly),
        amountColor: '#B8720A',
        secondaryText: 'dépensés/mois',
        watermark: 'net',
        tone: 'ink',
      },
    },
  ]

  const backById: Record<CardId, CardFaceData> = {
    revenus: {
      title: 'Revenus',
      amount: shown2026.income,
      variationPct: computeVariationPctNullable(shown2026.income, shown2025.income),
      amountColor: 'var(--primary-600)',
      secondaryText: `sur ${shown2026.monthCount ?? 0} mois`,
      watermark: 'income',
      tone: 'mist',
    },
    epargne: {
      title: 'Épargne',
      amount: shown2026.savings,
      variationPct: computeVariationPctNullable(shown2026.savings, shown2025.savings),
      amountColor: EMERALD_COLOR,
      secondaryText: shown2026.savingsRatePct == null ? undefined : `${shown2026.savingsRatePct}% des revenus`,
      watermark: 'savings',
      tone: 'sky',
    },
    depenses: {
      title: 'Dépenses',
      amount: shown2026.expense,
      variationPct: computeVariationPctNullable(shown2026.expense, shown2025.expense),
      amountColor: CARMINE_COLOR,
      secondaryText: shown2026.expenseRatePct == null ? undefined : `${shown2026.expenseRatePct}% des revenus`,
      watermark: 'expense',
      tone: 'ocean',
    },
    'moy-depenses': {
      title: 'Moyenne',
      amount: shown2026.avgMonthly,
      variationPct: computeVariationPctNullable(shown2026.avgMonthly, shown2025.avgMonthly),
      amountColor: '#B8720A',
      secondaryText: 'dépensés/mois',
      watermark: 'net',
      tone: 'ink',
    },
  }

  const monthCount = Math.max(1, Math.min(12, ytd2025.monthCount))
  const analyzedPeriodLabel = `${MONTH_LABELS_UPPER[0]} -> ${MONTH_LABELS_UPPER[monthCount - 1]}`

  const cardMinHeight = carouselMode ? 118 : 112

  return (
    <section style={{ marginTop: headerless ? 0 : 'var(--space-3)', width: '100%', boxSizing: 'border-box', overflowX: 'clip' }}>

      {!headerless ? (
        <>
          {/* ── Period banner ── */}
          <div style={{ padding: '0 var(--space-6)', width: '100%', boxSizing: 'border-box' }}>
            <div style={{
              maxWidth: 600,
              margin: '0 auto',
              background: 'linear-gradient(135deg, color-mix(in oklab, var(--color-warning) 85%, #000 15%) 0%, color-mix(in oklab, var(--color-warning) 68%, #000 32%) 58%, color-mix(in oklab, var(--color-warning) 52%, #000 48%) 100%)',
              padding: '8px var(--space-5)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-3)',
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0, width: '100%' }}>
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, minWidth: 0, whiteSpace: 'nowrap' }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#fff',
                    letterSpacing: '0.03em',
                  }}>
                    période analysée :
                  </span>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#fff',
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {analyzedPeriodLabel}
                  </span>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#fff',
                    letterSpacing: '0.03em',
                  }}>
                    ({monthCount} mois)
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div style={{ padding: '0 var(--space-6)', marginTop: 'var(--space-6)', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <h3 style={{
                margin: 0,
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--neutral-900)',
              }}>
                Analyse comparée des flux
              </h3>
            </div>
          </div>
        </>
      ) : null}

      {/* ── KPI Cards ── */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 var(--space-6)', marginTop: headerless ? 0 : 'var(--space-5)', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ ...CARD_BASE, padding: 'var(--space-4)', minHeight: frameMinHeight, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            margin: carouselMode ? '0 0 var(--space-4)' : '0 0 var(--space-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-2)',
          }}>
            <p style={{
              margin: 0,
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
              color: 'var(--neutral-700)',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              Princpaux flux
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => {
                  setIsFullYearMode((prev) => !prev)
                  setModeFlipTick((prev) => prev + 1)
                }}
                aria-pressed={isFullYearMode}
                aria-label="Basculer le mode Full"
                style={{
                  width: 44,
                  height: 20,
                  borderRadius: 'var(--radius-full)',
                  background: isFullYearMode ? '#FFFFFF' : '#C0C7D1',
                  color: '#111111',
                  fontSize: 9,
                  fontWeight: 'var(--font-weight-bold)',
                  cursor: 'pointer',
                  transition: 'all 160ms ease-in-out',
                  border: isFullYearMode ? '1.5px solid #FFAB2E' : '1.5px solid #3F4752',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  boxShadow: isFullYearMode ? '0 1px 5px rgba(13,13,31,0.12)' : 'none',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Full
              </button>

              <YearPill year={2025} selected={selectedYear === 2025} onSelect={() => handleYearSelect(2025)} />
              <YearPill year={2026} selected={selectedYear === 2026} onSelect={() => handleYearSelect(2026)} />
            </div>
          </div>
          <div style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: carouselMode ? 'var(--space-3)' : 'var(--space-2)',
            alignContent: carouselMode ? 'space-around' : 'start',
          }}>
            {frontCards.map(({ id, face }) => (
              <FlipInsightCard
                key={id}
                front={face}
                back={backById[id] ?? face}
                flipped={cardsFlipped}
                fullMode={isFullYearMode}
                modeFlipTick={modeFlipTick}
                cardMinHeight={cardMinHeight}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes kpi-mode-flip-vertical {
          0% {
            transform: perspective(980px) rotateX(-116deg) translateY(-9px) scale(0.97);
            opacity: 0.58;
          }
          52% {
            transform: perspective(980px) rotateX(16deg) translateY(2px) scale(1.01);
            opacity: 1;
          }
          76% {
            transform: perspective(980px) rotateX(-5deg) translateY(0) scale(0.998);
            opacity: 1;
          }
          100% {
            transform: perspective(980px) rotateX(0deg) translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </section>
  )
}

function YearPill({
  year,
  selected,
  onSelect,
}: {
  year: 2025 | 2026
  selected: boolean
  onSelect: () => void
}) {
  const backgroundColor = year === 2025 ? '#FFAB2E' : '#002FA7'

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        padding: '4px 9px',
        borderRadius: 'var(--radius-full)',
        border: 'none',
        background: backgroundColor,
        color: '#FFFFFF',
        fontSize: '10px',
        fontWeight: 'var(--font-weight-bold)',
        cursor: 'pointer',
        transition: 'opacity 200ms ease-in-out',
        opacity: selected ? 1 : 0.4,
        letterSpacing: '0.05em',
      }}
    >
      {year}
    </button>
  )
}

function FlipInsightCard({
  front,
  back,
  flipped,
  fullMode,
  modeFlipTick,
  cardMinHeight,
}: {
  front: CardFaceData
  back: CardFaceData
  flipped: boolean
  fullMode: boolean
  modeFlipTick: number
  cardMinHeight: number
}) {
  const flipDurationMs = 260

  return (
    <div style={{ width: '100%', perspective: 900 }}>
      <span
        key={modeFlipTick}
        style={{
          transformOrigin: '50% 0%',
          animation: modeFlipTick > 0 ? 'kpi-mode-flip-vertical 620ms cubic-bezier(0.2, 0.88, 0.22, 1)' : 'none',
          display: 'block',
          willChange: 'transform, opacity',
        }}
      >
        <span
          style={{
            position: 'relative',
            display: 'block',
            minHeight: cardMinHeight,
            transformStyle: 'preserve-3d',
            transition: `transform ${flipDurationMs}ms cubic-bezier(0.23, 0.91, 0.3, 1)`,
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          <span style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}>
            <CardFace face={front} visible={!flipped} isBack={false} flipDurationMs={flipDurationMs} fullMode={fullMode} cardMinHeight={cardMinHeight} />
          </span>
          <span style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <CardFace face={back} visible={flipped} isBack flipDurationMs={flipDurationMs} fullMode={fullMode} cardMinHeight={cardMinHeight} />
          </span>
        </span>
      </span>
    </div>
  )
}

function CardFace({
  face,
  visible,
  isBack,
  flipDurationMs,
  fullMode,
  cardMinHeight,
}: {
  face: CardFaceData
  visible: boolean
  isBack: boolean
  flipDurationMs: number
  fullMode: boolean
  cardMinHeight: number
}) {
  const yearText = isBack ? '2026' : '2025'
  const yearBadgeColor = isBack ? '#002FA7' : '#FF9A00'
  const yearBadgeText = fullMode ? (isBack ? 'Full-26' : 'Full-25') : yearText
  const yearBadgeBackground = fullMode ? '#C0C7D1' : yearBadgeColor
  const yearBadgeForeground = fullMode ? '#111111' : '#FFFFFF'
  const yearTransitionDelay = visible ? Math.round(flipDurationMs * 0.34) : 0
  const tone = KPI_BLUE_CAMAIEU[face.tone]
  const variationColor = face.variationPct == null
    ? 'var(--neutral-500)'
    : face.variationPct >= 0
      ? EMERALD_COLOR
      : CARMINE_COLOR

  const fullModeCardBorder = fullMode
    ? '2.5px solid #C0C7D1'
    : `1px solid ${tone.cardBorder}`
  const fullModeCardShadow = fullMode
    ? [
        '0 0 0 1px rgba(226,232,240,0.95)',
        '0 10px 24px rgba(123,133,148,0.32)',
        '0 2px 10px rgba(80,88,102,0.22)',
        'inset 0 1px 0 rgba(255,255,255,0.92)',
        'inset 0 0 0 1px rgba(255,255,255,0.38)',
      ].join(', ')
    : 'none'

  return (
    <span style={{
      position: 'relative',
      background: tone.cardBackground,
      borderRadius: 'var(--radius-lg)',
      border: fullModeCardBorder,
      padding: 0,
      boxShadow: fullModeCardShadow,
      display: 'flex',
      flexDirection: 'column',
      minHeight: cardMinHeight,
      minWidth: 0,
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      {/* Header: title + variation left, year pill right */}
      <span style={{
        width: '100%',
        minHeight: 27,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        padding: '5px 8px 4px 8px',
        background: tone.headerBackground,
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.58),
          inset 0 -1px 0 rgba(0,0,0,0.08),
          0 4px 10px rgba(13,13,31,0.1)
        `,
        borderBottom: fullMode ? '2px solid #C0C7D1' : `1px solid ${tone.headerBorder}`,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 9,
          fontWeight: 800,
          color: 'var(--neutral-900)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'left',
          flex: 1,
        }}>
          {face.title}{' '}
          <span style={{ color: variationColor, fontFamily: 'var(--font-mono)', letterSpacing: '0.01em', fontSize: 9 }}>
            {formatVariationPct(face.variationPct)}
          </span>
        </span>
        <span style={{
          minWidth: fullMode ? 48 : 32,
          height: 15,
          borderRadius: 999,
          padding: fullMode ? '0 8px' : '0 7px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: yearBadgeBackground,
          color: yearBadgeForeground,
          fontSize: 8,
          fontWeight: 800,
          letterSpacing: fullMode ? '0.03em' : '0.06em',
          lineHeight: 1,
          boxShadow: fullMode
            ? '0 1px 4px rgba(13,13,31,0.12), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 0 0 1px rgba(155,164,176,0.45)'
            : '0 1px 4px rgba(13,13,31,0.18), inset 0 1px 0 rgba(255,255,255,0.2)',
          opacity: visible ? 1 : 0,
          transition: `opacity 110ms ease ${yearTransitionDelay}ms`,
          flexShrink: 0,
        }}>
          {yearBadgeText}
        </span>
      </span>

      {/* Body: amount bold centered + secondary text below */}
      <span style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 8px 10px',
        gap: 4,
        overflow: 'hidden',
      }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 3,
            bottom: 2,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-start',
            pointerEvents: 'none',
            opacity: 0.18,
          }}
        >
          <KpiWatermarkIcon kind={face.watermark} />
        </span>

        <span style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          fontSize: 'calc(var(--font-size-base) + 1px)',
          fontWeight: 800,
          color: face.amountColor ?? 'var(--neutral-900)',
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.01em',
          lineHeight: 1.15,
        }}>
          {face.amount != null ? formatCurrency(face.amount) : '—'}
        </span>

        {face.secondaryText ? (
          <span style={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--neutral-700)',
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
          }}>
            {face.secondaryText}
          </span>
        ) : null}

        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 3,
            bottom: 2,
            fontSize: 22,
            fontWeight: 900,
            fontFamily: 'var(--font-mono)',
            color: 'rgba(255,255,255,0.31)',
            lineHeight: 1,
            letterSpacing: '-0.03em',
            userSelect: 'none',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          {yearText.slice(-2)}
        </span>
      </span>
    </span>
  )
}

function KpiWatermarkIcon({ kind }: { kind: CardFaceData['watermark'] }) {
  if (kind === 'expense') {
    return <ArrowUpCircle size={28} strokeWidth={2} color={CARMINE_COLOR} />
  }
  if (kind === 'income') {
    return <ArrowDownCircle size={28} strokeWidth={2} color={EMERALD_COLOR} />
  }
  if (kind === 'savings') {
    return (
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 'var(--radius-full)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-warning)',
          color: '#111111',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        €
      </span>
    )
  }
  return <RotateCw size={24} strokeWidth={2.1} color="#111111" />
}
