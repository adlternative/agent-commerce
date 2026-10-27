import type { CommerceService } from '../services/commerce.js'
import type { Router } from './router.js'
import type { RequestContext } from './http.js'
import { DomainError } from '../domain/errors.js'
import { parseUpsertProductInput } from '../domain/product.js'
import { paginate, paginateStable } from '../ai/pagination.js'
import type { AuditLog } from '../ai/audit.js'
import {
  AddItemSchema,
  AdjustStockSchema,
  CreateCartSchema,
  CreateReturnBodySchema,
  PaymentWebhookBodySchema,
  PlaceOrderBodySchema,
  PromoCodeSchema,
  PromotionSchema,
  UpdateItemSchema,
} from './request-schemas.js'

function pageProducts<T extends { id: string }>(
  ranked: Array<{ product: T; score: number }>,
  query: URLSearchParams,
) {
  if (query.has('cursor') || query.has('limit')) {
    return paginateStable(
      ranked.map((h) => ({ item: h.product, score: h.score, id: h.product.id })),
      {
        cursor: query.get('cursor'),
        limit: query.get('limit') ? Number(query.get('limit')) : undefined,
      },
    )
  }
  // No limit/cursor → full result set, same envelope as paged responses.
  return {
    items: ranked.map((h) => h.product),
    nextCursor: null,
    hasMore: false,
  }
}

function pageList<T>(items: readonly T[], query: URLSearchParams) {
  if (query.has('cursor') || query.has('limit')) {
    return paginate(items, {
      cursor: query.get('cursor'),
      limit: query.get('limit') ? Number(query.get('limit')) : undefined,
    })
  }
  return { items: [...items], nextCursor: null, hasMore: false }
}

function requireKey(key: string | undefined): string {
  if (!key) {
    throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required', {
      hint: 'send Idempotency-Key on every write',
    })
  }
  return key
}

/**
 * Register customer / merchant / agent route groups on the shared router.
 * Agent shopping aliases require `agent:customer`; merchant-ops aliases require `agent:merchant`.
 * Bare agent role never grants merchant (or customer) access.
 */
export function registerRoutes(
  router: Router,
  commerce: CommerceService,
  deps: { audit?: AuditLog } = {},
): void {
  // ── Customer ──────────────────────────────────────────────
  router.on('GET', '/api/customer/products', ['customer', 'agent:customer'], async (ctx) => {
    const ranked = await commerce.rankProductsWithAvailability({
      q: ctx.query.get('q') ?? undefined,
      tag: ctx.query.get('tag') ?? undefined,
    })
    return pageProducts(ranked, ctx.query)
  })

  router.on('GET', '/api/customer/products/:id', ['customer', 'agent:customer'], async (ctx) => {
    return commerce.getProduct(ctx.params.id!)
  })

  router.on('GET', '/api/customer/inventory/:productId', ['customer', 'agent:customer'], async (ctx) => {
    return commerce.checkInventory(ctx.params.productId!)
  })

  router.on('POST', '/api/customer/carts', ['customer', 'agent:customer'], async (ctx) => {
    const body = CreateCartSchema.parse(ctx.body ?? {})
    const customerId =
      body?.customerId ??
      (ctx.actor.role === 'customer' ? ctx.actor.subject : 'agent_shopper')
    return commerce.createCart(customerId, requireKey(ctx.idempotencyKey))
  })

  router.on('GET', '/api/customer/carts/:id', ['customer', 'agent:customer'], async (ctx) => {
    return commerce.getCart(ctx.params.id!)
  })

  router.on('POST', '/api/customer/carts/:id/items', ['customer', 'agent:customer'], async (ctx) => {
    const body = AddItemSchema.parse(ctx.body)
    return commerce.addItem(
      ctx.params.id!,
      body.productId,
      body.quantity,
      requireKey(ctx.idempotencyKey),
    )
  })

  router.on(
    'PATCH',
    '/api/customer/carts/:id/items/:productId',
    ['customer', 'agent:customer'],
    async (ctx) => {
      const body = UpdateItemSchema.parse(ctx.body)
      return commerce.updateItem(
        ctx.params.id!,
        ctx.params.productId!,
        body.quantity,
        requireKey(ctx.idempotencyKey),
      )
    },
  )

  router.on(
    'DELETE',
    '/api/customer/carts/:id/items/:productId',
    ['customer', 'agent:customer'],
    async (ctx) => {
      return commerce.removeItem(
        ctx.params.id!,
        ctx.params.productId!,
        requireKey(ctx.idempotencyKey),
      )
    },
  )

  router.on('POST', '/api/customer/carts/:id/promotion', ['customer', 'agent:customer'], async (ctx) => {
    const body = PromoCodeSchema.parse(ctx.body)
    return commerce.applyPromotion(ctx.params.id!, body.code, requireKey(ctx.idempotencyKey))
  })

  router.on('GET', '/api/customer/carts/:id/quote', ['customer', 'agent:customer'], async (ctx) => {
    return commerce.quoteCart(ctx.params.id!)
  })

  router.on('POST', '/api/customer/orders', ['customer', 'agent:customer'], async (ctx) => {
    const body = PlaceOrderBodySchema.parse(ctx.body)
    return commerce.placeOrder(body.cartId, requireKey(ctx.idempotencyKey))
  })

  router.on('GET', '/api/customer/orders/:id', ['customer', 'agent:customer'], async (ctx) => {
    return commerce.getOrder(ctx.params.id!)
  })

  router.on('POST', '/api/customer/orders/:id/pay', ['customer', 'agent:customer'], async (ctx) => {
    return commerce.payOrder(ctx.params.id!, requireKey(ctx.idempotencyKey))
  })

  router.on('POST', '/api/customer/orders/:id/cancel', ['customer', 'agent:customer'], async (ctx) => {
    return commerce.cancelOrder(ctx.params.id!, requireKey(ctx.idempotencyKey))
  })

  router.on('POST', '/api/customer/orders/:id/receive', ['customer', 'agent:customer'], async (ctx) => {
    return commerce.receiveOrder(ctx.params.id!, requireKey(ctx.idempotencyKey))
  })

  router.on('POST', '/api/customer/orders/:id/returns', ['customer', 'agent:customer'], async (ctx) => {
    const body = CreateReturnBodySchema.parse(ctx.body)
    return commerce.requestReturn(
      ctx.params.id!,
      body.reason,
      requireKey(ctx.idempotencyKey),
      body.lines,
    )
  })

  // ── Payment webhooks (provider callbacks; idempotent on eventId) ─
  router.on('POST', '/api/webhooks/payment', ['merchant', 'agent:merchant'], async (ctx) => {
    const body = PaymentWebhookBodySchema.parse(ctx.body)
    return commerce.handlePaymentWebhook(body)
  })

  // ── Merchant ──────────────────────────────────────────────
  router.on('GET', '/api/merchant/metrics', ['merchant', 'agent:merchant'], async () => {
    return commerce.getMetrics()
  })

  router.on('GET', '/api/merchant/products', ['merchant', 'agent:merchant'], async (ctx) => {
    const products = await commerce.listProducts({
      q: ctx.query.get('q') ?? undefined,
      tag: ctx.query.get('tag') ?? undefined,
      activeOnly: ctx.query.get('activeOnly') !== 'false' ? true : false,
    })
    return pageList(products, ctx.query)
  })

  router.on('GET', '/api/merchant/inventory/:productId', ['merchant', 'agent:merchant'], async (ctx) => {
    return commerce.checkInventory(ctx.params.productId!)
  })

  router.on('POST', '/api/merchant/products', ['merchant', 'agent:merchant'], async (ctx) => {
    const body = parseUpsertProductInput(ctx.body)
    return commerce.upsertProduct(body, requireKey(ctx.idempotencyKey))
  })

  router.on('PUT', '/api/merchant/products/:id', ['merchant', 'agent:merchant'], async (ctx) => {
    const body = parseUpsertProductInput({
      ...(ctx.body as object),
      id: ctx.params.id,
    })
    return commerce.upsertProduct(body, requireKey(ctx.idempotencyKey))
  })

  router.on(
    'POST',
    '/api/merchant/products/:id/stock',
    ['merchant', 'agent:merchant'],
    async (ctx) => {
      const body = AdjustStockSchema.parse(ctx.body)
      return commerce.adjustStock(
        ctx.params.id!,
        body.delta,
        requireKey(ctx.idempotencyKey),
      )
    },
  )

  router.on('GET', '/api/merchant/orders', ['merchant', 'agent:merchant'], async (ctx) => {
    const status = ctx.query.get('status') as
      | 'created'
      | 'paid'
      | 'shipped'
      | 'delivered'
      | 'cancelled'
      | 'partially_refunded'
      | 'refunded'
      | null
    const orders = await commerce.listOrders({
      customerId: ctx.query.get('customerId') ?? undefined,
      status: status ?? undefined,
    })
    if (ctx.query.has('cursor') || ctx.query.has('limit')) {
      return paginate(orders, {
        cursor: ctx.query.get('cursor'),
        limit: ctx.query.get('limit') ? Number(ctx.query.get('limit')) : undefined,
      })
    }
    return orders
  })

  router.on('GET', '/api/merchant/returns', ['merchant', 'agent:merchant'], async (ctx) => {
    const status = ctx.query.get('status') as
      | 'requested'
      | 'approved'
      | 'rejected'
      | 'refunded'
      | null
    return commerce.listReturns({
      status: status ?? undefined,
      orderId: ctx.query.get('orderId') ?? undefined,
    })
  })

  router.on('POST', '/api/merchant/returns/:id/approve', ['merchant', 'agent:merchant'], async (ctx) => {
    return commerce.approveReturn(ctx.params.id!, requireKey(ctx.idempotencyKey))
  })

  router.on('POST', '/api/merchant/returns/:id/reject', ['merchant', 'agent:merchant'], async (ctx) => {
    return commerce.rejectReturn(ctx.params.id!, requireKey(ctx.idempotencyKey))
  })

  router.on('POST', '/api/merchant/orders/:id/ship', ['merchant', 'agent:merchant'], async (ctx) => {
    return commerce.shipOrder(ctx.params.id!, requireKey(ctx.idempotencyKey))
  })

  router.on('POST', '/api/merchant/orders/:id/deliver', ['merchant', 'agent:merchant'], async (ctx) => {
    return commerce.deliverOrder(ctx.params.id!, requireKey(ctx.idempotencyKey))
  })

  router.on('POST', '/api/merchant/orders/:id/receive', ['merchant', 'agent:merchant'], async (ctx) => {
    return commerce.receiveOrder(ctx.params.id!, requireKey(ctx.idempotencyKey))
  })

  router.on(
    'POST',
    '/api/merchant/reservations/release-expired',
    ['merchant', 'agent:merchant'],
    async () => {
      return commerce.releaseExpiredReservations()
    },
  )

  router.on('GET', '/api/merchant/promotions', ['merchant', 'agent:merchant'], async () => {
    return commerce.listPromotions()
  })

  router.on('POST', '/api/merchant/promotions', ['merchant', 'agent:merchant'], async (ctx) => {
    const body = PromotionSchema.parse(ctx.body)
    return commerce.upsertPromotion(body, requireKey(ctx.idempotencyKey))
  })

  // ── Audit query (agent + merchant) ───────────────────────
  const auditHandler = async (ctx: RequestContext) => {
    const limit = ctx.query.get('limit') ? Number(ctx.query.get('limit')) : undefined
    const statusRaw = ctx.query.get('status')
    const status = statusRaw !== null && statusRaw !== '' ? Number(statusRaw) : undefined
    const events =
      deps.audit?.query({
        limit,
        actor: ctx.query.get('actor') ?? undefined,
        role: ctx.query.get('role') ?? undefined,
        method: ctx.query.get('method') ?? undefined,
        pathPrefix: ctx.query.get('pathPrefix') ?? undefined,
        pathContains: ctx.query.get('pathContains') ?? undefined,
        status: status !== undefined && Number.isFinite(status) ? status : undefined,
        code: ctx.query.get('code') ?? undefined,
        traceId: ctx.query.get('traceId') ?? undefined,
        since: ctx.query.get('since') ?? undefined,
        until: ctx.query.get('until') ?? undefined,
      }) ?? []
    return { events, count: events.length }
  }

  router.on('GET', '/api/agent/audit', ['agent:merchant', 'merchant'], auditHandler)
  router.on('GET', '/api/merchant/audit', ['merchant', 'agent:merchant'], auditHandler)

  // ── Agent (aliases for LLM-friendly paths; same handlers) ─

  router.on('GET', '/api/agent/products', ['agent:customer'], async (ctx) => {
    const ranked = await commerce.rankProductsWithAvailability({
      q: ctx.query.get('q') ?? undefined,
      tag: ctx.query.get('tag') ?? undefined,
    })
    return pageProducts(ranked, ctx.query)
  })

  router.on('GET', '/api/agent/products/:id', ['agent:customer'], async (ctx) => {
    return commerce.getProduct(ctx.params.id!)
  })

  router.on('GET', '/api/agent/inventory/:productId', ['agent:customer'], async (ctx) => {
    return commerce.checkInventory(ctx.params.productId!)
  })

  router.on('POST', '/api/agent/carts', ['agent:customer'], async (ctx) => {
    const body = CreateCartSchema.parse(ctx.body ?? {})
    return commerce.createCart(
      body?.customerId ?? ctx.actor.subject,
      requireKey(ctx.idempotencyKey),
    )
  })

  router.on('POST', '/api/agent/carts/:id/items', ['agent:customer'], async (ctx) => {
    const body = AddItemSchema.parse(ctx.body)
    return commerce.addItem(
      ctx.params.id!,
      body.productId,
      body.quantity,
      requireKey(ctx.idempotencyKey),
    )
  })

  router.on('PATCH', '/api/agent/carts/:id/items/:productId', ['agent:customer'], async (ctx) => {
    const body = UpdateItemSchema.parse(ctx.body)
    return commerce.updateItem(
      ctx.params.id!,
      ctx.params.productId!,
      body.quantity,
      requireKey(ctx.idempotencyKey),
    )
  })

  router.on('DELETE', '/api/agent/carts/:id/items/:productId', ['agent:customer'], async (ctx) => {
    return commerce.removeItem(
      ctx.params.id!,
      ctx.params.productId!,
      requireKey(ctx.idempotencyKey),
    )
  })

  router.on('POST', '/api/agent/carts/:id/promotion', ['agent:customer'], async (ctx) => {
    const body = PromoCodeSchema.parse(ctx.body)
    return commerce.applyPromotion(ctx.params.id!, body.code, requireKey(ctx.idempotencyKey))
  })

  router.on('GET', '/api/agent/carts/:id/quote', ['agent:customer'], async (ctx) => {
    return commerce.quoteCart(ctx.params.id!)
  })

  router.on('POST', '/api/agent/orders', ['agent:customer'], async (ctx) => {
    const body = PlaceOrderBodySchema.parse(ctx.body)
    return commerce.placeOrder(body.cartId, requireKey(ctx.idempotencyKey))
  })

  router.on('GET', '/api/agent/orders/:id', ['agent:customer'], async (ctx) => {
    return commerce.getOrder(ctx.params.id!)
  })

  router.on('POST', '/api/agent/orders/:id/pay', ['agent:customer'], async (ctx) => {
    return commerce.payOrder(ctx.params.id!, requireKey(ctx.idempotencyKey))
  })

  router.on('POST', '/api/agent/orders/:id/cancel', ['agent:customer'], async (ctx) => {
    return commerce.cancelOrder(ctx.params.id!, requireKey(ctx.idempotencyKey))
  })

  router.on('POST', '/api/agent/orders/:id/returns', ['agent:customer'], async (ctx) => {
    const body = CreateReturnBodySchema.parse(ctx.body)
    return commerce.requestReturn(
      ctx.params.id!,
      body.reason,
      requireKey(ctx.idempotencyKey),
      body.lines,
    )
  })

  router.on('POST', '/api/agent/products', ['agent:merchant'], async (ctx) => {
    const body = parseUpsertProductInput(ctx.body)
    return commerce.upsertProduct(body, requireKey(ctx.idempotencyKey))
  })

  router.on('POST', '/api/agent/products/:id/stock', ['agent:merchant'], async (ctx) => {
    const body = AdjustStockSchema.parse(ctx.body)
    return commerce.adjustStock(ctx.params.id!, body.delta, requireKey(ctx.idempotencyKey))
  })

  router.on('GET', '/api/agent/orders', ['agent:merchant'], async (ctx) => {
    return commerce.listOrders({
      customerId: ctx.query.get('customerId') ?? undefined,
    })
  })
}
