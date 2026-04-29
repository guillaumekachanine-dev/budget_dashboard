import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, SlidersHorizontal, ArrowLeft, Search } from 'lucide-react'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { formatCurrency } from '@/lib/utils'
import { Button, Input } from '@/components'
import { PageHeader } from '@/components/layout/PageHeader'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { TransactionDetailsModal } from '@/components/modals/TransactionDetailsModal'
import type { FlowType, Transaction } from '@/lib/types'

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

const VIZ_TOKENS = ['var(--viz-a)', 'var(--viz-b)', 'var(--viz-c)', 'var(--viz-d)', 'var(--viz-e)'] as const

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
        start.setDate(now.getDate() - 5)
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
        start.setDate(now.getDate() - 29)
        return { startDate: startOfIsoDay(start), endDate: todayIso() }
      }
      return { startDate: startOfIsoMonth(now), endDate: todayIso() }
    }
    case 'quarter': {
      if (mode === 'rolling') {
        const start = new Date(now)
        start.setDate(now.getDate() - 89)
        return { startDate: startOfIsoDay(start), endDate: todayIso() }
      }
      return { startDate: startOfIsoQuarter(now), endDate: todayIso() }
    }
    case 'year': {
      if (mode === 'rolling') {
        const start = new Date(now)
        start.setDate(now.getDate() - 364)
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

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function accentFromCategory(name: string): string {
  const key = name.trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash << 5) - hash + key.charCodeAt(i)
  return VIZ_TOKENS[Math.abs(hash) % VIZ_TOKENS.length]
}

function formatMoneyInteger(amount: number): string {
  if (!Number.isFinite(amount)) return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(0)

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.floor(amount))
}

function resultNoun(flow: FlowFilter): string {
  if (flow === 'expense') return 'dépenses'
  if (flow === 'income') return 'revenus'
  if (flow === 'transfer') return 'transferts internes'
  return 'opérations'
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
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,13,31,0.45)' }}
          />
          <motion.div
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
              background: 'var(--neutral-0)',
              borderRadius: '20px 20px 0 0',
              padding: '12px var(--space-6) calc(var(--space-6) + env(safe-area-inset-bottom, 0px))',
              maxHeight: 'calc(100dvh - 12px)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, margin: '4px auto 12px', background: 'var(--neutral-200)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-900)' }}>{title}</p>
              <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-[34px] w-[34px] rounded-full bg-[var(--neutral-100)] px-0">
                <ChevronDown size={16} />
              </Button>
            </div>
            <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' as CSSProperties['WebkitOverflowScrolling'] }}>{children}</div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
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
    <div style={{ display: 'inline-flex', gap: 2, border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-full)', padding: 2 }}>
      <button
        type="button"
        onClick={() => onChange('left')}
        style={{
          border: 'none',
          borderRadius: 'var(--radius-full)',
          background: value === 'left' ? 'var(--neutral-100)' : 'transparent',
          color: value === 'left' ? 'var(--neutral-900)' : 'var(--neutral-500)',
          fontSize: 11,
          fontWeight: 800,
          padding: '6px 10px',
          cursor: 'pointer',
        }}
      >
        {left}
      </button>
      <button
        type="button"
        onClick={() => onChange('right')}
        style={{
          border: 'none',
          borderRadius: 'var(--radius-full)',
          background: value === 'right' ? 'var(--neutral-100)' : 'transparent',
          color: value === 'right' ? 'var(--neutral-900)' : 'var(--neutral-500)',
          fontSize: 11,
          fontWeight: 800,
          padding: '6px 10px',
          cursor: 'pointer',
        }}
      >
        {right}
      </button>
    </div>
  )
}

function Switch({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 42,
        height: 24,
        borderRadius: 'var(--radius-full)',
        border: value ? '1px solid var(--primary-500)' : '1px solid var(--neutral-200)',
        background: value ? 'var(--primary-500)' : 'var(--neutral-200)',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: value ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left var(--transition-base)',
        }}
      />
    </button>
  )
}

export function Flux() {
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

  const rootCategories = useMemo(() => (flowCategories ?? []).filter((c) => c.parent_id === null), [flowCategories])
  const subCategories = useMemo(() => (flowCategories ?? []).filter((c) => c.parent_id !== null), [flowCategories])
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
    setSelectedParentCategoryId(null)
    setSelectedCategoryId(null)
    setCategoryStage('parents')
  }, [categoryFlowType])

  const anySheetOpen = showTypeSheet || showPeriodSheet || showCategorySheet || showAdvancedSheet

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!anySheetOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [anySheetOpen])

  const periodDateLabel = useMemo(() => {
    const endIso = range.endDate ?? todayIso()
    const inferredStart = filtered.length ? filtered[filtered.length - 1].transaction_date : endIso
    const startIso = range.startDate ?? inferredStart
    const start = formatDateLabel(startIso)
    const end = formatDateLabel(endIso)
    return `Du ${start} au ${end}`
  }, [filtered, range.endDate, range.startDate])

  const periodSummaryLabel = useMemo(() => {
    return `${periodDateLabel} - ${filtered.length} ${resultNoun(flow)}`
  }, [filtered.length, flow, periodDateLabel])

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 0px))' }}>
      <PageHeader title="Flux" />

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ padding: '0 var(--space-6)' }}
      >
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'grid', gap: 'var(--space-3)' }}>
          <p
            style={{
              margin: 0,
              textAlign: 'center',
              fontSize: 'var(--font-size-kpi)',
              fontWeight: 'var(--font-weight-extrabold)',
              lineHeight: 'var(--line-height-tight)',
              fontFamily: 'var(--font-mono)',
              color: totalAmount > 0 ? 'var(--color-success)' : totalAmount < 0 ? 'var(--color-error)' : 'var(--viz-c)',
            }}
          >
            {filtered.length ? formatMoneyInteger(totalAmount) : formatMoneyInteger(0)}
          </p>

          <div
            style={{
              background: 'var(--viz-c)',
              color: 'var(--neutral-0)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-5)',
              boxShadow: 'var(--shadow-lg)',
              display: 'grid',
              justifyItems: 'center',
              textAlign: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, opacity: 0.96 }}>
              {periodDateLabel}
            </p>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, opacity: 0.92 }}>
              {filtered.length} opérations
            </p>
          </div>
        </div>
      </motion.section>

      <section style={{ padding: '0 var(--space-6)', display: 'grid', gap: 'var(--space-4)' }}>
        <Input
          type="search"
          placeholder="Recherche"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={14} />}
          size="md"
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 34px',
            gap: 'var(--space-2)',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => setShowTypeSheet(true)}
            style={{
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 2,
              minWidth: 0,
              padding: '2px 0',
              color: 'var(--neutral-700)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeLabel}</span>
            <ChevronDown size={14} />
          </button>

          <button
            type="button"
            onClick={() => setShowPeriodSheet(true)}
            style={{
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 2,
              minWidth: 0,
              padding: '2px 0',
              color: 'var(--neutral-700)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{periodLabel}</span>
            <ChevronDown size={14} />
          </button>

          <button
            type="button"
            onClick={() => setShowCategorySheet(true)}
            style={{
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 2,
              minWidth: 0,
              padding: '2px 0',
              color: 'var(--neutral-700)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{categoryLabel}</span>
            <ChevronDown size={14} />
          </button>

          <button
            type="button"
            onClick={() => setShowAdvancedSheet(true)}
            aria-label="Filtres avances"
            style={{
              border: 'none',
              background: 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 28,
              justifySelf: 'end',
              cursor: 'pointer',
              color: 'var(--neutral-700)',
            }}
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>
      </section>

      <section>
        <div style={{ padding: '0 var(--space-6)' }}>
          <div
            style={{
              borderBottom: '1px solid var(--neutral-200)',
              paddingBottom: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-600)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {periodSummaryLabel}
              </span>
            </div>
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: totalAmount > 0 ? 'var(--color-success)' : totalAmount < 0 ? 'var(--color-error)' : 'var(--neutral-700)',
                whiteSpace: 'nowrap',
              }}
            >
              {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div style={{ color: 'var(--neutral-400)', textAlign: 'center', padding: 'var(--space-12)' }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: 'var(--neutral-400)', textAlign: 'center', padding: 'var(--space-12)' }}>
            Aucune operation
          </motion.div>
        ) : (
          <div>
            {filtered.map((t) => {
              const label = displayTxnLabel(t)
              const category = displayTxnCategoryName(t)
              const amount = signedAmount(t)
              const accent = accentFromCategory(category)

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDetailsTxn(t)}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderBottom: '1px solid var(--neutral-200)',
                    background: 'transparent',
                    display: 'grid',
                    gridTemplateColumns: '42px 26px 1fr auto',
                    alignItems: 'center',
                    gap: 8,
                    padding: 'var(--space-3) var(--space-6)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--neutral-50)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-600)', whiteSpace: 'nowrap' }}>
                    {formatDateLabel(t.transaction_date)}
                  </span>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      background: accent,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--neutral-0)',
                      fontSize: 8,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {category.slice(0, 1)}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 400,
                      color: 'var(--neutral-700)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 400,
                      fontFamily: 'var(--font-mono)',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      color: amount > 0 ? 'var(--color-success)' : amount < 0 ? 'var(--color-error)' : 'var(--neutral-700)',
                    }}
                  >
                    {formatCurrency(amount)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <Sheet open={showTypeSheet} title="Type" onClose={() => setShowTypeSheet(false)}>
        <div style={{ display: 'grid', gap: 8 }}>
          {FLOW_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={flow === opt.value ? 'secondary' : 'outline'}
              size="md"
              onClick={() => {
                setFlow(opt.value)
                setShowTypeSheet(false)
              }}
              className="w-full justify-start"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </Sheet>

      <Sheet open={showPeriodSheet} title="Periode" onClose={() => setShowPeriodSheet(false)}>
        <div style={{ display: 'grid', gap: 8 }}>
          {PERIOD_OPTIONS.map((opt) => {
            const supportsMode = ['week', 'month', 'quarter', 'year'].includes(opt.value)
            return (
              <div
                key={opt.value}
                style={{
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 'var(--radius-xl)',
                  background: period === opt.value ? 'var(--primary-50)' : 'var(--neutral-0)',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setPeriod(opt.value)
                    setShowPeriodSheet(false)
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 800,
                    color: 'var(--neutral-900)',
                    padding: 0,
                  }}
                >
                  {opt.label}
                </button>
                {supportsMode ? (
                  <SegmentedToggle
                    left="En cours"
                    right="Glissant"
                    value={periodMode === 'current' ? 'left' : 'right'}
                    onChange={(next) => setPeriodMode(next === 'left' ? 'current' : 'rolling')}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      </Sheet>

      <AnimatePresence>
        {showCategorySheet ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCategorySheet(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
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
                background: 'var(--neutral-0)',
                borderRadius: '20px 20px 0 0',
                padding: '12px var(--space-6) calc(var(--space-6) + env(safe-area-inset-bottom, 0px))',
                maxHeight: 'calc(100dvh - 12px)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, margin: '4px auto 12px', background: 'var(--neutral-200)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {categoryStage === 'children' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCategoryStage('parents')
                        setSelectedCategoryId(null)
                      }}
                      className="h-[34px] w-[34px] rounded-full bg-[var(--neutral-100)] px-0"
                    >
                      <ArrowLeft size={16} />
                    </Button>
                  ) : null}
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--neutral-900)' }}>Categorie</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowCategorySheet(false)} className="h-[34px] w-[34px] rounded-full bg-[var(--neutral-100)] px-0">
                  <ChevronDown size={16} />
                </Button>
              </div>

              <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' as CSSProperties['WebkitOverflowScrolling'] }}>
                {categoryStage === 'parents' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedParentCategoryId(null)
                        setSelectedCategoryId(null)
                        setShowCategorySheet(false)
                      }}
                      style={{
                        border: '1px solid var(--neutral-200)',
                        background: 'var(--neutral-0)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '10px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--neutral-100)', display: 'grid', placeItems: 'center' }}>
                        <CategoryIcon categoryName="Toutes catégories" size={24} fallback="💰" />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-700)' }}>Toutes</span>
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
                          border: '1px solid var(--neutral-200)',
                          background: 'var(--neutral-0)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '10px 8px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <CategoryIcon categoryName={cat.name} size={30} fallback={null} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-700)', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategoryId(null)
                        setShowCategorySheet(false)
                      }}
                      style={{
                        border: '1px solid var(--neutral-200)',
                        background: 'var(--neutral-0)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '10px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--neutral-100)', display: 'grid', placeItems: 'center' }}>↺</div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-700)' }}>Toutes</span>
                    </button>
                    {selectedChildren.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategoryId(sub.id)
                          setShowCategorySheet(false)
                        }}
                        style={{
                          border: '1px solid var(--neutral-200)',
                          background: 'var(--neutral-0)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '10px 8px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <CategoryIcon categoryName={selectedParent?.name ?? sub.name} size={30} fallback={null} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-700)', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <Sheet open={showAdvancedSheet} title="Filtres avances" onClose={() => setShowAdvancedSheet(false)}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-700)' }}>Recurrence</span>
            <Switch value={excludeRecurring} onChange={setExcludeRecurring} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-700)' }}>Fixe / variable</span>
            <Switch value={onlyFixed} onChange={setOnlyFixed} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-700)' }}>Compte principal / joint</span>
            <Switch value={onlyJoint} onChange={setOnlyJoint} />
          </div>
        </div>
      </Sheet>

      <TransactionDetailsModal
        transaction={detailsTxn}
        categories={flowCategories ?? []}
        transactionList={filtered}
        onNavigate={setDetailsTxn}
        onClose={() => setDetailsTxn(null)}
      />
    </div>
  )
}
