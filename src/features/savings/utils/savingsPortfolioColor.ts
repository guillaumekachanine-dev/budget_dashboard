type ResolveSavingsPortfolioColorInput = {
  key?: string | null
  label?: string | null
  savingsKind?: string | null
  fallbackColor?: string
}

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

export function resolveSavingsPortfolioColor({
  key,
  label,
  savingsKind,
  fallbackColor = '#5B57F5',
}: ResolveSavingsPortfolioColorInput): string {
  const normalizedKey = normalizeLabel(key ?? '')
  const normalizedKind = normalizeLabel(savingsKind ?? '')
  const normalizedLabelValue = normalizeLabel(label ?? '')
  const combined = [normalizedKey, normalizedKind, normalizedLabelValue].filter(Boolean).join(' ')

  if (combined.includes('livret a') || hasWord(combined, 'livret_a') || hasWord(combined, 'liva')) return '#1D4ED8'
  if (hasWord(combined, 'ldds')) return '#16A34A'
  if (hasWord(combined, 'pea')) return '#C026D3'
  if (hasWord(combined, 'bitcoin') || hasWord(combined, 'btc') || hasWord(combined, 'crypto')) return '#CA8A04'
  if (hasWord(combined, 'per') || combined.includes('plan epargne retraite')) return '#C1121F'
  if (hasWord(combined, 'peg') || hasWord(combined, 'percol') || combined.includes('capgemini')) return '#B45309'
  if (hasWord(combined, 'lep')) return '#0F766E'

  return fallbackColor
}
