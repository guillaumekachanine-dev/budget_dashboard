// Couleurs des buckets — valeurs hex alignées sur les tokens CSS du design system
export const BUCKET_COLORS: Record<string, string> = {
  socle_fixe: '#5B57F5',           // --primary-500
  variable_essentielle: '#4CC9F0', // --viz-a
  provision: '#FFAB2E',            // --color-warning
  discretionnaire: '#FF9F43',      // --viz-c
  cagnotte_projet: '#2ED47A',      // --color-success
  hors_pilotage: '#FC5A5A',        // --color-error
}

export const BUCKET_LABELS: Record<string, string> = {
  socle_fixe: 'Socle fixe',
  variable_essentielle: 'Variable ess.',
  provision: 'Provision',
  discretionnaire: 'Discrétionnaire',
  cagnotte_projet: 'Cagnotte projet',
  hors_pilotage: 'Hors pilotage',
}

export const BUCKET_ORDER = [
  'socle_fixe',
  'variable_essentielle',
  'provision',
  'discretionnaire',
  'cagnotte_projet',
  'hors_pilotage',
]

// Palette data-viz pour catégories (ordre décroissant par montant)
export const VIZ_PALETTE = [
  '#5B57F5', // primary-500
  '#4CC9F0', // viz-a
  '#2ED47A', // success
  '#FFAB2E', // warning
  '#FC5A5A', // error
  '#FF9F43', // viz-c
  '#40E0D0', // viz-b
  '#8BC34A', // viz-d
  '#A29BFE', // cat-education
  '#B0BEC5', // viz-e
]

// Styles par niveau d'insight
export const LEVEL_CONFIG = {
  info: {
    accent: 'var(--color-info)',
    bg: 'color-mix(in oklab, var(--color-info) 7%, var(--neutral-0) 93%)',
    label: 'Info',
  },
  success: {
    accent: 'var(--color-success)',
    bg: 'color-mix(in oklab, var(--color-success) 7%, var(--neutral-0) 93%)',
    label: 'Positif',
  },
  warning: {
    accent: 'var(--color-warning)',
    bg: 'color-mix(in oklab, var(--color-warning) 10%, var(--neutral-0) 90%)',
    label: 'Attention',
  },
  alert: {
    accent: 'var(--color-error)',
    bg: 'color-mix(in oklab, var(--color-error) 7%, var(--neutral-0) 93%)',
    label: 'Alerte',
  },
} as const

export const MONTH_LABELS_SHORT = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
]

export function getMonthShortLabel(month: number): string {
  return MONTH_LABELS_SHORT[month - 1] ?? `M${month}`
}

export const CHART_TOOLTIP_STYLE = {
  background: '#fff',
  border: 'none',
  borderRadius: 12,
  boxShadow: '0 8px 20px rgba(28,28,58,0.14)',
  padding: '8px 10px',
  fontSize: 12,
}
