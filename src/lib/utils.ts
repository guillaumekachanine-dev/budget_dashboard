const FMT_EUR_2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const FMT_EUR_0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
const FMT_EUR_ADAPTIVE = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 })
const FMT_EUR_COMPACT = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 })

export function formatCurrency(amount: number, currency = 'EUR'): string {
  if (currency !== 'EUR') {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  }
  return FMT_EUR_2.format(amount)
}

export function formatCurrencyRounded(amount: number, currency = 'EUR'): string {
  if (currency !== 'EUR') {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
  }
  return FMT_EUR_0.format(amount)
}

export function formatCurrencyFloored(amount: number): string {
  if (!Number.isFinite(amount)) return FMT_EUR_0.format(0)
  return FMT_EUR_0.format(Math.floor(amount))
}

export function formatCurrencyAdaptive(amount: number): string {
  if (!Number.isFinite(amount)) return '–'
  return FMT_EUR_ADAPTIVE.format(amount)
}

export function formatCompact(amount: number): string {
  if (Math.abs(amount) >= 1000) return FMT_EUR_COMPACT.format(amount)
  return FMT_EUR_2.format(amount)
}

export function getCurrentPeriod(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function getMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })
}

export function getDaysRemainingInMonth(): number {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return lastDay.getDate() - now.getDate()
}

export function getDailyBudgetRate(remaining: number): number {
  const daysLeft = getDaysRemainingInMonth()
  if (daysLeft <= 0) return 0
  return remaining / daysLeft
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'bg-negative'
  if (percentage >= 80) return 'bg-warning'
  if (percentage >= 60) return 'bg-info'
  return 'bg-positive'
}

export function getProgressBarClass(percentage: number): string {
  if (percentage >= 100) return 'red'
  if (percentage >= 80) return 'orange'
  return 'blue'
}

export function accountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    checking: 'Compte courant',
    savings: 'Épargne',
    credit_card: 'Carte de crédit',
    cash: 'Espèces',
    other: 'Autre',
  }
  return labels[type] ?? type
}

export function accountTypeInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const ACCOUNT_COLORS: Record<string, string> = {
  checking: '#5B57F5',
  savings:  '#2ED47A',
  credit_card: '#FC5A5A',
  cash:     '#FFAB2E',
  other:    '#9898B3',
}

export const CATEGORY_COLOR_MAP: Record<string, string> = {
  logement:     '#1D3F8F',
  alimentation: '#35C17B',
  divers:       '#FDAA1B',
  sorties:      '#FB5534',
  voyages:      '#2B94FF',
  transport:    '#FA8728',
  famille:      '#D98880',
  business:     '#8B7954',
  abonnements:  '#8B51D0',
  sante:        '#E82665',
  taxes:        '#6B6B6B',
  epargne:      '#12B4A9',
}

function categoryKeyFromName(name: string): string | null {
  const n = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (n.includes('logement')) return 'logement'
  if (n.includes('alimentat')) return 'alimentation'
  if (n.includes('divers') || (n.includes('achat') && !n.includes('abonnement'))) return 'divers'
  if (n.includes('sorti')) return 'sorties'
  if (n.includes('voyage')) return 'voyages'
  if (n.includes('transport')) return 'transport'
  if (n.includes('famille') || n.includes('enfant')) return 'famille'
  if (n.includes('business')) return 'business'
  if (n.includes('abonn')) return 'abonnements'
  if (n.includes('sant')) return 'sante'
  if (n.includes('tax') || n.includes('impot') || (n.includes('frais') && !n.includes('transport'))) return 'taxes'
  if (n.includes('epargn')) return 'epargne'
  return null
}

export function categoryColorFromName(name: string | null | undefined): string {
  if (!name) return '#9898A6'
  const key = categoryKeyFromName(name)
  if (key) return CATEGORY_COLOR_MAP[key]
  const colors = Object.values(CATEGORY_COLOR_MAP)
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i)
  return colors[Math.abs(hash) % colors.length]
}

export function getCategoryColor(colorToken: string | null, index = 0, name?: string): string {
  if (name) return categoryColorFromName(name)
  if (colorToken && CATEGORY_COLOR_MAP[colorToken]) return CATEGORY_COLOR_MAP[colorToken]
  const fallbacks = Object.values(CATEGORY_COLOR_MAP)
  return fallbacks[index % fallbacks.length]
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getTxLabel(tx: { normalized_label?: string | null; raw_label?: string | null }): string {
  return (tx.normalized_label ?? tx.raw_label ?? 'Opération').trim() || 'Opération'
}

export function formatCategoryModalLabel(name: string): string {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (normalized.includes('famille') && normalized.includes('enfant')) return 'Famille\nenfant'
  if (normalized.includes('achats') && normalized.includes('divers')) return 'Achats\ndivers'
  if (normalized.includes('frais') && normalized.includes('impot')) return 'Frais\nimpôts'
  return name
}
