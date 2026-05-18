import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useCategories } from '@/hooks/useCategories'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { Annual2026BlockMetrics } from '@/features/annual-analysis/components/Annual2026BlockMetrics'
import type { MetricsScopeSelection } from '@/features/annual-analysis/components/Annual2026BlockMetrics'
import { MonthlyFlowsAnalysisCard } from '@/features/annual-analysis/components/Annual2026MonthlyTable'
import { useCategoryRolling12mStats } from '@/features/budget/hooks/useCategoryRolling12mStats'
import { categoryColorFromName, todayIso } from '@/lib/utils'
import budgetsPeriodIcon from '@/assets/icons/app/budgets_period.webp'

// ─── constants ────────────────────────────────────────────────────────────────

const ALL_CAT_ID = 'all_categories'
const MONTHS_FR_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const MONTHS_FR_SHORT = ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']
const DISPLAY_MODES = ['Métriques', 'Historique', 'Flux mensuels'] as const
type DisplayModeIdx = 0 | 1 | 2

// ─── helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0') }

function getPeriodRange(year: number, month: number) {
  const now = new Date()
  const today = todayIso()
  const startDate = `${year}-${pad2(month)}-01`
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  if (isCurrentMonth) return { startDate, endDate: today }
  const end = new Date(year, month, 0)
  return { startDate, endDate: `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}` }
}

// ─── main component ───────────────────────────────────────────────────────────

export function ProjectionsTab() {
  const { data: categories = [] } = useCategories()

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const [selectedCatId, setSelectedCatId] = useState<string>(ALL_CAT_ID)
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [displayMode, setDisplayMode] = useState<DisplayModeIdx>(0)

  const [showCatModal, setShowCatModal] = useState(false)
  const [showMonthModal, setShowMonthModal] = useState(false)
  const [modalPickerYear, setModalPickerYear] = useState(currentYear)

  const { data: rollingStats = [] } = useCategoryRolling12mStats()

  const parentCategories = useMemo(
    () => categories.filter((c) => c.parent_id === null).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [categories],
  )

  const selectedCategory = useMemo(
    () => (selectedCatId === ALL_CAT_ID ? null : categories.find((c) => c.id === selectedCatId) ?? null),
    [selectedCatId, categories],
  )

  const scopeSelection = useMemo<MetricsScopeSelection>(
    () => ({ kind: 'categorie', id: selectedCatId }),
    [selectedCatId],
  )

  const accentColor = selectedCategory ? categoryColorFromName(selectedCategory.name) : 'var(--primary-500)'
  const period = MONTHS_FR_FULL[month - 1]
  const monthLabel = `${MONTHS_FR_FULL[month - 1]} ${String(year).slice(2)}`
  const catLabel = selectedCategory?.name ?? 'Toutes catégories'
  const modeName = DISPLAY_MODES[displayMode]

  function isMonthDisabled(y: number, m: number) {
    return y === currentYear && m > currentMonth
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

      {/* ── top: two selector buttons ── */}
      <div style={{ padding: '0 var(--page-gutter)', display: 'flex', gap: 'var(--space-2)' }}>

        {/* category button */}
        <button
          type="button"
          onClick={() => { setShowCatModal(true); setShowMonthModal(false) }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            border: '1px solid var(--neutral-200)',
            background: 'var(--neutral-0)',
            borderRadius: 'var(--radius-md)',
            padding: '8px var(--space-3)',
            minHeight: 44,
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {selectedCategory ? (
            <CategoryIcon iconKey={selectedCategory.icon_key} label={selectedCategory.name} size={18} />
          ) : (
            <span style={{ fontSize: 16, lineHeight: 1 }}>📊</span>
          )}
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110, lineHeight: 1.1 }}>
            {catLabel}
          </span>
          <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid var(--neutral-400)', position: 'absolute', right: 10 }} />
        </button>

        {/* period button */}
        <button
          type="button"
          onClick={() => { setModalPickerYear(year); setShowMonthModal(true); setShowCatModal(false) }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            border: '1px solid var(--neutral-200)',
            background: 'var(--neutral-0)',
            borderRadius: 'var(--radius-md)',
            padding: '8px var(--space-3)',
            minHeight: 44,
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <img src={budgetsPeriodIcon} alt="" width={18} height={18} style={{ objectFit: 'contain', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-700)', whiteSpace: 'nowrap', lineHeight: 1.1 }}>
            {monthLabel}
          </span>
          <span style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid var(--neutral-400)', position: 'absolute', right: 10 }} />
        </button>
      </div>

      {/* ── section title (icon + mode name) ── */}
      <div style={{ padding: '0 var(--page-gutter)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {selectedCategory ? (
          <CategoryIcon iconKey={selectedCategory.icon_key} label={selectedCategory.name} size={22} />
        ) : (
          <span style={{ fontSize: 18, lineHeight: 1 }}>📊</span>
        )}
        <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--neutral-900)', letterSpacing: '-0.01em' }}>
          {modeName}
        </h3>
      </div>

      {/* ── fixed-height content section ── */}
      <div style={{ height: 300, overflow: 'hidden', position: 'relative' }}>
        {displayMode === 0 && (
          <div style={{ padding: '0 var(--space-4)', height: '100%', overflow: 'hidden' }}>
            <Annual2026BlockMetrics
              hideParameterRow
              scopeSelection={scopeSelection}
              visualAccentColor={accentColor}
              period={period}
              displayMode="tableau"
              rollingStats={rollingStats}
            />
          </div>
        )}
        {displayMode === 1 && (
          <Annual2026BlockMetrics
            hideParameterRow
            scopeSelection={scopeSelection}
            visualAccentColor={accentColor}
            period={period}
            displayMode="graphique"
            rollingStats={rollingStats}
          />
        )}
        {displayMode === 2 && (
          <div style={{ padding: '0 var(--space-4)', height: '100%', overflow: 'hidden' }}>
            <MonthlyFlowsAnalysisCard
              year={year}
              forcedView="table"
              showInternalViewToggle={false}
              variant="embedded"
              scopeSelection={scopeSelection}
            />
          </div>
        )}
      </div>

      {/* ── dot navigator ── */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-2)' }}>
        {DISPLAY_MODES.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setDisplayMode(idx as DisplayModeIdx)}
            aria-label={`Afficher ${DISPLAY_MODES[idx]}`}
            style={{
              minWidth: 'var(--touch-target-min)',
              minHeight: 'var(--touch-target-min)',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              padding: 0,
              background: 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all var(--transition-base)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: idx === displayMode ? 14 : 8,
                height: idx === displayMode ? 14 : 8,
                borderRadius: 'var(--radius-full)',
                background: idx === displayMode ? 'var(--primary-500)' : 'var(--neutral-300)',
                transition: 'all var(--transition-base)',
              }}
            />
          </button>
        ))}
      </div>

      {/* ── category picker modal ── */}
      <AnimatePresence>
        {showCatModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCatModal(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Sélectionner une catégorie"
              initial={{ scale: 0.94, opacity: 0, y: '-50%' }}
              animate={{ scale: 1, opacity: 1, y: '-50%' }}
              exit={{ scale: 0.94, opacity: 0, y: '-50%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: 'var(--page-gutter)',
                right: 'var(--page-gutter)',
                top: '50%',
                zIndex: 61,
                maxWidth: 340,
                maxHeight: '78vh',
                overflowY: 'auto',
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-2xl)',
                padding: 'var(--space-4)',
                boxShadow: '0 8px 40px rgba(13,13,31,0.18)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--neutral-900)' }}>Catégorie</p>
                <button
                  type="button"
                  onClick={() => setShowCatModal(false)}
                  style={{ border: 'none', background: 'var(--neutral-100)', color: 'var(--neutral-600)', width: 32, height: 32, borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* "Toutes" row */}
              <button
                type="button"
                onClick={() => { setSelectedCatId(ALL_CAT_ID); setDisplayMode(0); setShowCatModal(false) }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px var(--space-2)',
                  marginBottom: 'var(--space-2)',
                  border: selectedCatId === ALL_CAT_ID ? '2px solid var(--primary-600)' : '1px solid var(--neutral-200)',
                  borderRadius: 'var(--radius-md)',
                  background: selectedCatId === ALL_CAT_ID ? 'color-mix(in oklab, var(--primary-600) 8%, var(--neutral-0) 92%)' : 'var(--neutral-50)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1, width: 32, textAlign: 'center' }}>📊</span>
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: selectedCatId === ALL_CAT_ID ? 800 : 600, color: selectedCatId === ALL_CAT_ID ? 'var(--primary-700)' : 'var(--neutral-800)' }}>
                  Toutes catégories
                </span>
              </button>

              {/* category grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 6 }}>
                {parentCategories.map((cat) => {
                  const isSelected = cat.id === selectedCatId
                  return (
                    <motion.button
                      key={cat.id}
                      type="button"
                      whileHover={{ scale: 1.07 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setSelectedCatId(cat.id); setDisplayMode(0); setShowCatModal(false) }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 3,
                        padding: '4px 2px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <CategoryIcon iconKey={cat.icon_key} label={cat.name} size={30} />
                      <span style={{
                        fontSize: 10,
                        fontWeight: isSelected ? 800 : 600,
                        color: isSelected ? 'var(--primary-700)' : 'var(--neutral-700)',
                        lineHeight: 1.1,
                        textAlign: 'center',
                        whiteSpace: 'normal',
                        maxWidth: '100%',
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
              initial={{ scale: 0.94, opacity: 0, y: '-50%' }}
              animate={{ scale: 1, opacity: 1, y: '-50%' }}
              exit={{ scale: 0.94, opacity: 0, y: '-50%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: 'var(--page-gutter)',
                right: 'var(--page-gutter)',
                top: '50%',
                zIndex: 61,
                maxWidth: 320,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-2xl)',
                padding: 'var(--space-4)',
                boxShadow: '0 8px 40px rgba(13,13,31,0.18)',
              }}
            >
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
    </div>
  )
}
