import { expect, test } from '@playwright/test'

test.describe('Merchant stock + promotions UI', () => {
  test('create product with stock → storefront can add to cart immediately', async ({ page }) => {
    const sku = `E2E-STK-${Date.now()}`
    const name = `Stocked Widget ${Date.now()}`

    await page.goto('/#/merchant')
    await expect(page.getByRole('heading', { name: '商品 CRUD' })).toBeVisible({
      timeout: 15_000,
    })

    await page.locator('label', { hasText: 'SKU' }).locator('input').fill(sku)
    await page.locator('label', { hasText: '名称' }).locator('input').fill(name)
    await page.locator('label', { hasText: '价格（分）' }).locator('input').fill('1500')
    await page.getByLabel('初始库存').fill('5')
    await page.getByRole('button', { name: '创建 / 更新商品' }).click()

    const row = page.locator('li.merchant-row', { hasText: name })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await expect(row).toContainText('onHand 5')

    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Agent Commerce' })).toBeVisible()
    const productRow = page.locator('button.product-row', { hasText: name })
    await expect(productRow).toBeVisible({ timeout: 15_000 })
    await productRow.click()
    await expect(page.getByRole('heading', { name })).toBeVisible()
    await expect(page.locator('.stock')).toContainText('可售 5')

    await page.getByRole('button', { name: '加入购物车' }).click()
    await expect(page.getByRole('heading', { name: '购物车 / 结算' })).toBeVisible()
    await expect(page.locator('.cart-lines')).toContainText(`${name} × 1`)
    await expect(page.locator('.totals')).toContainText('应付 ¥15.00')
  })

  test('create 满减 → cart total changes correctly', async ({ page }) => {
    const code = `FULL${Date.now().toString().slice(-6)}`
    // Agent Mug is ¥25.00; 满 ¥20 减 ¥5 → payable ¥20.00
    const thresholdCents = 2000
    const offCents = 500

    await page.goto('/#/merchant')
    await expect(page.getByRole('heading', { name: '促销配置' })).toBeVisible({
      timeout: 15_000,
    })

    await page.getByLabel('促销代码').fill(code)
    await page.getByLabel('促销类型').selectOption('threshold_off')
    await page.getByLabel('满减门槛').fill(String(thresholdCents))
    await page.getByLabel('优惠金额').fill(String(offCents))
    await page.getByRole('button', { name: '创建促销' }).click()

    const promoRow = page.locator('li.merchant-row', { hasText: code })
    await expect(promoRow).toBeVisible({ timeout: 15_000 })
    await expect(promoRow).toContainText('满减')
    await expect(promoRow).toContainText('生效中')

    await page.goto('/')
    const mugRow = page.locator('button.product-row', { hasText: 'Agent Mug' })
    await expect(mugRow).toBeVisible({ timeout: 15_000 })
    await mugRow.click()
    await page.getByRole('button', { name: '加入购物车' }).click()
    await expect(page.getByRole('heading', { name: '购物车 / 结算' })).toBeVisible()
    await expect(page.locator('.totals')).toContainText('应付 ¥25.00')

    await page.locator('.promo-row input').fill(code)
    await page.locator('.promo-row button', { hasText: '应用' }).click()
    await expect(page.locator('.totals')).toContainText('优惠 ¥5.00', { timeout: 15_000 })
    await expect(page.locator('.totals')).toContainText('应付 ¥20.00')
  })

  test('rejects negative stock, negative threshold, and discount > threshold', async ({
    page,
  }) => {
    await page.goto('/#/merchant')
    await expect(page.getByRole('heading', { name: '商品 CRUD' })).toBeVisible({
      timeout: 15_000,
    })

    await page.getByLabel('初始库存').fill('-3')
    await page.getByRole('button', { name: '创建 / 更新商品' }).click()
    await expect(page.getByRole('alert')).toHaveText('初始库存不能为负数')

    await page.getByLabel('促销类型').selectOption('threshold_off')
    await page.getByLabel('促销代码').fill('BADTHRESH')
    await page.getByLabel('满减门槛').fill('-10')
    await page.getByLabel('优惠金额').fill('1')
    await page.getByRole('button', { name: '创建促销' }).click()
    await expect(page.getByRole('alert')).toHaveText('满减门槛不能为负数')

    await page.getByLabel('满减门槛').fill('100')
    await page.getByLabel('优惠金额').fill('101')
    await page.getByRole('button', { name: '创建促销' }).click()
    await expect(page.getByRole('alert')).toHaveText('优惠金额不能超过满减门槛')
  })
})
