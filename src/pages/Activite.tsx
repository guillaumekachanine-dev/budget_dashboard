import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { getCurrentPeriod, getMonthLabel, formatCurrency } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import { CategoryIcon } from '@/components/ui/CategoryIcon'

type Period = 'this_month' | 'last_month' | 'last_3' | 'ytd'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'this_month', label: 'Ce mois' },
  { value: 'last_month', label: 'Mois préc.' },
  { value: 'last_3',     label: '3 mois' },
  { value: 'ytd',        label: 'Année' },
]

const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function periodToRange(p: Period, year: number, month: number) {
  switch (p) {
    case 'this_month':
      return {
        startDate: new Date(year, month - 1, 1).toISOString().slice(0, 10),
        endDate:   new Date(year, month, 0).toISOString().slice(0, 10),
      }
    case 'last_month':
      return {
        startDate: new Date(year, month - 2, 1).toISOString().slice(0, 10),
        endDate:   new Date(year, month - 1, 0).toISOString().slice(0, 10),
      }
    case 'last_3':
      return {
        startDate: new Date(year, month - 4, 1).toISOString().slice(0, 10),
        endDate:   new Date(year, month, 0).toISOString().slice(0, 10),
      }
    case 'ytd':
      return {
        startDate: `${year}-01-01`,
        endDate:   new Date().toISOString().slice(0, 10),
      }
  }
}

function groupByDay(txns: ReturnType<typeof useTransactions>['data']) {
  const groups: Record<string, NonNullable<typeof txns>> = {}
  for (const t of txns ?? []) {
    const d = t.transaction_date
    if (!groups[d]) groups[d] = []
    groups[d].push(t)
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
}

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const today    = new Date(); today.setHours(0,0,0,0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.getTime() === today.getTime())     return 'Aujourd\'hui'
  if (d.getTime() === yesterday.getTime()) return 'Hier'
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`
}

export function Activite() {
  const { year, month } = getCurrentPeriod()

  const [period, setPeriod]                 = useState<Period>('this_month')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [excludeRecurring, setExcludeRecurring] = useState(false)
  const [search, setSearch]                 = useState('')
  const [showFilters, setShowFilters]       = useState(false)

  const range = periodToRange(period, year, month)
  const { data: categories } = useCategories('expense')
  const { data: txns, isLoading } = useTransactions({
    ...range,
    flowType: 'expense',
    categoryId: selectedCategory !== 'all' ? selectedCategory : undefined,
  })

  const filtered = useMemo(() => {
    let list = txns ?? []
    if (excludeRecurring) list = list.filter((t) => !t.is_recurring)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((t) =>
        (t.normalized_label ?? t.raw_label ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [txns, excludeRecurring, search])

  const total = filtered.reduce((s, t) => s + Number(t.amount), 0)
  const groups = groupByDay(filtered)

  const hasActiveFilters = selectedCategory !== 'all' || excludeRecurring

  return (
    <div className="flex flex-col gap-0 pb-nav" style={{ minHeight: '100dvh' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ padding: '28px 20px 0' }}
      >
        <p style={{
          fontSize: 11, fontWeight: 500, color: 'var(--neutral-400)',
          textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 4,
        }}>
          {getMonthLabel(year, month)}
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--neutral-900)', letterSpacing: '-0.4px', margin: 0 }}>
          Activité
        </h1>
      </motion.div>

      {/* ── Period tabs ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.08 }}
        style={{ padding: '16px 20px 0', display: 'flex', gap: 6, alignItems: 'center' }}
      >
        <div className="tab-group" style={{ flex: 1 }}>
          {PERIOD_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              className={`tab-item${period === value ? ' active' : ''}`}
              onClick={() => setPeriod(value)}
              style={{ flex: 1, textAlign: 'center', padding: '7px 10px' }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            width: 36, height: 36,
            borderRadius: 'var(--radius-md)',
            background: hasActiveFilters ? 'var(--primary-500)' : 'var(--neutral-100)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: hasActiveFilters ? '#fff' : 'var(--neutral-500)',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
        >
          <SlidersHorizontal size={15} />
        </button>
      </motion.div>

      {/* ── Search bar ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.12 }}
        style={{ padding: '12px 20px 0' }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--neutral-100)',
          borderRadius: 'var(--radius-full)',
          padding: '0 14px',
          height: 40,
        }}>
          <Search size={15} color="var(--neutral-400)" />
          <input
            type="text"
            placeholder="Rechercher une opération…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              fontSize: 13, color: 'var(--neutral-700)',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <X size={14} color="var(--neutral-400)" />
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Filter panel (collapsible) ──────────────────────────── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden', padding: '12px 20px 0' }}
          >
            <div style={{
              background: 'var(--neutral-0)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-card)',
              padding: '14px 16px',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>

              {/* Category filter */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                  Catégorie
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[{ id: 'all', icon_name: null, name: 'Toutes' }, ...(categories ?? [])].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 'var(--radius-full)',
                        border: 'none', cursor: 'pointer',
                        fontSize: 12, fontWeight: 500,
                        background: selectedCategory === cat.id ? 'var(--primary-500)' : 'var(--neutral-100)',
                        color: selectedCategory === cat.id ? '#fff' : 'var(--neutral-600)',
                        transition: 'all 0.15s',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {cat.id === 'all' ? (
                          <span aria-hidden="true">✨</span>
                        ) : (
                          <CategoryIcon categoryName={cat.name} size={14} fallback={null} />
                        )}
                        {cat.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle recurring */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--neutral-700)' }}>Exclure les récurrentes</span>
                <button
                  onClick={() => setExcludeRecurring(!excludeRecurring)}
                  style={{
                    width: 40, height: 22,
                    borderRadius: 'var(--radius-full)',
                    background: excludeRecurring ? 'var(--primary-500)' : 'var(--neutral-200)',
                    border: 'none', cursor: 'pointer',
                    position: 'relative', transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2,
                    left: excludeRecurring ? 18 : 2,
                    width: 18, height: 18,
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                    transition: 'left 0.2s',
                    display: 'block',
                  }} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Summary bar ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.16 }}
        style={{ padding: '12px 20px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span style={{ fontSize: 12, color: 'var(--neutral-400)' }}>
          {filtered.length} opération{filtered.length > 1 ? 's' : ''}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--color-negative)' }}>
          {filtered.length > 0 ? `−${formatCurrency(total)}` : '—'}
        </span>
      </motion.div>

      {/* ── Transaction list ─────────────────────────────────────── */}
      <div style={{ padding: '0 20px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ textAlign: 'center', padding: '48px 0', color: 'var(--neutral-400)' }}
          >
            <p style={{ fontSize: 32, marginBottom: 8 }}>🔍</p>
            <p style={{ fontSize: 14 }}>Aucune opération trouvée</p>
          </motion.div>
        ) : (
          groups.map(([day, dayTxns], gi) => (
            <motion.div
              key={day}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * gi, duration: 0.3 }}
            >
              {/* Day header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 0 6px',
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  {formatDayLabel(day)}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--neutral-400)' }}>
                  −{formatCurrency(dayTxns.reduce((s, t) => s + Number(t.amount), 0))}
                </span>
              </div>

              {/* Transactions */}
              <div style={{
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-card)',
                overflow: 'hidden',
              }}>
                {dayTxns.map((t, ti) => {
                  const label = t.normalized_label ?? t.raw_label ?? 'Opération'

                  return (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px',
                        borderBottom: ti < dayTxns.length - 1 ? '1px solid var(--neutral-100)' : 'none',
                      }}
                    >
                      <div style={{
                        width: 38, height: 38,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <CategoryIcon categoryName={t.category?.name} size={20} fallback="💳" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--neutral-700)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {label}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--neutral-300)', margin: '2px 0 0' }}>
                          {t.category?.name ?? 'Non catégorisé'}{t.is_recurring ? ' · 🔁' : ''}
                        </p>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--color-negative)', flexShrink: 0 }}>
                        −{formatCurrency(Number(t.amount))}
                      </span>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
