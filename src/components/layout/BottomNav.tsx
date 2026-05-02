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
  end?: boolean
}

function NavItem({ to, icon: Icon, end = false }: NavItemProps) {
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
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            minWidth: 64,
            padding: '0 10px',
            opacity: isActive ? 1 : 0.58,
            transition: 'opacity 200ms ease',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              color: 'var(--neutral-0)',
              transform: isActive ? 'translateY(-4px) scale(1.08)' : 'translateY(0) scale(1)',
              transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <Icon size={23} strokeWidth={isActive ? 2.4 : 1.9} />
          </span>
          <span
            style={{
              position: 'absolute',
              bottom: 0,
              display: 'block',
              width: isActive ? 20 : 4,
              height: 3,
              borderRadius: '3px',
              background: 'var(--neutral-0)',
              opacity: isActive ? 1 : 0,
              transform: isActive ? 'scaleX(1)' : 'scaleX(0.35)',
              transformOrigin: 'center',
              flexShrink: 0,
              transition: 'width 320ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 220ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </div>
      )}
    </NavLink>
  )
}

const rootStyle: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 'calc(var(--safe-bottom-compensation) * -1)',
  zIndex: 50,
  maxWidth: 'var(--page-max-width)',
  margin: '0 auto',
}

const navStyle: CSSProperties = {
  position: 'relative',
  boxSizing: 'border-box',
  height: 'calc(var(--nav-base-height) + var(--safe-bottom-offset))',
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
  top: 'calc(var(--nav-base-height) / 2)',
  width: 44,
  height: 44,
  transform: 'translate(-50%, calc(-50% - 5px))',
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

export function BottomNav({ onAddClick }: BottomNavProps) {
  const [fabHovered, setFabHovered] = useState(false)

  return (
    <div style={rootStyle}>
      <nav style={navStyle} aria-label="Navigation principale">
        <div style={navRowStyle}>
          {LEFT_ITEMS.map(({ to, icon }, i) => (
            <NavItem key={to} to={to} icon={icon} end={i === 0} />
          ))}

          <div aria-hidden="true" />

          {RIGHT_ITEMS.map(({ to, icon }) => (
            <NavItem key={to} to={to} icon={icon} />
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
          transform: fabHovered
            ? 'translate(-50%, calc(-50% - 5px)) scale(1.07)'
            : 'translate(-50%, calc(-50% - 5px)) scale(1)',
        }}
      >
        <Plus size={20} strokeWidth={2.4} />
      </button>
    </div>
  )
}
