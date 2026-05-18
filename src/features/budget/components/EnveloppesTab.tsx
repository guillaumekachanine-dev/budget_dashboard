import { useState, useMemo, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { TransactionDetailsModal } from '@/components/modals/TransactionDetailsModal'
import { formatCurrencyFloored, getTxLabel, categoryColorFromName, todayIso } from '@/lib/utils'
import { useBudgetPagePayload } from '@/features/budget/hooks/useBudgetPagePayload'
import type { Category, Transaction } from '@/lib/types'
import type { BudgetPageParentCategoryRow, BudgetPageBucketRow } from '../types'
import budgetsPeriodIcon from '@/assets/icons/app/budgets_period.webp'

// ─── local helpers ────────────────────────────────────────────────────────────

const MONTHS_FR_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const MONTHS_FR_SHORT = ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']

function getPeriodRange(year: number, month: number): { startDate: string; endDate: string } {
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const now = new Date()
  const today = todayIso()
  const startDate = `${year}-${pad2(month)}-01`
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  if (isCurrentMonth) return { startDate, endDate: today }
  const monthEndDate = new Date(year, month, 0)
  return { startDate, endDate: `${monthEndDate.getFullYear()}-${pad2(monthEndDate.getMonth() + 1)}-${pad2(monthEndDate.getDate())}` }
}

interface PieDatum {
  id: string
  name: string
  value: number
  color: string
}


function formatPercentSigned(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function formatTxDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
}

function extractPiePayload(slice: unknown): PieDatum | null {
  const s = slice as Record<string, unknown> | null
  if (!s) return null
  const payload = (s.payload ?? s) as Record<string, unknown>
  if (!payload.id && !payload.name) return null
  return payload as unknown as PieDatum
}

const CATEGORY_DISPLAY_ORDER = [
  'logement', 'alimentation', 'achats divers', 'sorties', 'voyages',
  'transport', 'famille enfant', 'business', 'abonnements', 'sante',
  'taxes frais', 'epargne',
] as const

function normalizeCategoryLabel(value?: string | null): string {
  if (!value) return ''
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const BUCKET_LABELS: Record<string, string> = {
  socle_fixe: 'Fixe',
  variable_essentielle: 'Variable',
  discretionnaire: 'Discrétionnaire',
  provision: 'Provisions',
  epargne: 'Épargne',
}

const BLOCK_COLORS: Record<string, string> = {
  socle_fixe: '#5B57F5',
  variable_essentielle: '#2ED47A',
  epargne: '#FFAB2E',
  provision: '#6C63FF',
  discretionnaire: '#FC5A5A',
}

const PILOTAGE_BUCKETS = ['socle_fixe', 'variable_essentielle', 'discretionnaire', 'provision', 'epargne']

// ─── sub-components ───────────────────────────────────────────────────────────

interface MiniDonutProps {
  data: PieDatum[]
  total: number
  selectedId: string | null
  onSliceClick: (id: string, name: string, value: number, color: string) => void
  centerLabel?: string
}

function MiniDonut({ data, total, selectedId, onSliceClick, centerLabel }: MiniDonutProps) {
  return (
    <div style={{ position: 'relative', height: 190 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={56}
            outerRadius={86}
            startAngle={90}
            endAngle={-270}
            paddingAngle={2}
            stroke="var(--neutral-0)"
            strokeWidth={1}
            onClick={(slice: unknown) => {
              const payload = extractPiePayload(slice)
              if (!payload?.id) return
              onSliceClick(String(payload.id), String(payload.name ?? ''), Number(payload.value ?? 0), String(payload.color ?? 'var(--primary-500)'))
            }}
            labelLine={false}
            label={(props: unknown) => {
              const p = (props ?? {}) as { cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; payload?: PieDatum; value?: number }
              if (!p.payload || total <= 0) return null
              const pct = ((p.value ?? 0) / total) * 100
              if (pct < 9) return null
              const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0 } = p
              const radius = innerRadius + (outerRadius - innerRadius) * 0.56
              const radian = Math.PI / 180
              const x = cx + radius * Math.cos(-midAngle * radian)
              const y = cy + radius * Math.sin(-midAngle * radian)
              return (
                <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="var(--neutral-0)" fontSize={11} fontWeight={700}>
                  {`${pct.toFixed(0)}%`}
                </text>
              )
            }}
          >
            {data.map((entry) => {
              const isActive = entry.id === selectedId
              return (
                <Cell
                  key={entry.id}
                  fill={entry.color}
                  fillOpacity={isActive || !selectedId ? 1 : 0.35}
                  stroke={isActive ? 'var(--neutral-800)' : 'var(--neutral-0)'}
                  strokeWidth={isActive ? 2 : 1}
                  style={isActive ? { filter: 'brightness(1.08) drop-shadow(0 0 6px rgba(0,0,0,0.18))' } : undefined}
                />
              )
            })}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          width: 104,
        }}
      >
        <span
          style={{
            display: 'block',
            fontSize: 'clamp(13px, 3.6vw, 18px)',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            color: 'var(--neutral-900)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          {formatCurrencyFloored(total)}
        </span>
        {centerLabel && (
          <span style={{ display: 'block', fontSize: 9, fontWeight: 600, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4, lineHeight: 1 }}>
            {centerLabel}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── modal ────────────────────────────────────────────────────────────────────

interface SubModalProps {
  open: boolean
  onClose: () => void
  name: string
  iconKey: string | null
  color: string
  amount: number
  budgetAmount: number
  transactions: Transaction[]
  loading: boolean
  onSelectTransaction: (tx: Transaction) => void
  categoryById: Map<string, Category>
}

function SubModal({ open, onClose, name, iconKey, color, amount, budgetAmount, transactions, loading, onSelectTransaction, categoryById }: SubModalProps) {
  const remaining = budgetAmount - amount
  const remainingLabel = budgetAmount > 0
    ? (remaining >= 0 ? `Restant ${formatCurrencyFloored(remaining)}` : `Dépassé ${formatCurrencyFloored(Math.abs(remaining))}`)
    : null
  const isOverBudget = remaining < 0

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 240, background: 'rgba(13,13,31,0.56)' }}
          />
          <div style={{ position: 'fixed', inset: 0, zIndex: 241, display: 'grid', placeItems: 'center', padding: 'var(--space-4)', pointerEvents: 'none' }}>
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', damping: 30, stiffness: 330 }}
              style={{ width: 'min(560px, 100%)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', maxHeight: 'min(82dvh, calc(100dvh - var(--space-8)))', overflow: 'hidden', boxShadow: 'var(--shadow-lg)', pointerEvents: 'auto' }}
            >
              {/* Header */}
              <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', background: color }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                  {iconKey && (
                    <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CategoryIcon iconKey={iconKey} label={name} size={22} />
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--neutral-0)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.82)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                        Consommé {formatCurrencyFloored(amount)}
                      </span>
                      {remainingLabel && (
                        <>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>·</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: isOverBudget ? 'rgba(252,90,90,0.95)' : 'rgba(46,212,122,0.95)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                            {remainingLabel}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ border: 'none', background: 'rgba(255,255,255,0.22)', borderRadius: 'var(--radius-full)', width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--neutral-0)', flexShrink: 0 }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Transaction list */}
              <div style={{ maxHeight: 'calc(min(82dvh, 100dvh - var(--space-8)) - 68px)', overflowY: 'auto' }}>
                {loading ? (
                  <p style={{ margin: 0, padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)' }}>Chargement…</p>
                ) : transactions.length === 0 ? (
                  <p style={{ margin: 0, padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)' }}>Aucune opération</p>
                ) : (
                  transactions.map((tx) => {
                    const subCat = tx.category_id ? categoryById.get(tx.category_id) : undefined
                    return (
                      <button
                        key={tx.id}
                        type="button"
                        onClick={() => onSelectTransaction(tx)}
                        style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--neutral-100)', padding: '8px var(--space-4)', display: 'grid', gridTemplateColumns: '36px 22px minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-2)', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--neutral-50)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        <span style={{ fontSize: 11, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}>{formatTxDate(tx.transaction_date)}</span>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {subCat?.icon_key ? (
                            <CategoryIcon iconKey={subCat.icon_key} label={subCat.name} size={18} />
                          ) : (
                            <div style={{ width: 16, height: 16, borderRadius: 'var(--radius-full)', background: 'var(--neutral-200)' }} />
                          )}
                        </div>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500, color: 'var(--neutral-800)' }}>{getTxLabel(tx)}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>-{formatCurrencyFloored(Math.abs(Number(tx.amount)))}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

// ─── details section ──────────────────────────────────────────────────────────

interface CategoryDetailsSectionProps {
  rows: BudgetPageParentCategoryRow[]
  categoryById: Map<string, Category>
  onCategoryClick?: (categoryId: string) => void
}

function CategoryDetailsSection({ rows, categoryById, onCategoryClick }: CategoryDetailsSectionProps) {
  const orderMap = new Map<string, number>(CATEGORY_DISPLAY_ORDER.map((key, i) => [key, i]))

  const sorted = useMemo(() => {
    return [...rows]
      .filter((row) => Number(row.budget_amount) > 0 || Number(row.actual_amount) > 0)
      .sort((a, b) => {
        const ra = orderMap.get(normalizeCategoryLabel(a.parent_category_name)) ?? 999
        const rb = orderMap.get(normalizeCategoryLabel(b.parent_category_name)) ?? 999
        if (ra !== rb) return ra - rb
        return a.parent_category_name.localeCompare(b.parent_category_name, 'fr')
      })
  }, [rows]) // eslint-disable-line react-hooks/exhaustive-deps

  if (sorted.length === 0) return null

  return (
    <section style={{ padding: 'var(--space-8) var(--page-gutter) var(--space-8)' }}>
      <h3 style={{ margin: '0 0 var(--space-5) 0', fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--neutral-900)', letterSpacing: '-0.01em' }}>
        Détails par catégorie
      </h3>
      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        {sorted.map((row) => {
          const budgetAmount = Number(row.budget_amount)
          const actualAmount = Number(row.actual_amount)
          const variance = budgetAmount - actualAmount
          const isOverBudget = variance < 0
          const progressPct = budgetAmount > 0 ? Math.min(100, Math.round((actualAmount / budgetAmount) * 100)) : 0
          const actualPct = budgetAmount > 0 ? Math.round((actualAmount / budgetAmount) * 100) : 0
          const cat = categoryById.get(row.parent_category_id)
          const normalizedName = normalizeCategoryLabel(row.parent_category_name)
          const iconKey = normalizedName === 'epargne' ? 'epargne' : (cat?.icon_key ?? null)
          const isSavings = normalizedName === 'epargne'
          const rightLabel = isSavings
            ? (variance !== 0 ? `Reste ${formatCurrencyFloored(variance)}` : '—')
            : (isOverBudget ? `Dépass. ${formatCurrencyFloored(Math.abs(variance))}` : `Reste ${formatCurrencyFloored(variance)}`)
          const rightColor = isSavings
            ? 'color-mix(in oklab, var(--color-warning) 72%, var(--neutral-900) 28%)'
            : (isOverBudget ? 'var(--color-error)' : 'var(--color-success)')

          return (
            <button
              key={row.parent_category_id}
              type="button"
              onClick={onCategoryClick ? () => onCategoryClick(row.parent_category_id) : undefined}
              style={{
                display: 'grid',
                gridTemplateColumns: '44px 1fr',
                gap: 'var(--space-4)',
                alignItems: 'start',
                width: '100%',
                border: 'none',
                background: 'transparent',
                padding: 0,
                textAlign: 'left',
                cursor: onCategoryClick ? 'pointer' : 'default',
                transition: 'opacity var(--transition-fast)',
              }}
              onMouseEnter={onCategoryClick ? (e) => { e.currentTarget.style.opacity = '0.7' } : undefined}
              onMouseLeave={onCategoryClick ? (e) => { e.currentTarget.style.opacity = '1' } : undefined}
            >
              {/* Icon */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 2 }}>
                <CategoryIcon iconKey={iconKey} label={row.parent_category_name} size={44} />
              </div>

              {/* Content */}
              <div style={{ display: 'grid', gap: 'var(--space-1)', minWidth: 0 }}>
                {/* Row 1: name + consumed% | restant/dépassé */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--space-3)', alignItems: 'baseline' }}>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.parent_category_name}
                    <span style={{ fontWeight: 500, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
                      {' '}- {formatCurrencyFloored(actualAmount).replace(/\s+€/, '€')} ({actualPct}%)
                    </span>
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: rightColor, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {rightLabel}
                  </p>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                  <div style={{ width: `${progressPct}%`, height: '100%', borderRadius: 'var(--radius-pill)', background: isOverBudget ? 'var(--color-error)' : 'var(--primary-500)', transition: 'width var(--transition-base)' }} />
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

interface SelectedEntry {
  id: string
  name: string
  realAmount: number
  budgetAmount: number
  color: string
}

interface ModalTarget {
  id: string
  name: string
  iconKey: string | null
  amount: number
  budgetAmount: number
  color: string
}

export interface EnveloppesTabProps {
  onCategoryClick?: (categoryId: string) => void
}

type ViewMode = 'categories' | 'socles'

export function EnveloppesTab({ onCategoryClick }: EnveloppesTabProps) {
  const { data: categories = [] } = useCategories()
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const todayNow = new Date()
  const [year, setYear] = useState(todayNow.getFullYear())
  const [month, setMonth] = useState(todayNow.getMonth() + 1)
  const [showMonthModal, setShowMonthModal] = useState(false)
  const [modalPickerYear, setModalPickerYear] = useState(todayNow.getFullYear())

  const { data: budgetPayload } = useBudgetPagePayload({ periodYear: year, periodMonth: month })
  const payloadByParentCategory = useMemo<BudgetPageParentCategoryRow[]>(
    () => (Array.isArray(budgetPayload?.by_parent_category) ? budgetPayload.by_parent_category : []),
    [budgetPayload],
  )
  const payloadByBucket = useMemo(() => {
    const rows = Array.isArray(budgetPayload?.by_bucket) ? budgetPayload.by_bucket : []
    return rows.reduce<Record<string, BudgetPageBucketRow>>((acc, row) => {
      const key = String(row?.budget_bucket ?? '')
      if (key) acc[key] = row
      return acc
    }, {})
  }, [budgetPayload])
  const { startDate, endDate } = useMemo(() => getPeriodRange(year, month), [year, month])

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  function isMonthDisabled(y: number, m: number) {
    return y === currentYear && m > currentMonth
  }

  const [viewMode, setViewMode] = useState<ViewMode>('categories')
  const [selectedEntry, setSelectedEntry] = useState<SelectedEntry | null>(null)
  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [subCategoryTransactionSequence, setSubCategoryTransactionSequence] = useState<Transaction[]>([])
  const [pendingTransaction, setPendingTransaction] = useState<Transaction | null>(null)
  const [modalToReopen, setModalToReopen] = useState<ModalTarget | null>(null)

  // Reset selection when switching view mode
  useEffect(() => { setSelectedEntry(null) }, [viewMode])

  // Pending transaction → open detail modal (after sub-modal closes)
  useEffect(() => {
    if (!pendingTransaction || modalTarget) return
    const id = window.setTimeout(() => {
      setSelectedTransaction(pendingTransaction)
      setPendingTransaction(null)
    }, 280)
    return () => window.clearTimeout(id)
  }, [pendingTransaction, modalTarget])

  // ── pie data ──────────────────────────────────────────────────────────────

  const catRealPieData = useMemo<PieDatum[]>(
    () =>
      payloadByParentCategory
        .map((row) => ({ id: row.parent_category_id, name: row.parent_category_name, value: Number(row.actual_amount ?? 0), color: categoryColorFromName(row.parent_category_name) }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [payloadByParentCategory],
  )

  const catBudgetPieData = useMemo<PieDatum[]>(
    () =>
      payloadByParentCategory
        .map((row) => ({ id: row.parent_category_id, name: row.parent_category_name, value: Number(row.budget_amount ?? 0), color: categoryColorFromName(row.parent_category_name) }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [payloadByParentCategory],
  )

  const bucketRealPieData = useMemo<PieDatum[]>(
    () =>
      PILOTAGE_BUCKETS
        .flatMap((bucket) => {
          const row = payloadByBucket[bucket]
          if (!row || Number(row.actual_amount) <= 0) return []
          return [{ id: bucket, name: BUCKET_LABELS[bucket] ?? bucket, value: Number(row.actual_amount), color: BLOCK_COLORS[bucket] ?? 'var(--neutral-400)' }]
        })
        .sort((a, b) => b.value - a.value),
    [payloadByBucket],
  )

  const bucketBudgetPieData = useMemo<PieDatum[]>(
    () =>
      PILOTAGE_BUCKETS
        .flatMap((bucket) => {
          const row = payloadByBucket[bucket]
          if (!row || Number(row.budget_amount) <= 0) return []
          return [{ id: bucket, name: BUCKET_LABELS[bucket] ?? bucket, value: Number(row.budget_amount), color: BLOCK_COLORS[bucket] ?? 'var(--neutral-400)' }]
        })
        .sort((a, b) => b.value - a.value),
    [payloadByBucket],
  )

  const realPieData = viewMode === 'categories' ? catRealPieData : bucketRealPieData
  const budgetPieData = viewMode === 'categories' ? catBudgetPieData : bucketBudgetPieData

  const realTotal = useMemo(() => realPieData.reduce((s, d) => s + d.value, 0), [realPieData])
  const budgetTotal = useMemo(() => budgetPieData.reduce((s, d) => s + d.value, 0), [budgetPieData])

  const top5 = useMemo(() => realPieData.slice(0, 5), [realPieData])

  // ── transactions for modal ────────────────────────────────────────────────

  const modalCategoryIds = useMemo(() => {
    if (!modalTarget || viewMode !== 'categories') return undefined
    const ids = [modalTarget.id]
    categories.forEach((c) => { if (c.parent_id === modalTarget.id) ids.push(c.id) })
    return ids
  }, [modalTarget, categories, viewMode])

  const { data: modalTransactions = [], isLoading: loadingModalTx } = useTransactions(
    { startDate, endDate, flowType: 'expense', categoryIds: modalCategoryIds, debugSource: 'EnveloppesTab:modal' },
    { enabled: Boolean(modalTarget) && viewMode === 'categories' },
  )

  // ── handlers ──────────────────────────────────────────────────────────────

  function selectEntry(id: string, name: string, realAmount: number, budgetAmount: number, color: string) {
    setSelectedEntry({ id, name, realAmount, budgetAmount, color })
  }

  function handleDonutClick(id: string, name: string, realAmount: number, budgetAmount: number, color: string) {
    selectEntry(id, name, realAmount, budgetAmount, color)
    if (viewMode === 'categories') {
      setModalTarget({
        id,
        name,
        iconKey: categoryById.get(id)?.icon_key ?? null,
        amount: realAmount,
        budgetAmount,
        color,
      })
    }
  }

  function handleListRowClick(entry: PieDatum) {
    const budgetEntry = budgetPieData.find((d) => d.id === entry.id)
    selectEntry(entry.id, entry.name, entry.value, budgetEntry?.value ?? 0, entry.color)
  }

  function handleSelectTransaction(tx: Transaction) {
    setSubCategoryTransactionSequence(modalTransactions)
    if (modalTarget) {
      setModalToReopen(modalTarget)
      setModalTarget(null)
    }
    setPendingTransaction(tx)
  }

  function handleCloseTransaction() {
    setSelectedTransaction(null)
    setModalToReopen(null)
    setSubCategoryTransactionSequence([])
    setPendingTransaction(null)
  }

  function handleBackToList() {
    setSelectedTransaction(null)
    if (modalToReopen) {
      const next = modalToReopen
      setModalToReopen(null)
      window.setTimeout(() => setModalTarget(next), 120)
    }
  }

  // ── delta ─────────────────────────────────────────────────────────────────

  const deltaPct =
    selectedEntry && selectedEntry.budgetAmount > 0
      ? ((selectedEntry.realAmount - selectedEntry.budgetAmount) / selectedEntry.budgetAmount) * 100
      : null

  // ── toggle button style helper ────────────────────────────────────────────

  function toggleBtnStyle(active: boolean): React.CSSProperties {
    return {
      border: active ? '2px solid var(--neutral-900)' : '1px solid var(--neutral-200)',
      background: active ? 'var(--primary-50)' : 'var(--neutral-0)',
      color: active ? 'var(--primary-700)' : 'var(--neutral-600)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-2) var(--space-4)',
      fontSize: 'var(--font-size-sm)',
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all var(--transition-base)',
      minHeight: 36,
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  const monthLabel = `${MONTHS_FR_FULL[month - 1]} ${String(year).slice(2)}`

  return (
    <div>
      {/* ── month selector button ── */}
      <div style={{ padding: '0 var(--page-gutter)', marginBottom: 'var(--space-3)' }}>
        <button
          type="button"
          onClick={() => { setModalPickerYear(year); setShowMonthModal(true) }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: 'none',
            background: 'transparent',
            padding: '2px 0',
            cursor: 'pointer',
          }}
        >
          <img src={budgetsPeriodIcon} alt="" width={20} height={20} style={{ objectFit: 'contain', flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-700)', lineHeight: 1 }}>
            {monthLabel}
          </span>
          <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid var(--neutral-400)', marginLeft: 2, flexShrink: 0 }} />
        </button>
      </div>

      {/* ── month picker modal ── */}
      <AnimatePresence>
        {showMonthModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMonthModal(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Sélectionner un mois"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: 'var(--page-gutter)',
                right: 'var(--page-gutter)',
                top: '25vh',
                zIndex: 61,
                maxWidth: 320,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-2xl)',
                padding: 'var(--space-4)',
                boxShadow: '0 8px 40px rgba(13,13,31,0.18)',
              }}
            >
              {/* year row */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                {[2025, 2026].map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setModalPickerYear(y)}
                    style={{
                      flex: 1,
                      padding: '8px var(--space-3)',
                      border: modalPickerYear === y ? '2px solid var(--primary-600)' : '1px solid var(--neutral-200)',
                      borderRadius: 'var(--radius-md)',
                      background: modalPickerYear === y ? 'color-mix(in oklab, var(--primary-600) 10%, var(--neutral-0) 90%)' : 'var(--neutral-50)',
                      color: modalPickerYear === y ? 'var(--primary-600)' : 'var(--neutral-700)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all var(--transition-base)',
                    }}
                  >
                    {y}
                  </button>
                ))}
              </div>

              {/* month grid: 4 × 3 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {MONTHS_FR_SHORT.map((label, idx) => {
                  const m = idx + 1
                  const disabled = isMonthDisabled(modalPickerYear, m)
                  const isSelected = modalPickerYear === year && m === month
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setYear(modalPickerYear)
                        setMonth(m)
                        setShowMonthModal(false)
                        setSelectedEntry(null)
                      }}
                      style={{
                        padding: '7px 4px',
                        border: isSelected ? '2px solid var(--primary-600)' : '1px solid var(--neutral-200)',
                        borderRadius: 'var(--radius-sm)',
                        background: isSelected ? 'color-mix(in oklab, var(--primary-600) 12%, var(--neutral-0) 88%)' : 'var(--neutral-50)',
                        color: disabled ? 'var(--neutral-300)' : isSelected ? 'var(--primary-600)' : 'var(--neutral-800)',
                        fontSize: 11,
                        fontWeight: isSelected ? 700 : 500,
                        cursor: disabled ? 'default' : 'pointer',
                        transition: 'all var(--transition-base)',
                        pointerEvents: disabled ? 'none' : 'auto',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── title + toggle ── */}
      <div style={{ padding: '0 var(--page-gutter)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--neutral-900)', letterSpacing: '-0.01em' }}>
          Enveloppes budgétaires
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', background: 'var(--neutral-100)', borderRadius: 'var(--radius-md)', padding: '3px', width: 224 }}>
          <button type="button" onClick={() => setViewMode('categories')} style={{ ...toggleBtnStyle(viewMode === 'categories'), textAlign: 'center' }}>
            Catégories
          </button>
          <button type="button" onClick={() => setViewMode('socles')} style={{ ...toggleBtnStyle(viewMode === 'socles'), textAlign: 'center' }}>
            Socles
          </button>
        </div>
      </div>

      {/* ── dual donut ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        {/* LEFT: Réel */}
        <div>
          <p style={{ margin: '0 0 var(--space-1)', textAlign: 'center', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Réel
          </p>
          <MiniDonut
            data={realPieData}
            total={realTotal}
            selectedId={selectedEntry?.id ?? null}
            centerLabel="consommé"
            onSliceClick={(id, name, value, color) => {
              const budgetEntry = budgetPieData.find((d) => d.id === id)
              handleDonutClick(id, name, value, budgetEntry?.value ?? 0, color)
            }}
          />
        </div>

        {/* RIGHT: Budget */}
        <div>
          <p style={{ margin: '0 0 var(--space-1)', textAlign: 'center', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Budget
          </p>
          <MiniDonut
            data={budgetPieData}
            total={budgetTotal}
            selectedId={selectedEntry?.id ?? null}
            centerLabel="budgétisés"
            onSliceClick={(id, name, value, color) => {
              const realEntry = realPieData.find((d) => d.id === id)
              handleDonutClick(id, name, realEntry?.value ?? 0, value, color)
            }}
          />
        </div>
      </div>

      {/* ── info + delta ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: 'var(--space-2) var(--page-gutter) var(--space-3)',
          minHeight: 52,
          gap: 4,
        }}
      >
        {/* Réel info */}
        <div style={{ textAlign: 'center' }}>
          {selectedEntry ? (
            <>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--neutral-800)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedEntry.name}
              </p>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)', lineHeight: 1.4 }}>
                {formatCurrencyFloored(selectedEntry.realAmount)}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-300)', fontStyle: 'italic' }}>
              Clique une ligne de liste
            </p>
          )}
        </div>

        {/* Delta */}
        <div style={{ textAlign: 'center', minWidth: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {selectedEntry && deltaPct !== null ? (
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: deltaPct > 0 ? 'var(--color-error)' : 'var(--color-success)',
                background: deltaPct > 0 ? 'color-mix(in oklab, var(--color-error) 12%, transparent)' : 'color-mix(in oklab, var(--color-success) 12%, transparent)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 6px',
                whiteSpace: 'nowrap',
              }}
            >
              {formatPercentSigned(deltaPct)}
            </span>
          ) : null}
        </div>

        {/* Budget info */}
        <div style={{ textAlign: 'center' }}>
          {selectedEntry ? (
            <>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--neutral-800)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedEntry.name}
              </p>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)', lineHeight: 1.4 }}>
                {formatCurrencyFloored(selectedEntry.budgetAmount)}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-300)', fontStyle: 'italic' }}>
              Clique une ligne de liste
            </p>
          )}
        </div>
      </div>

      {/* ── category lists ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid var(--neutral-100)' }}>
        {/* Left: Réel list */}
        <div style={{ borderRight: '1px solid var(--neutral-100)' }}>
          {top5.map((entry) => {
            const pct = realTotal > 0 ? Math.round((entry.value / realTotal) * 100) : 0
            const isActive = selectedEntry?.id === entry.id
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => handleListRowClick(entry)}
                style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: '18px minmax(0,1fr) auto',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-3)',
                  border: 'none',
                  borderBottom: '1px solid var(--neutral-100)',
                  background: isActive ? 'color-mix(in oklab, var(--primary-50) 80%, transparent)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background var(--transition-fast)',
                }}
              >
                <div style={{ width: 14, height: 14, borderRadius: 'var(--radius-full)', background: entry.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: isActive ? 800 : 600, color: isActive ? 'var(--neutral-900)' : 'var(--neutral-700)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.name}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: isActive ? 'var(--neutral-900)' : 'var(--neutral-500)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {pct}%
                </span>
              </button>
            )
          })}
        </div>

        {/* Right: Budget list */}
        <div>
          {top5.map((entry) => {
            const budgetEntry = budgetPieData.find((d) => d.id === entry.id)
            const pct = budgetTotal > 0 && budgetEntry ? Math.round((budgetEntry.value / budgetTotal) * 100) : 0
            const isActive = selectedEntry?.id === entry.id
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => handleListRowClick(entry)}
                style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: '18px minmax(0,1fr) auto',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-3)',
                  border: 'none',
                  borderBottom: '1px solid var(--neutral-100)',
                  background: isActive ? 'color-mix(in oklab, var(--primary-50) 80%, transparent)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background var(--transition-fast)',
                }}
              >
                <div style={{ width: 14, height: 14, borderRadius: 'var(--radius-full)', background: entry.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: isActive ? 800 : 600, color: isActive ? 'var(--neutral-900)' : 'var(--neutral-700)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.name}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: isActive ? 'var(--neutral-900)' : 'var(--neutral-500)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {pct}%
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── details section ── */}
      <CategoryDetailsSection
        rows={payloadByParentCategory}
        categoryById={categoryById}
        onCategoryClick={onCategoryClick}
      />

      {/* ── modals ── */}
      <SubModal
        open={Boolean(modalTarget)}
        onClose={() => setModalTarget(null)}
        name={modalTarget?.name ?? ''}
        iconKey={modalTarget?.iconKey ?? null}
        color={modalTarget?.color ?? 'var(--primary-500)'}
        amount={modalTarget?.amount ?? 0}
        budgetAmount={modalTarget?.budgetAmount ?? 0}
        transactions={modalTransactions}
        loading={loadingModalTx}
        onSelectTransaction={handleSelectTransaction}
        categoryById={categoryById}
      />

      <TransactionDetailsModal
        transaction={selectedTransaction}
        categories={categories}
        transactionList={subCategoryTransactionSequence}
        onNavigate={setSelectedTransaction}
        onBack={handleBackToList}
        onClose={handleCloseTransaction}
      />
    </div>
  )
}
