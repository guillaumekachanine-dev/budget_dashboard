# 🎯 Quick Reference — Page Home Structure

## Modules à refondre (IMMUABLES)

### 1️⃣ PageHeader
- **Contenu** : Titre "Accueil" + Nom compte courant + Icône compte
- **Interaction** : Clic icône → Modale sélection compte (carrousel)
- **Note** : Header sticky ou scrollable (à définir dans refonte)

### 2️⃣ Hero Section (Contextuel par type de compte)

#### Compte chèques principal
```
┌──────────────────┬──────────────────┐
│ Reste utile      │ Solde au J       │
│ + Budget/jour    │ + (gradient)     │
├──────────────────┴──────────────────┤
│ Budget Global %  │ Dérives (count)  │
│ (progress ring)  │ (warning tile)   │
└──────────────────┴──────────────────┘
```

#### Comptes épargne (Livret A, LDDS, etc.)
```
┌──────────────────────────────┐
│  SOLDE (grand, centré)       │
│  Pourcentage plafond         │
├──────────────────────────────┤
│  Métriques 2×2 (taux, etc.)  │
└──────────────────────────────┘
```

#### Comptes placements (PEA, PER, etc.)
```
┌──────────────────────────────┐
│  SOLDE (grand, centré)       │
├──────────────────────────────┤
│  Métriques 2×2 (perf, etc.)  │
└──────────────────────────────┘
```

### 3️⃣ Trajectoire Chart
- **Type** : Graphique linéaire (Recharts)
- **Axe X** : Jours du mois
- **Axe Y** : Soldes
- **Ligne 1** : Solde réel (jusqu'à aujourd'hui)
- **Ligne 2** : Prévision fin de mois
- **Visible sur** : Compte principal UNIQUEMENT

### 4️⃣ Planned Windows (J+3, J+7)
```
┌───────────────────┬───────────────────┐
│ J+3               │ J+7               │
│ 2 opé. / 145€     │ 4 opé. / 320€     │
└───────────────────┴───────────────────┘
```
- **Visible sur** : Compte principal uniquement
- **Contenu** : Opérations planifiées dans les N jours

### 5️⃣ Savings Tile (Épargne)
```
┌──────────────────┐
│ ÉPARGNE          │
│ ✓ (ou ✕)         │
│ (status badge)   │
└──────────────────┘
```
- **Cliquable** → Modale "Détail épargne"
- **Status** : Validated (vert ✓) / Pending (gris ✕) / Alert (rouge ✕)
- **Visible sur** : Tous les comptes (layout adapté)

### 6️⃣ Drifts Tile (Catégories en dérive)
```
┌──────────────────┐
│ DÉRIVES          │
│          3       │
│ (warning style)  │
└──────────────────┘
```
- **Cliquable** → Modale "Catégories en dérive"
- **Contenu** : Nombre de catégories dépassant budget
- **Visible sur** : Compte principal (bas) + autres comptes (optionnel)

### 7️⃣ Optimizations Tile (Mosaic 3 colonnes)
```
┌─────────┬─────────┬─────────┐
│ Retraits│ Café    │ Petits  │
│ Gauge   │ Gauge   │ Gauge   │
│ 145€/420│ 92€/300 │ 0€/360  │
└─────────┴─────────┴─────────┘
```
- **Cliquable** → Modale "Détail optimisations"
- **Gauge** : SVG custom avec aiguille (3 zones : vert/jaune/rouge)
- **Visible sur** : Compte principal UNIQUEMENT

### 8️⃣ Infos Tile (Module libre)
```
┌──────────────────────────────┐
│ INFOS                        │
│ 🔔 Fin de mois — Pense à ... │
│ (rappel automatique)         │
└──────────────────────────────┘
```
- **Contenu** : Notes + rappels automatiques
- **Visible** : Derniers 2 jours du mois
- **Non-cliquable** (informatif)

---

## 🎨 Palette de couleurs

```
PRIMAIRE:           #5B57F5  (violet)        → CTAs, Accents, Hero compte principal
POSITIF/ÉPARGNE:    #2ED47A  (vert)          → Gains, succès, épargne
NÉGATIF:            #FC5A5A  (rouge)         → Erreurs, dérives, alertes
WARNING/PLACEMENTS: #FFAB2E  (orange/ambre)  → Optimisations, attention

NEUTRES:
  Neutre 0:         #FFFFFF  (blanc)
  Neutre 900:       #0F172A  (noir profond)
  Neutre 600:       #4B5563  (gris secondaire)

GRADIENTS (Hérités du design actuel) :
  Hero Orange:      radial + linear (145deg, #5B3B06 → #A97512 → #E3AF30)
  Hero Violet:      linear (140deg, #1A1730 → #2D2B6B → #3D3AB8)
  Épargne (Teal):   radial + linear (144deg, #0B3F4A → #0F5461 → #166C7A)
  Optimisations:    radial + linear (142deg, #0A5B63 → #0F7B83 → #13A0A8)
  Dérives (Orange): radial + linear (145deg, #4A1A07 → #A84512 → #F08A2B)
```

---

## 📏 Tokens de design

### Spacing (Tailwind-like)
```
--space-1:  4px   (micro)
--space-2:  8px   (petit)
--space-3:  12px  (standard dans cartes)
--space-4:  16px  (padding section)
--space-5:  20px  (padding large)
--space-6:  24px  (padding section main)
```

### Radius (Border-radius)
```
--radius-sm:   8px    (boutons secondaires)
--radius-md:   12px   (cartes internes)
--radius-lg:   16px   (cartes principales)
--radius-xl:   20px   (grandes cartes, tiles)
--radius-2xl:  24px   (modales)
--radius-full: 9999px (cercles, badges)
```

### Ombres
```
--shadow-card: 0 2px 12px rgba(28,28,58,0.07)  (ombres subtiles)
--shadow-lg:   0 8px 24px rgba(28,28,58,0.12)  (modales, depth)
```

### Typographie
```
Font Family: Nunito Variable (ALL TEXT — UI + chiffres)

Font Sizes (clamp pour responsive):
  KPI Principal:   clamp(24px, 7vw, 34px)
  KPI Secondaire:  clamp(20px, 5vw, 28px)
  Body Large:      16px
  Body Standard:   14px
  Body Small:      12px
  Label/Meta:      10-11px

Font Weights:
  600 Semibold:    Labels, descriptions
  700 Bold:        Titres, accents
  800 Extrabold:   KPIs, nombres importants
  900 Black:       Grands nombres, pourcentages
```

---

## 📱 Responsive Breakpoints

```
Mobile:   <600px   → 1 colonne, padding 24px, fonts clamp()
Tablet:   600-900px → Centré max-width 600px, même layout
Desktop:  >900px   → Centré max-width 600px, espace blanc symétrique
```

**Philosophie** : Linéaire, centré, pas de sidebars. Smooth transitions avec clamp().

---

## 🔄 Interactions principales

| Interaction | Trigger | Résultat |
|--|--|--|
| Sélectionner compte | Clic icône PageHeader | Modale carrousel comptes |
| Détail Reste utile | Clic hero orange | Modale breakdown du reste utile |
| Détail Revenus/Dépenses | Clic hero violet | Modale 2 colonnes |
| Budget par bloc | Clic progress ring | Modale 4 progress rings (socle, variable, provision, discré.) |
| Détail dérives | Clic drifts tile | Modale liste catégories, top 5 optionnel |
| Détail épargne | Clic savings tile | Modale objectif mensuel + taux progression |
| Détail optimisations | Clic optimizations tile | Modale 3 articles détaillés |
| Transactions catégorie | Clic ligne drift modale | Modale liste transactions |
| Fermer modale | Clic overlay / bouton X / Escape | Modale disparaît |

---

## 🎬 Animations (Template)

```javascript
// Entrée page
Fade 0→1, translateY 8px→0, 300ms ease-out (hero)
Fade 0→1, translateY 10px→0, 350ms ease-out delay 120ms (sections suivantes)

// Hover sur cartes
box-shadow card→lg, translateY 0→-1px, 300ms ease-out

// Modales
Fade overlay, Scale 0.98→1, Y 20px→0, 180ms spring

// Progress ring (SVG)
stroke-dashoffset: 0→circumference, 900ms cubic-bezier(0.22, 1, 0.36, 1)

// Snapshot reminder
Fade 0→1, Y -4px→0, 200ms ease-out (entry)
```

---

## ♿ Accessibility Checklist

- ✅ Buttons (pas div masqué)
- ✅ Modales avec `role="dialog"` + `aria-modal="true"`
- ✅ Icons avec `aria-hidden="true"` (décoratives)
- ✅ Focus order logique
- ✅ Keyboard nav (Tab, Escape)
- ✅ Aria-labels sur CTAs
- ✅ Contrast >4.5:1 (AA minimum)
- ✅ Touch targets >44×44px (mobile)

---

## 🚫 Ne PAS faire

❌ Changer les 5 couleurs primaires (violet, vert, rouge, orange)  
❌ Utiliser une autre font que Nunito Variable  
❌ Perdre un des 6 modules de contenu  
❌ Ignorer le mobile-first responsive  
❌ Créer de l'overflow horizontal  
❌ Animations >500ms (sauf charts)  
❌ Contraste faible (<4.5:1)  
❌ Modifier le carrousel de sélection compte  

---

## 📊 Données exemple (pour tester refonte)

```javascript
Account: {
  name: "Compte principal",
  balance: 2847.50,
  type: "checking"
}

Hero KPIs: {
  reste_utile: 845.00,      // Budget restant du mois
  budget_jour: 32.50,       // Reste utile / jours restants
  salaire_mois: 3200.00,    // Revenus du mois
  depenses_mois: 1947.50,   // Dépenses du mois
  solde_date: "2026-05-27"  // Date du jour
}

Budget Overall: 73%  // (dépenses / budget) * 100

Drifts: [
  { id: "...", name: "Café/bars", spent: 92, budget: 60, drift: +53% },
  { id: "...", name: "Petits achats", spent: 140, budget: 120, drift: +17% },
]

Optimizations: [
  { label: "Retraits d'espèces", spent: 145, budget: 420, gauge: "warning" },
  { label: "Café/bars", spent: 92, budget: 300, gauge: "warning" },
  { label: "Petits achats", spent: 0, budget: 360, gauge: "success" },
]

PlannedOps: {
  j3: { count: 2, amount: 145.00 },
  j7: { count: 4, amount: 320.00 }
}

Savings: {
  monthly_goal: 600.00,
  monthly_saved: 0.00,          // Mock (à brancher à vrai données)
  ytd_2026: 4240.00,
  annual_goal: 7200.00,
  status: "pending"              // 'validated' | 'pending' | 'alert'
}
```

---

## 🎯 Success Criteria

La refonte est réussie si :

✅ **Visuellement** : Design moderne, cohérent, hiérarchie claire  
✅ **Fonctionnellement** : Tous les 6 modules présents et accessibles  
✅ **Techniquement** : Mobile-first, responsive, animations fluides  
✅ **Branding** : Couleurs primaires, Nunito Variable, tone cohérent  
✅ **Accessibilité** : Contraste OK, focus visible, ARIA labels, keyboard nav  

---

**Version** : 1.0  
**Utilisation** : Copier ce fichier + HANDOFF_HOME_DESIGN.md dans Gemini  
**Durée estimée** : 30-60 minutes de chat pour direction créative valide
