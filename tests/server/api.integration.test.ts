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
    expect(add.status).toBe(400)
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
})
