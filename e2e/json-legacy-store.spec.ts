import { expect, test } from '@playwright/test'
import { access } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Dedicated legacy JSON backend coverage (STORE_BACKEND=json).
 * Isolated config: playwright.json-legacy.config.ts — not the default SQLite suite.
 */
test.describe('E2E store backend (legacy JSON)', () => {
  test('GET /healthz reports store=json and commerce.json is used', async ({
    request,
    page,
  }) => {
    const apiPort = process.env.E2E_API_PORT
    expect(apiPort, 'E2E_API_PORT must be set by playwright.json-legacy.config').toBeTruthy()

    const res = await request.get(`http://127.0.0.1:${apiPort}/healthz`)
    expect(res.status()).toBe(200)
    const body = (await res.json()) as { ok: boolean; store?: string }
    expect(body.ok).toBe(true)
    expect(body.store).toBe('json')

    // Smoke: UI still boots against the JSON-backed API.
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Agent Commerce' })).toBeVisible()
    await expect(page.locator('button.product-row', { hasText: 'Agent Mug' })).toBeVisible({
      timeout: 15_000,
    })

    const dataDir = process.env.E2E_JSON_DATA_DIR
    expect(dataDir, 'E2E_JSON_DATA_DIR must be set by playwright.json-legacy.config').toBeTruthy()
    await access(join(dataDir!, 'commerce.json'))
  })
})
