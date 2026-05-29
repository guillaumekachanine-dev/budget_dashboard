import { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, MapPin, ChevronDown, ChevronUp, X, Pencil, Link } from 'lucide-react'
import { useVoyagesData } from '../hooks/useVoyagesData'
import type { TripTransaction, TripWithStats } from '../types'
import { PlanVoyageModal } from './PlanVoyageModal'
import { useTransaction } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { TransactionDetailsModal } from '@/components/modals/TransactionDetailsModal'
import { TripTransactionRattachementModal } from './TripTransactionRattachementModal'

const TRIP_COLORS = [
  '#F59E0B', '#10B981', '#6366F1', '#EC4899', '#14B8A6',
  '#F97316', '#8B5CF6', '#06B6D4', '#84CC16', '#EF4444',
]

const MONTH_NAMES_SHORT = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

const VOYAGES_ACCENT = '#F59E0B'
const AVAILABLE_YEARS = [2025, 2026] as const
const UNKNOWN_CATEGORY_KEY = '__unknown__'

import { AmbianceBgScene, tripAmbianceBackground } from './AmbianceBgScene'

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

function formatTxDateDayMonthYear(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '--/--/----'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getTxLabel(tx: TripTransaction): string {
  const normalized = (tx.normalized_label ?? '').trim()
  if (normalized.length > 0) return normalized
  const merchant = (tx.merchant_name ?? '').trim()
  if (merchant.length > 0) return merchant
  const raw = (tx.raw_label ?? '').trim()
  if (raw.length > 0) return raw
  return 'Opération'
}

function isTripPast(tripEndDateIso: string, todayKey: string): boolean {
  return tripEndDateIso < todayKey
}

function KpiChip({
  label,
  value,
  mono = false,
  onClick,
}: {
  label: string
  value: string
  mono?: boolean
  onClick?: () => void
}) {
  const content = (
    <>
      <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: mono ? 'var(--font-mono)' : undefined, color: 'var(--neutral-900)', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </>
  )

  if (!onClick) {
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
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: '1px solid var(--neutral-200)',
        background: 'var(--neutral-0)',
        borderRadius: 'var(--radius-md)',
        padding: '6px var(--space-3)',
        display: 'grid',
        justifyItems: 'center',
        gap: 2,
        cursor: 'pointer',
      }}
    >
      {content}
    </button>
  )
}

function CategoryBar({
  name,
  amount,
  pct,
  color,
  onClick,
}: {
  name: string
  amount: number
  pct: number
  color: string
  onClick?: () => void
}) {
  const inner = (
    <>
      <span style={{ fontSize: 11, color: 'var(--neutral-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>
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
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--neutral-700)', whiteSpace: 'nowrap', textAlign: 'right' }}>
        {formatAmount(amount)}
      </span>
    </>
  )

  if (!onClick) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', alignItems: 'center', gap: 'var(--space-2)' }}>
        {inner}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        border: 'none',
        background: 'transparent',
        display: 'grid',
        gridTemplateColumns: '80px 1fr auto',
        alignItems: 'center',
        gap: 'var(--space-2)',
        cursor: 'pointer',
        padding: '2px 0',
      }}
    >
      {inner}
    </button>
  )
}

function TripTransactionsModal({
  open,
  title,
  transactions,
  onClose,
  onOpenTransactionDetails,
}: {
  open: boolean
  title: string
  transactions: TripTransaction[]
  onClose: () => void
  onOpenTransactionDetails: (txId: string) => void
}) {
  useEffect(() => {
    if (!open) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.42)',
            zIndex: 120,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 620,
              maxHeight: '82vh',
              background: 'var(--neutral-0)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-card)',
              border: '1px solid var(--neutral-150)',
              overflow: 'hidden',
              display: 'grid',
              gridTemplateRows: 'auto 1fr',
            }}
          >
            <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--neutral-150)', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--neutral-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {title}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--neutral-500)' }}>
                  {transactions.length} opération{transactions.length > 1 ? 's' : ''} · ordre chronologique
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer la liste des opérations"
                style={{
                  width: 28,
                  height: 28,
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--neutral-100)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--neutral-700)',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ overflow: 'auto', padding: 'var(--space-2) var(--space-4) var(--space-4)' }}>
              {transactions.length === 0 ? (
                <p style={{ margin: 'var(--space-4) 0', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
                  Aucune opération sur ce périmètre.
                </p>
              ) : (
                transactions.map((tx) => {
                  const isBank = !tx.is_manual
                  return (
                    <div
                      key={tx.id}
                      className={isBank ? 'txn-row-clickable' : ''}
                      onClick={isBank ? () => onOpenTransactionDetails(tx.id) : undefined}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '74px minmax(0,1fr) auto',
                        gap: 'var(--space-2)',
                        alignItems: 'center',
                        padding: '6px var(--space-2)',
                        margin: '0 -var(--space-2)',
                        borderBottom: '1px solid var(--neutral-100)',
                        cursor: isBank ? 'pointer' : 'default',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'background 100ms ease',
                      }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)' }}>
                        {formatTxDateDayMonthYear(tx.transaction_date)}
                      </span>
                      <div style={{ minWidth: 0, display: 'grid', gap: 1 }}>
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {getTxLabel(tx)}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--neutral-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {tx.merchant_name ?? tx.raw_label ?? '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', whiteSpace: 'nowrap' }}>
                          {formatAmount(Number(tx.amount) * (tx.personal_share_ratio ?? 1.0)).replace(/\s+€/, '€')}
                        </span>
                        {(tx.personal_share_ratio ?? 1.0) !== 1.0 && (
                          <span style={{ fontSize: 9, color: 'var(--neutral-400)', marginTop: 2 }}>
                            total {formatAmount(Number(tx.amount)).replace(/\s+€/, '€')}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}



function TripAccordionItem({
  item,
  index,
  isLast,
  expanded,
  onToggle,
  onEditTrip,
  onOpenCategoryTransactions,
  onOpenAllTransactions,
  onRattachement,
}: {
  item: TripWithStats
  index: number
  isLast: boolean
  expanded: boolean
  onToggle: () => void
  onEditTrip: (trip: TripWithStats) => void
  onOpenCategoryTransactions: (payload: { tripName: string; categoryId: string; categoryName: string; transactions: TripTransaction[] }) => void
  onOpenAllTransactions: (payload: { tripName: string; transactions: TripTransaction[] }) => void
  onRattachement: (trip: { id: string; name: string }) => void
}) {
  const color = tripColor(index)
  const ambianceBg = tripAmbianceBackground(item.trip.emoji)
  const dateRange = `${formatDateShort(item.trip.start_date)} -> ${formatDate(item.trip.end_date)}`
  const maxCatAmount = item.byCategory[0]?.amount ?? 1
  const tripEmoji = item.trip.emoji?.trim() || '✈️'

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
      <div
        style={{
          position: 'relative',
          width: '100%',
          background: ambianceBg,
          padding: '10px var(--space-4)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) auto',
          alignItems: 'center',
          gap: 'var(--space-3)',
          overflow: 'hidden',
        }}
      >
        <AmbianceBgScene emoji={tripEmoji} />
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            border: 'none',
            background: 'transparent',
            padding: 0,
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0,1fr)',
            alignItems: 'center',
            gap: 'var(--space-3)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 28, lineHeight: 1, width: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {tripEmoji}
          </span>

          <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', minWidth: 0 }}>
              <p style={{ margin: 0, minWidth: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'rgba(255,255,255,0.97)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.trip.name}
              </p>
              {expanded ? (
                <span style={{ width: 20, height: 20, flexShrink: 0 }} />
              ) : null}
            </span>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3 }}>
              {dateRange} · {item.duration} jour{item.duration > 1 ? 's' : ''}
            </p>
          </div>
        </button>

        <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {expanded ? (
            <button
              type="button"
              onClick={() => onEditTrip(item)}
              aria-label={`Modifier ${item.trip.name}`}
              style={{
                width: 20,
                height: 20,
                border: '1px solid rgba(28, 18, 58, 0.58)',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(255,255,255,0.2)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.96)',
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            >
              <Pencil size={11} />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              margin: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--neutral-0)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
              {formatAmount(item.total).replace(/\s+€/, '€')}
            </span>
            {expanded ? (
              <ChevronUp size={14} color="rgba(255,255,255,0.92)" />
            ) : (
              <ChevronDown size={14} color="rgba(255,255,255,0.92)" />
            )}
          </button>
        </span>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
              {!item.hasData ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-3) 0 var(--space-2)', color: 'var(--neutral-400)', fontSize: 'var(--font-size-sm)' }}>
                  <MapPin size={16} style={{ marginBottom: 4, display: 'block', margin: '0 auto 6px' }} />
                  Aucune dépense catégorisée « Voyages » sur cette période.<br />
                  <span style={{ fontSize: 11 }}>Assigne des dépenses manuellement via le détail de transaction.</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    <KpiChip label="Total" value={formatAmount(item.total)} mono />
                    <KpiChip label="Moy./jour" value={formatAmount(item.avgPerDay)} mono />
                    <KpiChip
                      label="Dépenses"
                      value={String(item.txCount)}
                      onClick={() => onOpenAllTransactions({ tripName: item.trip.name, transactions: item.transactions })}
                    />
                  </div>

                  <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                    {item.byCategory.map((cat) => (
                      <CategoryBar
                        key={cat.categoryId}
                        name={cat.categoryName}
                        amount={cat.amount}
                        pct={maxCatAmount > 0 ? (cat.amount / maxCatAmount) * 100 : 0}
                        color={color}
                        onClick={() => onOpenCategoryTransactions({
                          tripName: item.trip.name,
                          categoryId: cat.categoryId,
                          categoryName: cat.categoryName,
                          transactions: item.transactions,
                        })}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Bouton de rattachement toujours visible sous la section détails */}
              <div style={{ marginTop: 'var(--space-3)' }}>
                <button
                  type="button"
                  onClick={() => onRattachement({ id: item.trip.id, name: item.trip.name })}
                  style={{
                    display:      'inline-flex',
                    alignItems:   'center',
                    justifyContent: 'center',
                    gap:          'var(--space-1.5)',
                    background:   'var(--neutral-50)',
                    color:        'var(--neutral-700)',
                    border:       '1px solid var(--neutral-200)',
                    borderRadius: 'var(--radius-button)',
                    padding:      '8px var(--space-3)',
                    fontSize:     12,
                    fontWeight:   600,
                    cursor:       'pointer',
                    width:        '100%',
                  }}
                >
                  <Link size={13} />
                  Affilier
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}

function VoyagesKpiCards({
  tripCount,
  annualBudget,
  monthlyBudget,
}: {
  tripCount: number
  annualBudget: number
  monthlyBudget: number
}) {
  return (
    <div style={{ marginBottom: 'var(--space-4)', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 'var(--space-2)' }}>
      <div style={{ background: 'var(--neutral-0)', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48, display: 'grid', justifyItems: 'center', alignContent: 'center', textAlign: 'center', gap: 2 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>Voyages</span>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', whiteSpace: 'nowrap' }}>
          {tripCount}
        </span>
      </div>
      <div style={{ background: 'var(--neutral-0)', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48, display: 'grid', justifyItems: 'center', alignContent: 'center', textAlign: 'center', gap: 2 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>Budget annuel</span>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', whiteSpace: 'nowrap' }}>{formatAmount(annualBudget).replace(/\s+€/, '€')}</span>
      </div>
      <div style={{ background: 'var(--neutral-0)', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', minHeight: 48, display: 'grid', justifyItems: 'center', alignContent: 'center', textAlign: 'center', gap: 2 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)', fontWeight: 700, whiteSpace: 'nowrap' }}>Budget mensuel</span>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-900)', whiteSpace: 'nowrap' }}>{formatAmount(monthlyBudget).replace(/\s+€/, '€')}</span>
      </div>
    </div>
  )
}

function YearPicker({
  year,
  onChange,
}: {
  year: number
  onChange: (nextYear: number) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Choisir l'année"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--neutral-700)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          cursor: 'pointer',
          padding: '2px var(--space-1)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <span>{year}</span>
        <ChevronDown size={12} />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            role="listbox"
            aria-label="Années disponibles"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              minWidth: 82,
              background: 'var(--neutral-0)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-card)',
              padding: 4,
              zIndex: 20,
            }}
          >
            {AVAILABLE_YEARS.map((y) => {
              const active = y === year
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    onChange(y)
                    setIsOpen(false)
                  }}
                  role="option"
                  aria-selected={active}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: active ? 'color-mix(in oklab, var(--primary-500) 12%, var(--neutral-0) 88%)' : 'transparent',
                    color: active ? 'var(--primary-700)' : 'var(--neutral-700)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px var(--space-2)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: active ? 700 : 600,
                    fontFamily: 'var(--font-mono)',
                    textAlign: 'left',
                  }}
                >
                  {y}
                </button>
              )
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

interface Props {
  onBack: () => void
}

interface TransactionsModalState {
  open: boolean
  title: string
  transactions: TripTransaction[]
}

export function VoyagesFeaturePage({ onBack }: Props) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState<number>(currentYear >= 2026 ? 2026 : 2025)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [tripToEdit, setTripToEdit] = useState<TripWithStats | null>(null)
  const [expandedTripIds, setExpandedTripIds] = useState<Record<string, boolean>>({})
  const [transactionsModalState, setTransactionsModalState] = useState<TransactionsModalState>({
    open: false,
    title: '',
    transactions: [],
  })
  const [rattachementTrip, setRattachementTrip] = useState<{ id: string; name: string } | null>(null)
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)

  const { data: categories = [] } = useCategories()
  const { data: activeTransaction } = useTransaction(selectedTransactionId)

  const { tripsWithStats, isLoading } = useVoyagesData(year)

  const annualTripCount = tripsWithStats.length
  const annualBudget = useMemo(() => {
    const now = new Date()
    const todayKey = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-')

    return tripsWithStats.reduce((sum, item) => {
      const planned = Number(item.trip.planned_budget ?? 0)
      if (isTripPast(item.trip.end_date, todayKey)) {
        return sum + item.total
      }
      return sum + planned
    }, 0)
  }, [tripsWithStats])
  const monthlyBudget = annualBudget / 12

  useEffect(() => {
    setExpandedTripIds({})
    setTripToEdit(null)
  }, [year])

  const toggleTripExpanded = (tripId: string) => {
    setExpandedTripIds((prev) => ({
      ...prev,
      [tripId]: !prev[tripId],
    }))
  }

  const handleOpenAllTransactions = ({
    tripName,
    transactions,
  }: {
    tripName: string
    transactions: TripTransaction[]
  }) => {
    setTransactionsModalState({
      open: true,
      title: `${tripName} · Toutes les opérations`,
      transactions,
    })
  }

  const handleOpenCategoryTransactions = ({
    tripName,
    categoryId,
    categoryName,
    transactions,
  }: {
    tripName: string
    categoryId: string
    categoryName: string
    transactions: TripTransaction[]
  }) => {
    const filtered = transactions.filter((tx) => {
      if (categoryId === UNKNOWN_CATEGORY_KEY) return tx.category_id == null
      return tx.category_id === categoryId
    })

    setTransactionsModalState({
      open: true,
      title: `${tripName} · ${categoryName}`,
      transactions: filtered,
    })
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        style={{ padding: '0 var(--space-6)', maxWidth: 600, margin: '0 auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)', gap: 'var(--space-2)' }}>
          <div style={{ minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
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

            <p style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--neutral-900)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
              Voyages
            </p>

            <YearPicker year={year} onChange={setYear} />
          </div>

          <button
            type="button"
            onClick={() => setShowPlanModal(true)}
            aria-label="Nouveau voyage"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              border: 'none',
              background: '#0097A7',
              borderRadius: 'var(--radius-full)',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--neutral-0)',
              boxShadow: '0 2px 8px rgba(0,151,167,0.38)',
              flexShrink: 0,
            }}
          >
            Nouveau
          </button>
        </div>

        <VoyagesKpiCards
          tripCount={annualTripCount}
          annualBudget={annualBudget}
          monthlyBudget={monthlyBudget}
        />

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--neutral-400)', fontSize: 'var(--font-size-sm)' }}>
            Chargement...
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          {!isLoading ? (
            <motion.div key={`voyages-${year}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {tripsWithStats.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--neutral-400)', fontSize: 'var(--font-size-sm)' }}>
                  Aucun voyage enregistré pour {year}.
                </div>
              ) : (
                tripsWithStats.map((item, i) => (
                  <TripAccordionItem
                    key={item.trip.id}
                    item={item}
                    index={i}
                    isLast={i === tripsWithStats.length - 1}
                    expanded={Boolean(expandedTripIds[item.trip.id])}
                    onToggle={() => toggleTripExpanded(item.trip.id)}
                    onEditTrip={(trip) => setTripToEdit(trip)}
                    onOpenCategoryTransactions={handleOpenCategoryTransactions}
                    onOpenAllTransactions={handleOpenAllTransactions}
                    onRattachement={setRattachementTrip}
                  />
                ))
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div style={{ height: 'var(--space-6)' }} />

        <PlanVoyageModal
          open={showPlanModal}
          onClose={() => setShowPlanModal(false)}
          mode="create"
          tripToEdit={null}
        />
        <PlanVoyageModal
          open={tripToEdit != null}
          onClose={() => setTripToEdit(null)}
          mode="edit"
          tripToEdit={tripToEdit}
        />
      </motion.div>

      <TripTransactionsModal
        open={transactionsModalState.open}
        title={transactionsModalState.title}
        transactions={transactionsModalState.transactions}
        onClose={() => setTransactionsModalState((prev) => ({ ...prev, open: false }))}
        onOpenTransactionDetails={setSelectedTransactionId}
      />

      {rattachementTrip && (
        <TripTransactionRattachementModal
          open={true}
          onClose={() => setRattachementTrip(null)}
          tripId={rattachementTrip.id}
          tripName={rattachementTrip.name}
        />
      )}

      <TransactionDetailsModal
        transaction={activeTransaction ?? null}
        categories={categories}
        onClose={() => setSelectedTransactionId(null)}
      />

      <style>{`
        .txn-row-clickable {
          transition: background-color 120ms ease;
        }
        .txn-row-clickable:hover {
          background-color: var(--neutral-100);
        }
        .txn-row-clickable:active {
          background-color: var(--neutral-150);
        }
      `}</style>
    </>
  )
}
