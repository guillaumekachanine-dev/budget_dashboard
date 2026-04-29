import { Settings } from 'lucide-react'

type PageHeaderProps = {
  onSettingsClick?: () => void
  title?: string
}

export function PageHeader({ onSettingsClick, title }: PageHeaderProps) {
  return (
    <header
      style={{
        borderBottom: '1px solid var(--neutral-200)',
        padding: 'var(--space-4) var(--space-6)',
        background: 'var(--neutral-0)',
      }}
    >
      <div
        style={{
          maxWidth: 600,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          minHeight: 32,
        }}
      >
        {title ? (
          <h1
            style={{
              margin: 0,
              fontSize: 'var(--font-size-2xl)',
              lineHeight: 'var(--line-height-tight)',
              fontWeight: 'var(--font-weight-extrabold)',
              color: 'var(--neutral-900)',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h1>
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--neutral-600)',
              textTransform: 'capitalize',
            }}
          >
            Bonjour · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        )}

        <button
          type="button"
          aria-label="Paramètres"
          onClick={onSettingsClick}
          style={{
            border: 'none',
            background: 'transparent',
            width: 32,
            height: 32,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--neutral-600)',
            cursor: 'pointer',
            transition: 'color var(--transition-fast)',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.color = 'var(--primary-500)'
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.color = 'var(--neutral-600)'
          }}
        >
          <Settings size={20} />
        </button>
      </div>
    </header>
  )
}
