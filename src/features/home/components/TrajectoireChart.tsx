import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useDailyCashflowForecast } from '@/features/home/hooks/useDailyCashflowForecast'
import { useTrajectoryPlannedOperations } from '@/features/home/hooks/useTrajectoryPlannedOperations'

const MONTHS: { value: number; label: string }[] = [
  { value: 6, label: 'Juin' },
  { value: 7, label: 'Juil.' },
  { value: 8, label: 'Août' },
  { value: 9, label: 'Sept.' },
  { value: 10, label: 'Oct.' },
  { value: 11, label: 'Nov.' },
  { value: 12, label: 'Déc.' },
]

const FORECAST_YEAR = 2026
type TrajectoryDisplayMode = 'depenses' | 'cashflow' | 'tout'
type TrajectorySide = 'front' | 'back'

const DISPLAY_MODE_OPTIONS: Array<{ id: TrajectoryDisplayMode; label: string }> = [
  { id: 'depenses', label: 'dépenses' },
  { id: 'cashflow', label: 'cashflow' },
  { id: 'tout', label: 'tout' },
]

const SERIES_COLORS = {
  depenses: '#FF7A1A',
  cashflow: '#5B57F5',
  revenus: '#12B4A9',
} as const
const SELECTOR_MIN_HEIGHT = 28

const FORMAT_CURRENCY = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatCurrency(v: number) {
  return FORMAT_CURRENCY.format(v)
}

function formatDayLabel(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function CustomTooltip({
  active,
  payload,
  label,
  displayMode,
  fixedRecurringOpsCount,
  plannedOpsAmount,
  theoreticalBalance,
  onOpenDetails,
}: {
  active?: boolean
  payload?: Array<{ value?: number | string | Array<number | string>; name?: string | number; color?: string }>
  label?: number | string
  displayMode: TrajectoryDisplayMode
  fixedRecurringOpsCount?: number
  plannedOpsAmount?: number
  theoreticalBalance?: number
  onOpenDetails?: (day: number) => void
}) {
  if (!active || !payload?.length) return null
  const day = typeof label === 'number' ? label : Number(label)
  const isValidDay = Number.isFinite(day) && day > 0
  const cashflow = payload.find((p) => p.name === 'cashflow')
  const expenses = payload.find((p) => p.name === 'expenses')
  const cashflowValue = Number(Array.isArray(cashflow?.value) ? cashflow?.value[0] : (cashflow?.value ?? 0))
  const expensesValue = Number(Array.isArray(expenses?.value) ? expenses?.value[0] : (expenses?.value ?? 0))
  const hasPlannedOps = (fixedRecurringOpsCount ?? 0) > 0

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--neutral-0)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-md)',
        padding: '8px 10px 8px',
        boxShadow: 'var(--shadow-card)',
        fontSize: 11,
        display: 'grid',
        gap: 4,
        minWidth: 150,
      }}
    >
      {isValidDay ? (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onOpenDetails?.(day)}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            border: '1px solid var(--primary-500)',
            background: 'color-mix(in oklab, var(--primary-500) 14%, var(--neutral-0) 86%)',
            borderRadius: 'var(--radius-sm)',
            minHeight: 20,
            padding: '0 6px',
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--primary-700)',
            cursor: 'pointer',
          }}
        >
          Détails
        </button>
      ) : null}
      <p
        style={{
          margin: 0,
          fontWeight: 800,
          color: 'var(--neutral-700)',
          fontSize: 11,
          lineHeight: 1.45,
          paddingRight: 56,
        }}
      >
        {`Jour ${label}`}
      </p>
      <div
        aria-hidden="true"
        style={{
          borderTop: '1px solid var(--neutral-150)',
          marginTop: 1,
          marginBottom: 2,
        }}
      />
      {cashflow ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ color: 'var(--neutral-600)' }}>Cashflow</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: cashflowValue >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
            {formatCurrency(cashflowValue)}
          </span>
        </div>
      ) : null}
      {expenses ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ color: 'var(--neutral-600)' }}>Dépenses cum.</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: SERIES_COLORS.depenses }}>
            {formatCurrency(expensesValue)}
          </span>
        </div>
      ) : null}
      {displayMode === 'tout' && hasPlannedOps ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ color: 'var(--neutral-600)' }}>Opé.planifiées</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-800)' }}>
            {`${fixedRecurringOpsCount ?? 0} (${formatCurrency(plannedOpsAmount ?? 0)})`}
          </span>
        </div>
      ) : null}
      {displayMode === 'cashflow' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ color: 'var(--neutral-600)' }}>Solde</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: (theoreticalBalance ?? 0) >= 0 ? 'var(--color-success)' : 'var(--color-error)',
            }}
          >
            {formatCurrency(theoreticalBalance ?? 0)}
          </span>
        </div>
      ) : null}
    </div>
  )
}

export function TrajectoireChart() {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const defaultMonth = currentMonth >= 6 && currentMonth <= 12 ? currentMonth : 6

  const [selectedMonth, setSelectedMonth] = useState<number>(defaultMonth)
  const [displayMode, setDisplayMode] = useState<TrajectoryDisplayMode>('tout')
  const [side, setSide] = useState<TrajectorySide>('front')
  const [isMonthMenuOpen, setIsMonthMenuOpen] = useState(false)
  const [isDisplayMenuOpen, setIsDisplayMenuOpen] = useState(false)
  const [highlightedDay, setHighlightedDay] = useState<number | null>(null)
  const [selectedDetailDay, setSelectedDetailDay] = useState<number | null>(null)
  const monthMenuRef = useRef<HTMLDivElement | null>(null)
  const displayMenuRef = useRef<HTMLDivElement | null>(null)

  const availableMonths = useMemo(
    () => MONTHS.filter((month) => month.value >= defaultMonth),
    [defaultMonth],
  )
  const selectedMonthLabel = useMemo(
    () => availableMonths.find((month) => month.value === selectedMonth)?.label ?? MONTHS[0].label,
    [availableMonths, selectedMonth],
  )
  const selectedDisplayLabel = useMemo(
    () => DISPLAY_MODE_OPTIONS.find((option) => option.id === displayMode)?.label ?? 'tout',
    [displayMode],
  )

  useEffect(() => {
    if (!isMonthMenuOpen && !isDisplayMenuOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (monthMenuRef.current?.contains(target)) return
      if (displayMenuRef.current?.contains(target)) return
      setIsMonthMenuOpen(false)
      setIsDisplayMenuOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isDisplayMenuOpen, isMonthMenuOpen])

  const { data: rows = [], isLoading } = useDailyCashflowForecast(FORECAST_YEAR, selectedMonth)
  const { data: plannedOps = [] } = useTrajectoryPlannedOperations(FORECAST_YEAR, selectedMonth)

  const chartData = useMemo(() => {
    let cumulativeIncome = 0
    return rows.map((row) => {
      cumulativeIncome += Number(row.daily_income ?? 0)
      return {
        dom: row.day_of_month,
        cashflow: row.cumulative_cashflow,
        expenses: row.cumulative_expenses,
        income: cumulativeIncome,
      }
    })
  }, [rows])

  const endCashflow = useMemo(
    () => (rows.length ? rows[rows.length - 1].cumulative_cashflow : null),
    [rows],
  )
  const endExpenses = useMemo(
    () => (rows.length ? rows[rows.length - 1].cumulative_expenses : null),
    [rows],
  )
  const isCashflowPositive = endCashflow !== null && endCashflow >= 0

  const metricValue = useMemo(() => {
    if (displayMode === 'depenses') return endExpenses
    return endCashflow
  }, [displayMode, endCashflow, endExpenses])
  const metricColor = useMemo(() => {
    if (displayMode === 'depenses') return SERIES_COLORS.depenses
    if (displayMode === 'cashflow') return isCashflowPositive ? 'var(--color-success)' : 'var(--color-error)'
    return SERIES_COLORS.cashflow
  }, [displayMode, isCashflowPositive])
  const metricSubtitle = useMemo(() => {
    if (displayMode === 'depenses') return 'dépenses cumulées fin de mois'
    if (displayMode === 'cashflow') return 'cashflow net fin de mois'
    return 'vue complète: revenus, dépenses, cashflow'
  }, [displayMode])

  const yValues = useMemo(() => {
    if (displayMode === 'depenses') return chartData.map((row) => row.expenses)
    if (displayMode === 'cashflow') return chartData.map((row) => row.cashflow)
    return chartData.flatMap((row) => [row.cashflow, row.expenses, row.income])
  }, [chartData, displayMode])
  const yMin = useMemo(() => {
    if (!yValues.length) return -1000
    const min = Math.min(...yValues)
    return Math.floor(Math.min(min, 0) * 1.15 / 100) * 100
  }, [yValues])
  const yMax = useMemo(() => {
    if (!yValues.length) return 4000
    const max = Math.max(...yValues)
    return Math.ceil(max * 1.1 / 100) * 100
  }, [yValues])

  const incomeDay = useMemo(() => {
    const match = rows.find((row) => row.daily_income > 0)
    return match?.day_of_month ?? null
  }, [rows])

  const fixedRecurringOpsByDay = useMemo(() => {
    const map = new Map<number, typeof plannedOps>()
    for (const op of plannedOps) {
      const day = Number(op.planned_date.slice(8, 10))
      if (!Number.isFinite(day)) continue
      if (op.flow_type !== 'expense') continue
      if (op.budget_impact !== 'already_budgeted') continue
      const current = map.get(day) ?? []
      map.set(day, [...current, op])
    }
    return map
  }, [plannedOps])

  const detailedOpsByDay = useMemo(() => {
    const map = new Map<number, typeof plannedOps>()
    for (const op of plannedOps) {
      const day = Number(op.planned_date.slice(8, 10))
      if (!Number.isFinite(day)) continue
      if (op.flow_type !== 'expense') continue
      const current = map.get(day) ?? []
      map.set(day, [...current, op])
    }
    return map
  }, [plannedOps])

  const plannedOpsAmountByDay = useMemo(() => {
    const map = new Map<number, number>()
    for (const [day, dayOps] of fixedRecurringOpsByDay) {
      const total = dayOps.reduce((sum, op) => sum + Math.abs(Number(op.planned_personal_amount ?? 0)), 0)
      map.set(day, total)
    }
    return map
  }, [fixedRecurringOpsByDay])

  const cashflowByDay = useMemo(() => {
    const map = new Map<number, number>()
    for (const row of rows) {
      map.set(row.day_of_month, Number(row.cumulative_cashflow ?? 0))
    }
    return map
  }, [rows])

  const backRows = useMemo(
    () =>
      rows.map((row) => ({
        day: row.day_of_month,
        date: row.forecast_date,
        expenses: row.cumulative_expenses,
        dailyExpenses: row.daily_total_expenses,
        cashflow: row.cumulative_cashflow,
        fixedOpsCount: fixedRecurringOpsByDay.get(row.day_of_month)?.length ?? 0,
      })),
    [rows, fixedRecurringOpsByDay],
  )

  const selectedDayRow = useMemo(
    () => rows.find((row) => row.day_of_month === selectedDetailDay) ?? null,
    [rows, selectedDetailDay],
  )
  const selectedDayOps = useMemo(
    () => (selectedDetailDay ? detailedOpsByDay.get(selectedDetailDay) ?? [] : []),
    [detailedOpsByDay, selectedDetailDay],
  )
  const certainOps = useMemo(
    () => selectedDayOps.filter((op) => op.budget_impact === 'already_budgeted'),
    [selectedDayOps],
  )
  const plannedExtraOps = useMemo(
    () => selectedDayOps.filter((op) => op.budget_impact !== 'already_budgeted'),
    [selectedDayOps],
  )

  const speculativeRows = useMemo(() => {
    if (!selectedDayRow) return []
    const rowsForDay = [
      { label: 'Projection variable (modèle)', amount: Number(selectedDayRow.daily_variable_ops ?? 0) },
      { label: 'Engagements additionnels (modèle)', amount: Number(selectedDayRow.daily_forward_ops ?? 0) },
    ]
    if (Number(selectedDayRow.daily_savings_ops ?? 0) > 0) {
      rowsForDay.push({ label: 'Épargne planifiée', amount: Number(selectedDayRow.daily_savings_ops ?? 0) })
    }
    return rowsForDay
  }, [selectedDayRow])

  const legendItems = useMemo(() => {
    if (displayMode === 'depenses') return [{ key: 'depenses', label: 'Dépenses cumulées', color: SERIES_COLORS.depenses }]
    if (displayMode === 'cashflow') return [{ key: 'cashflow', label: 'Cashflow net', color: SERIES_COLORS.cashflow }]
    return [
      { key: 'revenus', label: 'Revenus cumulés', color: SERIES_COLORS.revenus },
      { key: 'depenses', label: 'Dépenses cumulées', color: SERIES_COLORS.depenses },
      { key: 'cashflow', label: 'Cashflow net', color: SERIES_COLORS.cashflow },
    ]
  }, [displayMode])

  return (
    <div
      style={{
        background: 'radial-gradient(120% 85% at 14% -8%, rgba(148,140,255,0.26) 0%, rgba(148,140,255,0) 58%), radial-gradient(98% 82% at 100% 100%, rgba(91,87,245,0.2) 0%, rgba(91,87,245,0) 62%), linear-gradient(145deg, #F7F7FF 0%, #EEF0FF 100%)',
        border: '1px solid rgba(133,126,245,0.28)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        padding: 'var(--space-4)',
        display: 'grid',
        gap: 'var(--space-3)',
      }}
    >
      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <div style={{ display: 'grid', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Trajectoire
              </p>
              {side === 'front' ? (
                <div ref={displayMenuRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setIsDisplayMenuOpen((open) => !open)}
                    aria-haspopup="listbox"
                    aria-expanded={isDisplayMenuOpen}
                    aria-label={`Sélection d'affichage, actuellement ${selectedDisplayLabel}`}
                    style={{
                      border: '1px solid rgba(91,87,245,0.35)',
                      background: 'rgba(255,255,255,0.86)',
                      borderRadius: 'var(--radius-full)',
                      minHeight: SELECTOR_MIN_HEIGHT,
                      padding: '0 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--neutral-800)',
                      cursor: 'pointer',
                      textTransform: 'lowercase',
                    }}
                  >
                    <span>{selectedDisplayLabel}</span>
                    <span aria-hidden="true" style={{ fontSize: 10, lineHeight: 1 }}>▾</span>
                  </button>
                  {isDisplayMenuOpen ? (
                    <div
                      role="listbox"
                      aria-label="Paramètres d'affichage"
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        minWidth: 126,
                        background: 'var(--neutral-0)',
                        border: '1px solid var(--neutral-200)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-card)',
                        padding: 'var(--space-1)',
                        display: 'grid',
                        gap: 2,
                        zIndex: 3,
                      }}
                    >
                      {DISPLAY_MODE_OPTIONS.map((option) => {
                        const active = option.id === displayMode
                        const activeStyle =
                          option.id === 'depenses'
                            ? 'color-mix(in oklab, #FF7A1A 16%, var(--neutral-0) 84%)'
                            : option.id === 'cashflow'
                              ? 'color-mix(in oklab, #5B57F5 16%, var(--neutral-0) 84%)'
                              : 'color-mix(in oklab, #12B4A9 16%, var(--neutral-0) 84%)'

                        return (
                          <button
                            key={option.id}
                            type="button"
                            role="option"
                            aria-selected={active}
                            onClick={() => {
                              setDisplayMode(option.id)
                              setIsDisplayMenuOpen(false)
                            }}
                            style={{
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              minHeight: 28,
                              padding: '0 8px',
                              textAlign: 'left',
                              fontSize: 11,
                              fontWeight: active ? 700 : 500,
                              color: active ? 'var(--neutral-900)' : 'var(--neutral-700)',
                              background: active ? activeStyle : 'transparent',
                              cursor: 'pointer',
                              textTransform: 'lowercase',
                            }}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSide('front')}
                  style={{
                    border: '1px solid var(--neutral-250)',
                    background: 'var(--neutral-0)',
                    borderRadius: 'var(--radius-full)',
                    minHeight: 24,
                    padding: '0 8px',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--neutral-700)',
                    cursor: 'pointer',
                  }}
                >
                  Retour graphe
                </button>
              )}
            </div>
            {metricValue !== null && !isLoading ? (
              <p style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: metricColor, lineHeight: 1.1 }}>
                {formatCurrency(metricValue)}
              </p>
            ) : (
              <div style={{ width: 80, height: 22, borderRadius: 'var(--radius-sm)', background: 'var(--neutral-100)' }} />
            )}
            <p style={{ margin: 0, fontSize: 10, color: 'var(--neutral-500)' }}>
              {side === 'front' ? metricSubtitle : 'roadmap quotidienne: certaines + projections'}
            </p>
          </div>
          <div style={{ display: 'grid', justifyItems: 'end', gap: 6 }}>
            <div ref={monthMenuRef} style={{ position: 'relative', justifySelf: 'end' }}>
              <button
                type="button"
                onClick={() => setIsMonthMenuOpen((open) => !open)}
                aria-haspopup="listbox"
                aria-expanded={isMonthMenuOpen}
                aria-label={`Sélectionner le mois, actuellement ${selectedMonthLabel}`}
                style={{
                  border: '1px solid var(--neutral-250)',
                  background: 'var(--neutral-0)',
                  borderRadius: 'var(--radius-full)',
                  minHeight: SELECTOR_MIN_HEIGHT,
                  padding: '0 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--neutral-800)',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <span>{selectedMonthLabel}</span>
                <span aria-hidden="true" style={{ fontSize: 10, lineHeight: 1 }}>▾</span>
              </button>
              {isMonthMenuOpen ? (
                <div
                  role="listbox"
                  aria-label="Mois disponibles"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    minWidth: 108,
                    background: 'var(--neutral-0)',
                    border: '1px solid var(--neutral-200)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-card)',
                    padding: 'var(--space-1)',
                    display: 'grid',
                    gap: 2,
                    zIndex: 3,
                  }}
                >
                  {availableMonths.map((month) => {
                    const active = month.value === selectedMonth
                    return (
                      <button
                        key={month.value}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setSelectedMonth(month.value)
                          setIsMonthMenuOpen(false)
                          setHighlightedDay(null)
                          setSelectedDetailDay(null)
                        }}
                        style={{
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          minHeight: 28,
                          padding: '0 8px',
                          textAlign: 'left',
                          fontSize: 11,
                          fontWeight: active ? 700 : 500,
                          color: active ? 'var(--primary-700)' : 'var(--neutral-700)',
                          background: active ? 'color-mix(in oklab, var(--primary-500) 12%, var(--neutral-0) 88%)' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        {month.label}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {side === 'front' ? (
        <>
          <div style={{ height: 168, marginLeft: -8, marginRight: -4 }}>
            {isLoading ? (
              <div style={{ height: '100%', background: 'var(--neutral-50)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-400)' }}>Chargement…</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cashflowGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SERIES_COLORS.cashflow} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={SERIES_COLORS.cashflow} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SERIES_COLORS.depenses} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={SERIES_COLORS.depenses} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-150)" vertical={false} />

                  <XAxis
                    dataKey="dom"
                    tick={{ fontSize: 9, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}
                    tickLine={false}
                    axisLine={false}
                    interval={4}
                    tickFormatter={(v: number) => String(v)}
                  />

                  <YAxis
                    domain={[yMin, yMax]}
                    tick={{ fontSize: 9, fill: 'var(--neutral-400)', fontFamily: 'var(--font-mono)' }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tickFormatter={(v: number) => {
                      if (v === 0) return '0'
                      const abs = Math.abs(v)
                      const sign = v < 0 ? '-' : ''
                      if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k€`
                      return `${sign}${Math.round(abs)}€`
                    }}
                  />

                  <Tooltip
                    wrapperStyle={{ pointerEvents: 'auto' }}
                    cursor={{ stroke: 'color-mix(in oklab, var(--primary-500) 35%, transparent 65%)', strokeWidth: 1 }}
                    content={(tooltipProps) => {
                      const tooltipDay =
                        typeof tooltipProps.label === 'number'
                          ? tooltipProps.label
                          : Number(tooltipProps.label)
                      const fixedCount =
                        Number.isFinite(tooltipDay) && tooltipDay > 0
                          ? (fixedRecurringOpsByDay.get(tooltipDay)?.length ?? 0)
                          : 0
                      const plannedAmount =
                        Number.isFinite(tooltipDay) && tooltipDay > 0
                          ? (plannedOpsAmountByDay.get(tooltipDay) ?? 0)
                          : 0
                      const balance =
                        Number.isFinite(tooltipDay) && tooltipDay > 0
                          ? (cashflowByDay.get(tooltipDay) ?? 0)
                          : 0

                      return (
                        <CustomTooltip
                          active={tooltipProps.active}
                          payload={tooltipProps.payload}
                          label={tooltipProps.label}
                          displayMode={displayMode}
                          fixedRecurringOpsCount={fixedCount}
                          plannedOpsAmount={plannedAmount}
                          theoreticalBalance={balance}
                          onOpenDetails={(day) => {
                            setHighlightedDay(day)
                            setSide('back')
                          }}
                        />
                      )
                    }}
                  />

                  <ReferenceLine y={0} stroke="var(--neutral-300)" strokeDasharray="4 3" strokeWidth={1} />

                  {displayMode === 'tout' && incomeDay !== null ? (
                    <ReferenceLine
                      x={incomeDay}
                      stroke={SERIES_COLORS.revenus}
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      label={{ value: `J${incomeDay}`, position: 'insideTopRight', fontSize: 8, fill: SERIES_COLORS.revenus, fontWeight: 700 }}
                    />
                  ) : null}

                  {displayMode === 'depenses' || displayMode === 'tout' ? (
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      name="expenses"
                      stroke={SERIES_COLORS.depenses}
                      strokeWidth={displayMode === 'depenses' ? 3 : 2.4}
                      fill={displayMode === 'depenses' ? 'url(#expensesGradient)' : 'none'}
                      dot={false}
                      activeDot={{ r: 4, fill: SERIES_COLORS.depenses, strokeWidth: 0 }}
                      isAnimationActive={false}
                    />
                  ) : null}

                  {displayMode === 'cashflow' || displayMode === 'tout' ? (
                    <Area
                      type="monotone"
                      dataKey="cashflow"
                      name="cashflow"
                      stroke={SERIES_COLORS.cashflow}
                      strokeWidth={displayMode === 'cashflow' ? 3 : 2.4}
                      fill={displayMode === 'cashflow' ? 'url(#cashflowGradient)' : 'none'}
                      dot={false}
                      activeDot={{ r: 4, fill: SERIES_COLORS.cashflow, strokeWidth: 0 }}
                      isAnimationActive={false}
                    />
                  ) : null}

                  {displayMode === 'tout' ? (
                    <Area
                      type="monotone"
                      dataKey="income"
                      name="income"
                      stroke={SERIES_COLORS.revenus}
                      strokeWidth={2.4}
                      strokeDasharray="6 3"
                      fill="none"
                      dot={false}
                      activeDot={{ r: 4, fill: SERIES_COLORS.revenus, strokeWidth: 0 }}
                      isAnimationActive={false}
                    />
                  ) : null}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
              {legendItems.map((item) => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 16, height: 2, borderRadius: 1, background: item.color }} />
                  <span style={{ fontSize: 10, color: 'var(--neutral-600)', fontWeight: 700 }}>{item.label}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSide('back')}
              style={{
                border: '1px solid rgba(91,87,245,0.38)',
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-sm)',
                minHeight: 24,
                padding: '0 8px',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--primary-700)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                marginLeft: 'auto',
              }}
            >
              Voir détails
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.72)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '20%', textAlign: 'left', padding: '8px 10px', fontSize: 10, color: 'var(--neutral-600)', fontWeight: 700 }}>Jour</th>
                  <th style={{ width: '20%', textAlign: 'right', padding: '8px 10px', fontSize: 10, color: 'var(--neutral-600)', fontWeight: 700 }}>Dép.cum</th>
                  <th style={{ width: '20%', textAlign: 'right', padding: '8px 10px', fontSize: 10, color: 'var(--neutral-600)', fontWeight: 700 }}>Dép.jour</th>
                  <th style={{ width: '20%', textAlign: 'right', padding: '8px 10px', fontSize: 10, color: 'var(--neutral-600)', fontWeight: 700 }}>Cashflow</th>
                  <th style={{ width: '20%', textAlign: 'right', padding: '8px 10px', fontSize: 10, color: 'var(--neutral-600)', fontWeight: 700 }}>Fixes</th>
                </tr>
              </thead>
              <tbody>
                {backRows.map((row) => {
                  const isHighlighted = highlightedDay === row.day
                  return (
                    <tr key={row.day} style={{ background: isHighlighted ? 'color-mix(in oklab, var(--primary-500) 8%, transparent 92%)' : 'transparent' }}>
                      <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--neutral-700)', borderTop: '1px solid var(--neutral-150)' }}>
                        {formatDayLabel(FORECAST_YEAR, selectedMonth, row.day)}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 11, color: SERIES_COLORS.depenses, borderTop: '1px solid var(--neutral-150)', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {formatCurrency(row.expenses)}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--neutral-700)', borderTop: '1px solid var(--neutral-150)', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {formatCurrency(row.dailyExpenses)}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 11, color: row.cashflow >= 0 ? 'var(--color-success)' : 'var(--color-error)', borderTop: '1px solid var(--neutral-150)', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {formatCurrency(row.cashflow)}
                      </td>
                      <td style={{ padding: '8px 10px', borderTop: '1px solid var(--neutral-150)', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: 11, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                            {row.fixedOpsCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedDetailDay(row.day)}
                            aria-label={`Voir les opérations du ${formatDayLabel(FORECAST_YEAR, selectedMonth, row.day)}`}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              padding: 0,
                              width: 12,
                              height: 12,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: 'var(--neutral-700)',
                              fontSize: 10,
                              lineHeight: 1,
                            }}
                          >
                            ▸
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedDetailDay !== null ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 240 }}>
          <button
            type="button"
            aria-label="Fermer la fenêtre des opérations"
            onClick={() => setSelectedDetailDay(null)}
            style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(13,13,31,0.5)', cursor: 'pointer' }}
          />
          <div style={{ position: 'absolute', left: 'var(--space-4)', right: 'var(--space-4)', top: '10%', maxWidth: 500, margin: '0 auto', background: 'var(--neutral-0)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)', maxHeight: '78dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: 'var(--neutral-900)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {`Roadmap du ${formatDayLabel(FORECAST_YEAR, selectedMonth, selectedDetailDay)}`}
              </p>
              <button type="button" onClick={() => setSelectedDetailDay(null)} aria-label="Fermer" style={{ border: 'none', background: 'var(--neutral-100)', color: 'var(--neutral-600)', width: 30, height: 30, borderRadius: 'var(--radius-full)', cursor: 'pointer' }}>
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-700)' }}>
                Opérations certaines (fixes récurrentes)
              </p>
              {certainOps.length === 0 ? (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-500)' }}>Aucune opération fixe prévue ce jour.</p>
              ) : (
                certainOps.map((op) => (
                  <div key={op.id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-2)', padding: '6px 0', borderTop: '1px solid var(--neutral-150)' }}>
                    <span style={{ fontSize: 11, color: 'var(--neutral-800)' }}>{op.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                      {formatCurrency(op.planned_personal_amount)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-700)' }}>
                Opérations planifiées complémentaires
              </p>
              {plannedExtraOps.length === 0 ? (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-500)' }}>Aucune opération complémentaire planifiée.</p>
              ) : (
                plannedExtraOps.map((op) => (
                  <div key={op.id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-2)', padding: '6px 0', borderTop: '1px solid var(--neutral-150)' }}>
                    <span style={{ fontSize: 11, color: 'var(--neutral-800)' }}>{op.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                      {formatCurrency(op.planned_personal_amount)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--neutral-700)' }}>
                Projections théoriques (modèle)
              </p>
              {speculativeRows.map((row) => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-2)', padding: '6px 0', borderTop: '1px solid var(--neutral-150)' }}>
                  <span style={{ fontSize: 11, color: 'var(--neutral-700)' }}>{row.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                    {formatCurrency(row.amount)}
                  </span>
                </div>
              ))}
              {selectedDayRow ? (
                <p style={{ margin: 0, fontSize: 10, color: 'var(--neutral-500)', lineHeight: 1.35 }}>
                  Compare ces repères théoriques avec tes dépenses réelles du jour pour piloter les écarts.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
