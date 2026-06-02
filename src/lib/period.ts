import { useState, useEffect } from 'react'

const MONTH_SHORT_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'] as const
const MONTH_FULL_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'] as const

export type CanonicalPeriod = {
  today: Date

  currentYear: number
  currentMonth: number        // 1–12 (base humaine)
  currentMonthKey: string     // YYYY-MM
  currentMonthStart: Date
  currentMonthEnd: Date

  lastClosedMonthYear: number
  lastClosedMonth: number     // 1–12
  lastClosedMonthKey: string  // YYYY-MM du mois précédant le mois courant
  lastClosedMonthStart: Date
  lastClosedMonthEnd: Date

  sameMonthPreviousYear: number
  sameMonthPreviousYearMonth: number
  sameMonthPreviousYearKey: string

  projectionYear: number
}

export type MonthMilestone = {
  id: string         // YYYY-MM
  shortLabel: string // 'Jan', 'Fév', …
  fullLabel: string  // 'Janvier 2026', …
}

export type OptimizationPeriodOption = {
  id: string
  label: string
  shortLabel: string
  mode: 'month' | 'year'
}

export function fmtMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function firstDay(year: number, month: number): Date {
  return new Date(year, month - 1, 1)
}

function lastDay(year: number, month: number): Date {
  return new Date(year, month, 0)
}

/**
 * Calcule la période canonique à partir d'une date (défaut : aujourd'hui).
 * Fonction pure, testable, sans effets de bord. Utilise les méthodes locales
 * de Date (pas toISOString) pour éviter les décalages UTC.
 *
 * Exemple pour le 2 juin 2026 :
 *   currentMonthKey        = '2026-06'
 *   lastClosedMonthKey     = '2026-05'
 *   sameMonthPreviousYearKey = '2025-05'
 *   projectionYear         = 2026
 */
export function getCanonicalPeriod(date?: Date): CanonicalPeriod {
  const today = date ?? new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  const lastClosedMonth = currentMonth === 1 ? 12 : currentMonth - 1
  const lastClosedMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear

  return {
    today,

    currentYear,
    currentMonth,
    currentMonthKey: fmtMonthKey(currentYear, currentMonth),
    currentMonthStart: firstDay(currentYear, currentMonth),
    currentMonthEnd: lastDay(currentYear, currentMonth),

    lastClosedMonthYear,
    lastClosedMonth,
    lastClosedMonthKey: fmtMonthKey(lastClosedMonthYear, lastClosedMonth),
    lastClosedMonthStart: firstDay(lastClosedMonthYear, lastClosedMonth),
    lastClosedMonthEnd: lastDay(lastClosedMonthYear, lastClosedMonth),

    sameMonthPreviousYear: lastClosedMonthYear - 1,
    sameMonthPreviousYearMonth: lastClosedMonth,
    sameMonthPreviousYearKey: fmtMonthKey(lastClosedMonthYear - 1, lastClosedMonth),

    projectionYear: currentYear,
  }
}

/**
 * Hook React réactif : retourne la période canonique et se met à jour
 * automatiquement quand le mois change, sans recharger la page.
 *
 * Déclenche un re-render uniquement si currentMonthKey change réellement
 * (= au changement de mois calendaire). Les re-checks se font :
 *  - au retour au premier plan (visibilitychange)
 *  - au focus de la fenêtre
 *  - toutes les 60 s (filet de sécurité pour minuit/fin de mois)
 */
export function useCanonicalPeriod(): CanonicalPeriod {
  const [period, setPeriod] = useState(() => getCanonicalPeriod())

  useEffect(() => {
    function refresh() {
      const next = getCanonicalPeriod()
      setPeriod((prev) =>
        prev.currentMonthKey === next.currentMonthKey ? prev : next,
      )
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', refresh)
    const timer = setInterval(refresh, 60_000)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', refresh)
      clearInterval(timer)
    }
  }, [])

  return period
}

/**
 * Génère les 12 jalons mensuels d'une année donnée.
 * Utilisé par SavingsPlanning pour construire le sélecteur de mois.
 */
export function generateMonthMilestones(year: number): MonthMilestone[] {
  return Array.from({ length: 12 }, (_, i) => ({
    id: fmtMonthKey(year, i + 1),
    shortLabel: MONTH_SHORT_FR[i] as string,
    fullLabel: `${MONTH_FULL_FR[i]} ${year}`,
  }))
}

/**
 * Génère les options de période pour l'onglet Optimisations.
 * Démarre au mois `fromMonth` (inclus) jusqu'à décembre, puis ajoute l'option "année entière".
 *
 * Exemple : generateOptimizationPeriodOptions(2026, 5) → Mai 26 … Déc 26, 2026
 */
export function generateOptimizationPeriodOptions(
  year: number,
  fromMonth: number,
): OptimizationPeriodOption[] {
  const months: OptimizationPeriodOption[] = []
  for (let m = fromMonth; m <= 12; m++) {
    months.push({
      id: fmtMonthKey(year, m),
      label: `${MONTH_FULL_FR[m - 1]} ${year}`,
      shortLabel: `${MONTH_SHORT_FR[m - 1]} ${String(year).slice(-2)}`,
      mode: 'month',
    })
  }
  months.push({
    id: `${year}-full`,
    label: `année ${year}`,
    shortLabel: String(year),
    mode: 'year',
  })
  return months
}
