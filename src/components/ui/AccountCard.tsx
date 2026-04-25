import { motion } from 'framer-motion'
import { accountTypeInitials, ACCOUNT_COLORS } from '@/lib/utils'
import type { AccountWithBalance } from '@/lib/types'

interface AccountCardProps {
  account: AccountWithBalance
  index: number
}

export function AccountCard({ account, index }: AccountCardProps) {
  const color = ACCOUNT_COLORS[account.account_type] ?? '#9898B3'
  const initials = accountTypeInitials(account.name)

  const value = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(account.current_balance)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.3, ease: 'easeOut' }}
      className="account-pill"
    >
      <div className="ap-avatar" style={{ backgroundColor: color }}>
        {initials}
      </div>
      <div className="ap-tag">{account.currency}</div>
      <div className="ap-value">{value}</div>
      <div className="ap-name">{account.name}</div>
    </motion.div>
  )
}
