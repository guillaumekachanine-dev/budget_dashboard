# Plan d'optimisation web performance

Référence utilisée: `src/web_performance_optimization_skill.md` (méthode en 5 étapes: mesure, diagnostic, priorisation, implémentation, vérification).

## 1) Mesurer (baseline)

Objectif: figer un avant/après sur mobile-first.

```bash
npm run build
npm run preview -- --host --port 4173
# Dans un autre terminal
npx lighthouse http://localhost:4173 --preset=desktop --output=html --output-path=docs/lighthouse-desktop.html
npx lighthouse http://localhost:4173 --preset=perf --form-factor=mobile --screenEmulation.mobile --output=html --output-path=docs/lighthouse-mobile.html
npm run build:analyze
```

Attendus à collecter:
- LCP, CLS, INP
- JS total initial (gzip/brotli)
- Nb de requêtes API au premier écran
- Time to Interactive sur écran Home

Premières mesures build (2026-04-29):
- `vendor-recharts`: 444.11 kB (117.61 kB gzip)
- `vendor`: 475.40 kB (138.99 kB gzip)
- `vendor-motion`: 109.76 kB (36.17 kB gzip)
- Plusieurs assets PNG catégories > 300 kB, max: `Epargne` 1,472.36 kB

## 2) Diagnostic actuel (repo)

Points coûteux identifiés:
- Bundle initial chargé trop tôt (routes lourdes `Budgets`/`Stats`).
- Pattern N+1 sur `useBudgets` (une requête transactions par catégorie).
- Tous les PNG de catégories chargés eagerly (`import.meta.glob(..., { eager: true })`).
- Caching React Query conservateur pour navigation mobile (re-fetch fréquent).

## 3) Priorisation (impact / risque)

P0 (fait dans ce lot):
- Route-based code splitting + prefetch intelligent.
- Réduction des requêtes Supabase dans `useBudgets`.
- Segmentation vendor chunks + script d'analyse bundle.
- Ajustement cache React Query global.

P1 (prochain lot):
- Icônes catégories en lazy import (non eager) + cache mémoire.
- Compression/format images (WebP/AVIF) + contrôle dimensions systématique.
- Optimisation des animations framer-motion (désactivation/reduced-motion + simplification).

P2:
- RUM web-vitals en production (LCP/CLS/INP) et tracking dans Supabase table dédiée.
- Optimisation SQL côté RPC pour agrégations mensuelles.

## 4) Implémentation (code appliqué)

### 4.1 Lazy routes + prefetch

`src/App.tsx`:

```tsx
const Home = lazy(() => import('@/pages/Home').then((m) => ({ default: m.Home })))
const Flux = lazy(() => import('@/pages/Flux').then((m) => ({ default: m.Flux })))
const Budgets = lazy(() => import('@/pages/Budgets').then((m) => ({ default: m.Budgets })))
const Stats = lazy(() => import('@/pages/Stats').then((m) => ({ default: m.Stats })))

useEffect(() => {
  if (!user) return
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(() => prefetchPrimaryRoutes(), { timeout: 1200 })
    return () => window.cancelIdleCallback(id)
  }
  const timeoutId = setTimeout(() => prefetchPrimaryRoutes(), 350)
  return () => clearTimeout(timeoutId)
}, [user])
```

Nouveau fichier `src/lib/routePrefetch.ts`:

```ts
export function prefetchPrimaryRoutes() {
  prefetchRoute('/flux')
  prefetchRoute('/budgets')
  prefetchRoute('/stats')
}
```

`src/components/layout/BottomNav.tsx`:

```tsx
<NavLink
  to={to}
  onMouseEnter={warmup}
  onFocus={warmup}
  onTouchStart={warmup}
/>
```

### 4.2 N+1 supprimé sur budgets

`src/hooks/useBudgets.ts`:

```ts
const { data: txns } = await supabase
  .from('transactions')
  .select('category_id, amount')
  .eq('flow_type', 'expense')
  .in('category_id', categoryIds)
  .gte('transaction_date', start)
  .lte('transaction_date', end)
```

Puis agrégation locale par `Map<category_id, spent>` au lieu d'une requête par budget.

### 4.3 Bundle analysis + chunking Vite

`package.json`:

```json
"build:analyze": "ANALYZE=true vite build"
```

`vite.config.ts`:

```ts
manualChunks(id) {
  if (id.includes('recharts')) return 'vendor-recharts'
  if (id.includes('framer-motion')) return 'vendor-motion'
  if (id.includes('@supabase/supabase-js')) return 'vendor-supabase'
  if (id.includes('@tanstack/react-query')) return 'vendor-query'
  if (id.includes('react-router-dom')) return 'vendor-router'
}
```

+ `rollup-plugin-visualizer` pour générer `dist/stats.html`.

### 4.4 Cache React Query

`src/main.tsx`:

```ts
queries: {
  retry: 1,
  staleTime: 60_000,
  gcTime: 15 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
}
```

## 5) Vérification

Checklist post-implémentation:
- `npm run build` sans erreur (actuellement bloqué par erreurs TypeScript déjà présentes dans `src/components/ui/Table.tsx`).
- `npm run build:analyze` puis ouverture de `dist/stats.html`.
- Lighthouse mobile/desktop avant-après.
- Vérifier UX nav mobile: pas de blanc lors du changement d'onglet.
- Vérifier que Budgets/Stats affichent les mêmes montants qu'avant (régression fonctionnelle).

## Prochain patch recommandé (P1)

Remplacer l'import eager des icônes catégories.

Exemple cible:

```ts
const iconModules = import.meta.glob('../../icones_categories_budget/*.png', {
  eager: false,
  import: 'default',
})
```

Puis résolution asynchrone avec cache mémoire pour éviter de pousser toutes les images dans le bundle initial.
