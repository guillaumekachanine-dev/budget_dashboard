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
  const variableColor = variableDailyTarget < 0 ? 'var(--color-negative)' : 'rgba(255,255,255,0.98)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
      className="budget-hero"
      style={{ padding: '16px 16px 14px' }}
    >
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{
            fontSize: 12,
            opacity: 0.76,
            textTransform: 'uppercase',
            letterSpacing: '1.2px',
            fontWeight: 700,
          }}>
            Reste utile · {account.name}
          </div>
          <button
            onClick={() => navigate('/activite')}
            style={{
              border: 'none',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(255,255,255,0.95)',
              color: 'var(--primary-500)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.7px',
              padding: '9px 16px',
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
          fontSize: 'clamp(40px, 11vw, 52px)',
          fontWeight: 700,
          letterSpacing: '-1.4px',
          lineHeight: 1,
          margin: '6px 0 10px',
          color: '#fff',
        }}>
          {formatCurrency(remaining)}
        </div>

        <div style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.82)',
          marginBottom: 10,
          fontWeight: 500,
        }}>
          {daysLeft} jours restants dans le mois
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginBottom: 11,
        }}>
          <div style={{
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255,255,255,0.11)',
            padding: '9px 10px 8px',
          }}>
            <p style={{
              margin: 0,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.9px',
              color: 'rgba(255,255,255,0.62)',
              fontWeight: 600,
            }}>
              Budget total / jour
            </p>
            <p style={{
              margin: '4px 0 0',
              fontFamily: 'var(--font-mono)',
              fontSize: 16,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.98)',
              lineHeight: 1.1,
            }}>
              {formatCurrency(totalDailyTarget)}
            </p>
          </div>
          <div style={{
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255,255,255,0.11)',
            padding: '9px 10px 8px',
          }}>
            <p style={{
              margin: 0,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.9px',
              color: 'rgba(255,255,255,0.62)',
              fontWeight: 600,
            }}>
              Variable / jour
            </p>
            <p style={{
              margin: '4px 0 0',
              fontFamily: 'var(--font-mono)',
              fontSize: 16,
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
          fontSize: 12,
          fontWeight: 500,
          opacity: 0.84,
          marginTop: 8,
        }}>
          <span>{formatCurrency(totalSpent)} dépensés</span>
          <span>sur {formatCurrency(totalBudget)}</span>
        </div>
      </div>
    </motion.div>
  )
}
