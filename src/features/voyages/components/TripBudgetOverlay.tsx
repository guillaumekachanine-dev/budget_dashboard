import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { formatCurrencyFloored } from '@/lib/utils'
import { lockDocumentScroll } from '@/lib/scrollLock'
import type { TripExpenseBarsMode, TripExpenseBarsRow } from '@/features/voyages/hooks/useTripExpenseBars'

const PALETTE = ['#38BDF8', '#6366F1', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899']

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
              Aucun budget prévisionnel par poste n’est disponible pour ce voyage.
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

  const totalBudget = envelopes.reduce((sum, row) => sum + row.amount, 0)
  const maxBudget = Math.max(...envelopes.map((row) => row.amount), 1)
  const selectedRow = envelopes.find((row) => row.key === selected) ?? null

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
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: '0 0 auto 0',
                height: 150,
                background: 'radial-gradient(80% 90% at 18% 0%, rgba(56,189,248,0.20) 0%, rgba(56,189,248,0) 62%), radial-gradient(80% 90% at 100% 10%, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0) 58%)',
                pointerEvents: 'none',
              }}
            />

            <div style={{ position: 'relative', padding: '20px 20px 18px', display: 'grid', gap: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(118, 84, 30, 0.58)' }}>
                    Enveloppes voyage
                  </p>
                  {tripName ? (
                    <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 800, color: 'rgba(35, 24, 12, 0.92)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tripName}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  style={{
                    width: 32,
                    height: 32,
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
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'end', gap: 16 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 34, fontWeight: 850, fontFamily: 'var(--font-mono)', color: 'rgba(21, 18, 32, 0.92)', lineHeight: 0.96, letterSpacing: '-0.06em' }}>
                    {formatCurrencyFloored(selectedRow?.amount ?? totalBudget)}
                  </p>
                  <p style={{ margin: '7px 0 0', fontSize: 12, fontWeight: 750, color: selectedRow ? selectedRow.color : 'rgba(91, 75, 48, 0.58)' }}>
                    {selectedRow ? selectedRow.name : 'Budget prévisionnel total'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 850, fontFamily: 'var(--font-mono)', color: 'rgba(21, 18, 32, 0.84)' }}>
                    {selectedRow ? `${Math.round(selectedRow.pct * 100)}%` : envelopes.length}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(118, 84, 30, 0.48)' }}>
                    {selectedRow ? 'du total' : 'postes'}
                  </p>
                </div>
              </div>

              <div
                role="img"
                aria-label="Budgets prévisionnels par poste de dépense du voyage"
                style={{
                  position: 'relative',
                  display: 'grid',
                  gap: 11,
                  padding: '4px 0 2px',
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 14,
                    bottom: 12,
                    left: 9,
                    width: 1,
                    background: 'linear-gradient(180deg, rgba(91,87,245,0), rgba(91,87,245,0.22), rgba(14,165,233,0))',
                  }}
                />
                {envelopes.map((row) => {
                  const selectedThis = selected === row.key
                  const muted = Boolean(selected && !selectedThis)
                  const widthPct = Math.max(8, (row.amount / maxBudget) * 100)
                  const consumedPct = row.budgetAmount > 0
                    ? Math.min(100, Math.max(0, (row.consumedAmount / row.budgetAmount) * 100))
                    : 0

                  return (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => setSelected((current) => current === row.key ? null : row.key)}
                      onMouseEnter={() => setSelected(row.key)}
                      onMouseLeave={() => setSelected(null)}
                      style={{
                        position: 'relative',
                        display: 'grid',
                        gridTemplateColumns: '20px minmax(72px, 0.72fr) minmax(112px, 1fr) auto',
                        alignItems: 'center',
                        gap: 10,
                        border: 'none',
                        background: selectedThis ? 'rgba(255, 255, 255, 0.52)' : 'transparent',
                        borderRadius: 16,
                        padding: '7px 8px',
                        cursor: 'pointer',
                        opacity: muted ? 0.38 : 1,
                        transition: 'opacity 160ms ease, background 160ms ease',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: row.color,
                          boxShadow: `0 0 0 4px ${row.color}1f`,
                          justifySelf: 'center',
                        }}
                      />
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', fontSize: 12, fontWeight: 800, color: 'rgba(35, 24, 12, 0.78)' }}>
                        {row.name}
                      </span>
                      <span style={{ position: 'relative', height: 14, borderRadius: 999, background: 'rgba(74, 62, 46, 0.08)', overflow: 'hidden' }}>
                        <motion.span
                          aria-hidden="true"
                          initial={false}
                          animate={{ width: mounted ? `${widthPct}%` : '0%' }}
                          transition={{ duration: 0.62, delay: row.index * 0.045, ease: [0.22, 1, 0.36, 1] }}
                          style={{
                            position: 'absolute',
                            inset: '0 auto 0 0',
                            borderRadius: 999,
                            background: row.color,
                          }}
                        />
                        {mode === 'ongoing' && consumedPct > 0 ? (
                          <span
                            aria-hidden="true"
                            style={{
                              position: 'absolute',
                              top: 2,
                              bottom: 2,
                              left: `${Math.min(widthPct, consumedPct)}%`,
                              width: 2,
                              borderRadius: 999,
                              background: 'rgba(255,255,255,0.92)',
                              boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
                            }}
                          />
                        ) : null}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 850, fontFamily: 'var(--font-mono)', color: 'rgba(35, 24, 12, 0.86)', whiteSpace: 'nowrap' }}>
                        {formatCurrencyFloored(row.amount)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
