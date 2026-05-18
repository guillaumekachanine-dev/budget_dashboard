import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useSavingsEvolutionFiveYears } from '@/features/savings/hooks/useSavingsEvolutionFiveYears'
import { EmptyState, SkeletonCard, StatsSection } from '@/features/stats/components/ui'
import type { SavingsEvolutionFiveYearsSeries } from '@/features/savings/types'
import { SavingsPortfolioModal } from '@/features/savings/components/SavingsPortfolioModal'
import amundiEpargneIcon from '@/assets/icons/accounts/amundi_epargne.webp'
import bitcoinIcon from '@/assets/icons/accounts/bitcoin.webp'
import peaIcon from '@/assets/icons/accounts/boursorama_pea.png'
import comptePrincipalIcon from '@/assets/icons/accounts/compte_principal_banque_populaire.webp'
import pegCapgeminiIcon from '@/assets/icons/accounts/peg_capgemini.png'
import { resolveSavingsPortfolioColor } from '@/features/savings/utils/savingsPortfolioColor'

const EURO_ROUNDED = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const PCT_INTEGER = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

type StyledSeries = SavingsEvolutionFiveYearsSeries & {
  shortLabel: string
  iconSrc: string
  listLabel: string
}

const LEGEND_ORDER: Record<string, number> = {
  'liv a': 0,
  'livr a': 0,
  'livret a': 0,
  pea: 1,
  per: 2,
  ldds: 3,
  peg: 4,
  bitcoin: 5,
}

function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function hasWord(normalized: string, word: string): boolean {
  const pattern = new RegExp(`\\b${word}\\b`, 'i')
  return pattern.test(normalized)
}

function resolveLegendLabel(label: string): string {
  const normalized = normalizeLabel(label)
  if (normalized.includes('livret a')) return 'Livret A'
  if (hasWord(normalized, 'peg') || normalized.includes('capgemini')) return 'PEG'
  if (hasWord(normalized, 'per') || normalized.includes('plan epargne retraite')) return 'PER'
  if (hasWord(normalized, 'bitcoin') || normalized.includes('wallet bitcoin')) return 'BTC'
  return label
}

function resolveSeriesIcon(label: string, family: 'livrets' | 'placements'): string {
  const normalized = normalizeLabel(label)
  if (hasWord(normalized, 'per') || normalized.includes('plan epargne retraite')) return comptePrincipalIcon
  if (hasWord(normalized, 'pea')) return peaIcon
  if (hasWord(normalized, 'peg') || normalized.includes('capgemini')) return pegCapgeminiIcon
  if (hasWord(normalized, 'bitcoin') || normalized.includes('wallet bitcoin')) return bitcoinIcon
  if (hasWord(normalized, 'perco') || hasWord(normalized, 'percol') || normalized.includes('amundi')) return amundiEpargneIcon
  if (family === 'livrets') return comptePrincipalIcon
  return amundiEpargneIcon
}

function resolveListLabel(label: string): string {
  const normalized = normalizeLabel(label)
  if (hasWord(normalized, 'peg') || normalized.includes('capgemini')) return 'PEG'
  if (hasWord(normalized, 'per') || normalized.includes('plan epargne retraite')) return 'PER'
  if (hasWord(normalized, 'bitcoin') || normalized.includes('wallet bitcoin') || normalized.includes('wallet bitcon')) return 'BTC'
  return label
}

function formatCurrency(value: number): string {
  return EURO_ROUNDED.format(value).replace(/\s+€/u, '€')
}

function formatVariation(current: number, previous: number): string {
  if (!Number.isFinite(previous) || previous <= 0) return '—'
  const delta = ((current - previous) / previous) * 100
  if (!Number.isFinite(delta)) return '—'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${PCT_INTEGER.format(delta)}%`
}

function formatSignedCurrency(value: number): string {
  const abs = formatCurrency(Math.abs(value))
  if (value > 0) return `+${abs}`
  if (value < 0) return `-${abs}`
  return abs
}

export function SavingsPortfoliosListSection() {
  const { data, isLoading, error } = useSavingsEvolutionFiveYears()
  const [selectedPortfolioKey, setSelectedPortfolioKey] = useState<string | null>(null)

  const rows = useMemo(() => data?.rows ?? [], [data?.rows])
  const series = useMemo(() => data?.series ?? [], [data?.series])
  const yearlyAccountMetrics = useMemo(() => data?.yearly_account_metrics ?? {}, [data?.yearly_account_metrics])
  const operationEvents = useMemo(() => data?.operation_events ?? [], [data?.operation_events])

  const styledSeries: StyledSeries[] = useMemo(() => series.map((entry) => ({
    ...entry,
    shortLabel: resolveLegendLabel(entry.label),
    color: resolveSavingsPortfolioColor({
      key: entry.key,
      label: entry.label,
      savingsKind: entry.savings_kind,
      fallbackColor: entry.color,
    }),
    iconSrc: resolveSeriesIcon(entry.label, entry.family),
    listLabel: resolveListLabel(entry.label),
  })), [series])

  const orderedLegendSeries = useMemo(() => [...styledSeries].sort((a, b) => {
    const aKey = normalizeLabel(a.shortLabel)
    const bKey = normalizeLabel(b.shortLabel)
    const aRank = LEGEND_ORDER[aKey] ?? 99
    const bRank = LEGEND_ORDER[bKey] ?? 99
    if (aRank !== bRank) return aRank - bRank
    return a.shortLabel.localeCompare(b.shortLabel, 'fr')
  }), [styledSeries])

  const latestYear = useMemo(() => {
    const sorted = [...rows].sort((a, b) => Number(b.year) - Number(a.year))
    return sorted[0]?.year ?? null
  }, [rows])

  const latestYearRow = useMemo(
    () => rows.find((r) => r.year === latestYear) ?? null,
    [rows, latestYear],
  )

  const previousYearRow = useMemo(() => {
    if (!latestYear) return null
    const prevYear = String(Number(latestYear) - 1)
    return rows.find((r) => r.year === prevYear) ?? null
  }, [rows, latestYear])

  const listRows = useMemo(() => orderedLegendSeries.map((entry) => {
    const accountId = entry.key
    const yearValue = latestYearRow?.year ?? ''
    const currentAmount = Number(latestYearRow?.[accountId] ?? 0)
    const previousAmount = Number(previousYearRow?.[accountId] ?? 0)
    const yearlyMetrics = yearlyAccountMetrics[`${accountId}::${yearValue}`]
    const operationsCount = Number(yearlyMetrics?.operations_count ?? 0)
    const totalSavedAmount = Number(yearlyMetrics?.total_saved_amount ?? 0)
    const performanceAmount = currentAmount - previousAmount - totalSavedAmount

    return {
      ...entry,
      currentAmount: Number.isFinite(currentAmount) ? currentAmount : 0,
      variationVsPreviousYear: formatVariation(currentAmount, previousAmount),
      operationsCount: Number.isFinite(operationsCount) ? operationsCount : 0,
      performanceAmount: Number.isFinite(performanceAmount) ? performanceAmount : 0,
    }
  }), [orderedLegendSeries, latestYearRow, previousYearRow, yearlyAccountMetrics])

  if (isLoading) {
    return (
      <StatsSection>
        <SkeletonCard heightClass="h-40" lines={2} />
      </StatsSection>
    )
  }

  if (error || rows.length === 0) {
    return (
      <StatsSection>
        <EmptyState message="Impossible de charger les portefeuilles." />
      </StatsSection>
    )
  }

  return (
    <StatsSection>
      <div
        style={{
          border: '1px solid var(--neutral-150)',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--neutral-0)',
          boxShadow: 'var(--shadow-card)',
          padding: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'grid', gap: '6px' }}>
          <div
            aria-hidden="true"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 2fr) repeat(3, minmax(0, 1fr))',
              alignItems: 'center',
              padding: '0 2px 8px',
              columnGap: 8,
            }}
          >
            <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontWeight: 600, textAlign: 'left', paddingLeft: 22 }}>
              portefeuille
            </span>
            <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontWeight: 600, textAlign: 'center' }}>
              Perf.
            </span>
            <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontWeight: 600, textAlign: 'center' }}>
              var. N-1
            </span>
            <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontWeight: 600, textAlign: 'center' }}>
              montant
            </span>
          </div>

          {listRows.map((row) => (
            <div
              key={row.key}
              style={{
                padding: '4px 2px',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 2fr) repeat(3, minmax(0, 1fr))',
                alignItems: 'center',
                columnGap: 8,
                lineHeight: 1.1,
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedPortfolioKey(row.key)}
                aria-label={`Voir le détail de ${row.listLabel}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  minWidth: 0,
                  background: 'transparent',
                  border: 'none',
                  padding: '2px 4px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--neutral-100)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <img
                  src={row.iconSrc}
                  alt=""
                  aria-hidden="true"
                  style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
                <span style={{ fontSize: 11, color: 'var(--neutral-800)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.listLabel}
                </span>
                <span aria-hidden="true" style={{ fontSize: 9, color: 'var(--neutral-400)', flexShrink: 0, lineHeight: 1 }}>›</span>
              </button>

              <span style={{ fontSize: 11, color: 'var(--neutral-700)', fontWeight: 500, fontFamily: 'var(--font-mono)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {formatSignedCurrency(row.performanceAmount)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--neutral-700)', fontWeight: 500, fontFamily: 'var(--font-mono)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {row.variationVsPreviousYear}
              </span>
              <span style={{ fontSize: 11, color: 'var(--neutral-900)', fontWeight: 700, fontFamily: 'var(--font-mono)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {formatCurrency(row.currentAmount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedPortfolioKey ? (() => {
          const portfolioRow = listRows.find((r) => r.key === selectedPortfolioKey)
          if (!portfolioRow) return null
          return (
            <SavingsPortfolioModal
              key={selectedPortfolioKey}
              account={{
                key: portfolioRow.key,
                label: portfolioRow.label,
                color: portfolioRow.color,
                family: portfolioRow.family,
                savings_kind: portfolioRow.savings_kind,
                risk_level: portfolioRow.risk_level,
                shortLabel: portfolioRow.shortLabel,
                iconSrc: portfolioRow.iconSrc,
                listLabel: portfolioRow.listLabel,
              }}
              operationEvents={operationEvents}
              rows={rows}
              currentAmount={portfolioRow.currentAmount}
              onClose={() => setSelectedPortfolioKey(null)}
            />
          )
        })() : null}
      </AnimatePresence>
    </StatsSection>
  )
}
