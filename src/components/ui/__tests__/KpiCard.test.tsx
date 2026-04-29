import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { KpiCard } from '@/components/ui/KpiCard'

describe('KpiCard', () => {
  it('renders formatted currency value and label', () => {
    render(<KpiCard label="Revenus" value={1250} format="currency" />)

    expect(screen.getByText('Revenus')).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('€'))).toBeInTheDocument()
  })

  it('uses provided delta label when present', () => {
    render(<KpiCard label="Budget" value={1000} delta={-12} deltaLabel="Alerte budget" />)

    expect(screen.getByText('Alerte budget')).toBeInTheDocument()
  })

  it('supports keyboard activation when clickable', () => {
    const onClick = vi.fn()
    render(<KpiCard label="Épargne" value={3200} onClick={onClick} />)

    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
