import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, X } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import { useBudgetSummaries } from '@/hooks/useBudgets'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { getCurrentPeriod, formatCurrency, formatCompact, clamp } from '@/lib/utils'
import { debugBudgetSupabaseConnection } from '@/debug/debugBudgetSupabase'
import { supabase } from '@/lib/supabase'
import type { Category } from '@/lib/types'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { BudgetAnalyticsPanel } from '@/features/budget/components/BudgetAnalyticsPanel'

// ─── Types ────────────────────────────────────────────────────────────────────
type PeriodKey    = 'semaine' | 'mois' | 'annee' | 'custom'
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
  threeMonthAvg: number
  trend: SubCatTrend
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
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
  const range = getPeriodRange(key, custom)
  return (monthlyBudget / daysInMonth) * getDaysBetween(range.startDate, range.endDate)
}

function getRingColor(pct: number): string {
  if (pct <= 80)  return '#2ED47A'
  if (pct <= 100) return '#FFAB2E'
  return '#FC5A5A'
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
    case 'annee':
      return `Année ${new Date().getFullYear()}`
    case 'custom':
      return custom.mode === 'fixed'
        ? `${fmtDayShort(custom.startDate)} → ${fmtDayShort(custom.endDate)}`
        : `Derniers ${custom.rollingDays}j`
  }
}

const MONTHS_FR_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

// ─── DonutRing ────────────────────────────────────────────────────────────────
function DonutRing({ pct, color, size = 230 }: { pct: number; color: string; size?: number }) {
  const sw   = 22
  const r    = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const off  = circ * (1 - clamp(pct, 0, 100) / 100)

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block', flexShrink: 0 }}>
      {/* Track */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--neutral-100)" strokeWidth={sw} />
      {/* Progress */}
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: off }}
        transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
      />
    </svg>
  )
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
    fontFamily: 'var(--font-sans)', outline: 'none', background: '#fff',
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
              background: '#fff', borderRadius: '24px 24px 0 0',
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
                  color:      draft.mode === m ? '#fff' : 'var(--neutral-500)',
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
              fontFamily: 'var(--font-sans)', background: 'var(--primary-500)', color: '#fff',
              boxShadow: '0 4px 16px rgba(91,87,245,0.3)',
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

// ─── KPI Card ─────────────────────────────────────────────────────────────────
interface KPICardProps {
  monthlyBudget:  number   // enveloppe allouée
  currentSpent:   number   // consommé ce mois
  recurringSpent: number   // opérations planifiées / récurrentes
  projectedEOM:   number   // projection fin de mois
}

function KPICard({ monthlyBudget, currentSpent, recurringSpent, projectedEOM }: KPICardProps) {
  const remaining   = monthlyBudget - currentSpent
  const isOver      = remaining < 0

  const projRatio   = monthlyBudget > 0 ? projectedEOM / monthlyBudget : 0
  const projColor   = projRatio <= 0.80 ? '#2ED47A' : projRatio <= 1.00 ? '#FFAB2E' : '#FC5A5A'

  const colLabel: React.CSSProperties = {
    margin: '0 0 5px', fontSize: 10, opacity: 0.55,
    textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600,
  }
  const colValue: React.CSSProperties = {
    margin: 0, fontFamily: 'var(--font-mono)', fontSize: 21,
    fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1,
  }

  return (
    <div style={{
      background: 'linear-gradient(142deg, var(--primary-400) 0%, var(--primary-700) 100%)',
      borderRadius: 'var(--radius-2xl)', padding: '18px 20px',
      color: '#fff', position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative circles */}
      <div style={{ position: 'absolute', right: -30, top: -38, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 40, bottom: -48, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Section label */}
        <p style={{ margin: '0 0 14px', fontSize: 10, opacity: 0.58, textTransform: 'uppercase', letterSpacing: '1.8px', fontWeight: 600 }}>
          Budget mensuel
        </p>

        {/* ── ROW 1 : Enveloppe | Disponible / Dépassement ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <p style={colLabel}>Enveloppe</p>
            <p style={colValue}>{formatCurrency(monthlyBudget)}</p>
          </div>

          {/* Vertical separator */}
          <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.18)', margin: '0 20px', flexShrink: 0 }} />

          <div style={{ flex: 1 }}>
            <p style={colLabel}>{isOver ? 'Dépassement' : 'Disponible'}</p>
            <p style={{ ...colValue, color: isOver ? '#FC5A5A' : '#2ED47A' }}>
              {isOver ? '−' : '+'}{formatCurrency(Math.abs(remaining))}
            </p>
          </div>
        </div>

        {/* Horizontal divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.14)', margin: '16px 0' }} />

        {/* ── ROW 2 : Planifié | Projection EOM ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <p style={colLabel}>Planifié ce mois</p>
            <p style={{ ...colValue, fontSize: 18 }}>
              {recurringSpent > 0 ? formatCurrency(recurringSpent) : '—'}
            </p>
          </div>

          {/* Vertical separator */}
          <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.18)', margin: '0 20px', flexShrink: 0 }} />

          <div style={{ flex: 1 }}>
            <p style={colLabel}>Projection EOM</p>
            <p style={{ ...colValue, fontSize: 18, color: projColor }}>
              {formatCurrency(projectedEOM)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-categories Section ───────────────────────────────────────────────────
interface SubCategoriesSectionProps {
  rows: SubCategoryTrendItem[]
  onAnalyseClick: () => void
}

function getTrendVisual(trend: SubCatTrend): { symbol: string; color: string } {
  if (trend === 'down') return { symbol: '↓', color: 'var(--color-positive)' }
  if (trend === 'up') return { symbol: '↑', color: 'var(--color-negative)' }
  return { symbol: '=', color: '#8B6A3C' }
}

function SubCategoriesSection({ rows, onAnalyseClick }: SubCategoriesSectionProps) {
  return (
    <div style={{
      background: 'var(--neutral-0)',
      borderRadius: 'var(--radius-2xl)',
      boxShadow: 'var(--shadow-card)',
      padding: '16px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--neutral-600)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Sous-catégories
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--neutral-400)' }}>
            Tri décroissant · mois en cours
          </p>
        </div>
        <button
          onClick={onAnalyseClick}
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.2px',
            color: 'var(--primary-500)',
            background: 'var(--primary-50)',
            padding: '5px 12px',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Analyse
        </button>
      </div>

      {rows.length > 0 ? (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto 20px',
            gap: 8,
            paddingBottom: 6,
            borderBottom: '1px solid var(--neutral-100)',
          }}>
            <span style={{ fontSize: 10, color: 'var(--neutral-400)' }}>Nom</span>
            <span style={{ fontSize: 10, color: 'var(--neutral-400)', textAlign: 'right' }}>Mois</span>
            <span style={{ fontSize: 10, color: 'var(--neutral-400)', textAlign: 'right' }}>Moy. 3m</span>
            <span style={{ fontSize: 10, color: 'var(--neutral-400)', textAlign: 'center' }}>T</span>
          </div>
          {rows.map((row, i) => {
            const trendVisual = getTrendVisual(row.trend)
            return (
              <div
                key={row.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto 20px',
                  gap: 8,
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: i < rows.length - 1 ? '1px solid var(--neutral-100)' : 'none',
                }}
              >
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--neutral-700)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {row.name}
                </span>
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--neutral-800)',
                  textAlign: 'right',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {formatCurrency(row.currentMonthAmount)}
                </span>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--neutral-500)',
                  textAlign: 'right',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {formatCurrency(row.threeMonthAvg)}
                </span>
                <span style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: trendVisual.color,
                  textAlign: 'center',
                  lineHeight: 1,
                }}>
                  {trendVisual.symbol}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--neutral-400)', margin: '0 0 4px' }}>Aucune sous-catégorie</p>
          <p style={{ fontSize: 11, color: 'var(--neutral-300)', fontStyle: 'italic', margin: 0 }}>
            Aucune dépense sous-catégorisée sur la période
          </p>
        </div>
      )}
    </div>
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
      background: 'var(--primary-600, #4844d4)',
      borderRadius: 'var(--radius-md)',
      padding: '5px 11px',
      boxShadow: '0 4px 14px rgba(91,87,245,0.35)',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#fff' }}>
        {formatCurrency(payload[0].value)}
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
        color:      isFirst ? '#fff'                : 'var(--neutral-400)',
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
          {formatCurrency(data.total)}
        </p>
        {data.topTx && (
          <p style={{ margin: '3px 0 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--neutral-400)' }}>
            max {formatCurrency(data.topTx.amount)}
          </p>
        )}
      </div>
    </div>
  )
}

function formatBarLabel(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  return formatCompact(value)
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
                      {monthlyAvg > 0 ? formatCurrency(monthlyAvg) : '—'}
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
                              ? '#FC5A5A'
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

// ─── Main Page ────────────────────────────────────────────────────────────────
const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  { key: 'semaine', label: 'Semaine' },
  { key: 'mois',    label: 'Mois'    },
  { key: 'annee',   label: 'Année'   },
  { key: 'custom',  label: 'Définir' },
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

  useEffect(() => {
    if (import.meta.env.DEV) {
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

  const range = useMemo(
    () => getPeriodRange(periodKey, customState),
    [periodKey, customState],
  )

  // Transactions for the donut (selected period + optional category filter)
  const catFilter = selectedCat !== 'all' ? selectedCat : undefined
  const { data: periodTxns, isLoading: loadingPeriod } = useTransactions({
    ...range, flowType: 'expense', categoryId: catFilter,
  })

  // Last 3 full months for the KPI average
  const threeMonthStart = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10)
  const lastMonthEnd    = new Date(now.getFullYear(), now.getMonth(),    0).toISOString().slice(0, 10)
  const { data: threeMonthTxns } = useTransactions({
    startDate: threeMonthStart, endDate: lastMonthEnd, flowType: 'expense', categoryId: catFilter,
  })

  // Current month for KPI projection (may be same as periodTxns when key==='mois')
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const { data: currentMonthTxns } = useTransactions({
    startDate: currentMonthStart, endDate: todayStr(), flowType: 'expense', categoryId: catFilter,
  })
  const { data: currentMonthAllExpenseTxns } = useTransactions({
    startDate: currentMonthStart, endDate: todayStr(), flowType: 'expense',
  })
  const threeMonthRollingStart = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10)
  const { data: rollingThreeMonthAllExpenseTxns } = useTransactions({
    startDate: threeMonthRollingStart, endDate: todayStr(), flowType: 'expense',
  })
  const historyStart = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10)
  const { data: historyTxns } = useTransactions({
    startDate: historyStart, endDate: todayStr(), flowType: 'expense', categoryId: catFilter,
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

  const pct       = periodBudget > 0 ? clamp((periodSpent / periodBudget) * 100, 0, 200) : 0
  const ringColor = getRingColor(Math.min(pct, 100))

  // 3-month average per month (last 3 full months)
  const threeMonthAvg = useMemo(() => {
    if (!threeMonthTxns?.length) return 0
    return threeMonthTxns.reduce((s, t) => s + Number(t.amount), 0) / 3
  }, [threeMonthTxns])

  // Current month stats
  const currentSpent = useMemo(
    () => (currentMonthTxns ?? []).reduce((s, t) => s + Number(t.amount), 0),
    [currentMonthTxns],
  )

  // Opérations planifiées = transactions récurrentes du mois en cours
  const recurringSpent = useMemo(
    () => (currentMonthTxns ?? [])
      .filter((t) => t.is_recurring)
      .reduce((s, t) => s + Number(t.amount), 0),
    [currentMonthTxns],
  )

  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed  = now.getDate()
  const projectedEOM = daysElapsed > 0 ? (currentSpent / daysElapsed) * daysInMonth : 0
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

    return visibleSubCategories
      .map((subCat) => {
        const currentMonthAmount = currentMonthByCategory.get(subCat.id) ?? 0
        const threeMonthAvg = (rollingThreeMonthsByCategory.get(subCat.id) ?? 0) / 3

        let trend: SubCatTrend = 'equal'
        if (currentMonthAmount > threeMonthAvg + 0.01) trend = 'up'
        if (currentMonthAmount < threeMonthAvg - 0.01) trend = 'down'

        return {
          id: subCat.id,
          name: subCat.name,
          parentCategoryName: subCat.parent_id ? categoryNameById.get(subCat.parent_id) ?? null : null,
          currentMonthAmount,
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
    rollingThreeMonthAllExpenseTxns,
  ])

  // Monthly history (last 3 months including current month)
  const monthlyHistory = useMemo<MonthlyBucket[]>(() => {
    return [-2, -1, 0].map((offset) => {
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
  }, [historyTxns, totalMonthlyBudget, nowMonth, nowYear])

  // ── Handle period tab click ───────────────────────────────
  const handlePeriodTab = (key: PeriodKey) => {
    if (key === 'custom') {
      setShowCustomSheet(true)
    } else {
      setPeriodKey(key)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 0px))' }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        style={{ padding: '28px 20px 0' }}
      >
        <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 4 }}>
          {getPeriodLabel(periodKey, customState)}
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--neutral-900)', letterSpacing: '-0.4px', margin: 0 }}>Budgets</h1>
      </motion.div>

      {/* ── Period selector ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}
        style={{ padding: '16px 20px 0' }}
      >
        <div style={{
          display: 'flex', background: 'var(--neutral-100)',
          borderRadius: 'var(--radius-full)', padding: 3, gap: 2,
        }}>
          {PERIOD_TABS.map(({ key, label }) => {
            const isActive = key === 'custom' ? periodKey === 'custom' : key === periodKey
            return (
              <button
                key={key}
                onClick={() => handlePeriodTab(key)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 'var(--radius-full)',
                  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
                  background: isActive ? 'var(--primary-500)' : 'transparent',
                  color:      isActive ? '#fff' : 'var(--neutral-400)',
                  boxShadow:  isActive ? '0 2px 8px rgba(91,87,245,0.3)' : 'none',
                }}
              >
                {key === 'custom' && periodKey === 'custom' ? '✦ ' : ''}{label}
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* ── Donut card ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
        style={{
          margin: '16px 20px 0',
          background: 'var(--neutral-0)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-card)',
          padding: '22px 20px 18px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}
      >
        {/* Ring + center text */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Force animation restart on period/category change */}
          <DonutRing key={`${periodKey}-${selectedCat}-${JSON.stringify(customState)}`} pct={pct} color={ringColor} size={210} />

          {/* Center content */}
          <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
            {loadingPeriod ? (
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--neutral-200)', borderTopColor: 'var(--primary-500)', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
            ) : (
              <>
                <motion.p
                  key={periodSpent}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.35 }}
                  style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'clamp(20px, 6vw, 28px)', fontWeight: 700, color: 'var(--neutral-900)', letterSpacing: '-0.5px', lineHeight: 1 }}
                >
                  {formatCurrency(periodSpent)}
                </motion.p>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--neutral-400)', lineHeight: 1.3 }}>
                  Dépensé<br />
                  {getPeriodLabel(periodKey, customState)}
                </p>
                <p style={{
                  margin: '8px 0 0', fontSize: 16, fontWeight: 700,
                  color: ringColor, fontFamily: 'var(--font-mono)',
                }}>
                  {pct.toFixed(0)}%
                </p>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: ringColor }} />
            <span style={{ fontSize: 11, color: 'var(--neutral-500)' }}>Dépensé · {formatCurrency(periodSpent)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--neutral-200)' }} />
            <span style={{ fontSize: 11, color: 'var(--neutral-500)' }}>Budget · {formatCurrency(periodBudget)}</span>
          </div>
        </div>
      </motion.div>

      {/* ── Category picker button ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        style={{ margin: '10px 20px 0' }}
      >
        <button
          onClick={() => setShowCatSheet(true)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--neutral-0)', borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-card)', padding: '14px 18px',
            border: selectedCat !== 'all' ? '1.5px solid var(--primary-300)' : '1.5px solid transparent',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Category icon */}
            {selectedCat === 'all'
              ? <span aria-hidden="true">✨</span>
              : <CategoryIcon categoryName={selectedCatInfo?.name} size={20} fallback="💰" />}
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--neutral-700)' }}>
                {selectedCat === 'all' ? 'Toutes les catégories' : selectedCatInfo?.name ?? 'Catégorie'}
              </p>
              <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--neutral-400)' }}>
                {selectedCat === 'all' ? 'Afficher globalement' : 'Filtré par catégorie'}
              </p>
            </div>
          </div>
          <ChevronDown size={18} color="var(--neutral-400)" />
        </button>
      </motion.div>

      {/* ── KPI Card ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
        style={{ margin: '10px 20px 0' }}
      >
        <KPICard
          monthlyBudget={totalMonthlyBudget}
          currentSpent={currentSpent}
          recurringSpent={recurringSpent}
          projectedEOM={projectedEOM}
        />
      </motion.div>

      {/* ── Sous-catégories ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
        style={{ margin: '10px 20px 0' }}
      >
        <SubCategoriesSection
          rows={subCategoryRows}
          onAnalyseClick={() => setShowAnalyseModal(true)}
        />
      </motion.div>

      {/* ── Budget Analytics (debug panel) ───────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}
        style={{ margin: '10px 20px 0' }}
      >
        <BudgetAnalyticsPanel year={year} />
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
