import { defineConfig, devices } from '@playwright/test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveE2ePorts } from './e2e/resolve-ports'

const { webPort, apiPort } = await resolveE2ePorts()
const dataPath = process.env.E2E_DATA_PATH ?? join(tmpdir(), `agent-commerce-e2e-${process.pid}.json`)

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
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
        E2E_PORTS_LOCKED: '1',
        E2E_WEB_PORT: String(webPort),
        E2E_API_PORT: String(apiPort),
        PW_PORT: String(webPort),
        // Fail-closed auth: e2e uses demo bearer tokens against `npm run server`.
        JWT_SECRET: process.env.JWT_SECRET || 'agent-commerce-e2e-jwt-secret',
        ALLOW_DEMO_TOKENS: '1',
      },
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${webPort} --strictPort`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        E2E_PORTS_LOCKED: '1',
        E2E_WEB_PORT: String(webPort),
        E2E_API_PORT: String(apiPort),
        PW_PORT: String(webPort),
      },
    },
  ],
})
