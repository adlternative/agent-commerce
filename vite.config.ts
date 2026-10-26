import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/health': 'http://127.0.0.1:8787',
      '/openapi.json': 'http://127.0.0.1:8787',
      '/.well-known': 'http://127.0.0.1:8787',
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
