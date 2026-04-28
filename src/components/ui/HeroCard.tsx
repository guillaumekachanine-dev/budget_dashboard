import { motion } from 'framer-motion'
import { formatCurrency, getDaysRemainingInMonth, clamp } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import type { AccountWithBalance } from '@/lib/types'

interface HeroCardProps {
  account: AccountWithBalance
  totalSpent: number
  totalBudget: number
}

export function HeroCard({ account, totalSpent, totalBudget }: HeroCardProps) {
  const navigate = useNavigate()
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const remaining = totalBudget - totalSpent
  const percentage = totalBudget > 0 ? clamp((totalSpent / totalBudget) * 100, 0, 100) : 0
  const daysLeft = getDaysRemainingInMonth()
  const totalDailyTarget = daysInMonth > 0 ? totalBudget / daysInMonth : 0
  const variableDailyTarget = daysLeft > 0 ? remaining / daysLeft : remaining
  const variableColor = variableDailyTarget < 0 ? 'var(--color-negative)' : 'rgba(255,255,255,0.95)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
      className="budget-hero"
      style={{ padding: '18px 18px 14px' }}
    >
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{
            fontSize: 10,
            opacity: 0.65,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 500,
          }}>
            Solde restant · {account.name}
          </div>
          <button
            onClick={() => navigate('/flux')}
            style={{
              borderRadius: 'var(--radius-pill)',
              background: 'transparent',
              color: '#fff',
              border: '1.5px solid rgba(255,255,255,0.68)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.03em',
              padding: '5px 14px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Détails
          </button>
        </div>

        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(28px, 8vw, 34px)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          margin: '6px 0 8px',
          color: '#fff',
        }}>
          {formatCurrency(remaining)}
        </div>

        <div style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.55)',
          marginBottom: 8,
          fontWeight: 500,
        }}>
          {daysLeft} jours restants dans le mois
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginBottom: 9,
        }}>
          <div style={{
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255,255,255,0.08)',
            padding: '8px 8px 7px',
          }}>
            <p style={{
              margin: 0,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'rgba(255,255,255,0.58)',
              fontWeight: 500,
            }}>
              Budget total / jour
            </p>
            <p style={{
              margin: '4px 0 0',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.98)',
              lineHeight: 1.1,
            }}>
              {formatCurrency(totalDailyTarget)}
            </p>
          </div>
          <div style={{
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255,255,255,0.08)',
            padding: '8px 8px 7px',
          }}>
            <p style={{
              margin: 0,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'rgba(255,255,255,0.58)',
              fontWeight: 500,
            }}>
              Variable / jour
            </p>
            <p style={{
              margin: '4px 0 0',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 700,
              color: variableColor,
              lineHeight: 1.1,
            }}>
              {`${variableDailyTarget < 0 ? '−' : ''}${formatCurrency(Math.abs(variableDailyTarget))}`}
            </p>
          </div>
        </div>

        <div className="bh-progress">
          <motion.div
            className="bh-progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ delay: 0.4, duration: 0.7, ease: 'easeOut' }}
          />
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 10,
          fontWeight: 500,
          opacity: 0.72,
          marginTop: 6,
        }}>
          <span>{formatCurrency(totalSpent)} dépensés</span>
          <span>sur {formatCurrency(totalBudget)}</span>
        </div>
      </div>
    </motion.div>
  )
}
