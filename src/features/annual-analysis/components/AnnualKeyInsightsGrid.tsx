import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatCurrencyRounded as formatCurrency } from '@/lib/utils'
import { getComparedYtdFlows } from '@/features/annual-analysis/api/getComparedYtdFlows'
import type { YtdFlowRow } from '@/features/annual-analysis/types.compared'

type YtdSummary = {
  income: number
  savings: number
  expense: number
  avgMonthly: number
  savingsRatePct: number
  expenseRatePct: number
}

type CardFaceData = {
  title: string
  amount: number | null
  amountColor?: string
  secondaryText?: string
  tone: KpiBlueTone
}

type KpiBlueTone = 'mist' | 'sky' | 'ocean' | 'ink'

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

function buildYtdSummaries(rows: YtdFlowRow[]): { ytd2025: YtdSummary; ytd2026: YtdSummary } {
  const acc: Record<number, { income: number; savings: number; expense: number; months: Set<number> }> = {
    2025: { income: 0, savings: 0, expense: 0, months: new Set() },
    2026: { income: 0, savings: 0, expense: 0, months: new Set() },
  }

  for (const row of rows) {
    const y = row.period_year
    if (!acc[y]) continue
    acc[y].income += row.income_total
    acc[y].savings += row.savings_capacity_observed
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
      savingsRatePct: a.income > 0 ? Math.round((a.savings / a.income) * 100) : 0,
      expenseRatePct: a.income > 0 ? Math.round((a.expense / a.income) * 100) : 0,
    }
  }

  return { ytd2025: build(2025), ytd2026: build(2026) }
}

const CARD_IDS = ['revenus', 'epargne', 'depenses', 'moy-depenses'] as const
type CardId = (typeof CARD_IDS)[number]

export function AnnualKeyInsightsGrid() {
  const [selectedYear, setSelectedYear] = useState<2025 | 2026>(2025)
  const [flippedByCard, setFlippedByCard] = useState<Record<string, boolean>>({})

  const { data: flowRows = [] } = useQuery({
    queryKey: ['compared-ytd-flows-kpi-cards'],
    queryFn: getComparedYtdFlows,
    staleTime: 15 * 60_000,
  })

  const { ytd2025, ytd2026 } = useMemo(() => buildYtdSummaries(flowRows), [flowRows])

  const handleYearSelect = (year: 2025 | 2026) => {
    setSelectedYear(year)
    setFlippedByCard(Object.fromEntries(CARD_IDS.map((id) => [id, year === 2026])))
  }

  const frontCards: Array<{ id: CardId; face: CardFaceData }> = [
    {
      id: 'revenus',
      face: { title: 'Revenus', amount: ytd2025.income, amountColor: 'var(--primary-600)', tone: 'mist' },
    },
    {
      id: 'epargne',
      face: {
        title: 'Épargne',
        amount: ytd2025.savings,
        amountColor: '#1A9E56',
        secondaryText: `${ytd2025.savingsRatePct}% des revenus`,
        tone: 'sky',
      },
    },
    {
      id: 'depenses',
      face: {
        title: 'Dépenses',
        amount: ytd2025.expense,
        amountColor: '#D93B3B',
        secondaryText: `${ytd2025.expenseRatePct}% des revenus`,
        tone: 'ocean',
      },
    },
    {
      id: 'moy-depenses',
      face: { title: 'Moy. dépenses', amount: ytd2025.avgMonthly, amountColor: '#B8720A', secondaryText: 'par mois', tone: 'ink' },
    },
  ]

  const backById: Record<CardId, CardFaceData> = {
    revenus: { title: 'Revenus', amount: ytd2026.income, amountColor: 'var(--primary-600)', tone: 'mist' },
    epargne: {
      title: 'Épargne',
      amount: ytd2026.savings,
      amountColor: '#1A9E56',
      secondaryText: `${ytd2026.savingsRatePct}% des revenus`,
      tone: 'sky',
    },
    depenses: {
      title: 'Dépenses',
      amount: ytd2026.expense,
      amountColor: '#D93B3B',
      secondaryText: `${ytd2026.expenseRatePct}% des revenus`,
      tone: 'ocean',
    },
    'moy-depenses': { title: 'Moy. dépenses', amount: ytd2026.avgMonthly, amountColor: '#B8720A', secondaryText: 'par mois', tone: 'ink' },
  }

  return (
    <section style={{ marginTop: 'var(--space-3)' }}>

      {/* ── Period banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, color-mix(in oklab, var(--color-warning) 85%, #000 15%) 0%, color-mix(in oklab, var(--color-warning) 68%, #000 32%) 58%, color-mix(in oklab, var(--color-warning) 52%, #000 48%) 100%)',
        padding: '8px var(--space-5)',
        margin: '0 var(--space-6)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <YearPill year={2025} selected={selectedYear === 2025} onSelect={() => handleYearSelect(2025)} />
          <YearPill year={2026} selected={selectedYear === 2026} onSelect={() => handleYearSelect(2026)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#fff',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
          }}>
            Janvier – Avril
          </span>
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.75)',
            background: 'rgba(0,0,0,0.20)',
            borderRadius: 'var(--radius-full)',
            padding: '2px 7px',
            letterSpacing: '0.05em',
          }}>
            4 mois
          </span>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 var(--space-6)' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-3)',
        }}>
          {frontCards.map(({ id, face }) => (
            <FlipInsightCard
              key={id}
              front={face}
              back={backById[id] ?? face}
              flipped={Boolean(flippedByCard[id])}
              onToggle={() => {
                setFlippedByCard((prev) => ({ ...prev, [id]: !prev[id] }))
              }}
            />
          ))}
        </div>
      </div>
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
        padding: '5px 12px',
        borderRadius: 'var(--radius-full)',
        border: 'none',
        background: backgroundColor,
        color: '#FFFFFF',
        fontSize: '11px',
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
  onToggle,
}: {
  front: CardFaceData
  back: CardFaceData
  flipped: boolean
  onToggle: () => void
}) {
  const flipDurationMs = 260

  return (
    <button
      type="button"
      aria-pressed={flipped}
      onClick={onToggle}
      style={{
        width: '100%',
        border: 'none',
        background: 'transparent',
        padding: 0,
        cursor: 'pointer',
        perspective: 900,
      }}
    >
      <span
        style={{
          position: 'relative',
          display: 'block',
          minHeight: 118,
          transformStyle: 'preserve-3d',
          transition: `transform ${flipDurationMs}ms cubic-bezier(0.23, 0.91, 0.3, 1)`,
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        <span style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}>
          <CardFace face={front} visible={!flipped} isBack={false} flipDurationMs={flipDurationMs} />
        </span>
        <span style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          <CardFace face={back} visible={flipped} isBack flipDurationMs={flipDurationMs} />
        </span>
      </span>
    </button>
  )
}

function CardFace({
  face,
  visible,
  isBack,
  flipDurationMs,
}: {
  face: CardFaceData
  visible: boolean
  isBack: boolean
  flipDurationMs: number
}) {
  const yearText = isBack ? '2026' : '2025'
  const yearBadgeColor = isBack ? '#002FA7' : '#FF9A00'
  const yearTransitionDelay = visible ? Math.round(flipDurationMs * 0.34) : 0
  const tone = KPI_BLUE_CAMAIEU[face.tone]

  return (
    <span style={{
      position: 'relative',
      background: tone.cardBackground,
      borderRadius: 'var(--radius-lg)',
      border: `1px solid ${tone.cardBorder}`,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 118,
      minWidth: 0,
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      {/* Header: title left, year pill right */}
      <span style={{
        width: '100%',
        minHeight: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        padding: '5px 8px 4px 10px',
        background: tone.headerBackground,
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.58),
          inset 0 -1px 0 rgba(0,0,0,0.08),
          0 4px 10px rgba(13,13,31,0.1)
        `,
        borderBottom: `1px solid ${tone.headerBorder}`,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 10,
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
          {face.title}
        </span>
        <span style={{
          minWidth: 34,
          height: 16,
          borderRadius: 999,
          padding: '0 8px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: yearBadgeColor,
          color: '#FFFFFF',
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: '0.06em',
          lineHeight: 1,
          boxShadow: '0 1px 4px rgba(13,13,31,0.18), inset 0 1px 0 rgba(255,255,255,0.2)',
          opacity: visible ? 1 : 0,
          transition: `opacity 110ms ease ${yearTransitionDelay}ms`,
          flexShrink: 0,
        }}>
          {yearText}
        </span>
      </span>

      {/* Body: amount bold centered + secondary text below */}
      <span style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 10px 12px',
        gap: 4,
      }}>
        <span style={{
          textAlign: 'center',
          fontSize: 'var(--font-size-base)',
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
            textAlign: 'center',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--neutral-700)',
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
          }}>
            {face.secondaryText}
          </span>
        ) : null}
      </span>
    </span>
  )
}
