import { ApiError } from './client.js'
import type { Order, Product, Stock } from './types.js'

export type Metrics = {
  gmvCents: number
  orderCount: number
  paidOrderCount: number
  outOfStockCount: number
}

export type Promotion =
  | {
      code: string
      type: 'threshold_off'
      thresholdCents: number
      offCents: number
      active: boolean
    }
  | {
      code: string
      type: 'coupon_percent'
      percentOff: number
      maxOffCents?: number
      active: boolean
    }
  | {
      code: string
      type: 'coupon_fixed'
      offCents: number
      active: boolean
    }

function newKey(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export function createMerchantApi(baseUrl = '') {
  async function request<T>(
    method: string,
    path: string,
    opts: { body?: unknown; idempotencyKey?: string } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      authorization: 'Bearer merchant-token',
    }
    if (opts.body !== undefined) headers['content-type'] = 'application/json'
    if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey
    const res = await fetch(`${baseUrl}${path}`, {
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
    metrics: () => request<Metrics>('GET', '/api/merchant/metrics'),
    listProducts: async () => {
      const page = await request<{ items: Product[] }>(
        'GET',
        '/api/merchant/products?activeOnly=false',
      )
      return page.items
    },
    upsertProduct: (body: Record<string, unknown>) =>
      request<Product>('POST', '/api/merchant/products', {
        body,
        idempotencyKey: newKey('m-prod'),
      }),
    adjustStock: (productId: string, delta: number) =>
      request<Stock>('POST', `/api/merchant/products/${productId}/stock`, {
        body: { delta },
        idempotencyKey: newKey('m-stock'),
      }),
    inventory: (productId: string) =>
      request<Stock>('GET', `/api/merchant/inventory/${productId}`),
    listOrders: () => request<Order[]>('GET', '/api/merchant/orders'),
    ship: (orderId: string) =>
      request<Order>('POST', `/api/merchant/orders/${orderId}/ship`, {
        idempotencyKey: newKey('m-ship'),
      }),
    deliver: (orderId: string) =>
      request<Order>('POST', `/api/merchant/orders/${orderId}/deliver`, {
        idempotencyKey: newKey('m-deliver'),
      }),
    upsertPromotion: (promo: Promotion) =>
      request<Promotion>('POST', '/api/merchant/promotions', {
        body: promo,
        idempotencyKey: newKey('m-promo'),
      }),
  }
}
