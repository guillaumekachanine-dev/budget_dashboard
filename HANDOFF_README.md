# 📋 Utilisation du Handoff Home Design avec Gemini

## Préambule

Ce dossier contient **la documentation complète pour faire refondre le design de la page Accueil (Home)** par Google Gemini ou un designer IA.

### Objectif
**Refonte graphique UX/UI de la page Home** — Laisser carte blanche créative tout en respectant :
- Les **teintes de la charte graphique** (violet, vert, rouge, orange)
- La **font Nunito Variable**
- Les **exigences fonctionnelles** (sélection compte, 6 modules de contenu)
- Le **mobile-first responsive**
- L'**accessibilité minimale**

---

## 📦 Fichiers fournis

| Fichier | Contenu |
|--|--|
| **HANDOFF_HOME_DESIGN.md** | Documentation complète (specs, components, tokens, edge cases, animations, accessibility) |
| **HANDOFF_README.md** | Ce fichier — guide d'utilisation |
| **CLAUDE.md** | Contexte projet (stack, tokens, conventions) — **à lire d'abord** |

### Fichiers supplémentaires (référence)

| Ressource | Localisation |
|--|--|
| **Design System HTML** | `/Users/dosta/Downloads/dashboard-budget/project/Budget Design System.html` |
| **Code source Home.tsx** | `/src/pages/Home.tsx` (pour comprendre la structure actuelle) |
| **Tokens CSS** | Dans le projet React (fichier CSS racine) |

---

## 🚀 Comment utiliser avec Gemini

### **Step 1** : Préparer le prompt

Copier-coller ce prompt dans Google Gemini :

```
Contexte : Je dois refondre complètement le design UX/UI de la page Accueil 
d'une app de suivi budgétaire personnelle. J'ai une documentation détaillée (Handoff spec).

Consignes :
1. Lis d'abord le fichier CLAUDE.md pour comprendre le projet
2. Lis ensuite HANDOFF_HOME_DESIGN.md pour tous les détails fonctionnels et de design

Objectif : Propose une refonte graphique créative et moderne de la page Home en:
- Cassant le système actuel de tuiles/cartes (tu as liberté totale)
- Respectant ABSOLUMENT : les teintes primaires (violet #5B57F5, vert #2ED47A, rouge #FC5A5A, orange #FFAB2E), la font Nunito, le mobile-first
- Gardant les 6 modules de contenu et la sélection par carrousel

Livrables attendus :
1. Mockup Figma OU description détaillée du nouveau layout (en markdown)
2. Justification créative des choix (pourquoi cette approche ?)
3. Notes sur les animations/micro-interactions proposées
4. Vérification des contraintes de charte (couleurs, font, mobile)

Tu peux proposer :
- Une hiérarchie différente de l'info
- Des paradigmes de design innovants (neumorphic, glassmorphism, floating cards, etc.)
- Des animations sophistiquées
- Une structure complètement différente tant que les fonctionnalités restent

Ne dois PAS :
- Changer les couleurs primaires
- Utiliser une autre font
- Perdre des contenus/modules
- Ignorer le mobile-first
```

### **Step 2** : Partager les fichiers

Attacher ou copier les fichiers dans le chat Gemini :

1. **CLAUDE.md** (le contexte du projet)
2. **HANDOFF_HOME_DESIGN.md** (specs complètes)
3. Optionnel : Screenshot ou lien vers la [page Home actuelle](https://link-si-disponible)

### **Step 3** : Itérer

- **Gemini propose** une première direction créative
- **Tu valides** (ou demandes ajustements)
- **Gemini affine** (animations, responsive, détails)
- **Tu exportes** en Figma (si Gemini génère design) OU passes le brief à un designer

---

## ✅ Critères de validation

Avant d'accepter la refonte, vérifier que Gemini a :

### Obligatoire
- ✅ Respecté les 5 teintes primaires (palette exacte)
- ✅ Utilisé Nunito Variable (typo unique)
- ✅ Gardé la sélection de compte en carrousel
- ✅ Préservé les 6 modules : Hero KPIs, Trajectoire, Planned Ops, Épargne, Optimisations, Infos
- ✅ Mobile-first responsive (testé <600px, 600-900px, >900px)
- ✅ Accessible minimum (buttons, ARIA labels, contrast, focus order)

### Souhaité
- ✅ Hiérarchie visuelle claire et créative
- ✅ Animations fines et cohérentes
- ✅ Spacing/padding homogène
- ✅ Contexte compte bien géré (Hero différent selon type)
- ✅ Modales bien intégrées au design

### Nice-to-have
- ✅ Illustrations ou visuels supplémentaires
- ✅ Micro-interactions sophistiquées
- ✅ Design system cohérent et réutilisable
- ✅ Fichier Figma prêt pour dev

---

## 💡 Conseils pour Gemini

Pour aider Gemini à proposer la meilleure refonte :

### Styles/Mouvements à explorer
- Design minimaliste + couleurs vibrato (très tendance 2024-2025)
- Glassmorphism discret avec gradients
- Cartes flottantes avec ombres subtiles
- Layout asymétrique mais équilibré
- Animations on-scroll ou au chargement

### À éviter
- ❌ Design trop complexe ou surchargé
- ❌ Animations lourdes (>400ms)
- ❌ Gradients plats ou trop saturés
- ❌ Textes trop petits ou trop grands
- ❌ Interactions confuses (modale mal centrée, focus invisible, etc.)

### Questions à poser à Gemini
- *« Pourquoi as-tu proposé ce layout plutôt qu'un autre ? »*
- *« Comment gères-tu les comptes d'épargne vs. compte chèques ? »*
- *« Les animations ralentissent-elles ou restent-elles fluidesur mobile ? »*
- *« Y a-t-il des edge cases (texte long, nombre de comptes, données manquantes) que tu aies considérés ? »*

---

## 🔄 Workflow complet

```
1. Lire CLAUDE.md + HANDOFF_HOME_DESIGN.md
2. Copier prompt dans Gemini + attacher fichiers
3. Gemini propose direction créative (markdown ou Figma link)
4. Valider contre critères de validation (supra)
5. Itérer si besoin (ajustements, animations, responsive)
6. Exporter/implémenter en React (src/pages/Home.tsx)
7. Tester sur mobile, tablet, desktop
8. Valider accessibilité + contraste
9. Push en production
```

---

## 📞 Support

### Si Gemini oublie des contraintes
→ Rappelle : *« Attention, tu dois utiliser #5B57F5, #2ED47A, #FC5A5A, #FFAB2E et Nunito Variable. Mobile-first ! »*

### Si la refonte ne couvre pas tous les modules
→ Renvoie : *« As-tu géré les 6 modules ? Hero, Trajectoire, Planned Ops, Épargne, Optimisations, Infos ? »*

### Si tu veux plus de détails
→ Demande : *« Donne-moi un breakdown CSS/HTML pour [composant]. »*

---

## 📌 Notes finales

- **Périmètre** : Page Home UNIQUEMENT (pas Activité, Budgets, Stats)
- **Durée** : Comptez 2-3 itérations avec Gemini (~30 min de chat)
- **Implémentation** : Après approbation du design, dev en React/Tailwind (3-5 jours)
- **Déploiement** : Sur Vercel (production sur demande explicite — ne déployer jamais automatiquement)

Bonne refonte ! 🎨

---

**Version** : 1.0  
**Date** : 2026-05-27  
**Auteur** : Claude Code (Anthropic)
