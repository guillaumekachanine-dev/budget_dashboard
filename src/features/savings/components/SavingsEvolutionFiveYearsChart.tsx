import { useCallback, useEffect, useMemo, useState } from 'react'
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
import type { SavingsEvolutionFiveYearsSeries, SavingsEvolutionOperationEvent } from '@/features/savings/types'
import amundiEpargneIcon from '@/assets/icons/accounts/amundi_epargne.webp'
import bitcoinIcon from '@/assets/icons/accounts/bitcoin.webp'
import peaIcon from '@/assets/icons/accounts/boursorama_pea.png'
import comptePrincipalIcon from '@/assets/icons/accounts/compte_principal_banque_populaire.webp'
import pegCapgeminiIcon from '@/assets/icons/accounts/peg_capgemini.png'

const EURO_ROUNDED = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

type StyledSeries = SavingsEvolutionFiveYearsSeries & {
  shortLabel: string
  iconSrc: string
}

type PeriodOption = {
  label: '2 yrs' | '3 yrs' | '5yrs'
  years: 2 | 3 | 5
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

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: '2 yrs', years: 2 },
  { label: '3 yrs', years: 3 },
  { label: '5yrs', years: 5 },
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
    .replace(/[\u0300-\u036f]/g, '')
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

  if (normalized.includes('livret a')) return 'Liv.A'
  if (hasWord(normalized, 'peg') || normalized.includes('capgemini')) return 'PEG'
  if (hasWord(normalized, 'per') || normalized.includes('plan epargne retraite')) return 'PER'
  if (hasWord(normalized, 'bitcoin') || normalized.includes('wallet bitcoin')) return 'BTC'

  return label
}

function resolveSeriesColor(label: string, fallbackColor: string): string {
  const normalized = normalizeLabel(label)

  // Distinctive per-portfolio colors, independent from livret/placement families.
  if (normalized.includes('livret a')) return '#1D4ED8'
  if (hasWord(normalized, 'ldds')) return '#D946EF'
  if (hasWord(normalized, 'lep')) return '#0D9488'
  if (hasWord(normalized, 'pea')) return '#F97316'
  if (hasWord(normalized, 'peg') || normalized.includes('capgemini')) return '#7C3AED'
  if (hasWord(normalized, 'per') || normalized.includes('plan epargne retraite')) return '#DC2626'
  if (hasWord(normalized, 'bitcoin') || normalized.includes('wallet bitcoin')) return '#CA8A04'

  return fallbackColor
}

function resolveSeriesIcon(label: string, family: 'livrets' | 'placements'): string {
  const normalized = normalizeLabel(label)

  if (hasWord(normalized, 'per') || normalized.includes('plan epargne retraite')) return comptePrincipalIcon
  if (hasWord(normalized, 'pea')) return peaIcon
  if (hasWord(normalized, 'peg') || normalized.includes('capgemini')) return pegCapgeminiIcon
  if (hasWord(normalized, 'bitcoin') || normalized.includes('wallet bitcoin')) return bitcoinIcon
  if (
    hasWord(normalized, 'perco')
    || hasWord(normalized, 'percol')
    || normalized.includes('amundi')
  ) return amundiEpargneIcon

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

export function SavingsEvolutionFiveYearsChart() {
  const { data, isLoading, error } = useSavingsEvolutionFiveYears()
  const [disabledSeriesKeys, setDisabledSeriesKeys] = useState<string[]>([])
  const [selectedPeriodYears, setSelectedPeriodYears] = useState<2 | 3 | 5>(5)
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState<string | null>(null)
  const [selectedOperationBubble, setSelectedOperationBubble] = useState<OperationBubbleState | null>(null)
  const [selectedYearBubble, setSelectedYearBubble] = useState<YearBubbleState | null>(null)
  const rows = useMemo(() => data?.rows ?? [], [data?.rows])
  const series = useMemo(() => data?.series ?? [], [data?.series])
  const yearlyAccountMetrics = useMemo(() => data?.yearly_account_metrics ?? {}, [data?.yearly_account_metrics])
  const operationEvents = useMemo(() => data?.operation_events ?? [], [data?.operation_events])

  const styledSeries: StyledSeries[] = useMemo(() => series.map((entry) => ({
    ...entry,
    shortLabel: resolveLegendLabel(entry.label),
    color: resolveSeriesColor(entry.label, entry.color),
    iconSrc: resolveSeriesIcon(entry.label, entry.family),
  })), [series])

  const availableSeriesKeys = useMemo(
    () => new Set(styledSeries.map((entry) => entry.key)),
    [styledSeries],
  )

  useEffect(() => {
    setDisabledSeriesKeys((prev) => prev.filter((key) => availableSeriesKeys.has(key)))
  }, [availableSeriesKeys])

  const isSeriesActive = (key: string): boolean => !disabledSeriesKeys.includes(key)
  const toggleSeries = (key: string) => {
    setDisabledSeriesKeys((prev) => (
      prev.includes(key)
        ? prev.filter((value) => value !== key)
        : [...prev, key]
    ))
  }

  const orderedLegendSeries = useMemo(() => [...styledSeries].sort((a, b) => {
    const aKey = normalizeLabel(a.shortLabel)
    const bKey = normalizeLabel(b.shortLabel)
    const aRank = LEGEND_ORDER[aKey] ?? 99
    const bRank = LEGEND_ORDER[bKey] ?? 99
    if (aRank !== bRank) return aRank - bRank
    return a.shortLabel.localeCompare(b.shortLabel, 'fr')
  }), [styledSeries])

  const visibleSeries = useMemo(
    () => styledSeries.filter((entry) => !disabledSeriesKeys.includes(entry.key)),
    [styledSeries, disabledSeriesKeys],
  )
  const chartRows = useMemo(() => {
    const sortedRows = [...rows].sort((a, b) => Number(a.year) - Number(b.year))
    return sortedRows.slice(-selectedPeriodYears)
  }, [rows, selectedPeriodYears])
  const visibleYears = useMemo(() => new Set(chartRows.map((row) => row.year)), [chartRows])
  const visibleSeriesKeys = useMemo(() => new Set(visibleSeries.map((entry) => entry.key)), [visibleSeries])
  const visibleOperationEvents = useMemo(() => (
    operationEvents.filter((event) => visibleSeriesKeys.has(event.account_key) && visibleYears.has(event.year))
  ), [operationEvents, visibleSeriesKeys, visibleYears])
  const operationEventByAccountYear = useMemo(() => {
    const map = new Map<string, SavingsEvolutionOperationEvent>()
    for (const event of visibleOperationEvents) {
      map.set(`${event.account_key}::${event.year}`, event)
    }
    return map
  }, [visibleOperationEvents])
  const selectedPeriodLabel = useMemo(
    () => PERIOD_OPTIONS.find((option) => option.years === selectedPeriodYears)?.label ?? '5yrs',
    [selectedPeriodYears],
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
    if (chartRows.length === 0 || styledSeries.length === 0) return undefined
    let max = 0
    for (const row of chartRows) {
      for (const s of styledSeries) {
        const v = Number(row[s.key] ?? 0)
        if (Number.isFinite(v) && v > max) max = v
      }
    }
    if (max === 0) return undefined
    const exp = 10 ** Math.floor(Math.log10(max))
    return Math.ceil(max / exp) * exp
  }, [chartRows, styledSeries])

  const selectedYearMetrics = useMemo(() => {
    const year = selectedYearBubble?.year ?? selectedYear ?? selectedYearRow?.year ?? null
    if (!year) return null
    const yearTotal = totalSavingsByYear.get(year) ?? 0
    const previousYear = String(Number(year) - 1)
    const openingAmount = totalSavingsByYear.get(previousYear) ?? yearTotal
    const delta = yearTotal - openingAmount
    const deltaPct = openingAmount > 0 ? (delta / openingAmount) * 100 : null
    return {
      year,
      openingAmount,
      delta,
      deltaPct,
    }
  }, [selectedYearBubble, selectedYear, selectedYearRow, totalSavingsByYear])

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
    const key = `${selectedOperationBubble.event.account_key}::${selectedOperationBubble.event.year}`
    if (!operationEventByAccountYear.has(key)) {
      setSelectedOperationBubble(null)
    }
  }, [operationEventByAccountYear, selectedOperationBubble])

  useEffect(() => {
    if (!selectedYearBubble) return
    if (!visibleYears.has(selectedYearBubble.year)) {
      setSelectedYearBubble(null)
    }
  }, [visibleYears, selectedYearBubble])

  const renderInteractiveDot = (seriesEntry: StyledSeries) => (
    dotProps: { cx?: number; cy?: number; payload?: { year?: string } },
  ) => {
    const year = String(dotProps.payload?.year ?? '')
    const cx = Number(dotProps.cx ?? 0)
    const cy = Number(dotProps.cy ?? 0)
    return (
      <circle
        key={`dot-${seriesEntry.key}-${year}`}
        cx={cx} cy={cy} r={2.5}
        fill={seriesEntry.color}
        style={{ cursor: 'pointer' }}
        onClick={(event) => {
          event.stopPropagation()
          setSelectedYear(year)
          setSelectedOperationBubble(null)
          setSelectedYearBubble(null)
        }}
      />
    )
  }

  const renderYearTick = (tickProps: { x?: number; y?: number; index?: number; payload?: { value?: string | number } }) => {
    const rawYear = String(tickProps.payload?.value ?? '')
    const hasValidYear = /^\d{4}$/.test(rawYear)
    const fallbackYearFromIndex = typeof tickProps.index === 'number'
      ? chartRows[tickProps.index]?.year
      : undefined
    const year = hasValidYear
      ? rawYear
      : String(fallbackYearFromIndex ?? chartRows[0]?.year ?? '')
    const x = Number(tickProps.x ?? 0)
    const y = Number(tickProps.y ?? 0)
    const active = selectedYear === year
    const firstVisibleYear = chartRows[0]?.year
    const isFirstVisibleYear = year === firstVisibleYear

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={isFirstVisibleYear ? 2 : 0}
          y={0}
          dy={12}
          textAnchor={isFirstVisibleYear ? 'start' : 'middle'}
          fill={active ? 'var(--neutral-800)' : 'var(--neutral-500)'}
          style={{ fontSize: 11, fontWeight: active ? 700 : 600, cursor: 'pointer' }}
          onClick={(event) => {
            event.stopPropagation()
            setSelectedYear(year)
            setSelectedOperationBubble(null)
            setSelectedYearBubble({ year, x, y: y + 8 })
          }}
        >
          {year.slice(-2)}
        </text>
      </g>
    )
  }

  const renderYAxisTick = (tickProps: { x?: number; y?: number; payload?: { value?: number } }) => {
    const x = Number(tickProps.x ?? 0)
    const y = Number(tickProps.y ?? 0)
    const value = Number(tickProps.payload?.value ?? 0)
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

  const renderOperationAnnotations = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chartProps: any) => {  // Recharts passes internal chart state (xAxisMap, yAxisMap) — no public type
      const xAxis = chartProps.xAxisMap?.[0]
      const yAxis = chartProps.yAxisMap?.[0]
      if (!xAxis?.scale || !yAxis?.scale) return null

      const xScale = xAxis.scale as (v: string) => number | undefined

      // Point scale: derive step from first two consecutive year ticks
      const firstYear = chartRows[0]?.year
      const secondYear = chartRows[1]?.year
      if (!firstYear || !secondYear) return null
      const x0 = xScale(firstYear)
      const x1 = xScale(secondYear)
      if (x0 === undefined || x1 === undefined) return null
      const step = x1 - x0

      const GAP = 4
      const TRI_H = 6
      const TRI_HW = 4.5

      return (
        <g>
          {visibleOperationEvents.map((event) => {
            const seriesEntry = styledSeries.find((s) => s.key === event.account_key)
            if (!seriesEntry) return null

            const opDate = new Date(event.transaction_date)
            if (Number.isNaN(opDate.getTime())) return null

            const opMonth = opDate.getMonth() + 1
            const currYearX = xScale(event.year)
            if (currYearX === undefined) return null
            const prevYearX = currYearX - step
            const xPos = prevYearX + (opMonth / 12) * step

            const yearIndex = chartRows.findIndex((row) => row.year === event.year)
            const currRow = chartRows[yearIndex]
            const prevRow = yearIndex > 0 ? chartRows[yearIndex - 1] : null
            const currValue = Number(currRow?.[event.account_key])
            const prevValue = prevRow != null ? Number(prevRow[event.account_key] ?? currValue) : currValue
            if (!Number.isFinite(currValue)) return null

            const interpValue = Number.isFinite(prevValue)
              ? prevValue + (opMonth / 12) * (currValue - prevValue)
              : currValue
            const yPos = yAxis.scale!(interpValue)
            if (yPos === undefined) return null

            const isSelected = selectedOperationBubble?.event.account_key === event.account_key
              && selectedOperationBubble.event.year === event.year

            const tipX = xPos
            const tipY = yPos - GAP
            const pts = `${tipX},${tipY} ${xPos - TRI_HW},${tipY - TRI_H} ${xPos + TRI_HW},${tipY - TRI_H}`

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
    [visibleOperationEvents, styledSeries, chartRows, selectedOperationBubble,
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
        <EmptyState message="Impossible de charger l’évolution de l’épargne." />
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

  return (
    <StatsSection>
      <div
        onClick={() => {
          setSelectedOperationBubble(null)
          setSelectedYearBubble(null)
          setIsPeriodMenuOpen(false)
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
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--neutral-600)',
                  background: 'var(--neutral-100)',
                  borderRadius: 'var(--radius-full)',
                  padding: '2px 8px',
                  whiteSpace: 'nowrap',
                }}
              >
                Données simulées
              </span>
            ) : null}

            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={isPeriodMenuOpen}
                onClick={() => setIsPeriodMenuOpen((prev) => !prev)}
                style={{
                  height: 24,
                  minWidth: 92,
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
                <span>{selectedPeriodLabel}</span>
                <span aria-hidden="true" style={{ fontSize: 10, lineHeight: 1 }}>▾</span>
              </button>

              {isPeriodMenuOpen ? (
                <div
                  role="menu"
                  aria-label="Choix de période"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 28,
                    minWidth: 92,
                    background: 'var(--neutral-0)',
                    border: '1px solid var(--neutral-200)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-card)',
                    overflow: 'hidden',
                    zIndex: 6,
                  }}
                >
                  {PERIOD_OPTIONS.map((option) => {
                    const selected = option.years === selectedPeriodYears
                    return (
                      <button
                        key={option.label}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        onClick={() => {
                          setSelectedPeriodYears(option.years)
                          setIsPeriodMenuOpen(false)
                        }}
                        style={{
                          width: '100%',
                          height: 28,
                          padding: '0 10px',
                          border: 'none',
                          borderTop: option.label === '2 yrs' ? 'none' : '1px solid var(--neutral-150)',
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

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            marginTop: 'var(--space-2)',
            flexWrap: 'wrap',
            minWidth: 0,
          }}
        >
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
              const active = isSeriesActive(entry.key)
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => toggleSeries(entry.key)}
                  aria-pressed={active}
                  aria-label={`${active ? 'Masquer' : 'Afficher'} la courbe ${entry.shortLabel}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                    borderRadius: 'var(--radius-full)',
                    border: `1px solid ${active ? 'color-mix(in oklab, var(--neutral-300) 45%, var(--neutral-0) 55%)' : 'var(--neutral-250)'}`,
                    background: active
                      ? 'color-mix(in oklab, var(--neutral-0) 84%, var(--neutral-100) 16%)'
                      : 'var(--neutral-100)',
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

        </div>

        <div style={{ marginTop: 'var(--space-2)', position: 'relative' }}>
          <ResponsiveContainer width="100%" height={252}>
            <LineChart
              data={chartRows}
              margin={{ top: 4, right: 1, left: -24, bottom: 2 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-150)" vertical={false} />
              <XAxis
                dataKey="year"
                type="category"
                ticks={chartRows.map((row) => row.year)}
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
                <ReferenceLine x={selectedYear} stroke="var(--neutral-400)" strokeDasharray="2 3" />
              ) : null}
              {visibleSeries.map((entry) => (
                <Line
                  key={entry.key}
                  type="monotone"
                  dataKey={entry.key}
                  name={entry.shortLabel}
                  stroke={entry.color}
                  strokeWidth={2.2}
                  dot={renderInteractiveDot(entry)}
                  activeDot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
              <Customized component={renderOperationAnnotations} />
            </LineChart>
          </ResponsiveContainer>

          {selectedOperationBubble ? (
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                position: 'absolute',
                left: selectedOperationBubble.x,
                top: selectedOperationBubble.y,
                transform: 'translate(-50%, calc(-100% - 10px))',
                background: 'var(--neutral-0)',
                border: '1px solid var(--neutral-200)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.13)',
                padding: '10px 12px',
                minWidth: 162,
                zIndex: 18,
              }}
            >
              <p
                style={{
                  margin: '0 0 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--neutral-800)',
                  lineHeight: 1.3,
                }}
              >
                {selectedOperationBubble.event.account_label}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-400)' }}>Date</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>
                  {formatOperationDate(selectedOperationBubble.event.transaction_date)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-400)' }}>Nature</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>
                  {selectedOperationBubble.event.nature}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-400)' }}>Montant</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>
                  {formatSignedCurrency(selectedOperationBubble.event.amount)}
                </span>
              </div>
            </div>
          ) : null}

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
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--neutral-900)' }}>
                {selectedYearMetrics.year}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-400)' }}>Épargne au 1er jour</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(selectedYearMetrics.openingAmount)}
                </span>
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
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>
                  {formatSignedCurrency(selectedYearMetrics.delta)}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ display: 'grid', gap: '6px', marginTop: 'var(--space-2)' }}>
          <div
            aria-hidden="true"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 2fr) repeat(4, minmax(0, 1fr))',
              alignItems: 'center',
              padding: '0 2px',
              columnGap: 8,
            }}
          >
            <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontWeight: 600, textAlign: 'left', paddingLeft: 22 }}>
              portefeuille
            </span>
            <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontWeight: 600, textAlign: 'center' }}>
              Perf.
            </span>
            <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontWeight: 600, textAlign: 'center' }}>
              var. N-1
            </span>
            <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontWeight: 600, textAlign: 'center' }}>
              nbre opé
            </span>
            <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontWeight: 600, textAlign: 'center' }}>
              montant
            </span>
          </div>

          {listRows.map((row) => (
            <div
              key={row.key}
              style={{
                padding: '4px 2px',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 2fr) repeat(4, minmax(0, 1fr))',
                alignItems: 'center',
                columnGap: 8,
                lineHeight: 1.1,
              }}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <img
                  src={row.iconSrc}
                  alt=""
                  aria-hidden="true"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--neutral-800)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.listLabel}
                </span>
              </div>

              <span style={{ fontSize: 11, color: 'var(--neutral-700)', fontWeight: 500, fontFamily: 'var(--font-mono)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {formatSignedCurrency(row.performanceAmount)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--neutral-700)', fontWeight: 500, fontFamily: 'var(--font-mono)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {row.variationVsPreviousYear}
              </span>
              <span style={{ fontSize: 11, color: 'var(--neutral-700)', fontWeight: 500, fontFamily: 'var(--font-mono)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {row.operationsCount === 0 ? '-' : row.operationsCount}
              </span>
              <span style={{ fontSize: 11, color: 'var(--neutral-900)', fontWeight: 700, fontFamily: 'var(--font-mono)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {formatCurrency(row.currentAmount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </StatsSection>
  )
}
