import { expect, test, type Page } from '@playwright/test'

async function placePaidOrder(page: Page): Promise<{ orderId: string; onHandBefore: number }> {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Agent Commerce' })).toBeVisible()
  const mugRow = page.locator('button.product-row', { hasText: 'Agent Mug' })
  await expect(mugRow).toBeVisible({ timeout: 15_000 })
  await mugRow.click()
  await expect(page.getByRole('heading', { name: 'Agent Mug' })).toBeVisible()

  const stockText = await page.locator('.section').filter({ hasText: '可售' }).textContent()
  const onHandMatch = stockText?.match(/在库\s+(\d+)/)
  const onHandBefore = onHandMatch ? Number(onHandMatch[1]) : NaN

  await page.getByRole('button', { name: '加入购物车' }).click()
  await expect(page.getByRole('heading', { name: '购物车 / 结算' })).toBeVisible()
  await page.getByRole('button', { name: '下单并支付' }).click()
  await expect(page.getByRole('heading', { name: '订单状态' })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.status')).toHaveText('paid')

  const orderId = (await page.locator('section.section code').first().textContent())?.trim()
  expect(orderId).toBeTruthy()
  return { orderId: orderId!, onHandBefore }
}

test.describe('Return + refund E2E', () => {
  test('order → pay → request return → merchant approve → refunded + restocked', async ({
    page,
  }) => {
    const { orderId, onHandBefore } = await placePaidOrder(page)

    await expect(page.getByRole('heading', { name: '申请退货' })).toBeVisible()
    await page.getByLabel('退货原因').fill('尺码不合适')
    await page.getByRole('button', { name: '申请退货' }).click()
    await expect(page.getByTestId('return-requested')).toBeVisible({ timeout: 15_000 })

    await page.goto('/#/merchant')
    await expect(page.getByRole('heading', { name: '退货审核' })).toBeVisible({ timeout: 15_000 })

    const returnsSection = page.getByTestId('returns-section')
    const returnRow = returnsSection.locator('li.merchant-row', { hasText: orderId })
    await expect(returnRow).toBeVisible()
    await expect(returnRow).toHaveAttribute('data-return-status', 'requested')
    await returnRow.getByRole('button', { name: '批准' }).click()
    await expect(returnRow).toHaveAttribute('data-return-status', 'refunded', { timeout: 15_000 })

    const orderRow = page.locator(`li.merchant-row[data-order-id="${orderId}"]`)
    await expect(orderRow).toHaveAttribute('data-order-status', 'refunded', { timeout: 15_000 })

    // Inventory restocked: open product and check onHand increased by 1 vs post-pay (commit).
    await page.goto('/')
    const mugRow = page.locator('button.product-row', { hasText: 'Agent Mug' })
    await mugRow.click()
    await expect(page.getByRole('heading', { name: 'Agent Mug' })).toBeVisible()
    if (Number.isFinite(onHandBefore)) {
      await expect(page.locator('.section').filter({ hasText: '可售' })).toContainText(
        `在库 ${onHandBefore}`,
        { timeout: 15_000 },
      )
    }
  })
})
