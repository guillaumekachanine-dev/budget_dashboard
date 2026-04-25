import { NavLink } from 'react-router-dom'
import { Home, FolderOpen, BarChart2, Activity, Plus } from 'lucide-react'

interface BottomNavProps {
  onAddClick: () => void
}

const LEFT_ITEMS = [
  { to: '/',         icon: Home,      label: 'Accueil'  },
  { to: '/activite', icon: Activity,  label: 'Activité' },
]
const RIGHT_ITEMS = [
  { to: '/budgets',  icon: FolderOpen, label: 'Budgets' },
  { to: '/stats',    icon: BarChart2,  label: 'Stats'   },
]

function NavItem({ to, icon: Icon, label, end = false }: { to: string; icon: typeof Home; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
    >
      {({ isActive }) => (
        <>
          <span className="nav-icon">
            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
          </span>
          <span className="nav-label">{label}</span>
        </>
      )}
    </NavLink>
  )
}

export function BottomNav({ onAddClick }: BottomNavProps) {
  return (
    <nav
      className="bottom-nav safe-bottom"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        maxWidth: 512,
        margin: '0 auto',
      }}
    >
      {LEFT_ITEMS.map(({ to, icon, label }, i) => (
        <NavItem key={to} to={to} icon={icon} label={label} end={i === 0} />
      ))}

      {/* FAB central */}
      <button
        onClick={onAddClick}
        aria-label="Ajouter une opération"
        style={{
          width: 52,
          height: 52,
          background: 'var(--primary-500)',
          borderRadius: 'var(--radius-full)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(91,87,245,0.4)',
          marginTop: -14,
          transition: 'transform 0.2s, box-shadow 0.2s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)'
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(91,87,245,0.5)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(91,87,245,0.4)'
        }}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {RIGHT_ITEMS.map(({ to, icon, label }) => (
        <NavItem key={to} to={to} icon={icon} label={label} />
      ))}
    </nav>
  )
}
