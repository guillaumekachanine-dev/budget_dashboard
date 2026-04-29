type HeroSectionProps = {
  bgColor: string
  value: string
  subtitle: string
}

export function HeroSection({ bgColor, value, subtitle }: HeroSectionProps) {
  return (
    <section style={{ padding: '0 var(--space-6)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div
          style={{
            background: bgColor,
            color: 'var(--neutral-0)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            boxShadow: 'var(--shadow-lg)',
            margin: 'var(--space-6) 0',
            display: 'grid',
            justifyItems: 'center',
            textAlign: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-size-kpi)',
              fontWeight: 'var(--font-weight-extrabold)',
              lineHeight: 'var(--line-height-tight)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--neutral-0)',
            }}
          >
            {value}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-size-sm)',
              lineHeight: 'var(--line-height-normal)',
              color: 'var(--neutral-0)',
              opacity: 0.8,
            }}
          >
            {subtitle}
          </p>
        </div>
      </div>
    </section>
  )
}

