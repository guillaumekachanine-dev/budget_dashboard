import { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { useVoyagesData } from '../hooks/useVoyagesData'
import { TripDetailsModal } from './TripDetailsModal'

const VOYAGES_ACCENT = '#F59E0B'
const AVAILABLE_YEARS = [2025, 2026] as const

function formatAmount(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n)) + ' €'
}

function isTripPast(tripEndDateIso: string, todayKey: string): boolean {
  return tripEndDateIso < todayKey
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
      <div style={{ height: 7, borderRadius: 'var(--radius-sm)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.max(4, Math.min(pct, 100))}%`,
          height: '100%',
          borderRadius: 'var(--radius-sm)',
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


function VoyagesKpiCards({
  tripCount,
  annualBudget,
  monthlyBudget,
}: {
  tripCount: number
  annualBudget: number
  monthlyBudget: number
}) {
  const cards = [
    {
      key: 'voyages',
      label: 'Voyages',
      value: String(tripCount),
      background: '#8B1E4D',
      border: 'none',
      labelColor: 'rgba(255,255,255,0.8)',
      valueColor: '#FFFFFF',
    },
    {
      key: 'annual',
      label: 'Budget annuel',
      value: formatAmount(annualBudget).replace(/\s+€/, '€'),
      background: '#C77809',
      border: 'none',
      labelColor: 'rgba(255,255,255,0.8)',
      valueColor: '#FFFFFF',
    },
    {
      key: 'monthly',
      label: 'Budget mensuel',
      value: formatAmount(monthlyBudget).replace(/\s+€/, '€'),
      background: '#0F7785',
      border: '2px solid #E8B220',
      labelColor: '#9AE4EA',
      valueColor: '#FFFFFF',
    },
  ] as const

  return (
    <div style={{ marginBottom: 'var(--space-6)', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 'var(--space-2)' }}>
      {cards.map((card) => (
        <div
          key={card.key}
          style={{
            background: card.background,
            border: card.border,
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-2) var(--space-3)',
            minHeight: 64,
            display: 'grid',
            justifyItems: 'center',
            alignContent: 'center',
            textAlign: 'center',
            gap: 4,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: card.labelColor, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {card.label}
          </span>
          <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: card.valueColor, whiteSpace: 'nowrap' }}>
            {card.value}
          </span>
        </div>
      ))}
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

export function VoyagesFeaturePage({ onBack }: Props) {
  const navigate = useNavigate()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState<number>(currentYear >= 2026 ? 2026 : 2025)
  const { tripsWithStats, isLoading } = useVoyagesData(year)
  const [selectedTripIdForModal, setSelectedTripIdForModal] = useState<string | null>(null)

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

  const tripRepartitionRows = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10)

    return tripsWithStats
      .map((item) => {
        const past = isTripPast(item.trip.end_date, todayKey)
        const amount = past
          ? Number(item.total ?? 0)
          : Number(item.trip.planned_budget ?? 0)

        return {
          id: item.trip.id,
          name: item.trip.name,
          emoji: item.trip.emoji,
          amount,
          past,
        }
      })
      .sort((a, b) => b.amount - a.amount)
  }, [tripsWithStats])
  const maxTripRepartitionAmount = useMemo(
    () => Math.max(...tripRepartitionRows.map((row) => row.amount), 0),
    [tripRepartitionRows],
  )
  const monthLabel = useMemo(
    () => new Date(year, 4, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    [year],
  )

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        style={{ padding: '0 var(--space-6)', maxWidth: 600, margin: '0 auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', gap: 'var(--space-2)' }}>
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
            onClick={() => navigate('/voyages')}
            aria-label="Ouvrir la page voyages"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              border: 'none',
              background: '#0097A7',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--neutral-0)',
              boxShadow: '0 2px 8px rgba(0,151,167,0.38)',
              flexShrink: 0,
            }}
          >
            Page voyages
            <span
              aria-hidden="true"
              style={{
                width: 0,
                height: 0,
                borderTop: '4px solid transparent',
                borderBottom: '4px solid transparent',
                borderLeft: '6px solid rgba(255,255,255,0.95)',
                marginTop: 1,
              }}
            />
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

        {!isLoading ? (
          <div style={{ background: '#E7E7EA', borderRadius: 'var(--radius-sm)', border: '1px solid #D4D4D8', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-3)' }}>
            <div style={{ background: '#F2D8CE', borderRadius: 'var(--radius-sm)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
              <p style={{ margin: 0, fontSize: 31/2, fontWeight: 800, color: '#1F2937' }}>
                Répartition par voyage
              </p>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#5B6472', fontFamily: 'var(--font-mono)' }}>
                {monthLabel}
              </span>
            </div>
            {tripRepartitionRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--neutral-400)', fontSize: 'var(--font-size-sm)' }}>
                Aucun voyage enregistré pour {year}.
              </div>
            ) : (
              tripRepartitionRows.map((row, index) => (
                <CategoryBar
                  key={row.id}
                  name={`${row.emoji?.trim() ? `${row.emoji} ` : ''}${row.name}`}
                  amount={row.amount}
                  pct={maxTripRepartitionAmount > 0 ? (row.amount / maxTripRepartitionAmount) * 100 : 0}
                  color={index === 0 ? '#F3B11A' : '#43AFE0'}
                  onClick={() => setSelectedTripIdForModal(row.id)}
                />
              ))
            )}
          </div>
        ) : null}

        <div style={{ height: 'var(--space-6)' }} />
      </motion.div>

      <TripDetailsModal
        tripId={selectedTripIdForModal}
        isOpen={Boolean(selectedTripIdForModal)}
        onClose={() => setSelectedTripIdForModal(null)}
      />
    </>
  )
}
