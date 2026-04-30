import { useState, type CSSProperties } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, FolderOpen, BarChart2, Activity, Plus } from 'lucide-react'
import { prefetchRoute, type RoutePath } from '@/lib/routePrefetch'

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
  const warmup = () => prefetchRoute(to as RoutePath)

  return (
    <NavLink
      to={to}
      end={end}
      style={{ textDecoration: 'none' }}
      onMouseEnter={warmup}
      onFocus={warmup}
      onTouchStart={warmup}
    >
      {({ isActive }) => {
        const iconColor = 'var(--neutral-0)'

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
              background: isActive
                ? 'color-mix(in oklab, var(--neutral-0) 22%, transparent)'
                : 'transparent',
              opacity: isActive ? 1 : 0.62,
              transition: 'all var(--transition-base)',
            }}
            >
            <span
              style={{
                display: 'inline-flex',
                color: iconColor,
                transform: isActive ? 'scale(1.06)' : 'scale(1)',
                transition: 'transform var(--transition-fast)',
              }}
            >
              <Icon size={isActive ? 21 : 20} strokeWidth={isActive ? 2.45 : 1.8} />
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 800 : 700,
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
  maxWidth: 'var(--page-max-width)',
  margin: '0 auto',
}

const navStyle: CSSProperties = {
  position: 'relative',
  minHeight: 'calc(var(--nav-base-height) + var(--safe-bottom-offset))',
  paddingBottom: 'var(--safe-bottom-offset)',
  background: 'linear-gradient(135deg, var(--primary-700) 0%, var(--primary-500) 100%)',
  borderTop: 'none',
  borderTopLeftRadius: 'var(--radius-md)',
  borderTopRightRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-lg)',
}

const navRowStyle: CSSProperties = {
  height: 'var(--nav-base-height)',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 72px 1fr 1fr',
  alignItems: 'center',
  justifyItems: 'center',
}

const fabBaseStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: 6,
  width: 56,
  height: 56,
  transform: 'translate(-50%, -44%)',
  borderRadius: 'var(--radius-full)',
  border: '1.5px solid color-mix(in oklab, var(--primary-500) 44%, var(--neutral-0))',
  background: 'var(--neutral-0)',
  color: 'var(--primary-600)',
  boxShadow: '0 0 0 3px color-mix(in oklab, var(--primary-300) 55%, transparent), var(--shadow-fab)',
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
        <div style={navRowStyle}>
          {LEFT_ITEMS.map(({ to, icon, label }, i) => (
            <NavItem key={to} to={to} icon={icon} label={label} end={i === 0} />
          ))}

          <div aria-hidden="true" />

          {RIGHT_ITEMS.map(({ to, icon, label }) => (
            <NavItem key={to} to={to} icon={icon} label={label} />
          ))}
        </div>
      </nav>

      <button
        onClick={onAddClick}
        aria-label="Ajouter une opération"
        onMouseEnter={() => setFabHovered(true)}
        onMouseLeave={() => setFabHovered(false)}
        style={{
          ...fabBaseStyle,
          transform: fabHovered ? 'translate(-50%, -44%) scale(1.05)' : 'translate(-50%, -44%) scale(1)',
        }}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
    </div>
  )
}
