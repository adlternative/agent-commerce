import { expect, test } from '@playwright/test'

test.describe('NL order panel', () => {
  test('default example places a paid order', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('button', { name: 'Agent Commerce' })).toBeVisible()
    const panel = page.locator('#nl-panel')
    await expect(panel.getByRole('heading', { name: '跟 AI 说人话下单' })).toBeVisible()

    const textarea = panel.locator('textarea')
    await expect(textarea).toHaveValue(/Agent Mug/)

    await panel.getByRole('button', { name: '让 Agent 下单' }).click()

    await expect(page.getByRole('heading', { name: '订单状态' })).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.status')).toHaveText('paid')

    const orderId = (await page.locator('section.section code').first().textContent())?.trim()
    expect(orderId).toBeTruthy()
    await expect(page.locator('code').first()).toHaveText(orderId!)
  })
})
