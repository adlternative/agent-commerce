import { defineConfig, devices } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveE2ePorts } from './e2e/resolve-ports'

const { webPort, apiPort } = await resolveE2ePorts()

/** Per-worker independent DATA_DIR (SQLite). Never ends with .json / never sets DATA_PATH. */
const workerIndex = process.env.TEST_PARALLEL_INDEX ?? process.env.PW_WORKER_INDEX ?? '0'
const dataDir =
  process.env.E2E_DATA_DIR ??
  join(tmpdir(), `agent-commerce-e2e-${process.pid}-w${workerIndex}`)
mkdirSync(dataDir, { recursive: true })
// Visible to specs (webServer.env alone does not propagate into the test process).
process.env.E2E_DATA_DIR = dataDir

// Marker so global teardown can remove the dir (no /tmp json leftovers from default e2e).
const markerDir = join(tmpdir(), 'agent-commerce-e2e-markers')
mkdirSync(markerDir, { recursive: true })
writeFileSync(join(markerDir, `${process.pid}.dir`), dataDir, 'utf8')

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  testIgnore: /json-legacy-store\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/json-legacy-store\.spec\.ts/, /mobile-.*\.spec\.ts/],
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: /mobile-.*\.spec\.ts/,
    },
  ],
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
        // Production-isomorphic: SQLite under DATA_DIR (not legacy DATA_PATH=*.json).
        DATA_DIR: dataDir,
        DATA_PATH: '',
        STORE_BACKEND: 'sqlite',
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
