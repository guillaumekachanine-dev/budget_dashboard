const MONTH_SHORT_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'] as const

export function asFiniteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function formatEuro(value: number | null | undefined): string {
  const numeric = asFiniteNumber(value)
  if (numeric == null) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numeric)
}

export function formatEuroPerMonth(value: number | null | undefined): string {
  const amount = formatEuro(value)
  if (amount === '—') return amount
  return `${amount} / mois`
}

export function formatEuroPerYear(value: number | null | undefined): string {
  const amount = formatEuro(value)
  if (amount === '—') return amount
  return `${amount} / an`
}

export function formatPercent(value: number | null | undefined): string {
  const numeric = asFiniteNumber(value)
  if (numeric == null) return '—'
  const normalized = Math.abs(numeric) <= 1 ? numeric * 100 : numeric
  return `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(normalized)} %`
}

export function formatInteger(value: number | null | undefined): string {
  const numeric = asFiniteNumber(value)
  if (numeric == null) return '—'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(numeric)
}

export function formatScore(value: number | null | undefined): string {
  const numeric = asFiniteNumber(value)
  if (numeric == null) return '—'
  const normalized = Math.abs(numeric) <= 1 ? numeric * 100 : numeric
  return `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(normalized)} / 100`
}

export function formatMonths(value: number | null | undefined): string {
  const numeric = asFiniteNumber(value)
  if (numeric == null) return '—'
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(numeric)
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function resolveMonthShort(month: number | null | undefined): string | null {
  const numeric = asFiniteNumber(month)
  if (numeric == null || numeric < 1 || numeric > 12) return null
  return MONTH_SHORT_FR[numeric - 1] ?? null
}

export function formatMonthLabel(periodMonth: number | null | undefined, periodYear: number | null | undefined): string {
  const month = asFiniteNumber(periodMonth)
  if (month != null && month >= 1 && month <= 12) {
    const label = MONTH_SHORT_FR[month - 1] ?? '—'
    const year = asFiniteNumber(periodYear)
    return year == null ? label : `${label} ${year}`
  }

  return '—'
}

export function formatMonthLabelFromDate(dateRaw: string | null | undefined): string {
  if (!dateRaw) return '—'
  const date = new Date(dateRaw)
  if (Number.isNaN(date.getTime())) return '—'
  const label = MONTH_SHORT_FR[date.getMonth()] ?? '—'
  return `${label} ${date.getFullYear()}`
}

export function extractYearFromDate(dateRaw: string | null | undefined): number | null {
  if (!dateRaw) return null
  const date = new Date(dateRaw)
  if (Number.isNaN(date.getTime())) return null
  return date.getFullYear()
}

export function formatSignedEuro(value: number | null | undefined): string {
  const numeric = asFiniteNumber(value)
  if (numeric == null) return '—'
  const sign = numeric > 0 ? '+' : ''
  return `${sign}${formatEuro(numeric)}`
}
