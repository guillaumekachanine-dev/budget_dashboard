const categoryIconModules = import.meta.glob(
  "../assets/icons/categories/*.{png,PNG,svg,SVG,webp,WEBP}",
  {
    eager: true,
    query: "?url",
    import: "default",
  }
) as Record<string, string>;

const fallbackIconModules = import.meta.glob(
  "../assets/icons/fallback/*.{png,PNG,svg,SVG,webp,WEBP}",
  {
    eager: true,
    query: "?url",
    import: "default",
  }
) as Record<string, string>;

function normalizeIconKey(value?: string | null): string {
  if (!value) return "";

  return value
    .split("/")
    .pop()!
    .replace(/(\.png|\.svg|\.webp)+$/gi, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "_")
    .replace(/&/g, "et")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function buildRegistry(modules: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(modules).map(([path, url]) => {
      const key = normalizeIconKey(path);
      return [key, url];
    })
  );
}

const categoryIconRegistry = buildRegistry(categoryIconModules);
const fallbackIconRegistry = buildRegistry(fallbackIconModules);

const ICON_ALIASES: Record<string, string> = {
  achats_divers_ecommerce: "achats_divers_e_commerce",
  achats_divers_retrait_especes: "achats_divers_retrait_d_especes",

  alimentation_rapide: "alimentation_alimentation_rapide",
  alimentation_petits_achats: "alimentation_petits_achats_alimentaires",

  famille_enfant_creche_garde: "famille_enfant_creche",
  famille_enfant_divers: "famille_enfant_divers_enfant",
  famille_enfant_vetements: "famille_enfant_vetements_enfant",

  logement_internet: "logement_internet_logement",

  sante_medecin_soins: "sante_medecin_soin",

  taxes_frais: "frais_impots",
  taxes_frais_bancaires: "taxes_frais_frais_bancaires",
  taxes_impots: "taxes_frais_impots",

  voyages_activites: "voyages_activite_voyage",
  voyages_froustilles: "voyages_froustilles_voyage",
  voyages_logement: "voyages_logement_voyage",
  voyages_repas: "voyages_repas_voyage",
  voyages_trajet: "voyages_trajet_voyage",
};

function getFallbackIconUrl(): string {
  return (
    fallbackIconRegistry.default_category ??
    categoryIconRegistry.toutes_categories ??
    ""
  );
}

export function getCategoryIconUrl(iconKey?: string | null): string {
  const normalizedKey = normalizeIconKey(iconKey);

  if (!normalizedKey) {
    return getFallbackIconUrl();
  }

  const directMatch = categoryIconRegistry[normalizedKey];

  if (directMatch) {
    return directMatch;
  }

  const aliasKey = ICON_ALIASES[normalizedKey];

  if (aliasKey) {
    const normalizedAliasKey = normalizeIconKey(aliasKey);
    return categoryIconRegistry[normalizedAliasKey] ?? getFallbackIconUrl();
  }

  return getFallbackIconUrl();
}

export function getCategoryIconSrc(iconKey?: string | null): string {
  return getCategoryIconUrl(iconKey);
}

export function hasCategoryIcon(iconKey?: string | null): boolean {
  const normalizedKey = normalizeIconKey(iconKey);

  if (!normalizedKey) {
    return false;
  }

  if (categoryIconRegistry[normalizedKey]) {
    return true;
  }

  const aliasKey = ICON_ALIASES[normalizedKey];

  if (!aliasKey) {
    return false;
  }

  return Boolean(categoryIconRegistry[normalizeIconKey(aliasKey)]);
}
