import { useState, type CSSProperties } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, FolderOpen, BarChart2, Activity, Plus } from 'lucide-react'

interface BottomNavProps {
  onAddClick: () => void
}

const LEFT_ITEMS = [
  { to: '/', icon: Home, label: 'Accueil' },
  { to: '/flux', icon: Activity, label: 'Flux' },
]

const RIGHT_ITEMS = [
  { to: '/budgets', icon: FolderOpen, label: 'Budgets' },
  { to: '/stats', icon: BarChart2, label: 'Stats' },
]

type NavItemProps = {
  to: string
  icon: typeof Home
  label: string
  end?: boolean
}

function NavItem({ to, icon: Icon, label, end = false }: NavItemProps) {
  return (
    <NavLink to={to} end={end} style={{ textDecoration: 'none' }}>
      {({ isActive }) => {
        const iconColor = isActive ? 'var(--primary-500)' : 'var(--neutral-600)'

        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              minWidth: 64,
              padding: '8px 10px',
              borderRadius: 'var(--radius-full)',
              background: isActive ? 'var(--primary-50)' : 'transparent',
              transition: 'all var(--transition-base)',
            }}
          >
            <span style={{ display: 'inline-flex', color: iconColor }}>
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1,
                color: iconColor,
                maxWidth: 58,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {label}
            </span>
          </div>
        )
      }}
    </NavLink>
  )
}

const rootStyle: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 50,
  maxWidth: 390,
  margin: '0 auto',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
}

const navStyle: CSSProperties = {
  position: 'relative',
  height: 72,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 72px 1fr 1fr',
  alignItems: 'center',
  justifyItems: 'center',
  background: 'var(--neutral-0)',
  borderTop: '1px solid var(--neutral-200)',
  boxShadow: 'var(--shadow-lg)',
}

const fabBaseStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: 0,
  width: 56,
  height: 56,
  transform: 'translate(-50%, -50%)',
  borderRadius: 'var(--radius-full)',
  border: 'none',
  background: 'var(--primary-500)',
  color: '#fff',
  boxShadow: 'var(--shadow-fab)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'transform var(--transition-base)',
  zIndex: 51,
}

export function BottomNav({ onAddClick }: BottomNavProps) {
  const [fabHovered, setFabHovered] = useState(false)

  return (
    <div style={rootStyle}>
      <nav style={navStyle} aria-label="Navigation principale">
        {LEFT_ITEMS.map(({ to, icon, label }, i) => (
          <NavItem key={to} to={to} icon={icon} label={label} end={i === 0} />
        ))}

        <div aria-hidden="true" />

        {RIGHT_ITEMS.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label} />
        ))}
      </nav>

      <button
        onClick={onAddClick}
        aria-label="Ajouter une opération"
        onMouseEnter={() => setFabHovered(true)}
        onMouseLeave={() => setFabHovered(false)}
        style={{
          ...fabBaseStyle,
          transform: fabHovered ? 'translate(-50%, -50%) scale(1.05)' : 'translate(-50%, -50%) scale(1)',
        }}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
    </div>
  )
}
