---
name: Feedback et préférences de travail
description: Préférences et contraintes de travail collectées pendant les sessions
type: feedback
---

## Pas de features superflues
L'app doit remplir son rôle et le faire bien. Ne pas ajouter de fonctionnalités au-delà du scope défini.
**Why:** Préférence explicite de l'utilisateur, exprimée dès le départ.
**How to apply:** Avant d'implémenter quoi que ce soit, vérifier que c'est dans TASKS.md.

## NLP text-to-SQL en v1
Inclure la feature de requête en langage naturel dès la v1 malgré la complexité.
**Why:** Jugée plus utile au quotidien que la sync bancaire, et faisable en 2-3 jours.
**How to apply:** Utiliser l'API Claude avec le schéma Supabase en contexte système. Requêtes SELECT uniquement.

## Sync bancaire = v2
Ne pas traiter la sync Nordigen en v1.
**Why:** Trop coûteuse en temps de développement (1 semaine estimée) pour la deadline de 10 jours.
**How to apply:** Mettre dans le backlog, ne pas l'aborder avant que la v1 soit en prod.
