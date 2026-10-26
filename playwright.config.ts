import { defineConfig, devices } from '@playwright/test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const apiPort = Number(process.env.E2E_API_PORT ?? 8787)
const webPort = Number(process.env.E2E_WEB_PORT ?? 5173)
const dataPath = process.env.E2E_DATA_PATH ?? join(tmpdir(), `agent-commerce-e2e-${process.pid}.json`)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run server',
      url: `http://127.0.0.1:${apiPort}/health`,
      // Always start fresh so a stale Vite/API on the port cannot fail the suite.
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: String(apiPort),
        DATA_PATH: dataPath,
      },
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${webPort} --strictPort`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
