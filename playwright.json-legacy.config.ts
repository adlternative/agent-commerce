import { defineConfig, devices } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveE2ePorts } from './e2e/resolve-ports'

/**
 * Dedicated legacy JSON-store suite (STORE_BACKEND=json).
 * Kept separate so default e2e stays on SQLite like Docker/prod.
 */
const { webPort, apiPort } = await resolveE2ePorts()
const workerIndex = process.env.TEST_PARALLEL_INDEX ?? process.env.PW_WORKER_INDEX ?? '0'
const dataDir =
  process.env.E2E_JSON_DATA_DIR ??
  join(tmpdir(), `agent-commerce-e2e-json-${process.pid}-w${workerIndex}`)
mkdirSync(dataDir, { recursive: true })
process.env.E2E_JSON_DATA_DIR = dataDir

const markerDir = join(tmpdir(), 'agent-commerce-e2e-markers')
mkdirSync(markerDir, { recursive: true })
writeFileSync(join(markerDir, `${process.pid}-json.dir`), dataDir, 'utf8')

export default defineConfig({
  testDir: './e2e',
  testMatch: /json-legacy-store\.spec\.ts/,
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
  projects: [{ name: 'chromium-json-legacy', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run server',
      url: `http://127.0.0.1:${apiPort}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: String(apiPort),
        DATA_DIR: dataDir,
        DATA_PATH: '',
        STORE_BACKEND: 'json',
        E2E_PORTS_LOCKED: '1',
        E2E_WEB_PORT: String(webPort),
        E2E_API_PORT: String(apiPort),
        PW_PORT: String(webPort),
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
