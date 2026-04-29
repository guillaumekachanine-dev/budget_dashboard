const routeLoaders = {
  '/': () => import('@/pages/Home'),
  '/flux': () => import('@/pages/Flux'),
  '/budgets': () => import('@/pages/Budgets'),
  '/stats': () => import('@/pages/Stats'),
  '/login': () => import('@/pages/Login'),
} as const

export type RoutePath = keyof typeof routeLoaders

const prefetched = new Set<RoutePath>()

export function prefetchRoute(path: RoutePath) {
  if (prefetched.has(path)) return

  const loader = routeLoaders[path]
  if (!loader) return

  prefetched.add(path)
  void loader()
}

export function prefetchPrimaryRoutes() {
  prefetchRoute('/flux')
  prefetchRoute('/budgets')
  prefetchRoute('/stats')
}
