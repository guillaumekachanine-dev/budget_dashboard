export type BudgetBucketColorKey =
  | 'socle_fixe'
  | 'variable_essentielle'
  | 'discretionnaire'
  | 'provision'
  | 'voyage'
  | 'revenu'
  | 'epargne'
  | 'hors_pilotage'
  | 'cagnotte'

// Source de vérité pour les couleurs des blocs/socles dans toute l'app.
export const BUDGET_BUCKET_COLORS: Record<BudgetBucketColorKey, string> = {
  socle_fixe: 'var(--bucket-socle-fixe)',
  variable_essentielle: 'var(--bucket-variable-essentielle)',
  discretionnaire: 'var(--bucket-discretionnaire)',
  provision: 'var(--bucket-provision)',
  voyage: 'var(--bucket-voyage)',
  revenu: 'var(--bucket-revenu)',
  epargne: 'var(--bucket-epargne)',
  hors_pilotage: 'var(--bucket-hors-pilotage)',
  cagnotte: 'var(--bucket-cagnotte)',
}

export function getBudgetBucketColor(bucket: string | null | undefined, fallback = 'var(--neutral-400)'): string {
  if (!bucket) return fallback
  return (BUDGET_BUCKET_COLORS as Record<string, string>)[bucket] ?? fallback
}
