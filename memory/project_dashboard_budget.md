---
name: Projet dashboard_budget
description: Contexte complet, décisions d'architecture et priorités du projet
type: project
---

## Objectif
Web app personnelle de suivi financier. Saisie, suivi et analyse des opérations financières avec visualisations.

## Décisions clés
- **NLP en v1** : feature text-to-SQL via API Claude sur le schéma Supabase — jugée plus utile que la sync bancaire pour la v1
- **Sync bancaire (Nordigen) en v2** : trop coûteuse en temps pour la deadline de 10 jours, mais prévue
- **Import CSV pour v1** : mécanisme d'import des 1200 lignes existantes + ajouts mensuels
- **Outil d'analyse en PLUS des barres** : l'outil d'analyse sur la page Budgets s'ajoute aux barres de progression, ne les remplace pas
- **Modale "+" critique** : point de friction principal identifié — la rapidité de saisie est prioritaire

## Page Épargne
Logique de projection pas encore définie — à clarifier avec l'utilisateur avant de coder :
- Option A : "à ce rythme, combien dans 12 mois ?" (extrapolation du taux d'épargne)
- Option B : "j'ai un objectif X€ pour date Y, suis-je en bonne voie ?" (suivi d'objectif)

## Supabase
- Projet ID : ssrxraibinzmpndzudrs
- Schéma : budget_dashboard
- URL dashboard : https://supabase.com/dashboard/project/ssrxraibinzmpndzudrs/editor/27540?schema=budget_dashboard

## Design system
- Source : /Users/dosta/Downloads/dashboard-budget/project/Budget Design System.html
- Primaire #5B57F5, DM Sans + DM Mono, radius 24px, mobile-first
