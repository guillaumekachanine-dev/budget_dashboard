import { useRef, useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAccounts, useCheckingAccount } from '@/hooks/useAccounts'
import { useBudgetSummaries } from '@/hooks/useBudgets'
import { accountTypeLabel, getCurrentPeriod, getMonthLabel } from '@/lib/utils'
import { HeroCard } from '@/components/ui/HeroCard'
import { AccountSlideCard } from '@/components/ui/AccountSlideCard'
import type { SlideCardData } from '@/components/ui/AccountSlideCard'
import type { AccountWithBalance } from '@/lib/types'

const CAROUSEL_STEP = 188

const ACCOUNT_GRADIENTS: Record<string, [string, string]> = {
  checking: ['var(--primary-500)', 'var(--primary-700)'],
  savings: ['var(--color-positive)', 'var(--cat-bills)'],
  credit_card: ['var(--color-negative)', 'var(--cat-transport)'],
  cash: ['var(--color-warning)', 'var(--cat-food)'],
  other: ['var(--neutral-500)', 'var(--neutral-700)'],
}

function getAccountGradient(type: AccountWithBalance['account_type']): [string, string] {
  return ACCOUNT_GRADIENTS[type] ?? ACCOUNT_GRADIENTS.other
}

export function Home() {
  const { year, month } = getCurrentPeriod()
  const { data: accounts, isLoading: loadingAccounts } = useAccounts()
  const { data: summaries, isLoading: loadingSummaries } = useBudgetSummaries(year, month)
  const checking = useCheckingAccount(accounts)

  const totalBudget = summaries?.reduce((s, b) => s + b.budget_amount, 0) ?? 0
  const totalSpent  = summaries?.reduce((s, b) => s + b.spent_amount, 0) ?? 0

  const carouselRef = useRef<HTMLDivElement>(null)
  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const accountSlides = useMemo<SlideCardData[]>(() => {
    const list = accounts ?? []
    if (!list.length) return []

    const positiveTotal = list.reduce((sum, account) => sum + Math.max(0, account.current_balance), 0)
    const fallbackTotal = list.reduce((sum, account) => sum + Math.abs(account.current_balance), 0)
    const referenceAmount = positiveTotal > 0 ? positiveTotal : fallbackTotal

    return list.map((account) => {
      const weight = positiveTotal > 0
        ? Math.max(0, account.current_balance)
        : Math.abs(account.current_balance)

      return {
        id: account.id,
        title: account.name,
        subtitle: accountTypeLabel(account.account_type),
        amount: account.current_balance,
        progress: referenceAmount > 0 ? (weight / referenceAmount) * 100 : 0,
        referenceAmount,
        gradient: getAccountGradient(account.account_type),
      }
    })
  }, [accounts])

  useEffect(() => {
    setActiveCardIndex((prev) => {
      const max = Math.max(0, accountSlides.length - 1)
      return Math.min(prev, max)
    })
  }, [accountSlides.length])

  const scrollCarousel = (dir: 'left' | 'right') => {
    if (!carouselRef.current) return
    carouselRef.current.scrollBy({ left: dir === 'right' ? CAROUSEL_STEP : -CAROUSEL_STEP, behavior: 'smooth' })
  }

  const handleCarouselScroll = () => {
    if (!carouselRef.current) return
    const index = Math.round(carouselRef.current.scrollLeft / CAROUSEL_STEP)
    const clamped = Math.max(0, Math.min(index, accountSlides.length - 1))
    setActiveCardIndex(clamped)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ padding: '28px 20px 0' }}
      >
        <p style={{
          fontSize: 11, fontWeight: 500, color: 'var(--neutral-400)',
          textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 4,
        }}>
          {getMonthLabel(year, month)}
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--neutral-900)', letterSpacing: '-0.4px', margin: 0 }}>
          Accueil
        </h1>
        <motion.p
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12, duration: 0.35 }}
          style={{
            fontSize: 32, fontWeight: 700, color: 'var(--neutral-700)',
            marginTop: 8, letterSpacing: '-0.4px', lineHeight: 1.04,
          }}
        >
          Bonjour Guillaume
        </motion.p>
      </motion.div>

      {/* ── Mes comptes ────────────────────────────────────────── */}
      <section style={{ marginTop: 36 }}>
        {/* Section header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', marginBottom: 14,
        }}>
          <h2 style={{
            fontSize: 11, fontWeight: 600, color: 'var(--neutral-400)',
            textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0,
          }}>
            Mes comptes
          </h2>
          {/* Scroll arrows — desktop/tablet hint */}
          {accountSlides.length > 1 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => scrollCarousel('left')}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--neutral-100)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--neutral-500)',
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => scrollCarousel('right')}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--neutral-100)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--neutral-500)',
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Carousel */}
        {loadingAccounts ? (
          <div style={{ display: 'flex', gap: 12, padding: '0 20px', overflowX: 'hidden' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse" style={{
                width: 176, minWidth: 176, height: 136,
                borderRadius: 'var(--radius-2xl)', background: 'var(--neutral-100)',
                flexShrink: 0,
              }} />
            ))}
          </div>
        ) : accountSlides.length === 0 ? (
          <div style={{
            margin: '0 20px',
            borderRadius: 'var(--radius-xl)',
            border: '1px dashed var(--neutral-200)',
            padding: '18px 14px',
            textAlign: 'center',
          }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--neutral-500)' }}>Aucun compte affichable.</p>
          </div>
        ) : (
          <div
            ref={carouselRef}
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              padding: '4px 20px 12px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              scrollSnapType: 'x mandatory',
            }}
            onScroll={handleCarouselScroll}
            className="scrollbar-hide"
          >
            {accountSlides.map((card, i) => (
              <div key={card.id} style={{ scrollSnapAlign: 'start' }}>
                <AccountSlideCard card={card} index={i} />
              </div>
            ))}
          </div>
        )}

        {/* Dots indicator */}
        {accountSlides.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 6 }}>
            {accountSlides.map((card, i) => (
              <div
                key={card.id}
                style={{
                  width: i === activeCardIndex ? 16 : 5,
                  height: 5,
                  borderRadius: 9999,
                  background: i === activeCardIndex ? 'var(--primary-500)' : 'var(--neutral-200)',
                  transition: 'all 0.3s',
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Budget héro ────────────────────────────────────────── */}
      <section style={{ padding: '24px 20px 0' }}>
        <h2 style={{
          fontSize: 11, fontWeight: 600, color: 'var(--neutral-400)',
          textTransform: 'uppercase', letterSpacing: '1.5px',
          margin: '0 0 12px',
        }}>
          Compte courant
        </h2>

        {loadingSummaries || !checking ? (
          <div className="animate-pulse" style={{ height: 130, borderRadius: 24, background: 'var(--neutral-100)' }} />
        ) : (
          <HeroCard
            account={checking}
            totalSpent={totalSpent}
            totalBudget={totalBudget}
          />
        )}
      </section>

      {/* ── Top catégories (mini) ───────────────────────────────── */}
      {!loadingSummaries && (summaries?.length ?? 0) > 0 && (
        <section style={{ padding: '24px 20px 0' }}>
          <h2 style={{
            fontSize: 11, fontWeight: 600, color: 'var(--neutral-400)',
            textTransform: 'uppercase', letterSpacing: '1.5px',
            margin: '0 0 12px',
          }}>
            Top dépenses ce mois
          </h2>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }} className="scrollbar-hide">
            {(summaries ?? []).slice(0, 5).map((s, i) => (
              <motion.div
                key={s.category.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * i, duration: 0.3 }}
                style={{
                  background: '#fff',
                  borderRadius: 20,
                  boxShadow: 'var(--shadow-card)',
                  padding: '14px 14px',
                  minWidth: 110,
                  flexShrink: 0,
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}
              >
                <span style={{ fontSize: 20 }}>{s.category.icon_name ?? '💰'}</span>
                <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--neutral-600)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>
                  {s.category.name}
                </p>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 700, color: 'var(--neutral-900)', margin: 0 }}>
                  {s.spent_amount.toFixed(0)}€
                </p>
                <div style={{ height: 3, background: 'var(--neutral-100)', borderRadius: 9999, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 9999,
                    background: 'var(--primary-400)',
                    width: `${Math.min(s.percentage, 100)}%`,
                  }} />
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
