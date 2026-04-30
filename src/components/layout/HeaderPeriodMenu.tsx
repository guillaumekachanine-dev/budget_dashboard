import { useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

export interface HeaderPeriodMenuOption {
  key: string
  label: string
  active: boolean
  showDividerBefore?: boolean
  onSelect: () => void
}

interface HeaderPeriodMenuProps {
  buttonLabel: string
  buttonAriaLabel: string
  menuAriaLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onBeforeToggle?: () => void
  options: HeaderPeriodMenuOption[]
}

export function HeaderPeriodMenu({
  buttonLabel,
  buttonAriaLabel,
  menuAriaLabel,
  open,
  onOpenChange,
  onBeforeToggle,
  options,
}: HeaderPeriodMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuRef.current && !menuRef.current.contains(target)) {
        onOpenChange(false)
      }
    }

    document.addEventListener('mousedown', onDocumentMouseDown)
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown)
    }
  }, [onOpenChange, open])

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => {
          onBeforeToggle?.()
          onOpenChange(!open)
        }}
        aria-label={buttonAriaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'color-mix(in oklab, var(--neutral-0) 92%, var(--primary-100) 8%)',
          fontSize: 'var(--font-size-base)',
          fontWeight: 'var(--font-weight-bold)',
          padding: 0,
          margin: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span>{buttonLabel}</span>
        <ChevronDown
          size={14}
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform var(--transition-fast)',
          }}
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={menuAriaLabel}
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + var(--space-3))',
            minWidth: 196,
            background: 'var(--neutral-0)',
            border: '1px solid var(--neutral-200)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-card)',
            padding: 'var(--space-2)',
            display: 'grid',
            gap: 2,
            zIndex: 130,
          }}
        >
          {options.map((option) => (
            <div key={option.key}>
              {option.showDividerBefore ? (
                <div style={{ height: 1, background: 'var(--neutral-200)', margin: 'var(--space-1) 0' }} />
              ) : null}
              <button
                type="button"
                onClick={() => {
                  option.onSelect()
                  onOpenChange(false)
                }}
                style={{
                  width: '100%',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: option.active ? 'var(--primary-50)' : 'transparent',
                  color: option.active ? 'var(--primary-700)' : 'var(--neutral-800)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: option.active ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
                  textAlign: 'left',
                  padding: 'var(--space-2) var(--space-3)',
                  cursor: 'pointer',
                }}
              >
                {option.label}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
