import { useState, type CSSProperties } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, FolderOpen, BarChart2, Activity, Plus } from 'lucide-react'
import { prefetchRoute, type RoutePath } from '@/lib/routePrefetch'

interface BottomNavProps {
  onAddClick: () => void
  isAddMenuOpen?: boolean
}

const LEFT_ITEMS = [
  { to: '/', icon: Home, label: 'Accueil' },
  { to: '/flux', icon: Activity, label: 'Flux' },
]

const RIGHT_ITEMS = [
  { to: '/budgets', icon: FolderOpen, label: 'Budgets' },
  { to: '/epargne', icon: BarChart2, label: 'Épargne' },
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
      {({ isActive }) => (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            height: '100%',
            minWidth: 64,
            padding: '2px 8px 1px',
            opacity: isActive ? 1 : 0.52,
            transition: 'opacity 200ms ease',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              color: 'var(--neutral-0)',
              transform: isActive ? 'translateY(-1px) scale(1.06)' : 'translateY(0) scale(1)',
              transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <Icon size={19} strokeWidth={isActive ? 2.4 : 1.9} />
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: isActive ? 700 : 600,
              color: 'var(--neutral-0)',
              letterSpacing: '0.01em',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
        </div>
      )}
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
  boxSizing: 'border-box',
  height: 'var(--bottom-nav-height)',
  minHeight: 'var(--bottom-nav-height)',
  paddingBottom: 0,
  background: 'linear-gradient(135deg, var(--primary-700) 0%, var(--primary-500) 100%)',
  borderTop: 'none',
  boxShadow: 'var(--shadow-lg)',
}

const navRowStyle: CSSProperties = {
  minHeight: 'var(--bottom-nav-height)',
  height: 'var(--bottom-nav-height)',
  paddingLeft: 'var(--safe-left)',
  paddingRight: 'var(--safe-right)',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 72px 1fr 1fr',
  alignItems: 'center',
  justifyItems: 'center',
}

const fabBaseStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  width: 40,
  height: 40,
  transform: 'translate(-50%, -50%)',
  borderRadius: 'var(--radius-full)',
  border: '1.5px solid color-mix(in oklab, var(--primary-500) 44%, var(--neutral-0))',
  background: 'var(--neutral-0)',
  color: 'var(--primary-600)',
  boxShadow: '0 0 0 2px color-mix(in oklab, var(--primary-300) 45%, transparent), 0 4px 14px rgba(0,0,0,0.18)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'transform var(--transition-base)',
  zIndex: 51,
}

export function BottomNav({ onAddClick, isAddMenuOpen = false }: BottomNavProps) {
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
          transform: fabHovered || isAddMenuOpen
            ? 'translate(-50%, -50%) scale(1.07)'
            : 'translate(-50%, -50%) scale(1)',
        }}
      >
        <Plus
          size={20}
          strokeWidth={2.4}
          style={{
            transform: isAddMenuOpen ? 'rotate(45deg)' : 'rotate(0deg)',
            transition: 'transform 180ms ease-out',
          }}
        />
      </button>
    </div>
  )
}
