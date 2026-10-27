import { describe, expect, it } from 'vitest'
import { MemoryRepository } from '../../src/repo/json-repository.js'
import { CommerceService } from '../../src/services/commerce.js'
import { DomainError } from '../../src/domain/errors.js'
import { availableQty } from '../../src/domain/inventory.js'

async function seedService(onHand = 10) {
  const repo = new MemoryRepository()
  const svc = new CommerceService(repo)
  const product = await svc.upsertProduct(
    {
      sku: 'TEE-BLK-M',
      name: 'Black Tee M',
      priceCents: 3_900,
      tags: ['apparel'],
      agentNotes: 'Best for agents that need a simple SKU.',
    },
    'seed-product-1',
  )
  await svc.adjustStock(product.id, onHand, 'seed-stock-1')
  await svc.upsertPromotion(
    {
      code: 'SAVE500',
      type: 'threshold_off',
      thresholdCents: 5_000,
      offCents: 500,
      active: true,
    },
    'seed-promo-1',
  )
  return { svc, product, repo }
}

describe('CommerceService', () => {
  it('rankProductsWithAvailability attaches available via one batch stock lookup', async () => {
    const repo = new MemoryRepository()
    const svc = new CommerceService(repo)
    const calls: string[] = []
    const orig = repo.getStockByProductIds.bind(repo)
    repo.getStockByProductIds = async (ids) => {
      calls.push(`batch:${ids.length}`)
      return orig(ids)
    }

    const a = await svc.upsertProduct(
      { sku: 'A-1', name: 'Alpha', priceCents: 100 },
      'avail-a',
    )
    const b = await svc.upsertProduct(
      { sku: 'B-1', name: 'Beta', priceCents: 200 },
      'avail-b',
    )
    await svc.adjustStock(a.id, 7, 'avail-a-stock')
    // b stays available=0

    const ranked = await svc.rankProductsWithAvailability({})
    expect(calls).toEqual([`batch:${ranked.length}`])
    expect(calls).toHaveLength(1)
    const byId = new Map(ranked.map((h) => [h.product.id, h.product.available]))
    expect(byId.get(a.id)).toBe(7)
    expect(byId.get(b.id)).toBe(0)
  })

  it('upserts product idempotently', async () => {
    const { svc, product } = await seedService()
    const again = await svc.upsertProduct(
      {
        sku: 'TEE-BLK-M',
        name: 'Black Tee M',
        priceCents: 3_900,
        tags: ['apparel'],
        agentNotes: 'Best for agents that need a simple SKU.',
      },
      'seed-product-1',
    )
    expect(again.id).toBe(product.id)
    expect(await svc.listProducts({ q: 'tee' })).toHaveLength(1)
  })

  it('places order with stock reserve, pays, ships, delivers', async () => {
    const { svc, product } = await seedService(5)
    const cart = await svc.createCart('cust_a', 'cart-ik-1')
    await svc.addItem(cart.id, product.id, 2, 'add-ik-1')
    await svc.applyPromotion(cart.id, 'SAVE500', 'promo-ik-1')

    const quote = await svc.quoteCart(cart.id)
    expect(quote.subtotalCents).toBe(7_800)
    expect(quote.discountCents).toBe(500)
    expect(quote.totalCents).toBe(7_300)

    const order = await svc.placeOrder(cart.id, 'order-ik-1')
    expect(order.status).toBe('created')
    expect(order.totalCents).toBe(7_300)

    const stockAfterReserve = await svc.checkInventory(product.id)
    expect(stockAfterReserve.available).toBe(3)
    expect(stockAfterReserve.reserved).toBe(2)

    const { order: paid, payment } = await svc.payOrder(order.id, 'pay-ik-1')
    expect(paid.status).toBe('paid')
    expect(payment.status).toBe('captured')
    expect((await svc.checkInventory(product.id)).onHand).toBe(3)
    expect((await svc.checkInventory(product.id)).reserved).toBe(0)

    const shipped = await svc.shipOrder(paid.id, 'ship-ik-1')
    expect(shipped.status).toBe('shipped')
    const delivered = await svc.deliverOrder(paid.id, 'deliver-ik-1')
    expect(delivered.status).toBe('delivered')
  })

  it('rejects oversell on placeOrder and keeps stock consistent', async () => {
    const { svc, product } = await seedService(2)
    const cart = await svc.createCart('cust_b', 'cart-ik-2')
    await svc.addItem(cart.id, product.id, 2, 'add-ik-2')

    // Second cart tries to buy the same last units after first order reserved them.
    const order1 = await svc.placeOrder(cart.id, 'order-ik-2')
    expect(order1.status).toBe('created')

    const cart2 = await svc.createCart('cust_c', 'cart-ik-3')
    // addItem checks available — should fail once reserved
    await expect(svc.addItem(cart2.id, product.id, 1, 'add-ik-3')).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK',
    })

    const stock = await svc.checkInventory(product.id)
    expect(stock.onHand).toBe(2)
    expect(stock.reserved).toBe(2)
    expect(availableQty(stock)).toBe(0)
  })

  it('replays identical placeOrder Idempotency-Key without double reserve', async () => {
    const { svc, product } = await seedService(4)
    const cart = await svc.createCart('cust_d', 'cart-ik-4')
    await svc.addItem(cart.id, product.id, 2, 'add-ik-4')

    const first = await svc.placeOrder(cart.id, 'same-order-key')
    const second = await svc.placeOrder(cart.id, 'same-order-key')
    expect(second.id).toBe(first.id)

    const stock = await svc.checkInventory(product.id)
    expect(stock.reserved).toBe(2)
    expect(stock.onHand).toBe(4)

    const orders = await svc.listOrders({ customerId: 'cust_d' })
    expect(orders).toHaveLength(1)
  })

  it('conflicts when Idempotency-Key reused with different payload', async () => {
    const { svc, product } = await seedService(4)
    const cart1 = await svc.createCart('cust_e', 'cart-ik-5')
    await svc.addItem(cart1.id, product.id, 1, 'add-ik-5')
    await svc.placeOrder(cart1.id, 'dup-key')

    const cart2 = await svc.createCart('cust_e', 'cart-ik-6')
    await svc.addItem(cart2.id, product.id, 1, 'add-ik-6')
    await expect(svc.placeOrder(cart2.id, 'dup-key')).rejects.toBeInstanceOf(DomainError)
    await expect(svc.placeOrder(cart2.id, 'dup-key')).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSE',
    })
  })

  it('cancels created order and releases reservation', async () => {
    const { svc, product } = await seedService(3)
    const cart = await svc.createCart('cust_f', 'cart-ik-7')
    await svc.addItem(cart.id, product.id, 2, 'add-ik-7')
    const order = await svc.placeOrder(cart.id, 'order-ik-7')
    const cancelled = await svc.cancelOrder(order.id, 'cancel-ik-7')
    expect(cancelled.status).toBe('cancelled')
    const stock = await svc.checkInventory(product.id)
    expect(stock.reserved).toBe(0)
    expect(stock.onHand).toBe(3)
  })

  it('refunds paid order via requestReturn + approveReturn and restocks', async () => {
    const { svc, product } = await seedService(3)
    const cart = await svc.createCart('cust_g', 'cart-ik-8')
    await svc.addItem(cart.id, product.id, 1, 'add-ik-8')
    const order = await svc.placeOrder(cart.id, 'order-ik-8')
    await svc.payOrder(order.id, 'pay-ik-8')
    const requested = await svc.requestReturn(order.id, 'too small', 'ret-ik-8')
    expect(requested.return.status).toBe('requested')
    expect(requested.order.status).toBe('paid')
    const result = await svc.approveReturn(requested.return.id, 'ret-approve-8')
    expect(result.order.status).toBe('refunded')
    expect(result.payment.status).toBe('refunded')
    expect(result.return.status).toBe('refunded')
    expect((await svc.checkInventory(product.id)).onHand).toBe(3)
  })

  it('runs concurrent placeOrder without overselling', async () => {
    const { svc, product } = await seedService(5)

    const carts = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        svc.createCart(`cust_conc_${i}`, `cart-conc-${i}`).then(async (cart) => {
          await svc.addItem(cart.id, product.id, 1, `add-conc-${i}`)
          return cart
        }),
      ),
    )

    const results = await Promise.all(
      carts.map((cart, i) =>
        svc.placeOrder(cart.id, `order-conc-${i}`).then(
          (order) => ({ ok: true as const, order }),
          (err: unknown) => ({ ok: false as const, err }),
        ),
      ),
    )

    const wins = results.filter((r) => r.ok)
    const losses = results.filter((r) => !r.ok)
    expect(wins).toHaveLength(5)
    expect(losses).toHaveLength(5)
    for (const loss of losses) {
      if (!loss.ok) {
        expect((loss.err as DomainError).code).toBe('INSUFFICIENT_STOCK')
      }
    }

    const stock = await svc.checkInventory(product.id)
    expect(stock.reserved).toBe(5)
    expect(availableQty(stock)).toBe(0)
  })
})
