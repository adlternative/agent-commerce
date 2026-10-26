import { z } from 'zod'
import type { CommerceService } from '../services/commerce.js'
import type { Router } from './router.js'
import { DomainError } from '../domain/errors.js'
import { PromotionSchema } from '../domain/promotion.js'
import { UpsertProductInputSchema } from '../domain/product.js'

function requireKey(key: string | undefined): string {
  if (!key) {
    throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required', {
      hint: 'send Idempotency-Key on every write',
    })
  }
  return key
}

const AddItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
})

const UpdateItemSchema = z.object({
  quantity: z.number().int().nonnegative(),
})

const PromoCodeSchema = z.object({
  code: z.string().min(1),
})

const AdjustStockSchema = z.object({
  delta: z.number().int(),
})

const ReturnSchema = z.object({
  reason: z.string().min(1),
})

const CreateCartSchema = z
  .object({
    customerId: z.string().min(1).optional(),
  })
  .optional()

/**
 * Register customer / merchant / agent route groups on the shared router.
 * Agent routes mirror customer shopping + a subset of merchant ops for LLM tools.
 */
export function registerRoutes(router: Router, commerce: CommerceService): void {
  // ── Customer ──────────────────────────────────────────────
  router.on('GET', '/api/customer/products', ['customer', 'agent'], async (ctx) => {
    return commerce.listProducts({
      q: ctx.query.get('q') ?? undefined,
      tag: ctx.query.get('tag') ?? undefined,
    })
  })

  router.on('GET', '/api/customer/products/:id', ['customer', 'agent'], async (ctx) => {
    return commerce.getProduct(ctx.params.id!)
  })

  router.on('GET', '/api/customer/inventory/:productId', ['customer', 'agent'], async (ctx) => {
    return commerce.checkInventory(ctx.params.productId!)
  })

  router.on('POST', '/api/customer/carts', ['customer', 'agent'], async (ctx) => {
    const body = CreateCartSchema.parse(ctx.body ?? {})
    const customerId =
      body?.customerId ??
      (ctx.actor.role === 'customer' ? ctx.actor.subject : 'agent_shopper')
    return commerce.createCart(customerId, requireKey(ctx.idempotencyKey))
  })

  router.on('GET', '/api/customer/carts/:id', ['customer', 'agent'], async (ctx) => {
    return commerce.getCart(ctx.params.id!)
  })

  router.on('POST', '/api/customer/carts/:id/items', ['customer', 'agent'], async (ctx) => {
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
    ['customer', 'agent'],
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
    ['customer', 'agent'],
    async (ctx) => {
      return commerce.removeItem(
        ctx.params.id!,
        ctx.params.productId!,
        requireKey(ctx.idempotencyKey),
      )
    },
  )

  router.on('POST', '/api/customer/carts/:id/promotion', ['customer', 'agent'], async (ctx) => {
    const body = PromoCodeSchema.parse(ctx.body)
    return commerce.applyPromotion(ctx.params.id!, body.code, requireKey(ctx.idempotencyKey))
  })

  router.on('GET', '/api/customer/carts/:id/quote', ['customer', 'agent'], async (ctx) => {
    return commerce.quoteCart(ctx.params.id!)
  })

  router.on('POST', '/api/customer/orders', ['customer', 'agent'], async (ctx) => {
    const body = z.object({ cartId: z.string().min(1) }).parse(ctx.body)
    return commerce.placeOrder(body.cartId, requireKey(ctx.idempotencyKey))
  })

  router.on('GET', '/api/customer/orders/:id', ['customer', 'agent'], async (ctx) => {
    return commerce.getOrder(ctx.params.id!)
  })

  router.on('POST', '/api/customer/orders/:id/pay', ['customer', 'agent'], async (ctx) => {
    return commerce.payOrder(ctx.params.id!, requireKey(ctx.idempotencyKey))
  })

  router.on('POST', '/api/customer/orders/:id/cancel', ['customer', 'agent'], async (ctx) => {
    return commerce.cancelOrder(ctx.params.id!, requireKey(ctx.idempotencyKey))
  })

  router.on('POST', '/api/customer/orders/:id/returns', ['customer', 'agent'], async (ctx) => {
    const body = ReturnSchema.parse(ctx.body)
    return commerce.requestReturn(
      ctx.params.id!,
      body.reason,
      requireKey(ctx.idempotencyKey),
    )
  })

  // ── Merchant ──────────────────────────────────────────────
  router.on('GET', '/api/merchant/products', ['merchant', 'agent'], async (ctx) => {
    const db = await commerce.listProducts({
      q: ctx.query.get('q') ?? undefined,
      tag: ctx.query.get('tag') ?? undefined,
    })
    return db
  })

  router.on('POST', '/api/merchant/products', ['merchant', 'agent'], async (ctx) => {
    const body = UpsertProductInputSchema.parse(ctx.body)
    return commerce.upsertProduct(body, requireKey(ctx.idempotencyKey))
  })

  router.on('PUT', '/api/merchant/products/:id', ['merchant', 'agent'], async (ctx) => {
    const body = UpsertProductInputSchema.parse({
      ...(ctx.body as object),
      id: ctx.params.id,
    })
    return commerce.upsertProduct(body, requireKey(ctx.idempotencyKey))
  })

  router.on(
    'POST',
    '/api/merchant/products/:id/stock',
    ['merchant', 'agent'],
    async (ctx) => {
      const body = AdjustStockSchema.parse(ctx.body)
      return commerce.adjustStock(
        ctx.params.id!,
        body.delta,
        requireKey(ctx.idempotencyKey),
      )
    },
  )

  router.on('GET', '/api/merchant/orders', ['merchant', 'agent'], async (ctx) => {
    const status = ctx.query.get('status') as
      | 'created'
      | 'paid'
      | 'shipped'
      | 'delivered'
      | 'cancelled'
      | 'refunded'
      | null
    return commerce.listOrders({
      customerId: ctx.query.get('customerId') ?? undefined,
      status: status ?? undefined,
    })
  })

  router.on('POST', '/api/merchant/orders/:id/ship', ['merchant', 'agent'], async (ctx) => {
    return commerce.shipOrder(ctx.params.id!, requireKey(ctx.idempotencyKey))
  })

  router.on('POST', '/api/merchant/orders/:id/deliver', ['merchant', 'agent'], async (ctx) => {
    return commerce.deliverOrder(ctx.params.id!, requireKey(ctx.idempotencyKey))
  })

  router.on('POST', '/api/merchant/promotions', ['merchant', 'agent'], async (ctx) => {
    const body = PromotionSchema.parse(ctx.body)
    return commerce.upsertPromotion(body, requireKey(ctx.idempotencyKey))
  })

  // ── Agent (aliases for LLM-friendly paths; same handlers) ─
  router.on('GET', '/api/agent/products', ['agent'], async (ctx) => {
    return commerce.listProducts({
      q: ctx.query.get('q') ?? undefined,
      tag: ctx.query.get('tag') ?? undefined,
    })
  })

  router.on('GET', '/api/agent/products/:id', ['agent'], async (ctx) => {
    return commerce.getProduct(ctx.params.id!)
  })

  router.on('GET', '/api/agent/inventory/:productId', ['agent'], async (ctx) => {
    return commerce.checkInventory(ctx.params.productId!)
  })

  router.on('POST', '/api/agent/carts', ['agent'], async (ctx) => {
    const body = CreateCartSchema.parse(ctx.body ?? {})
    return commerce.createCart(
      body?.customerId ?? ctx.actor.subject,
      requireKey(ctx.idempotencyKey),
    )
  })

  router.on('POST', '/api/agent/carts/:id/items', ['agent'], async (ctx) => {
    const body = AddItemSchema.parse(ctx.body)
    return commerce.addItem(
      ctx.params.id!,
      body.productId,
      body.quantity,
      requireKey(ctx.idempotencyKey),
    )
  })

  router.on('PATCH', '/api/agent/carts/:id/items/:productId', ['agent'], async (ctx) => {
    const body = UpdateItemSchema.parse(ctx.body)
    return commerce.updateItem(
      ctx.params.id!,
      ctx.params.productId!,
      body.quantity,
      requireKey(ctx.idempotencyKey),
    )
  })

  router.on('DELETE', '/api/agent/carts/:id/items/:productId', ['agent'], async (ctx) => {
    return commerce.removeItem(
      ctx.params.id!,
      ctx.params.productId!,
      requireKey(ctx.idempotencyKey),
    )
  })

  router.on('POST', '/api/agent/carts/:id/promotion', ['agent'], async (ctx) => {
    const body = PromoCodeSchema.parse(ctx.body)
    return commerce.applyPromotion(ctx.params.id!, body.code, requireKey(ctx.idempotencyKey))
  })

  router.on('GET', '/api/agent/carts/:id/quote', ['agent'], async (ctx) => {
    return commerce.quoteCart(ctx.params.id!)
  })

  router.on('POST', '/api/agent/orders', ['agent'], async (ctx) => {
    const body = z.object({ cartId: z.string().min(1) }).parse(ctx.body)
    return commerce.placeOrder(body.cartId, requireKey(ctx.idempotencyKey))
  })

  router.on('GET', '/api/agent/orders/:id', ['agent'], async (ctx) => {
    return commerce.getOrder(ctx.params.id!)
  })

  router.on('POST', '/api/agent/orders/:id/pay', ['agent'], async (ctx) => {
    return commerce.payOrder(ctx.params.id!, requireKey(ctx.idempotencyKey))
  })

  router.on('POST', '/api/agent/orders/:id/cancel', ['agent'], async (ctx) => {
    return commerce.cancelOrder(ctx.params.id!, requireKey(ctx.idempotencyKey))
  })

  router.on('POST', '/api/agent/orders/:id/returns', ['agent'], async (ctx) => {
    const body = ReturnSchema.parse(ctx.body)
    return commerce.requestReturn(
      ctx.params.id!,
      body.reason,
      requireKey(ctx.idempotencyKey),
    )
  })

  router.on('POST', '/api/agent/products', ['agent'], async (ctx) => {
    const body = UpsertProductInputSchema.parse(ctx.body)
    return commerce.upsertProduct(body, requireKey(ctx.idempotencyKey))
  })

  router.on('POST', '/api/agent/products/:id/stock', ['agent'], async (ctx) => {
    const body = AdjustStockSchema.parse(ctx.body)
    return commerce.adjustStock(ctx.params.id!, body.delta, requireKey(ctx.idempotencyKey))
  })

  router.on('GET', '/api/agent/orders', ['agent'], async (ctx) => {
    return commerce.listOrders({
      customerId: ctx.query.get('customerId') ?? undefined,
    })
  })
}
