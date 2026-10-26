import { describe, expect, it } from 'vitest'
import { MemoryRepository } from '../../src/repo/json-repository.js'
import { CommerceService } from '../../src/services/commerce.js'

describe('merchant metrics', () => {
  it('tracks GMV, order count, and out-of-stock SKUs', async () => {
    const svc = new CommerceService(new MemoryRepository())
    const p = await svc.upsertProduct(
      { sku: 'A', name: 'A', priceCents: 1000 },
      'm1',
    )
    await svc.adjustStock(p.id, 1, 's1')
    const cart = await svc.createCart('c', 'c1')
    await svc.addItem(cart.id, p.id, 1, 'a1')
    const order = await svc.placeOrder(cart.id, 'o1')
    await svc.payOrder(order.id, 'pay1')

    // Second product with zero stock → OOS
    await svc.upsertProduct({ sku: 'B', name: 'B', priceCents: 500 }, 'm2')

    const metrics = await svc.getMetrics()
    expect(metrics.gmvCents).toBe(1000)
    expect(metrics.orderCount).toBe(1)
    expect(metrics.paidOrderCount).toBe(1)
    expect(metrics.outOfStockCount).toBe(2) // A reserved/committed available 0, B 0
  })
})
