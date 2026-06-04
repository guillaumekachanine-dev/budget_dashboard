import { useState, useMemo, useEffect, useRef, useCallback, type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { TransactionDetailsModal } from '@/components/modals/TransactionDetailsModal'
import { formatCurrencyFloored, getTxLabel, categoryColorFromName, todayIso } from '@/lib/utils'
import { BUDGET_BUCKET_COLORS, getBudgetBucketColor } from '@/lib/budgetBuckets'
import { useBudgetPagePayload } from '@/features/budget/hooks/useBudgetPagePayload'
import { useTripsForMonth } from '@/features/budget/hooks/useTripsForMonth'
import { useBudgetEnvelopeForecast, type ForecastSummary } from '@/hooks/useBudgetEnvelopeForecast'
import { useAuth } from '@/hooks/useAuth'
import { BudgetEnvelopeForecastModal, type BudgetEnvelopeForecastModalData } from '@/features/budget/components/BudgetEnvelopeForecastModal'
import type { Category, Transaction } from '@/lib/types'
import type { Trip } from '@/features/voyages/types'
import type { BudgetPageParentCategoryRow, BudgetPageBucketRow, BudgetPageCategoryRow } from '../types'
import blockFixeIcon from '@/assets/icons/blocks/fixe.webp'
import blockVariableIcon from '@/assets/icons/blocks/variable.webp'
import blockDiscretionnaireIcon from '@/assets/icons/blocks/discretionnaire.webp'
import blockProvisionsIcon from '@/assets/icons/blocks/provisions.webp'
import blockVoyagesIcon from '@/assets/icons/blocks/voyages.webp'
import blockEpargneIcon from '@/assets/icons/blocks/epargne.webp'
import blockRevenusIcon from '@/assets/icons/blocks/revenus.webp'

// ─── local helpers ────────────────────────────────────────────────────────────

const MONTHS_FR_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const MONTHS_FR_SHORT = ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']
const YEAR_OPTIONS = [2025, 2026] as const

function getPeriodRange(year: number, month: number): { startDate: string; endDate: string } {
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const now = new Date()
  const today = todayIso()
  const startDate = `${year}-${pad2(month)}-01`
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  if (isCurrentMonth) return { startDate, endDate: today }
  const monthEndDate = new Date(year, month, 0)
  return { startDate, endDate: `${monthEndDate.getFullYear()}-${pad2(monthEndDate.getMonth() + 1)}-${pad2(monthEndDate.getDate())}` }
}

function getFullMonthRange(year: number, month: number): { startDate: string; endDate: string } {
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const startDate = `${year}-${pad2(month)}-01`
  const monthEndDate = new Date(year, month, 0)
  return {
    startDate,
    endDate: `${monthEndDate.getFullYear()}-${pad2(monthEndDate.getMonth() + 1)}-${pad2(monthEndDate.getDate())}`,
  }
}

interface PieDatum {
  id: string
  name: string
  value: number
  color: string
}


function formatPercentSigned(value: number): string {
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

function formatTxDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
}


const CATEGORY_DISPLAY_ORDER = [
  'achats divers', 'alimentation', 'voyages', 'sorties',
  'transport', 'logement', 'famille enfant', 'business', 'sante',
  'abonnements', 'taxes frais', 'epargne',
] as const

function normalizeCategoryLabel(value?: string | null): string {
  if (!value) return ''
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const BUCKET_LABELS: Record<string, string> = {
  socle_fixe: 'Fixe',
  variable_essentielle: 'Variable',
  discretionnaire: 'Discrétionnaire',
  voyage: 'Voyages',
  provision: 'Provisions',
  epargne: 'Épargne',
}

const PILOTAGE_BUCKETS = ['socle_fixe', 'variable_essentielle', 'discretionnaire', 'voyage', 'provision']
const SOCLE_LIST_LABELS: Record<string, string> = {
  socle_fixe: 'Fixe',
  variable_essentielle: 'Variable essentielle',
  discretionnaire: 'Discrétionnaire',
  voyage: 'Voyages',
  provision: 'Provision',
  epargne: 'Épargne',
}
const SOCLE_LIST_ICON_SRC: Record<string, string> = {
  socle_fixe: blockFixeIcon,
  variable_essentielle: blockVariableIcon,
  discretionnaire: blockDiscretionnaireIcon,
  voyage: blockVoyagesIcon,
  provision: blockProvisionsIcon,
  epargne: blockEpargneIcon,
}
const BUCKET_MODAL_ICON_SRC: Record<string, string> = {
  socle_fixe: blockFixeIcon,
  variable_essentielle: blockVariableIcon,
  discretionnaire: blockDiscretionnaireIcon,
  voyage: blockVoyagesIcon,
  provision: blockProvisionsIcon,
}
const SOCLE_LIST_PROGRESS_COLORS: Record<string, string> = {
  socle_fixe: BUDGET_BUCKET_COLORS.socle_fixe,
  variable_essentielle: BUDGET_BUCKET_COLORS.variable_essentielle,
  discretionnaire: BUDGET_BUCKET_COLORS.discretionnaire,
  voyage: BUDGET_BUCKET_COLORS.voyage,
  provision: BUDGET_BUCKET_COLORS.provision,
  epargne: BUDGET_BUCKET_COLORS.epargne,
}
const CATEGORY_ORDER_MAP = new Map<string, number>(CATEGORY_DISPLAY_ORDER.map((key, i) => [key, i]))
const PILOTAGE_BUCKET_ORDER_MAP = new Map<string, number>(PILOTAGE_BUCKETS.map((key, i) => [key, i]))

function sortPieByCategoryOrder(a: PieDatum, b: PieDatum): number {
  const aRank = CATEGORY_ORDER_MAP.get(normalizeCategoryLabel(a.name)) ?? 999
  const bRank = CATEGORY_ORDER_MAP.get(normalizeCategoryLabel(b.name)) ?? 999
  if (aRank !== bRank) return aRank - bRank
  return a.name.localeCompare(b.name, 'fr')
}

function sortPieByBucketOrder(a: PieDatum, b: PieDatum): number {
  const aRank = PILOTAGE_BUCKET_ORDER_MAP.get(a.id) ?? 999
  const bRank = PILOTAGE_BUCKET_ORDER_MAP.get(b.id) ?? 999
  if (aRank !== bRank) return aRank - bRank
  return a.name.localeCompare(b.name, 'fr')
}

function extractPiePayload(slice: unknown): PieDatum | null {
  const s = slice as Record<string, unknown> | null
  if (!s) return null
  const payload = (s.payload ?? s) as Record<string, unknown>
  if (!payload.id && !payload.name) return null
  return payload as unknown as PieDatum
}

// ─── sub-components ───────────────────────────────────────────────────────────

interface MiniDonutProps {
  data: PieDatum[]
  total: number
  selectedId: string | null
  onSliceClick: (id: string, name: string, value: number, color: string) => void
  centerLabel?: string
  onCenterClick?: () => void
  centerActionLabel?: string
}

function MiniDonut({ data, total, selectedId, onSliceClick, centerLabel, onCenterClick, centerActionLabel }: MiniDonutProps) {
  return (
    <div style={{ position: 'relative', height: 190 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={56}
            outerRadius={86}
            startAngle={90}
            endAngle={-270}
            paddingAngle={2}
            stroke="var(--neutral-0)"
            strokeWidth={1}
            onClick={(slice: unknown) => {
              const payload = extractPiePayload(slice)
              if (!payload?.id) return
              onSliceClick(String(payload.id), String(payload.name ?? ''), Number(payload.value ?? 0), String(payload.color ?? 'var(--primary-500)'))
            }}
            labelLine={false}
            label={(props: unknown) => {
              const p = (props ?? {}) as { cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; payload?: PieDatum; value?: number }
              if (!p.payload || total <= 0) return null
              const pct = ((p.value ?? 0) / total) * 100
              if (pct < 9) return null
              const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0 } = p
              const radius = innerRadius + (outerRadius - innerRadius) * 0.56
              const radian = Math.PI / 180
              const x = cx + radius * Math.cos(-midAngle * radian)
              const y = cy + radius * Math.sin(-midAngle * radian)
              return (
                <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="var(--neutral-0)" fontSize={11} fontWeight={700}>
                  {`${pct.toFixed(0)}%`}
                </text>
              )
            }}
          >
            {data.map((entry) => {
              const isActive = entry.id === selectedId
              return (
                <Cell
                  key={entry.id}
                  fill={entry.color}
                  fillOpacity={isActive || !selectedId ? 1 : 0.35}
                  stroke={isActive ? 'var(--neutral-800)' : 'var(--neutral-0)'}
                  strokeWidth={isActive ? 2 : 1}
                  style={isActive ? { filter: 'brightness(1.08) drop-shadow(0 0 6px rgba(0,0,0,0.18))' } : undefined}
                />
              )
            })}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {onCenterClick ? (
        <button
          type="button"
          onClick={onCenterClick}
          aria-label={centerActionLabel ?? 'Voir le réalisé avec fixes planifiées'}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 108,
            height: 108,
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            zIndex: 1,
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          width: 104,
        }}
      >
        <span
          style={{
            display: 'block',
            fontSize: 'clamp(13px, 3.6vw, 18px)',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            color: 'var(--neutral-900)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          {formatCurrencyFloored(total)}
        </span>
        {centerLabel && (
          <span style={{ display: 'block', fontSize: 9, fontWeight: 600, color: 'var(--neutral-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4, lineHeight: 1 }}>
            {centerLabel}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── modal ────────────────────────────────────────────────────────────────────

interface SubCategoryBudgetLine {
  id: string
  name: string
  iconKey: string | null
  budgetAmount: number
}

interface SubCategoryRealLine {
  id: string
  name: string
  iconKey: string | null
  consumedAmount: number
  transactions: Transaction[]
}

interface SubModalProps {
  open: boolean
  onClose: () => void
  onSwitchMode: () => void
  name: string
  iconKey: string | null
  iconSrc?: string | null
  color: string
  consumedAmount: number
  budgetAmount: number
  clickedFrom: 'real' | 'budget'
  headerMetricLabel: 'Consommé' | 'Budgétisé'
  headerMetricAmount: number
  transactions: Transaction[]
  loading: boolean
  onSelectTransaction: (tx: Transaction) => void
  categoryById: Map<string, Category>
  subCategoryBudgets?: SubCategoryBudgetLine[]
  subCategoryReals?: SubCategoryRealLine[]
  subCategoryBudgetById: ReadonlyMap<string, number>
  expandedRealSubCategoryId: string | null
  onToggleRealSubCategory: (subCategoryId: string) => void
}

function SubModal({
  open,
  onClose,
  onSwitchMode,
  name,
  iconKey,
  iconSrc,
  color,
  consumedAmount,
  budgetAmount,
  clickedFrom,
  headerMetricLabel,
  headerMetricAmount,
  transactions,
  loading,
  onSelectTransaction,
  categoryById,
  subCategoryBudgets,
  subCategoryReals,
  subCategoryBudgetById,
  expandedRealSubCategoryId,
  onToggleRealSubCategory,
}: SubModalProps) {
  const remaining = budgetAmount - consumedAmount
  const remainingLabel = budgetAmount > 0
    ? (remaining >= 0 ? `Restant ${formatCurrencyFloored(remaining)}` : `Dépassé ${formatCurrencyFloored(Math.abs(remaining))}`)
    : null
  const isOverBudget = remaining < 0
  const isBudgetMode = clickedFrom === 'budget'

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 240, background: 'rgba(13,13,31,0.56)' }}
          />
          <div style={{ position: 'fixed', inset: 0, zIndex: 241, display: 'grid', placeItems: 'center', padding: 'var(--space-4)', pointerEvents: 'none' }}>
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', damping: 30, stiffness: 330 }}
              style={{ width: 'min(560px, 100%)', background: 'var(--neutral-0)', borderRadius: 'var(--radius-2xl)', maxHeight: 'min(82dvh, calc(100dvh - var(--space-8)))', overflow: 'hidden', boxShadow: 'var(--shadow-lg)', pointerEvents: 'auto' }}
            >
              {/* Header */}
              <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(255,255,255,0.15)', display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-3)', background: color }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', minWidth: 32 }}>
                  <button
                    type="button"
                    onClick={onSwitchMode}
                    aria-label={isBudgetMode ? 'Afficher la vue réel' : 'Afficher la vue budget'}
                    style={{ border: '1px solid var(--color-warning)', background: 'rgba(255,255,255,0.22)', borderRadius: 'var(--radius-full)', width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-warning)', flexShrink: 0 }}
                  >
                    {isBudgetMode ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                  {(iconKey || iconSrc) && (
                    <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {iconKey ? (
                        <CategoryIcon iconKey={iconKey} label={name} size={22} />
                      ) : iconSrc ? (
                        <img src={iconSrc} alt="" width={22} height={22} aria-hidden="true" style={{ display: 'block', objectFit: 'contain' }} />
                      ) : null}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--neutral-0)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.82)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                        {headerMetricLabel} {formatCurrencyFloored(headerMetricAmount)}
                      </span>
                      {!isBudgetMode && remainingLabel && (
                        <>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>·</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: isOverBudget ? 'rgba(252,90,90,0.95)' : 'rgba(46,212,122,0.95)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                            {remainingLabel}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 32 }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{ border: 'none', background: 'rgba(255,255,255,0.22)', borderRadius: 'var(--radius-full)', width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--neutral-0)', flexShrink: 0 }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div style={{ maxHeight: 'calc(min(82dvh, 100dvh - var(--space-8)) - 68px)', overflowY: 'auto' }}>
                {isBudgetMode && subCategoryBudgets ? (
                  /* Budget mode: sub-category budget allocations */
                  subCategoryBudgets.length === 0 ? (
                    <p style={{ margin: 0, padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)' }}>Aucune sous-catégorie budgétisée</p>
                  ) : (
                    subCategoryBudgets.map((line) => (
                      <div
                        key={line.id}
                        style={{ width: '100%', borderBottom: '1px solid var(--neutral-100)', padding: '10px var(--space-4)', display: 'grid', gridTemplateColumns: '22px minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-2)' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {line.iconKey ? (
                            <CategoryIcon iconKey={line.iconKey} label={line.name} size={18} />
                          ) : (
                            <div style={{ width: 16, height: 16, borderRadius: 'var(--radius-full)', background: 'var(--neutral-200)' }} />
                          )}
                        </div>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500, color: 'var(--neutral-800)' }}>{line.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-700)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{formatCurrencyFloored(line.budgetAmount)}</span>
                      </div>
                    ))
                  )
                ) : (
                  /* Real mode: transaction list */
                  loading ? (
                    <p style={{ margin: 0, padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)' }}>Chargement…</p>
                  ) : subCategoryReals ? (
                    subCategoryReals.length === 0 ? (
                      <p style={{ margin: 0, padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)' }}>Aucune sous-catégorie active sur cette période</p>
                    ) : (
                      subCategoryReals.map((line) => {
                        const isExpanded = expandedRealSubCategoryId === line.id
                        const lineBudgetAmount = subCategoryBudgetById.get(line.id) ?? 0
                        const isOverLineBudget = lineBudgetAmount > 0 && line.consumedAmount > lineBudgetAmount
                        return (
                          <div key={line.id} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                            <button
                              type="button"
                              onClick={() => onToggleRealSubCategory(line.id)}
                              style={{ width: '100%', border: 'none', padding: '9px var(--space-4)', display: 'grid', gridTemplateColumns: '22px minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-2)', background: isExpanded ? 'var(--neutral-50)' : 'transparent', textAlign: 'left', cursor: 'pointer', transition: 'background-color var(--transition-fast)' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {line.iconKey ? (
                                  <CategoryIcon iconKey={line.iconKey} label={line.name} size={18} />
                                ) : (
                                  <div style={{ width: 16, height: 16, borderRadius: 'var(--radius-full)', background: 'var(--neutral-200)' }} />
                                )}
                              </div>
                              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, color: 'var(--neutral-800)' }}>
                                {line.name}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: isOverLineBudget ? 'var(--color-error)' : 'var(--primary-700)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                                {formatCurrencyFloored(line.consumedAmount)}
                              </span>
                            </button>

                            {isExpanded ? (
                              <div style={{ background: 'var(--neutral-50)' }}>
                                {line.transactions.length === 0 ? (
                                  <p style={{ margin: 0, padding: 'var(--space-3) var(--space-4)', fontSize: 12, color: 'var(--neutral-500)' }}>
                                    Aucune opération ce mois
                                  </p>
                                ) : (
                                  line.transactions.map((tx) => {
                                    const txSubCat = tx.category_id ? categoryById.get(tx.category_id) : undefined
                                    return (
                                      <button
                                        key={tx.id}
                                        type="button"
                                        onClick={() => onSelectTransaction(tx)}
                                        style={{ width: '100%', border: 'none', borderTop: '1px solid var(--neutral-150)', padding: '8px var(--space-4)', display: 'grid', gridTemplateColumns: '36px 22px minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-2)', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--neutral-0)' }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                                      >
                                        <span style={{ fontSize: 11, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}>{formatTxDate(tx.transaction_date)}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          {txSubCat?.icon_key || line.iconKey ? (
                                            <CategoryIcon iconKey={txSubCat?.icon_key ?? line.iconKey} label={txSubCat?.name ?? line.name} size={18} />
                                          ) : (
                                            <div style={{ width: 16, height: 16, borderRadius: 'var(--radius-full)', background: 'var(--neutral-200)' }} />
                                          )}
                                        </div>
                                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500, color: 'var(--neutral-800)' }}>
                                          {getTxLabel(tx)}
                                        </span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-700)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                                          -{formatCurrencyFloored(Math.abs(Number(tx.amount)))}
                                        </span>
                                      </button>
                                    )
                                  })
                                )}
                              </div>
                            ) : null}
                          </div>
                        )
                      })
                    )
                  ) : transactions.length === 0 ? (
                    <p style={{ margin: 0, padding: 'var(--space-8) var(--space-5)', textAlign: 'center', color: 'var(--neutral-400)' }}>Aucune opération</p>
                  ) : (
                    transactions.map((tx) => {
                      const subCat = tx.category_id ? categoryById.get(tx.category_id) : undefined
                      return (
                        <button
                          key={tx.id}
                          type="button"
                          onClick={() => onSelectTransaction(tx)}
                          style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--neutral-100)', padding: '8px var(--space-4)', display: 'grid', gridTemplateColumns: '36px 22px minmax(0,1fr) auto', alignItems: 'center', gap: 'var(--space-2)', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--neutral-50)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                        >
                          <span style={{ fontSize: 11, color: 'var(--neutral-400)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}>{formatTxDate(tx.transaction_date)}</span>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {subCat?.icon_key ? (
                              <CategoryIcon iconKey={subCat.icon_key} label={subCat.name} size={18} />
                            ) : (
                              <div style={{ width: 16, height: 16, borderRadius: 'var(--radius-full)', background: 'var(--neutral-200)' }} />
                            )}
                          </div>
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500, color: 'var(--neutral-800)' }}>{getTxLabel(tx)}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-700)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>-{formatCurrencyFloored(Math.abs(Number(tx.amount)))}</span>
                        </button>
                      )
                    })
                  )
                )}
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

// ─── all-envelopes modal ──────────────────────────────────────────────────────

interface AllEnvelopesModalProps {
  open: boolean
  onClose: () => void
  displayMonthLabel: string
  parentCategoryRows: BudgetPageParentCategoryRow[]
  subCategoryRows: BudgetPageCategoryRow[]
  categoryById: Map<string, Category>
  tripsForMonth: Trip[]
  onTripClick?: (tripId: string) => void
}

export function AllEnvelopesModal({
  open,
  onClose,
  displayMonthLabel,
  parentCategoryRows,
  subCategoryRows,
  categoryById,
  tripsForMonth,
  onTripClick,
}: AllEnvelopesModalProps) {
  const [expandedParentId, setExpandedParentId] = useState<string | null>(null)
  void displayMonthLabel

  const sortedParents = useMemo(() => {
    return [...parentCategoryRows]
      .filter((row) => Number(row.budget_amount) > 0 && normalizeCategoryLabel(row.parent_category_name) !== 'epargne')
      .sort((a, b) => {
        const ra = CATEGORY_ORDER_MAP.get(normalizeCategoryLabel(a.parent_category_name)) ?? 999
        const rb = CATEGORY_ORDER_MAP.get(normalizeCategoryLabel(b.parent_category_name)) ?? 999
        if (ra !== rb) return ra - rb
        return a.parent_category_name.localeCompare(b.parent_category_name, 'fr')
      })
  }, [parentCategoryRows])

  const subsByParentId = useMemo(() => {
    const map = new Map<string, BudgetPageCategoryRow[]>()
    for (const row of subCategoryRows) {
      if (!row.parent_category_id || Number(row.budget_amount) <= 0) continue
      const existing = map.get(row.parent_category_id) ?? []
      existing.push(row)
      map.set(row.parent_category_id, existing)
    }
    for (const [key, rows] of map) {
      map.set(key, [...rows].sort((a, b) => Number(b.budget_amount) - Number(a.budget_amount)))
    }
    return map
  }, [subCategoryRows])

  function handleToggle(parentId: string) {
    setExpandedParentId((current) => (current === parentId ? null : parentId))
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 260, background: 'rgba(13,13,31,0.56)' }}
          />
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 261,
              display: 'grid',
              placeItems: 'center',
              padding: 'clamp(var(--space-6), 6dvh, var(--space-10)) var(--space-4)',
              pointerEvents: 'none',
            }}
          >
            <motion.div
              initial={{ y: 30, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              style={{
                width: 'min(520px, 100%)',
                background: 'linear-gradient(180deg, rgba(20, 23, 52, 0.96) 0%, rgba(14, 17, 39, 0.96) 100%)',
                borderRadius: 'var(--radius-2xl)',
                maxHeight: '100%',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 24px 70px rgba(4, 6, 20, 0.34)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
                style={{
                  padding: '12px var(--space-5) 10px',
                  display: 'grid',
                  gap: 4,
                  flexShrink: 0,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  background: 'linear-gradient(180deg, rgba(91, 87, 245, 0.14) 0%, rgba(91, 87, 245, 0.03) 100%)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', minHeight: 28 }}>
                  <div style={{ display: 'grid', minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(195,190,255,0.68)', lineHeight: 1.1 }}>
                      Pilotage budgétaire
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fermer"
                    style={{
                      flexShrink: 0,
                      border: '1px solid rgba(255,255,255,0.14)',
                      background: 'rgba(255,255,255,0.07)',
                      color: 'rgba(255,255,255,0.62)',
                      width: 28,
                      height: 28,
                      borderRadius: 'var(--radius-full)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              </motion.div>

              <div style={{ overflowY: 'auto', flex: 1, padding: 'var(--space-2) 0 var(--space-3)' }}>
                {sortedParents.map((parent, idx) => {
                  const isExpanded = expandedParentId === parent.parent_category_id
                  const cat = categoryById.get(parent.parent_category_id)
                  const normalizedName = normalizeCategoryLabel(parent.parent_category_name)
                  const isVoyagesParent = normalizedName === 'voyages'
                  const iconKey = normalizedName === 'epargne' ? 'epargne' : (cat?.icon_key ?? null)
                  const subs = subsByParentId.get(parent.parent_category_id) ?? []

                  return (
                    <motion.div
                      key={parent.parent_category_id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.12 + idx * 0.04 }}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggle(parent.parent_category_id)}
                        style={{
                          width: '100%',
                          border: 'none',
                          padding: '8px var(--space-5)',
                          display: 'grid',
                          gridTemplateColumns: '32px minmax(0,1fr) auto auto',
                          alignItems: 'center',
                          gap: 9,
                          background: isExpanded ? 'rgba(255,255,255,0.05)' : 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'background-color var(--transition-fast)',
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0) 42%, rgba(5,7,18,0.42) 100%), rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          <CategoryIcon
                            iconKey={iconKey}
                            label={parent.parent_category_name}
                            size={25}
                            style={{ transform: 'scale(1.14)' }}
                          />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: 'rgba(255,255,255,0.9)',
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {parent.parent_category_name}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: 'rgba(255,255,255,0.96)',
                            fontFamily: 'var(--font-mono)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatCurrencyFloored(Number(parent.budget_amount))}
                        </span>
                        <ChevronRight
                          size={14}
                          aria-hidden="true"
                          style={{
                            flexShrink: 0,
                            color: 'rgba(255,255,255,0.42)',
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 160ms ease',
                          }}
                        />
                      </button>

                      <AnimatePresence initial={false}>
                        {isExpanded ? (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div
                              style={{
                                padding: '2px 0 8px',
                                marginLeft: 'calc(var(--space-5) + 17px)',
                                borderLeft: '1px solid rgba(255,255,255,0.08)',
                              }}
                            >
                              {isVoyagesParent ? (
                                tripsForMonth.length === 0 ? (
                                  <div
                                    style={{
                                      padding: '8px var(--space-5) 8px var(--space-4)',
                                      display: 'grid',
                                      gridTemplateColumns: '22px minmax(0,1fr) auto',
                                      alignItems: 'center',
                                      gap: 'var(--space-2)',
                                    }}
                                  >
                                    <div style={{ width: 16, height: 16, borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.08)' }} />
                                    <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.46)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      aucun voyage ce mois-ci
                                    </span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.34)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                                      -
                                    </span>
                                  </div>
                                ) : (
                                  tripsForMonth.map((trip) => (
                                    <button
                                      key={trip.id}
                                      type="button"
                                      onClick={() => onTripClick?.(trip.id)}
                                      style={{
                                        width: '100%',
                                        border: 'none',
                                        padding: '8px var(--space-5) 8px var(--space-4)',
                                        display: 'grid',
                                        gridTemplateColumns: '22px minmax(0,1fr) auto',
                                        alignItems: 'center',
                                        gap: 'var(--space-2)',
                                        background: 'transparent',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                                      aria-label={`Ouvrir le voyage ${trip.name}`}
                                    >
                                      <div style={{ width: 16, height: 16, borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                                        {trip.emoji ?? '✈'}
                                      </div>
                                      <span
                                        style={{
                                          fontSize: 12,
                                          fontWeight: 500,
                                          color: 'rgba(255,255,255,0.68)',
                                          minWidth: 0,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {trip.name}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: 12,
                                          fontWeight: 700,
                                          color: 'rgba(255,255,255,0.84)',
                                          fontFamily: 'var(--font-mono)',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {formatCurrencyFloored(Number(trip.planned_budget ?? 0))}
                                      </span>
                                    </button>
                                  ))
                                )
                              ) : subs.length > 0 ? (
                                subs.map((sub) => {
                                  const subCat = categoryById.get(sub.category_id)
                                  const subIconKey = subCat?.icon_key ?? null
                                  return (
                                    <div
                                      key={sub.category_id}
                                      style={{
                                        padding: '8px var(--space-5) 8px var(--space-4)',
                                        display: 'grid',
                                        gridTemplateColumns: '22px minmax(0,1fr) auto',
                                        alignItems: 'center',
                                        gap: 'var(--space-2)',
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: 18,
                                          height: 18,
                                          borderRadius: '50%',
                                          overflow: 'hidden',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          flexShrink: 0,
                                          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0) 38%, rgba(5,7,18,0.38) 100%), rgba(255,255,255,0.07)',
                                          border: '1px solid rgba(255,255,255,0.06)',
                                        }}
                                      >
                                        {subIconKey ? (
                                          <CategoryIcon iconKey={subIconKey} label={sub.category_name} size={16} style={{ transform: 'scale(1.18)' }} />
                                        ) : (
                                          <div style={{ width: 16, height: 16, borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.08)' }} />
                                        )}
                                      </div>
                                      <span
                                        style={{
                                          fontSize: 12,
                                          fontWeight: 500,
                                          color: 'rgba(255,255,255,0.68)',
                                          minWidth: 0,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {sub.category_name}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: 12,
                                          fontWeight: 700,
                                          color: 'rgba(255,255,255,0.84)',
                                          fontFamily: 'var(--font-mono)',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {formatCurrencyFloored(Number(sub.budget_amount))}
                                      </span>
                                    </div>
                                  )
                                })
                              ) : (
                                <div
                                  style={{
                                    padding: '10px var(--space-5) 10px var(--space-4)',
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
                                >
                                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)' }}>
                                    Aucun détail disponible.
                                  </span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

// ─── details section ──────────────────────────────────────────────────────────

interface CategoryDetailsSectionProps {
  rows: BudgetPageParentCategoryRow[]
  categoryById: Map<string, Category>
  onCategoryClick?: (categoryId: string) => void
  sectionRef?: RefObject<HTMLElement | null>
  onShowAllEnvelopes?: () => void
}

function CategoryDetailsSection({ rows, categoryById, onCategoryClick, sectionRef, onShowAllEnvelopes }: CategoryDetailsSectionProps) {
  const sorted = useMemo(() => {
    const filtered = [...rows].filter((row) => Number(row.budget_amount) > 0 || Number(row.actual_amount) > 0)

    // La ligne Voyages doit toujours apparaître pour permettre la navigation vers sa page dédiée
    const hasVoyages = filtered.some((row) => normalizeCategoryLabel(row.parent_category_name) === 'voyages')
    let rowsToSort = filtered
    if (!hasVoyages) {
      const voyagesCat = [...categoryById.values()].find(
        (cat) => cat.parent_id === null && normalizeCategoryLabel(cat.name) === 'voyages',
      )
      if (voyagesCat) {
        rowsToSort = [
          ...filtered,
          {
            parent_category_id: voyagesCat.id,
            parent_category_name: voyagesCat.name,
            actual_amount: 0,
            budget_amount: 0,
            variance_amount: 0,
            variance_pct: null,
            share_actual_pct: null,
            share_budget_pct: null,
            avg_actual_last_6m: 0,
            avg_budget_last_6m: 0,
            avg_variance_pct_last_6m: null,
          } satisfies BudgetPageParentCategoryRow,
        ]
      }
    }

    return rowsToSort.sort((a, b) => {
      const ra = CATEGORY_ORDER_MAP.get(normalizeCategoryLabel(a.parent_category_name)) ?? 999
      const rb = CATEGORY_ORDER_MAP.get(normalizeCategoryLabel(b.parent_category_name)) ?? 999
      if (ra !== rb) return ra - rb
      return a.parent_category_name.localeCompare(b.parent_category_name, 'fr')
    })
  }, [rows, categoryById])

  if (sorted.length === 0) return null

  return (
    <section ref={sectionRef} style={{ padding: 'var(--space-8) var(--page-gutter) var(--space-8)' }}>
      <div style={{ margin: '0 0 var(--space-5) 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--neutral-900)', letterSpacing: '-0.01em' }}>
          Détails par catégorie
        </h3>
        {onShowAllEnvelopes && (
          <button
            type="button"
            onClick={onShowAllEnvelopes}
            style={{
              border: '1.5px solid var(--primary-500)',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--primary-600)',
              padding: '5px 10px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              flexShrink: 0,
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in oklab, var(--primary-500) 8%, transparent)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            Toutes les enveloppes
            <span
              style={{
                width: 0,
                height: 0,
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderTop: '5px solid var(--primary-500)',
                flexShrink: 0,
              }}
            />
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        {sorted.map((row) => {
          const budgetAmount = Number(row.budget_amount)
          const actualAmount = Number(row.actual_amount)
          const variance = budgetAmount - actualAmount
          const isOverBudget = variance < 0
          const progressPct = budgetAmount > 0 ? Math.min(100, Math.round((actualAmount / budgetAmount) * 100)) : 0
          const actualPct = budgetAmount > 0 ? Math.round((actualAmount / budgetAmount) * 100) : 0
          const cat = categoryById.get(row.parent_category_id)
          const normalizedName = normalizeCategoryLabel(row.parent_category_name)
          const iconKey = normalizedName === 'epargne' ? 'epargne' : (cat?.icon_key ?? null)
          const isSavings = normalizedName === 'epargne'
          const rightLabel = isSavings
            ? (variance !== 0 ? `Reste ${formatCurrencyFloored(variance)}` : '—')
            : (isOverBudget ? `Dépass. ${formatCurrencyFloored(Math.abs(variance))}` : `Reste ${formatCurrencyFloored(variance)}`)
          const rightColor = isSavings
            ? 'color-mix(in oklab, var(--color-warning) 72%, var(--neutral-900) 28%)'
            : (isOverBudget ? 'var(--color-error)' : 'var(--color-success)')

          return (
            <button
              key={row.parent_category_id}
              type="button"
              onClick={onCategoryClick ? () => onCategoryClick(row.parent_category_id) : undefined}
              style={{
                display: 'grid',
                gridTemplateColumns: '44px 1fr',
                gap: 'var(--space-4)',
                alignItems: 'center',
                width: '100%',
                border: 'none',
                background: 'transparent',
                padding: 0,
                textAlign: 'left',
                cursor: onCategoryClick ? 'pointer' : 'default',
                transition: 'opacity var(--transition-fast)',
              }}
              onMouseEnter={onCategoryClick ? (e) => { e.currentTarget.style.opacity = '0.7' } : undefined}
              onMouseLeave={onCategoryClick ? (e) => { e.currentTarget.style.opacity = '1' } : undefined}
            >
              {/* Icon */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CategoryIcon iconKey={iconKey} label={row.parent_category_name} size={44} />
              </div>

              {/* Content */}
              <div style={{ display: 'grid', gap: 'var(--space-1)', minWidth: 0, minHeight: 44, alignContent: 'center' }}>
                {/* Row 1: name + consumed% | restant/dépassé */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--space-3)', alignItems: 'baseline' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--neutral-800)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.parent_category_name}
                    <span style={{ fontWeight: 500, color: 'var(--neutral-500)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
                      {' '}- {formatCurrencyFloored(actualAmount).replace(/\s+€/, '€')} ({actualPct}%)
                    </span>
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: rightColor, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {rightLabel}
                  </p>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--neutral-150)', overflow: 'hidden', marginTop: 3 }}>
                  <div style={{ width: `${progressPct}%`, height: '100%', borderRadius: 'var(--radius-pill)', background: isOverBudget ? 'var(--color-error)' : 'var(--primary-500)', transition: 'width var(--transition-base)' }} />
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

interface SelectedEntry {
  id: string
  name: string
  realAmount: number
  budgetAmount: number
  color: string
}

interface ModalTarget {
  id: string
  name: string
  scopeKind: 'category' | 'bucket'
  iconKey: string | null
  iconSrc: string | null
  amount: number
  budgetAmount: number
  color: string
  headerMetricLabel: 'Consommé' | 'Budgétisé'
  headerMetricAmount: number
  clickedFrom: 'real' | 'budget'
}

interface SocleListRow {
  id: string
  label: string
  budgetAmount: number
  actualAmount: number
  color: string
  iconSrc: string
}

interface EnvelopeForecastSummary {
  realizedAmount: number
  futureFixedAmount: number
  realizedPlusFutureFixedAmount: number
}

export interface EnveloppesTabProps {
  onCategoryClick?: (categoryId: string) => void
  onBlockClick?: (blockId: string) => void
  onRevenueClick?: () => void
  initialViewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  restoreRequest?: {
    mode: ViewMode
    anchor: 'categories_list' | 'socles_list'
    token: number
  } | null
}

type ViewMode = 'categories' | 'socles'

export function EnveloppesTab({
  onCategoryClick,
  onBlockClick,
  onRevenueClick,
  initialViewMode = 'categories',
  onViewModeChange,
  restoreRequest = null,
}: EnveloppesTabProps) {
  const { user } = useAuth()
  const { data: categories = [] } = useCategories()
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const todayNow = new Date()
  const [year, setYear] = useState(todayNow.getFullYear())
  const [month, setMonth] = useState(todayNow.getMonth() + 1)
  const [showMonthModal, setShowMonthModal] = useState(false)
  const [modalPickerYear, setModalPickerYear] = useState(todayNow.getFullYear())

  const { data: budgetPayload } = useBudgetPagePayload({ periodYear: year, periodMonth: month })
  const payloadByParentCategory = useMemo<BudgetPageParentCategoryRow[]>(
    () => (Array.isArray(budgetPayload?.by_parent_category) ? budgetPayload.by_parent_category : []),
    [budgetPayload],
  )
  const payloadByBucket = useMemo(() => {
    const rows = Array.isArray(budgetPayload?.by_bucket) ? budgetPayload.by_bucket : []
    return rows.reduce<Record<string, BudgetPageBucketRow>>((acc, row) => {
      const key = String(row?.budget_bucket ?? '')
      if (key) acc[key] = row
      return acc
    }, {})
  }, [budgetPayload])
  const payloadByCategory = useMemo(
    () => (Array.isArray(budgetPayload?.by_category) ? budgetPayload.by_category : []),
    [budgetPayload],
  )
  const parentCategoryRowsWithoutSavings = useMemo(
    () => payloadByParentCategory.filter((row) => normalizeCategoryLabel(row.parent_category_name) !== 'epargne'),
    [payloadByParentCategory],
  )

  const { data: tripsForMonth = [] } = useTripsForMonth(year, month)
  const voyageTripsBudget = useMemo(
    () => tripsForMonth.reduce((sum, t) => sum + (t.planned_budget ?? 0), 0),
    [tripsForMonth],
  )
  const voyagesRootCategoryId = useMemo(
    () =>
      categories.find(
        (category) => category.parent_id === null && normalizeCategoryLabel(category.name) === 'voyages',
      )?.id ?? null,
    [categories],
  )

  const { startDate, endDate } = useMemo(() => getPeriodRange(year, month), [year, month])
  const forecastRange = useMemo(() => getFullMonthRange(year, month), [year, month])
  const { data: envelopeForecastData } = useBudgetEnvelopeForecast({
    userId: user?.id,
    startDate: forecastRange.startDate,
    endDate: forecastRange.endDate,
  })

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  function isMonthDisabled(_y: number, _m: number) {
    void _y
    void _m
    return false
  }

  function isFutureMonth(y: number, m: number) {
    return y > currentYear || (y === currentYear && m > currentMonth)
  }

  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)
  const categoryListSectionRef = useRef<HTMLElement | null>(null)
  const soclesListSectionRef = useRef<HTMLElement | null>(null)
  const [showAllEnvelopes, setShowAllEnvelopes] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<SelectedEntry | null>(null)
  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null)
  const [forecastModalEnvelope, setForecastModalEnvelope] = useState<BudgetEnvelopeForecastModalData | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [subCategoryTransactionSequence, setSubCategoryTransactionSequence] = useState<Transaction[]>([])
  const [pendingTransaction, setPendingTransaction] = useState<Transaction | null>(null)
  const [modalToReopen, setModalToReopen] = useState<ModalTarget | null>(null)
  const [expandedRealSubCategoryId, setExpandedRealSubCategoryId] = useState<string | null>(null)
  const [realSubCategoryToReopenId, setRealSubCategoryToReopenId] = useState<string | null>(null)

  // Reset selection when switching view mode
  useEffect(() => { setSelectedEntry(null) }, [viewMode])

  const setViewModeAndNotify = useCallback((nextMode: ViewMode) => {
    setViewMode(nextMode)
    onViewModeChange?.(nextMode)
  }, [onViewModeChange])

  const scrollToListAnchorTop = useCallback((anchor: 'categories_list' | 'socles_list'): boolean => {
    const target = anchor === 'socles_list' ? soclesListSectionRef.current : categoryListSectionRef.current
    if (!target) return false
    const rawHeader = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim()
    const headerPx = Number.parseFloat(rawHeader || '0')
    const effectiveOffset = Number.isFinite(headerPx) ? headerPx + 10 : 78
    const targetY = Math.max(0, target.getBoundingClientRect().top + window.scrollY - effectiveOffset)
    const scroller = document.scrollingElement as HTMLElement | null
    if (scroller) scroller.scrollTo({ top: targetY, left: 0, behavior: 'auto' })
    window.scrollTo({ top: targetY, left: 0, behavior: 'auto' })
    return true
  }, [])

  useEffect(() => {
    if (!restoreRequest) return

    setViewModeAndNotify(restoreRequest.mode)

    let cancelled = false
    const tryScroll = (attemptsLeft: number) => {
      if (cancelled) return
      const didScroll = scrollToListAnchorTop(restoreRequest.anchor)
      if (didScroll) {
        window.requestAnimationFrame(() => {
          if (cancelled) return
          void scrollToListAnchorTop(restoreRequest.anchor)
        })
        return
      }
      if (attemptsLeft <= 0) return
      window.setTimeout(() => {
        tryScroll(attemptsLeft - 1)
      }, 48)
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        tryScroll(16)
      })
    })

    return () => {
      cancelled = true
    }
  }, [restoreRequest, setViewModeAndNotify, scrollToListAnchorTop])

  // Pending transaction → open detail modal (after sub-modal closes)
  useEffect(() => {
    if (!pendingTransaction || modalTarget) return
    const id = window.setTimeout(() => {
      setSelectedTransaction(pendingTransaction)
      setPendingTransaction(null)
    }, 280)
    return () => window.clearTimeout(id)
  }, [pendingTransaction, modalTarget])

  // ── pie data ──────────────────────────────────────────────────────────────

  const catRealPieData = useMemo<PieDatum[]>(
    () =>
      parentCategoryRowsWithoutSavings
        .map((row) => ({ id: row.parent_category_id, name: row.parent_category_name, value: Number(row.actual_amount ?? 0), color: categoryColorFromName(row.parent_category_name) }))
        .filter((d) => d.value > 0)
        .sort(sortPieByCategoryOrder),
    [parentCategoryRowsWithoutSavings],
  )

  const catBudgetPieData = useMemo<PieDatum[]>(
    () =>
      parentCategoryRowsWithoutSavings
        .map((row) => {
          const isVoyage = normalizeCategoryLabel(row.parent_category_name) === 'voyages'
          return { id: row.parent_category_id, name: row.parent_category_name, value: isVoyage ? voyageTripsBudget : Number(row.budget_amount ?? 0), color: categoryColorFromName(row.parent_category_name) }
        })
        .filter((d) => d.value > 0)
        .sort(sortPieByCategoryOrder),
    [parentCategoryRowsWithoutSavings, voyageTripsBudget],
  )

  const bucketRealPieData = useMemo<PieDatum[]>(
    () =>
      PILOTAGE_BUCKETS
        .flatMap((bucket) => {
          const row = payloadByBucket[bucket]
          if (!row || Number(row.actual_amount) <= 0) return []
          return [{ id: bucket, name: BUCKET_LABELS[bucket] ?? bucket, value: Number(row.actual_amount), color: getBudgetBucketColor(bucket) }]
        })
        .sort(sortPieByBucketOrder),
    [payloadByBucket],
  )

  const bucketBudgetPieData = useMemo<PieDatum[]>(
    () =>
      PILOTAGE_BUCKETS
        .flatMap((bucket) => {
          const row = payloadByBucket[bucket]
          const budgetAmt = bucket === 'voyage' ? voyageTripsBudget : Number(row?.budget_amount ?? 0)
          if (!row || budgetAmt <= 0) return []
          return [{ id: bucket, name: BUCKET_LABELS[bucket] ?? bucket, value: budgetAmt, color: getBudgetBucketColor(bucket) }]
        })
        .sort(sortPieByBucketOrder),
    [payloadByBucket, voyageTripsBudget],
  )

  const realPieData = viewMode === 'categories' ? catRealPieData : bucketRealPieData
  const budgetPieData = viewMode === 'categories' ? catBudgetPieData : bucketBudgetPieData

  const realTotal = useMemo(() => realPieData.reduce((s, d) => s + d.value, 0), [realPieData])
  const budgetTotal = useMemo(() => budgetPieData.reduce((s, d) => s + d.value, 0), [budgetPieData])
  const parentForecastById = useMemo<Record<string, EnvelopeForecastSummary>>(() => {
    const acc: Record<string, EnvelopeForecastSummary> = {}
    const byCategoryId = envelopeForecastData?.byCategoryId ?? {}
    for (const [categoryId, summary] of Object.entries(byCategoryId)) {
      const parentId = categoryById.get(categoryId)?.parent_id ?? categoryId
      if (!acc[parentId]) {
        acc[parentId] = {
          realizedAmount: 0,
          futureFixedAmount: 0,
          realizedPlusFutureFixedAmount: 0,
        }
      }
      acc[parentId].realizedAmount += summary.realizedAmount
      acc[parentId].futureFixedAmount += summary.futureFixedAmount
      acc[parentId].realizedPlusFutureFixedAmount += summary.realizedPlusFutureFixedAmount
    }
    return acc
  }, [categoryById, envelopeForecastData?.byCategoryId])

  const top5 = useMemo(() => realPieData.slice(0, 5), [realPieData])
  const socleListRows = useMemo<SocleListRow[]>(
    () =>
      PILOTAGE_BUCKETS.flatMap((bucket) => {
        const row = payloadByBucket[bucket]
        if (!row) return []
        const budgetAmount = bucket === 'voyage' ? voyageTripsBudget : Number(row.budget_amount ?? 0)
        const actualAmount = Number(row.actual_amount ?? 0)
        if (budgetAmount <= 0 && actualAmount <= 0) return []
        return [{
          id: bucket,
          label: SOCLE_LIST_LABELS[bucket] ?? (BUCKET_LABELS[bucket] ?? bucket),
          budgetAmount,
          actualAmount,
          color: getBudgetBucketColor(bucket),
          iconSrc: SOCLE_LIST_ICON_SRC[bucket] ?? blockFixeIcon,
        }]
      }),
    [payloadByBucket, voyageTripsBudget],
  )
  const monthlyCommitmentsTarget = useMemo(
    () => socleListRows.reduce((sum, row) => sum + row.budgetAmount, 0),
    [socleListRows],
  )
  const revenueBucket = payloadByBucket.revenu ?? null
  const selectedMonthRevenueAmount = Math.max(0, Number(revenueBucket?.actual_amount ?? 0))
  const revenueCoveragePct = monthlyCommitmentsTarget > 0 ? (selectedMonthRevenueAmount / monthlyCommitmentsTarget) * 100 : 0
  const revenueProgressPct = Math.min(100, Math.max(0, Math.round(revenueCoveragePct)))
  const isRevenueAboveTarget = selectedMonthRevenueAmount > monthlyCommitmentsTarget
  const revenueSurplusPct = monthlyCommitmentsTarget > 0 ? ((selectedMonthRevenueAmount - monthlyCommitmentsTarget) / monthlyCommitmentsTarget) * 100 : null

  const emptyForecastSummary = useMemo<ForecastSummary>(
    () => ({ realizedAmount: 0, futureFixedAmount: 0, realizedPlusFutureFixedAmount: 0 }),
    [],
  )

  const openForecastModal = useCallback(() => {
    const selectedName = selectedEntry?.name ?? (viewMode === 'categories' ? 'Toutes les enveloppes' : 'Tous les socles')
    const selectedBudgetAmount = selectedEntry?.budgetAmount ?? budgetTotal

    let summary: EnvelopeForecastSummary
    if (selectedEntry) {
      summary = viewMode === 'categories'
        ? (parentForecastById[selectedEntry.id] ?? emptyForecastSummary)
        : (envelopeForecastData?.byBucket[selectedEntry.id] ?? emptyForecastSummary)
    } else {
      summary = envelopeForecastData?.total ?? emptyForecastSummary
    }

    setForecastModalEnvelope({
      name: selectedName,
      realizedAmount: summary.realizedAmount,
      futureFixedAmount: summary.futureFixedAmount,
      realizedPlusFutureFixedAmount: summary.realizedPlusFutureFixedAmount,
      budgetAmount: Number.isFinite(selectedBudgetAmount) ? selectedBudgetAmount : null,
    })
  }, [budgetTotal, emptyForecastSummary, envelopeForecastData?.byBucket, envelopeForecastData?.total, parentForecastById, selectedEntry, viewMode])

  // ── transactions for modal ────────────────────────────────────────────────

  const modalCategoryIds = useMemo(() => {
    if (!modalTarget || modalTarget.clickedFrom === 'budget') return undefined
    if (modalTarget.scopeKind === 'category') {
      const ids = [modalTarget.id]
      categories.forEach((c) => { if (c.parent_id === modalTarget.id) ids.push(c.id) })
      return ids
    }
    const bucketCategoryIds = payloadByCategory
      .filter((row) => row.budget_bucket === modalTarget.id)
      .map((row) => row.category_id)
      .filter((id): id is string => Boolean(id))
    return [...new Set(bucketCategoryIds)]
  }, [modalTarget, categories, payloadByCategory])

  const hasModalCategoryIds = modalCategoryIds == null || modalCategoryIds.length > 0

  const { data: modalTransactions = [], isLoading: loadingModalTx } = useTransactions(
    { startDate, endDate, flowType: 'expense', categoryIds: modalCategoryIds, debugSource: 'EnveloppesTab:modal' },
    { enabled: Boolean(modalTarget) && modalTarget?.clickedFrom !== 'budget' && hasModalCategoryIds },
  )

  const subCategoryBudgetById = useMemo(() => {
    if (!modalTarget) return new Map<string, number>()
    const scopedRows = modalTarget.scopeKind === 'category'
      ? payloadByCategory.filter((row) => row.parent_category_id === modalTarget.id || row.category_id === modalTarget.id)
      : payloadByCategory.filter((row) => row.budget_bucket === modalTarget.id)
    const next = new Map<string, number>()
    for (const row of scopedRows) {
      next.set(row.category_id, Number(row.budget_amount ?? 0))
    }
    return next
  }, [modalTarget, payloadByCategory])

  const subCategoryBudgets = useMemo<SubCategoryBudgetLine[]>(() => {
    if (!modalTarget || modalTarget.clickedFrom !== 'budget') return []

    // Voyage (categories or socles view) → show one line per trip instead of sub-categories
    const isVoyageModal =
      (modalTarget.scopeKind === 'bucket' && modalTarget.id === 'voyage') ||
      (modalTarget.scopeKind === 'category' && normalizeCategoryLabel(modalTarget.name) === 'voyages')
    if (isVoyageModal) {
      if (tripsForMonth.length === 0) {
        return [{ id: '_no_voyage', name: 'Aucun voyage ce mois-ci', iconKey: null, budgetAmount: 0 }]
      }
      return tripsForMonth.map((trip) => ({
        id: trip.id,
        name: `${trip.emoji ? `${trip.emoji} ` : ''}${trip.name}`,
        iconKey: null,
        budgetAmount: trip.planned_budget ?? 0,
      }))
    }

    const scopedRows = modalTarget.scopeKind === 'category'
      ? payloadByCategory.filter((row) => row.parent_category_id === modalTarget.id)
      : payloadByCategory.filter((row) => row.budget_bucket === modalTarget.id)
    return scopedRows
      .filter((row) => Number(row.budget_amount) > 0)
      .map((row) => ({
        id: row.category_id,
        name: row.category_name,
        iconKey: categoryById.get(row.category_id)?.icon_key ?? null,
        budgetAmount: Number(row.budget_amount),
      }))
      .sort((a, b) => b.budgetAmount - a.budgetAmount)
  }, [modalTarget, payloadByCategory, categoryById, tripsForMonth])

  const subCategoryReals = useMemo<SubCategoryRealLine[]>(() => {
    if (!modalTarget || modalTarget.clickedFrom !== 'real') return []

    const linesById = new Map<string, SubCategoryRealLine>()
    const registerLine = (id: string, name: string, iconKey: string | null, consumedAmount: number) => {
      const existing = linesById.get(id)
      if (existing) {
        existing.consumedAmount = Math.max(existing.consumedAmount, consumedAmount)
        return
      }
      linesById.set(id, { id, name, iconKey, consumedAmount, transactions: [] })
    }

    for (const row of payloadByCategory) {
      const belongsToScope = modalTarget.scopeKind === 'category'
        ? (row.parent_category_id === modalTarget.id || row.category_id === modalTarget.id)
        : row.budget_bucket === modalTarget.id
      if (!belongsToScope) continue
      const id = row.category_id
      if (!id) continue
      registerLine(
        id,
        row.category_name,
        categoryById.get(id)?.icon_key ?? null,
        Number(row.actual_amount ?? 0),
      )
    }

    const scopedCategoryIds = new Set(
      payloadByCategory
        .filter((row) => {
          if (modalTarget.scopeKind === 'category') {
            return row.parent_category_id === modalTarget.id || row.category_id === modalTarget.id
          }
          return row.budget_bucket === modalTarget.id
        })
        .map((row) => row.category_id),
    )

    for (const tx of modalTransactions) {
      const categoryId = tx.category_id
      if (!categoryId) continue
      const txCategory = categoryById.get(categoryId)
      const belongsToScope = modalTarget.scopeKind === 'category'
        ? (categoryId === modalTarget.id || txCategory?.parent_id === modalTarget.id)
        : scopedCategoryIds.has(categoryId)
      if (!belongsToScope) continue

      const fallbackName = txCategory?.name ?? modalTarget.name
      if (!linesById.has(categoryId)) {
        registerLine(categoryId, fallbackName, txCategory?.icon_key ?? null, 0)
      }
      linesById.get(categoryId)?.transactions.push(tx)
    }

    const toTimestamp = (date: string): number => {
      const ts = new Date(`${date}T00:00:00`).getTime()
      return Number.isFinite(ts) ? ts : 0
    }

    return [...linesById.values()]
      .map((line) => {
        const transactions = [...line.transactions].sort((a, b) => toTimestamp(b.transaction_date) - toTimestamp(a.transaction_date))
        const txTotal = transactions.reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0)
        return {
          ...line,
          consumedAmount: line.consumedAmount > 0 ? line.consumedAmount : txTotal,
          transactions,
        }
      })
      .filter((line) => line.consumedAmount > 0 || line.transactions.length > 0)
      .sort((a, b) => {
        if (b.consumedAmount !== a.consumedAmount) return b.consumedAmount - a.consumedAmount
        return a.name.localeCompare(b.name, 'fr')
      })
  }, [modalTarget, payloadByCategory, categoryById, modalTransactions])

  useEffect(() => {
    setExpandedRealSubCategoryId(null)
    setRealSubCategoryToReopenId(null)
  }, [year, month, viewMode])

  // ── handlers ──────────────────────────────────────────────────────────────

  function selectEntry(id: string, name: string, realAmount: number, budgetAmount: number, color: string) {
    setSelectedEntry({ id, name, realAmount, budgetAmount, color })
  }

  function handleDonutClick(
    id: string,
    name: string,
    realAmount: number,
    budgetAmount: number,
    color: string,
    clickedFrom: 'real' | 'budget',
  ) {
    selectEntry(id, name, realAmount, budgetAmount, color)
    setExpandedRealSubCategoryId(null)
    setRealSubCategoryToReopenId(null)
    const isCategoryMode = viewMode === 'categories'
    const modalName = isCategoryMode ? name : `Socle ${String(SOCLE_LIST_LABELS[id] ?? name).toLowerCase()}`
    setModalTarget({
      id,
      name: modalName,
      scopeKind: isCategoryMode ? 'category' : 'bucket',
      iconKey: isCategoryMode ? (categoryById.get(id)?.icon_key ?? null) : null,
      iconSrc: isCategoryMode ? null : (BUCKET_MODAL_ICON_SRC[id] ?? null),
      amount: realAmount,
      budgetAmount,
      color,
      headerMetricLabel: clickedFrom === 'budget' ? 'Budgétisé' : 'Consommé',
      headerMetricAmount: clickedFrom === 'budget' ? budgetAmount : realAmount,
      clickedFrom,
    })
  }

  const handleToggleModalMode = useCallback(() => {
    setExpandedRealSubCategoryId(null)
    setRealSubCategoryToReopenId(null)
    setModalTarget((current) => {
      if (!current) return null
      const nextClickedFrom = current.clickedFrom === 'real' ? 'budget' : 'real'
      return {
        ...current,
        headerMetricLabel: nextClickedFrom === 'budget' ? 'Budgétisé' : 'Consommé',
        headerMetricAmount: nextClickedFrom === 'budget' ? current.budgetAmount : current.amount,
        clickedFrom: nextClickedFrom,
      }
    })
  }, [])

  function handleListRowClick(entry: PieDatum) {
    const budgetEntry = budgetPieData.find((d) => d.id === entry.id)
    selectEntry(entry.id, entry.name, entry.value, budgetEntry?.value ?? 0, entry.color)
  }

  function handleSelectTransaction(tx: Transaction) {
    setSubCategoryTransactionSequence(modalTransactions)
    if (modalTarget) {
      setModalToReopen(modalTarget)
      if (modalTarget.clickedFrom === 'real') {
        setRealSubCategoryToReopenId(expandedRealSubCategoryId)
      } else {
        setRealSubCategoryToReopenId(null)
      }
      setModalTarget(null)
    }
    setPendingTransaction(tx)
  }

  function handleCloseTransaction() {
    setSelectedTransaction(null)
    setModalToReopen(null)
    setExpandedRealSubCategoryId(null)
    setRealSubCategoryToReopenId(null)
    setSubCategoryTransactionSequence([])
    setPendingTransaction(null)
  }

  function handleBackToList() {
    setSelectedTransaction(null)
    if (modalToReopen) {
      const next = modalToReopen
      const nextExpandedSubCategoryId = realSubCategoryToReopenId
      setModalToReopen(null)
      window.setTimeout(() => {
        setModalTarget(next)
        if (next.clickedFrom === 'real' && nextExpandedSubCategoryId) {
          setExpandedRealSubCategoryId(nextExpandedSubCategoryId)
        }
      }, 120)
    }
  }

  // ── delta ─────────────────────────────────────────────────────────────────

  const deltaPct =
    selectedEntry && selectedEntry.budgetAmount > 0
      ? ((selectedEntry.realAmount - selectedEntry.budgetAmount) / selectedEntry.budgetAmount) * 100
      : null

  // ── toggle button style helper ────────────────────────────────────────────

  function toggleBtnStyle(active: boolean): React.CSSProperties {
    return {
      border: active ? '2px solid var(--neutral-900)' : '1px solid var(--neutral-200)',
      background: active ? 'var(--primary-50)' : 'var(--neutral-0)',
      color: active ? 'var(--primary-700)' : 'var(--neutral-600)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-2) var(--space-4)',
      fontSize: 'var(--font-size-sm)',
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all var(--transition-base)',
      minHeight: 36,
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  const monthLabel = `${MONTHS_FR_FULL[month - 1]} ${String(year).slice(2)}`
  const selectedRealAmountLabel = selectedEntry
    ? formatCurrencyFloored(selectedEntry.realAmount).replace(/\s+€/g, '€')
    : ''
  const selectedBudgetAmountLabel = selectedEntry
    ? formatCurrencyFloored(selectedEntry.budgetAmount).replace(/\s+€/g, '€')
    : ''
  const minYear = YEAR_OPTIONS[0]
  const maxYear = YEAR_OPTIONS[YEAR_OPTIONS.length - 1]
  const canGoToPreviousMonth = year > minYear || (year === minYear && month > 1)
  const canGoToNextMonth = year < maxYear || (year === maxYear && month < 12)

  const navigateMonth = (delta: -1 | 1) => {
    const nextDate = new Date(year, month - 1 + delta, 1)
    const rawYear = nextDate.getFullYear()
    const rawMonth = nextDate.getMonth() + 1

    const clampedYear = Math.max(minYear, Math.min(maxYear, rawYear))
    const clampedMonth = clampedYear === minYear && rawYear < minYear
      ? 1
      : clampedYear === maxYear && rawYear > maxYear
        ? 12
        : rawMonth

    if (clampedYear === year && clampedMonth === month) return

    setYear(clampedYear)
    setMonth(clampedMonth)
    setModalPickerYear(clampedYear)
    setSelectedEntry(null)
  }

  return (
    <div>
      {/* ── month picker modal ── */}
      <AnimatePresence>
        {showMonthModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMonthModal(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,13,31,0.45)' }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Sélectionner un mois"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: 'var(--page-gutter)',
                right: 'var(--page-gutter)',
                top: '25vh',
                zIndex: 61,
                maxWidth: 320,
                margin: '0 auto',
                background: 'var(--neutral-0)',
                borderRadius: 'var(--radius-2xl)',
                padding: 'var(--space-4)',
                boxShadow: '0 8px 40px rgba(13,13,31,0.18)',
              }}
            >
              {/* year row */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                {YEAR_OPTIONS.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setModalPickerYear(y)}
                    style={{
                      flex: 1,
                      padding: '8px var(--space-3)',
                      border: modalPickerYear === y ? '2px solid var(--primary-600)' : '1px solid var(--neutral-200)',
                      borderRadius: 'var(--radius-md)',
                      background: modalPickerYear === y ? 'color-mix(in oklab, var(--primary-600) 10%, var(--neutral-0) 90%)' : 'var(--neutral-50)',
                      color: modalPickerYear === y ? 'var(--primary-600)' : 'var(--neutral-700)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all var(--transition-base)',
                    }}
                  >
                    {y}
                  </button>
                ))}
              </div>

              {/* month grid: 4 × 3 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {MONTHS_FR_SHORT.map((label, idx) => {
                  const m = idx + 1
                  const disabled = isMonthDisabled(modalPickerYear, m)
                  const isSelected = modalPickerYear === year && m === month
                  const isFuture = isFutureMonth(modalPickerYear, m)
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setYear(modalPickerYear)
                        setMonth(m)
                        setShowMonthModal(false)
                        setSelectedEntry(null)
                      }}
                      style={{
                        padding: '7px 4px',
                        border: isSelected
                          ? '2px solid var(--primary-600)'
                          : isFuture
                            ? '1px dashed var(--neutral-300)'
                            : '1px solid var(--neutral-200)',
                        borderRadius: 'var(--radius-sm)',
                        background: isSelected
                          ? 'color-mix(in oklab, var(--primary-600) 12%, var(--neutral-0) 88%)'
                          : isFuture
                            ? 'var(--neutral-0)'
                            : 'var(--neutral-150, #e8e8ee)',
                        color: isSelected ? 'var(--primary-600)' : isFuture ? 'var(--neutral-500)' : 'var(--neutral-800)',
                        fontSize: 11,
                        fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all var(--transition-base)',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── title + toggle ── */}
      <div style={{ padding: '0 var(--page-gutter)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', marginTop: 0, marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            type="button"
            onClick={() => navigateMonth(-1)}
            disabled={!canGoToPreviousMonth}
            aria-label="Mois précédent"
            style={{
              border: 'none',
              background: 'transparent',
              width: 24,
              height: 24,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: canGoToPreviousMonth ? 'pointer' : 'not-allowed',
              opacity: canGoToPreviousMonth ? 1 : 0.5,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 0,
                height: 0,
                borderTop: '5px solid transparent',
                borderBottom: '5px solid transparent',
                borderRight: '7px solid var(--neutral-600)',
                marginLeft: -1,
              }}
            />
          </button>

          <button
            type="button"
            onClick={() => { setModalPickerYear(year); setShowMonthModal(true) }}
            aria-label="Choisir une période"
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              textAlign: 'center',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
              color: 'var(--neutral-700)',
              letterSpacing: '0.01em',
            }}
          >
            {monthLabel}
            {isFutureMonth(year, month) && (
              <span style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: 'var(--neutral-400)',
                background: 'var(--neutral-100)',
                border: '1px dashed var(--neutral-300)',
                borderRadius: 'var(--radius-sm)',
                padding: '1px 5px',
                textTransform: 'uppercase',
                lineHeight: 1.4,
                marginLeft: 2,
              }}>
                Prévu
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigateMonth(1)}
            disabled={!canGoToNextMonth}
            aria-label="Mois suivant"
            style={{
              border: 'none',
              background: 'transparent',
              width: 24,
              height: 24,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: canGoToNextMonth ? 'pointer' : 'not-allowed',
              opacity: canGoToNextMonth ? 1 : 0.5,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 0,
                height: 0,
                borderTop: '5px solid transparent',
                borderBottom: '5px solid transparent',
                borderLeft: '7px solid var(--neutral-600)',
                marginRight: -1,
              }}
            />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', background: 'var(--neutral-100)', borderRadius: 'var(--radius-md)', padding: '3px', width: 224 }}>
          <button type="button" onClick={() => setViewModeAndNotify('categories')} style={{ ...toggleBtnStyle(viewMode === 'categories'), textAlign: 'center' }}>
            Catégories
          </button>
          <button type="button" onClick={() => setViewModeAndNotify('socles')} style={{ ...toggleBtnStyle(viewMode === 'socles'), textAlign: 'center' }}>
            Socles
          </button>
        </div>
      </div>

      {/* ── dual donut ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, marginTop: 'var(--space-5)' }}>
        {/* LEFT: Réel */}
        <div>
          <p style={{ margin: '0 0 var(--space-1)', textAlign: 'center', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Réel
          </p>
          <MiniDonut
            data={realPieData}
            total={realTotal}
            selectedId={selectedEntry?.id ?? null}
            centerLabel="consommé"
            onCenterClick={openForecastModal}
            centerActionLabel={`Voir le réalisé avec fixes planifiées pour ${selectedEntry?.name ?? (viewMode === 'categories' ? 'toutes les enveloppes' : 'tous les socles')}`}
            onSliceClick={(id, name, value, color) => {
              const budgetEntry = budgetPieData.find((d) => d.id === id)
              handleDonutClick(id, name, value, budgetEntry?.value ?? 0, color, 'real')
            }}
          />
        </div>

        {/* RIGHT: Budget */}
        <div>
          <p style={{ margin: '0 0 var(--space-1)', textAlign: 'center', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Budget
          </p>
          <MiniDonut
            data={budgetPieData}
            total={budgetTotal}
            selectedId={selectedEntry?.id ?? null}
            centerLabel="budgétisés"
            onCenterClick={openForecastModal}
            centerActionLabel={`Voir le réalisé avec fixes planifiées pour ${selectedEntry?.name ?? (viewMode === 'categories' ? 'toutes les enveloppes' : 'tous les socles')}`}
            onSliceClick={(id, name, value, color) => {
              const realEntry = realPieData.find((d) => d.id === id)
              handleDonutClick(id, name, realEntry?.value ?? 0, value, color, 'budget')
            }}
          />
        </div>
      </div>

      {/* ── info + delta ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: 'var(--space-3) var(--page-gutter) var(--space-2)',
          minHeight: 60,
          gap: 6,
        }}
      >
        {/* Réel info */}
        <div style={{ textAlign: 'center', transform: 'translateY(3px)' }}>
          {selectedEntry ? (
            <>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--neutral-800)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedEntry.name}
              </p>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)', lineHeight: 1.35 }}>
                {selectedRealAmountLabel}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-300)', fontStyle: 'italic' }}>
              Clique une ligne de liste
            </p>
          )}
        </div>

        {/* Delta */}
        <div style={{ textAlign: 'center', minWidth: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateY(3px)' }}>
          {selectedEntry && deltaPct !== null ? (
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: deltaPct > 0 ? '#9F2D2D' : '#1F6E4A',
                background: deltaPct > 0 ? 'color-mix(in oklab, #9F2D2D 16%, #FFFFFF 84%)' : 'color-mix(in oklab, #1F6E4A 16%, #FFFFFF 84%)',
                border: '1px solid color-mix(in oklab, var(--neutral-900) 58%, transparent)',
                borderRadius: 'var(--radius-sm)',
                padding: '3px 8px',
                whiteSpace: 'nowrap',
              }}
            >
              {formatPercentSigned(deltaPct)}
            </span>
          ) : null}
        </div>

        {/* Budget info */}
        <div style={{ textAlign: 'center', transform: 'translateY(3px)' }}>
          {selectedEntry ? (
            <>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--neutral-800)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedEntry.name}
              </p>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--neutral-700)', lineHeight: 1.35 }}>
                {selectedBudgetAmountLabel}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-300)', fontStyle: 'italic' }}>
              Clique une ligne de liste
            </p>
          )}
        </div>
      </div>

      {/* ── category lists ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid var(--neutral-100)', marginTop: 'var(--space-4)' }}>
        {/* Left: Réel list */}
        <div style={{ borderRight: '1px solid var(--neutral-100)' }}>
          {top5.map((entry) => {
            const pct = realTotal > 0 ? Math.round((entry.value / realTotal) * 100) : 0
            const isActive = selectedEntry?.id === entry.id
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => handleListRowClick(entry)}
                style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: '18px minmax(0,1fr) auto',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-3)',
                  border: 'none',
                  borderBottom: '1px solid var(--neutral-100)',
                  background: isActive ? 'color-mix(in oklab, var(--primary-50) 80%, transparent)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background var(--transition-fast)',
                }}
              >
                <div style={{ width: 14, height: 14, borderRadius: 'var(--radius-full)', background: entry.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: isActive ? 800 : 600, color: isActive ? 'var(--neutral-900)' : 'var(--neutral-700)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.name}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: isActive ? 'var(--neutral-900)' : 'var(--neutral-500)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {pct}%
                </span>
              </button>
            )
          })}
        </div>

        {/* Right: Budget list */}
        <div>
          {top5.map((entry) => {
            const budgetEntry = budgetPieData.find((d) => d.id === entry.id)
            const pct = budgetTotal > 0 && budgetEntry ? Math.round((budgetEntry.value / budgetTotal) * 100) : 0
            const isActive = selectedEntry?.id === entry.id
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => handleListRowClick(entry)}
                style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: '18px minmax(0,1fr) auto',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-3)',
                  border: 'none',
                  borderBottom: '1px solid var(--neutral-100)',
                  background: isActive ? 'color-mix(in oklab, var(--primary-50) 80%, transparent)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background var(--transition-fast)',
                }}
              >
                <div style={{ width: 14, height: 14, borderRadius: 'var(--radius-full)', background: entry.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: isActive ? 800 : 600, color: isActive ? 'var(--neutral-900)' : 'var(--neutral-700)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.name}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: isActive ? 'var(--neutral-900)' : 'var(--neutral-500)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {pct}%
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── details section ── */}
      {viewMode === 'categories' ? (
        <CategoryDetailsSection
          rows={parentCategoryRowsWithoutSavings}
          categoryById={categoryById}
          onCategoryClick={onCategoryClick}
          sectionRef={categoryListSectionRef}
          onShowAllEnvelopes={() => setShowAllEnvelopes(true)}
        />
      ) : (
        <section ref={soclesListSectionRef} style={{ padding: 'var(--space-8) var(--page-gutter) var(--space-8)' }}>
          <h3 style={{ margin: '0 0 var(--space-5) 0', fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--neutral-900)', letterSpacing: '-0.01em' }}>
            Répartition par blocs
          </h3>
          <div style={{ display: 'grid', gap: 'var(--space-8)' }}>
            {socleListRows.map((row) => {
              const consumptionRatio = row.budgetAmount > 0 ? row.actualAmount / row.budgetAmount : 0
              const progressPct = Math.min(100, Math.round(consumptionRatio * 100))
              const variance = row.budgetAmount - row.actualAmount
              const isOverBudget = variance < 0
              const isSavingsBlock = row.id === 'epargne'
              const isSavingsPositive = isSavingsBlock && row.actualAmount > 0
              const savingsRemainderColor = 'color-mix(in oklab, var(--color-warning) 72%, var(--neutral-900) 28%)'
              const leftMetricLabel = isSavingsBlock ? 'Épargné' : 'Consommé'
              const leftMetricColor = isSavingsPositive ? 'var(--color-success)' : 'var(--neutral-700)'
              const leftMetricPctColor = isSavingsPositive ? 'var(--color-success)' : 'var(--neutral-500)'
              const rightMetricColor = isSavingsBlock
                ? (variance !== 0 ? savingsRemainderColor : 'var(--neutral-500)')
                : (isOverBudget ? 'var(--color-error)' : 'var(--color-success)')
              const rightMetricText = isSavingsBlock
                ? `Reste ${formatCurrencyFloored(variance)}`
                : (isOverBudget ? `Dépass. ${formatCurrencyFloored(Math.abs(variance))}` : `Reste ${formatCurrencyFloored(variance)}`)
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    onBlockClick?.(row.id)
                  }}
                  style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 'var(--space-5)', minWidth: 0, width: '100%', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                    <span aria-hidden="true" style={{ width: 56, height: 56, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src={row.iconSrc}
                        alt={`Icône bloc ${row.label}`}
                        width={42}
                        height={42}
                        loading="lazy"
                        decoding="async"
                        style={{ display: 'block', objectFit: 'contain' }}
                      />
                    </span>
                  </div>

                  <div style={{ display: 'grid', gap: 'var(--space-2)', minWidth: 0 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--space-4)', alignItems: 'center' }}>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', fontWeight: 'var(--font-weight-bold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {`Socle ${row.label.toLowerCase()}`}
                      </p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                        {formatCurrencyFloored(row.budgetAmount)}
                      </p>
                    </div>

                    <div style={{ width: '100%', height: 'var(--space-2)', borderRadius: 'var(--radius-pill)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${progressPct}%`,
                          height: '100%',
                          borderRadius: 'var(--radius-pill)',
                          background: SOCLE_LIST_PROGRESS_COLORS[row.id] ?? row.color,
                          transition: 'width var(--transition-base)',
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--space-4)', alignItems: 'center' }}>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: leftMetricColor, fontFamily: 'var(--font-mono)', fontWeight: isSavingsPositive ? 700 : 400 }}>
                        {leftMetricLabel} {formatCurrencyFloored(row.actualAmount).replace(/\s+€/, '€')} <span style={{ color: leftMetricPctColor }}>({progressPct}%)</span>
                      </p>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: rightMetricColor, fontFamily: 'var(--font-mono)', fontWeight: 700, flexShrink: 0 }}>
                        {rightMetricText}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => {
                onRevenueClick?.()
              }}
              style={{
                marginTop: 'var(--space-3)',
                paddingTop: 'var(--space-6)',
                borderTop: '1px solid var(--neutral-300)',
                display: 'grid',
                gridTemplateColumns: '56px 1fr',
                gap: 'var(--space-5)',
                minWidth: 0,
                width: '100%',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                paddingLeft: 0,
                paddingRight: 0,
                paddingBottom: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                <span aria-hidden="true" style={{ width: 56, height: 56, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={blockRevenusIcon}
                    alt="Icône bloc Revenus"
                    width={42}
                    height={42}
                    loading="lazy"
                    decoding="async"
                    style={{ display: 'block', objectFit: 'contain' }}
                  />
                </span>
              </div>
              <div style={{ display: 'grid', gap: 'var(--space-2)', minWidth: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--space-4)', alignItems: 'center' }}>
                  <p style={{ margin: 0, minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--neutral-800)', fontWeight: 'var(--font-weight-bold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Socle revenus</span>
                    <span style={{ fontSize: 10, color: 'var(--neutral-500)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Hors enveloppe dépenses
                    </span>
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                    {formatCurrencyFloored(selectedMonthRevenueAmount)}
                  </p>
                </div>

                <div style={{ width: '100%', height: 'var(--space-2)', borderRadius: 'var(--radius-pill)', background: 'var(--neutral-150)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${revenueProgressPct}%`,
                      height: '100%',
                      borderRadius: 'var(--radius-pill)',
                      background: isRevenueAboveTarget ? 'var(--color-success)' : 'var(--primary-500)',
                      transition: 'width var(--transition-base)',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--space-4)', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--neutral-700)', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrencyFloored(selectedMonthRevenueAmount).replace(/\s+€/, '€')} <span style={{ color: 'var(--neutral-500)' }}>({revenueProgressPct}%)</span>
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 'var(--font-size-xs)',
                      color: isRevenueAboveTarget ? 'var(--color-success)' : 'var(--neutral-500)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: isRevenueAboveTarget ? 700 : 400,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isRevenueAboveTarget
                      ? `Dépassement +${Math.round(revenueSurplusPct ?? 0)}%`
                      : `Cible ${formatCurrencyFloored(monthlyCommitmentsTarget)}`}
                  </p>
                </div>
              </div>
            </button>
            <div aria-hidden="true" style={{ height: '22dvh', minHeight: 120 }} />
          </div>
        </section>
      )}

      {/* ── modals ── */}
      <AllEnvelopesModal
        open={showAllEnvelopes}
        onClose={() => setShowAllEnvelopes(false)}
        displayMonthLabel={monthLabel}
        parentCategoryRows={parentCategoryRowsWithoutSavings}
        subCategoryRows={payloadByCategory}
        categoryById={categoryById}
        tripsForMonth={tripsForMonth}
        onTripClick={(tripId) => {
          void tripId
          setShowAllEnvelopes(false)
          if (voyagesRootCategoryId) {
            onCategoryClick?.(voyagesRootCategoryId)
          }
        }}
      />

      <SubModal
        open={Boolean(modalTarget)}
        onClose={() => {
          setModalTarget(null)
          setExpandedRealSubCategoryId(null)
          setRealSubCategoryToReopenId(null)
        }}
        onSwitchMode={handleToggleModalMode}
        name={modalTarget?.name ?? ''}
        iconKey={modalTarget?.iconKey ?? null}
        iconSrc={modalTarget?.iconSrc ?? null}
        color={modalTarget?.color ?? 'var(--primary-500)'}
        consumedAmount={modalTarget?.amount ?? 0}
        budgetAmount={modalTarget?.budgetAmount ?? 0}
        clickedFrom={modalTarget?.clickedFrom ?? 'real'}
        headerMetricLabel={modalTarget?.headerMetricLabel ?? 'Consommé'}
        headerMetricAmount={modalTarget?.headerMetricAmount ?? 0}
        transactions={modalTransactions}
        loading={loadingModalTx}
        onSelectTransaction={handleSelectTransaction}
        categoryById={categoryById}
        subCategoryBudgets={subCategoryBudgets}
        subCategoryReals={modalTarget?.clickedFrom === 'real' ? subCategoryReals : undefined}
        subCategoryBudgetById={subCategoryBudgetById}
        expandedRealSubCategoryId={expandedRealSubCategoryId}
        onToggleRealSubCategory={(subCategoryId) => {
          setExpandedRealSubCategoryId((current) => (current === subCategoryId ? null : subCategoryId))
        }}
      />

      <TransactionDetailsModal
        transaction={selectedTransaction}
        categories={categories}
        transactionList={subCategoryTransactionSequence}
        onNavigate={setSelectedTransaction}
        onBack={handleBackToList}
        onClose={handleCloseTransaction}
        showReturnListButton={modalToReopen?.clickedFrom === 'real'}
      />

      <BudgetEnvelopeForecastModal
        forecast={forecastModalEnvelope}
        onClose={() => setForecastModalEnvelope(null)}
      />
    </div>
  )
}
