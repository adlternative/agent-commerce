import { expect, test } from '@playwright/test'
import { access } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * ACP-29: default Playwright e2e must boot the same SQLite store as Docker/prod.
 * Proves via /healthz `store` (server also logs `store: sqlite @ …`).
 */
test.describe('E2E store backend (SQLite)', () => {
  test('GET /healthz reports store=sqlite', async ({ request }) => {
    const apiPort = process.env.E2E_API_PORT
    expect(apiPort, 'E2E_API_PORT must be set by playwright.config').toBeTruthy()

    const res = await request.get(`http://127.0.0.1:${apiPort}/healthz`)
    expect(res.status()).toBe(200)
    const body = (await res.json()) as { ok: boolean; store?: string }
    expect(body.ok).toBe(true)
    expect(body.store).toBe('sqlite')

    const dataDir = process.env.E2E_DATA_DIR
    expect(dataDir, 'E2E_DATA_DIR must be set by playwright.config').toBeTruthy()
    await access(join(dataDir!, 'commerce.sqlite'))
  })
})
