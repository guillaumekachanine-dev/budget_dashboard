import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components'
import { getBudgetPeriods } from '@/features/budget/api/getBudgetPeriods'
import { BudgetParentGroups } from '@/features/budget/components/BudgetParentGroups'
import { BudgetSummaryCards } from '@/features/budget/components/BudgetSummaryCards'
import { useBudgetPagePayload } from '@/features/budget/hooks/useBudgetPagePayload'
import type { BudgetLineWithCategory, BudgetParentGroup, BudgetSummary } from '@/features/budget/types'
import { formatPeriodLabel } from '@/features/budget/utils/budgetSelectors'

function resolveDefaultPeriod(): { year: number; month: number } {
  const now = new Date()
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth()
  const nowDay = now.getDate()

  if (nowDay <= 3) {
    return {
      year: nowMonth === 0 ? nowYear - 1 : nowYear,
      month: nowMonth === 0 ? 12 : nowMonth,
    }
  }

  return {
    year: nowYear,
    month: nowMonth + 1,
  }
}

export function ConfiguredBudgetPilotagePanel() {
  const defaultPeriod = useMemo(() => resolveDefaultPeriod(), [])
  const [periodYear, setPeriodYear] = useState(defaultPeriod.year)
  const [periodMonth, setPeriodMonth] = useState(defaultPeriod.month)
  const [showPanel, setShowPanel] = useState(false)

  const {
    data: budgetPayload,
    loading,
    error,
    reload,
  } = useBudgetPagePayload({
    periodYear,
    periodMonth,
    monthsBack: 6,
  })

  useEffect(() => {
    let active = true

    const loadPeriods = async () => {
      try {
        const periods = await getBudgetPeriods()
        if (!active || periods.length === 0) return

        const hasCurrentSelection = periods.some(
          (period) => period.period_year === defaultPeriod.year && period.period_month === defaultPeriod.month,
        )

        if (!hasCurrentSelection) {
          setPeriodYear(periods[0].period_year)
          setPeriodMonth(periods[0].period_month)
        }
      } catch {
        // Le panel affiche déjà son état d'erreur via useBudgetPagePayload.
      }
    }

    void loadPeriods()

    return () => {
      active = false
    }
  }, [defaultPeriod.month, defaultPeriod.year])

  const payloadByBucket = useMemo(
    () => (Array.isArray(budgetPayload?.by_bucket) ? budgetPayload.by_bucket : []),
    [budgetPayload],
  )
  const payloadByParentCategory = useMemo(
    () => (Array.isArray(budgetPayload?.by_parent_category) ? budgetPayload.by_parent_category : []),
    [budgetPayload],
  )
  const payloadByCategory = useMemo(
    () => (Array.isArray(budgetPayload?.by_category) ? budgetPayload.by_category : []),
    [budgetPayload],
  )

  const configuredBudgetPeriod = useMemo(() => {
    if (!budgetPayload) return null

    const selectedPeriod = budgetPayload.selected_period
    return {
      period_year: Number(selectedPeriod?.period_year ?? periodYear),
      period_month: Number(selectedPeriod?.period_month ?? periodMonth),
      label: selectedPeriod?.label ?? formatPeriodLabel(periodYear, periodMonth),
    }
  }, [budgetPayload, periodMonth, periodYear])

  const configuredPeriodLabel = configuredBudgetPeriod
    ? formatPeriodLabel(
      configuredBudgetPeriod.period_year,
      configuredBudgetPeriod.period_month,
      configuredBudgetPeriod.label,
    )
    : 'Aucune période'

  const configuredBudgetCategoryLines = useMemo<BudgetLineWithCategory[]>(() => {
    if (!budgetPayload) return []
    const selectedPeriod = budgetPayload.selected_period
    const effectivePeriodYear = Number(selectedPeriod?.period_year ?? periodYear)
    const effectivePeriodMonth = Number(selectedPeriod?.period_month ?? periodMonth)

    return payloadByCategory.map((row) => ({
      id: `${row.category_id}:${effectivePeriodYear}-${effectivePeriodMonth}`,
      period_id: '',
      category_id: row.category_id,
      budget_kind: 'category' as const,
      amount: Number(row.budget_amount ?? 0),
      currency: 'EUR',
      notes: null,
      category_name: row.category_name,
      parent_category_id: row.parent_category_id,
      parent_category_name: row.parent_category_name,
      budget_bucket: row.budget_bucket,
      budget_method: null,
      decision_status: null,
      final_budget_monthly_eur: null,
      manual_budget_monthly_eur: null,
      recommendation_comment: null,
    }))
  }, [budgetPayload, payloadByCategory, periodMonth, periodYear])

  const configuredBudgetSummary = useMemo<BudgetSummary>(() => {
    const byBucket = new Map(payloadByBucket.map((row) => [row.budget_bucket, Number(row.budget_amount ?? 0)]))
    const totalBudgetMonthly = Number(budgetPayload?.summary.budget_total_reference ?? 0)

    return {
      totalBudgetMonthly,
      globalVariableBudget: 0,
      socleFixeBudget: byBucket.get('socle_fixe') ?? 0,
      variableEssentielleBudget: byBucket.get('variable_essentielle') ?? 0,
      provisionBudget: byBucket.get('provision') ?? 0,
      discretionnaireBudget: byBucket.get('discretionnaire') ?? 0,
      cagnotteProjetBudget: byBucket.get('cagnotte_projet') ?? 0,
      horsPilotageBudget: byBucket.get('hors_pilotage') ?? 0,
    }
  }, [budgetPayload, payloadByBucket])

  const configuredBudgetParentGroups = useMemo<BudgetParentGroup[]>(() => {
    if (!budgetPayload) return []

    return payloadByParentCategory.map((parentRow) => ({
      parentCategoryId: parentRow.parent_category_id,
      parentCategoryName: parentRow.parent_category_name,
      totalAmount: Number(parentRow.budget_amount ?? 0),
      lines: configuredBudgetCategoryLines.filter(
        (line) => (line.parent_category_id ?? line.category_id) === parentRow.parent_category_id,
      ),
    }))
  }, [budgetPayload, configuredBudgetCategoryLines, payloadByParentCategory])

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.26 }}
      style={{
        width: '100%',
        maxWidth: 600,
        margin: '0 auto',
        padding: 'var(--space-4) var(--space-4) 0',
        display: 'grid',
        gap: 'var(--space-4)',
      }}
    >
      <button
        type="button"
        onClick={() => setShowPanel((current) => !current)}
        aria-expanded={showPanel}
        aria-controls="configured-budget-panel"
        style={{
          border: 'none',
          background: 'transparent',
          width: '100%',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          textAlign: 'left',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 'var(--font-size-sm)',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--neutral-500)',
          }}
        >
          Pilotage budget configuré
        </p>
        <span style={{ flex: 1, height: 1, background: 'var(--neutral-200)' }} />
        <ChevronDown
          size={16}
          style={{
            color: 'var(--neutral-600)',
            transform: showPanel ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform var(--transition-base)',
            flexShrink: 0,
          }}
        />
      </button>

      <AnimatePresence initial={false}>
        {showPanel ? (
          <motion.div
            id="configured-budget-panel"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'grid', gap: 'var(--space-4)' }}
          >
            <div
              style={{
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-card)',
                border: '1px solid var(--neutral-200)',
                padding: 'var(--space-4)',
                display: 'grid',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'grid', gap: 4 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--neutral-500)',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Période budgétaire
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-md)', color: 'var(--neutral-900)', fontWeight: 800 }}>
                  {configuredPeriodLabel}
                </p>
              </div>

              {loading ? (
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-500)' }}>
                  Chargement du payload Budgets…
                </p>
              ) : null}

              {error ? (
                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-error)', fontWeight: 600 }}>
                    {error}
                  </p>
                  <div>
                    <Button type="button" variant="secondary" size="sm" onClick={() => void reload()}>
                      Réessayer
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            {configuredBudgetPeriod ? (
              <>
                <BudgetSummaryCards summary={configuredBudgetSummary} />
                <BudgetParentGroups groups={configuredBudgetParentGroups} />
              </>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  )
}
