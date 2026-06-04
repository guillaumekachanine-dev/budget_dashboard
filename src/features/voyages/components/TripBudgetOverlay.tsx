import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { formatCurrencyFloored } from '@/lib/utils'
import { lockDocumentScroll } from '@/lib/scrollLock'
import type { TripExpenseBarsMode, TripExpenseBarsRow } from '@/features/voyages/hooks/useTripExpenseBars'

// Palette with sufficient contrast for white text on colored tiles
const PALETTE = [
  '#0B6CB5',  // deep sky
  '#5553E8',  // indigo
  '#7C3AED',  // violet
  '#B45309',  // amber
  '#047857',  // emerald
  '#DB2777',  // rose
]

interface TripBudgetOverlayProps {
  open: boolean
  onClose: () => void
  mode: TripExpenseBarsMode
  rows: TripExpenseBarsRow[]
  tripName?: string | null
}

type EnvelopeRow = TripExpenseBarsRow & {
  amount: number
  color: string
  index: number
  pct: number
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({
  open,
  onClose,
  tripName,
}: {
  open: boolean
  onClose: () => void
  tripName?: string | null
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="budget-overlay-backdrop-empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 400,
            background: 'rgba(10, 8, 28, 0.62)',
            backdropFilter: 'blur(20px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 20px',
          }}
        >
          <motion.div
            key="budget-overlay-card-empty"
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 14 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 360,
              borderRadius: 26,
              background: 'rgba(255, 252, 245, 0.82)',
              border: '1px solid rgba(255, 255, 255, 0.62)',
              boxShadow: '0 24px 64px rgba(10, 8, 40, 0.22)',
              backdropFilter: 'blur(40px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(40px) saturate(1.5)',
              padding: '28px 24px',
              display: 'grid',
              gap: 10,
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(118, 84, 30, 0.58)' }}>
              Enveloppes voyage
            </p>
            {tripName ? (
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'rgba(35, 24, 12, 0.9)' }}>{tripName}</p>
            ) : null}
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(96, 70, 35, 0.68)', lineHeight: 1.45 }}>
              Aucun budget prévisionnel par poste n'est disponible pour ce voyage.
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                margin: '6px auto 0',
                border: '1px solid rgba(203, 170, 100, 0.35)',
                background: 'rgba(255, 249, 237, 0.72)',
                borderRadius: 20,
                padding: '8px 20px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                color: 'rgba(86, 58, 15, 0.72)',
              }}
            >
              Fermer
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

// ── Mosaic tile ────────────────────────────────────────────────────────────────

function MosaicTile({
  row,
  totalSum,
  mode,
  isSelected,
  isMuted,
  mounted,
  delay,
  onSelect,
}: {
  row: EnvelopeRow
  totalSum: number
  mode: TripExpenseBarsMode
  isSelected: boolean
  isMuted: boolean
  mounted: boolean
  delay: number
  onSelect: () => void
}) {
  const overallPct = totalSum > 0 ? row.amount / totalSum : 0
  const consumedPct =
    mode === 'ongoing' && row.budgetAmount > 0
      ? Math.min(1, row.consumedAmount / row.budgetAmount)
      : 0

  const amountFontSize = overallPct >= 0.28 ? 20 : overallPct >= 0.18 ? 16 : 13
  const showContent = overallPct >= 0.08

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      style={{
        // flex-grow proportional to amount → exact proportional area in treemap
        flex: `${row.amount} 1 0`,
        minHeight: 28,
        background: row.color,
        border: isSelected ? '2.5px solid rgba(255,255,255,0.9)' : '2.5px solid transparent',
        borderRadius: 0,
        cursor: 'pointer',
        padding: showContent ? '9px 11px 10px' : '5px 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        textAlign: 'left',
        overflow: 'hidden',
        position: 'relative',
        opacity: mounted ? (isMuted ? 0.35 : 1) : 0,
        transform: mounted ? 'none' : 'scale(0.9)',
        transition: [
          `opacity 0.28s ease ${delay}ms`,
          `transform 0.42s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
          'border-color 0.14s ease',
        ].join(', '),
      }}
    >
      {/* Category label */}
      <span
        style={{
          fontSize: 8,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          color: 'rgba(255,255,255,0.62)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
          display: 'block',
          lineHeight: 1,
        }}
      >
        {row.name}
      </span>

      {/* Amount + percentage — only when tile is large enough */}
      {showContent ? (
        <div>
          <span
            style={{
              display: 'block',
              fontSize: amountFontSize,
              fontWeight: 900,
              fontFamily: 'var(--font-mono)',
              color: '#ffffff',
              lineHeight: 1,
              letterSpacing: '-0.03em',
            }}
          >
            {formatCurrencyFloored(row.amount)}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: 9,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.5)',
              marginTop: 3,
            }}
          >
            {`${Math.round(overallPct * 100)} %`}
          </span>
        </div>
      ) : null}

      {/* Consumed progress strip — ongoing mode only */}
      {consumedPct > 0 ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: 3,
            width: `${consumedPct * 100}%`,
            background: 'rgba(255,255,255,0.72)',
            borderRadius: '0 1px 0 0',
          }}
        />
      ) : null}
    </button>
  )
}

// ── Mosaic column ──────────────────────────────────────────────────────────────

function MosaicColumn({
  items,
  totalSum,
  mode,
  selected,
  onSelect,
  mounted,
}: {
  items: EnvelopeRow[]
  totalSum: number
  mode: TripExpenseBarsMode
  selected: string | null
  onSelect: (key: string | null) => void
  mounted: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, height: '100%' }}>
      {items.map((row) => (
        <MosaicTile
          key={row.key}
          row={row}
          totalSum={totalSum}
          mode={mode}
          isSelected={selected === row.key}
          isMuted={Boolean(selected) && selected !== row.key}
          mounted={mounted}
          delay={row.index * 52}
          onSelect={() => onSelect(selected === row.key ? null : row.key)}
        />
      ))}
    </div>
  )
}

// ── Mosaic treemap chart ───────────────────────────────────────────────────────
//
// Layout: 2 columns.
// Column 1 holds the top 1–2 items (sorted desc by amount).
// Column 2 holds the rest.
// Column widths are proportional to their respective budget sums.
// Within each column, items stack vertically using flex-grow = amount,
// which gives each tile an area exactly proportional to its budget share.

function BudgetMosaicChart({
  envelopes,
  mode,
  selected,
  onSelect,
  mounted,
}: {
  envelopes: EnvelopeRow[]
  mode: TripExpenseBarsMode
  selected: string | null
  onSelect: (key: string | null) => void
  mounted: boolean
}) {
  const total = envelopes.reduce((s, r) => s + r.amount, 0)
  if (!total || envelopes.length === 0) return null

  // Decide split index
  const splitAt = envelopes.length <= 2 ? 1 : envelopes.length >= 7 ? Math.ceil(envelopes.length / 2) : 2

  const col1 = envelopes.slice(0, splitAt)
  const col2 = envelopes.slice(splitAt)
  const col1Sum = col1.reduce((s, r) => s + r.amount, 0)
  const col1WidthPct = (col1Sum / total) * 100

  return (
    <div
      role="img"
      aria-label="Répartition du budget voyage par catégorie"
      style={{
        display: 'flex',
        gap: 4,
        borderRadius: 16,
        overflow: 'hidden',
        height: 260,
      }}
    >
      {/* Column 1 */}
      <div style={{ flex: `0 0 ${col1WidthPct.toFixed(1)}%`, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <MosaicColumn
          items={col1}
          totalSum={total}
          mode={mode}
          selected={selected}
          onSelect={onSelect}
          mounted={mounted}
        />
      </div>

      {/* Column 2 */}
      {col2.length > 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <MosaicColumn
            items={col2}
            totalSum={total}
            mode={mode}
            selected={selected}
            onSelect={onSelect}
            mounted={mounted}
          />
        </div>
      ) : null}
    </div>
  )
}

// ── Main overlay ───────────────────────────────────────────────────────────────

export function TripBudgetOverlay({ open, onClose, mode, rows, tripName }: TripBudgetOverlayProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (open) return lockDocumentScroll()
  }, [open])

  useEffect(() => {
    if (!open) {
      setMounted(false)
      setSelected(null)
      return
    }
    const id = window.setTimeout(() => setMounted(true), 90)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const envelopes = useMemo<EnvelopeRow[]>(() => {
    const plannedRows = rows
      .map((row, index) => ({
        ...row,
        amount: Number(row.budgetAmount ?? 0),
        color: PALETTE[index % PALETTE.length],
        index,
        pct: 0,
      }))
      .filter((row) => Number.isFinite(row.amount) && row.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    const total = plannedRows.reduce((sum, row) => sum + row.amount, 0)
    return plannedRows.map((row, index) => ({
      ...row,
      color: PALETTE[index % PALETTE.length],
      index,
      pct: total > 0 ? row.amount / total : 0,
    }))
  }, [rows])

  if (envelopes.length === 0) {
    return <EmptyState open={open} onClose={onClose} tripName={tripName} />
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="budget-overlay-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 400,
            background: 'rgba(10, 8, 28, 0.62)',
            backdropFilter: 'blur(20px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 20px',
          }}
        >
          <motion.div
            key="budget-overlay-card"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 14 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 420,
              borderRadius: 30,
              overflow: 'hidden',
              background: 'linear-gradient(180deg, rgba(255, 252, 245, 0.94) 0%, rgba(245, 241, 233, 0.86) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.68)',
              boxShadow: '0 26px 74px rgba(10, 8, 40, 0.25), inset 0 1px 0 rgba(255,255,255,0.92)',
              backdropFilter: 'blur(42px) saturate(1.55)',
              WebkitBackdropFilter: 'blur(42px) saturate(1.55)',
            }}
          >
            {/* Decorative ambient gradient */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: '0 0 auto 0',
                height: 150,
                background:
                  'radial-gradient(80% 90% at 18% 0%, rgba(11,108,181,0.18) 0%, rgba(11,108,181,0) 62%), radial-gradient(80% 90% at 100% 10%, rgba(180,83,9,0.14) 0%, rgba(180,83,9,0) 58%)',
                pointerEvents: 'none',
              }}
            />

            <div style={{ position: 'relative', padding: '18px 18px 18px', display: 'grid', gap: 14 }}>
              {/* ── Header ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 800,
                    color: 'rgba(35, 24, 12, 0.9)',
                    letterSpacing: '-0.01em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  <span style={{ color: 'rgba(118, 84, 30, 0.52)', fontWeight: 700 }}>Enveloppes</span>
                  {tripName ? <>{' · '}{tripName}</> : null}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    border: '1px solid rgba(203, 170, 100, 0.35)',
                    background: 'rgba(255, 249, 237, 0.72)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'rgba(86, 58, 15, 0.62)',
                    flexShrink: 0,
                  }}
                >
                  <X size={13} strokeWidth={2.5} />
                </button>
              </div>

              {/* ── Mosaic treemap ── */}
              <BudgetMosaicChart
                envelopes={envelopes}
                mode={mode}
                selected={selected}
                onSelect={setSelected}
                mounted={mounted}
              />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
