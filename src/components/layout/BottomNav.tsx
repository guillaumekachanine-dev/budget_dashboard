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
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        maxWidth: 390,
        margin: '0 auto',
      }}
    >
      <nav className="bottom-nav safe-bottom">
        {LEFT_ITEMS.map(({ to, icon, label }, i) => (
          <NavItem key={to} to={to} icon={icon} label={label} end={i === 0} />
        ))}

        {RIGHT_ITEMS.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label} />
        ))}
      </nav>

      <button
        onClick={onAddClick}
        aria-label="Ajouter une opération"
        className="nav-fab"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
    </div>
  )
}
