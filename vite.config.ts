import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { splitVendorChunkPlugin } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

const analyzeBundle = process.env.ANALYZE === 'true'

export default defineConfig({
  plugins: [
    react(),
    splitVendorChunkPlugin(),
    analyzeBundle &&
      visualizer({
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
        open: false,
      }),
  ],
  build: {
    sourcemap: false,
    // Prevent small WebP icons from being base64-inlined into the JS bundle.
    // At ~2-4 KB each × 97 icons the inline overhead would be ~300 KB in JS.
    // With limit=0 they stay as separate files fetched by the browser on demand.
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Heavy chart library — only loaded when Stats/Budgets pages are visited
          if (id.includes('recharts')) return 'vendor-recharts'
          // Animation library — shared across pages but isolated for caching
          if (id.includes('framer-motion')) return 'vendor-motion'
          // Supabase client + all internal sub-packages (@supabase/auth-js, postgrest-js, etc.)
          if (id.includes('@supabase/')) return 'vendor-supabase'
          // React Query — stable, rarely changes
          if (id.includes('@tanstack/react-query')) return 'vendor-query'
          // Router — react-router-dom v7 re-exports from react-router core; match both
          if (id.includes('react-router')) return 'vendor-router'
          // React core — most stable dep, isolated for best long-term cache hit rate
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'vendor-react'
          // Form library — only used in AddTransactionModal (lazy-loaded)
          if (id.includes('react-hook-form')) return 'vendor-forms'
          // Icon library — tree-shaken per-icon but still has shared runtime
          if (id.includes('lucide-react')) return 'vendor-icons'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
