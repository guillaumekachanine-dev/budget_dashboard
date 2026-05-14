import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useAccounts } from '@/hooks/useAccounts'
import type { AccountWithBalance } from '@/lib/types'
import { EmptyState, SkeletonCard, StatsSection, formatEuro } from '@/features/stats/components/ui'
import amundiEpargneIcon from '@/assets/icons/accounts/amundi_epargne.webp'
import compteJointIcon from '@/assets/icons/accounts/banque_postale_compte_joint.webp'
import bitcoinIcon from '@/assets/icons/accounts/bitcoin.webp'
import peaIcon from '@/assets/icons/accounts/boursorama_pea.png'
import comptePrincipalIcon from '@/assets/icons/accounts/compte_principal_banque_populaire.webp'
import pegCapgeminiIcon from '@/assets/icons/accounts/peg_capgemini.png'

type SavingsFamily = 'livrets' | 'placements'

type SavingsSlice = {
  id: string
  name: string
  family: SavingsFamily
  value: number
  color: string
  iconSrc: string
  sharePct: number
  familyAvgSharePct: number
  varianceVsFamilyAvgPct: number
}

type ProductIndicator = {
  label: 'Tx intérêts' | 'Performance'
  ratePct: number | null
  display: string
}

const LIVRET_COLORS = [
  'color-mix(in oklab, var(--color-positive) 88%, var(--neutral-0) 12%)',
  'color-mix(in oklab, var(--color-positive) 74%, var(--neutral-0) 26%)',
  'color-mix(in oklab, var(--color-positive) 60%, var(--neutral-0) 40%)',
  'color-mix(in oklab, var(--color-positive) 46%, var(--neutral-0) 54%)',
] as const

const PLACEMENT_COLORS = [
  'color-mix(in oklab, var(--color-warning) 66%, var(--neutral-0) 34%)',
  'color-mix(in oklab, var(--color-warning) 54%, var(--neutral-0) 46%)',
  'color-mix(in oklab, var(--color-warning) 44%, var(--neutral-0) 56%)',
  'color-mix(in oklab, var(--color-warning) 34%, var(--neutral-0) 66%)',
] as const

function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function hasWord(normalized: string, word: string): boolean {
  const pattern = new RegExp(`\\b${word}\\b`, 'i')
  return pattern.test(normalized)
}

function resolveSavingsFamily(account: AccountWithBalance): SavingsFamily | null {
  const normalized = normalizeLabel(account.name)

  const isPer = hasWord(normalized, 'per') || normalized.includes('plan epargne retraite')
  const isPercol = hasWord(normalized, 'percol') || hasWord(normalized, 'perco') || hasWord(normalized, 'peg') || normalized.includes('capgemini')
  if (
    hasWord(normalized, 'pea')
    || isPer
    || isPercol
    || normalized.includes('placement')
    || normalized.includes('assurance vie')
    || normalized.includes('crypto')
    || normalized.includes('amundi')
    || hasWord(normalized, 'cto')
  ) {
    return 'placements'
  }

  if (normalized.includes('livret') || hasWord(normalized, 'ldds') || hasWord(normalized, 'lep')) {
    return 'livrets'
  }

  if (account.account_type === 'savings') {
    return normalized.includes('epargne') ? 'livrets' : 'placements'
  }

  return null
}

function formatTightEuro(value: number): string {
  return formatEuro(value).replace(/\s+€/u, '€')
}

function formatLegendShare(value: number, total: number): string {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return `${formatTightEuro(value)} (${pct}%)`
}

function formatRatePct(value: number): string {
  return `+${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`
}

function resolveProductIndicator(name: string, family: SavingsFamily): ProductIndicator {
  const normalized = normalizeLabel(name)
  const isPercolOrPeg = hasWord(normalized, 'percol') || hasWord(normalized, 'perco') || hasWord(normalized, 'peg') || normalized.includes('capgemini')

  if (family === 'livrets') {
    if (hasWord(normalized, 'ldds') || normalized.includes('livret a')) {
      return {
        label: 'Tx intérêts',
        ratePct: 1.5,
        display: formatRatePct(1.5),
      }
    }

    return {
      label: 'Tx intérêts',
      ratePct: null,
      display: 'XX%',
    }
  }

  if (hasWord(normalized, 'pea')) {
    return {
      label: 'Performance',
      ratePct: 24,
      display: formatRatePct(24),
    }
  }

  if (isPercolOrPeg) {
    return {
      label: 'Performance',
      ratePct: null,
      display: 'XX%',
    }
  }

  if (hasWord(normalized, 'per') || normalized.includes('plan epargne retraite')) {
    return {
      label: 'Performance',
      ratePct: 1.6,
      display: formatRatePct(1.6),
    }
  }

  return {
    label: 'Performance',
    ratePct: null,
    display: 'XX%',
  }
}

function resolveRateStyle(ratePct: number | null): { color: string; background: string } {
  if (ratePct == null || !Number.isFinite(ratePct)) {
    return {
      color: 'var(--neutral-500)',
      background: 'var(--neutral-100)',
    }
  }

  if (ratePct > 3) {
    return {
      color: 'var(--color-positive)',
      background: 'color-mix(in oklab, var(--color-positive) 14%, var(--neutral-0) 86%)',
    }
  }

  return {
    color: 'var(--color-warning)',
    background: 'color-mix(in oklab, var(--color-warning) 18%, var(--neutral-0) 82%)',
  }
}

function resolveAccountIconSrc(name: string): string {
  const normalized = normalizeLabel(name)
  if (hasWord(normalized, 'joint')) return compteJointIcon
  if (hasWord(normalized, 'pea')) return peaIcon
  if (hasWord(normalized, 'crypto') || hasWord(normalized, 'bitcoin')) return bitcoinIcon
  if (hasWord(normalized, 'peg') || normalized.includes('capgemini')) return pegCapgeminiIcon
  if (
    hasWord(normalized, 'per')
    || hasWord(normalized, 'perco')
    || hasWord(normalized, 'percol')
    || normalized.includes('amundi')
  ) return amundiEpargneIcon
  if (normalized.includes('livret') || hasWord(normalized, 'ldds') || hasWord(normalized, 'lep')) return comptePrincipalIcon
  return comptePrincipalIcon
}

type DonutTooltipProps = {
  active?: boolean
  payload?: Array<{ payload?: SavingsSlice }>
}

function SavingsDonutTooltip({ active, payload }: DonutTooltipProps) {
  if (!active || !payload?.length) return null

  const slice = payload[0]?.payload
  if (!slice) return null

  const indicator = resolveProductIndicator(slice.name, slice.family)
  const indicatorStyle = resolveRateStyle(indicator.ratePct)

  return (
    <div
      style={{
        background: 'var(--neutral-0)',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        padding: '10px 12px',
        minWidth: 164,
      }}
    >
      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--neutral-800)', lineHeight: 1.3 }}>
        {slice.name}
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-400)' }}>Famille</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: slice.family === 'livrets' ? 'var(--color-positive)' : 'var(--color-warning)' }}>
          {slice.family}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-800)' }}>Montant</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--neutral-900)' }}>
          {formatTightEuro(slice.value)}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 6,
          borderTop: '1px solid var(--neutral-100)',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--neutral-400)', flexShrink: 0 }}>{indicator.label}</span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: indicatorStyle.color,
            background: indicatorStyle.background,
            borderRadius: 'var(--radius-full)',
            padding: '2px 6px',
            marginLeft: 'auto',
            flexShrink: 0,
          }}
        >
          {indicator.display}
        </span>
      </div>
    </div>
  )
}

export function SavingsAllocationDonut() {
  const { data: accounts = [], isLoading, error } = useAccounts()
  const [activeSliceId, setActiveSliceId] = useState<string | null>(null)

  const { slices, totalSavings, livretsTotal, placementsTotal } = useMemo(() => {
    const raw = accounts
      .map((account) => {
        const value = Number(account.current_balance ?? 0)
        const family = resolveSavingsFamily(account)
        return {
          id: account.id,
          name: account.name,
          value,
          family,
        }
      })
      .filter((account) => account.family != null && account.value > 0) as Array<{ id: string; name: string; value: number; family: SavingsFamily }>

    if (raw.length === 0) {
      return {
        slices: [] as SavingsSlice[],
        totalSavings: 0,
        livretsTotal: 0,
        placementsTotal: 0,
      }
    }

    const total = raw.reduce((sum, entry) => sum + entry.value, 0)
    const livrets = raw.filter((entry) => entry.family === 'livrets')
    const placements = raw.filter((entry) => entry.family === 'placements')
    const livretsSum = livrets.reduce((sum, entry) => sum + entry.value, 0)
    const placementsSum = placements.reduce((sum, entry) => sum + entry.value, 0)

    const familyColorIndexes: Record<SavingsFamily, number> = {
      livrets: 0,
      placements: 0,
    }

    const computed = [...raw]
      .sort((a, b) => b.value - a.value)
      .map((entry) => {
        const sharePct = total > 0 ? (entry.value / total) * 100 : 0

        const familyTotal = entry.family === 'livrets' ? livretsSum : placementsSum
        const familyCount = entry.family === 'livrets' ? livrets.length : placements.length
        const familyAvgSharePct = familyCount > 0 && total > 0
          ? ((familyTotal / total) * 100) / familyCount
          : 0

        const palette = entry.family === 'livrets' ? LIVRET_COLORS : PLACEMENT_COLORS
        const paletteIndex = familyColorIndexes[entry.family] % palette.length
        familyColorIndexes[entry.family] += 1

        return {
          id: entry.id,
          name: entry.name,
          family: entry.family,
          value: entry.value,
          color: palette[paletteIndex],
          iconSrc: resolveAccountIconSrc(entry.name),
          sharePct,
          familyAvgSharePct,
          varianceVsFamilyAvgPct: sharePct - familyAvgSharePct,
        }
      })

    return {
      slices: computed,
      totalSavings: total,
      livretsTotal: livretsSum,
      placementsTotal: placementsSum,
    }
  }, [accounts])

  if (isLoading) {
    return (
      <StatsSection>
        <SkeletonCard heightClass="h-56" lines={2} />
      </StatsSection>
    )
  }

  if (error) {
    return (
      <StatsSection>
        <EmptyState message="Impossible de charger la répartition de l’épargne pour le moment." />
      </StatsSection>
    )
  }

  if (slices.length === 0) {
    return (
      <StatsSection>
        <EmptyState message="Aucun compte d’épargne ou de placement avec solde positif." />
      </StatsSection>
    )
  }

  return (
    <StatsSection>
      <div
        style={{
          border: '1px solid var(--neutral-150)',
          borderRadius: 'var(--radius-xl)',
          background: 'linear-gradient(160deg, color-mix(in oklab, var(--neutral-0) 92%, var(--neutral-100) 8%) 0%, var(--neutral-0) 100%)',
          boxShadow: 'var(--shadow-card)',
          padding: 'var(--space-4)',
          display: 'grid',
          gap: 'var(--space-4)',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--neutral-900)',
            textAlign: 'left',
          }}
        >
          Répartition de l'épargne
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-3)', alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 2, justifyItems: 'center', textAlign: 'center', minWidth: 0 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: 'color-mix(in oklab, var(--color-positive) 76%, var(--neutral-0) 24%)',
                }}
              />
              <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-800)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                livrets
              </p>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-900)', fontWeight: 700, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
              {formatLegendShare(livretsTotal, totalSavings)}
            </p>
          </div>

          <div style={{ display: 'grid', gap: 2, justifyItems: 'center', textAlign: 'center', minWidth: 0 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: 'color-mix(in oklab, var(--color-warning) 60%, var(--neutral-0) 40%)',
                }}
              />
              <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-800)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                Placement
              </p>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--neutral-900)', fontWeight: 700, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
              {formatLegendShare(placementsTotal, totalSavings)}
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(225px, 1fr))', gap: 'var(--space-4)', alignItems: 'center' }}>
          <div style={{ height: 260, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={66}
                  outerRadius={98}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={2}
                  stroke="var(--neutral-0)"
                  strokeWidth={1}
                  isAnimationActive
                  animationDuration={540}
                  labelLine={false}
                  label={({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }) => {
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
                    const radian = Math.PI / 180
                    const x = cx + radius * Math.cos(-midAngle * radian)
                    const y = cy + radius * Math.sin(-midAngle * radian)
                    const pct = Math.round(percent * 100)
                    if (pct <= 0) return null
                    return (
                      <text
                        x={x}
                        y={y}
                        fill="var(--neutral-0)"
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ fontSize: 10, fontWeight: 800, fontFamily: 'var(--font-mono)', letterSpacing: '0.01em' }}
                      >
                        {`${pct}%`}
                      </text>
                    )
                  }}
                  onMouseEnter={(_, index) => setActiveSliceId(slices[index]?.id ?? null)}
                  onClick={(_, index) => {
                    const clickedId = slices[index]?.id ?? null
                    setActiveSliceId((previous) => (previous === clickedId ? null : clickedId))
                  }}
                  onMouseLeave={() => setActiveSliceId(null)}
                >
                  {slices.map((slice) => {
                    const isActive = slice.id === activeSliceId
                    return (
                      <Cell
                        key={slice.id}
                        fill={slice.color}
                        fillOpacity={activeSliceId == null || isActive ? 1 : 0.45}
                        stroke={isActive ? 'var(--neutral-900)' : 'var(--neutral-0)'}
                        strokeWidth={isActive ? 2 : 1}
                        style={isActive ? { filter: 'brightness(1.02)', cursor: 'pointer' } : { cursor: 'pointer' }}
                      />
                    )
                  })}
                </Pie>
                <Tooltip
                  content={<SavingsDonutTooltip />}
                  wrapperStyle={{ zIndex: 2000, pointerEvents: 'none' }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <div style={{ display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 2 }}>
                <p style={{ margin: 0, fontSize: 10, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>Épargne totale</p>
                <p style={{ margin: 0, fontSize: 16, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{formatTightEuro(totalSavings)}</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '6px' }}>
            <div
              aria-hidden="true"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 52px 92px',
                alignItems: 'center',
                padding: '0 2px',
              }}
            >
              <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontWeight: 600, textAlign: 'left' }}>
                <span style={{ display: 'inline-block', paddingLeft: 22 }}>portefeuille</span>
              </span>
              <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontWeight: 600, textAlign: 'center', transform: 'translateX(6px)' }}>
                poids
              </span>
              <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontWeight: 600, textAlign: 'right' }}>
                montant
              </span>
            </div>

            {slices.map((slice) => {
              const isActive = slice.id === activeSliceId
              return (
                <button
                  key={slice.id}
                  type="button"
                  onClick={() => setActiveSliceId((previous) => (previous === slice.id ? null : slice.id))}
                  style={{
                    border: 'none',
                    borderRadius: 0,
                    background: isActive ? 'var(--neutral-50)' : 'var(--neutral-0)',
                    padding: '4px 2px',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 52px 92px',
                    alignItems: 'center',
                    columnGap: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all var(--transition-base)',
                    lineHeight: 1.1,
                  }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <img
                      src={slice.iconSrc}
                      alt=""
                      width={16}
                      height={16}
                      aria-hidden="true"
                      style={{ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 }}
                      loading="lazy"
                      decoding="async"
                    />
                    <span style={{ fontSize: 11, color: 'var(--neutral-800)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {slice.name}
                    </span>
                  </div>

                  <span style={{ fontSize: 11, color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)', fontWeight: 500, textAlign: 'center', whiteSpace: 'nowrap', transform: 'translateX(6px)' }}>
                    {`${Math.round(slice.sharePct)}%`}
                  </span>

                  <span style={{ fontSize: 11, color: 'var(--neutral-900)', fontFamily: 'var(--font-mono)', fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {formatTightEuro(slice.value)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </StatsSection>
  )
}
