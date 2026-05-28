# Handoff Spec: Page Accueil (Home) — Refonte UX/UI

## 🎯 Vue d'ensemble

La **page Accueil (Home)** est le point d'entrée du dashboard financier personnel. Elle affiche un portefeuille multi-compte avec un système de carrousel pour naviguer entre les comptes, et des modules de suivi budgétaire spécifiques au compte courant principal.

### Contexte utilisateur
- **Utilisateur** : Une seule personne (SOHO — Small Office/Home Office)
- **Fréquence** : Consultation quotidienne pour vérifier l'état du budget et des comptes
- **Temps moyen** : 3-5 minutes par visite
- **Intention principale** : Vérifier le "reste utile" du mois, les dépenses attendues, et l'état des optimisations

### Exigences fonctionnelles non négociables
1. **Sélection de compte via carrousel** : L'utilisateur peut naviguer entre ses comptes (Compte principal, Joint, PEA, PER, Épargne, etc.)
2. **Affichage contextualisé** : Le contenu change en fonction du compte sélectionné
3. **Hero KPIs** : 4 métriques clés affichées de manière saillante pour le compte principal
4. **Modules de suivi** : Dérives budgétaires, opérations planifiées (J+3, J+7), épargne, optimisations
5. **Mobile-first** : Adaptatif et utilisable sur mobile sans scrolling excessif

---

## 📐 Layout et architecture

### Vue globale (compte principal — compte chèques)

```
┌─────────────────────────────────────────────────────┐
│ PageHeader (Accueil + selector compte)              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  SECTION 1 — Hero KPIs (2 colonnes)               │
│  ┌─────────────────────┬──────────────────────┐   │
│  │ Reste utile         │ Solde au J (date)    │   │
│  │ + Budget/jour       │ (gradient violet)    │   │
│  │ (gradient orange)   │                      │   │
│  └─────────────────────┴──────────────────────┘   │
│                                                     │
│  ┌─────────────────────┬──────────────────────┐   │
│  │ Budget Global %     │ Dérives (tiles)      │   │
│  │ (progress ring)     │ (tiles + count)      │   │
│  └─────────────────────┴──────────────────────┘   │
│                                                     │
├─────────────────────────────────────────────────────┤
│ SECTION 2 — Trajectoire (chart lazy-loaded)       │
│ [Chart area — Recharts]                            │
├─────────────────────────────────────────────────────┤
│ SECTION 3 — Fenêtres temporelles                   │
│  ┌─────────────────────┬──────────────────────┐   │
│  │ J+3 opé. prévues    │ J+7 opé. prévues     │   │
│  └─────────────────────┴──────────────────────┘   │
├─────────────────────────────────────────────────────┤
│ SECTION 4 — Objectif d'épargne + Dérives          │
│  ┌─────────────────────┬──────────────────────┐   │
│  │ Épargne (tile)      │ Dérives (tile)       │   │
│  │ (gradient teal)     │ (gradient orange)    │   │
│  └─────────────────────┴──────────────────────┘   │
├─────────────────────────────────────────────────────┤
│ SECTION 5 — Optimisations                          │
│  ┌─────────────────────────────────────────────┐   │
│  │ Optimisations (tile pleine largeur)        │   │
│  │ 3 colonnes: Retraits, Café, Petits achats  │   │
│  │ (avec gauge analogique)                    │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│ SECTION 6 — Infos (module libre)                   │
│  ┌─────────────────────────────────────────────┐   │
│  │ Notes + Rappels automatiques                │   │
│  │ (p.ex. "Snapshot épargne fin de mois")      │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Vue alternative (comptes d'épargne/placements)

Lorsqu'un compte d'épargne (Livret A, LDDS, PER) ou un compte de placements (PEA) est sélectionné, le layout change :

- **Affichage centré du solde** (KPI size: ~40-48px)
- **Pourcentage de plafond** (si applicable : Livret A, LDDS)
- **Card métriques 2×2** affichant des infos contextualisées (taux, liquidité, intérêts, etc.)
- **Pas de Trajectoire chart** (pas applicable)
- **Pas de section Optimisations** (pas applicable)

### Contraintes responsives

| Breakpoint | Contenu | Layout |
|--|--|--|
| **Mobile** (<600px) | Pleine largeur | 1 colonne, padding: var(--space-6), sections empilées |
| **Tablet** (600-900px) | Centré (max-width: 600px) | Même 1 colonne, mais zone centrale |
| **Desktop** (>900px) | Même centré | max-width: 600px centrafluid, mais espace blanc symétrique |

**Note** : L'app est conçue mobile-first. Pas de grilles multi-colonnes complexes, pas de sidebars. L'écran reste centré et linéaire.

---

## 🎨 Design Tokens utilisés

### Couleurs et gradients

| Élément | Token/Valeur | Usage |
|--|--|--|
| **Primaire** | `#5B57F5` | CTAs, accents (violet) |
| **Positif/Épargne** | `#2ED47A` | Épargne, gains, succès (vert) |
| **Négatif/Erreur** | `#FC5A5A` | Dérives budgétaires, alertes (rouge) |
| **Warning/Placements** | `#FFAB2E` | Optimisations, placements, attention (orange) |
| **Neutre 0** | `#FFFFFF` | Fond blanc (cartes, sections) |
| **Neutre 900** | `#0F172A` | Texte noir (contenu) |
| **Neutre 600** | `#4B5563` | Texte secondaire |
| **Gradient Reste utile** | `radial-gradient(...) + linear-gradient(145deg, #5B3B06 0%, #A97512 46%, #E3AF30 100%)` | Hero orange/doré |
| **Gradient Solde** | `linear-gradient(140deg, #1A1730 0%, #2D2B6B 45%, #3D3AB8 100%)` | Hero violet |
| **Gradient Épargne** | `radial-gradient(...) + linear-gradient(144deg, #0B3F4A 0%, #0F5461 46%, #166C7A 100%)` | Tile épargne (teal) |
| **Gradient Optimisations** | `radial-gradient(...) + linear-gradient(142deg, #0A5B63 0%, #0F7B83 46%, #13A0A8 100%)` | Tile optimisations (teal/vert) |
| **Gradient Dérives** | `radial-gradient(...) + linear-gradient(145deg, #4A1A07 0%, #A84512 47%, #F08A2B 100%)` | Tile dérives (orange foncé) |

### Espacement

| Token | Valeur | Usage |
|--|--|--|
| `--space-1` | 4px | Micro-spacing (gaps entre textes) |
| `--space-2` | 8px | Petit espacement (gaps entre items) |
| `--space-3` | 12px | Espacement standard dans les cartes |
| `--space-4` | 16px | Padding des sections |
| `--space-5` | 20px | Padding plus grand |
| `--space-6` | 24px | Padding des sections principales |

### Typographie

| Token | Valeur | Usage |
|--|--|--|
| **Font family** | Nunito Variable | Tous (UI + chiffres monospace) |
| **Font mono** | `var(--font-mono)` | Montants (pour alignement) |
| **Font size XL** | 28-32px | KPIs principaux (solde, reste utile) |
| **Font size LG** | 20-24px | Sous-KPIs, montants secondaires |
| **Font size MD** | 14-16px | Labels, contenu principal |
| **Font size SM** | 12px | Labels secondaires |
| **Font size XS** | 10-11px | Métadata (taux, statut) |
| **Font weight 700** | Bold | Labels, descriptions |
| **Font weight 800** | Extrabold | KPIs, titres |
| **Font weight 900** | Black | Grands nombres (%) |

### Arrondi (Border-radius)

| Token | Valeur | Usage |
|--|--|--|
| `--radius-sm` | 8px | Boutons secondaires |
| `--radius-md` | 12px | Cartes internes, sous-conteneurs |
| `--radius-lg` | 16px | Cartes principales, modales |
| `--radius-xl` | 20px | Grandes cartes (hero, tiles) |
| `--radius-2xl` | 24px | Modales, pop-overs |
| `--radius-full` | 9999px | Badges, ikônes circulaires |

### Ombres

| Token | Valeur | Usage |
|--|--|--|
| `--shadow-card` | `0 2px 12px rgba(28,28,58,0.07)` | Cartes, tiles (subtil) |
| `--shadow-lg` | `0 8px 24px rgba(28,28,58,0.12)` | Modales, overlays (plus fort) |

---

## 🧩 Composants et modules

### 1. **PageHeader** (Section 0)

En haut de la page. Affichage du titre + sélecteur de compte via bouton actionable.

| Aspect | Détail |
|--|--|
| **Titre** | "Accueil" (fixed, ne change jamais) |
| **Label droit** | Nom du compte sélectionné (p.ex. "Compte principal", "Épargne", "PEA") |
| **Icône action** | Petit logo du compte (46×46px, lazy-loaded webp) |
| **Comportement** | Clic sur l'icône ouvre modale de sélection de compte |
| **Responsive** | Sur mobile, l'icône est plus petite ou alignée différemment |

---

### 2. **Hero Section — Compte Chèques Principal** (Section 1)

Layout **2 colonnes haut + 2 éléments bas**.

#### **2a. Carte Reste utile + Budget/jour** (haut-gauche, orange/doré)

| Aspect | Détail |
|--|--|
| **Dimensions** | ~104px min-height, 100% width |
| **Gradient** | Radial + linear (orange → doré) |
| **Border** | 1px rgba(255, 218, 130, 0.45) |
| **Padding** | var(--space-3) |
| **Contenu** | 2 stacks verticales |
| **Stack 1** | Label "Reste utile" (11px, bold, rgba white 92%), Montant (clamp(24px, 7vw, 34px), mono, #FFD550) |
| **Stack 2** | Label "Budget/jour" (10px, bold, rgba white 90%), Montant (14px, mono, #FFF8EC) |
| **Comportement** | Cliquable → ouvre modale "Détail Reste utile" |
| **Hover** | box-shadow passe à var(--shadow-lg), transform translateY(-1px) |

#### **2b. Carte Solde au jour** (haut-droit, gradient violet)

| Aspect | Détail |
|--|--|
| **Dimensions** | ~104px min-height, 100% width |
| **Gradient** | Linear violet (140deg) |
| **Border** | Aucune (gradient seul) |
| **Padding** | var(--space-3) var(--space-4) |
| **Contenu** | Label + Montant centré verticalement |
| **Label** | "Solde au J/MM" (11px, rgba white 56%, uppercase) |
| **Montant** | Date du jour (clamp(24px, 7vw, 34px), mono, white) |
| **Comportement** | Cliquable → ouvre modale "Revenus/Dépenses du mois" |
| **Hover** | Idem supra (box-shadow + translateY) |

#### **2c. Progress Ring — Budget Global %** (bas-gauche)

| Aspect | Détail |
|--|--|
| **Type** | Composant SVG custom (ProgressRing) |
| **Dimensions** | 86px fixed (aspect-ratio: 1) |
| **Arc couleur** | Dégradé des 5 buckets (fixe, couleur primaire) |
| **Track couleur** | Neutral 300 |
| **Stroke width** | ~9px |
| **Affichage** | Pourcentage au centre (bold 800, mono) |
| **Label dessous** | "budget" (10px, uppercase, neutral 600) |
| **Comportement** | Cliquable → ouvre modale "Progression par bloc budgétaire" |
| **Hover** | transform translateY(-1px) |

#### **2d. Drifts Tile** (bas-droit)

| Aspect | Détail |
|--|--|
| **Dimensions** | ~60px min-height, 100% width |
| **Gradient** | Radial + linear (orange foncé → orange vif) |
| **Border** | 1px rgba(255, 203, 150, 0.45) |
| **Contenu** | Label "Dérives" (10px, bold, rgba white 94%, uppercase) + Nombre de dérives (clamp(24px, 6vw, 30px), bold 900, mono, white) |
| **Background pictogram** | TriangleAlert icon (opacity 0.2) |
| **Comportement** | Cliquable → ouvre modale "Catégories en dérive" |
| **Hover** | box-shadow + translateY |

---

### 3. **Trajectoire Chart** (Section 2)

| Aspect | Détail |
|--|--|
| **Type** | Recharts (lazy-loaded) |
| **Dimensions** | Full width, ~220px height (responsive) |
| **Contenu** | Graphique linéaire montrant solde prévisionnel fin de mois + solde réel |
| **X-axis** | Jours du mois |
| **Y-axis** | Montants en EUR |
| **Visible sur** | Compte chèques principal uniquement |
| **Comportement** | Non-interactive (infographique) |

---

### 4. **Planned Windows** (Section 3)

Deux cartes côte à côte : J+3 et J+7.

#### Chacune

| Aspect | Détail |
|--|--|
| **Dimensions** | ~56px min-height, 1fr width chacune |
| **Gradient** | Radial + linear violet (subtil) |
| **Border** | 1px rgba(131, 126, 245, 0.34) |
| **Contenu vertical** | Label (J+3 ou J+7, 16px, bold 800, mono, primary 700), Sous-label (opération count + montant, 13px, mono, neutral 900) |
| **Comportement** | Non-cliquable (affichage seul) |
| **Visible sur** | Compte chèques principal uniquement |

---

### 5. **Savings Tile** (Section 4, partie gauche)

| Aspect | Détail |
|--|--|
| **Dimensions** | ~60px min-height, 100% width |
| **Gradient** | Radial + linear teal foncé |
| **Border** | 1px rgba(124, 211, 224, 0.4) |
| **Padding** | 0 var(--space-3) |
| **Contenu** | Label "Épargne" (10px, bold, rgba white 90%, uppercase) + Icône status (Check vert / X rouge/blanc) |
| **Status badge** | Check (validated) | X pending (light) | X alert (red) |
| **Comportement** | Cliquable → ouvre modale "Détail épargne mensuelle" |
| **Hover** | box-shadow + translateY |
| **Visible sur** | Compte chèques principal (col 1 si compte principal, col 1-2 si autre compte) |

---

### 6. **Drifts Tile** (optionnel, réapparaît en bas)

Idem section 2d, mais dans une grille différente selon le type de compte.

---

### 7. **Optimizations Tile** (Section 5)

Grande carte pleine largeur affichant 3 colonnes d'optimisations.

| Aspect | Détail |
|--|--|
| **Dimensions** | ~148px min-height, 100% width |
| **Gradient** | Radial + linear teal |
| **Border** | 1px rgba(135, 236, 224, 0.42) |
| **Padding** | var(--space-3) |
| **Header** | Label "Optimisations" (10px, bold, rgba white 94%, uppercase) |
| **Contenu** | 3 colonnes (grid 3 × minmax(0, 1fr)) |
| **Chaque colonne** | Icon (20px), Label (9px, rgba white 90%), Gauge SVG (OptimizationGauge), Montant (9px, mono, rgba white 88%) |
| **Gauge** | SVG custom avec aiguille réactive (3 zones color: vert/jaune/rouge) |
| **Comportement** | Cliquable → ouvre modale "Détail des optimisations" |
| **Visible sur** | Compte chèques principal uniquement |
| **Hover** | box-shadow + translateY |

---

### 8. **Infos Tile** (Section 6)

Module libre pour notes et rappels automatiques.

| Aspect | Détail |
|--|--|
| **Dimensions** | ~72px min-height, 100% width |
| **Fond** | var(--neutral-0), border 1px neutral 150 |
| **Border-radius** | var(--radius-xl) |
| **Padding** | var(--space-3) var(--space-4) |
| **Header** | Label "Infos" (10px, bold, neutral 500, uppercase) |
| **Contenu** | Si vide : texte "Aucune info pour le moment" (12px, italic, neutral 300) |
| **Rappel snapshot** | Apparaît J-1 et dernier jour du mois (animation douce fade-in) ; contient Bell icon (14px, primary 600) + texte "Fin de mois — Pense à mettre à jour les snapshots épargne" |
| **Comportement** | Non-cliquable (affichage informatif) |

---

## 🔄 États et interactions

### États des cartes hero

| État | Visuel | Comportement |
|--|--|--|
| **Normal** | Gradient standard, shadow-card | État par défaut |
| **Hover** | box-shadow → shadow-lg, transform translateY(-1px) | Animation 300ms ease-out |
| **Active/Clicked** | (optionnel) Modale overlay apparaît | Fond grisé 52% semi-transparent |
| **Loading** | (N/A pour KPIs temps réel) | Chargement continu via React Query |

### Modales (8 modales possibles)

| Modale | Trigger | Contenu |
|--|--|--|
| **Compte sélection** | Clic icône PageHeader | Carrousel des comptes (lazy) |
| **Reste utile détail** | Clic hero orange | Détail du calcul reste utile |
| **Revenus/Dépenses** | Clic hero violet | 2 colonnes : revenus / dépenses du mois |
| **Budget progression** | Clic progress ring | 4 rings + labels pour chaque bloc |
| **Dérives catégories** | Clic drifts tile | Liste catégories en dérive, top 5 optionnel |
| **Épargne détail** | Clic savings tile | Objectif mensuel + taux progression + YTD |
| **Optimisations détail** | Clic optimizations tile | 3 articles : chaque optimisation détaillée |
| **Catégorie dérives transactions** | Clic ligne drift modale | Liste des transactions de la catégorie |

### Modales — Spécifications générales

| Aspect | Détail |
|--|--|
| **Animation** | Fade-in + scale 0.98 → 1 (spring 28 damping, 320 stiffness, 180ms) |
| **Overlay** | Rgba(13, 13, 31, 0.52), fixed full-screen, cliquable pour fermer |
| **Size** | max-width 400-560px, responsive padding, centré |
| **Z-index** | 200+ pour overlay, 201+ pour modale |
| **Fermeture** | Clic overlay OU bouton X (34×34px, neutral 100 bg) OU touche Escape |
| **Scrollable** | Si contenu > 80dvh, maxHeight 82dvh, overflow auto |

---

## 📱 Comportement responsive

### Breakpoint 1 : Mobile (<600px)

- **Padding sections** : var(--space-6) 
- **Layout hero** : 1 colonne (changement obligatoire ?)
  - Option A : Stacker les 4 éléments verticalement (reste utile, solde, budget %, dérives)
  - Option B : Garder 2 colonnes mais ajuster hauteur min
- **Tiles optimisations** : 3 colonnes, réduit en 2 ou 1 si trop serré
- **Font sizes** : Réduire légèrement avec `clamp()` (p.ex. `clamp(20px, 5vw, 28px)`)
- **Modales** : Full-width moins 2× var(--space-4), centré

### Breakpoint 2 : Tablet (600-900px)

- **Max-width** : Rester à 600px (centré avec marges symétriques)
- **Layout** : Identique au mobile essentiellement
- **Font sizes** : Identiques

### Breakpoint 3 : Desktop (>900px)

- **Max-width** : Rester à 600px (centré)
- **Padding** : var(--space-6)
- **Layout** : Identique (pas de changement fondamental)

**Philosophie** : L'app est centrée et linéaire. Pas de transition brutale entre layouts. Utiliser `clamp()` pour les transitions en douceur.

---

## ⚠️ Edge cases

### Données manquantes

| Cas | Affichage |
|--|--|
| Compte non trouvé | Afficher placeholder ou rediriger /activite |
| Solde NULL | Montrer "—" ou 0 EUR |
| Trajectoire sans données | Skeleton 220px ou afficher label "Chargement…" |
| Opérations planifiées = 0 | Afficher "aucune opération" |
| Dérives = 0 | Afficher "Budget sous contrôle. Rien à signaler" + top 5 opt-in |

### Texte long

| Cas | Handling |
|--|--|
| Nom compte long | truncate (max 1 ligne, text-overflow ellipsis) |
| Label catégorie > 20 chars | Truncate ou abbrev. |
| Montants > 1 million | Afficher en k EUR (p.ex. "1.2k€") ou notation standard |

### Nombre de comptes

| Cas | Affichage |
|--|--|
| 1 seul compte | Modale sélection : 1 item (ou masquer CTA sélection ?) |
| 10+ comptes | Carrousel scrollable, pagination optionnelle |

### Temps réel et refresh

| Cas | Comportement |
|--|--|
| Données périmées (>5 min) | Petit indicateur "données du JJ/MM" optionnel |
| Calcul en cours | Skeleton ou shimmer loading (subtil) |
| Erreur API | Afficher "Erreur de chargement" + bouton retry |

---

## 🎬 Animations et transitions

### Page entry

| Élément | Timing | Easing |
|--|--|--|
| Hero section | Fade 0→1, translateY 8px→0 | 300ms ease-out |
| Trajectoire | Fade 0→1, translateY 10px→0 | 350ms ease-out (delay 120ms) |
| Planned windows | Fade 0→1, translateY 10px→0 | 350ms ease-out (delay 160ms) |
| Savings + Drifts | Fade 0→1, translateY 10px→0 | 350ms ease-out (delay 200ms) |
| Optimizations | Fade 0→1, translateY 10px→0 | 350ms ease-out (delay 240ms) |
| Infos tile | Fade 0→1, translateY 10px→0 | 350ms ease-out (delay 280ms) |

### Snapshot reminder (Infos tile)

- **Apparition** : Fade 0→1, translateY -4px→0, 200ms ease-out
- **Disparition** : Reverse (fade 1→0, translateY 0→-4px, 200ms ease-in)

### Progress ring (SVG)

- **Stroke dash-offset** : Animé de 0→circumference sur 900ms cubic-bezier(0.22, 1, 0.36, 1)

### Hover effects sur cartes

- **Transition** : box-shadow 300ms ease-out, transform 300ms ease-out
- **Target** : box-shadow (shadow-card → shadow-lg), transform (translateY 0 → -1px)

### Modales

- **Overlay** : Fade 0→1, 150ms
- **Modale body** : Scale 0.98→1, opacity 0→1, translateY 20px→0, 180ms spring damping 28 stiffness 320

### Rapport général

- **Vitesse** : Animation rapides (150-350ms) ; jamais >500ms sauf charts
- **Easing** : ease-out pour entrées, ease-in pour sorties, spring pour modales
- **Subtilité** : Pas d'animations trop spectaculaires, favoriser subtilité et fluidité

---

## ♿ Accessibilité

### Sémantique

| Élément | Role/Markup |
|--|--|
| Cartes cliquables | `<button>` (pas `<div>` masqué) |
| Modales | `role="dialog"` + `aria-modal="true"` + `aria-label="Titre"` |
| Sections | `<section>` semantic |
| Labels KPI | `<p>` ou `<label>` avec classe visuelle |
| Icons | `aria-hidden="true"` (purement décoratives) ou `aria-label="Description"` |

### Focus order

1. PageHeader action button
2. Hero cards (haut-gauche, haut-droit, bas-gauche, bas-droit)
3. Trajectoire (non-interactive, skip)
4. Planned windows (non-interactive, skip)
5. Savings tile + Drifts tile
6. Optimizations tile
7. Infos tile

### Keyboard interaction

| Key | Action |
|--|--|
| **Tab** | Naviguer entré éléments focusables |
| **Shift+Tab** | Navigation rétrograde |
| **Enter/Space** | Activer buttons cliquables |
| **Escape** | Fermer modales |
| **Arrow keys** | (Optionnel) Navigation carrousel comptes |

### Screen reader

- **Aria-labels** : Chaque bouton/modale doit avoir aria-label ou aria-labelledby explicite
- **Aria-live** : Région dynamique pour les mises à jour (p.ex. "Chargement…")
- **Annonces** : Modales annoncées comme dialog au chargement

### Color contrast

| Texte | Fond | Ratio |
|--|--|--|
| Neutral 900 | Neutral 0 | >7:1 (AAA) |
| Primary 700 | Neutral 0 | >4.5:1 (AA) |
| Rgba white 90% | Orange gradient | >4.5:1 (AA) |
| Rgba white 90% | Violet gradient | >4.5:1 (AA) |

### Responsive text

- **Min-size** : Jamais <12px (lisibilité mobile)
- **Max-size** : Jamais >34px pour KPIs (lisibilité desk)
- **Line-height** : 1.4–1.5 pour contenu, 1 pour mono (KPIs)

### Touch targets

- **Buttons** : Minimum 44×44px (mobile)
- **Icons** : 16-20px intérieurement, padding pour atteindre 44×44px
- **Spacing** : Gap ≥8px entre éléments cliquables

---

## 🎨 Directives créatives pour Gemini

### Liberté accordée

✅ **Vous pouvez** :
- Réorganiser complètement la structure de la page (pas de contrainte d'ordre)
- Remplacer le système de tuiles/cartes par un autre paradigme de design
- Proposer une hiérarchie différente de l'information
- Adapter les gradients tout en gardant les teintes primaires
- Utiliser des animations et micro-interactions plus sophistiquées
- Changer les proportions, spacing, typographies (tant que tokens de base sont utilisés)
- Ajouter des visuels, icônes, illustrations (si cohérents avec le tone)

### Contraintes d'or (immuables)

🔒 **Vous devez** :
- Garder la **palette de couleurs primaires** (violet #5B57F5, vert #2ED47A, rouge #FC5A5A, orange #FFAB2E)
- Utiliser la **font Nunito Variable** pour tout
- Préserver le **carrousel de sélection de compte** (core feature)
- Garder l'affichage **contextualisé par compte** (héros KPI différents selon type)
- Respecter le **mobile-first** (responsive, pas de sidebars)
- Préserver tous les **6 modules de contenu** (hero, trajectoire, planned ops, épargne, optimisations, infos)
- Garder les **tokens de spacing et radius** (sm=8, md=12, lg=16, xl=20, 2xl=24)
- Utiliser les **ombres subtiles** (shadow-card par défaut)
- Respecter l'**accessibilité de base** (buttons, ARIA labels, focus order, contrast)

### Inspiration

💡 Pensez à :
- Designs de dashboard modernes (Figma, Linear, Stripe, Apple Fitness)
- Systèmes de cartes innovants (fusion, floating, morphing, neumorphic)
- Hiérarchies visuelles créatives (gradients avancés, typographies dynamiques)
- Micro-interactions fines (hover, focus, transition subtiles)
- Utilisation d'espace négatif (clean, aéré, luxury feel)
- Cohérence thématique (minimaliste vs. coloré, moderne vs. warm)

---

## 📋 Checklist pour la validation

Avant de finaliser la refonte, vérifier que :

- [ ] Tous les comptes (principal, épargne, placements) s'affichent correctement
- [ ] Les modales s'ouvrent/ferment sans accrocs
- [ ] Responsive testée sur mobile (375px), tablet (768px), desktop (1280px)
- [ ] Contraste couleurs validé (AAA pour texte principal, AA pour secondaire)
- [ ] Animations smooth, pas de lag (60fps target)
- [ ] Aucun overflow horizontal, padding cohérent
- [ ] Focus order logique, tous les éléments cliquables reçoivent focus
- [ ] Loading states clairs si données manquantes
- [ ] Edge cases gérés (texte long, nombres grands, comptes vides)
- [ ] Fichier Design System référencé et mis à jour (`Budget Design System.html`)

---

## 📎 Ressources

- **Design System file** : `/Users/dosta/Downloads/dashboard-budget/project/Budget Design System.html`
- **Stack** : React 18 + TypeScript, Tailwind CSS, Framer Motion, Recharts
- **Source Home.tsx** : `/src/pages/Home.tsx` (structure actuelle de référence)
- **Tokens CSS** : Définis dans `:root` (fichier CSS global)

---

**Version** : 1.0
**Date** : 2026-05-27
**Destinataire** : Google Gemini (refonte créative)
