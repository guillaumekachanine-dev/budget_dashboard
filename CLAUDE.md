# dashboard_budget — Mémoire de travail

## Projet
Web app personnelle de suivi financier. Un seul utilisateur. Pas de features superflues.

## Stack
| Outil | Rôle |
|-------|------|
| Vite + React | Frontend |
| Tailwind CSS | Styles (tokens du design system) |
| Supabase | Auth + DB (schéma `budget_dashboard`) |
| Vercel | Déploiement |
| API Claude (Anthropic) | Feature NLP text-to-SQL |

## Design System
- **Fonts** : DM Sans (UI) + DM Mono (chiffres)
- **Primaire** : `#5B57F5` (violet/indigo)
- **Positif** : `#2ED47A` · **Négatif** : `#FC5A5A` · **Warning** : `#FFAB2E`
- **Radius** : `sm=8` `md=12` `lg=16` `xl=20` `2xl=24` `full=9999`
- **Shadows** : `--shadow-card: 0 2px 12px rgba(28,28,58,0.07)`
- Fichier de référence : `/Users/dosta/Downloads/dashboard-budget/project/Budget Design System.html`

## Architecture des pages (bottom nav)
Nav order : **Home · Activité · [+FAB] · Budgets · Stats**

| Route | Page | Contenu |
|-------|------|---------|
| `/` | **Home** | Cartes comptes (carousel) + carte hero KPIs compte courant |
| `/activite` | **Activité** | Journal des opérations + filtres (période, catégorie, récurrentes) + recherche texte |
| — | **[+]** | Modale saisie rapide d'opération (FAB central) |
| `/budgets` | **Budgets** | Solde compte courant + barres de progression par catégorie |
| `/stats` | **Stats** | Graphiques (pie catégories, barres revenus/dépenses, flux net cumulé) + section Épargne (objectif, KPIs, historique) |

> `/charts` et `/epargne` redirigent vers `/stats` pour ne pas casser d'éventuels bookmarks.

## Supabase
- Projet : `ssrxraibinzmpndzudrs`
- Schéma : `budget_dashboard`
- Auth : utilisateur unique

## Données
- 1200 lignes d'opérations (2025 + 2026 YTD) prêtes en CSV
- Import à faire via script (Phase 1 du plan)

## Conventions
- Toujours utiliser les tokens CSS du design system (pas de valeurs en dur)
- Requêtes Supabase toutes scopées au schéma `budget_dashboard`
- Feature NLP : requêtes SQL en lecture seule uniquement (SELECT), valider avant exécution
- Mobile-first systématiquement

## Backlog v2 (ne pas traiter en v1)
- Sync bancaire Nordigen/GoCardless (PSD2)
