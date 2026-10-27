import { expect, test, type Page } from '@playwright/test'

/**
 * Mobile-viewport customer order path (ACP-37).
 * Assertions match desktop customer flow strength — never weakened for viewport.
 */
async function placePaidOrder(page: Page): Promise<string> {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Agent Commerce' })).toBeVisible()
  const mugRow = page.locator('button.product-row', { hasText: 'Agent Mug' })
  await expect(mugRow).toBeVisible({ timeout: 15_000 })

  await mugRow.click()
  await expect(page.getByRole('heading', { name: 'Agent Mug' })).toBeVisible()

  await page.getByRole('button', { name: '加入购物车' }).click()
  await expect(page.getByRole('heading', { name: '购物车 / 结算' })).toBeVisible()
  await expect(page.locator('.cart-lines')).toContainText('Agent Mug × 1')

  await page.getByRole('button', { name: '下单并支付' }).click()
  await expect(page.getByRole('heading', { name: '订单状态' })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.status')).toHaveText('paid')

  const orderId = (await page.locator('section.section code').first().textContent())?.trim()
  expect(orderId).toBeTruthy()
  return orderId!
}

test.describe('Mobile PWA customer order', () => {
  test('PWA manifest and service worker are installable signals', async ({ page }) => {
    await page.goto('/')

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(manifestHref).toBe('/manifest.webmanifest')

    const manifest = await page.evaluate(async () => {
      const res = await fetch('/manifest.webmanifest')
      return { ok: res.ok, body: await res.json() }
    })
    expect(manifest.ok).toBe(true)
    expect(manifest.body.name).toBe('Agent Commerce')
    expect(manifest.body.display).toBe('standalone')
    expect(manifest.body.icons?.length).toBeGreaterThanOrEqual(2)

    const swReady = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false
      const reg = await navigator.serviceWorker.ready
      return Boolean(reg.active || reg.installing || reg.waiting)
    })
    expect(swReady).toBe(true)

    const offline = await page.evaluate(async () => {
      const res = await fetch('/offline.html')
      return { ok: res.ok, text: await res.text() }
    })
    expect(offline.ok).toBe(true)
    expect(offline.text).toContain('当前离线')
  })

  test('customer places and pays an order at mobile viewport', async ({ page }) => {
    const viewport = page.viewportSize()
    expect(viewport).toBeTruthy()
    expect(viewport!.width).toBeLessThanOrEqual(500)

    const orderId = await placePaidOrder(page)
    await expect(page.getByText(`实付`)).toBeVisible()
    await expect(page.locator('code').first()).toHaveText(orderId)

    const orderHeadingVisible = await page.getByRole('heading', { name: '订单状态' }).isVisible()
    expect(orderHeadingVisible).toBe(true)
  })
})
