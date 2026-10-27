/** OpenAPI 3.1 document for the three API surfaces — schemas from Zod single source. */
import type { ZodTypeAny } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { CartSchema } from '../domain/cart.js'
import { ErrorBodySchema } from '../domain/errors.js'
import { OrderSchema } from '../domain/order.js'
import { ProductSchema, ProductWithOptionalAvailableSchema } from '../domain/product.js'
import { PromotionSchema } from '../domain/promotion.js'
import { ReturnRequestSchema } from '../domain/return.js'
import { StockLevelSchema } from '../domain/inventory.js'
import { z } from 'zod'
import {
  AddItemSchema,
  AdjustStockSchema,
  CreateCartBodySchema,
  CreateReturnBodySchema,
  EmptyBodySchema,
  PaymentWebhookBodySchema,
  PlaceOrderBodySchema,
  PromoCodeSchema,
  UpdateItemSchema,
  UpsertProductInputSchema,
} from './request-schemas.js'

const bearer = [{ BearerAuth: [] }]
const apiKeyOrBearer = [{ BearerAuth: [] }, { ApiKeyAuth: [] }]

/** Convert router `:param` templates to OpenAPI `{param}` paths. */
export function routePathToOpenApi(path: string): string {
  return path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}')
}

function zodSchema(schema: ZodTypeAny, name?: string): Record<string, unknown> {
  const raw = zodToJsonSchema(schema, {
    target: 'openApi3',
    $refStrategy: 'none',
    ...(name ? { name } : {}),
  }) as Record<string, unknown>
  // zod-to-json-schema may wrap named schemas; unwrap $ref-only envelopes.
  const { $schema: _drop, ...rest } = raw
  return rest
}

function jsonBody(schema: Record<string, unknown>, required = true) {
  return {
    required,
    content: { 'application/json': { schema } },
  }
}

function zodBody(schema: ZodTypeAny, required = true) {
  return jsonBody(zodSchema(schema), required)
}

const emptyWriteBody = zodBody(EmptyBodySchema, false)

function ok(schema: Record<string, unknown>) {
  return {
    '200': {
      description: 'OK',
      content: { 'application/json': { schema } },
    },
    default: {
      description: 'Structured error',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/Error' } },
      },
    },
  }
}

const idParam = (name = 'id') => ({
  name,
  in: 'path' as const,
  required: true,
  schema: { type: 'string' },
})

const idempotencyParam = { $ref: '#/components/parameters/IdempotencyKey' }

const auditQueryParams = [
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500 } },
  { name: 'actor', in: 'query', schema: { type: 'string' } },
  { name: 'role', in: 'query', schema: { type: 'string', enum: ['customer', 'merchant', 'agent'] } },
  { name: 'method', in: 'query', schema: { type: 'string' } },
  { name: 'pathPrefix', in: 'query', schema: { type: 'string' } },
  { name: 'pathContains', in: 'query', schema: { type: 'string' } },
  { name: 'status', in: 'query', schema: { type: 'integer' } },
  { name: 'code', in: 'query', schema: { type: 'string' } },
  { name: 'traceId', in: 'query', schema: { type: 'string' } },
  { name: 'since', in: 'query', schema: { type: 'string', format: 'date-time' } },
  { name: 'until', in: 'query', schema: { type: 'string', format: 'date-time' } },
] as const

const auditResponse = ok({
  type: 'object',
  required: ['events', 'count'],
  properties: {
    count: { type: 'integer' },
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          at: { type: 'string' },
          actor: { type: 'string' },
          role: { type: 'string' },
          method: { type: 'string' },
          path: { type: 'string' },
          status: { type: 'integer' },
          code: { type: 'string' },
          durationMs: { type: 'number' },
          idempotencyKey: { type: 'string' },
          traceId: { type: 'string' },
        },
      },
    },
  },
})

const InventoryWithAvailableSchema = StockLevelSchema.extend({
  available: z.number().int().nonnegative(),
})

/** Shared cursor-page envelope for product lists (always — with or without limit). */
const productPageSchema = {
  type: 'object',
  required: ['items', 'nextCursor', 'hasMore'],
  description:
    'Always { items, nextCursor, hasMore }. Each Product item may include integer `available` (sellable qty) on customer/agent lists. Omit limit/cursor to return the full match set (nextCursor null). With limit (1–100, default 20 when paging) and optional cursor, returns one page.',
  properties: {
    items: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
    nextCursor: { type: 'string', nullable: true, description: 'Opaque cursor for the next page; null when no more' },
    hasMore: { type: 'boolean' },
  },
}

const productListPaginationParams = [
  {
    name: 'cursor',
    in: 'query',
    schema: { type: 'string' },
    description: 'Opaque pagination cursor from a previous nextCursor',
  },
  {
    name: 'limit',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    description:
      'Page size when paging (1–100; default 20). When omitted (and no cursor), all matching products are returned.',
  },
] as const

const orderListSchema = {
  type: 'array',
  items: { $ref: '#/components/schemas/Order' },
  description:
    'Bare order array by default. When cursor/limit are passed, response is { items, nextCursor, hasMore }.',
}

const quoteSchema = {
  type: 'object',
  properties: {
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          quantity: { type: 'integer' },
          unitPriceCents: { type: 'integer', description: 'Integer cents' },
          lineTotalCents: { type: 'integer', description: 'Integer cents' },
        },
      },
    },
    subtotalCents: { type: 'integer', description: 'Integer cents' },
    discountCents: { type: 'integer', description: 'Integer cents' },
    totalCents: { type: 'integer', description: 'Integer cents' },
    promotionCode: { type: 'string' },
  },
}

const releaseExpiredSchema = {
  type: 'object',
  properties: {
    releasedReservationIds: { type: 'array', items: { type: 'string' } },
    cancelledOrderIds: { type: 'array', items: { type: 'string' } },
  },
}

const metricsSchema = {
  type: 'object',
  properties: {
    orderCount: { type: 'integer' },
    gmvCents: { type: 'integer', description: 'Integer cents' },
    outOfStockCount: { type: 'integer' },
  },
}

type Op = Record<string, unknown>

function pathItem(ops: Record<string, Op>): Record<string, Op> {
  return ops
}

export function buildOpenApi() {
  const productRef = { $ref: '#/components/schemas/Product' }
  const orderRef = { $ref: '#/components/schemas/Order' }
  const cartRef = { $ref: '#/components/schemas/Cart' }
  const promoRef = { $ref: '#/components/schemas/Promotion' }
  const returnRef = { $ref: '#/components/schemas/Return' }
  const inventorySchema = zodSchema(InventoryWithAvailableSchema)

  const upsertProductBody = zodBody(UpsertProductInputSchema)
  // Annotate money fields for AI clients.
  const upsertSchema = upsertProductBody.content['application/json'].schema as Record<
    string,
    unknown
  >
  if (upsertSchema.properties && typeof upsertSchema.properties === 'object') {
    const props = upsertSchema.properties as Record<string, Record<string, unknown>>
    if (props.priceCents) {
      props.priceCents.description = 'Integer cents (分). Never floats.'
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Agent Commerce API',
      version: '0.3.0',
      description:
        'AI-native commerce HTTP API. Amounts are integer cents. Writes require Idempotency-Key. Component schemas are generated from Zod.',
    },
    servers: [{ url: 'http://localhost:8787' }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Opaque demo tokens (customer-token | merchant-token | agent-token [agent:customer] | agent-merchant-token [agent:merchant]) or HS256 JWT with claims { sub, role, scopes? }',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description:
            'customer-key | merchant-key | agent-key [agent:customer] | agent-merchant-key [agent:merchant] (or Authorization: ApiKey <key>)',
        },
      },
      parameters: {
        IdempotencyKey: {
          name: 'Idempotency-Key',
          in: 'header',
          required: true,
          schema: { type: 'string' },
        },
      },
      schemas: {
        Error: zodSchema(ErrorBodySchema, 'Error'),
        Product: zodSchema(ProductWithOptionalAvailableSchema, 'Product'),
        Order: zodSchema(OrderSchema, 'Order'),
        Cart: zodSchema(CartSchema, 'Cart'),
        Promotion: zodSchema(PromotionSchema, 'Promotion'),
        Return: zodSchema(ReturnRequestSchema, 'Return'),
      },
    },
    paths: {
      '/health': pathItem({
        get: {
          summary: 'Liveness (legacy alias of /healthz)',
          security: [],
          responses: ok({ type: 'object', properties: { ok: { type: 'boolean' } } }),
        },
      }),
      '/healthz': pathItem({
        get: {
          summary: 'Liveness probe (no auth)',
          security: [],
          responses: ok({ type: 'object', properties: { ok: { type: 'boolean' } } }),
        },
      }),
      '/readyz': pathItem({
        get: {
          summary: 'Readiness probe — verifies store is readable and writable (no auth)',
          security: [],
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
                },
              },
            },
            '503': {
              description: 'Store not ready',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      }),
      '/metrics': pathItem({
        get: {
          summary: 'Prometheus HTTP metrics',
          description:
            'Text exposition of http_requests_total and http_request_duration_ms_* counters. No auth.',
          security: [],
          responses: {
            '200': {
              description: 'Prometheus text exposition format 0.0.4',
              content: {
                'text/plain': {
                  schema: { type: 'string' },
                },
              },
            },
          },
        },
      }),
      '/openapi.json': pathItem({
        get: {
          summary: 'OpenAPI 3.1 document',
          security: [],
          responses: {
            '200': {
              description: 'OpenAPI document',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
          },
        },
      }),
      '/.well-known/ai-commerce.json': pathItem({
        get: {
          summary: 'AI commerce capability discovery',
          security: [],
          responses: ok({ type: 'object' }),
        },
      }),

      // ── Customer ──────────────────────────────────────────
      '/api/customer/products': pathItem({
        get: {
          summary: 'List / search products (each item includes available sellable qty)',
          tags: ['customer'],
          security: bearer,
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'tag', in: 'query', schema: { type: 'string' } },
            ...productListPaginationParams,
          ],
          responses: ok(productPageSchema),
        },
      }),
      '/api/customer/products/{id}': pathItem({
        get: {
          summary: 'Get product',
          tags: ['customer'],
          security: bearer,
          parameters: [idParam()],
          responses: ok(productRef),
        },
      }),
      '/api/customer/inventory/{productId}': pathItem({
        get: {
          summary: 'Check inventory availability',
          tags: ['customer'],
          security: bearer,
          parameters: [idParam('productId')],
          responses: ok(inventorySchema),
        },
      }),
      '/api/customer/carts': pathItem({
        post: {
          summary: 'Create cart',
          tags: ['customer'],
          security: bearer,
          parameters: [idempotencyParam],
          requestBody: zodBody(CreateCartBodySchema, false),
          responses: ok(cartRef),
        },
      }),
      '/api/customer/carts/{id}': pathItem({
        get: {
          summary: 'Get cart',
          tags: ['customer'],
          security: bearer,
          parameters: [idParam()],
          responses: ok(cartRef),
        },
      }),
      '/api/customer/carts/{id}/items': pathItem({
        post: {
          summary: 'Add cart item',
          tags: ['customer'],
          security: bearer,
          parameters: [idParam(), idempotencyParam],
          requestBody: zodBody(AddItemSchema),
          responses: ok(cartRef),
        },
      }),
      '/api/customer/carts/{id}/items/{productId}': pathItem({
        patch: {
          summary: 'Update cart item quantity',
          tags: ['customer'],
          security: bearer,
          parameters: [idParam(), idParam('productId'), idempotencyParam],
          requestBody: zodBody(UpdateItemSchema),
          responses: ok(cartRef),
        },
        delete: {
          summary: 'Remove cart item',
          tags: ['customer'],
          security: bearer,
          parameters: [idParam(), idParam('productId'), idempotencyParam],
          requestBody: emptyWriteBody,
          responses: ok(cartRef),
        },
      }),
      '/api/customer/carts/{id}/promotion': pathItem({
        post: {
          summary: 'Apply promotion code to cart',
          tags: ['customer'],
          security: bearer,
          parameters: [idParam(), idempotencyParam],
          requestBody: zodBody(PromoCodeSchema),
          responses: ok(cartRef),
        },
      }),
      '/api/customer/carts/{id}/quote': pathItem({
        get: {
          summary: 'Quote cart totals (integer cents)',
          tags: ['customer'],
          security: bearer,
          parameters: [idParam()],
          responses: ok(quoteSchema),
        },
      }),
      '/api/customer/orders': pathItem({
        post: {
          summary: 'Place order (reserves stock)',
          tags: ['customer'],
          security: bearer,
          parameters: [idempotencyParam],
          requestBody: zodBody(PlaceOrderBodySchema),
          responses: ok(orderRef),
        },
      }),
      '/api/customer/orders/{id}': pathItem({
        get: {
          summary: 'Get order',
          tags: ['customer'],
          security: bearer,
          parameters: [idParam()],
          responses: ok(orderRef),
        },
      }),
      '/api/customer/orders/{id}/pay': pathItem({
        post: {
          summary: 'Pay order (commits stock)',
          tags: ['customer'],
          security: bearer,
          parameters: [idParam(), idempotencyParam],
          requestBody: emptyWriteBody,
          responses: ok({ type: 'object' }),
        },
      }),
      '/api/customer/orders/{id}/cancel': pathItem({
        post: {
          summary: 'Cancel unpaid order and release holds',
          tags: ['customer'],
          security: bearer,
          parameters: [idParam(), idempotencyParam],
          requestBody: emptyWriteBody,
          responses: ok(orderRef),
        },
      }),
      '/api/customer/orders/{id}/receive': pathItem({
        post: {
          summary: 'Confirm goods received (shipped → delivered)',
          tags: ['customer'],
          security: bearer,
          parameters: [idParam(), idempotencyParam],
          requestBody: emptyWriteBody,
          responses: ok(orderRef),
        },
      }),
      '/api/customer/orders/{id}/returns': pathItem({
        post: {
          summary: 'Request a return / refund',
          tags: ['customer'],
          security: bearer,
          parameters: [idParam(), idempotencyParam],
          requestBody: zodBody(CreateReturnBodySchema),
          responses: ok(returnRef),
        },
      }),

      // ── Webhooks ──────────────────────────────────────────
      '/api/webhooks/payment': pathItem({
        post: {
          summary: 'Payment provider webhook (idempotent on eventId)',
          tags: ['webhooks'],
          security: bearer,
          requestBody: zodBody(PaymentWebhookBodySchema),
          responses: ok({ type: 'object' }),
        },
      }),

      // ── Merchant ──────────────────────────────────────────
      '/api/merchant/metrics': pathItem({
        get: {
          summary: 'Merchant business metrics (GMV, orders, OOS)',
          tags: ['merchant'],
          security: bearer,
          responses: ok(metricsSchema),
        },
      }),
      '/api/merchant/products': pathItem({
        get: {
          summary: 'List products (merchant)',
          tags: ['merchant'],
          security: bearer,
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'tag', in: 'query', schema: { type: 'string' } },
            { name: 'activeOnly', in: 'query', schema: { type: 'boolean' } },
            ...productListPaginationParams,
          ],
          responses: ok(productPageSchema),
        },
        post: {
          summary: 'Upsert product',
          tags: ['merchant'],
          security: bearer,
          parameters: [idempotencyParam],
          requestBody: upsertProductBody,
          responses: ok(productRef),
        },
      }),
      '/api/merchant/products/{id}': pathItem({
        put: {
          summary: 'Upsert product by id',
          tags: ['merchant'],
          security: bearer,
          parameters: [idParam(), idempotencyParam],
          requestBody: upsertProductBody,
          responses: ok(productRef),
        },
      }),
      '/api/merchant/products/{id}/stock': pathItem({
        post: {
          summary: 'Adjust stock onHand by delta',
          tags: ['merchant'],
          security: bearer,
          parameters: [idParam(), idempotencyParam],
          requestBody: zodBody(AdjustStockSchema),
          responses: ok(inventorySchema),
        },
      }),
      '/api/merchant/inventory/{productId}': pathItem({
        get: {
          summary: 'Check inventory (merchant)',
          tags: ['merchant'],
          security: bearer,
          parameters: [idParam('productId')],
          responses: ok(inventorySchema),
        },
      }),
      '/api/merchant/orders': pathItem({
        get: {
          summary: 'List orders',
          tags: ['merchant'],
          security: bearer,
          parameters: [
            { name: 'customerId', in: 'query', schema: { type: 'string' } },
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['created', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'],
              },
            },
            { name: 'cursor', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1 } },
          ],
          responses: ok(orderListSchema),
        },
      }),
      '/api/merchant/orders/{id}/ship': pathItem({
        post: {
          summary: 'Ship a paid order',
          tags: ['merchant'],
          security: bearer,
          parameters: [idParam(), idempotencyParam],
          requestBody: emptyWriteBody,
          responses: ok(orderRef),
        },
      }),
      '/api/merchant/orders/{id}/deliver': pathItem({
        post: {
          summary: 'Mark order delivered',
          tags: ['merchant'],
          security: bearer,
          parameters: [idParam(), idempotencyParam],
          requestBody: emptyWriteBody,
          responses: ok(orderRef),
        },
      }),
      '/api/merchant/orders/{id}/receive': pathItem({
        post: {
          summary: 'Mark order received/delivered (alias)',
          tags: ['merchant'],
          security: bearer,
          parameters: [idParam(), idempotencyParam],
          requestBody: emptyWriteBody,
          responses: ok(orderRef),
        },
      }),
      '/api/merchant/reservations/release-expired': pathItem({
        post: {
          summary: 'Auto-release timed-out inventory holds and cancel unpaid orders',
          tags: ['merchant'],
          security: bearer,
          requestBody: emptyWriteBody,
          responses: ok(releaseExpiredSchema),
        },
      }),
      '/api/merchant/promotions': pathItem({
        post: {
          summary: 'Upsert promotion (threshold / percent / fixed; amounts in cents)',
          tags: ['merchant'],
          security: bearer,
          parameters: [idempotencyParam],
          requestBody: zodBody(PromotionSchema),
          responses: ok(promoRef),
        },
      }),
      '/api/merchant/audit': pathItem({
        get: {
          summary: 'Query audit events (merchant)',
          tags: ['merchant', 'security'],
          security: apiKeyOrBearer,
          parameters: [...auditQueryParams],
          responses: auditResponse,
        },
      }),

      // ── Agent ─────────────────────────────────────────────
      '/api/agent/audit': pathItem({
        get: {
          summary: 'Query recent audit events',
          description:
            'Filter in-memory audit ring buffer by actor, role, path, status, code, traceId, or time range.',
          tags: ['agent', 'security'],
          security: apiKeyOrBearer,
          parameters: [...auditQueryParams],
          responses: auditResponse,
        },
      }),
      '/api/agent/products': pathItem({
        get: {
          summary: 'Agent product search (each item includes available sellable qty)',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'tag', in: 'query', schema: { type: 'string' } },
            ...productListPaginationParams,
          ],
          responses: ok(productPageSchema),
        },
        post: {
          summary: 'Agent upsert product (requires agent:merchant)',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [idempotencyParam],
          requestBody: upsertProductBody,
          responses: ok(productRef),
        },
      }),
      '/api/agent/products/{id}': pathItem({
        get: {
          summary: 'Get product (agent)',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [idParam()],
          responses: ok(productRef),
        },
      }),
      '/api/agent/products/{id}/stock': pathItem({
        post: {
          summary: 'Adjust stock (agent:merchant)',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [idParam(), idempotencyParam],
          requestBody: zodBody(AdjustStockSchema),
          responses: ok(inventorySchema),
        },
      }),
      '/api/agent/inventory/{productId}': pathItem({
        get: {
          summary: 'Check inventory (agent)',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [idParam('productId')],
          responses: ok(inventorySchema),
        },
      }),
      '/api/agent/carts': pathItem({
        post: {
          summary: 'Create cart (agent)',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [idempotencyParam],
          requestBody: zodBody(CreateCartBodySchema, false),
          responses: ok(cartRef),
        },
      }),
      '/api/agent/carts/{id}/items': pathItem({
        post: {
          summary: 'Add cart item (agent)',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [idParam(), idempotencyParam],
          requestBody: zodBody(AddItemSchema),
          responses: ok(cartRef),
        },
      }),
      '/api/agent/carts/{id}/items/{productId}': pathItem({
        patch: {
          summary: 'Update cart item (agent)',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [idParam(), idParam('productId'), idempotencyParam],
          requestBody: zodBody(UpdateItemSchema),
          responses: ok(cartRef),
        },
        delete: {
          summary: 'Remove cart item (agent)',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [idParam(), idParam('productId'), idempotencyParam],
          requestBody: emptyWriteBody,
          responses: ok(cartRef),
        },
      }),
      '/api/agent/carts/{id}/promotion': pathItem({
        post: {
          summary: 'Apply promotion (agent)',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [idParam(), idempotencyParam],
          requestBody: zodBody(PromoCodeSchema),
          responses: ok(cartRef),
        },
      }),
      '/api/agent/carts/{id}/quote': pathItem({
        get: {
          summary: 'Quote cart (agent)',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [idParam()],
          responses: ok(quoteSchema),
        },
      }),
      '/api/agent/orders': pathItem({
        get: {
          summary: 'List orders (agent:merchant)',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [{ name: 'customerId', in: 'query', schema: { type: 'string' } }],
          responses: ok(orderListSchema),
        },
        post: {
          summary: 'Agent place order',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [idempotencyParam],
          requestBody: zodBody(PlaceOrderBodySchema),
          responses: ok(orderRef),
        },
      }),
      '/api/agent/orders/{id}': pathItem({
        get: {
          summary: 'Get order (agent)',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [idParam()],
          responses: ok(orderRef),
        },
      }),
      '/api/agent/orders/{id}/pay': pathItem({
        post: {
          summary: 'Pay order (agent)',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [idParam(), idempotencyParam],
          requestBody: emptyWriteBody,
          responses: ok({ type: 'object' }),
        },
      }),
      '/api/agent/orders/{id}/cancel': pathItem({
        post: {
          summary: 'Cancel order (agent)',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [idParam(), idempotencyParam],
          requestBody: emptyWriteBody,
          responses: ok(orderRef),
        },
      }),
      '/api/agent/orders/{id}/returns': pathItem({
        post: {
          summary: 'Request return (agent)',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [idParam(), idempotencyParam],
          requestBody: zodBody(CreateReturnBodySchema),
          responses: ok(returnRef),
        },
      }),
    },
  }
}
