import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, X } from 'lucide-react'
import epargneInteretsIcon from '@/assets/icons/categories/epargne_interets.webp'
import epargnePlacementIcon from '@/assets/icons/categories/epargne_placement.webp'
import epargneVirementIcon from '@/assets/icons/categories/epargne_virement.webp'
import {
  CartesianGrid,
  Customized,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { useSavingsEvolutionFiveYears } from '@/features/savings/hooks/useSavingsEvolutionFiveYears'
import { EmptyState, SkeletonCard, StatsSection } from '@/features/stats/components/ui'
import type { SavingsEvolutionFiveYearsSeries, SavingsEvolutionFiveYearsRow, SavingsEvolutionOperationEvent } from '@/features/savings/types'
import { SavingsPortfolioModal } from '@/features/savings/components/SavingsPortfolioModal'
import amundiEpargneIcon from '@/assets/icons/accounts/amundi_epargne.webp'
import bitcoinIcon from '@/assets/icons/accounts/bitcoin.webp'
import peaIcon from '@/assets/icons/accounts/boursorama_pea.png'
import comptePrincipalIcon from '@/assets/icons/accounts/compte_principal_banque_populaire.webp'
import pegCapgeminiIcon from '@/assets/icons/accounts/peg_capgemini.png'
import { resolveSavingsPortfolioColor } from '@/features/savings/utils/savingsPortfolioColor'

const EURO_ROUNDED = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

type DisplayMode = 'portfolio' | 'overview'

type StyledSeries = SavingsEvolutionFiveYearsSeries & {
  shortLabel: string
  iconSrc: string
}

type OperationBubbleState = {
  event: SavingsEvolutionOperationEvent
  color: string
  x: number
  y: number
}

type YearBubbleState = {
  year: string
  x: number
  y: number
}

const LEGEND_ORDER: Record<string, number> = {
  'liv a': 0,
  'livr a': 0,
  'livret a': 0,
  pea: 1,
  per: 2,
  ldds: 3,
  peg: 4,
  bitcoin: 5,
}

const MODE_OPTIONS: Array<{ label: string; value: DisplayMode }> = [
  { label: 'Portefeuilles', value: 'portfolio' },
  { label: "Vue d'ensemble", value: 'overview' },
]

const PCT_INTEGER = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const PCT_ONE_DECIMAL = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function hasWord(normalized: string, word: string): boolean {
  const pattern = new RegExp(`\\b${word}\\b`, 'i')
  return pattern.test(normalized)
}

function resolveLegendLabel(label: string): string {
  const normalized = normalizeLabel(label)
  if (normalized.includes('livret a')) return 'Livret A'
  if (hasWord(normalized, 'peg') || normalized.includes('capgemini')) return 'PEG'
  if (hasWord(normalized, 'per') || normalized.includes('plan epargne retraite')) return 'PER'
  if (hasWord(normalized, 'bitcoin') || normalized.includes('wallet bitcoin')) return 'BTC'
  return label
}

function resolveSeriesIcon(label: string, family: 'livrets' | 'placements'): string {
  const normalized = normalizeLabel(label)
  if (hasWord(normalized, 'per') || normalized.includes('plan epargne retraite')) return comptePrincipalIcon
  if (hasWord(normalized, 'pea')) return peaIcon
  if (hasWord(normalized, 'peg') || normalized.includes('capgemini')) return pegCapgeminiIcon
  if (hasWord(normalized, 'bitcoin') || normalized.includes('wallet bitcoin')) return bitcoinIcon
  if (hasWord(normalized, 'perco') || hasWord(normalized, 'percol') || normalized.includes('amundi')) return amundiEpargneIcon
  if (family === 'livrets') return comptePrincipalIcon
  return amundiEpargneIcon
}

function resolveListLabel(label: string): string {
  const normalized = normalizeLabel(label)
  if (hasWord(normalized, 'peg') || normalized.includes('capgemini')) return 'PEG'
  if (hasWord(normalized, 'per') || normalized.includes('plan epargne retraite')) return 'PER'
  if (hasWord(normalized, 'bitcoin') || normalized.includes('wallet bitcoin') || normalized.includes('wallet bitcon')) return 'BTC'
  return label
}

function formatCurrency(value: number): string {
  return EURO_ROUNDED.format(value).replace(/\s+€/u, '€')
}

function formatSignedCurrency(value: number): string {
  const abs = formatCurrency(Math.abs(value))
  if (value > 0) return `+${abs}`
  if (value < 0) return `-${abs}`
  return abs
}

function formatVariation(current: number, previous: number): string {
  if (!Number.isFinite(previous) || previous <= 0) return '—'
  const delta = ((current - previous) / previous) * 100
  if (!Number.isFinite(delta)) return '—'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${PCT_INTEGER.format(delta)}%`
}

function formatOperationDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatYAxisCompact(value: number): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '0'
  const abs = Math.abs(numeric)
  if (abs >= 1000) {
    const scaled = numeric / 1000
    const roundedInt = Math.round(scaled)
    if (Math.abs(scaled - roundedInt) < 0.05) return `${roundedInt}k`
    return `${scaled.toFixed(1).replace('.', ',')}k`
  }
  return String(Math.round(numeric))
}

function buildAccountTimeline(
  accountKey: string,
  allOperations: SavingsEvolutionOperationEvent[],
  rows: SavingsEvolutionFiveYearsRow[],
  windowStartYear: number,
  todayStr: string,
): Array<{ date: string; balance: number }> {
  const seedRow = rows.find((r) => Number(r.year) === windowStartYear - 1)
  let running = seedRow ? Math.max(0, Number(seedRow[accountKey] ?? 0)) : 0

  const windowStartDate = `${windowStartYear}-01-01`
  const points: Array<{ date: string; balance: number }> = [
    { date: windowStartDate, balance: running },
  ]

  const dateGroups = new Map<string, number>()
  for (const op of allOperations) {
    if (op.account_key !== accountKey) continue
    if (op.transaction_date < windowStartDate || op.transaction_date > todayStr) continue
    dateGroups.set(op.transaction_date, (dateGroups.get(op.transaction_date) ?? 0) + op.amount)
  }

  for (const [date, total] of [...dateGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    running = Math.max(0, running + total)
    points.push({ date, balance: running })
  }

  if (todayStr > (points[points.length - 1]?.date ?? '')) {
    points.push({ date: todayStr, balance: running })
  }

  return points
}

export function SavingsEvolutionFiveYearsChart() {
  const { data, isLoading, error } = useSavingsEvolutionFiveYears()
  const [displayMode, setDisplayMode] = useState<DisplayMode>('portfolio')
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false)
  const [isolatedSeriesKey, setIsolatedSeriesKey] = useState<string | null>(null)
  const [selectedOverviewYear, setSelectedOverviewYear] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<string | null>(null)
  const [selectedOperationBubble, setSelectedOperationBubble] = useState<OperationBubbleState | null>(null)
  const [selectedYearBubble, setSelectedYearBubble] = useState<YearBubbleState | null>(null)
  const [selectedPortfolioKey, setSelectedPortfolioKey] = useState<string | null>(null)
  const [showAllOpsModal, setShowAllOpsModal] = useState(false)

  const handleClosePortfolioModal = useCallback(() => {
    setSelectedPortfolioKey(null)
  }, [])

  const rows = useMemo(() => data?.rows ?? [], [data?.rows])
  const series = useMemo(() => data?.series ?? [], [data?.series])
  const yearlyAccountMetrics = useMemo(() => data?.yearly_account_metrics ?? {}, [data?.yearly_account_metrics])
  const operationEvents = useMemo(() => data?.operation_events ?? [], [data?.operation_events])

  const styledSeries: StyledSeries[] = useMemo(() => series.map((entry) => ({
    ...entry,
    shortLabel: resolveLegendLabel(entry.label),
    color: resolveSavingsPortfolioColor({
      key: entry.key,
      label: entry.label,
      savingsKind: entry.savings_kind,
      fallbackColor: entry.color,
    }),
    iconSrc: resolveSeriesIcon(entry.label, entry.family),
  })), [series])

  const styledSeriesMap = useMemo(
    () => new Map(styledSeries.map((s) => [s.key, s])),
    [styledSeries],
  )

  const orderedLegendSeries = useMemo(() => [...styledSeries].sort((a, b) => {
    const aKey = normalizeLabel(a.shortLabel)
    const bKey = normalizeLabel(b.shortLabel)
    const aRank = LEGEND_ORDER[aKey] ?? 99
    const bRank = LEGEND_ORDER[bKey] ?? 99
    if (aRank !== bRank) return aRank - bRank
    return a.shortLabel.localeCompare(b.shortLabel, 'fr')
  }), [styledSeries])

  const visibleSeries = useMemo(() => {
    if (isolatedSeriesKey !== null) return styledSeries.filter((s) => s.key === isolatedSeriesKey)
    return styledSeries
  }, [styledSeries, isolatedSeriesKey])

  const chartRows = useMemo(() => [...rows].sort((a, b) => Number(a.year) - Number(b.year)), [rows])
  const visibleYears = useMemo(() => new Set(chartRows.map((row) => row.year)), [chartRows])
  const visibleSeriesKeys = useMemo(() => new Set(visibleSeries.map((entry) => entry.key)), [visibleSeries])
  const isAllPortfoliosSelected = isolatedSeriesKey === null

  const operationEventsForList = useMemo(
    () => operationEvents
      .filter((event) => visibleSeriesKeys.has(event.account_key))
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()),
    [operationEvents, visibleSeriesKeys],
  )

  const opsCumulativeByEventId = useMemo(() => {
    const opsAsc = [...operationEventsForList].sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime())
    const runningByAccount = new Map<string, number>()
    const cumulativeByEventId = new Map<string, number>()

    for (const op of opsAsc) {
      const current = runningByAccount.get(op.account_key) ?? 0
      const next = op.amount > 0 && op.nature !== 'intérêts' ? current + op.amount : current
      runningByAccount.set(op.account_key, next)
      cumulativeByEventId.set(op.id, next)
    }

    return cumulativeByEventId
  }, [operationEventsForList])

  const operationGroupsForList = useMemo(() => {
    const grouped = new Map<string, SavingsEvolutionOperationEvent[]>()
    for (const event of operationEventsForList) {
      const existing = grouped.get(event.account_key)
      if (existing) existing.push(event)
      else grouped.set(event.account_key, [event])
    }

    return orderedLegendSeries
      .filter((entry) => grouped.has(entry.key))
      .map((entry) => ({
        accountKey: entry.key,
        accountLabel: resolveListLabel(entry.shortLabel),
        events: grouped.get(entry.key) ?? [],
      }))
  }, [operationEventsForList, orderedLegendSeries])

  const shouldGroupOperationsByAccount = isAllPortfoliosSelected && operationGroupsForList.length > 1

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const windowStartYear = useMemo(
    () => Number(chartRows[0]?.year ?? new Date().getFullYear()),
    [chartRows],
  )
  const windowStartDate = useMemo(() => `${windowStartYear}-01-01`, [windowStartYear])

  const accountTimelines = useMemo(() => {
    const timelines = new Map<string, Array<{ date: string; balance: number }>>()
    for (const entry of styledSeries) {
      timelines.set(
        entry.key,
        buildAccountTimeline(entry.key, operationEvents, rows, windowStartYear, today),
      )
    }
    return timelines
  }, [styledSeries, operationEvents, rows, windowStartYear, today])

  const granularChartData = useMemo(() => {
    const allDates = new Set<string>()
    const endYear = new Date().getFullYear()
    for (let y = windowStartYear; y <= endYear; y++) allDates.add(`${y}-01-01`)
    allDates.add(today)
    for (const key of visibleSeriesKeys) {
      const tl = accountTimelines.get(key)
      if (tl) for (const pt of tl) allDates.add(pt.date)
    }
    const sorted = [...allDates].sort()
    const lookups = new Map<string, Map<string, number>>()
    for (const [key, tl] of accountTimelines.entries()) {
      const m = new Map<string, number>()
      for (const pt of tl) m.set(pt.date, pt.balance)
      lookups.set(key, m)
    }
    return sorted.map((date) => {
      const row: Record<string, string | number> = { date }
      for (const [key, lookup] of lookups.entries()) {
        if (lookup.has(date)) row[key] = lookup.get(date)!
      }
      return row
    })
  }, [accountTimelines, visibleSeriesKeys, windowStartYear, today])

  const xAxisTicks = useMemo(() => {
    const ticks: string[] = []
    const endYear = new Date().getFullYear()
    for (let y = windowStartYear; y <= endYear; y++) ticks.push(`${y}-01-01`)
    return ticks
  }, [windowStartYear])

  const visibleOperationEvents = useMemo(() => (
    operationEvents.filter((event) =>
      visibleSeriesKeys.has(event.account_key) &&
      event.transaction_date >= windowStartDate &&
      event.transaction_date <= today
    )
  ), [operationEvents, visibleSeriesKeys, windowStartDate, today])

  const operationEventIds = useMemo(
    () => new Set(visibleOperationEvents.map((e) => e.id)),
    [visibleOperationEvents],
  )

  const selectedYearRow = useMemo(() => {
    const fallbackYear = chartRows[chartRows.length - 1]?.year
    const yearToUse = selectedYear ?? fallbackYear
    if (!yearToUse) return null
    return chartRows.find((row) => row.year === yearToUse) ?? null
  }, [chartRows, selectedYear])

  const previousYearRow = useMemo(() => {
    if (!selectedYearRow?.year) return null
    const prevYear = String(Number(selectedYearRow.year) - 1)
    return rows.find((row) => row.year === prevYear) ?? null
  }, [selectedYearRow, rows])

  const totalSavingsByYear = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of rows) {
      const year = String(row.year ?? '')
      if (!year) continue
      const total = styledSeries.reduce((accumulator, serie) => {
        const value = Number(row[serie.key] ?? 0)
        return accumulator + (Number.isFinite(value) ? value : 0)
      }, 0)
      map.set(year, total)
    }
    return map
  }, [rows, styledSeries])

  const yAxisMax = useMemo(() => {
    if (granularChartData.length === 0 || styledSeries.length === 0) return undefined
    let max = 0
    for (const row of granularChartData) {
      for (const s of styledSeries) {
        const v = Number(row[s.key] ?? 0)
        if (Number.isFinite(v) && v > max) max = v
      }
    }
    if (max === 0) return undefined
    const exp = 10 ** Math.floor(Math.log10(max))
    return Math.ceil(max / exp) * exp
  }, [granularChartData, styledSeries])

  const selectedYearMetrics = useMemo(() => {
    const year = selectedYearBubble?.year ?? selectedYear ?? selectedYearRow?.year ?? null
    if (!year) return null
    const yearTotal = totalSavingsByYear.get(year) ?? 0
    const previousYear = String(Number(year) - 1)
    const openingAmount = totalSavingsByYear.get(previousYear) ?? yearTotal
    const delta = yearTotal - openingAmount
    const deltaPct = openingAmount > 0 ? (delta / openingAmount) * 100 : null
    return { year, openingAmount, delta, deltaPct }
  }, [selectedYearBubble, selectedYear, selectedYearRow, totalSavingsByYear])

  // Overview mode memos
  const overviewChartData = useMemo(() => {
    return [...rows]
      .sort((a, b) => Number(a.year) - Number(b.year))
      .map((row) => {
        const total = styledSeries.reduce((acc, s) => {
          const v = Number(row[s.key] ?? 0)
          return acc + (Number.isFinite(v) ? v : 0)
        }, 0)
        return { year: String(row.year), _total: total }
      })
  }, [rows, styledSeries])

  const overviewYears = useMemo(
    () => [...rows].sort((a, b) => Number(a.year) - Number(b.year)).map((r) => String(r.year)),
    [rows],
  )

  const overviewYAxisMax = useMemo(() => {
    if (overviewChartData.length === 0) return undefined
    let max = 0
    for (const row of overviewChartData) {
      if (row._total > max) max = row._total
    }
    if (max === 0) return undefined
    const exp = 10 ** Math.floor(Math.log10(max))
    return Math.ceil(max / exp) * exp
  }, [overviewChartData])

  const yearlyOperationsByYear = useMemo(() => {
    const totals = new Map<string, { operationsCount: number; totalAmount: number }>()
    for (const event of operationEvents) {
      const current = totals.get(event.year) ?? { operationsCount: 0, totalAmount: 0 }
      totals.set(event.year, {
        operationsCount: current.operationsCount + 1,
        totalAmount: current.totalAmount + event.amount,
      })
    }
    return totals
  }, [operationEvents])

  const yearSummaryRows = useMemo(() => {
    return [...overviewYears].sort((a, b) => Number(b) - Number(a)).map((year) => {
      const currentYearMetrics = yearlyOperationsByYear.get(year) ?? { operationsCount: 0, totalAmount: 0 }
      const prevYear = String(Number(year) - 1)
      const previousYearMetrics = yearlyOperationsByYear.get(prevYear)
      const variation = formatVariation(currentYearMetrics.totalAmount, previousYearMetrics?.totalAmount ?? NaN)

      return {
        year,
        operationsCount: currentYearMetrics.operationsCount,
        totalAmount: currentYearMetrics.totalAmount,
        variation,
      }
    })
  }, [overviewYears, yearlyOperationsByYear])

  useEffect(() => {
    const latestVisibleYear = chartRows[chartRows.length - 1]?.year
    if (!latestVisibleYear) {
      setSelectedYear(null)
      return
    }
    if (!selectedYear || !chartRows.some((row) => row.year === selectedYear)) {
      setSelectedYear(latestVisibleYear)
    }
  }, [chartRows, selectedYear])

  useEffect(() => {
    if (!selectedOperationBubble) return
    if (!operationEventIds.has(selectedOperationBubble.event.id)) {
      setSelectedOperationBubble(null)
    }
  }, [operationEventIds, selectedOperationBubble])

  useEffect(() => {
    if (!selectedYearBubble) return
    if (!visibleYears.has(selectedYearBubble.year)) {
      setSelectedYearBubble(null)
    }
  }, [visibleYears, selectedYearBubble])

  const renderYearTick = (tickProps: { x?: number; y?: number; index?: number; payload?: { value?: string | number } }) => {
    const rawValue = String(tickProps.payload?.value ?? '')
    const year = rawValue.slice(0, 4)
    if (!year || !/^\d{4}$/.test(year)) return <g />
    const x = Number(tickProps.x ?? 0)
    const y = Number(tickProps.y ?? 0)
    const active = selectedYear === year
    const isFirstTick = (tickProps.index ?? 0) === 0

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={isFirstTick ? 2 : 0}
          y={0}
          dy={12}
          textAnchor={isFirstTick ? 'start' : 'middle'}
          fill={active ? 'var(--neutral-800)' : 'var(--neutral-500)'}
          style={{ fontSize: 11, fontWeight: active ? 700 : 600, cursor: 'pointer' }}
          onClick={(event) => {
            event.stopPropagation()
            setSelectedYear(year)
            setSelectedOperationBubble(null)
            setSelectedYearBubble({ year, x, y: y + 8 })
          }}
        >
          {year}
        </text>
      </g>
    )
  }

  const renderYAxisTick = (tickProps: { x?: number; y?: number; payload?: { value?: number } }) => {
    const x = Number(tickProps.x ?? 0)
    const y = Number(tickProps.y ?? 0)
    const value = Number(tickProps.payload?.value ?? 0)
    if (value === 0) return <g />
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={10}
          y={0}
          dy={3}
          textAnchor="start"
          fill="var(--neutral-500)"
          style={{ fontSize: 10, fontWeight: 600 }}
        >
          {formatYAxisCompact(value)}
        </text>
      </g>
    )
  }

  const renderOverviewXTick = (tickProps: { x?: number; y?: number; index?: number; payload?: { value?: string | number } }) => {
    const year = String(tickProps.payload?.value ?? '')
    if (!year || !/^\d{4}$/.test(year)) return <g />
    const x = Number(tickProps.x ?? 0)
    const y = Number(tickProps.y ?? 0)
    const active = selectedOverviewYear === year
    const isFirstTick = (tickProps.index ?? 0) === 0

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={isFirstTick ? 2 : 0}
          y={0}
          dy={12}
          textAnchor={isFirstTick ? 'start' : 'middle'}
          fill={active ? 'var(--neutral-800)' : 'var(--neutral-500)'}
          style={{ fontSize: 11, fontWeight: active ? 700 : 600 }}
        >
          {year}
        </text>
      </g>
    )
  }

  const renderOperationAnnotations = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chartProps: any) => {
      const xAxis = chartProps.xAxisMap?.[0]
      const yAxis = chartProps.yAxisMap?.[0]
      if (!xAxis?.scale || !yAxis?.scale) return null

      const xScale = xAxis.scale as (v: string) => number | undefined
      const yScale = yAxis.scale as (v: number) => number | undefined

      const GAP = 4
      const TRI_H = 6
      const TRI_HW = 4.5

      return (
        <g>
          {visibleOperationEvents.map((event) => {
            const seriesEntry = styledSeries.find((s) => s.key === event.account_key)
            if (!seriesEntry) return null

            const xPos = xScale(event.transaction_date)
            if (xPos === undefined) return null

            const timeline = accountTimelines.get(event.account_key)
            const timelinePoint = timeline?.find((pt) => pt.date === event.transaction_date)
            if (!timelinePoint) return null
            const yPos = yScale(timelinePoint.balance)
            if (yPos === undefined) return null

            const isSelected = selectedOperationBubble?.event.id === event.id

            const tipY = yPos - GAP
            const pts = `${xPos},${tipY} ${xPos - TRI_HW},${tipY - TRI_H} ${xPos + TRI_HW},${tipY - TRI_H}`

            return (
              <g
                key={event.id}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedYear(event.year)
                  setSelectedYearBubble(null)
                  setSelectedOperationBubble({ event, color: seriesEntry.color, x: xPos, y: yPos })
                }}
              >
                <rect
                  x={xPos - 11} y={tipY - TRI_H - 4}
                  width={22} height={TRI_H + GAP + 8}
                  fill="transparent"
                />
                <polygon
                  points={pts}
                  fill={isSelected ? seriesEntry.color : 'var(--neutral-0)'}
                  stroke={seriesEntry.color}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
              </g>
            )
          })}
        </g>
      )
    },
    [visibleOperationEvents, styledSeries, accountTimelines, selectedOperationBubble,
      setSelectedYear, setSelectedYearBubble, setSelectedOperationBubble],
  )

  if (isLoading) {
    return (
      <StatsSection>
        <SkeletonCard heightClass="h-72" lines={2} />
      </StatsSection>
    )
  }

  if (error) {
    return (
      <StatsSection>
        <EmptyState message="Impossible de charger l'évolution de l'épargne." />
      </StatsSection>
    )
  }

  if (rows.length === 0 || series.length === 0) {
    return (
      <StatsSection>
        <EmptyState message="Aucune donnée disponible sur les 5 dernières années." />
      </StatsSection>
    )
  }

  const listRows = orderedLegendSeries.map((entry) => {
    const accountId = entry.key
    const yearValue = selectedYearRow?.year ?? ''
    const currentAmount = Number(selectedYearRow?.[accountId] ?? 0)
    const previousAmount = Number(previousYearRow?.[accountId] ?? 0)
    const yearlyMetrics = yearlyAccountMetrics[`${accountId}::${yearValue}`]
    const operationsCount = Number(yearlyMetrics?.operations_count ?? 0)
    const totalSavedAmount = Number(yearlyMetrics?.total_saved_amount ?? 0)
    const performanceAmount = currentAmount - previousAmount - totalSavedAmount

    return {
      ...entry,
      listLabel: resolveListLabel(entry.label),
      currentAmount: Number.isFinite(currentAmount) ? currentAmount : 0,
      variationVsPreviousYear: formatVariation(currentAmount, previousAmount),
      operationsCount: Number.isFinite(operationsCount) ? operationsCount : 0,
      performanceAmount: Number.isFinite(performanceAmount) ? performanceAmount : 0,
    }
  })

  const modeLabel = displayMode === 'portfolio' ? 'Portefeuilles' : "Vue d'ensemble"

  return (
    <StatsSection>
      <div
        onClick={() => {
          setSelectedOperationBubble(null)
          setSelectedYearBubble(null)
          setIsModeMenuOpen(false)
        }}
        style={{
          border: '1px solid var(--neutral-150)',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--neutral-0)',
          boxShadow: 'var(--shadow-card)',
          padding: 'var(--space-4)',
          display: 'grid',
          gap: 'var(--space-4)',
          minHeight: 378,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: 'var(--neutral-900)' }}>
            Evolution de l'épargne
          </h3>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid var(--neutral-200)',
              borderRadius: 'var(--radius-md)',
              padding: '0 4px',
              background: 'var(--neutral-100)',
            }}
          >
            {data?.isFallback ? (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-600)', background: 'var(--neutral-100)', borderRadius: 'var(--radius-full)', padding: '2px 8px', whiteSpace: 'nowrap' }}>
                Données simulées
              </span>
            ) : null}

            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={isModeMenuOpen}
                onClick={(e) => { e.stopPropagation(); setIsModeMenuOpen((prev) => !prev) }}
                style={{
                  height: 24,
                  minWidth: 120,
                  padding: '0 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--neutral-250)',
                  background: 'var(--neutral-0)',
                  color: 'var(--neutral-700)',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{modeLabel}</span>
                <span aria-hidden="true" style={{ fontSize: 10, lineHeight: 1 }}>▾</span>
              </button>

              {isModeMenuOpen ? (
                <div
                  role="menu"
                  aria-label="Choix du mode d'affichage"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 28,
                    minWidth: 120,
                    background: 'var(--neutral-0)',
                    border: '1px solid var(--neutral-200)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-card)',
                    overflow: 'hidden',
                    zIndex: 6,
                  }}
                >
                  {MODE_OPTIONS.map((option, idx) => {
                    const selected = option.value === displayMode
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        onClick={(e) => {
                          e.stopPropagation()
                          setDisplayMode(option.value)
                          setIsModeMenuOpen(false)
                          if (option.value === 'overview') setIsolatedSeriesKey(null)
                          else setSelectedOverviewYear(null)
                        }}
                        style={{
                          width: '100%',
                          height: 28,
                          padding: '0 10px',
                          border: 'none',
                          borderTop: idx === 0 ? 'none' : '1px solid var(--neutral-150)',
                          background: selected ? 'var(--neutral-100)' : 'var(--neutral-0)',
                          color: selected ? 'var(--neutral-900)' : 'var(--neutral-700)',
                          fontSize: 11,
                          fontWeight: selected ? 700 : 600,
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Badges */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            marginTop: 'var(--space-2)',
            flexWrap: 'wrap',
            minWidth: 0,
          }}
        >
          {displayMode === 'portfolio' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                alignItems: 'center',
                columnGap: 8,
                rowGap: 8,
                flex: '1 1 300px',
                maxWidth: 520,
                width: '100%',
                minWidth: 0,
              }}
              aria-label="Légende des portefeuilles"
            >
              {orderedLegendSeries.map((entry) => {
                const active = isolatedSeriesKey === null || isolatedSeriesKey === entry.key
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsolatedSeriesKey((prev) => (prev === entry.key ? null : entry.key))
                    }}
                    aria-pressed={isolatedSeriesKey === entry.key}
                    aria-label={`${isolatedSeriesKey === entry.key ? 'Afficher tous' : 'Isoler'} ${entry.shortLabel}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      whiteSpace: 'nowrap',
                      borderRadius: 'var(--radius-full)',
                      border: active ? `1.5px solid ${entry.color}` : '1px solid var(--neutral-250)',
                      background: 'var(--neutral-0)',
                      minHeight: 24,
                      padding: '4px 8px 4px 5px',
                      width: '100%',
                      cursor: 'pointer',
                      transition: 'all 180ms ease',
                    }}
                  >
                    <img
                      src={entry.iconSrc}
                      alt=""
                      aria-hidden="true"
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                        filter: active ? 'none' : 'grayscale(1)',
                        opacity: active ? 1 : 0.48,
                        transform: active ? 'scale(1)' : 'scale(0.96)',
                        transition: 'all 180ms ease',
                      }}
                    />
                    <span style={{
                      fontSize: 11,
                      lineHeight: 1,
                      fontWeight: 700,
                      color: active ? entry.color : 'var(--neutral-500)',
                      transition: 'color 180ms ease',
                    }}>
                      {entry.shortLabel}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div
              style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: '1 1 auto', minWidth: 0 }}
              aria-label="Sélection de l'année"
            >
              {overviewYears.map((year) => {
                const isSelected = selectedOverviewYear === year
                const active = selectedOverviewYear === null || isSelected
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedOverviewYear((prev) => (prev === year ? null : year))
                    }}
                    aria-pressed={isSelected}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 'var(--radius-full)',
                      border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--neutral-250)',
                      background: isSelected ? 'rgba(91,87,245,0.07)' : 'var(--neutral-0)',
                      height: 24,
                      padding: '0 10px',
                      cursor: 'pointer',
                      transition: 'all 180ms ease',
                      opacity: active ? 1 : 0.45,
                    }}
                  >
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      lineHeight: 1,
                      color: isSelected ? 'var(--primary)' : 'var(--neutral-600)',
                      transition: 'color 180ms ease',
                    }}>
                      {year}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Chart */}
        <div style={{ marginTop: 'var(--space-2)', position: 'relative' }}>
          {displayMode === 'portfolio' ? (
            <>
              <ResponsiveContainer width="100%" height={252}>
                <LineChart
                  data={granularChartData}
                  margin={{ top: 4, right: 1, left: -24, bottom: 2 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-150)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    type="category"
                    ticks={xAxisTicks}
                    allowDuplicatedCategory={false}
                    axisLine={false}
                    tickLine={false}
                    tick={renderYearTick}
                  />
                  <YAxis
                    axisLine={{ stroke: 'var(--neutral-200)' }}
                    tickLine={false}
                    width={24}
                    orientation="left"
                    tick={renderYAxisTick}
                    domain={[0, yAxisMax ?? 'auto']}
                  />
                  {selectedYear ? (
                    <ReferenceLine x={`${selectedYear}-01-01`} stroke="var(--neutral-400)" strokeDasharray="2 3" />
                  ) : null}
                  {visibleSeries.map((entry) => (
                    <Line
                      key={entry.key}
                      type="stepAfter"
                      dataKey={entry.key}
                      name={entry.shortLabel}
                      stroke={entry.color}
                      strokeWidth={2.2}
                      dot={false}
                      activeDot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                  <Customized component={renderOperationAnnotations} />
                </LineChart>
              </ResponsiveContainer>

              {selectedOperationBubble ? (() => {
                const { event } = selectedOperationBubble
                const seriesEntry = styledSeries.find((s) => s.key === event.account_key)
                const displayLabel = seriesEntry?.shortLabel ?? event.account_label
                const timeline = accountTimelines.get(event.account_key)
                const timelinePoint = timeline?.find((pt) => pt.date === event.transaction_date)
                const portfolioBalance = timelinePoint?.balance ?? 0
                const isPositiveAmount = event.amount >= 0
                const natureLabel = event.nature === 'intérêts' ? 'Intérêts' : event.amount < 0 ? 'Retrait' : 'Virement'
                return (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      left: selectedOperationBubble.x,
                      top: selectedOperationBubble.y,
                      transform: 'translate(-50%, calc(-100% - 10px))',
                      background: 'var(--neutral-0)',
                      border: '1px solid var(--neutral-200)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: '0 6px 24px rgba(0,0,0,0.11)',
                      minWidth: 158,
                      zIndex: 18,
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 5px', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-900)', lineHeight: 1.2 }}>{displayLabel}</span>
                      {portfolioBalance > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-600)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                          {formatCurrency(portfolioBalance)}
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '3px 12px 9px', display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--neutral-400)', fontWeight: 600 }}>Date</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>{formatOperationDate(event.transaction_date)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--neutral-400)', fontWeight: 600 }}>Nature</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>{natureLabel}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--neutral-400)', fontWeight: 600 }}>Montant</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: isPositiveAmount ? '#047857' : '#DC2626', fontFamily: 'var(--font-mono)' }}>
                          {formatSignedCurrency(event.amount)}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 1, background: 'var(--neutral-150)' }} />
                    <div style={{ padding: '6px 12px 8px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedPortfolioKey(event.account_key)
                          setSelectedOperationBubble(null)
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          padding: '5px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1.5px solid #5B57F5',
                          background: 'transparent',
                          color: '#5B57F5',
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Détails
                        <ChevronRight size={11} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                )
              })() : null}

              {selectedYearBubble && selectedYearMetrics ? (
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    position: 'absolute',
                    left: selectedYearBubble.x,
                    top: selectedYearBubble.y,
                    transform: 'translate(-50%, calc(-100% - 12px))',
                    background: 'var(--neutral-0)',
                    border: '1px solid var(--neutral-200)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.13)',
                    padding: '10px 12px',
                    minWidth: 178,
                    zIndex: 17,
                  }}
                >
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--neutral-900)' }}>{selectedYearMetrics.year}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-400)' }}>Épargne au 1er jour</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(selectedYearMetrics.openingAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-400)' }}>Évolution annuelle</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>
                      {selectedYearMetrics.deltaPct == null
                        ? '—'
                        : `${selectedYearMetrics.delta > 0 ? '+' : ''}${PCT_ONE_DECIMAL.format(selectedYearMetrics.deltaPct)}%`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-400)' }}>Variation (€)</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>{formatSignedCurrency(selectedYearMetrics.delta)}</span>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <ResponsiveContainer width="100%" height={252}>
              <LineChart
                data={overviewChartData}
                margin={{ top: 4, right: 1, left: -24, bottom: 2 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-150)" vertical={false} />
                <XAxis
                  dataKey="year"
                  type="category"
                  ticks={overviewYears}
                  allowDuplicatedCategory={false}
                  axisLine={false}
                  tickLine={false}
                  tick={renderOverviewXTick}
                />
                <YAxis
                  axisLine={{ stroke: 'var(--neutral-200)' }}
                  tickLine={false}
                  width={24}
                  orientation="left"
                  tick={renderYAxisTick}
                  domain={[0, overviewYAxisMax ?? 'auto']}
                />
                {selectedOverviewYear ? (
                  <ReferenceLine x={selectedOverviewYear} stroke="var(--neutral-400)" strokeDasharray="2 3" />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="_total"
                  stroke="#5B57F5"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* List — portfolio: operations / overview: year summary */}
        {displayMode === 'portfolio' ? (
          <div style={{ display: 'grid', gap: '6px', marginTop: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: '6px solid transparent',
                    borderBottom: '6px solid transparent',
                    borderLeft: '10px solid var(--primary)',
                    flexShrink: 0,
                  }}
                />
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--neutral-900)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {isAllPortfoliosSelected ? 'Portefeuilles' : `Opérations · ${visibleSeries[0]?.shortLabel ?? ''}`}
                </h3>
              </div>
              {!isAllPortfoliosSelected ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowAllOpsModal(true) }}
                  title="Voir la liste complète des opérations"
                  style={{
                    border: '1px solid var(--neutral-200)',
                    background: 'var(--neutral-0)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px 5px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    color: 'var(--primary)',
                    fontSize: 9,
                    fontWeight: 500,
                    flexShrink: 0,
                  }}
                >
                  Liste ({operationEventsForList.length})
                </button>
              ) : null}
            </div>

            {isAllPortfoliosSelected ? (
              <div style={{ marginTop: 'var(--space-2)', display: 'grid', gap: 'var(--space-2)' }}>
                {orderedLegendSeries.map((entry) => (
                  <div
                    key={entry.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: '6px 8px',
                      borderBottom: '1px solid var(--neutral-100)',
                      lineHeight: 1,
                    }}
                  >
                    <img
                      src={entry.iconSrc}
                      alt=""
                      aria-hidden="true"
                      style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--neutral-800)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {resolveListLabel(entry.shortLabel)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {operationEventsForList.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-400)', textAlign: 'center', padding: 'var(--space-5) 0' }}>
                    Aucune opération enregistrée
                  </p>
                ) : (
                  <div style={{ marginTop: 'var(--space-3)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', columnGap: '14px', padding: '0 6px 4px', borderBottom: '1px solid var(--neutral-100)', lineHeight: 1 }}>
                      <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left' }}>Date</span>
                      <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'inline-grid', gridTemplateColumns: '12px auto', columnGap: 6, alignItems: 'center', justifyItems: 'start' }}>
                        <span aria-hidden="true" style={{ width: 12, height: 12, display: 'inline-block' }} />
                        <span>Nature</span>
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'inline-grid', gridTemplateColumns: '9px auto', columnGap: 4, alignItems: 'center', justifyItems: 'start', justifySelf: 'center', textAlign: 'left' }}>
                        <span aria-hidden="true" style={{ width: 9, display: 'inline-block', visibility: 'hidden', fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-mono)', lineHeight: 1, textAlign: 'center' }}>+</span>
                        <span>Montant</span>
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'right', justifySelf: 'end' }}>Total</span>
                    </div>

                    {operationEventsForList.map((event, idx) => {
                      const seriesEntry = styledSeriesMap.get(event.account_key)
                      const isInterest = event.nature === 'intérêts'
                      const isPlacement = seriesEntry?.family === 'placements'
                      const natureLabel = isInterest ? 'Intérêts' : (isPlacement ? 'Placement' : 'Virement')
                      const natureIconSrc = isInterest ? epargneInteretsIcon : (isPlacement ? epargnePlacementIcon : epargneVirementIcon)
                      const amountSign = event.amount > 0 ? '+' : event.amount < 0 ? '-' : ''
                      const amountAbs = formatCurrency(Math.abs(event.amount))
                      const cumulativeTotal = opsCumulativeByEventId.get(event.id) ?? 0

                      return (
                        <div
                          key={event.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                            columnGap: '14px',
                            padding: '7px 6px',
                            borderBottom: idx < operationEventsForList.length - 1 ? '1px solid var(--neutral-50)' : 'none',
                            alignItems: 'center',
                            lineHeight: 1,
                          }}
                        >
                          <span style={{ fontSize: 10, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)', fontWeight: 500, lineHeight: 1 }}>
                            {formatOperationDate(event.transaction_date)}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--neutral-900)', whiteSpace: 'nowrap', lineHeight: 1, justifySelf: 'start', display: 'inline-grid', gridTemplateColumns: '12px auto', alignItems: 'center', columnGap: 6 }}>
                            <span style={{ width: 12, height: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <img src={natureIconSrc} alt="" aria-hidden="true" style={{ width: 10, height: 10, objectFit: 'contain', display: 'block' }} />
                            </span>
                            {natureLabel}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-mono)', textAlign: 'left', color: 'var(--neutral-900)', whiteSpace: 'nowrap', lineHeight: 1, display: 'inline-grid', gridTemplateColumns: '9px auto', columnGap: 4, justifyContent: 'start', alignItems: 'center', justifySelf: 'center' }}>
                            <span style={{ color: amountSign === '+' ? 'var(--color-positive)' : amountSign === '-' ? 'var(--color-negative)' : 'transparent', textAlign: 'center' }}>
                              {amountSign || '+'}
                            </span>
                            <span style={{ color: 'var(--neutral-900)' }}>{amountAbs}</span>
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', textAlign: 'right', justifySelf: 'end', whiteSpace: 'nowrap', lineHeight: 1 }}>
                            {formatCurrency(cumulativeTotal)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '6px', marginTop: 'var(--space-2)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, minmax(0, 1fr))', columnGap: '14px', padding: '0 6px 4px', borderBottom: '1px solid var(--neutral-100)', lineHeight: 1 }}>
              <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left' }}>Année</span>
              <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center', justifySelf: 'center' }}>Opérations</span>
              <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center', justifySelf: 'center' }}>Montant</span>
              <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'right', justifySelf: 'end' }}>Var. N-1</span>
            </div>
            {yearSummaryRows.map((row, idx) => {
              const isActiveYear = selectedOverviewYear === null || selectedOverviewYear === row.year
              const isHighlighted = selectedOverviewYear === row.year
              return (
                <div
                  key={row.year}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr repeat(3, minmax(0, 1fr))',
                    columnGap: '14px',
                    padding: '7px 6px',
                    borderBottom: idx < yearSummaryRows.length - 1 ? '1px solid var(--neutral-50)' : 'none',
                    alignItems: 'center',
                    lineHeight: 1,
                    opacity: isActiveYear ? 1 : 0.4,
                    background: isHighlighted ? 'rgba(91,87,245,0.04)' : 'transparent',
                    borderRadius: isHighlighted ? 'var(--radius-sm)' : 0,
                    transition: 'opacity 150ms ease, background 150ms ease',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--neutral-900)', fontWeight: isHighlighted ? 700 : 600, lineHeight: 1 }}>
                    {row.year}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)', fontWeight: 500, textAlign: 'center', justifySelf: 'center' }}>
                    {row.operationsCount}
                  </span>
                  <span style={{ fontSize: 11, color: row.totalAmount >= 0 ? 'var(--neutral-700)' : '#DC2626', fontFamily: 'var(--font-mono)', fontWeight: 500, textAlign: 'center', justifySelf: 'center', whiteSpace: 'nowrap' }}>
                    {formatSignedCurrency(row.totalAmount)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)', fontWeight: 500, textAlign: 'right', justifySelf: 'end', whiteSpace: 'nowrap' }}>
                    {row.variation}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedPortfolioKey ? (() => {
          const portfolioRow = listRows.find((r) => r.key === selectedPortfolioKey)
          if (!portfolioRow) return null
          return (
            <SavingsPortfolioModal
              key={selectedPortfolioKey}
              account={{
                key: portfolioRow.key,
                label: portfolioRow.label,
                color: portfolioRow.color,
                family: portfolioRow.family,
                savings_kind: portfolioRow.savings_kind,
                risk_level: portfolioRow.risk_level,
                shortLabel: portfolioRow.shortLabel,
                iconSrc: portfolioRow.iconSrc,
                listLabel: portfolioRow.listLabel,
              }}
              operationEvents={operationEvents}
              rows={rows}
              currentAmount={portfolioRow.currentAmount}
              onClose={handleClosePortfolioModal}
            />
          )
        })() : null}
      </AnimatePresence>

      <AnimatePresence>
        {showAllOpsModal ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAllOpsModal(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 72, background: 'rgba(13,13,31,0.48)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Liste complète des opérations"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'fixed', inset: 0, zIndex: 73, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3)', pointerEvents: 'none' }}
            >
              <div style={{ width: 'min(560px, 100%)', maxHeight: 'min(72dvh, calc(100dvh - 2 * var(--space-3)))', overflow: 'hidden', pointerEvents: 'auto', background: 'var(--neutral-0)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--neutral-150)', boxShadow: '0 20px 52px rgba(13,13,31,0.26)', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--neutral-100)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 500 }}>
                    Liste complète des opérations ({operationEventsForList.length})
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAllOpsModal(false)}
                    aria-label="Fermer la liste des opérations"
                    style={{ border: '1px solid var(--neutral-200)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-sm)', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--neutral-600)', flexShrink: 0 }}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div style={{ overflowY: 'auto', padding: 'var(--space-3) var(--space-4)' }}>
                  {operationEventsForList.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-400)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
                      Aucune opération enregistrée
                    </p>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', columnGap: '14px', padding: '0 6px 4px', borderBottom: '1px solid var(--neutral-100)', lineHeight: 1 }}>
                        <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left' }}>Date</span>
                        <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Nature</span>
                        <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center', justifySelf: 'center' }}>Montant</span>
                        <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'right', justifySelf: 'end' }}>Total</span>
                      </div>
                      {shouldGroupOperationsByAccount ? (
                        operationGroupsForList.map((group, groupIdx) => (
                          <div key={group.accountKey} style={{ marginTop: groupIdx === 0 ? 'var(--space-2)' : 'var(--space-3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '0 6px 6px' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-700)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {group.accountLabel}
                              </span>
                              <span style={{ flex: 1, height: 1, background: 'var(--neutral-150)' }} />
                            </div>
                            {group.events.map((event, idx) => {
                              const seriesEntry = styledSeriesMap.get(event.account_key)
                              const isInterest = event.nature === 'intérêts'
                              const isPlacement = seriesEntry?.family === 'placements'
                              const natureLabel = isInterest ? 'Intérêts' : (isPlacement ? 'Placement' : 'Virement')
                              const natureIconSrc = isInterest ? epargneInteretsIcon : (isPlacement ? epargnePlacementIcon : epargneVirementIcon)
                              const amountSign = event.amount > 0 ? '+' : event.amount < 0 ? '-' : ''
                              const amountAbs = formatCurrency(Math.abs(event.amount))
                              const cumulativeTotal = opsCumulativeByEventId.get(event.id) ?? 0

                              return (
                                <div key={event.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', columnGap: '14px', padding: '7px 6px', borderBottom: idx < group.events.length - 1 ? '1px solid var(--neutral-50)' : 'none', alignItems: 'center', lineHeight: 1 }}>
                                  <span style={{ fontSize: 10, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{formatOperationDate(event.transaction_date)}</span>
                                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--neutral-900)', display: 'inline-grid', gridTemplateColumns: '12px auto', alignItems: 'center', columnGap: 6, justifySelf: 'start' }}>
                                    <span style={{ width: 12, height: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <img src={natureIconSrc} alt="" aria-hidden="true" style={{ width: 10, height: 10, objectFit: 'contain' }} />
                                    </span>
                                    {natureLabel}
                                  </span>
                                  <span style={{ fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-mono)', display: 'inline-grid', gridTemplateColumns: '9px auto', columnGap: 4, alignItems: 'center', justifySelf: 'center' }}>
                                    <span style={{ color: amountSign === '+' ? 'var(--color-positive)' : amountSign === '-' ? 'var(--color-negative)' : 'transparent', textAlign: 'center' }}>{amountSign || '+'}</span>
                                    <span style={{ color: 'var(--neutral-900)' }}>{amountAbs}</span>
                                  </span>
                                  <span style={{ fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', textAlign: 'right', justifySelf: 'end' }}>{formatCurrency(cumulativeTotal)}</span>
                                </div>
                              )
                            })}
                          </div>
                        ))
                      ) : (
                        operationEventsForList.map((event, idx) => {
                          const seriesEntry = styledSeriesMap.get(event.account_key)
                          const isInterest = event.nature === 'intérêts'
                          const isPlacement = seriesEntry?.family === 'placements'
                          const natureLabel = isInterest ? 'Intérêts' : (isPlacement ? 'Placement' : 'Virement')
                          const natureIconSrc = isInterest ? epargneInteretsIcon : (isPlacement ? epargnePlacementIcon : epargneVirementIcon)
                          const amountSign = event.amount > 0 ? '+' : event.amount < 0 ? '-' : ''
                          const amountAbs = formatCurrency(Math.abs(event.amount))
                          const cumulativeTotal = opsCumulativeByEventId.get(event.id) ?? 0

                          return (
                            <div key={event.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', columnGap: '14px', padding: '7px 6px', borderBottom: idx < operationEventsForList.length - 1 ? '1px solid var(--neutral-50)' : 'none', alignItems: 'center', lineHeight: 1 }}>
                              <span style={{ fontSize: 10, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{formatOperationDate(event.transaction_date)}</span>
                              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--neutral-900)', display: 'inline-grid', gridTemplateColumns: '12px auto', alignItems: 'center', columnGap: 6, justifySelf: 'start' }}>
                                <span style={{ width: 12, height: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <img src={natureIconSrc} alt="" aria-hidden="true" style={{ width: 10, height: 10, objectFit: 'contain' }} />
                                </span>
                                {natureLabel}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-mono)', display: 'inline-grid', gridTemplateColumns: '9px auto', columnGap: 4, alignItems: 'center', justifySelf: 'center' }}>
                                <span style={{ color: amountSign === '+' ? 'var(--color-positive)' : amountSign === '-' ? 'var(--color-negative)' : 'transparent', textAlign: 'center' }}>{amountSign || '+'}</span>
                                <span style={{ color: 'var(--neutral-900)' }}>{amountAbs}</span>
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', textAlign: 'right', justifySelf: 'end' }}>{formatCurrency(cumulativeTotal)}</span>
                            </div>
                          )
                        })
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </StatsSection>
  )
}
