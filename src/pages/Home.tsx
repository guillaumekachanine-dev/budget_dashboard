import { useRef, useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useBudgetSummaries } from '@/hooks/useBudgets'
import { accountTypeLabel, getCurrentPeriod, getMonthLabel } from '@/lib/utils'
import { HeroCard } from '@/components/ui/HeroCard'
import { AccountSlideCard } from '@/components/ui/AccountSlideCard'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
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
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

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

  const preferredDefaultAccount = useMemo(() => {
    if (!accounts?.length) return null
    return (
      accounts.find((a) => a.name === 'Compte courant principal') ??
      accounts.find((a) => a.account_type === 'checking' && a.name.toLowerCase().includes('principal')) ??
      accounts.find((a) => a.account_type === 'checking') ??
      accounts[0]
    )
  }, [accounts])

  useEffect(() => {
    if (!accounts?.length) {
      setSelectedAccountId(null)
      return
    }
    const selectedStillExists = selectedAccountId && accounts.some((a) => a.id === selectedAccountId)
    if (selectedStillExists) return
    setSelectedAccountId(preferredDefaultAccount?.id ?? accounts[0].id)
  }, [accounts, preferredDefaultAccount, selectedAccountId])

  const selectedAccount = useMemo(() => {
    if (!accounts?.length) return null
    return accounts.find((a) => a.id === selectedAccountId) ?? preferredDefaultAccount ?? accounts[0]
  }, [accounts, preferredDefaultAccount, selectedAccountId])

  const carouselCards = useMemo(
    () => accountSlides.filter((card) => card.id !== selectedAccount?.id),
    [accountSlides, selectedAccount?.id],
  )

  useEffect(() => {
    setActiveCardIndex((prev) => {
      const max = Math.max(0, carouselCards.length - 1)
      return Math.min(prev, max)
    })
  }, [carouselCards.length])

  const scrollCarousel = (dir: 'left' | 'right') => {
    if (!carouselRef.current) return
    carouselRef.current.scrollBy({ left: dir === 'right' ? CAROUSEL_STEP : -CAROUSEL_STEP, behavior: 'smooth' })
  }

  const handleCarouselScroll = () => {
    if (!carouselRef.current) return
    const index = Math.round(carouselRef.current.scrollLeft / CAROUSEL_STEP)
    const clamped = Math.max(0, Math.min(index, carouselCards.length - 1))
    setActiveCardIndex(clamped)
  }

  const handleSelectAccount = (accountId: string) => {
    if (!carouselRef.current || accountId === selectedAccount?.id) return
    setSelectedAccountId(accountId)
    carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' })
    setActiveCardIndex(0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 0px))' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ padding: '18px 16px 0' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <button
            type="button"
            aria-label="Menu"
            style={{
              width: 32,
              height: 32,
              border: 'none',
              background: 'transparent',
              color: 'var(--neutral-900)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <Menu size={18} />
          </button>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--neutral-900)', margin: 0 }}>Home</h1>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--primary-100)',
            color: 'var(--primary-700)',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            GU
          </div>
        </div>
        <p style={{
          textAlign: 'center',
          fontSize: 10,
          color: 'var(--neutral-400)',
          marginBottom: 2,
        }}>
          {getMonthLabel(year, month)}
        </p>
        <p style={{
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 38,
          fontWeight: 700,
          color: 'var(--neutral-900)',
          margin: 0,
          lineHeight: 1.1,
        }}>
          {selectedAccount ? `${Math.round(selectedAccount.current_balance)}€` : '—'}
        </p>
      </motion.div>

      {/* ── Mes comptes ────────────────────────────────────────── */}
      <section style={{ marginTop: 18 }}>
        {/* Section header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', marginBottom: 10,
        }}>
          <h2 style={{
            fontSize: 11, fontWeight: 600, color: 'var(--neutral-400)',
            textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0,
          }}>
            Mes comptes
          </h2>
          {/* Scroll arrows — desktop/tablet hint */}
          {carouselCards.length > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => scrollCarousel('left')}
                style={{
                  width: 26, height: 26, borderRadius: '50%',
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
                  width: 26, height: 26, borderRadius: '50%',
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
          <div style={{ display: 'flex', gap: 10, padding: '0 16px', overflowX: 'hidden' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse" style={{
                width: 164, minWidth: 164, height: 122,
                borderRadius: 'var(--radius-card)', background: 'var(--neutral-100)',
                flexShrink: 0,
              }} />
            ))}
          </div>
        ) : carouselCards.length === 0 ? (
          <div style={{
            margin: '0 16px',
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
              padding: '4px 16px 12px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              scrollSnapType: 'x mandatory',
            }}
            onScroll={handleCarouselScroll}
            className="scrollbar-hide"
          >
            {carouselCards.map((card, i) => (
              <div key={card.id} style={{ scrollSnapAlign: 'start' }}>
                <AccountSlideCard
                  card={card}
                  index={i}
                  onSelect={() => handleSelectAccount(card.id)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Dots indicator */}
        {carouselCards.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 6 }}>
            {carouselCards.map((card, i) => (
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
      <section style={{ padding: '18px 16px 0' }}>
        <h2 style={{
          fontSize: 11, fontWeight: 600, color: 'var(--neutral-400)',
          textTransform: 'uppercase', letterSpacing: '1.5px',
          margin: '0 0 12px',
        }}>
          {selectedAccount?.name ?? 'Compte sélectionné'}
        </h2>

        {loadingSummaries || !selectedAccount ? (
          <div className="animate-pulse" style={{ height: 130, borderRadius: 24, background: 'var(--neutral-100)' }} />
        ) : (
          <HeroCard
            account={selectedAccount}
            totalSpent={totalSpent}
            totalBudget={totalBudget}
          />
        )}
      </section>

      {/* ── Top catégories (mini) ───────────────────────────────── */}
      {!loadingSummaries && (summaries?.length ?? 0) > 0 && (
        <section style={{ padding: '18px 16px 0' }}>
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
                  borderRadius: 'var(--radius-card)',
                  boxShadow: 'var(--shadow-card)',
                  padding: '12px 10px',
                  minWidth: 96,
                  flexShrink: 0,
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}
              >
                <CategoryIcon categoryName={s.category.name} size={20} />
                <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--neutral-600)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 88 }}>
                  {s.category.name}
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--neutral-900)', margin: 0 }}>
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
