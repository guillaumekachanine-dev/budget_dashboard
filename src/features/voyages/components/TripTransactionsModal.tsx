import { useMemo } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useTripExpenses } from '@/features/voyages/hooks/useTripExpenses'
import type { TripExpenseRow } from '@/features/voyages/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

// Couleur par catégorie parente (cohérent avec le design system)
const CATEGORY_PALETTE: Record<string, string> = {
  transport: '#5B57F5',
  hébergement: '#FFAB2E',
  hébergements: '#FFAB2E',
  restauration: '#FC5A5A',
  alimentation: '#FC5A5A',
  loisirs: '#2ED47A',
  activités: '#2ED47A',
  shopping: '#9B8EF8',
  santé: '#4BC7F4',
  autre: '#94A3B8',
}

function getCategoryDotColor(row: TripExpenseRow): string {
  const name = (row.parent_category_name ?? row.category_name ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const [key, color] of Object.entries(CATEGORY_PALETTE)) {
    if (name.includes(key)) return color
  }
  return '#94A3B8'
}

// ─── Row component ────────────────────────────────────────────────────────────

function TxRow({ row }: { row: TripExpenseRow }) {
  const dotColor = getCategoryDotColor(row)
  const isManual = row.source_type === 'manual'
  const label = row.label || (row.category_name ?? 'Transaction')

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
      }}
    >
      {/* Pastille catégorie */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: `${dotColor}18`,
          border: `1.5px solid ${dotColor}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: dotColor,
          }}
        />
      </div>

      {/* Libellé + catégorie */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.9)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span
            style={{
              fontSize: 11,
              color: 'rgba(255, 255, 255, 0.45)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {row.category_name ?? 'Autre'}
          </span>
          {isManual && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#FFAB2E',
                background: 'rgba(255,171,46,0.12)',
                borderRadius: 4,
                padding: '1px 5px',
                flexShrink: 0,
              }}
            >
              Manuel
            </span>
          )}
        </div>
      </div>

      {/* Montant */}
      <span
        style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: '#FC5A5A',
          flexShrink: 0,
        }}
      >
        −{formatAmount(row.personal_amount)}
      </span>
    </div>
  )
}

// ─── Date group ───────────────────────────────────────────────────────────────

function DateGroup({ date, rows }: { date: string; rows: TripExpenseRow[] }) {
  const dayTotal = rows.reduce((s, r) => s + r.personal_amount, 0)
  return (
    <div style={{ marginBottom: 4 }}>
      {/* Header du groupe */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 0 2px',
          marginBottom: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: 'rgba(255, 255, 255, 0.45)',
            textTransform: 'uppercase',
            letterSpacing: '0.10em',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {formatDate(date)}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'rgba(255, 255, 255, 0.45)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          −{formatAmount(dayTotal)}
        </span>
      </div>

      {/* Rows */}
      <div
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {rows.map((row, i) => (
          <div key={row.source_id}>
            <TxRow row={row} />
            {i < rows.length - 1 && (
              <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.06)', margin: '0 0 0 48px' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TxSkeleton() {
  return (
    <div style={{ padding: '0 var(--space-5)' }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 0',
            borderBottom: i < 4 ? '1px solid rgba(255, 255, 255, 0.08)' : undefined,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.12)',
              flexShrink: 0,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                height: 12,
                width: `${55 + (i % 3) * 15}%`,
                borderRadius: 6,
                background: 'rgba(255, 255, 255, 0.12)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
            <div
              style={{
                height: 9,
                width: '35%',
                borderRadius: 6,
                background: 'rgba(255, 255, 255, 0.06)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          </div>
          <div
            style={{
              height: 12,
              width: 48,
              borderRadius: 6,
              background: 'rgba(255, 255, 255, 0.12)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        </div>
      ))}
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface TripTransactionsModalProps {
  open: boolean
  onClose: () => void
  tripId: string | null
  tripName: string | null
  tripEmoji?: string | null
}

export function TripTransactionsModal({
  open,
  onClose,
  tripId,
  tripName,
  tripEmoji,
}: TripTransactionsModalProps) {
  const { expenses, isLoading } = useTripExpenses(open ? tripId : null)

  // Grouper par date
  const grouped = useMemo(() => {
    const map = new Map<string, TripExpenseRow[]>()
    for (const row of expenses) {
      const existing = map.get(row.expense_date)
      if (existing) existing.push(row)
      else map.set(row.expense_date, [row])
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [expenses])

  const grandTotal = useMemo(
    () => expenses.reduce((s, r) => s + r.personal_amount, 0),
    [expenses],
  )

  const title = tripName ? `${tripEmoji ?? '✈️'} ${tripName}` : 'Transactions voyage'

  const glassBackground = 'rgba(20, 14, 4, 0.54)'
  const glassBorder = 'rgba(255, 171, 46, 0.15)'

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      maxHeight="85dvh"
      variant="center"
      glass
      glassBackground={glassBackground}
      glassBorder={glassBorder}
      zIndex={1200}
    >
      {isLoading ? (
        <TxSkeleton />
      ) : grouped.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-10) var(--space-5)',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 40 }}>🗺️</span>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-size-sm)',
              color: 'rgba(255, 255, 255, 0.6)',
              textAlign: 'center',
            }}
          >
            Aucune dépense enregistrée pour ce voyage.
          </p>
        </div>
      ) : (
        <div style={{ padding: '0 var(--space-5) var(--space-8)' }}>
          {/* Récap total en haut */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 0 10px',
              borderBottom: '2px solid rgba(255, 255, 255, 0.15)',
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.6)',
                textTransform: 'uppercase',
                letterSpacing: '0.10em',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Total voyage
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 800,
                color: '#FC5A5A',
                fontFamily: 'var(--font-mono)',
              }}
            >
              −{formatAmount(grandTotal)}
            </span>
          </div>

          {grouped.map(([date, rows]) => (
            <DateGroup key={date} date={date} rows={rows} />
          ))}
        </div>
      )}
    </BottomSheet>
  )
}
