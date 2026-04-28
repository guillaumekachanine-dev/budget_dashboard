import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, LabelList, PieChart, Pie,
} from 'recharts'
import { useBudgetSummaries } from '@/hooks/useBudgets'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { getCurrentPeriod, formatCurrencyRounded } from '@/lib/utils'
import { debugBudgetSupabaseConnection } from '@/debug/debugBudgetSupabase'
import { supabase } from '@/lib/supabase'
import type { Category, Transaction } from '@/lib/types'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { KpiCard } from '@/components'

// ─── Types ────────────────────────────────────────────────────────────────────
type PeriodKey    = 'semaine' | 'mois' | 'trimestre' | 'annee' | 'custom'
type CustomMode   = 'fixed' | 'rolling'

interface CustomState {
  mode:        CustomMode
  startDate:   string
  endDate:     string
  rollingDays: number
}

interface MonthlyBucket {
  month:  string    // label court, ex : "Jan"
  amount: number
  budget: number
  evolutionPct: number | null
}

interface TopTransaction {
  label:  string
  amount: number
  date:   string
}

interface SubCatData {
  id:    string
  name:  string
  parentCategoryName?: string | null
  icon:  string
  total: number
  topTx: TopTransaction | null
}

type SubCatTrend = 'up' | 'down' | 'equal'

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function getPeriodRange(key: PeriodKey, custom: CustomState): { startDate: string; endDate: string } {
  const now = new Date()
  switch (key) {
    case 'semaine': {
      const dow = now.getDay() === 0 ? 6 : now.getDay() - 1
      const monday = new Date(now)
      monday.setDate(now.getDate() - dow)
      return { startDate: monday.toISOString().slice(0, 10), endDate: todayStr() }
    }
    case 'mois':
      return {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
        endDate: todayStr(),
      }
    case 'trimestre': {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
      return {
        startDate: new Date(now.getFullYear(), quarterStartMonth, 1).toISOString().slice(0, 10),
        endDate: todayStr(),
      }
    }
    case 'annee':
      return { startDate: `${now.getFullYear()}-01-01`, endDate: todayStr() }
    case 'custom':
      if (custom.mode === 'fixed') {
        return {
          startDate: custom.startDate || todayStr(),
          endDate:   custom.endDate   || todayStr(),
        }
      } else {
        const start = new Date(now)
        start.setDate(now.getDate() - custom.rollingDays + 1)
        return { startDate: start.toISOString().slice(0, 10), endDate: todayStr() }
      }
  }
}

function getDaysBetween(start: string, end: string): number {
  const a = new Date(start + 'T00:00:00')
  const b = new Date(end   + 'T00:00:00')
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1)
}

function scaleBudget(monthlyBudget: number, key: PeriodKey, custom: CustomState): number {
  if (monthlyBudget === 0) return 0
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  if (key === 'annee') return monthlyBudget * 12
  if (key === 'trimestre') return monthlyBudget * 3
  const range = getPeriodRange(key, custom)
  return (monthlyBudget / daysInMonth) * getDaysBetween(range.startDate, range.endDate)
}

function fmtDayShort(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function getPeriodLabel(key: PeriodKey, custom: CustomState): string {
  switch (key) {
    case 'semaine': {
      const r = getPeriodRange('semaine', custom)
      return `Sem. du ${fmtDayShort(r.startDate)}`
    }
    case 'mois': {
      const now = new Date()
      return now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    }
    case 'trimestre': {
      const now = new Date()
      const quarter = Math.floor(now.getMonth() / 3) + 1
      return `T${quarter} ${now.getFullYear()}`
    }
    case 'annee':
      return `Année ${new Date().getFullYear()}`
    case 'custom':
      return custom.mode === 'fixed'
        ? `${fmtDayShort(custom.startDate)} → ${fmtDayShort(custom.endDate)}`
        : `Derniers ${custom.rollingDays}j`
  }
}

const MONTHS_FR_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const VIZ_TOKENS = ['var(--viz-a)', 'var(--viz-b)', 'var(--viz-c)', 'var(--viz-d)', 'var(--viz-e)'] as const

function accentFromLabel(label: string): string {
  const key = label.trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash << 5) - hash + key.charCodeAt(i)
  return VIZ_TOKENS[Math.abs(hash) % VIZ_TOKENS.length]
}

// ─── CustomPeriodSheet ────────────────────────────────────────────────────────
const ROLLING_PRESETS = [7, 14, 30, 90]

interface CustomPeriodSheetProps {
  open:     boolean
  value:    CustomState
  onClose:  () => void
  onApply:  (v: CustomState) => void
}

function CustomPeriodSheet({ open, value, onClose, onApply }: CustomPeriodSheetProps) {
  const [draft, setDraft] = useState<CustomState>(value)

  // Sync draft whenever the sheet opens
  useEffect(() => {
    if (open) setDraft(value)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', boxSizing: 'border-box',
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--neutral-200)',
    fontSize: 14, color: 'var(--neutral-800)',
    fontFamily: 'var(--font-sans)', outline: 'none', background: 'var(--neutral-0)',
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="cp-bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(13,13,31,0.48)', backdropFilter: 'blur(2px)' }}
          />
          <motion.div
            key="cp-sh"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
              background: 'var(--neutral-0)', borderRadius: '24px 24px 0 0',
              padding: '0 20px 44px', maxWidth: 512, margin: '0 auto',
            }}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--neutral-200)', margin: '12px auto 20px' }} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--neutral-800)' }}>Période personnalisée</h3>
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--neutral-100)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={15} color="var(--neutral-500)" />
              </button>
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'var(--neutral-100)', borderRadius: 'var(--radius-full)', padding: 3 }}>
              {(['fixed', 'rolling'] as const).map((m) => (
                <button key={m} onClick={() => setDraft({ ...draft, mode: m })} style={{
                  flex: 1, padding: '9px 0', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.2s', fontFamily: 'var(--font-sans)',
                  background: draft.mode === m ? 'var(--primary-500)' : 'transparent',
                  color:      draft.mode === m ? 'var(--neutral-0)' : 'var(--neutral-500)',
                }}>
                  {m === 'fixed' ? '📌 Période fixe' : '🔄 Glissante'}
                </button>
              ))}
            </div>

            {/* Mode content */}
            <AnimatePresence mode="wait">
              {draft.mode === 'fixed' ? (
                <motion.div key="fixed" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
                >
                  {(['startDate', 'endDate'] as const).map((field, i) => (
                    <div key={field}>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 600, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                        {i === 0 ? 'Du' : 'Au'}
                      </label>
                      <input type="date" value={draft[field]} style={inputStyle}
                        onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                      />
                    </div>
                  ))}
                </motion.div>
              ) : (
                <motion.div key="rolling" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
                    Fenêtre glissante
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {ROLLING_PRESETS.map((d) => {
                      const active = draft.rollingDays === d
                      return (
                        <button key={d} onClick={() => setDraft({ ...draft, rollingDays: d })} style={{
                          padding: '13px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                          fontSize: 14, fontWeight: 700, transition: 'all 0.15s',
                          fontFamily: 'var(--font-mono)',
                          background: active ? 'var(--primary-50)' : 'var(--neutral-100)',
                          color:      active ? 'var(--primary-500)' : 'var(--neutral-500)',
                          border:     `2px solid ${active ? 'var(--primary-400)' : 'transparent'}`,
                        }}>
                          {d}j
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button onClick={() => { onApply(draft); onClose() }} style={{
              marginTop: 28, width: '100%', padding: '14px', borderRadius: 'var(--radius-full)',
              border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
              fontFamily: 'var(--font-sans)', background: 'var(--primary-500)', color: 'var(--neutral-0)',
              boxShadow: 'var(--shadow-md)',
            }}>
              Appliquer
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── CategorySheet ────────────────────────────────────────────────────────────
interface CatItem {
  id: string; name: string; icon_name: string | null; color_token: string | null
}

const ALL_ITEM: CatItem = { id: 'all', name: 'Toutes', icon_name: null, color_token: null }

interface CategorySheetProps {
  open:       boolean
  selectedId: string
  categories: Category[]
  onClose:    () => void
  onSelect:   (id: string) => void
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
            key="cat-bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(13,13,31,0.52)', backdropFilter: 'blur(3px)' }}
          />
          <motion.div
            key="cat-sh"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
              background: 'var(--neutral-50)', borderRadius: '28px 28px 0 0',
              padding: '0 20px 52px', maxWidth: 512, margin: '0 auto',
              maxHeight: '82dvh', overflowY: 'auto',
            }}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--neutral-300)', margin: '12px auto 0', flexShrink: 0 }} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0 22px', position: 'sticky', top: 0, background: 'var(--neutral-50)', zIndex: 1 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--neutral-800)' }}>Catégorie</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--neutral-400)' }}>Sélectionne une catégorie à analyser</p>
              </div>
              <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--neutral-100)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={15} color="var(--neutral-500)" />
              </button>
            </div>

            {/* Grid 4 per row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px 6px' }}>
              {items.map((cat) => {
                const isSelected = cat.id === selectedId

                return (
                  <motion.button
                    key={cat.id}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => { onSelect(cat.id); onClose() }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <div style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {cat.id === 'all'
                        ? '✨'
                        : <CategoryIcon categoryName={cat.name} size={30} fallback="💰" />}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: isSelected ? 700 : 500, textAlign: 'center',
                      lineHeight: 1.25, maxWidth: 72,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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

// ─── Analyse Modal ────────────────────────────────────────────────────────────
interface AnalyseModalProps {
  open:           boolean
  onClose:        () => void
  categoryName:   string
  monthlyAvg:     number
  monthlyBudgetToDate: number
  monthlyHistory: MonthlyBucket[]
  subCategories:  SubCatData[]
}

function BarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--primary-600)',
      borderRadius: 'var(--radius-md)',
      padding: '5px 11px',
      boxShadow: 'var(--shadow-md)',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--neutral-0)' }}>
        {formatMoney(payload[0].value)}
      </span>
    </div>
  )
}

function SubCatRow({ rank, data }: { rank: number; data: SubCatData }) {
  const isFirst = rank === 1
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 0',
      borderTop: rank > 1 ? '1px solid var(--neutral-100)' : 'none',
    }}>
      {/* Rank badge */}
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: isFirst ? 'var(--primary-500)' : 'var(--neutral-100)',
        color:      isFirst ? 'var(--neutral-0)' : 'var(--neutral-400)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700,
      }}>
        {rank}
      </div>

      {/* Category icon */}
      <div style={{
        width: 38, height: 38,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <CategoryIcon
          categoryName={data.parentCategoryName || data.name}
          size={20}
          fallback={data.icon || '💰'}
        />
      </div>

      {/* Name + top transaction */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--neutral-700)', lineHeight: 1.2 }}>
          {data.name}
        </p>
        {data.topTx && (
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--neutral-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            ↑ {data.topTx.label}
          </p>
        )}
      </div>

      {/* Total + max amount */}
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

function formatBarLabel(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  return formatMoney(value)
}

function AnalyseModal({
  open, onClose,
  categoryName,
  monthlyAvg, monthlyBudgetToDate, monthlyHistory, subCategories,
}: AnalyseModalProps) {
  const todayLabel = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  const hasComparableValues = monthlyAvg > 0 && monthlyBudgetToDate > 0
  const avgGapPct = hasComparableValues
    ? ((monthlyAvg - monthlyBudgetToDate) / monthlyBudgetToDate) * 100
    : 0
  const avgGapColor = hasComparableValues
    ? (avgGapPct > 0 ? 'var(--color-negative)' : avgGapPct < 0 ? 'var(--color-positive)' : 'var(--neutral-800)')
    : 'var(--neutral-300)'
  const hasHistoryData = monthlyHistory.some((m) => m.amount > 0)

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="am-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(13,13,31,0.6)', backdropFilter: 'blur(3px)',
            }}
          />

          {/* Panel */}
          <motion.div
            key="am-sh"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
              background: 'var(--neutral-50)',
              borderRadius: '28px 28px 0 0',
              height: '92dvh',
              maxWidth: 512, margin: '0 auto',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* ── Sticky header ─────────────────────────────── */}
            <div style={{
              padding: '12px 20px 0',
              flexShrink: 0,
              borderBottom: '1px solid var(--neutral-100)',
              background: 'var(--neutral-50)',
            }}>
              {/* Drag handle */}
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
                  style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'var(--neutral-100)', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <X size={16} color="var(--neutral-500)" />
                </button>
              </div>
            </div>

            {/* ── Scrollable body ───────────────────────────── */}
            <div style={{
              flex: 1, overflowY: 'auto',
              padding: '20px 20px',
              paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))',
            }}>

              {/* Top metrics */}
              <div style={{
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-2xl)',
                boxShadow: 'var(--shadow-card)',
                padding: '14px 16px',
                marginBottom: 14,
                border: '1px solid var(--neutral-100)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <motion.p
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.16, duration: 0.35 }}
                      style={{
                        margin: 0,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'clamp(28px, 8vw, 36px)',
                        fontWeight: 700,
                        color: 'var(--neutral-900)',
                        letterSpacing: '-1px',
                        lineHeight: 1,
                      }}
                    >
                      {monthlyAvg > 0 ? formatMoney(monthlyAvg) : '—'}
                    </motion.p>
                    <p style={{
                      margin: '4px 0 0',
                      fontSize: 11,
                      color: 'var(--neutral-400)',
                      lineHeight: 1.35,
                    }}>
                      montant moyen mensuel constaté
                    </p>
                  </div>

                  <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--neutral-100)', flexShrink: 0 }} />

                  <div style={{ minWidth: 112, textAlign: 'right' }}>
                    <motion.p
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.35 }}
                      style={{
                        margin: 0,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'clamp(28px, 8vw, 36px)',
                        fontWeight: 700,
                        color: avgGapColor,
                        letterSpacing: '-0.8px',
                        lineHeight: 1,
                      }}
                    >
                      {hasComparableValues ? `${avgGapPct > 0 ? '+' : ''}${avgGapPct.toFixed(0)}%` : '—'}
                    </motion.p>
                    <p style={{
                      margin: '4px 0 0',
                      fontSize: 11,
                      color: 'var(--neutral-400)',
                      lineHeight: 1.35,
                    }}>
                      écart vs enveloppe allouée au {todayLabel}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3-month bar chart */}
              <div style={{
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-2xl)',
                boxShadow: 'var(--shadow-card)',
                padding: '16px 14px 12px',
                marginBottom: 14,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Évolution 3 mois
                  </p>
                  <span style={{ fontSize: 11, color: 'var(--neutral-400)' }}>
                    {hasHistoryData ? 'valeurs affichées' : 'en attente de données'}
                  </span>
                </div>

                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyHistory} barGap={8} barCategoryGap="22%" margin={{ top: 28, right: 6, left: 6, bottom: 2 }}>
                    <XAxis
                      dataKey="month"
                      axisLine={false} tickLine={false}
                      tick={{ fontSize: 12, fill: 'var(--neutral-400)', fontFamily: 'var(--font-sans)' }}
                    />
                    <YAxis hide />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(91,87,245,0.06)' }} />
                    <Bar dataKey="amount" radius={[9, 9, 0, 0]} maxBarSize={52}>
                      <LabelList
                        dataKey="amount"
                        position="top"
                        offset={8}
                        formatter={(value: number) => formatBarLabel(value)}
                        fill="var(--neutral-500)"
                        fontFamily="var(--font-mono)"
                        fontSize={11}
                        fontWeight={700}
                      />
                      {monthlyHistory.map((entry, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={
                            entry.budget > 0 && entry.amount > entry.budget
                              ? 'var(--color-error)'
                              : 'var(--primary-500)'
                          }
                          fillOpacity={i === monthlyHistory.length - 1 ? 1 : 0.38}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Sub-categories ranked list */}
              <div style={{
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-2xl)',
                boxShadow: 'var(--shadow-card)',
                padding: '18px 16px',
              }}>
                <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Sous-catégories
                </p>
                <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--neutral-400)' }}>
                  Classées par montant total · toutes périodes
                </p>

                {subCategories.length > 0 ? (
                  subCategories.map((sc, i) => (
                    <SubCatRow
                      key={sc.id}
                      rank={i + 1}
                      data={{ ...sc, parentCategoryName: sc.parentCategoryName ?? categoryName }}
                    />
                  ))
                ) : (
                  <div style={{ padding: '28px 0', textAlign: 'center' }}>
                    <p style={{ fontSize: 28, marginBottom: 8 }}>🏷️</p>
                    <p style={{ fontSize: 13, color: 'var(--neutral-400)', margin: '0 0 4px' }}>Aucune sous-catégorie</p>
                    <p style={{ fontSize: 11, color: 'var(--neutral-300)', fontStyle: 'italic', margin: 0 }}>
                      Les données seront connectées prochainement
                    </p>
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
}

function SubCategoryTransactionsModal({
  open,
  onClose,
  title,
  transactions,
  loading,
}: SubCategoryTransactionsModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(13,13,31,0.56)' }}
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
              zIndex: 221,
              width: '100%',
              maxWidth: 512,
              margin: '0 auto',
              background: 'var(--neutral-0)',
              borderRadius: '24px 24px 0 0',
              maxHeight: '82dvh',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--neutral-900)' }}>{title}</p>
              <button
                type="button"
                onClick={onClose}
                style={{
                  border: 'none',
                  background: 'var(--neutral-100)',
                  color: 'var(--neutral-600)',
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-full)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                aria-label="Fermer"
              >
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
                  <div
                    key={tx.id}
                    style={{
                      borderBottom: '1px solid var(--neutral-200)',
                      padding: 'var(--space-3) var(--space-5)',
                      display: 'grid',
                      gridTemplateColumns: '52px minmax(0,1fr) auto',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>
                      {formatTxDateDayMonth(tx.transaction_date)}
                    </span>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--neutral-800)' }}>
                      {txLabel(tx)}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      {formatMoney(Number(tx.amount))}
                    </span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  { key: 'mois',      label: 'Mois' },
  { key: 'trimestre', label: 'Trimestre' },
  { key: 'annee',     label: 'Année' },
]

const DEFAULT_CUSTOM: CustomState = {
  mode: 'rolling', startDate: '', endDate: '', rollingDays: 30,
}

export function Budgets() {
  const { year, month } = getCurrentPeriod()
  const now = new Date()
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth()

  // ── UI state ──────────────────────────────────────────────
  const [periodKey,        setPeriodKey]        = useState<PeriodKey>('mois')
  const [customState,      setCustomState]      = useState<CustomState>(DEFAULT_CUSTOM)
  const [selectedCat,      setSelectedCat]      = useState<string>('all')
  const [showCustomSheet,  setShowCustomSheet]  = useState(false)
  const [showCatSheet,     setShowCatSheet]     = useState(false)
  const [showAnalyseModal, setShowAnalyseModal] = useState(false)
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategoryTrendItem | null>(null)
  const debugRanRef = useRef(false)

  useEffect(() => {
    if (import.meta.env.DEV && !debugRanRef.current) {
      debugRanRef.current = true
      void debugBudgetSupabaseConnection(supabase)
    }
  }, [])

  // ── Queries ───────────────────────────────────────────────
  const { data: summaries }        = useBudgetSummaries(year, month)
  const { data: categories = [] }  = useCategories('expense')
  const rootExpenseCategories = useMemo(
    () => categories.filter((c) => c.parent_id === null),
    [categories],
  )
  const expenseSubCategories = useMemo(
    () => categories.filter((c) => c.parent_id !== null),
    [categories],
  )
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const range = useMemo(
    () => getPeriodRange(periodKey, customState),
    [periodKey, customState],
  )

  const selectedCategoryIds = useMemo(() => {
    if (selectedCat === 'all') return undefined
    const ids = [selectedCat]
    expenseSubCategories.forEach((c) => {
      if (c.parent_id === selectedCat) ids.push(c.id)
    })
    return ids
  }, [expenseSubCategories, selectedCat])

  // Transactions for the selected period and selected category scope
  const { data: periodTxns } = useTransactions({
    ...range, flowType: 'expense', categoryIds: selectedCategoryIds,
  })

  // Last 3 full months for the KPI average
  const threeMonthStart = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10)
  const lastMonthEnd    = new Date(now.getFullYear(), now.getMonth(),    0).toISOString().slice(0, 10)
  const { data: threeMonthTxns } = useTransactions({
    startDate: threeMonthStart, endDate: lastMonthEnd, flowType: 'expense', categoryIds: selectedCategoryIds,
  })

  // Current month for KPI projection (may be same as periodTxns when key==='mois')
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const { data: currentMonthAllExpenseTxns } = useTransactions({
    startDate: currentMonthStart, endDate: todayStr(), flowType: 'expense',
  })
  const threeMonthRollingStart = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10)
  const { data: rollingThreeMonthAllExpenseTxns } = useTransactions({
    startDate: threeMonthRollingStart, endDate: todayStr(), flowType: 'expense',
  })
  const historyStart = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10)
  const { data: historyTxns } = useTransactions({
    startDate: historyStart, endDate: todayStr(), flowType: 'expense', categoryIds: selectedCategoryIds,
  })
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)
  const { data: prevMonthAllExpenseTxns } = useTransactions({
    startDate: prevMonthStart, endDate: prevMonthEnd, flowType: 'expense',
  })
  const { data: subCategoryTransactions, isLoading: loadingSubCategoryTransactions } = useTransactions({
    ...range,
    flowType: 'expense',
    categoryIds: selectedSubCategory ? [selectedSubCategory.id] : ['__none__'],
  })

  // ── Derived values ────────────────────────────────────────
  const totalMonthlyBudget = useMemo(() => {
    if (!summaries?.length) return 0
    if (selectedCat === 'all') return summaries.reduce((s, b) => s + b.budget_amount, 0)
    return summaries.find((s) => s.category.id === selectedCat)?.budget_amount ?? 0
  }, [summaries, selectedCat])

  const periodBudget = useMemo(
    () => scaleBudget(totalMonthlyBudget, periodKey, customState),
    [totalMonthlyBudget, periodKey, customState],
  )

  const periodSpent = useMemo(
    () => (periodTxns ?? []).reduce((s, t) => s + Number(t.amount), 0),
    [periodTxns],
  )

  // 3-month average per month (last 3 full months)
  const threeMonthAvg = useMemo(() => {
    if (!threeMonthTxns?.length) return 0
    return threeMonthTxns.reduce((s, t) => s + Number(t.amount), 0) / 3
  }, [threeMonthTxns])

  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed  = now.getDate()
  const budgetToDate = daysElapsed > 0
    ? (totalMonthlyBudget / daysInMonth) * daysElapsed
    : 0

  // Selected category display info
  const selectedCatInfo = useMemo(
    () => categories.find((c) => c.id === selectedCat) ?? null,
    [categories, selectedCat],
  )

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
        const threeMonthAvg = (rollingThreeMonthsByCategory.get(subCat.id) ?? 0) / 3

        let trend: SubCatTrend = 'equal'
        if (currentMonthAmount > previousMonthAmount + 0.01) trend = 'up'
        if (currentMonthAmount < previousMonthAmount - 0.01) trend = 'down'

        return {
          id: subCat.id,
          name: subCat.name,
          parentCategoryName: subCat.parent_id ? categoryNameById.get(subCat.parent_id) ?? null : null,
          currentMonthAmount,
          previousMonthAmount,
          threeMonthAvg,
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

  // Monthly history (last 3 months including current month)
  const monthlyHistory = useMemo<MonthlyBucket[]>(() => {
    const base = [-2, -1, 0].map((offset) => {
      const d = new Date(nowYear, nowMonth + offset, 1)
      const m = d.getMonth()
      const y = d.getFullYear()
      const amount = (historyTxns ?? []).reduce((sum, t) => {
        const txDate = new Date(t.transaction_date)
        if (txDate.getMonth() === m && txDate.getFullYear() === y) return sum + Number(t.amount)
        return sum
      }, 0)
      return { month: MONTHS_FR_SHORT[m], amount, budget: totalMonthlyBudget }
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

  const topFiveCategories = useMemo(() => pieData.slice(0, 5), [pieData])
  const chartRatioPct = periodBudget > 0 ? (periodSpent / periodBudget) * 100 : 0

  // ── Handle period tab click ───────────────────────────────
  const handlePeriodTab = (key: PeriodKey) => {
    setPeriodKey(key)
  }

  const periodRemaining = periodBudget - periodSpent
  const subCategoryModalTitle = selectedSubCategory
    ? `${selectedSubCategory.name} - ${getPeriodLabel(periodKey, customState)}`
    : ''

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
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        style={{ display: 'grid', gap: 'var(--space-4)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--neutral-900)', letterSpacing: '-0.4px', margin: 0 }}>Budgets</h1>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--neutral-500)', fontWeight: 500 }}>{getPeriodLabel(periodKey, customState)}</p>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          {PERIOD_TABS.map(({ key, label }) => {
            const active = periodKey === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => handlePeriodTab(key)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '0 0 6px',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--primary-500)' : 'var(--neutral-500)',
                  borderBottom: active ? '2px solid var(--primary-500)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setShowCustomSheet(true)}
            style={{
              marginLeft: 'auto',
              border: 'none',
              background: 'transparent',
              padding: '0 0 6px',
              fontSize: 13,
              fontWeight: periodKey === 'custom' ? 700 : 600,
              color: periodKey === 'custom' ? 'var(--primary-500)' : 'var(--neutral-500)',
              borderBottom: periodKey === 'custom' ? '2px solid var(--primary-500)' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Personnalisée
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        style={{
          minHeight: '25dvh',
          height: '25dvh',
          maxHeight: 360,
          display: 'grid',
          gridTemplateColumns: selectedCat === 'all' ? 'minmax(0,1.1fr) minmax(0,0.9fr)' : 'minmax(0,1fr) minmax(0,1fr)',
          gap: 'var(--space-6)',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', height: '100%', minHeight: 220 }}>
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
            <p style={{ margin: 0, fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1.1 }}>
              {formatMoney(periodSpent)}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: chartRatioPct > 100 ? 'var(--color-error)' : chartRatioPct >= 80 ? 'var(--color-warning)' : 'var(--color-success)', lineHeight: 1 }}>
              {`${chartRatioPct.toFixed(0)}%`}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--neutral-500)' }}>
              {`${chartRatioPct.toFixed(0)}% budget`}
            </p>
          </div>
        </div>

        {selectedCat === 'all' ? (
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <p style={{ margin: '0 0 var(--space-2)', fontSize: 13, fontWeight: 700, color: 'var(--neutral-600)' }}>Top 5 catégories</p>
            {topFiveCategories.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--neutral-400)' }}>Aucune dépense sur la période</p>
            ) : (
              topFiveCategories.map((row, idx) => (
                <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '22px minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: row.color }}>{idx + 1}</span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--neutral-700)' }}>
                    {row.name}
                  </span>
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
                    {formatMoney(row.value)}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : (
          <div style={{ height: '100%', minHeight: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyHistory} barCategoryGap="18%" margin={{ top: 26, right: 8, left: 4, bottom: 2 }}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--neutral-500)' }} />
                <YAxis hide />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(67,97,238,0.08)' }} />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={52}>
                  <LabelList
                    dataKey="evolutionPct"
                    position="top"
                    offset={14}
                    content={(props: any) => {
                      const { x, y, width, payload } = props
                      const item = payload as MonthlyBucket | undefined
                      if (!item || item.evolutionPct == null || x == null || y == null || width == null) return null
                      const text = `${item.evolutionPct > 0 ? '+' : ''}${item.evolutionPct.toFixed(1)}%`
                      return (
                        <text
                          x={Number(x) + Number(width) / 2}
                          y={Number(y) - 8}
                          textAnchor="middle"
                          fill={item.evolutionPct >= 0 ? 'var(--color-success)' : 'var(--color-error)'}
                          fontSize={11}
                          fontWeight={700}
                        >
                          {text}
                        </text>
                      )
                    }}
                  />
                  {monthlyHistory.map((entry, i) => (
                    <Cell key={`history-${i}`} fill={entry.amount > entry.budget ? 'var(--color-error)' : 'var(--primary-500)'} fillOpacity={i === monthlyHistory.length - 1 ? 1 : 0.42} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
              Évolutions 3 derniers mois
            </p>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
        style={{ display: 'grid', gap: 'var(--space-4)' }}
      >
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
            <KpiCard label="Budget" value={Math.floor(periodBudget)} format="currency" className="rounded-none bg-transparent p-0 shadow-none [&>p:nth-of-type(2)]:text-[var(--font-size-md)]" />
          </div>
          <div style={{ paddingRight: 'var(--space-4)', borderRight: '1px solid var(--neutral-200)' }}>
            <KpiCard label="Dépensé" value={Math.floor(periodSpent)} format="currency" color="negative" className="rounded-none bg-transparent p-0 shadow-none [&>p:nth-of-type(2)]:text-[var(--font-size-md)]" />
          </div>
          <div style={{ paddingRight: 'var(--space-4)', borderRight: '1px solid var(--neutral-200)' }}>
            <KpiCard
              label="%"
              value={chartRatioPct}
              format="number"
              deltaLabel={`${chartRatioPct > 0 ? '+' : ''}${chartRatioPct.toFixed(1)}%`}
              color={chartRatioPct > 100 ? 'negative' : chartRatioPct >= 80 ? 'warning' : 'positive'}
              className="rounded-none bg-transparent p-0 shadow-none [&>p:nth-of-type(2)]:text-[var(--font-size-md)]"
            />
          </div>
          <div>
            <KpiCard label="Restant" value={Math.floor(periodRemaining)} format="currency" color={periodRemaining >= 0 ? 'positive' : 'negative'} className="rounded-none bg-transparent p-0 shadow-none [&>p:nth-of-type(2)]:text-[var(--font-size-md)]" />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
        style={{ margin: '0 calc(-1 * var(--space-6))' }}
      >
        <div style={{ padding: '0 var(--space-6) var(--space-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Sous-catégories
          </p>
          <button
            type="button"
            onClick={() => setShowAnalyseModal(true)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              color: 'var(--primary-500)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Analyse
          </button>
        </div>

        {selectedCat === 'all' ? (
          <div style={{ textAlign: 'center', color: 'var(--neutral-400)', padding: 'var(--space-12) var(--space-6)' }}>
            Sélectionnez une catégorie pour voir ses sous-catégories
          </div>
        ) : subCategoryRows.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--neutral-400)', padding: 'var(--space-12) var(--space-6)' }}>
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

      {/* ── Analyse Modal ────────────────────────────────────── */}
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
        onClose={() => setSelectedSubCategory(null)}
        title={subCategoryModalTitle}
        transactions={subCategoryTransactions ?? []}
        loading={loadingSubCategoryTransactions}
      />

      {/* ── Sheets ───────────────────────────────────────────── */}
      <CustomPeriodSheet
        open={showCustomSheet}
        value={customState}
        onClose={() => setShowCustomSheet(false)}
        onApply={(v) => { setCustomState(v); setPeriodKey('custom') }}
      />
      <CategorySheet
        open={showCatSheet}
        selectedId={selectedCat}
        categories={rootExpenseCategories}
        onClose={() => setShowCatSheet(false)}
        onSelect={setSelectedCat}
      />

      {/* Spinner keyframe for loading state */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
