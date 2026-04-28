export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatCurrencyRounded(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatCompact(amount: number): string {
  if (Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  }
  return formatCurrency(amount)
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
  transport: '#FF6B6B',
  food:      '#FFB347',
  sport:     '#4ECDC4',
  education: '#A29BFE',
  entertain: '#FD79A8',
  household: '#6C5CE7',
  bills:     '#00B894',
  subscript: '#E17055',
}

export function getCategoryColor(colorToken: string | null, index = 0): string {
  if (colorToken && CATEGORY_COLOR_MAP[colorToken]) return CATEGORY_COLOR_MAP[colorToken]
  const fallbacks = Object.values(CATEGORY_COLOR_MAP)
  return fallbacks[index % fallbacks.length]
}
