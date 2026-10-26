/** OpenAPI 3.1 document for the three API surfaces. */

const errorSchema = {
  type: 'object',
  required: ['code', 'message', 'retryable'],
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    hint: { type: 'string' },
    retryable: { type: 'boolean' },
  },
} as const

const bearer = [{ BearerAuth: [] }]
const apiKeyOrBearer = [{ BearerAuth: [] }, { ApiKeyAuth: [] }]

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

function jsonBody(schema: Record<string, unknown>) {
  return {
    required: true,
    content: { 'application/json': { schema } },
  }
}

function ok(schema: Record<string, unknown>) {
  return {
    '200': {
      description: 'OK',
      content: { 'application/json': { schema } },
    },
    default: {
      description: 'Structured error',
      content: { 'application/json': { schema: errorSchema } },
    },
  }
}

export function buildOpenApi() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Agent Commerce API',
      version: '0.2.0',
      description:
        'AI-native commerce HTTP API. Amounts are integer cents. Writes require Idempotency-Key.',
    },
    servers: [{ url: 'http://localhost:8787' }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Opaque demo tokens (customer-token | merchant-token | agent-token) or HS256 JWT with claims { sub, role }',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'customer-key | merchant-key | agent-key (or Authorization: ApiKey <key>)',
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
        Error: errorSchema,
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            sku: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            priceCents: { type: 'integer' },
            tags: { type: 'array', items: { type: 'string' } },
            agentNotes: { type: 'string' },
            active: { type: 'boolean' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: {
              type: 'string',
              enum: ['created', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'],
            },
            totalCents: { type: 'integer' },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          summary: 'Liveness (legacy alias of /healthz)',
          security: [],
          responses: ok({ type: 'object', properties: { ok: { type: 'boolean' } } }),
        },
      },
      '/healthz': {
        get: {
          summary: 'Liveness probe (no auth)',
          security: [],
          responses: ok({ type: 'object', properties: { ok: { type: 'boolean' } } }),
        },
      },
      '/readyz': {
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
      },
      '/metrics': {
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
      },
      '/api/customer/products': {
        get: {
          summary: 'List / search products',
          tags: ['customer'],
          security: bearer,
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'tag', in: 'query', schema: { type: 'string' } },
          ],
          responses: ok({ type: 'array', items: { $ref: '#/components/schemas/Product' } }),
        },
      },
      '/api/customer/products/{id}': {
        get: {
          summary: 'Get product',
          tags: ['customer'],
          security: bearer,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: ok({ $ref: '#/components/schemas/Product' }),
        },
      },
      '/api/customer/carts': {
        post: {
          summary: 'Create cart',
          tags: ['customer'],
          security: bearer,
          parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
          requestBody: jsonBody({
            type: 'object',
            properties: { customerId: { type: 'string' } },
          }),
          responses: ok({ type: 'object' }),
        },
      },
      '/api/customer/carts/{id}/items': {
        post: {
          summary: 'Add cart item',
          tags: ['customer'],
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { $ref: '#/components/parameters/IdempotencyKey' },
          ],
          requestBody: jsonBody({
            type: 'object',
            required: ['productId', 'quantity'],
            properties: {
              productId: { type: 'string' },
              quantity: { type: 'integer', minimum: 1 },
            },
          }),
          responses: ok({ type: 'object' }),
        },
      },
      '/api/customer/orders': {
        post: {
          summary: 'Place order (reserves stock)',
          tags: ['customer'],
          security: bearer,
          parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
          requestBody: jsonBody({
            type: 'object',
            required: ['cartId'],
            properties: { cartId: { type: 'string' } },
          }),
          responses: ok({ $ref: '#/components/schemas/Order' }),
        },
      },
      '/api/customer/orders/{id}/pay': {
        post: {
          summary: 'Pay order (commits stock)',
          tags: ['customer'],
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { $ref: '#/components/parameters/IdempotencyKey' },
          ],
          responses: ok({ type: 'object' }),
        },
      },
      '/api/customer/orders/{id}/receive': {
        post: {
          summary: 'Confirm goods received (shipped → delivered)',
          tags: ['customer'],
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { $ref: '#/components/parameters/IdempotencyKey' },
          ],
          responses: ok({ $ref: '#/components/schemas/Order' }),
        },
      },
      '/api/webhooks/payment': {
        post: {
          summary: 'Payment provider webhook (idempotent on eventId)',
          tags: ['webhooks'],
          security: bearer,
          requestBody: jsonBody({
            type: 'object',
            required: ['eventId', 'type', 'orderId'],
            properties: {
              eventId: { type: 'string' },
              type: { type: 'string', enum: ['payment.captured', 'payment.failed'] },
              orderId: { type: 'string' },
              amountCents: { type: 'integer' },
            },
          }),
          responses: ok({ type: 'object' }),
        },
      },
      '/api/merchant/orders/{id}/ship': {
        post: {
          summary: 'Ship a paid order',
          tags: ['merchant'],
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { $ref: '#/components/parameters/IdempotencyKey' },
          ],
          responses: ok({ $ref: '#/components/schemas/Order' }),
        },
      },
      '/api/merchant/orders/{id}/receive': {
        post: {
          summary: 'Mark order received/delivered',
          tags: ['merchant'],
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { $ref: '#/components/parameters/IdempotencyKey' },
          ],
          responses: ok({ $ref: '#/components/schemas/Order' }),
        },
      },
      '/api/merchant/reservations/release-expired': {
        post: {
          summary: 'Auto-release timed-out inventory holds and cancel unpaid orders',
          tags: ['merchant'],
          security: bearer,
          responses: ok({
            type: 'object',
            properties: {
              releasedReservationIds: { type: 'array', items: { type: 'string' } },
              cancelledOrderIds: { type: 'array', items: { type: 'string' } },
            },
          }),
        },
      },
      '/api/merchant/products': {
        post: {
          summary: 'Upsert product',
          tags: ['merchant'],
          security: bearer,
          parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
          requestBody: jsonBody({ type: 'object' }),
          responses: ok({ $ref: '#/components/schemas/Product' }),
        },
      },
      '/api/merchant/products/{id}/stock': {
        post: {
          summary: 'Adjust stock',
          tags: ['merchant'],
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { $ref: '#/components/parameters/IdempotencyKey' },
          ],
          requestBody: jsonBody({
            type: 'object',
            required: ['delta'],
            properties: { delta: { type: 'integer' } },
          }),
          responses: ok({ type: 'object' }),
        },
      },
      '/api/merchant/orders': {
        get: {
          summary: 'List orders',
          tags: ['merchant'],
          security: bearer,
          responses: ok({ type: 'array', items: { $ref: '#/components/schemas/Order' } }),
        },
      },
      '/api/agent/products': {
        get: {
          summary: 'Agent product search',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
          responses: ok({ type: 'array', items: { $ref: '#/components/schemas/Product' } }),
        },
      },
      '/api/agent/orders': {
        post: {
          summary: 'Agent place order',
          tags: ['agent'],
          security: apiKeyOrBearer,
          parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }],
          requestBody: jsonBody({
            type: 'object',
            required: ['cartId'],
            properties: { cartId: { type: 'string' } },
          }),
          responses: ok({ $ref: '#/components/schemas/Order' }),
        },
      },
      '/api/agent/audit': {
        get: {
          summary: 'Query recent audit events',
          description:
            'Filter in-memory audit ring buffer by actor, role, path, status, code, traceId, or time range.',
          tags: ['agent', 'security'],
          security: apiKeyOrBearer,
          parameters: [...auditQueryParams],
          responses: auditResponse,
        },
      },
      '/api/merchant/audit': {
        get: {
          summary: 'Query audit events (merchant)',
          tags: ['merchant', 'security'],
          security: apiKeyOrBearer,
          parameters: [...auditQueryParams],
          responses: auditResponse,
        },
      },
    },
  }
}
