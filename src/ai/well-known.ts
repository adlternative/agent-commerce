import { TOOL_DESCRIPTIONS } from '../mcp/tools.js'

/** Capability discovery document for AI agents. */
export function buildAiCommerceDiscovery(baseUrl = 'http://localhost:8787') {
  return {
    name: 'agent-commerce',
    version: '0.6.0',
    description:
      'AI-native commerce: integer cents, Idempotency-Key on writes, structured errors, MCP + HTTP.',
    baseUrl,
    money: { unit: 'cents', integerOnly: true },
    authentication: {
      type: 'http',
      scheme: 'bearer',
      tokens: {
        customer: 'customer-token',
        merchant: 'merchant-token',
        agent: 'agent-token',
      },
    },
    conventions: {
      idempotencyHeader: 'Idempotency-Key',
      errorShape: { code: 'string', message: 'string', hint: 'string?', retryable: 'boolean' },
      pagination: {
        style: 'cursor',
        params: ['cursor', 'limit'],
        response: ['items', 'nextCursor', 'hasMore'],
      },
      rateLimit: {
        algorithm: 'token_bucket',
        defaultCapacity: 60,
        refillPerSec: 1,
        errorCode: 'RATE_LIMITED',
      },
      audit: { path: '/api/agent/audit', description: 'Recent request audit events' },
    },
    errorCodes: [
      'UNAUTHORIZED',
      'FORBIDDEN',
      'VALIDATION_ERROR',
      'IDEMPOTENCY_KEY_REQUIRED',
      'IDEMPOTENCY_KEY_REUSE',
      'INSUFFICIENT_STOCK',
      'RATE_LIMITED',
      'INVALID_CURSOR',
      'PRODUCT_NOT_FOUND',
      'CART_NOT_FOUND',
      'ORDER_NOT_FOUND',
      'INVALID_TRANSITION',
    ],
    http: {
      customer: [
        'GET /api/customer/products',
        'GET /api/customer/products/:id',
        'POST /api/customer/carts',
        'POST /api/customer/carts/:id/items',
        'POST /api/customer/orders',
        'POST /api/customer/orders/:id/pay',
      ],
      merchant: [
        'GET /api/merchant/metrics',
        'POST /api/merchant/products',
        'POST /api/merchant/products/:id/stock',
        'GET /api/merchant/orders',
        'POST /api/merchant/orders/:id/ship',
        'POST /api/merchant/promotions',
      ],
      agent: [
        'GET /api/agent/products',
        'POST /api/agent/carts',
        'POST /api/agent/orders',
        'POST /api/agent/products',
        'GET /api/agent/orders',
        'GET /api/agent/audit',
      ],
    },
    mcp: {
      tools: Object.entries(TOOL_DESCRIPTIONS).map(([name, description]) => ({
        name,
        description,
      })),
      resources: ['catalog://products', 'orders://{id}'],
      prompts: ['shopping_assistant', 'merchant_ops'],
      stdioCommand: 'npm run mcp',
    },
    openapi: '/openapi.json',
    wellKnown: '/.well-known/ai-commerce.json',
  }
}
