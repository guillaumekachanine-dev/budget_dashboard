import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowUpRight, ArrowDownRight, Info, CheckCircle, AlertCircle } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  PieChart,
  Pie,
  ReferenceLine,
} from 'recharts'
import { useBudgetSummaries } from '@/hooks/useBudgets'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { getCurrentPeriod, formatCurrencyRounded } from '@/lib/utils'
import { debugBudgetSupabaseConnection } from '@/debug/debugBudgetSupabase'
import { supabase } from '@/lib/supabase'
import type { Category, Transaction } from '@/lib/types'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { TransactionDetailsModal } from '@/components/modals/TransactionDetailsModal'

type PeriodKey = 'mois' | 'annee'
type SubCatTrend = 'up' | 'down' | 'equal'

interface MonthlyBucket {
  month: string
  amount: number
  budget: number
  evolutionPct: number | null
  isCurrent: boolean
}

interface TopTransaction {
  label: string
  amount: number
  date: string
}

interface SubCatData {
  id: string
  name: string
  parentCategoryName?: string | null
  icon: string
  total: number
  topTx: TopTransaction | null
}

interface SubCategoryTrendItem {
  id: string
  name: string
  parentCategoryName: string | null
  currentMonthAmount: number
  previousMonthAmount: number
  threeMonthAvg: number
  trend: SubCatTrend
}

interface PieDatum {
  id: string
  name: string
  value: number
  color: string
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return formatCurrencyRounded(0)
  return formatCurrencyRounded(Math.floor(amount))
}

function formatTxDateDayMonth(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '--/--'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function txLabel(tx: Transaction): string {
  return (tx.normalized_label ?? tx.raw_label ?? 'Opération').trim() || 'Opération'
}

function getPeriodRange(key: PeriodKey): { startDate: string; endDate: string } {
  const now = new Date()
  if (key === 'annee') {
    return { startDate: `${now.getFullYear()}-01-01`, endDate: todayStr() }
  }
  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    endDate: todayStr(),
  }
}

function scaleBudget(monthlyBudget: number, key: PeriodKey): number {
  if (monthlyBudget === 0) return 0
  if (key === 'annee') return monthlyBudget * 12
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed = now.getDate()
  return (monthlyBudget / daysInMonth) * daysElapsed
}

function getPeriodLabel(key: PeriodKey): string {
  const now = new Date()
  if (key === 'annee') return `Année ${now.getFullYear()}`
  return now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

const MONTHS_FR_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const VIZ_TOKENS = ['var(--viz-a)', 'var(--viz-b)', 'var(--viz-c)', 'var(--viz-d)', 'var(--viz-e)'] as const

function accentFromLabel(label: string): string {
  const key = label.trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash << 5) - hash + key.charCodeAt(i)
  return VIZ_TOKENS[Math.abs(hash) % VIZ_TOKENS.length]
}

interface CatItem {
  id: string
  name: string
  icon_name: string | null
  color_token: string | null
}

const ALL_ITEM: CatItem = { id: 'all', name: 'Toutes', icon_name: null, color_token: null }

interface CategorySheetProps {
  open: boolean
  selectedId: string
  categories: Category[]
  onClose: () => void
  onSelect: (id: string) => void
}

function CategorySheet({ open, selectedId, categories, onClose, onSelect }: CategorySheetProps) {
  const items: CatItem[] = useMemo(
    () => [ALL_ITEM, ...categories.map((c) => ({ id: c.id, name: c.name, icon_name: c.icon_name, color_token: c.color_token }))],
    [categories],
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="cat-bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(13,13,31,0.52)', backdropFilter: 'blur(3px)' }}
          />
          <motion.div
            key="cat-sh"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 101,
              background: 'var(--neutral-50)',
              borderRadius: '28px 28px 0 0',
              padding: '0 20px 52px',
              maxWidth: 512,
              margin: '0 auto',
              maxHeight: '82dvh',
              overflowY: 'auto',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--neutral-300)', margin: '12px auto 0', flexShrink: 0 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0 22px', position: 'sticky', top: 0, background: 'var(--neutral-50)', zIndex: 1 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--neutral-800)' }}>Catégorie</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--neutral-400)' }}>Sélectionne une catégorie à analyser</p>
              </div>
              <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--neutral-100)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={15} color="var(--neutral-500)" />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px 6px' }}>
              {items.map((cat) => {
                const isSelected = cat.id === selectedId
                return (
                  <motion.button
                    key={cat.id}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => {
                      onSelect(cat.id)
                      onClose()
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 2px',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <div style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {cat.id === 'all' ? '✨' : <CategoryIcon categoryName={cat.name} size={30} fallback="💰" />}
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: isSelected ? 700 : 500,
                      textAlign: 'center',
                      lineHeight: 1.25,
                      maxWidth: 72,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: isSelected ? 'var(--primary-500)' : 'var(--neutral-600)',
                      fontFamily: 'var(--font-sans)',
                    }}>
                      {cat.name}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

interface AnalyseModalProps {
  open: boolean
  onClose: () => void
  categoryName: string
  monthlyAvg: number
  monthlyBudgetToDate: number
  monthlyHistory: MonthlyBucket[]
  subCategories: SubCatData[]
}

function BarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--primary-600)', borderRadius: 'var(--radius-md)', padding: '5px 11px', boxShadow: 'var(--shadow-md)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--neutral-0)' }}>
        {formatMoney(payload[0].value)}
      </span>
    </div>
  )
}

function SubCatRow({ rank, data }: { rank: number; data: SubCatData }) {
  const isFirst = rank === 1
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: rank > 1 ? '1px solid var(--neutral-100)' : 'none' }}>
      <div style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        flexShrink: 0,
        background: isFirst ? 'var(--primary-500)' : 'var(--neutral-100)',
        color: isFirst ? 'var(--neutral-0)' : 'var(--neutral-400)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
      }}>
        {rank}
      </div>
      <div style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <CategoryIcon categoryName={data.parentCategoryName || data.name} size={20} fallback={data.icon || '💰'} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--neutral-700)', lineHeight: 1.2 }}>{data.name}</p>
        {data.topTx && (
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--neutral-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            ↑ {data.topTx.label}
          </p>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--neutral-800)', lineHeight: 1.2 }}>
          {formatMoney(data.total)}
        </p>
        {data.topTx && (
          <p style={{ margin: '3px 0 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--neutral-400)' }}>
            max {formatMoney(data.topTx.amount)}
          </p>
        )}
      </div>
    </div>
  )
}

function AnalyseModal({
  open,
  onClose,
  categoryName,
  monthlyAvg,
  monthlyBudgetToDate,
  monthlyHistory,
  subCategories,
}: AnalyseModalProps) {
  const todayLabel = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  const hasComparableValues = monthlyAvg > 0 && monthlyBudgetToDate > 0
  const avgGapPct = hasComparableValues ? ((monthlyAvg - monthlyBudgetToDate) / monthlyBudgetToDate) * 100 : 0
  const avgGapColor = hasComparableValues
    ? (avgGapPct > 0 ? 'var(--color-negative)' : avgGapPct < 0 ? 'var(--color-positive)' : 'var(--neutral-800)')
    : 'var(--neutral-300)'

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="am-bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,13,31,0.6)', backdropFilter: 'blur(3px)' }}
          />

          <motion.div
            key="am-sh"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 201,
              background: 'var(--neutral-50)',
              borderRadius: '28px 28px 0 0',
              height: '92dvh',
              maxWidth: 512,
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '12px 20px 0', flexShrink: 0, borderBottom: '1px solid var(--neutral-100)', background: 'var(--neutral-50)' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--neutral-200)', margin: '0 auto 16px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CategoryIcon categoryName={categoryName} size={22} fallback="✨" />
                  <div>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--neutral-800)' }}>Analyse</h2>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--neutral-400)' }}>{categoryName}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--neutral-100)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  <X size={16} color="var(--neutral-500)" />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px', paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}>
              <div style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-card)', padding: '14px 16px', marginBottom: 14, border: '1px solid var(--neutral-100)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.35 }} style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'clamp(28px, 8vw, 36px)', fontWeight: 700, color: 'var(--neutral-900)', letterSpacing: '-1px', lineHeight: 1 }}>
                      {monthlyAvg > 0 ? formatMoney(monthlyAvg) : '—'}
                    </motion.p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--neutral-400)', lineHeight: 1.35 }}>
                      montant moyen mensuel constaté
                    </p>
                  </div>
                  <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--neutral-100)', flexShrink: 0 }} />
                  <div style={{ minWidth: 112, textAlign: 'right' }}>
                    <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.35 }} style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'clamp(28px, 8vw, 36px)', fontWeight: 700, color: avgGapColor, letterSpacing: '-0.8px', lineHeight: 1 }}>
                      {hasComparableValues ? `${avgGapPct > 0 ? '+' : ''}${avgGapPct.toFixed(0)}%` : '—'}
                    </motion.p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--neutral-400)', lineHeight: 1.35 }}>
                      écart vs enveloppe allouée au {todayLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-card)', padding: '16px 14px 12px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '1px' }}>Évolution 6 mois</p>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyHistory} barGap={8} barCategoryGap="22%" margin={{ top: 28, right: 6, left: 6, bottom: 2 }}>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--neutral-400)', fontFamily: 'var(--font-sans)' }} />
                    <YAxis hide />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(91,87,245,0.06)' }} />
                    <Bar dataKey="amount" radius={[9, 9, 0, 0]} maxBarSize={52}>
                      <LabelList dataKey="amount" position="top" offset={8} formatter={(value: number) => (Number.isFinite(value) && value > 0 ? formatMoney(value) : '')} fill="var(--neutral-500)" fontFamily="var(--font-mono)" fontSize={11} fontWeight={700} />
                      {monthlyHistory.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.budget > 0 && entry.amount > entry.budget ? 'var(--color-error)' : 'var(--primary-500)'} fillOpacity={i === monthlyHistory.length - 1 ? 1 : 0.38} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-card)', padding: '18px 16px' }}>
                <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '1px' }}>Sous-catégories</p>
                <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--neutral-400)' }}>Classées par montant total</p>
                {subCategories.length > 0 ? (
                  subCategories.map((sc, i) => <SubCatRow key={sc.id} rank={i + 1} data={{ ...sc, parentCategoryName: sc.parentCategoryName ?? categoryName }} />)
                ) : (
                  <div style={{ padding: '28px 0', textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: 'var(--neutral-400)', margin: 0 }}>Aucune sous-catégorie</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

interface SubCategoryTransactionsModalProps {
  open: boolean
  onClose: () => void
  title: string
  transactions: Transaction[]
  loading: boolean
  onSelectTransaction: (transaction: Transaction) => void
}

function SubCategoryTransactionsModal({
  open,
  onClose,
  title,
  transactions,
  loading,
  onSelectTransaction,
}: SubCategoryTransactionsModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(13,13,31,0.56)' }} />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 330 }}
            style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 221, width: '100%', maxWidth: 512, margin: '0 auto', background: 'var(--neutral-0)', borderRadius: '24px 24px 0 0', maxHeight: '82dvh', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}
          >
            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--neutral-900)' }}>{title}</p>
              <button type="button" onClick={onClose} style={{ border: 'none', background: 'var(--neutral-100)', color: 'var(--neutral-600)', width: 32, height: 32, borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label="Fermer">
                <X size={15} />
              </button>
            </div>
            <div style={{ maxHeight: 'calc(82dvh - 66px)', overflowY: 'auto' }}>
              {loading ? (
                <p style={{ margin: 0, padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)' }}>Chargement…</p>
              ) : transactions.length === 0 ? (
                <p style={{ margin: 0, padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)' }}>Aucune opération</p>
              ) : (
                transactions.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => onSelectTransaction(tx)}
                    style={{
                      width: '100%',
                      border: 'none',
                      borderBottom: '1px solid var(--neutral-200)',
                      padding: 'var(--space-3) var(--space-5)',
                      display: 'grid',
                      gridTemplateColumns: '52px minmax(0,1fr) auto',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      background: 'transparent',
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
                    <span style={{ fontSize: 12, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>{formatTxDateDayMonth(tx.transaction_date)}</span>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--neutral-800)' }}>{txLabel(tx)}</span>
                    <span style={{ fontSize: 13, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{formatMoney(Number(tx.amount))}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

export function Budgets() {
  const { year, month } = getCurrentPeriod()
  const now = new Date()
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth()

  const [periodKey, setPeriodKey] = useState<PeriodKey>('mois')
  const [selectedCat, setSelectedCat] = useState<string>('all')
  const [showCatSheet, setShowCatSheet] = useState(false)
  const [showAnalyseModal, setShowAnalyseModal] = useState(false)
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategoryTrendItem | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [pendingTransaction, setPendingTransaction] = useState<Transaction | null>(null)
  const [subCategoryToReopen, setSubCategoryToReopen] = useState<SubCategoryTrendItem | null>(null)
  const [selectedDonutSlice, setSelectedDonutSlice] = useState<PieDatum | null>(null)
  const [showBudgetInfo, setShowBudgetInfo] = useState(false)
  const debugRanRef = useRef(false)
  const donutTooltipRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (import.meta.env.DEV && !debugRanRef.current) {
      debugRanRef.current = true
      void debugBudgetSupabaseConnection(supabase)
    }
  }, [])

  const { data: summaries } = useBudgetSummaries(year, month)
  const { data: categories = [] } = useCategories('expense')
  const rootExpenseCategories = useMemo(() => categories.filter((c) => c.parent_id === null), [categories])
  const expenseSubCategories = useMemo(() => categories.filter((c) => c.parent_id !== null), [categories])
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const range = useMemo(() => getPeriodRange(periodKey), [periodKey])

  const selectedCategoryIds = useMemo(() => {
    if (selectedCat === 'all') return undefined
    const ids = [selectedCat]
    expenseSubCategories.forEach((c) => {
      if (c.parent_id === selectedCat) ids.push(c.id)
    })
    return ids
  }, [expenseSubCategories, selectedCat])

  const { data: periodTxns } = useTransactions({
    ...range,
    flowType: 'expense',
    categoryIds: selectedCategoryIds,
  })

  const threeMonthStart = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)
  const { data: threeMonthTxns } = useTransactions({
    startDate: threeMonthStart,
    endDate: lastMonthEnd,
    flowType: 'expense',
    categoryIds: selectedCategoryIds,
  })

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const { data: currentMonthAllExpenseTxns } = useTransactions({
    startDate: currentMonthStart,
    endDate: todayStr(),
    flowType: 'expense',
  })
  const threeMonthRollingStart = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10)
  const { data: rollingThreeMonthAllExpenseTxns } = useTransactions({
    startDate: threeMonthRollingStart,
    endDate: todayStr(),
    flowType: 'expense',
  })
  const historyStart = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10)
  const { data: historyTxns } = useTransactions({
    startDate: historyStart,
    endDate: todayStr(),
    flowType: 'expense',
    categoryIds: selectedCategoryIds,
  })
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)
  const { data: prevMonthAllExpenseTxns } = useTransactions({
    startDate: prevMonthStart,
    endDate: prevMonthEnd,
    flowType: 'expense',
  })
  const { data: subCategoryTransactions, isLoading: loadingSubCategoryTransactions } = useTransactions({
    ...range,
    flowType: 'expense',
    categoryIds: selectedSubCategory ? [selectedSubCategory.id] : ['__none__'],
  })

  const totalMonthlyBudget = useMemo(() => {
    if (!summaries?.length) return 0
    if (selectedCat === 'all') return summaries.reduce((s, b) => s + b.budget_amount, 0)
    return summaries.find((s) => s.category.id === selectedCat)?.budget_amount ?? 0
  }, [summaries, selectedCat])

  const periodBudget = useMemo(() => scaleBudget(totalMonthlyBudget, periodKey), [totalMonthlyBudget, periodKey])
  const periodSpent = useMemo(() => (periodTxns ?? []).reduce((s, t) => s + Number(t.amount), 0), [periodTxns])

  const threeMonthAvg = useMemo(() => {
    if (!threeMonthTxns?.length) return 0
    return threeMonthTxns.reduce((s, t) => s + Number(t.amount), 0) / 3
  }, [threeMonthTxns])

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed = now.getDate()
  const budgetToDate = daysElapsed > 0 ? (totalMonthlyBudget / daysInMonth) * daysElapsed : 0

  const selectedCatInfo = useMemo(() => categories.find((c) => c.id === selectedCat) ?? null, [categories, selectedCat])

  const subCategoryRows = useMemo<SubCategoryTrendItem[]>(() => {
    const visibleSubCategories = selectedCat === 'all'
      ? expenseSubCategories
      : expenseSubCategories.filter((c) => c.parent_id === selectedCat)

    if (!visibleSubCategories.length) return []

    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]))

    const currentMonthByCategory = (currentMonthAllExpenseTxns ?? []).reduce<Map<string, number>>((acc, tx) => {
      if (!tx.category_id) return acc
      acc.set(tx.category_id, (acc.get(tx.category_id) ?? 0) + Number(tx.amount))
      return acc
    }, new Map<string, number>())

    const rollingThreeMonthsByCategory = (rollingThreeMonthAllExpenseTxns ?? []).reduce<Map<string, number>>((acc, tx) => {
      if (!tx.category_id) return acc
      acc.set(tx.category_id, (acc.get(tx.category_id) ?? 0) + Number(tx.amount))
      return acc
    }, new Map<string, number>())

    const previousMonthByCategory = (prevMonthAllExpenseTxns ?? []).reduce<Map<string, number>>((acc, tx) => {
      if (!tx.category_id) return acc
      acc.set(tx.category_id, (acc.get(tx.category_id) ?? 0) + Number(tx.amount))
      return acc
    }, new Map<string, number>())

    return visibleSubCategories
      .map((subCat) => {
        const currentMonthAmount = currentMonthByCategory.get(subCat.id) ?? 0
        const previousMonthAmount = previousMonthByCategory.get(subCat.id) ?? 0
        const threeMonthAvgValue = (rollingThreeMonthsByCategory.get(subCat.id) ?? 0) / 3

        let trend: SubCatTrend = 'equal'
        if (currentMonthAmount > previousMonthAmount + 0.01) trend = 'up'
        if (currentMonthAmount < previousMonthAmount - 0.01) trend = 'down'

        return {
          id: subCat.id,
          name: subCat.name,
          parentCategoryName: subCat.parent_id ? categoryNameById.get(subCat.parent_id) ?? null : null,
          currentMonthAmount,
          previousMonthAmount,
          threeMonthAvg: threeMonthAvgValue,
          trend,
        }
      })
      .filter((row) => row.currentMonthAmount > 0 || row.threeMonthAvg > 0)
      .sort((a, b) => (b.currentMonthAmount - a.currentMonthAmount) || (b.threeMonthAvg - a.threeMonthAvg))
  }, [
    selectedCat,
    expenseSubCategories,
    categories,
    currentMonthAllExpenseTxns,
    prevMonthAllExpenseTxns,
    rollingThreeMonthAllExpenseTxns,
  ])

  const monthlyHistory = useMemo<MonthlyBucket[]>(() => {
    const base = [-5, -4, -3, -2, -1, 0].map((offset) => {
      const d = new Date(nowYear, nowMonth + offset, 1)
      const m = d.getMonth()
      const y = d.getFullYear()
      const amount = (historyTxns ?? []).reduce((sum, t) => {
        const txDate = new Date(t.transaction_date)
        if (txDate.getMonth() === m && txDate.getFullYear() === y) return sum + Number(t.amount)
        return sum
      }, 0)
      return { month: MONTHS_FR_SHORT[m], amount, budget: totalMonthlyBudget, isCurrent: offset === 0 }
    })

    return base.map((row, idx) => {
      if (idx === 0) return { ...row, evolutionPct: null }
      const prev = base[idx - 1].amount
      if (prev <= 0) return { ...row, evolutionPct: null }
      return { ...row, evolutionPct: ((row.amount - prev) / prev) * 100 }
    })
  }, [historyTxns, totalMonthlyBudget, nowMonth, nowYear])

  const pieData = useMemo<PieDatum[]>(() => {
    const txs = periodTxns ?? []
    const amounts = new Map<string, number>()

    txs.forEach((tx) => {
      const categoryId = tx.category_id
      if (!categoryId) return
      const category = categoryById.get(categoryId)
      if (!category) return

      if (selectedCat === 'all') {
        const rootId = category.parent_id ?? category.id
        amounts.set(rootId, (amounts.get(rootId) ?? 0) + Number(tx.amount))
        return
      }

      if (category.parent_id === selectedCat || category.id === selectedCat) {
        amounts.set(category.id, (amounts.get(category.id) ?? 0) + Number(tx.amount))
      }
    })

    return Array.from(amounts.entries())
      .map(([id, value]) => ({
        id,
        name: categoryById.get(id)?.name ?? 'Catégorie',
        value,
        color: accentFromLabel(categoryById.get(id)?.name ?? id),
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [categoryById, periodTxns, selectedCat])

  const chartRatioPct = periodBudget > 0 ? (periodSpent / periodBudget) * 100 : 0
  const monthlyVariableBudget = useMemo(
    () => (summaries ?? []).reduce((sum, row) => sum + Number(row.budget_amount), 0),
    [summaries],
  )
  const budgetSharePct = monthlyVariableBudget > 0 ? (totalMonthlyBudget / monthlyVariableBudget) * 100 : 0
  const topFiveCategories = useMemo(() => pieData.slice(0, 5), [pieData])
  const pieTotal = useMemo(() => pieData.reduce((sum, item) => sum + item.value, 0), [pieData])

  const handlePeriodTab = (key: PeriodKey) => {
    setPeriodKey(key)
  }

  const monthModeLabel = getPeriodLabel('mois')
  const yearModeLabel = getPeriodLabel('annee')
  const categoryProgressPct = periodBudget > 0 ? Math.min(100, (periodSpent / periodBudget) * 100) : 0
  const statusHealthy = periodSpent <= periodBudget
  const subCategoryModalTitle = selectedSubCategory
    ? `${selectedSubCategory.name} - ${getPeriodLabel(periodKey)}`
    : ''

  useEffect(() => {
    if (!selectedDonutSlice) return
    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (donutTooltipRef.current && !donutTooltipRef.current.contains(target)) {
        setSelectedDonutSlice(null)
      }
    }
    document.addEventListener('mousedown', onDocumentMouseDown)
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown)
    }
  }, [selectedDonutSlice])

  useEffect(() => {
    if (!pendingTransaction || selectedSubCategory) return
    const timeoutId = window.setTimeout(() => {
      setSelectedTransaction(pendingTransaction)
      setPendingTransaction(null)
    }, 280)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [pendingTransaction, selectedSubCategory])

  const handleSelectTransactionFromSubCategory = (transaction: Transaction) => {
    if (selectedSubCategory) {
      setSubCategoryToReopen(selectedSubCategory)
      setSelectedSubCategory(null)
    }
    setPendingTransaction(transaction)
  }

  const handleCloseTransactionDetails = () => {
    setSelectedTransaction(null)
    if (subCategoryToReopen) {
      const nextSubCategory = subCategoryToReopen
      setSubCategoryToReopen(null)
      window.setTimeout(() => {
        setSelectedSubCategory(nextSubCategory)
      }, 120)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        padding: 'var(--space-6)',
        paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ display: 'grid', gap: 'var(--space-4)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
          <div>
            <button
              type="button"
              onClick={() => setSelectedCat('all')}
              style={{
                border: 'none',
                background: 'transparent',
                padding: 0,
                margin: 0,
                fontSize: 26,
                fontWeight: 700,
                color: 'var(--neutral-900)',
                letterSpacing: '-0.4px',
                cursor: 'pointer',
                lineHeight: 1.1,
              }}
            >
              Budgets
            </button>
            <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => handlePeriodTab('mois')}
                style={{
                  border: 'none',
                  background: periodKey === 'mois' ? 'var(--primary-50)' : 'transparent',
                  color: periodKey === 'mois' ? 'var(--primary-600)' : 'var(--neutral-500)',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 'var(--radius-pill)',
                  padding: '2px 8px',
                  minWidth: 84,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                {monthModeLabel}
              </button>
              <span style={{ fontSize: 12, color: 'var(--neutral-400)', fontWeight: 700 }}>↔</span>
              <button
                type="button"
                onClick={() => handlePeriodTab('annee')}
                style={{
                  border: 'none',
                  background: periodKey === 'annee' ? 'var(--primary-50)' : 'transparent',
                  color: periodKey === 'annee' ? 'var(--primary-600)' : 'var(--neutral-500)',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 'var(--radius-pill)',
                  padding: '2px 8px',
                  minWidth: 84,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                {yearModeLabel}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCatSheet(true)}
            style={{
              border: '2px solid var(--primary-500)',
              background: 'var(--primary-50)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4)',
              cursor: 'pointer',
              color: 'var(--primary-500)',
              lineHeight: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform var(--transition-base), box-shadow var(--transition-base)',
              boxShadow: 'var(--shadow-sm)',
            }}
            aria-label="Choisir une catégorie"
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
            }}
          >
            {selectedCat === 'all'
              ? <span style={{ fontSize: 44 }}>✨</span>
              : <CategoryIcon categoryName={selectedCatInfo?.name} size={48} fallback="💰" />}
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 'var(--space-4)',
            background: 'var(--neutral-50)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
          }}
        >
          <div style={{ paddingRight: 'var(--space-4)', borderRight: '1px solid var(--neutral-200)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--neutral-500)' }}>Budget</p>
            <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>{formatMoney(periodBudget)}</p>
          </div>
          <div style={{ paddingRight: 'var(--space-4)', borderRight: '1px solid var(--neutral-200)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--neutral-500)' }}>Dépensé</p>
            <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-error)', fontFamily: 'var(--font-mono)' }}>{formatMoney(periodSpent)}</p>
          </div>
          <div style={{ paddingRight: 'var(--space-4)', borderRight: '1px solid var(--neutral-200)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--neutral-500)' }}>%</p>
            <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-md)', fontWeight: 700, color: chartRatioPct > 100 ? 'var(--color-warning)' : 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>{`${chartRatioPct.toFixed(0)}%`}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--neutral-500)' }}>Restant</p>
            <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-md)', fontWeight: 700, color: periodBudget - periodSpent >= 0 ? 'var(--color-success)' : 'var(--color-warning)', fontFamily: 'var(--font-mono)' }}>{formatMoney(periodBudget - periodSpent)}</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          display: 'grid',
          gap: 'var(--space-2)',
        }}
      >
        {selectedCat === 'all' ? (
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
            Répartition par catégorie
          </p>
        ) : null}

        <div
          style={{
            minHeight: '25dvh',
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
            gap: 'var(--space-6)',
            alignItems: 'start',
          }}
        >
          <div style={{ position: 'relative', height: '100%', minHeight: 220 }}>
          {selectedDonutSlice ? (
            <div
              ref={donutTooltipRef}
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translate(-50%, -110%)',
                background: 'var(--neutral-0)',
                border: '1px solid var(--neutral-200)',
                boxShadow: 'var(--shadow-md)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)',
                zIndex: 2,
                minWidth: 180,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-800)' }}>{selectedDonutSlice.name}</p>
                <button type="button" onClick={() => setSelectedDonutSlice(null)} style={{ border: 'none', background: 'transparent', color: 'var(--neutral-500)', cursor: 'pointer', padding: 0 }}>
                  <X size={14} />
                </button>
              </div>
              <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)' }}>
                {formatMoney(selectedDonutSlice.value)}
              </p>
            </div>
          ) : null}

          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="62%"
                outerRadius="84%"
                paddingAngle={2}
                stroke="none"
                onClick={(slice: any) => {
                  const payload = slice?.payload ?? slice
                  setSelectedDonutSlice({
                    id: String(payload?.id ?? 'slice'),
                    name: String(payload?.name ?? 'Catégorie'),
                    value: Number(payload?.value ?? 0),
                    color: String(payload?.color ?? 'var(--primary-500)'),
                  })
                }}
                labelLine={false}
                label={(props: any) => {
                  const payload = props?.payload as PieDatum | undefined
                  if (!payload || !selectedDonutSlice || payload.id !== selectedDonutSlice.id || pieTotal <= 0) return null
                  const { x, y } = props
                  if (typeof x !== 'number' || typeof y !== 'number') return null
                  const pct = (payload.value / pieTotal) * 100
                  return (
                    <text
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="var(--neutral-0)"
                      fontSize={10}
                      fontWeight={700}
                    >
                      {`${pct.toFixed(0)}%`}
                    </text>
                  )
                }}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.id} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1.1 }}>
              {formatMoney(periodSpent)}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: chartRatioPct > 100 ? 'var(--color-warning)' : 'var(--color-success)', lineHeight: 1 }}>
              {`${chartRatioPct.toFixed(0)}%`}
            </p>
          </div>
          </div>

          {selectedCat === 'all' ? (
            <div style={{ display: 'grid', gap: '2px', alignContent: 'center', minHeight: 220 }}>
              <p style={{ margin: '0 0 var(--space-1)', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-600)' }}>
                Top 5 catégories
              </p>
            {topFiveCategories.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--neutral-400)' }}>Aucune donnée</p>
            ) : topFiveCategories.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setSelectedCat(entry.id)
                  setSelectedDonutSlice(null)
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '4px 0',
                  cursor: 'pointer',
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: '12px minmax(0,1fr) auto',
                  alignItems: 'center',
                  gap: '4px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--neutral-200)',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-500)' }}>{index + 1}</span>
                <span style={{ minWidth: 0, fontSize: 13, color: 'var(--neutral-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {entry.name}
                </span>
                <span style={{ fontSize: 13, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                  {formatMoney(entry.value)}
                </span>
              </button>
            ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--space-3)', alignContent: 'center', minHeight: 220 }}>
            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) auto auto', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div style={{ width: 44, height: 44, position: 'relative' }}>
                <svg width="44" height="44" viewBox="0 0 44 44" style={{ position: 'absolute', inset: 0 }}>
                  <circle cx="22" cy="22" r="19" fill="none" stroke="var(--neutral-200)" strokeWidth="3" />
                  <circle
                    cx="22"
                    cy="22"
                    r="19"
                    fill="none"
                    stroke="var(--primary-500)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${(2 * Math.PI * 19 * categoryProgressPct) / 100} ${2 * Math.PI * 19}`}
                    transform="rotate(-90 22 22)"
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 7, borderRadius: 'var(--radius-full)', background: accentFromLabel(selectedCatInfo?.name ?? 'toutes'), display: 'grid', placeItems: 'center' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 'var(--radius-sm)', background: 'var(--neutral-0)' }} />
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--neutral-800)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedCatInfo?.name ?? 'Catégorie'}
              </p>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                {formatMoney(totalMonthlyBudget)}
              </p>
              <button
                type="button"
                onClick={() => setShowBudgetInfo((v) => !v)}
                onMouseEnter={() => setShowBudgetInfo(true)}
                onMouseLeave={() => setShowBudgetInfo(false)}
                style={{ border: 'none', background: 'transparent', padding: 0, display: 'inline-flex', cursor: 'pointer', color: 'var(--neutral-600)' }}
              >
                <Info size={16} />
              </button>

              {showBudgetInfo ? (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: 'var(--space-2)',
                    zIndex: 2,
                    background: 'var(--neutral-50)',
                    border: '1px solid var(--neutral-200)',
                    boxShadow: 'var(--shadow-sm)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3)',
                    minWidth: 280,
                  }}
                >
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-700)' }}>
                    {`${formatMoney(totalMonthlyBudget)} (budget de la catégorie) sur ${formatMoney(monthlyVariableBudget)} (budget mensuel variable)`}
                  </p>
                  <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--neutral-600)' }}>
                    {`${budgetSharePct.toFixed(0)}% du budget mensuel variable`}
                  </p>
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--neutral-800)' }}>
                {`Restant : ${formatMoney(periodBudget - periodSpent)}`}
              </p>
              <span style={{ display: 'inline-flex', color: statusHealthy ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {statusHealthy ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              </span>
            </div>
            </div>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24 }}
        style={{ display: 'grid', gap: 'var(--space-2)' }}
      >
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
          Évolutions 6 derniers mois
        </p>
        <div style={{ height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyHistory} barCategoryGap="18%" margin={{ top: 24, right: 30, left: 4, bottom: 2 }}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--neutral-500)' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--neutral-500)' }} tickFormatter={(value) => formatMoney(Number(value))} width={64} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(67,97,238,0.08)' }} />
              <ReferenceLine
                y={totalMonthlyBudget}
                stroke="var(--color-warning)"
                strokeWidth={2}
                strokeDasharray="4 4"
                label={{ value: 'Budget mensuel', position: 'right', fill: 'var(--neutral-600)', fontSize: 11 }}
              />
              <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={46}>
                <LabelList
                  dataKey="amount"
                  position="top"
                  offset={8}
                  content={(props: any) => {
                    const { x, y, width, payload } = props
                    const item = payload as MonthlyBucket | undefined
                    if (!item || item.isCurrent || x == null || y == null || width == null) return null
                    return (
                      <text x={Number(x) + Number(width) / 2} y={Number(y) - 6} textAnchor="middle" fill="var(--neutral-900)" fontSize={12} fontWeight={700}>
                        {formatMoney(item.amount)}
                      </text>
                    )
                  }}
                />
                <LabelList
                  dataKey="evolutionPct"
                  position="top"
                  offset={20}
                  content={(props: any) => {
                    const { x, y, width, payload } = props
                    const item = payload as MonthlyBucket | undefined
                    if (!item || item.evolutionPct == null || x == null || y == null || width == null) return null
                    const text = `${item.evolutionPct > 0 ? '+' : ''}${item.evolutionPct.toFixed(0)}%`
                    return (
                      <text x={Number(x) + Number(width) / 2} y={Number(y) - 20} textAnchor="middle" fill={item.evolutionPct >= 0 ? 'var(--color-success)' : 'var(--color-error)'} fontSize={11} fontWeight={700}>
                        {text}
                      </text>
                    )
                  }}
                />
                {monthlyHistory.map((entry, i) => (
                  <Cell key={`history-${i}`} fill="var(--primary-500)" fillOpacity={entry.isCurrent ? 1 : 0.62} style={{ cursor: 'pointer' }} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        style={{ margin: '0 calc(-1 * var(--space-6))' }}
      >
        <div style={{ padding: '0 var(--space-6) var(--space-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-600)' }}>Sous-catégories</p>
          <button
            type="button"
            onClick={() => setShowAnalyseModal(true)}
            style={{ border: 'none', background: 'transparent', padding: 0, color: 'var(--primary-500)', fontSize: 'var(--font-size-sm)', fontWeight: 700, cursor: 'pointer' }}
          >
            Analyse
          </button>
        </div>

        {selectedCat === 'all' ? (
          <div style={{ textAlign: 'center', color: 'var(--neutral-400)', padding: 'var(--space-8) var(--space-6)' }}>
            Sélectionnez une catégorie pour ouvrir le détail des sous-catégories
          </div>
        ) : subCategoryRows.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--neutral-400)', padding: 'var(--space-8) var(--space-6)' }}>
            Aucune sous-catégorie sur cette période
          </div>
        ) : (
          [...subCategoryRows]
            .sort((a, b) => b.currentMonthAmount - a.currentMonthAmount)
            .map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedSubCategory(row)}
                style={{
                  width: '100%',
                  borderBottom: '1px solid var(--neutral-200)',
                  background: 'transparent',
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderTop: 'none',
                  padding: 'var(--space-3) var(--space-6)',
                  display: 'grid',
                  gridTemplateColumns: '30px minmax(0,1fr) auto auto',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--neutral-50)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CategoryIcon categoryName={row.name} size={18} fallback="💰" />
                </span>
                <span style={{ minWidth: 0, fontSize: 13, color: 'var(--neutral-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.name}
                </span>
                <span style={{ fontSize: 13, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                  {formatMoney(row.currentMonthAmount)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', color: row.trend === 'up' ? 'var(--color-error)' : row.trend === 'down' ? 'var(--color-success)' : 'var(--neutral-400)' }}>
                  {row.trend === 'up' ? <ArrowUpRight size={16} /> : row.trend === 'down' ? <ArrowDownRight size={16} /> : <span style={{ fontSize: 12, fontWeight: 700 }}>—</span>}
                </span>
              </button>
            ))
        )}
      </motion.div>

      <AnalyseModal
        open={showAnalyseModal}
        onClose={() => setShowAnalyseModal(false)}
        categoryName={selectedCat === 'all' ? 'Toutes catégories' : (selectedCatInfo?.name ?? 'Catégorie')}
        monthlyAvg={threeMonthAvg}
        monthlyBudgetToDate={budgetToDate}
        monthlyHistory={monthlyHistory}
        subCategories={subCategoryRows.map((row) => ({
          id: row.id,
          name: row.name,
          parentCategoryName: row.parentCategoryName,
          icon: '💰',
          total: row.currentMonthAmount,
          topTx: null,
        }))}
      />

      <SubCategoryTransactionsModal
        open={Boolean(selectedSubCategory)}
        onClose={() => {
          setSelectedSubCategory(null)
          setSubCategoryToReopen(null)
          setPendingTransaction(null)
        }}
        title={subCategoryModalTitle}
        transactions={subCategoryTransactions ?? []}
        loading={loadingSubCategoryTransactions}
        onSelectTransaction={handleSelectTransactionFromSubCategory}
      />

      <TransactionDetailsModal
        transaction={selectedTransaction}
        categories={categories}
        onClose={handleCloseTransactionDetails}
      />

      <CategorySheet
        open={showCatSheet}
        selectedId={selectedCat}
        categories={rootExpenseCategories}
        onClose={() => setShowCatSheet(false)}
        onSelect={setSelectedCat}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
