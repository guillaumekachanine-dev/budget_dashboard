import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { BottomNav } from '@/components/layout/BottomNav'
import { AddTransactionModal } from '@/components/modals/AddTransactionModal'
import { Home } from '@/pages/Home'
import { Activite } from '@/pages/Activite'
import { Budgets } from '@/pages/Budgets'
import { Stats } from '@/pages/Stats'
import { Login } from '@/pages/Login'

export default function App() {
  const { user, loading } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <div className="min-h-screen bg-neutral-50 max-w-lg mx-auto">
      <Routes>
        <Route path="/"         element={<Home />} />
        <Route path="/activite" element={<Activite />} />
        <Route path="/budgets"  element={<Budgets />} />
        <Route path="/stats"    element={<Stats />} />
        {/* Redirections des anciens chemins */}
        <Route path="/charts"   element={<Navigate to="/stats" replace />} />
        <Route path="/epargne"  element={<Navigate to="/stats" replace />} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>

      <BottomNav onAddClick={() => setModalOpen(true)} />
      <AddTransactionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
