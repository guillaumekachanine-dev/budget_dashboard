import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { BottomNav } from '@/components/layout/BottomNav'
import { AddTransactionModal } from '@/components/modals/AddTransactionModal'
import { prefetchPrimaryRoutes } from '@/lib/routePrefetch'

const Home = lazy(() => import('@/pages/Home').then((module) => ({ default: module.Home })))
const Flux = lazy(() => import('@/pages/Flux').then((module) => ({ default: module.Flux })))
const Budgets = lazy(() => import('@/pages/Budgets').then((module) => ({ default: module.Budgets })))
const Stats = lazy(() => import('@/pages/Stats').then((module) => ({ default: module.Stats })))
const Login = lazy(() => import('@/pages/Login').then((module) => ({ default: module.Login })))

function RouteFallback() {
  return (
    <div className="app-shell flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!user) return

    const schedule = () => prefetchPrimaryRoutes()
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(schedule, { timeout: 1200 })
      return () => window.cancelIdleCallback(id)
    }

    const timeoutId = setTimeout(schedule, 350)
    return () => clearTimeout(timeoutId)
  }, [user])

  if (loading) {
    return <RouteFallback />
  }

  if (!user) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Login />
      </Suspense>
    )
  }

  return (
    <div className="app-shell">
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/"         element={<Home />} />
          <Route path="/flux"     element={<Flux />} />
          <Route path="/activite" element={<Navigate to="/flux" replace />} />
          <Route path="/budgets"  element={<Budgets />} />
          <Route path="/stats"    element={<Stats />} />
          {/* Redirections des anciens chemins */}
          <Route path="/charts"   element={<Navigate to="/stats" replace />} />
          <Route path="/epargne"  element={<Navigate to="/stats" replace />} />
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      <BottomNav onAddClick={() => setModalOpen(true)} />
      <AddTransactionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
