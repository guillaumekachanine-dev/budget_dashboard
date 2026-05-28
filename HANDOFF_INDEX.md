# 📚 Index — Documentation Refonte Home Design

**Objectif** : Documenter complètement la refonte UX/UI de la page Accueil (Home) pour la confier à Google Gemini ou un designer IA.

---

## 📖 Ordre de lecture recommandé

### **Pour le projet**
1. **CLAUDE.md** (2 min) — Contexte projet, stack, tokens
2. **HANDOFF_HOME_DESIGN.md** (15 min) — Specs complètes, tous les détails
3. **HANDOFF_QUICK_REFERENCE.md** (5 min) — Résumé visuel, checklist rapide

### **Pour partager avec Gemini**
1. Copier le prompt dans `HANDOFF_README.md` → Coller dans Gemini
2. Attacher ou copier les 3 fichiers supra
3. Laisser Gemini proposer une direction créative
4. Itérer jusqu'à satisfaction

---

## 📄 Fichiers détail

### 1. **CLAUDE.md** ✅ (Existant)
- ✓ Contexte projet (1 utilisateur, web app financière)
- ✓ Stack (Vite, React, Tailwind, Supabase, Vercel, Claude API)
- ✓ Design System (couleurs, fonts, tokens)
- ✓ Architecture (navigation bottom, 5 pages)
- ✓ Conventions (mobile-first, pas de features superflues)

**À lire car** : Fondations du projet, tokens de couleur/typo à respecter

---

### 2. **HANDOFF_HOME_DESIGN.md** (Nouveau)
- ✓ Vue d'ensemble (contexte utilisateur, exigences)
- ✓ Layout et architecture (structure actuelle, breakpoints)
- ✓ Design tokens (couleurs, gradients, espaces, typo, ombres)
- ✓ 8 Modules détaillés (PageHeader, Hero, Trajectoire, Planned Windows, Savings, Drifts, Optimizations, Infos)
- ✓ États et interactions (normale, hover, active, modales)
- ✓ Responsive behavior (mobile <600px, tablet, desktop)
- ✓ Edge cases (données manquantes, texte long, erreurs)
- ✓ Animations et transitions (timing, easing, delays)
- ✓ Accessibilité (sémantique, focus order, keyboard, screen reader, contraste)
- ✓ Directives créatives (liberté accordée vs. contraintes d'or)
- ✓ Checklist validation

**À lire car** : Spécification complète pour comprendre chaque aspect du design

**Longueur** : ~2000 lignes (dense mais complet)

---

### 3. **HANDOFF_QUICK_REFERENCE.md** (Nouveau)
- ✓ Vue visuelle des 8 modules (ASCII art)
- ✓ Palette de couleurs exacte (hex codes)
- ✓ Tokens de design (spacing, radius, shadows, typo)
- ✓ Breakpoints responsive
- ✓ Interactions principales (tableau)
- ✓ Template animations (code-like)
- ✓ Accessibility checklist
- ✓ Données exemple (pour tester refonte)
- ✓ Success criteria

**À lire car** : Référence rapide pendant la création de mockups

**Longueur** : ~300 lignes (format condensé)

---

### 4. **HANDOFF_README.md** (Nouveau)
- ✓ Préambule et objectif
- ✓ Liste des fichiers fournis
- ✓ Comment utiliser avec Gemini (Step-by-step)
- ✓ Prompt prêt à copier-coller pour Gemini
- ✓ Critères de validation (obligatoire, souhaité, nice-to-have)
- ✓ Conseils pour Gemini
- ✓ Workflow complet
- ✓ Support et troubleshooting

**À lire car** : Guide pratique pour orchestrer la refonte avec Gemini

**Longueur** : ~200 lignes (guide concis et actionable)

---

## 🎯 Utilisation par cas d'usage

### **Cas 1 : Je veux juste envoyer ça à Gemini maintenant**
```
1. Ouvre HANDOFF_README.md
2. Copie le prompt "Step 1"
3. Passe dans Gemini, colle le prompt
4. Attache ou copie-colle les 3 fichiers (CLAUDE.md, HANDOFF_HOME_DESIGN.md, HANDOFF_QUICK_REFERENCE.md)
5. Appuie sur Envoyer
```

### **Cas 2 : Je veux d'abord bien comprendre avant de partager**
```
1. Lis CLAUDE.md (contexte)
2. Lis HANDOFF_HOME_DESIGN.md (tout en détail)
3. Lis HANDOFF_QUICK_REFERENCE.md (résumé)
4. Ensuite → Cas 1
```

### **Cas 3 : Je veux affiner le brief avant de partager**
```
1. Lis tous les 3 fichiers
2. Édite HANDOFF_HOME_DESIGN.md si besoin (ajoute notes, constraints, exemples)
3. Édite le prompt dans HANDOFF_README.md pour qu'il match ta vision exacte
4. Partage avec Gemini
```

### **Cas 4 : Gemini a proposé un design, je veux valider**
```
1. Consulte la "Checklist validation" (HANDOFF_HOME_DESIGN.md)
2. Consulte les "Critères de validation" (HANDOFF_README.md)
3. Consulte "Success criteria" (HANDOFF_QUICK_REFERENCE.md)
4. Note les points manquants
5. Retour à Gemini : "J'aime direction X, mais il manque Y, peux-tu ajuster Z ?"
```

---

## 💡 Contenu clé de chaque fichier

### CLAUDE.md
```
Design System (À NE PAS OUBLIER) :
  Primaire:    #5B57F5
  Positif:     #2ED47A
  Négatif:     #FC5A5A
  Warning:     #FFAB2E
  Font:        Nunito Variable
  Radius:      sm=8, md=12, lg=16, xl=20, 2xl=24, full=9999
  Shadow:      0 2px 12px rgba(28,28,58,0.07)
```

### HANDOFF_HOME_DESIGN.md
```
Exigences non-négociables :
  1. Sélection compte (carrousel)
  2. Affichage contextualisé par type de compte
  3. Hero KPIs (4 métriques saillantes)
  4. 6 modules (Hero, Trajectoire, Planned Ops, Épargne, Optimisations, Infos)
  5. Mobile-first responsive

Liberté créative :
  ✅ Restructurer la page complètement
  ✅ Casser le système de tuiles actuelles
  ✅ Proposer des paradigmes innovants
  ✅ Ajouter animations sophistiquées
  ✅ Adapter typos, espacing, proportions
  
Contraintes immuables :
  🔒 Palette 5 couleurs primaires
  🔒 Font Nunito Variable
  🔒 6 modules de contenu
  🔒 Mobile-first
```

### HANDOFF_QUICK_REFERENCE.md
```
Modules visuels (ASCII) :
  PageHeader → Hero (contextualisé) → Trajectoire → Planned Ops 
  → Savings / Drifts → Optimizations → Infos

Tokens (copier-coller en design) :
  Spacing: 4, 8, 12, 16, 20, 24px
  Radius: 8, 12, 16, 20, 24, full
  Colors: #5B57F5, #2ED47A, #FC5A5A, #FFAB2E
```

### HANDOFF_README.md
```
Prompt clé pour Gemini :
  "Refonde UX/UI page Home en cassant système de tuiles actuelles.
   Respecte: couleurs, Nunito, mobile-first, 6 modules, carrousel compte.
   Liberté totale sur tout le reste."

Validation :
  ✅ Couleurs primaires exactes
  ✅ Nunito Variable
  ✅ 6 modules présents
  ✅ Mobile-first testé
  ✅ Accessible minimum (buttons, ARIA, focus, contrast)
```

---

## 🔗 Références externes (si besoin)

| Ressource | Localisation | Utilité |
|--|--|--|
| Design System HTML | `/Users/dosta/Downloads/dashboard-budget/project/Budget Design System.html` | Voir tokens exacts (couleurs, typo, composants) |
| Code source Home | `/src/pages/Home.tsx` | Comprendre structure actuelle, données, interactions |
| CLAUDE.md | Racine du repo | Contexte projet complet |

---

## ✅ Pre-flight Checklist

Avant de partager avec Gemini, vérifie que tu as :

- [ ] Lu CLAUDE.md (contexte projet)
- [ ] Lu HANDOFF_HOME_DESIGN.md (specs complètes)
- [ ] Compris les 8 modules (PageHeader, Hero, Trajectoire, etc.)
- [ ] Noté les couleurs primaires (5 exactes à respecter)
- [ ] Compris mobile-first responsive (breakpoints)
- [ ] Noté "liberté créative" vs. "contraintes d'or"
- [ ] Préparé le prompt depuis HANDOFF_README.md
- [ ] Attached les 3 fichiers à Gemini

---

## 🎯 Prompt résumé (à copier)

```
Contexte : Refonte UX/UI page Accueil d'une app de suivi budgétaire.

Lis CLAUDE.md puis HANDOFF_HOME_DESIGN.md pour tous les détails.

Ton job : Propose une refonte créative et moderne qui :
- Respecte palette #5B57F5, #2ED47A, #FC5A5A, #FFAB2E, Nunito Variable
- Garde carrousel de sélection compte et 6 modules de contenu
- Est mobile-first responsive
- Est accessible (buttons, ARIA labels, focus, contrast)
- Peut casser complètement le système de tuiles actuelles

Livrables : Mockup Figma OU description markdown + justification créative.
```

---

## 📞 Troubleshooting

| Problème | Solution |
|--|--|
| Gemini oublie les couleurs | Rappelle : #5B57F5, #2ED47A, #FC5A5A, #FFAB2E |
| Gemini manque un module | Renvoie : "As-tu géré les 6 modules ?" |
| Design trop complexe | "Simplifie, c'est pour mobile-first" |
| Pas d'animations | "Ajoute des micro-interactions fines" |
| Pas de justification créative | "Pourquoi as-tu choisi cette approche ?" |

---

## 📊 Métadonnées

| Propriété | Valeur |
|--|--|
| **Objectif** | Refonte Home Design → Gemini |
| **Portée** | Page Home uniquement (pas Activité, Budgets, Stats) |
| **Durée estimée** | 30-60 min de chat + 3-5 jours dev implémentation |
| **Livrables attendus** | Mockup Figma OU design markdown + justification |
| **Validation** | Checklist dans HANDOFF_README.md + HANDOFF_QUICK_REFERENCE.md |
| **Version docs** | 1.0 |
| **Date** | 2026-05-27 |
| **Auteur** | Claude Code (Anthropic) |

---

## 🚀 Prochaines étapes

1. **Lis les fichiers** (5-20 min selon cas)
2. **Partage avec Gemini** (2 min setup)
3. **Itère avec Gemini** (30-60 min chat)
4. **Valide direction** (contre checklist)
5. **Exporte/Implémente** en React (3-5 jours)
6. **Teste** mobile, tablet, desktop
7. **Déploie** sur Vercel (sur demande explicite)

---

**Bon courage ! 🎨**

Si besoin de précisions, relis le fichier correspondant ou pose question via Gemini.
