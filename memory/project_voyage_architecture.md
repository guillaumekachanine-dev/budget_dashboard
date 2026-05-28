---
name: voyage-architecture
description: trips.planned_budget is the single source of truth for all voyage budget calculations — category lines are excluded from every projection and analytics view
metadata:
  type: project
---

## Source de vérité unique : `trips.planned_budget`

Depuis mai 2026, tous les calculs liés au budget voyages utilisent uniquement `trips.planned_budget`.
Les anciennes lignes budgétaires par catégorie (Logement voyage, Repas voyage, Trajet voyage…) existent toujours dans la table `budgets` mais sont **exclues de toutes les vues de projection et d'analytics**.

**Why:** L'ancien mécanisme projetait par catégorie de dépense → les deux systèmes s'additionnaient (ex: 4832€ affiché au lieu de 2595€). `trips.planned_budget` est la vision macro pilotage, les catégories ne sont qu'un détail opérationnel.

**How to apply:** Quand on touche à des projections ou analytics voyage, vérifier que la source est bien `trips` et non `budgets WHERE budget_bucket = 'voyage'`.

## Vues DB modifiées (migrations 2026-05-26)

| Vue | Changement |
|-----|-----------|
| `v_annual_projection_overview_2026` | `voyage_trip_remaining` CTE : `sum(trips.planned_budget)` pour voyages futurs |
| `v_category_annual_cost_projection_2026` | Distribution proportionnelle de `trip_remaining` sur les sous-catégories voyage |
| `v_monthly_bucket_budgets_clean` | Bucket 'voyage' = trips groupés par `start_date` mois, au lieu des catégories |

## Logique de chevauchement mois

Un voyage appartient à un mois via `EXTRACT(month FROM start_date)` (mois de départ = mois budgétaire).
La cohérence est maintenue entre la vue mensuelle et les projections annuelles.

## Affichage UI (EnveloppesTab.tsx)

- Donut budget (vues catégories ET socles) : `voyageTripsBudget = sum(tripsForMonth.planned_budget)`
- Modale détail budget voyage : 1 ligne par voyage du mois, "Aucun voyage ce mois-ci" si vide
- Mode réel : inchangé (transactions réelles par catégorie)
- Hook : `useTripsForMonth(year, month)` — query key `QK.TRIPS_FOR_MONTH`
