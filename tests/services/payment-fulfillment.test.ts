import { describe, expect, it } from 'vitest'
import { MemoryRepository } from '../../src/repo/json-repository.js'
import { CommerceService } from '../../src/services/commerce.js'
import { DomainError } from '../../src/domain/errors.js'
import { DEFAULT_RESERVATION_TTL_MS } from '../../src/domain/inventory.js'

async function seedService(onHand = 10) {
  const repo = new MemoryRepository()
  const svc = new CommerceService(repo)
  const product = await svc.upsertProduct(
    {
      sku: 'FUL-TEE',
      name: 'Fulfillment Tee',
      priceCents: 2_000,
      tags: ['apparel'],
      agentNotes: 'W3 fulfillment fixture.',
    },
    'ful-seed-product',
  )
  await svc.adjustStock(product.id, onHand, 'ful-seed-stock')
  return { svc, product, repo }
}

async function placeUnpaid(svc: CommerceService, productId: string, qty = 1) {
  const cart = await svc.createCart('cust_ful', `cart-${Math.random().toString(36).slice(2)}`)
  await svc.addItem(cart.id, productId, qty, `add-${cart.id}`)
  const order = await svc.placeOrder(cart.id, `ord-${cart.id}`)
  return order
}

describe('payment webhook idempotency', () => {
  it('captures via webhook and replays the same eventId without double commit', async () => {
    const { svc, product, repo } = await seedService(5)
    const order = await placeUnpaid(svc, product.id, 2)

    const first = await svc.handlePaymentWebhook({
      eventId: 'evt_pay_1',
      type: 'payment.captured',
      orderId: order.id,
      amountCents: order.totalCents,
    })
    expect(first.replayed).toBe(false)
    expect(first.order.status).toBe('paid')
    expect(first.payment.status).toBe('captured')
    expect(first.payment.webhookEventId).toBe('evt_pay_1')

    const stockAfter = await svc.checkInventory(product.id)
    expect(stockAfter.onHand).toBe(3)
    expect(stockAfter.reserved).toBe(0)

    const second = await svc.handlePaymentWebhook({
      eventId: 'evt_pay_1',
      type: 'payment.captured',
      orderId: order.id,
      amountCents: order.totalCents,
    })
    expect(second.replayed).toBe(true)
    expect(second.payment.id).toBe(first.payment.id)
    expect(second.order.id).toBe(first.order.id)

    const db = await repo.read()
    expect(db.payments.filter((p) => p.orderId === order.id)).toHaveLength(1)
    expect((await svc.checkInventory(product.id)).onHand).toBe(3)
  })

  it('rejects reused eventId with a different payload', async () => {
    const { svc, product } = await seedService(3)
    const order = await placeUnpaid(svc, product.id, 1)
    await svc.handlePaymentWebhook({
      eventId: 'evt_conflict',
      type: 'payment.captured',
      orderId: order.id,
    })
    await expect(
      svc.handlePaymentWebhook({
        eventId: 'evt_conflict',
        type: 'payment.failed',
        orderId: order.id,
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSE' })
  })

  it('records payment.failed without changing order or stock', async () => {
    const { svc, product } = await seedService(4)
    const order = await placeUnpaid(svc, product.id, 1)
    const result = await svc.handlePaymentWebhook({
      eventId: 'evt_fail_1',
      type: 'payment.failed',
      orderId: order.id,
    })
    expect(result.payment.status).toBe('failed')
    expect(result.order.status).toBe('created')
    const stock = await svc.checkInventory(product.id)
    expect(stock.reserved).toBe(1)
    expect(stock.onHand).toBe(4)
  })
})

describe('reservation auto-release on timeout', () => {
  it('releases expired holds and cancels the unpaid order', async () => {
    const { svc, product, repo } = await seedService(5)
    const order = await placeUnpaid(svc, product.id, 2)
    expect((await svc.checkInventory(product.id)).reserved).toBe(2)

    const db = await repo.read()
    const rsv = db.reservations.find((r) => r.id === order.reservationIds[0]!)
    expect(rsv?.expiresAt).toBeTruthy()
    const createdAt = new Date(rsv!.createdAt).getTime()
    const expiresAt = new Date(rsv!.expiresAt).getTime()
    expect(expiresAt - createdAt).toBe(DEFAULT_RESERVATION_TTL_MS)

    const past = new Date(expiresAt + 1_000)
    const released = await svc.releaseExpiredReservations(past)
    expect(released.releasedReservationIds).toEqual(
      expect.arrayContaining(order.reservationIds),
    )
    expect(released.cancelledOrderIds).toContain(order.id)

    const cancelled = await svc.getOrder(order.id)
    expect(cancelled.status).toBe('cancelled')
    const stock = await svc.checkInventory(product.id)
    expect(stock.reserved).toBe(0)
    expect(stock.onHand).toBe(5)

    // Idempotent second sweep
    const again = await svc.releaseExpiredReservations(past)
    expect(again.releasedReservationIds).toHaveLength(0)
    expect(again.cancelledOrderIds).toHaveLength(0)
  })

  it('does not release holds that are still within TTL', async () => {
    const { svc, product } = await seedService(3)
    const order = await placeUnpaid(svc, product.id, 1)
    const result = await svc.releaseExpiredReservations(new Date())
    expect(result.releasedReservationIds).toHaveLength(0)
    expect((await svc.getOrder(order.id)).status).toBe('created')
    expect((await svc.checkInventory(product.id)).reserved).toBe(1)
  })

  it('does not touch committed reservations after payment', async () => {
    const { svc, product } = await seedService(3)
    const order = await placeUnpaid(svc, product.id, 1)
    await svc.payOrder(order.id, 'pay-before-expire')
    const farFuture = new Date(Date.now() + DEFAULT_RESERVATION_TTL_MS * 10)
    const result = await svc.releaseExpiredReservations(farFuture)
    expect(result.cancelledOrderIds).toHaveLength(0)
    expect((await svc.getOrder(order.id)).status).toBe('paid')
    expect((await svc.checkInventory(product.id)).onHand).toBe(2)
  })
})

describe('ship / receive / refund closed loop', () => {
  it('completes paid → ship → receive → refund with restock', async () => {
    const { svc, product } = await seedService(4)
    const order = await placeUnpaid(svc, product.id, 1)

    const paid = await svc.handlePaymentWebhook({
      eventId: 'evt_loop_pay',
      type: 'payment.captured',
      orderId: order.id,
    })
    expect(paid.order.status).toBe('paid')

    const shipped = await svc.shipOrder(order.id, 'ship-loop-1')
    expect(shipped.status).toBe('shipped')

    const received = await svc.receiveOrder(order.id, 'recv-loop-1')
    expect(received.status).toBe('delivered')

    const requested = await svc.requestReturn(order.id, 'not as described', 'ret-loop-1')
    const refunded = await svc.approveReturn(requested.return.id, 'ret-loop-approve')
    expect(refunded.order.status).toBe('refunded')
    expect(refunded.payment.status).toBe('refunded')
    expect(refunded.return.status).toBe('refunded')
    expect((await svc.checkInventory(product.id)).onHand).toBe(4)
  })

  it('allows refund after ship without receive', async () => {
    const { svc, product } = await seedService(3)
    const order = await placeUnpaid(svc, product.id, 1)
    await svc.payOrder(order.id, 'pay-ship-refund')
    await svc.shipOrder(order.id, 'ship-only-1')
    const requested = await svc.requestReturn(order.id, 'damaged in transit', 'ret-ship-1')
    const result = await svc.approveReturn(requested.return.id, 'ret-ship-approve')
    expect(result.order.status).toBe('refunded')
    expect((await svc.checkInventory(product.id)).onHand).toBe(3)
  })

  it('rejects receive before ship', async () => {
    const { svc, product } = await seedService(2)
    const order = await placeUnpaid(svc, product.id, 1)
    await svc.payOrder(order.id, 'pay-no-ship')
    await expect(svc.receiveOrder(order.id, 'recv-early')).rejects.toBeInstanceOf(DomainError)
    await expect(svc.receiveOrder(order.id, 'recv-early-2')).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    })
  })

  it('replays receive Idempotency-Key', async () => {
    const { svc, product } = await seedService(2)
    const order = await placeUnpaid(svc, product.id, 1)
    await svc.payOrder(order.id, 'pay-recv-ik')
    await svc.shipOrder(order.id, 'ship-recv-ik')
    const a = await svc.receiveOrder(order.id, 'same-recv-key')
    const b = await svc.receiveOrder(order.id, 'same-recv-key')
    expect(b.id).toBe(a.id)
    expect(b.status).toBe('delivered')
  })
})
