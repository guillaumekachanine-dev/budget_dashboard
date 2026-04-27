const iconModules = import.meta.glob('../../icones_categories_budget/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' et ')
    .replace(/[_\s-]+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

const categoryIconMap = Object.entries(iconModules).reduce<Record<string, string>>((acc, [path, src]) => {
  const fileName = path.split('/').pop()?.replace(/\.png$/i, '') ?? ''
  const key = normalizeKey(fileName)
  if (key) acc[key] = src
  return acc
}, {})

const aliasMap: Record<string, string> = {
  alimentaire: 'alimentation',
  alimentationcourses: 'alimentation',
  courses: 'alimentation',
  fraisbancaires: 'fraisbancairesimpots',
  impots: 'fraisbancairesimpots',
  impotsfraisbancaires: 'fraisbancairesimpots',
  famille: 'familleenfant',
  enfants: 'familleenfant',
  enfant: 'familleenfant',
  shopping: 'achatsdivers',
  achats: 'achatsdivers',
  loisirsculture: 'loisirs',
  transportmobilite: 'transport',
  santebienetre: 'sante',
}

export function getCategoryIconSrc(categoryName?: string | null): string | null {
  if (!categoryName) return null

  const key = normalizeKey(categoryName)
  if (!key) return null

  const direct = categoryIconMap[key]
  if (direct) return direct

  const alias = aliasMap[key]
  if (alias && categoryIconMap[alias]) return categoryIconMap[alias]

  return null
}
