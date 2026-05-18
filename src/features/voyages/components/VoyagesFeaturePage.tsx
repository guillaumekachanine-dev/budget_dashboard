import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, MapPin, Trophy, Calendar, TrendingUp } from 'lucide-react'
import { useVoyagesData } from '../hooks/useVoyagesData'
import type { TripWithStats } from '../types'

// ─── constants ────────────────────────────────────────────────────────────────

const TRIP_COLORS = [
  '#F59E0B', '#10B981', '#6366F1', '#EC4899', '#14B8A6',
  '#F97316', '#8B5CF6', '#06B6D4', '#84CC16', '#EF4444',
]

const MONTH_NAMES_SHORT = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

// ─── helpers ──────────────────────────────────────────────────────────────────

function tripColor(index: number): string {
  return TRIP_COLORS[index % TRIP_COLORS.length]
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n)) + ' €'
}

// ─── sub-components ───────────────────────────────────────────────────────────

function KpiChip({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{
      border: '1px solid var(--neutral-200)',
      background: 'var(--neutral-0)',
      borderRadius: 'var(--radius-md)',
      padding: '6px var(--space-3)',
      display: 'grid',
      justifyItems: 'center',
      gap: 2,
    }}>
      <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: mono ? 'var(--font-mono)' : undefined, color: 'var(--neutral-900)', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  )
}

function CategoryBar({ name, amount, pct, color }: { name: string; amount: number; pct: number; color: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', alignItems: 'center', gap: 'var(--space-2)' }}>
      <span style={{ fontSize: 11, color: 'var(--neutral-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {name}
      </span>
      <div style={{ height: 7, borderRadius: 'var(--radius-full)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.max(4, Math.min(pct, 100))}%`,
          height: '100%',
          borderRadius: 'var(--radius-full)',
          background: color,
        }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--neutral-700)', whiteSpace: 'nowrap' }}>
        {formatAmount(amount)}
      </span>
    </div>
  )
}

function TripCard({ item, index, isLast }: { item: TripWithStats; index: number; isLast: boolean }) {
  const color = tripColor(index)
  const dateRange = `${formatDateShort(item.trip.start_date)} → ${formatDate(item.trip.end_date)}`
  const rankLabel = item.hasData ? `#${item.rankByAvgPerDay} /jour` : null
  const maxCatAmount = item.byCategory[0]?.amount ?? 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      style={{
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--neutral-0)',
        overflow: 'hidden',
        marginBottom: isLast ? 0 : 'var(--space-3)',
      }}
    >
      {/* header strip */}
      <div style={{
        background: color,
        padding: '10px var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>{item.trip.emoji ?? '✈️'}</span>
          <div>
            <p style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'rgba(255,255,255,0.97)', lineHeight: 1.1 }}>
              {item.trip.name}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3, marginTop: 2 }}>
              {dateRange} · {item.duration} jour{item.duration > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {rankLabel && (
          <div style={{
            background: 'rgba(255,255,255,0.22)',
            borderRadius: 'var(--radius-full)',
            padding: '3px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <Trophy size={11} color="rgba(255,255,255,0.9)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-mono)' }}>
              {rankLabel}
            </span>
          </div>
        )}
      </div>

      {/* body */}
      <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
        {!item.hasData ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-3) 0', color: 'var(--neutral-400)', fontSize: 'var(--font-size-sm)' }}>
            <MapPin size={16} style={{ marginBottom: 4, display: 'block', margin: '0 auto 6px' }} />
            Aucune dépense catégorisée «&nbsp;Voyages&nbsp;» sur cette période.<br />
            <span style={{ fontSize: 11 }}>Assigne des dépenses manuellement via le détail de transaction.</span>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <KpiChip label="Total" value={formatAmount(item.total)} mono />
              <KpiChip label="Moy./jour" value={formatAmount(item.avgPerDay)} mono />
              <KpiChip label="Dépenses" value={String(item.txCount)} />
            </div>

            {/* subcategory breakdown */}
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              {item.byCategory.map((cat) => (
                <CategoryBar
                  key={cat.categoryId}
                  name={cat.categoryName}
                  amount={cat.amount}
                  pct={maxCatAmount > 0 ? (cat.amount / maxCatAmount) * 100 : 0}
                  color={color}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}

function RankingRow({ item, index, maxAvg }: { item: TripWithStats; index: number; maxAvg: number }) {
  const color = tripColor(index)
  const barWidth = maxAvg > 0 && item.avgPerDay > 0 ? (item.avgPerDay / maxAvg) * 100 : 0

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '20px 1fr auto',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: '8px 0',
      borderBottom: '1px solid var(--neutral-100)',
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-400)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
        {item.hasData ? item.rankByAvgPerDay : '—'}
      </span>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>{item.trip.emoji ?? '✈️'}</span>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-900)' }}>
            {item.trip.name}
          </span>
          <span style={{ fontSize: 10, color: 'var(--neutral-400)' }}>
            {formatDateShort(item.trip.start_date)} · {item.duration}j
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 'var(--radius-full)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
          <div style={{
            width: `${barWidth}%`,
            height: '100%',
            borderRadius: 'var(--radius-full)',
            background: color,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {item.hasData ? (
          <>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)' }}>
              {formatAmount(item.avgPerDay)}<span style={{ color: 'var(--neutral-400)', fontWeight: 400 }}>/j</span>
            </p>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>
              {formatAmount(item.total)} total
            </p>
          </>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--neutral-400)' }}>pas de données</span>
        )}
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  onBack: () => void
}

type ViewMode = 'par-voyage' | 'par-an'

const VOYAGES_ACCENT = '#F59E0B'
const AVAILABLE_YEARS = [2025, 2026] as const

export function VoyagesFeaturePage({ onBack }: Props) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState<number>(currentYear >= 2026 ? 2026 : 2025)
  const [viewMode, setViewMode] = useState<ViewMode>('par-voyage')

  const { tripsWithStats, yearlyStats, isLoading } = useVoyagesData(year)

  const sortedByAvg = useMemo(
    () => [...tripsWithStats].sort((a, b) => b.avgPerDay - a.avgPerDay),
    [tripsWithStats],
  )
  const maxAvgPerDay = sortedByAvg[0]?.avgPerDay ?? 1

  const isCurrentYear = year === currentYear
  const ytdNote = isCurrentYear ? ` (YTD — ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })})` : ''

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      style={{ padding: '0 var(--space-6)', maxWidth: 600, margin: '0 auto' }}
    >
      {/* ── header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            type="button"
            onClick={onBack}
            aria-label="Retour"
            style={{
              border: 'none',
              background: VOYAGES_ACCENT,
              color: 'var(--neutral-0)',
              width: 24,
              height: 24,
              minWidth: 24,
              borderRadius: 'var(--radius-full)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={14} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 20 }}>✈️</span>
            <p style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--neutral-900)', lineHeight: 1.1 }}>
              Voyages
            </p>
          </div>
        </div>

        {/* year selector */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--neutral-100)', borderRadius: 'var(--radius-full)', padding: 3 }}>
          {AVAILABLE_YEARS.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              style={{
                border: 'none',
                background: year === y ? 'var(--neutral-0)' : 'transparent',
                color: year === y ? 'var(--neutral-900)' : 'var(--neutral-500)',
                fontWeight: year === y ? 700 : 500,
                fontSize: 'var(--font-size-xs)',
                borderRadius: 'var(--radius-full)',
                padding: '3px 10px',
                cursor: 'pointer',
                boxShadow: year === y ? 'var(--shadow-card)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* ── view mode toggle ── */}
      <div style={{
        display: 'flex',
        gap: 0,
        background: 'var(--neutral-100)',
        borderRadius: 'var(--radius-lg)',
        padding: 3,
        marginBottom: 'var(--space-4)',
      }}>
        {(['par-voyage', 'par-an'] as ViewMode[]).map((mode) => {
          const label = mode === 'par-voyage' ? (
            <><Calendar size={12} style={{ marginRight: 4 }} />Par voyage</>
          ) : (
            <><TrendingUp size={12} style={{ marginRight: 4 }} />Vue annuelle</>
          )
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              style={{
                flex: 1,
                border: 'none',
                background: viewMode === mode ? 'var(--neutral-0)' : 'transparent',
                color: viewMode === mode ? 'var(--neutral-900)' : 'var(--neutral-500)',
                fontWeight: viewMode === mode ? 700 : 500,
                fontSize: 'var(--font-size-xs)',
                borderRadius: 'var(--radius-md)',
                padding: '6px var(--space-3)',
                cursor: 'pointer',
                boxShadow: viewMode === mode ? 'var(--shadow-card)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* ── loading ── */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--neutral-400)', fontSize: 'var(--font-size-sm)' }}>
          Chargement…
        </div>
      )}

      {/* ── par voyage view ── */}
      <AnimatePresence mode="wait">
        {!isLoading && viewMode === 'par-voyage' && (
          <motion.div key="par-voyage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {tripsWithStats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--neutral-400)', fontSize: 'var(--font-size-sm)' }}>
                Aucun voyage enregistré pour {year}.
              </div>
            ) : (
              tripsWithStats.map((item, i) => (
                <TripCard key={item.trip.id} item={item} index={i} isLast={i === tripsWithStats.length - 1} />
              ))
            )}
          </motion.div>
        )}

        {/* ── vue annuelle ── */}
        {!isLoading && viewMode === 'par-an' && (
          <motion.div key="par-an" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>

            {/* year summary card */}
            <div style={{
              border: `1px solid color-mix(in oklab, ${VOYAGES_ACCENT} 40%, transparent)`,
              borderRadius: 'var(--radius-xl)',
              background: `color-mix(in oklab, ${VOYAGES_ACCENT} 6%, var(--neutral-0))`,
              padding: 'var(--space-4)',
              marginBottom: 'var(--space-4)',
            }}>
              <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-700)' }}>
                Bilan {year}{ytdNote}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1 }}>
                    {formatAmount(yearlyStats.total)}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                    Total
                  </p>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid var(--neutral-200)', borderRight: '1px solid var(--neutral-200)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1 }}>
                    {formatAmount(yearlyStats.monthlyAvg)}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                    Moy./mois
                  </p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', lineHeight: 1 }}>
                    {yearlyStats.tripCount}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                    Voyage{yearlyStats.tripCount > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* ranking */}
            <div style={{
              border: '1px solid var(--neutral-200)',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--neutral-0)',
              padding: 'var(--space-3) var(--space-4)',
            }}>
              <p style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--neutral-900)' }}>
                Classement par coût journalier
              </p>
              {sortedByAvg.map((item) => (
                <RankingRow
                  key={item.trip.id}
                  item={item}
                  index={tripsWithStats.findIndex((t) => t.trip.id === item.trip.id)}
                  maxAvg={maxAvgPerDay}
                />
              ))}
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* bottom spacer */}
      <div style={{ height: 'var(--space-6)' }} />
    </motion.div>
  )
}
