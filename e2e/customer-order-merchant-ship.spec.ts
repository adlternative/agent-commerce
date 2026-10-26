import { expect, test, type Page } from '@playwright/test'

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

test.describe('Frontend E2E main paths', () => {
  test('customer places and pays an order', async ({ page }) => {
    const orderId = await placePaidOrder(page)
    await expect(page.getByText(`实付`)).toBeVisible()
    await expect(page.locator('code').first()).toHaveText(orderId)
  })

  test('merchant ships a paid order', async ({ page }) => {
    const orderId = await placePaidOrder(page)

    await page.goto('/#/merchant')
    await expect(page.getByRole('heading', { name: '订单流转' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(orderId)).toBeVisible()

    const row = page.locator('li.merchant-row', { hasText: orderId })
    await expect(row).toContainText('paid')
    await row.getByRole('button', { name: '发货' }).click()

    await expect(row).toContainText('shipped', { timeout: 15_000 })
    await expect(row.getByRole('button', { name: '签收' })).toBeVisible()
  })
})
