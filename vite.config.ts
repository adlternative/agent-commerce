import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Playwright E2E may bind the API on a free port; fall back to the default.
const apiOrigin = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8787}`

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': apiOrigin,
      '/health': apiOrigin,
      '/openapi.json': apiOrigin,
      '/.well-known': apiOrigin,
    },
  },
  // node:sqlite is a Node built-in; keep Vite/Vitest from rewriting it to bare "sqlite".
  ssr: { external: ['node:sqlite'] },
  optimizeDeps: { exclude: ['node:sqlite'] },
  test: {
    environment: 'node',
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    server: { deps: { external: ['node:sqlite'] } },
  },
})
