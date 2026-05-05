// ─── Buckets ──────────────────────────────────────────────────────────────────

export const BUCKET_COLORS: Record<string, string> = {
  socle_fixe:           '#5B57F5', // --primary-500
  variable_essentielle: '#4CC9F0', // --viz-a
  provision:            '#FFAB2E', // --color-warning
  discretionnaire:      '#FF9F43', // --viz-c
  cagnotte_projet:      '#2ED47A', // --color-success
  hors_pilotage:        '#FC5A5A', // --color-error
}

export const BUCKET_LABELS: Record<string, string> = {
  socle_fixe:           'Socle fixe',
  variable_essentielle: 'Variable essentielle',
  provision:            'Provisions',
  discretionnaire:      'Discrétionnaire',
  epargne:              'Épargne',
  revenu:               'Revenus',
  hors_pilotage:        'Hors pilotage',
}

export const PILOTAGE_BUCKET_ORDER = [
  'socle_fixe',
  'variable_essentielle',
  'discretionnaire',
  'provision',
  'epargne',
] as const

export const TECHNICAL_BUCKETS = [
  'revenu',
  'hors_pilotage',
] as const

export const BUCKET_ORDER = [
  ...PILOTAGE_BUCKET_ORDER,
  ...TECHNICAL_BUCKETS,
] as const

// ─── Palette data-viz ─────────────────────────────────────────────────────────

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

// ─── Insight levels ───────────────────────────────────────────────────────────

export const LEVEL_CONFIG = {
  info: {
    accent:      '#5B57F5',
    accentVar:   'var(--color-info)',
    bg:          'color-mix(in oklab, var(--color-info) 7%, var(--neutral-0) 93%)',
    border:      'color-mix(in oklab, var(--color-info) 20%, transparent 80%)',
    label:       'Info',
  },
  success: {
    accent:      '#2ED47A',
    accentVar:   'var(--color-success)',
    bg:          'color-mix(in oklab, var(--color-success) 7%, var(--neutral-0) 93%)',
    border:      'color-mix(in oklab, var(--color-success) 20%, transparent 80%)',
    label:       'Positif',
  },
  warning: {
    accent:      '#FFAB2E',
    accentVar:   'var(--color-warning)',
    bg:          'color-mix(in oklab, var(--color-warning) 10%, var(--neutral-0) 90%)',
    border:      'color-mix(in oklab, var(--color-warning) 25%, transparent 75%)',
    label:       'Attention',
  },
  alert: {
    accent:      '#FC5A5A',
    accentVar:   'var(--color-error)',
    bg:          'color-mix(in oklab, var(--color-error) 7%, var(--neutral-0) 93%)',
    border:      'color-mix(in oklab, var(--color-error) 20%, transparent 80%)',
    label:       'Alerte',
  },
} as const

// ─── Mois ────────────────────────────────────────────────────────────────────

export const MONTH_LABELS_SHORT = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
]

export function getMonthShortLabel(month: number): string {
  return MONTH_LABELS_SHORT[month - 1] ?? `M${month}`
}

// ─── Formatage ───────────────────────────────────────────────────────────────

/** Convertit un ratio Supabase (ex: 0.2077) en pourcentage affiché (ex: "20,8") */
export function formatPct(ratio: number): string {
  return (ratio * 100).toFixed(1)
}

// ─── Styles partagés ─────────────────────────────────────────────────────────

export const CHART_TOOLTIP_STYLE = {
  background: '#fff',
  border: 'none',
  borderRadius: 12,
  boxShadow: '0 8px 20px rgba(28,28,58,0.14)',
  padding: '8px 10px',
  fontSize: 12,
}

export const CARD_BASE: React.CSSProperties = {
  background: 'var(--neutral-0)',
  borderRadius: 'var(--radius-2xl)',
  boxShadow: 'var(--shadow-card)',
  border: '1px solid var(--neutral-150)',
  padding: 'var(--space-5)',
}

export const SECTION_TITLE: React.CSSProperties = {
  margin: '0 0 var(--space-3)',
  fontSize: 'var(--font-size-base)',
  fontWeight: 'var(--font-weight-bold)',
  color: 'var(--neutral-500)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
}
