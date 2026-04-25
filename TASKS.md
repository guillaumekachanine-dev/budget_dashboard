# TASKS — dashboard_budget

## Statut général
- Projet : **dashboard_budget** (web app suivi financier personnel)
- Stack : React + Tailwind (Vite) · Supabase · Vercel · API Claude (NLP)
- Deadline v1 : 10 jours

---

## Phase 0 — Setup & Infrastructure
- [ ] Scaffolding Vite + React + Tailwind
- [ ] Configuration Supabase client (env vars)
- [ ] Auth Supabase (login unique utilisateur)
- [ ] Structure de routes (React Router)
- [ ] Intégration tokens design system (couleurs, fonts, radius)
- [ ] Bottom navigation fixe avec bouton "+" central
- [ ] Déploiement Vercel initial (preview)

## Phase 1 — Import des données
- [ ] Script d'import CSV → Supabase (1200 lignes 2025+2026)
- [ ] Vérification intégrité des données importées

## Phase 2 — Page Home
- [ ] Cartes de comptes (solde par compte)
- [ ] Carte hero gradient KPIs compte courant
  - Budget restant du mois
  - Dépenses du jour / rythme journalier
  - Solde actuel

## Phase 3 — Page Budgets
- [ ] Header : solde compte courant (affiché en grand)
- [ ] Barres de progression par catégorie (dépensé vs budget mensuel)
- [ ] Code couleur des barres (vert / orange / rouge selon avancement)
- [ ] Outil d'analyse filtré (catégorie, période, type)
- [ ] Feature NLP : requête langage naturel → SQL → résultat (API Claude)

## Phase 4 — Page Charts
- [ ] Graphique dépenses par catégorie (pie / donut)
- [ ] Graphique tendance mensuelle (ligne)
- [ ] Comparaison mois N vs mois N-1
- [ ] Filtre période (mois / trimestre / année)

## Phase 5 — Page Épargne
- [ ] État actuel de l'épargne par compte
- [ ] Objectifs définis avec taux d'atteinte
- [ ] Projections (modèle à définir)

## Phase 6 — Modale "+"
- [ ] Modale saisie rapide d'opération
- [ ] Champs : montant, catégorie, date, libellé, compte
- [ ] Date pré-remplie à aujourd'hui
- [ ] Sélection catégorie rapide (tap, pas de scroll)
- [ ] Validation et écriture Supabase en temps réel

## Phase 7 — Polish & Production
- [ ] Tests sur mobile (viewport, touch)
- [ ] Gestion des états vides et d'erreur
- [ ] Optimisation performances (requêtes Supabase)
- [ ] Déploiement Vercel production
- [ ] Import final des 1200 lignes en prod

## Backlog v2
- [ ] Sync bancaire Nordigen/GoCardless (PSD2)
- [ ] Notifications de dépassement de budget
- [ ] Export PDF / CSV des données
