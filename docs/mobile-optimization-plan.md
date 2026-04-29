# Mobile Optimization Plan (Skill: mobile-design)

Référence utilisée: `src/mobile-design/SKILL_mobile_design.md` + toutes les docs référencées (`mobile-design-thinking`, `touch-psychology`, `mobile-performance`, `mobile-navigation`, `mobile-typography`, `mobile-color-system`, `mobile-backend`, `mobile-testing`, `mobile-debugging`, `decision-trees`, `platform-ios`, `platform-android`).

Audit exécuté comme demandé par le skill:

```bash
python3 src/mobile-design/scripts/mobile_audit.py /Users/dosta/Desktop/Projets-Dev/Dashboard_budget
```

## 🧠 CHECKPOINT (obligatoire du skill)

Platform: iOS + Android (mobile web / PWA)
Framework: React + Vite + Tailwind (mobile-first)
Files Read: toutes les références du dossier `src/mobile-design/*.md`

3 principes appliqués:
1. Touch targets minimum 44px sur actions critiques (Fitts + WCAG).
2. Mobile typography lisible (base 16px, fonts mobile cohérentes).
3. Performance perçue et accessibilité (réduction de motion, navigation stable, safe-area).

Anti-patterns évités:
1. Cibles tactiles 32-40px sur actions fréquentes.
2. Incohérence de tokens (couleurs/fonts différentes entre CSS global et Tailwind).

## Constats principaux

1. Plusieurs boutons critiques (header, modales) étaient <44px.
2. Le design system mobile n’était pas aligné partout (fonts, primary, semantic colors).
3. Pas de garde-fou global pour safe-area + classes utilitaires mobile (`pb-nav`, `app-shell`).
4. Motion non réduite pour utilisateurs `prefers-reduced-motion`.

## Optimisations implémentées (code)

### 1) Fondations mobile globales

Fichier: `src/index.css`

```css
:root {
  --touch-target-min: 44px;
  --touch-gap-min: 8px;
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --nav-height: 90px;
}

.app-shell {
  min-height: 100dvh;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
}

.pb-nav {
  padding-bottom: calc(var(--nav-height) + var(--safe-bottom));
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Impact:
- App plus robuste sur écrans notched + meilleure accessibilité motion.

### 2) Typographie/brand mobile cohérentes

Fichiers: `index.html`, `tailwind.config.js`, `src/index.css`

```html
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;700&family=DM+Sans:wght@400;500;700;800&display=swap" rel="stylesheet" />
<meta name="theme-color" content="#5B57F5" />
```

```js
fontFamily: {
  sans: ['DM Sans', 'sans-serif'],
  mono: ['DM Mono', 'monospace'],
}
```

Impact:
- Réduction de la dérive visuelle mobile, meilleure lisibilité et cohérence cross-screen.

### 3) Touch targets >= 44px sur actions critiques

Fichiers: `src/components/layout/PageHeader.tsx`, `src/pages/Home.tsx`, `src/components/modals/TransactionDetailsModal.tsx`

```ts
minWidth: 'var(--touch-target-min)',
minHeight: 'var(--touch-target-min)',
```

Impact:
- Diminution des erreurs de tap (fat finger), meilleure UX one-hand.

### 4) Navigation basse plus adaptable

Fichier: `src/components/layout/BottomNav.tsx`

```ts
maxWidth: 600
```

Impact:
- Meilleure adaptation aux grands téléphones / petits tablettes.

## Validation

- Script mobile skill exécuté.
- Lint ciblé des fichiers modifiés: OK.
- Build `npm run build` reste bloqué par erreurs TypeScript préexistantes dans `src/components/ui/Table.tsx` (hors de ce lot).

## Prochain lot recommandé (P1)

1. Uniformiser tous les boutons icon-only en `>=44px` dans `Flux/Budgets/AddTransaction`.
2. Réduire la densité des labels `11px` à `12-14px` selon hiérarchie mobile.
3. Ajouter tests UI mobile (Playwright viewport iPhone/Pixel): touch target, safe-area, modal keyboard overlap.
4. Ajouter mode offline UX minimal (état réseau + retry) sur vues data critiques.
