import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAppServer, type AppServer } from '../../src/server/create-server.js'
import { MemoryRepository } from '../../src/repo/json-repository.js'

type Json = Record<string, unknown>

async function api(
  baseUrl: string,
  method: string,
  path: string,
  opts: {
    token?: string | null
    body?: unknown
    idempotencyKey?: string
  } = {},
): Promise<{ status: number; json: Json }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (opts.token !== null) {
    headers.authorization = `Bearer ${opts.token ?? 'customer-token'}`
  }
  if (opts.idempotencyKey) {
    headers['idempotency-key'] = opts.idempotencyKey
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  const json = text ? (JSON.parse(text) as Json) : {}
  return { status: res.status, json }
}

describe('HTTP API integration', () => {
  let app: AppServer
  let baseUrl: string
  let productId: string

  beforeAll(async () => {
    app = createAppServer({ repo: new MemoryRepository() })
    ;({ baseUrl } = await app.listen(0))

    // Seed via merchant API
    const created = await api(baseUrl, 'POST', '/api/merchant/products', {
      token: 'merchant-token',
      idempotencyKey: 'seed-prod',
      body: {
        sku: 'MUG-01',
        name: 'Agent Mug',
        priceCents: 2_500,
        tags: ['kitchen'],
        agentNotes: 'Ceramic mug; agents should buy qty 1–4.',
      },
    })
    expect(created.status).toBe(200)
    productId = created.json.id as string

    const stock = await api(baseUrl, 'POST', `/api/merchant/products/${productId}/stock`, {
      token: 'merchant-token',
      idempotencyKey: 'seed-stock',
      body: { delta: 5 },
    })
    expect(stock.status).toBe(200)

    const promo = await api(baseUrl, 'POST', '/api/merchant/promotions', {
      token: 'merchant-token',
      idempotencyKey: 'seed-promo',
      body: {
        code: 'SAVE200',
        type: 'coupon_fixed',
        offCents: 200,
        active: true,
      },
    })
    expect(promo.status).toBe(200)
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns 401 when unauthorized', async () => {
    const res = await api(baseUrl, 'GET', '/api/customer/products', { token: null })
    expect(res.status).toBe(401)
    expect(res.json).toMatchObject({
      code: 'UNAUTHORIZED',
      retryable: false,
    })

    const bad = await api(baseUrl, 'GET', '/api/customer/products', { token: 'nope' })
    expect(bad.status).toBe(401)
  })

  it('places an order end-to-end via customer API', async () => {
    const cart = await api(baseUrl, 'POST', '/api/customer/carts', {
      idempotencyKey: 'cart-1',
      body: { customerId: 'cust_e2e' },
    })
    expect(cart.status).toBe(200)
    const cartId = cart.json.id as string

    const added = await api(baseUrl, 'POST', `/api/customer/carts/${cartId}/items`, {
      idempotencyKey: 'add-1',
      body: { productId, quantity: 2 },
    })
    expect(added.status).toBe(200)

    const promo = await api(baseUrl, 'POST', `/api/customer/carts/${cartId}/promotion`, {
      idempotencyKey: 'promo-1',
      body: { code: 'SAVE200' },
    })
    expect(promo.status).toBe(200)

    const quote = await api(baseUrl, 'GET', `/api/customer/carts/${cartId}/quote`)
    expect(quote.status).toBe(200)
    expect(quote.json.totalCents).toBe(2_500 * 2 - 200)

    const order = await api(baseUrl, 'POST', '/api/customer/orders', {
      idempotencyKey: 'order-1',
      body: { cartId },
    })
    expect(order.status).toBe(200)
    expect(order.json.status).toBe('created')

    const paid = await api(baseUrl, 'POST', `/api/customer/orders/${order.json.id}/pay`, {
      idempotencyKey: 'pay-1',
    })
    expect(paid.status).toBe(200)
    expect((paid.json.order as Json).status).toBe('paid')
  })

  it('replays identical Idempotency-Key on place order', async () => {
    const cart = await api(baseUrl, 'POST', '/api/customer/carts', {
      idempotencyKey: 'cart-idem',
      body: {},
    })
    const cartId = cart.json.id as string
    await api(baseUrl, 'POST', `/api/customer/carts/${cartId}/items`, {
      idempotencyKey: 'add-idem',
      body: { productId, quantity: 1 },
    })

    const first = await api(baseUrl, 'POST', '/api/customer/orders', {
      idempotencyKey: 'order-idem-same',
      body: { cartId },
    })
    const second = await api(baseUrl, 'POST', '/api/customer/orders', {
      idempotencyKey: 'order-idem-same',
      body: { cartId },
    })
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.json.id).toBe(first.json.id)
  })

  it('rejects oversell with structured error', async () => {
    // Drain remaining stock via agent placeOrder loops
    const inv = await api(baseUrl, 'GET', `/api/customer/inventory/${productId}`)
    const available = inv.json.available as number

    if (available > 0) {
      const cart = await api(baseUrl, 'POST', '/api/agent/carts', {
        token: 'agent-token',
        idempotencyKey: 'drain-cart',
        body: {},
      })
      await api(baseUrl, 'POST', `/api/agent/carts/${cart.json.id}/items`, {
        token: 'agent-token',
        idempotencyKey: 'drain-add',
        body: { productId, quantity: available },
      })
      await api(baseUrl, 'POST', '/api/agent/orders', {
        token: 'agent-token',
        idempotencyKey: 'drain-order',
        body: { cartId: cart.json.id },
      })
    }

    const cart2 = await api(baseUrl, 'POST', '/api/agent/carts', {
      token: 'agent-token',
      idempotencyKey: 'oversell-cart',
      body: {},
    })
    const add = await api(baseUrl, 'POST', `/api/agent/carts/${cart2.json.id}/items`, {
      token: 'agent-token',
      idempotencyKey: 'oversell-add',
      body: { productId, quantity: 1 },
    })
    expect(add.status).toBe(409)
    expect(add.json).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      retryable: false,
    })
  })

  it('lists available on agent products and rejects add-to-cart when available=0 with 409', async () => {
    const created = await api(baseUrl, 'POST', '/api/merchant/products', {
      token: 'merchant-token',
      idempotencyKey: 'oos-prod',
      body: {
        sku: 'OOS-01',
        name: 'Out Of Stock Widget',
        priceCents: 900,
        tags: ['test'],
        agentNotes: 'Zero-stock fixture for available field.',
      },
    })
    expect(created.status).toBe(200)
    const oosId = created.json.id as string
    // Product create seeds stock at onHand=0 — do not adjust up.

    const listed = await api(baseUrl, 'GET', '/api/agent/products?q=Out%20Of%20Stock', {
      token: 'agent-token',
    })
    expect(listed.status).toBe(200)
    expect(listed.json).toMatchObject({
      items: expect.any(Array),
      nextCursor: null,
      hasMore: false,
    })
    const items = listed.json.items as Array<Record<string, unknown>>
    const row = items.find((p) => p.id === oosId)
    expect(row).toBeTruthy()
    expect(row).toMatchObject({ available: 0 })

    const customerList = await api(baseUrl, 'GET', '/api/customer/products?q=Out%20Of%20Stock')
    expect(customerList.status).toBe(200)
    expect(customerList.json).toMatchObject({
      items: expect.any(Array),
      nextCursor: null,
      hasMore: false,
    })
    const customerItems = customerList.json.items as Array<Record<string, unknown>>
    expect(customerItems.find((p) => p.id === oosId)).toMatchObject({ available: 0 })

    const cart = await api(baseUrl, 'POST', '/api/agent/carts', {
      token: 'agent-token',
      idempotencyKey: 'oos-cart',
      body: {},
    })
    expect(cart.status).toBe(200)
    const add = await api(baseUrl, 'POST', `/api/agent/carts/${cart.json.id}/items`, {
      token: 'agent-token',
      idempotencyKey: 'oos-add',
      body: { productId: oosId, quantity: 1 },
    })
    expect(add.status).toBe(409)
    expect(add.json).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      retryable: false,
    })
  })

  it('exposes openapi.json without auth', async () => {
    const res = await fetch(`${baseUrl}/openapi.json`)
    expect(res.status).toBe(200)
    const doc = (await res.json()) as { openapi: string }
    expect(doc.openapi).toBe('3.1.0')
  })

  it('handles payment webhook idempotently and closes ship→receive→refund', async () => {
    // Fresh SKU so prior tests' stock drain does not interfere.
    const created = await api(baseUrl, 'POST', '/api/merchant/products', {
      token: 'merchant-token',
      idempotencyKey: 'webhook-prod',
      body: {
        sku: 'WH-01',
        name: 'Webhook Widget',
        priceCents: 1_500,
        tags: ['test'],
        agentNotes: 'Webhook path fixture.',
      },
    })
    expect(created.status).toBe(200)
    const pid = created.json.id as string
    await api(baseUrl, 'POST', `/api/merchant/products/${pid}/stock`, {
      token: 'merchant-token',
      idempotencyKey: 'webhook-stock',
      body: { delta: 3 },
    })

    const cart = await api(baseUrl, 'POST', '/api/customer/carts', {
      idempotencyKey: 'webhook-cart',
      body: { customerId: 'cust_webhook' },
    })
    await api(baseUrl, 'POST', `/api/customer/carts/${cart.json.id}/items`, {
      idempotencyKey: 'webhook-add',
      body: { productId: pid, quantity: 1 },
    })
    const order = await api(baseUrl, 'POST', '/api/customer/orders', {
      idempotencyKey: 'webhook-order',
      body: { cartId: cart.json.id },
    })
    expect(order.status).toBe(200)

    const hook = await api(baseUrl, 'POST', '/api/webhooks/payment', {
      token: 'merchant-token',
      body: {
        eventId: 'evt_api_1',
        type: 'payment.captured',
        orderId: order.json.id,
      },
    })
    expect(hook.status).toBe(200)
    expect((hook.json.order as Json).status).toBe('paid')
    expect(hook.json.replayed).toBe(false)

    const replay = await api(baseUrl, 'POST', '/api/webhooks/payment', {
      token: 'merchant-token',
      body: {
        eventId: 'evt_api_1',
        type: 'payment.captured',
        orderId: order.json.id,
      },
    })
    expect(replay.status).toBe(200)
    expect(replay.json.replayed).toBe(true)

    const ship = await api(baseUrl, 'POST', `/api/merchant/orders/${order.json.id}/ship`, {
      token: 'merchant-token',
      idempotencyKey: 'webhook-ship',
    })
    expect(ship.status).toBe(200)
    expect(ship.json.status).toBe('shipped')

    const receive = await api(baseUrl, 'POST', `/api/customer/orders/${order.json.id}/receive`, {
      idempotencyKey: 'webhook-receive',
    })
    expect(receive.status).toBe(200)
    expect(receive.json.status).toBe('delivered')

    const ret = await api(baseUrl, 'POST', `/api/customer/orders/${order.json.id}/returns`, {
      idempotencyKey: 'webhook-return',
      body: { reason: 'changed mind' },
    })
    expect(ret.status).toBe(200)
    expect((ret.json.return as Json).status).toBe('requested')
    expect((ret.json.order as Json).status).toBe('delivered')

    const approved = await api(
      baseUrl,
      'POST',
      `/api/merchant/returns/${(ret.json.return as Json).id}/approve`,
      {
        token: 'merchant-token',
        idempotencyKey: 'webhook-return-approve',
      },
    )
    expect(approved.status).toBe(200)
    expect((approved.json.order as Json).status).toBe('refunded')
  })

  it('exposes release-expired reservations endpoint', async () => {
    const res = await api(baseUrl, 'POST', '/api/merchant/reservations/release-expired', {
      token: 'merchant-token',
    })
    expect(res.status).toBe(200)
    expect(res.json).toMatchObject({
      releasedReservationIds: expect.any(Array),
      cancelledOrderIds: expect.any(Array),
    })
  })

  it('creates product with stock as initial onHand and rejects unknown fields', async () => {
    const created = await api(baseUrl, 'POST', '/api/merchant/products', {
      token: 'merchant-token',
      idempotencyKey: 'stock-prod-1',
      body: {
        sku: 'STOCK-01',
        name: 'Stocked Widget',
        priceCents: 1_000,
        stock: 7,
      },
    })
    expect(created.status).toBe(200)
    expect(created.json.onHand).toBe(7)
    expect(created.json.available).toBe(7)

    const listed = await api(baseUrl, 'GET', '/api/merchant/products?activeOnly=false', {
      token: 'merchant-token',
    })
    expect(listed.status).toBe(200)
    expect(listed.json).toMatchObject({
      items: expect.any(Array),
      nextCursor: null,
      hasMore: false,
    })
    const row = (listed.json.items as Json[]).find((p) => p.sku === 'STOCK-01')
    expect(row).toBeTruthy()
    expect(row).toMatchObject({ onHand: 7, reserved: 0, available: 7 })

    const inv = await api(baseUrl, 'GET', `/api/merchant/inventory/${created.json.id}`, {
      token: 'merchant-token',
    })
    expect(inv.status).toBe(200)
    expect(inv.json).toMatchObject({ onHand: 7, available: 7, reserved: 0 })

    const omitted = await api(baseUrl, 'POST', '/api/merchant/products', {
      token: 'merchant-token',
      idempotencyKey: 'stock-prod-default',
      body: {
        sku: 'STOCK-00',
        name: 'Zero Default',
        priceCents: 500,
      },
    })
    expect(omitted.status).toBe(200)
    expect(omitted.json.onHand).toBe(0)

    const unknown = await api(baseUrl, 'POST', '/api/merchant/products', {
      token: 'merchant-token',
      idempotencyKey: 'stock-prod-unknown',
      body: {
        sku: 'STOCK-BAD',
        name: 'Bad',
        priceCents: 100,
        onHand: 9,
      },
    })
    expect(unknown.status).toBe(400)
    expect(unknown.json).toMatchObject({
      code: 'UNKNOWN_FIELD',
      retryable: false,
    })
    expect(String(unknown.json.hint)).toContain('onHand')
  })

  it('places order after creating product with stock (no separate restock)', async () => {
    const created = await api(baseUrl, 'POST', '/api/merchant/products', {
      token: 'merchant-token',
      idempotencyKey: 'stock-flow-prod',
      body: {
        sku: 'FLOW-01',
        name: 'Flow Widget',
        priceCents: 800,
        stock: 3,
      },
    })
    expect(created.status).toBe(200)
    expect(created.json.onHand).toBe(3)
    const pid = created.json.id as string

    const cart = await api(baseUrl, 'POST', '/api/customer/carts', {
      idempotencyKey: 'stock-flow-cart',
      body: { customerId: 'cust_stock_flow' },
    })
    expect(cart.status).toBe(200)

    const added = await api(baseUrl, 'POST', `/api/customer/carts/${cart.json.id}/items`, {
      idempotencyKey: 'stock-flow-add',
      body: { productId: pid, quantity: 2 },
    })
    expect(added.status).toBe(200)

    const order = await api(baseUrl, 'POST', '/api/customer/orders', {
      idempotencyKey: 'stock-flow-order',
      body: { cartId: cart.json.id },
    })
    expect(order.status).toBe(200)
    expect(order.json.status).toBe('created')
  })

  it('merchant product list includes stock fields; available decreases after order', async () => {
    const created = await api(baseUrl, 'POST', '/api/merchant/products', {
      token: 'merchant-token',
      idempotencyKey: 'mlist-stock-prod',
      body: {
        sku: 'MLIST-01',
        name: 'Merchant List Stock Widget',
        priceCents: 1_200,
        stock: 5,
      },
    })
    expect(created.status).toBe(200)
    const pid = created.json.id as string

    const before = await api(baseUrl, 'GET', '/api/merchant/products?activeOnly=false', {
      token: 'merchant-token',
    })
    expect(before.status).toBe(200)
    expect(before.json).toMatchObject({
      items: expect.any(Array),
      nextCursor: null,
      hasMore: false,
    })
    const beforeRow = (before.json.items as Json[]).find((p) => p.id === pid)
    expect(beforeRow).toMatchObject({
      onHand: 5,
      reserved: 0,
      available: 5,
    })

    const cart = await api(baseUrl, 'POST', '/api/customer/carts', {
      idempotencyKey: 'mlist-stock-cart',
      body: { customerId: 'cust_mlist_stock' },
    })
    expect(cart.status).toBe(200)
    const added = await api(baseUrl, 'POST', `/api/customer/carts/${cart.json.id}/items`, {
      idempotencyKey: 'mlist-stock-add',
      body: { productId: pid, quantity: 2 },
    })
    expect(added.status).toBe(200)
    const order = await api(baseUrl, 'POST', '/api/customer/orders', {
      idempotencyKey: 'mlist-stock-order',
      body: { cartId: cart.json.id },
    })
    expect(order.status).toBe(200)
    expect(order.json.status).toBe('created')

    const after = await api(baseUrl, 'GET', '/api/merchant/products?activeOnly=false', {
      token: 'merchant-token',
    })
    expect(after.status).toBe(200)
    const afterRow = (after.json.items as Json[]).find((p) => p.id === pid)
    expect(afterRow).toMatchObject({
      onHand: 5,
      reserved: 2,
      available: 3,
    })
    expect(afterRow!.available as number).toBeLessThan(beforeRow!.available as number)
  })
})
