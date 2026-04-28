import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Search, SlidersHorizontal, ArrowLeft, BarChart2 } from 'lucide-react'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import type { FlowType, Transaction } from '@/lib/types'
import { useNavigate } from 'react-router-dom'

type FlowFilter = 'all' | 'income' | 'expense' | 'transfer'
type PeriodFilter = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all'
type PeriodMode = 'current' | 'rolling'

const FLOW_OPTIONS: Array<{ value: FlowFilter; label: string }> = [
  { value: 'all', label: 'Toutes' },
  { value: 'expense', label: 'Depenses' },
  { value: 'income', label: 'Revenus' },
  { value: 'transfer', label: 'Transferts internes' },
]

const PERIOD_OPTIONS: Array<{ value: PeriodFilter; label: string }> = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Annee' },
  { value: 'all', label: 'Tout' },
]

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function startOfIsoDay(d: Date): string {
  const dt = new Date(d)
  dt.setHours(0, 0, 0, 0)
  return dt.toISOString().slice(0, 10)
}

function startOfIsoMonth(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function startOfIsoQuarter(d: Date): string {
  const qMonth = Math.floor(d.getMonth() / 3) * 3
  return new Date(d.getFullYear(), qMonth, 1).toISOString().slice(0, 10)
}

function startOfIsoYear(d: Date): string {
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10)
}

function periodToRange(period: PeriodFilter, mode: PeriodMode): { startDate?: string; endDate?: string } {
  const now = new Date()
  switch (period) {
    case 'day': {
      const start = startOfIsoDay(now)
      return { startDate: start, endDate: todayIso() }
    }
    case 'week': {
      if (mode === 'rolling') {
        const start = new Date(now)
        start.setDate(now.getDate() - 5) // last 6 days incl today
        return { startDate: startOfIsoDay(start), endDate: todayIso() }
      }
      const day = now.getDay() === 0 ? 6 : now.getDay() - 1
      const monday = new Date(now)
      monday.setDate(now.getDate() - day)
      return { startDate: startOfIsoDay(monday), endDate: todayIso() }
    }
    case 'month': {
      if (mode === 'rolling') {
        const start = new Date(now)
        start.setDate(now.getDate() - 29) // last 30 days incl today
        return { startDate: startOfIsoDay(start), endDate: todayIso() }
      }
      return { startDate: startOfIsoMonth(now), endDate: todayIso() }
    }
    case 'quarter': {
      if (mode === 'rolling') {
        const start = new Date(now)
        start.setDate(now.getDate() - 89) // last 90 days incl today
        return { startDate: startOfIsoDay(start), endDate: todayIso() }
      }
      return { startDate: startOfIsoQuarter(now), endDate: todayIso() }
    }
    case 'year': {
      if (mode === 'rolling') {
        const start = new Date(now)
        start.setDate(now.getDate() - 364) // last 365 days incl today
        return { startDate: startOfIsoDay(start), endDate: todayIso() }
      }
      return { startDate: startOfIsoYear(now), endDate: todayIso() }
    }
    case 'all':
      return {}
  }
}

function displayTxnLabel(t: Transaction): string {
  return (t.normalized_label ?? t.raw_label ?? 'Operation').trim() || 'Operation'
}

function displayTxnCategoryName(t: Transaction): string {
  return t.category?.name ?? 'Sans categorie'
}

function signedAmount(t: Transaction): number {
  const amount = Number(t.amount) || 0
  if (t.flow_type === 'expense') return -amount
  if (t.flow_type === 'income') return amount
  return 0
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map((x) => Number(x))
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function flowTypeLabel(flowType: string): string {
  if (flowType === 'income') return 'Revenus'
  if (flowType === 'expense') return 'Depenses'
  if (flowType === 'transfer') return 'Transferts internes'
  return flowType
}

function budgetBehaviorLabel(value: string): string {
  if (value === 'fixed') return 'Fixe'
  if (value === 'variable') return 'Variable'
  if (value === 'excluded') return 'Exclu'
  return value
}

function shareRatioLabel(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const pct = Math.round(Number(value) * 100)
  if (pct === 100) return 'Personnel (100%)'
  if (pct === 0) return 'Non imputable (0%)'
  return `Personnel (${pct}%)`
}

function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,13,31,0.48)' }}
          />
          <motion.div
            key="sh"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 330 }}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 61,
              width: '100%',
              maxWidth: 420,
              margin: '0 auto',
              background: '#fff',
              borderRadius: '24px 24px 0 0',
              padding: '12px 18px calc(18px + env(safe-area-inset-bottom, 0px))',
              maxHeight: 'calc(100dvh - 8px)',
              overflow: 'hidden',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--neutral-200)', margin: '6px auto 12px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 800,
                  color: 'var(--neutral-800)',
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </p>
              <button
                type="button"
                onClick={onClose}
                style={{
                  border: 'none',
                  background: 'var(--neutral-100)',
                  borderRadius: 'var(--radius-full)',
                  width: 34,
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                aria-label="Fermer"
              >
                <ChevronDown size={18} color="var(--neutral-600)" />
              </button>
            </div>
            <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' as CSSProperties['WebkitOverflowScrolling'], paddingBottom: 2 }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function ChipButton({
  value,
  onClick,
}: {
  value: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-10 w-full"
      style={{
        background: 'var(--neutral-0)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-full)',
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--neutral-500)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {value}
        <ChevronDown size={14} />
      </span>
    </button>
  )
}

function Switch({
  value,
  onChange,
}: {
  value: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 'var(--radius-full)',
        background: value ? 'var(--primary-500)' : 'var(--neutral-200)',
        border: value ? '1px solid var(--primary-400)' : '1px solid var(--neutral-200)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s, border-color 0.2s',
        flexShrink: 0,
      }}
      aria-pressed={value}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: value ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  )
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        border: value ? '1.5px solid var(--primary-500)' : '1.5px solid var(--neutral-200)',
        background: value ? 'var(--primary-50)' : '#fff',
        borderRadius: 'var(--radius-xl)',
        padding: '10px 12px',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--neutral-700)', fontWeight: 600 }}>{label}</span>
      <Switch value={value} onChange={onChange} />
    </div>
  )
}

function SegmentedToggle({
  left,
  right,
  value,
  onChange,
}: {
  left: string
  right: string
  value: 'left' | 'right'
  onChange: (next: 'left' | 'right') => void
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--neutral-100)',
        borderRadius: 'var(--radius-full)',
        padding: 2,
        gap: 2,
        border: '1px solid var(--neutral-200)',
      }}
    >
      <button
        type="button"
        onClick={() => onChange('left')}
        style={{
          border: 'none',
          cursor: 'pointer',
          borderRadius: 'var(--radius-full)',
          padding: '6px 10px',
          fontSize: 11,
          fontWeight: 800,
          background: value === 'left' ? '#fff' : 'transparent',
          color: value === 'left' ? 'var(--neutral-900)' : 'var(--neutral-500)',
          boxShadow: value === 'left' ? 'var(--shadow-sm)' : 'none',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {left}
      </button>
      <button
        type="button"
        onClick={() => onChange('right')}
        style={{
          border: 'none',
          cursor: 'pointer',
          borderRadius: 'var(--radius-full)',
          padding: '6px 10px',
          fontSize: 11,
          fontWeight: 800,
          background: value === 'right' ? '#fff' : 'transparent',
          color: value === 'right' ? 'var(--neutral-900)' : 'var(--neutral-500)',
          boxShadow: value === 'right' ? 'var(--shadow-sm)' : 'none',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {right}
      </button>
    </div>
  )
}

export function Flux() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [flow, setFlow] = useState<FlowFilter>('expense')
  const [period, setPeriod] = useState<PeriodFilter>('month')
  const [periodMode, setPeriodMode] = useState<PeriodMode>('current')

  const [showTypeSheet, setShowTypeSheet] = useState(false)
  const [showPeriodSheet, setShowPeriodSheet] = useState(false)
  const [showCategorySheet, setShowCategorySheet] = useState(false)
  const [showAdvancedSheet, setShowAdvancedSheet] = useState(false)

  const [categoryStage, setCategoryStage] = useState<'parents' | 'children'>('parents')
  const [selectedParentCategoryId, setSelectedParentCategoryId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const [excludeRecurring, setExcludeRecurring] = useState(false)
  const [onlyFixed, setOnlyFixed] = useState(false)
  const [onlyJoint, setOnlyJoint] = useState(false)
  const [detailsTxn, setDetailsTxn] = useState<Transaction | null>(null)

  const categoryFlowType = flow === 'income' ? 'income' : 'expense'
  const { data: flowCategories } = useCategories(categoryFlowType)
  const rootCategories = useMemo(
    () => (flowCategories ?? []).filter((c) => c.parent_id === null),
    [flowCategories],
  )
  const subCategories = useMemo(
    () => (flowCategories ?? []).filter((c) => c.parent_id !== null),
    [flowCategories],
  )
  const parentById = useMemo(() => new Map((rootCategories ?? []).map((c) => [c.id, c])), [rootCategories])
  const categoryById = useMemo(() => new Map((flowCategories ?? []).map((c) => [c.id, c])), [flowCategories])

  const range = useMemo(() => periodToRange(period, periodMode), [period, periodMode])
  const flowTypeFilter: FlowType | undefined = flow === 'all' ? undefined : (flow as FlowType)

  const categoryIdsFilter = useMemo(() => {
    if (!selectedCategoryId && !selectedParentCategoryId) return undefined
    if (selectedCategoryId) return [selectedCategoryId]
    const children = subCategories.filter((c) => c.parent_id === selectedParentCategoryId).map((c) => c.id)
    return selectedParentCategoryId ? [selectedParentCategoryId, ...children] : undefined
  }, [selectedCategoryId, selectedParentCategoryId, subCategories])

  const { data: txns, isLoading } = useTransactions({
    ...range,
    flowType: flowTypeFilter,
    categoryIds: categoryIdsFilter,
  })

  const filtered = useMemo(() => {
    let list = (txns ?? []) as Transaction[]

    if (excludeRecurring) list = list.filter((t) => !t.is_recurring)
    if (onlyFixed) list = list.filter((t) => t.budget_behavior === 'fixed')
    if (onlyJoint) list = list.filter((t) => t.account?.name?.toLowerCase().includes('joint') ?? false)

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((t) => displayTxnLabel(t).toLowerCase().includes(q))
    }

    return list
  }, [txns, excludeRecurring, onlyFixed, onlyJoint, search])

  const totalAmount = useMemo(() => filtered.reduce((sum, t) => sum + signedAmount(t), 0), [filtered])

  const typeLabel = FLOW_OPTIONS.find((o) => o.value === flow)?.label ?? 'Depenses'
  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? 'Mois'
  const categoryLabel = useMemo(() => {
    if (selectedCategoryId) return categoryById.get(selectedCategoryId)?.name ?? 'Categorie'
    if (selectedParentCategoryId) return parentById.get(selectedParentCategoryId)?.name ?? 'Categorie'
    return 'Toutes'
  }, [categoryById, parentById, selectedCategoryId, selectedParentCategoryId])

  const selectedParent = selectedParentCategoryId ? parentById.get(selectedParentCategoryId) ?? null : null
  const selectedChildren = useMemo(
    () => (selectedParentCategoryId ? subCategories.filter((c) => c.parent_id === selectedParentCategoryId) : []),
    [selectedParentCategoryId, subCategories],
  )

  useEffect(() => {
    // When switching between depenses/revenus, reset category selection to avoid mismatched sub-categories.
    setSelectedParentCategoryId(null)
    setSelectedCategoryId(null)
    setCategoryStage('parents')
  }, [categoryFlowType])

  const anySheetOpen = showTypeSheet || showPeriodSheet || showCategorySheet || showAdvancedSheet
  const hasAdvancedFilters = excludeRecurring || onlyFixed || onlyJoint
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!anySheetOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [anySheetOpen])

  const groupedByMonth = useMemo(() => {
    if (period !== 'quarter' && period !== 'year') return null
    const groups = new Map<string, Transaction[]>()
    filtered.forEach((t) => {
      const ym = (t.transaction_date || '').slice(0, 7)
      const arr = groups.get(ym) ?? []
      arr.push(t)
      groups.set(ym, arr)
    })
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a))
  }, [filtered, period])

  return (
    <div className="flex flex-col pb-nav" style={{ minHeight: '100dvh' }}>
      <div style={{ padding: '20px 20px 10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--neutral-0)',
            border: '1px solid var(--neutral-200)',
            borderRadius: 'var(--radius-2xl)',
            boxShadow: 'var(--shadow-card)',
            padding: '10px 12px',
          }}
        >
          <Search size={16} color="var(--neutral-400)" />
          <input
            type="text"
            placeholder="Recherche"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 13,
              color: 'var(--neutral-800)',
              background: 'transparent',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 42px', gap: 8, alignItems: 'center' }}>
          <ChipButton value={typeLabel} onClick={() => setShowTypeSheet(true)} />
          <ChipButton value={periodLabel} onClick={() => setShowPeriodSheet(true)} />
          <ChipButton value={categoryLabel} onClick={() => { setShowCategorySheet(true) }} />
          <button
            type="button"
            onClick={() => setShowAdvancedSheet(true)}
            style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-full)',
              background: 'var(--neutral-0)',
              border: hasAdvancedFilters ? '1px solid var(--primary-500)' : '1px solid var(--neutral-200)',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Filtres avances"
          >
            <SlidersHorizontal size={16} color="var(--neutral-700)" />
          </button>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <div
          style={{
            background: 'var(--neutral-0)',
            border: '1px solid var(--neutral-200)',
            borderRadius: 'var(--radius-2xl)',
            boxShadow: 'var(--shadow-card)',
            padding: '14px 14px',
          }}
        >
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Resume de la selection
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px', gap: 10, alignItems: 'center' }}>
            <div>
              <p
                style={{
                  margin: '8px 0 0',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 34,
                  fontWeight: 900,
                  letterSpacing: '-0.02em',
                  color: 'var(--neutral-900)',
                  lineHeight: 1.05,
                }}
              >
                {filtered.length ? formatCurrency(totalAmount) : '—'}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--neutral-500)', fontWeight: 600 }}>
                {filtered.length} operation{filtered.length > 1 ? 's' : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/stats')}
              style={{
                width: 46,
                height: 46,
                borderRadius: 'var(--radius-full)',
                background: 'var(--neutral-0)',
                border: '1px solid var(--neutral-200)',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label="Analyse"
              title="Analyse"
            >
              <BarChart2 size={18} color="var(--primary-500)" />
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Liste des operations
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-400)', fontWeight: 700 }}>
            {filtered.length} resultat{filtered.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div style={{ padding: '10px 20px 0' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '34px 0', textAlign: 'center', color: 'var(--neutral-400)' }}>
            <p style={{ margin: 0, fontSize: 14 }}>Aucune operation</p>
          </motion.div>
        ) : groupedByMonth ? (
          <div style={{ display: 'grid', gap: 14 }}>
            {groupedByMonth.map(([ym, rows], gi) => (
              <motion.div
                key={ym}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * gi, duration: 0.25 }}
              >
                <p
                  style={{
                    margin: '8px 0 10px',
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--neutral-400)',
                  }}
                >
                  {formatMonthLabel(ym)}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {rows.map((t) => {
                    const catName = displayTxnCategoryName(t)
                    const parentName = t.category?.parent_id ? categoryById.get(t.category.parent_id)?.name ?? null : null
                    const iconName = parentName ?? catName
                    const amount = signedAmount(t)

                    return (
                      <button
                        key={t.id}
                        type="button"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          background: 'var(--neutral-0)',
                          border: '1px solid var(--neutral-200)',
                          borderRadius: 'var(--radius-2xl)',
                          boxShadow: 'var(--shadow-card)',
                          padding: '12px 12px',
                          display: 'grid',
                          gridTemplateColumns: '40px 1fr auto 18px',
                          alignItems: 'center',
                          gap: 10,
                          cursor: 'pointer',
                        }}
                        onClick={() => setDetailsTxn(t)}
                      >
                        <CategoryIcon categoryName={iconName} size={34} fallback={null} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)', lineHeight: 1.2 }} className="truncate">
                            {displayTxnLabel(t)}
                          </p>
                          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--neutral-500)' }} className="truncate">
                            {catName}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p
                            style={{
                              margin: 0,
                              fontFamily: 'var(--font-mono)',
                              fontSize: 14,
                              fontWeight: 900,
                              color: amount < 0 ? 'var(--color-negative)' : amount > 0 ? 'var(--color-positive)' : 'var(--neutral-700)',
                            }}
                          >
                            {formatCurrency(amount)}
                          </p>
                        </div>
                        <ChevronRight size={18} color="var(--neutral-400)" />
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((t) => {
              const catName = displayTxnCategoryName(t)
              const parentName = t.category?.parent_id ? categoryById.get(t.category.parent_id)?.name ?? null : null
              const iconName = parentName ?? catName
              const amount = signedAmount(t)

              return (
                <button
                  key={t.id}
                  type="button"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'var(--neutral-0)',
                    border: '1px solid var(--neutral-200)',
                    borderRadius: 'var(--radius-2xl)',
                    boxShadow: 'var(--shadow-card)',
                    padding: '12px 12px',
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr auto 18px',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                  }}
                  onClick={() => setDetailsTxn(t)}
                >
                  <CategoryIcon categoryName={iconName} size={34} fallback={null} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)', lineHeight: 1.2 }} className="truncate">
                      {displayTxnLabel(t)}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--neutral-500)' }} className="truncate">
                      {catName}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 14,
                        fontWeight: 900,
                        color: amount < 0 ? 'var(--color-negative)' : amount > 0 ? 'var(--color-positive)' : 'var(--neutral-700)',
                      }}
                    >
                      {formatCurrency(amount)}
                    </p>
                  </div>
                  <ChevronRight size={18} color="var(--neutral-400)" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      <Sheet open={showTypeSheet} title="Type" onClose={() => setShowTypeSheet(false)}>
        <div style={{ display: 'grid', gap: 8 }}>
          {FLOW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setFlow(opt.value); setShowTypeSheet(false) }}
              style={{
                border: '1px solid var(--neutral-200)',
                borderRadius: 'var(--radius-xl)',
                background: flow === opt.value ? 'var(--primary-50)' : '#fff',
                padding: '12px 12px',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--neutral-800)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={showPeriodSheet} title="Periode" onClose={() => setShowPeriodSheet(false)}>
        <div style={{ display: 'grid', gap: 8 }}>
          {PERIOD_OPTIONS.map((opt) => {
            const supportsMode = ['week', 'month', 'quarter', 'year'].includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setPeriod(opt.value); setShowPeriodSheet(false) }}
                style={{
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 'var(--radius-xl)',
                  background: period === opt.value ? 'var(--primary-50)' : '#fff',
                  padding: '12px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--neutral-800)' }}>{opt.label}</span>
                {supportsMode ? (
                  <div onClick={(e) => e.stopPropagation()}>
                    <SegmentedToggle
                      left="En cours"
                      right="Glissant"
                      value={periodMode === 'current' ? 'left' : 'right'}
                      onChange={(next) => setPeriodMode(next === 'left' ? 'current' : 'rolling')}
                    />
                  </div>
                ) : null}
              </button>
            )
          })}
        </div>
      </Sheet>

      <AnimatePresence>
        {showCategorySheet && (
          <>
            <motion.div
              key="cat-bd"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCategorySheet(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,13,31,0.48)' }}
            />
            <motion.div
              key="cat-sh"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 330 }}
              style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 61,
                width: '100%',
                maxWidth: 420,
                margin: '0 auto',
                background: '#fff',
                borderRadius: '24px 24px 0 0',
                padding: '12px 18px calc(18px + env(safe-area-inset-bottom, 0px))',
                height: 'min(72dvh, calc(100dvh - 8px))',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--neutral-200)', margin: '6px auto 12px' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {categoryStage === 'children' ? (
                    <button
                      type="button"
                      onClick={() => { setCategoryStage('parents'); setSelectedCategoryId(null) }}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 'var(--radius-full)',
                        border: 'none',
                        background: 'var(--neutral-100)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      aria-label="Retour"
                    >
                      <ArrowLeft size={16} color="var(--neutral-700)" />
                    </button>
                  ) : (
                    <span />
                  )}
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-800)' }}>
                    Categorie
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCategorySheet(false)}
                  style={{
                    border: 'none',
                    background: 'var(--neutral-100)',
                    borderRadius: 'var(--radius-full)',
                    width: 34,
                    height: 34,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  aria-label="Fermer"
                >
                  <ChevronDown size={18} color="var(--neutral-600)" />
                </button>
              </div>

              <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' as CSSProperties['WebkitOverflowScrolling'], paddingBottom: 10 }}>
                {categoryStage === 'parents' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => { setSelectedParentCategoryId(null); setSelectedCategoryId(null); setShowCategorySheet(false) }}
                      style={{
                        borderRadius: 'var(--radius-xl)',
                        border: '1px solid var(--neutral-200)',
                        background: '#fff',
                        padding: '10px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-xl)', background: 'var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span aria-hidden="true">✨</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-700)', textAlign: 'center' }}>Toutes</span>
                    </button>
                    {rootCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedParentCategoryId(cat.id)
                          setSelectedCategoryId(null)
                          setCategoryStage('children')
                        }}
                        style={{
                          borderRadius: 'var(--radius-xl)',
                          border: '1px solid var(--neutral-200)',
                          background: '#fff',
                          padding: '10px 8px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <CategoryIcon categoryName={cat.name} size={34} fallback={null} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-700)', textAlign: 'center' }} className="truncate">
                          {cat.name}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <CategoryIcon categoryName={selectedParent?.name} size={34} fallback={null} />
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--neutral-800)' }}>
                          {selectedParent?.name ?? 'Categorie'}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--neutral-400)' }}>
                          Choisis une sous-categorie
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => { setSelectedCategoryId(null); setShowCategorySheet(false) }}
                      style={{
                        border: '1px solid var(--neutral-200)',
                        borderRadius: 'var(--radius-xl)',
                        background: '#fff',
                        padding: '10px 12px',
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--neutral-800)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      Toutes les sous-categories
                      <ChevronRight size={18} color="var(--neutral-400)" />
                    </button>

                    {selectedChildren.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => { setSelectedCategoryId(sub.id); setShowCategorySheet(false) }}
                        style={{
                          border: '1px solid var(--neutral-200)',
                          borderRadius: 'var(--radius-xl)',
                          background: '#fff',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <CategoryIcon categoryName={selectedParent?.name ?? sub.name} size={30} fallback={null} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-800)' }} className="truncate">
                            {sub.name}
                          </span>
                        </span>
                        <ChevronRight size={18} color="var(--neutral-400)" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Sheet open={showAdvancedSheet} title="Filtres avances" onClose={() => setShowAdvancedSheet(false)}>
        <div style={{ display: 'grid', gap: 14 }}>
          <ToggleRow label="Recurrence" value={excludeRecurring} onChange={setExcludeRecurring} />
          <ToggleRow label="Fixe / variable" value={onlyFixed} onChange={setOnlyFixed} />
          <ToggleRow label="Compte principal / compte joint" value={onlyJoint} onChange={setOnlyJoint} />
        </div>
      </Sheet>

      <Sheet open={Boolean(detailsTxn)} title={detailsTxn ? displayTxnLabel(detailsTxn) : 'Details'} onClose={() => setDetailsTxn(null)}>
        {detailsTxn ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 900, color: 'var(--neutral-900)' }}>
                  {formatCurrency(signedAmount(detailsTxn))}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--neutral-500)', fontWeight: 600 }}>
                  {formatDateLabel(detailsTxn.transaction_date)}
                </p>
              </div>
              <CategoryIcon
                categoryName={
                  detailsTxn.category?.parent_id
                    ? categoryById.get(detailsTxn.category.parent_id)?.name ?? detailsTxn.category?.name
                    : detailsTxn.category?.name
                }
                size={34}
                fallback={null}
              />
            </div>

            <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-2xl)', padding: '12px 12px', display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--neutral-500)', fontWeight: 600 }}>Marchand</span>
                  <span style={{ fontSize: 12, color: 'var(--neutral-800)', fontWeight: 700 }}>{detailsTxn.merchant_name ?? '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--neutral-500)', fontWeight: 600 }}>Type</span>
                  <span style={{ fontSize: 12, color: 'var(--neutral-800)', fontWeight: 700 }}>{flowTypeLabel(detailsTxn.flow_type)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--neutral-500)', fontWeight: 600 }}>Fixe / variable</span>
                  <span style={{ fontSize: 12, color: 'var(--neutral-800)', fontWeight: 700 }}>{budgetBehaviorLabel(detailsTxn.budget_behavior)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--neutral-500)', fontWeight: 600 }}>Compte</span>
                  <span style={{ fontSize: 12, color: 'var(--neutral-800)', fontWeight: 700 }}>{detailsTxn.account?.name ?? '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--neutral-500)', fontWeight: 600 }}>Imputabilite</span>
                  <span style={{ fontSize: 12, color: 'var(--neutral-800)', fontWeight: 700 }}>{shareRatioLabel(detailsTxn.personal_share_ratio ?? null)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--neutral-500)', fontWeight: 600 }}>Recurrente</span>
                  <span style={{ fontSize: 12, color: 'var(--neutral-800)', fontWeight: 700 }}>{detailsTxn.is_recurring ? 'Oui' : 'Non'}</span>
                </div>
              </div>
            </div>

            <div style={{ border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-2xl)', padding: '12px 12px', display: 'grid', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>Categorie</p>
              {detailsTxn.category ? (
                (() => {
                  const leaf = detailsTxn.category
                  const parent = leaf.parent_id ? categoryById.get(leaf.parent_id) ?? null : null
                  const parentName = parent?.name ?? leaf.name
                  const subName = parent ? leaf.name : null
                  return (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <CategoryIcon categoryName={parentName} size={26} fallback={null} />
                          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--neutral-900)' }} className="truncate">{parentName}</span>
                        </span>
                      </div>
                      {subName ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <CategoryIcon categoryName={parentName} size={26} fallback={null} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-700)' }} className="truncate">{subName}</span>
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )
                })()
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-500)' }}>—</p>
              )}
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  )
}
