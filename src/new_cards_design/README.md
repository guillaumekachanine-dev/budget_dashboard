# Handoff : Insight Cards — Budget Analytics

## Vue d'ensemble

Redesign complet de la section "cartes insights" du tab `BudgetsAnalyticsTab`.  
Deux états par carte : **replié** (KPI principal visible) et **déplié** (KPIs secondaires + graphique).

---

## À propos des fichiers de design

Les fichiers HTML fournis (`Budget Insights.html`) sont des **prototypes de référence haute fidélité** — ils montrent l'aspect et le comportement attendus, mais ne sont pas du code production.

La tâche est de **recréer ce design dans la codebase existante** (React + TypeScript + Framer Motion + Recharts) en utilisant ses patterns établis. Le fichier `InsightCards.tsx` fourni est un point de départ avec les TODO à compléter.

## Fidélité

**Haute fidélité** — couleurs exactes, typographie, espacement et interactions à respecter au pixel près. Les graphiques peuvent utiliser les composants Recharts existants (voir section Graphiques).

---

## Structure des composants

```
BudgetsAnalyticsTab
└── InsightSection           (remplace l'actuel rendu de cartes)
    ├── InsightRow            (rangée de 2 cartes + panneau déplié)
    │   ├── InsightCard       (carte repliée — NOUVEAU design)
    │   └── ExpandedPanel     (panneau déplié — reprend hooks existants)
    │       ├── KpiRow        (3 métriques sans boîtes — NOUVEAU)
    │       └── [Chart]       (composants Recharts existants, re-stylisés)
    └── InsightRow            (2e rangée)
```

---

## Palette de couleurs

Ajouter dans ton fichier de tokens global :

```css
/* insight-tokens.css — voir fichier joint */
--color-bordeaux:      #7c2130;  /* signal critique  */
--color-petrol:        #1a5c74;  /* vigilance / ref 2025 */
--color-cyan-insight:  #0097b2;  /* projections 2026 */
--color-teal-insight:  #1d7a6d;  /* valeur positive  */
```

Usage : critique → bordeaux, vigilance → pétrol. Utiliser avec **parcimonie** (valeur chiffrée, strip top, sparkline). Pas de backgrounds colorés.

---

## Carte repliée — `InsightCard`

### Layout (mobile-first, ~200px wide)

```
┌── strip 2px (bordeaux ou pétrol) ──────────────────┐
│                                                      │
│  CRITIQUE                          [badge 8px 700]   │
│                                                      │
│  −87%                              [DM Mono 52px]    │
│                                                      │
│  épargne YTD                       [12px muted]      │
│                                                      │
│  〰〰〰 (sparkline 52×20px)        [▼ circle 28px]  │
└──────────────────────────────────────────────────────┘
```

### États

| Propriété CSS | Replié | Déplié |
|---|---|---|
| `border` | `1px solid #e6e9ef` | `1px solid #0d1117` |
| `box-shadow` | `0 1px 4px rgba(0,0,0,0.04)` | `0 4px 24px rgba(0,0,0,0.07)` |
| Strip top | couleur signal | `#0d1117` |
| Bouton bg | `#f0f2f5` | `#0d1117` |
| Chevron | gris, pointant bas | blanc, pointant haut |
| Sparkline | couleur signal | `#adb5c0` (dim) |

### Hover
```css
transform: translateY(-3px);
box-shadow: 0 12px 36px rgba(0,0,0,0.09);
transition: 0.22s ease;
```

---

## KPI Row (sans boîtes) — `KpiRow`

Remplace les chips actuels avec bordures. Layout :

```
─────────────────────────────────────────── (1px divider top)
  REVENUS        │    DÉPENSES      │    ÉPARGNE
   −81%          │     +9%          │    −87%
  hors jan.      │     YTD          │    YTD
─────────────────────────────────────────── (1px divider bottom)
```

- Grid 3 colonnes égales
- Séparateurs verticaux `1px solid var(--color-divider)` entre colonnes
- Valeur : `DM Mono 20px 600`, couleur signal de la métrique
- Label : `8.5px 700 uppercase tracking-wide`, `color: var(--muted)`
- Note : `9px`, `color: var(--dim)`
- Padding vertical : `22px 0`

---

## Panneau déplié — animation

Utilise Framer Motion (déjà installé) :

```tsx
<AnimatePresence>
  {expandedCard && (
    <motion.div
      key={expandedCard.id}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
      style={{ overflow: 'hidden' }}
    >
      {/* panel content */}
    </motion.div>
  )}
</AnimatePresence>
```

Le panneau lui-même :
```css
background: var(--neutral-0);
border-radius: var(--radius-xl);   /* ~20px */
padding: 28px 22px 24px;
box-shadow: 0 2px 28px rgba(0,0,0,0.07);
/* Pas de border visible */
```

---

## Graphiques — restyler Recharts existants

Les graphiques existants (`IncomeFullYearProjectedChart`, `SavingsInsightKpis`) sont **conservés**. Appliquer ces surcharges de style :

```tsx
// Couleurs séries
const CHART_COLORS = {
  ref2025:    '#b8d4df',   // pétrol teinté, remplace les gris actuels
  actual2026: '#0097b2',   // cyan pour revenus 2026
  savings:    '#7c2130',   // bordeaux pour épargne
  expenses:   '#1a5c74',   // pétrol pour dépenses
  projection: '#0097b2',   // cyan dashed
}

// CartesianGrid
<CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" vertical={false} />

// Axes (plus légers)
<XAxis tick={{ fontSize: 9, fill: '#adb5c0', fontFamily: 'var(--font-mono)' }} />
<YAxis tick={{ fontSize: 9, fill: '#adb5c0', fontFamily: 'var(--font-mono)' }} />
```

**Supprimer** le `<div>` wrapper avec `border` et `background` autour de chaque graphique — le chart flotte directement sur le fond du panneau.

---

## Sparkline

Mini SVG path, tracé à partir des données YTD :

```tsx
// Données pour chaque carte (calculées depuis les hooks réels) :
savings_spark  = [savings_m1, savings_m2, savings_m3, savings_m4]  // en % relatif
income_spark   = [income_m1, income_m2, income_m3, income_m4]
achats_spark   = [achats_m1, achats_m2, achats_m3, achats_m4]
transport_spark= [transport_m1, transport_m2, transport_m3, transport_m4]

// W=52, H=20, strokeWidth=1.8, strokeLinecap="round"
// Normaliser entre min et max pour remplir la hauteur
```

---

## Typographie — DM Mono

Ajouter dans `index.html` ou `_document.tsx` si pas encore présent :

```html
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

Puis dans les tokens :
```css
--font-mono: 'DM Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
```

---

## Fichiers fournis

| Fichier | Rôle |
|---|---|
| `Budget Insights.html` | Prototype de référence — ouvrir dans un navigateur |
| `InsightCards.tsx` | Composants TypeScript avec TODO à compléter |
| `insight-tokens.css` | Tokens CSS à ajouter au fichier global |

---

---

## Mode sombre

Activer via la classe `.dark` sur `<html>` (ou ton sélecteur existant).  
Tous les tokens `--insight-*` basculent automatiquement via le fichier `insight-tokens.css`.

Seul ajustement à faire en JS : les couleurs **signal** utilisent la variante `muted` en dark pour éviter le contraste trop violent :

```tsx
const signalColor = (signal: 'bordeaux' | 'petrol', isDark: boolean) => {
  if (signal === 'bordeaux') return isDark ? '#a84455' : '#7c2130'
  return isDark ? '#2a7a96' : '#1a5c74'
}
```

Récupérer `isDark` depuis ton contexte de thème existant (ex: `useTheme()`, `data-theme`, class sur `<html>`).

---

## Mode compact

Réduction légère de la densité — adapté mobile ou panneau latéral étroit.

### Différences compact vs comfortable

| Propriété | comfortable (défaut) | compact |
|---|---|---|
| Card padding | `22px 18px 17px` | `18px 16px 15px` |
| Valeur KPI font-size | `clamp(42px, 11.5vw, 54px)` | `clamp(36px, 10vw, 44px)` |
| Label font-size | `12px` | `10.5px` |
| Card gap | `13px` | `10px` |
| Row gap | `14px` | `10px` |
| Panel padding | `28px 22px 24px` | `20px 18px 18px` |
| KpiRow padding | `22px 0` | `16px 0` |
| Section gap | `30px` | `20px` |
| Header margin-bottom | `40px` | `28px` |

### Implémentation

```tsx
// Passer compact en prop depuis le parent
<InsightSection compact={density === 'compact'} />

// Dans chaque composant, appliquer les overrides conditionnels :
padding: compact ? '18px 16px 15px' : '22px 18px 17px'
fontSize: compact ? 'clamp(36px,10vw,44px)' : 'clamp(42px,11.5vw,54px)'
gap: compact ? 10 : 14
```

L'état compact est une **prop passée en cascade** depuis `InsightSection` jusqu'aux feuilles. Pas de Context nécessaire.

---

## Intégration dans `BudgetsAnalyticsTab.tsx`

Remplacer les sections `InsightCard` et `RepartitionInsightCard` + leurs panneaux par le nouveau `InsightSection`. Les hooks de données existants (`useComparedAnalysis`, `useSavingsAnalytics`, `useBudgetRevenueAnalytics`, etc.) restent inchangés — seuls les composants de présentation changent.
