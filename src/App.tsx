import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { BottomNav } from '@/components/layout/BottomNav'
import { prefetchPrimaryRoutes } from '@/lib/routePrefetch'
import { forceUnlockDocumentScroll } from '@/lib/scrollLock'

const Home = lazy(() => import('@/pages/Home').then((module) => ({ default: module.Home })))
const Flux = lazy(() => import('@/pages/Flux').then((module) => ({ default: module.Flux })))
const Budgets = lazy(() => import('@/pages/Budgets').then((module) => ({ default: module.Budgets })))
const Epargne = lazy(() => import('@/pages/Epargne').then((module) => ({ default: module.Epargne })))
const Voyages = lazy(() => import('@/pages/Voyages').then((module) => ({ default: module.Voyages })))
const Login = lazy(() => import('@/pages/Login').then((module) => ({ default: module.Login })))
const loadAddTransactionModal = () => import('@/components/modals/AddTransactionModal')
// Lazy-loaded to keep react-hook-form out of the initial bundle (modal is rarely opened on first load)
const AddTransactionModal = lazy(() =>
  loadAddTransactionModal().then((m) => ({ default: m.AddTransactionModal }))
)

function RouteFallback() {
  return (
    <div className="app-shell flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  const [addTransactionModalOpen, setAddTransactionModalOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    forceUnlockDocumentScroll()
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.search])

  useEffect(() => {
    if (typeof window === 'undefined' || !('scrollRestoration' in window.history)) return
    const previousMode = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = previousMode
    }
  }, [])

  useEffect(() => {
    if (!user) return

    const schedule = () => {
      prefetchPrimaryRoutes()
      void loadAddTransactionModal()
    }
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(schedule, { timeout: 1200 })
      return () => window.cancelIdleCallback(id)
    }

    const timeoutId = setTimeout(schedule, 350)
    return () => clearTimeout(timeoutId)
  }, [user])

  const handleCenterActionClick = useCallback(() => {
    void loadAddTransactionModal()
    setAddTransactionModalOpen(true)
  }, [])

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

      <main className="app-main">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/"                element={<Home />} />
            <Route path="/flux"            element={<Flux />} />
            <Route path="/activite"        element={<Navigate to="/flux" replace />} />
            <Route path="/budgets"         element={<Budgets />} />
            <Route path="/epargne"         element={<Epargne />} />
            <Route path="/voyages"         element={<Voyages />} />
            <Route path="/voyages/:tripId" element={<Voyages />} />
            {/* Redirections des anciens chemins */}
            <Route path="/stats"    element={<Navigate to="/epargne" replace />} />
            <Route path="/charts"   element={<Navigate to="/epargne" replace />} />
            <Route path="*"         element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      <BottomNav onAddClick={handleCenterActionClick} />
      <AddTransactionModal open={addTransactionModalOpen} onClose={() => setAddTransactionModalOpen(false)} />
    </div>
  )
}
