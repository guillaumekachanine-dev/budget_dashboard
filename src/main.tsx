import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'

if (typeof window !== 'undefined') {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true

  document.documentElement.dataset.standalone = isStandalone ? 'true' : 'false'
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // 5-minute default stale time: single-user app, mutations explicitly invalidate all caches.
      // No need to refetch data that's still valid. Reduces background Supabase requests.
      staleTime: 5 * 60_000,
      // Keep data in memory for 30 min — fast instant re-display when navigating back to a page
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
)
