import type { Cart, CartQuote, Order, Product, ReturnLine, ReturnRequest, Stock } from './types.js'

export type ApiConfig = {
  baseUrl: string
  token: string
}

export class ApiError extends Error {
  readonly code: string
  readonly hint?: string
  readonly retryable: boolean
  readonly status: number

  constructor(status: number, body: { code: string; message: string; hint?: string; retryable?: boolean }) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.hint = body.hint
    this.retryable = body.retryable ?? false
  }
}

function newKey(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export function createApi(config: ApiConfig) {
  async function request<T>(
    method: string,
    path: string,
    opts: { body?: unknown; idempotencyKey?: string; token?: string } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${opts.token ?? config.token}`,
    }
    if (opts.body !== undefined) headers['content-type'] = 'application/json'
    if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey

    const res = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
    const text = await res.text()
    const json = text ? (JSON.parse(text) as Record<string, unknown>) : {}
    if (!res.ok) {
      throw new ApiError(res.status, {
        code: String(json.code ?? 'HTTP_ERROR'),
        message: String(json.message ?? res.statusText),
        hint: json.hint as string | undefined,
        retryable: Boolean(json.retryable),
      })
    }
    return json as T
  }

  return {
    newKey,
    listProducts: async (q?: string) => {
      const page = await request<{ items: Product[] }>(
        'GET',
        `/api/customer/products${q ? `?q=${encodeURIComponent(q)}` : ''}`,
      )
      return page.items
    },
    getProduct: (id: string) => request<Product>('GET', `/api/customer/products/${id}`),
    checkInventory: (productId: string) =>
      request<Stock>('GET', `/api/customer/inventory/${productId}`),
    createCart: (customerId: string) =>
      request<Cart>('POST', '/api/customer/carts', {
        body: { customerId },
        idempotencyKey: newKey('cart'),
      }),
    addItem: (cartId: string, productId: string, quantity: number) =>
      request<Cart>('POST', `/api/customer/carts/${cartId}/items`, {
        body: { productId, quantity },
        idempotencyKey: newKey('add'),
      }),
    applyPromotion: (cartId: string, code: string) =>
      request<Cart>('POST', `/api/customer/carts/${cartId}/promotion`, {
        body: { code },
        idempotencyKey: newKey('promo'),
      }),
    quoteCart: (cartId: string) => request<CartQuote>('GET', `/api/customer/carts/${cartId}/quote`),
    placeOrder: (cartId: string) =>
      request<Order>('POST', '/api/customer/orders', {
        body: { cartId },
        idempotencyKey: newKey('order'),
      }),
    payOrder: (orderId: string) =>
      request<{ order: Order }>('POST', `/api/customer/orders/${orderId}/pay`, {
        idempotencyKey: newKey('pay'),
      }),
    getOrder: (orderId: string) => request<Order>('GET', `/api/customer/orders/${orderId}`),
    requestReturn: (orderId: string, reason: string, lines: ReturnLine[]) =>
      request<{ return: ReturnRequest; order: Order }>(
        'POST',
        `/api/customer/orders/${orderId}/returns`,
        {
          body: { reason, lines },
          idempotencyKey: newKey('ret'),
        },
      ),
    /** Agent surface — same commerce service, used by the NL panel. */
    agent: {
      listProducts: async (q?: string) => {
        const page = await request<{ items: Product[] }>(
          'GET',
          `/api/agent/products${q ? `?q=${encodeURIComponent(q)}` : ''}`,
          { token: 'agent-token' },
        )
        return page.items
      },
      createCart: () =>
        request<Cart>('POST', '/api/agent/carts', {
          token: 'agent-token',
          body: { customerId: 'nl_shopper' },
          idempotencyKey: newKey('agent-cart'),
        }),
      addItem: (cartId: string, productId: string, quantity: number) =>
        request<Cart>('POST', `/api/agent/carts/${cartId}/items`, {
          token: 'agent-token',
          body: { productId, quantity },
          idempotencyKey: newKey('agent-add'),
        }),
      applyPromotion: (cartId: string, code: string) =>
        request<Cart>('POST', `/api/agent/carts/${cartId}/promotion`, {
          token: 'agent-token',
          body: { code },
          idempotencyKey: newKey('agent-promo'),
        }),
      quoteCart: (cartId: string) =>
        request<CartQuote>('GET', `/api/agent/carts/${cartId}/quote`, { token: 'agent-token' }),
      placeOrder: (cartId: string) =>
        request<Order>('POST', '/api/agent/orders', {
          token: 'agent-token',
          body: { cartId },
          idempotencyKey: newKey('agent-order'),
        }),
      payOrder: (orderId: string) =>
        request<{ order: Order }>('POST', `/api/agent/orders/${orderId}/pay`, {
          token: 'agent-token',
          idempotencyKey: newKey('agent-pay'),
        }),
      getOrder: (orderId: string) =>
        request<Order>('GET', `/api/agent/orders/${orderId}`, { token: 'agent-token' }),
    },
  }
}

export type CommerceApi = ReturnType<typeof createApi>
