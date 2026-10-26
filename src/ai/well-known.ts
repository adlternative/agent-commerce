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
      schemes: ['bearer', 'apiKey', 'jwt'],
      bearer: {
        scheme: 'bearer',
        tokens: {
          customer: 'customer-token',
          merchant: 'merchant-token',
          agent: 'agent-token',
        },
        jwt: {
          alg: 'HS256',
          claims: ['sub', 'role'],
          roles: ['customer', 'merchant', 'agent'],
        },
      },
      apiKey: {
        header: 'X-API-Key',
        altAuthorization: 'ApiKey <key>',
        keys: {
          customer: 'customer-key',
          merchant: 'merchant-key',
          agent: 'agent-key',
        },
      },
      // Back-compat for older clients that read scheme/tokens only
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
        productSearch: {
          ranking: 'full_text',
          fields: ['name', 'sku', 'tags', 'description', 'agentNotes'],
          chineseFallback: 'cjk_character_majority',
          cursor: 'stable_keyset_score_id',
        },
      },
      rateLimit: {
        algorithm: 'token_bucket',
        defaultCapacity: 60,
        refillPerSec: 1,
        errorCode: 'RATE_LIMITED',
      },
      audit: {
        path: '/api/agent/audit',
        merchantPath: '/api/merchant/audit',
        description:
          'Query audit events (actor, role, method, pathPrefix, pathContains, status, code, traceId, since, until, limit)',
      },
      rbac: {
        roles: ['customer', 'merchant', 'agent'],
        surfaces: {
          customer: ['customer', 'agent'],
          merchant: ['merchant', 'agent'],
          agent: ['agent'],
          audit: ['agent', 'merchant'],
        },
      },
      observability: {
        traceHeader: 'x-trace-id',
        metricsPath: '/metrics',
        structuredLogs: 'json_lines',
      },
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
        'POST /api/merchant/orders/:id/receive',
        'POST /api/merchant/reservations/release-expired',
        'POST /api/merchant/promotions',
      ],
      webhooks: ['POST /api/webhooks/payment'],
      agent: [
        'GET /api/agent/products',
        'POST /api/agent/carts',
        'POST /api/agent/orders',
        'POST /api/agent/products',
        'GET /api/agent/orders',
        'GET /api/agent/audit',
      ],
      audit: ['GET /api/agent/audit', 'GET /api/merchant/audit'],
    },
    mcp: {
      tools: [
        ...Object.entries(TOOL_DESCRIPTIONS).map(([name, description]) => ({
          name,
          description,
        })),
        {
          name: 'recommend_products',
          description:
            'Ask the client LLM via MCP sampling for product recommendations; falls back to catalog context without sampling.',
        },
      ],
      resources: ['catalog://products', 'products://{id}', 'orders://{id}'],
      prompts: ['shopping_assistant', 'merchant_ops'],
      sampling: { tool: 'recommend_products', method: 'sampling/createMessage' },
      errorMapping: {
        domainBody: '{ code, message, hint?, retryable, mcpErrorCode }',
        notFoundAndValidation: -32602,
        businessRule: -32600,
        internal: -32603,
      },
      stdioCommand: 'npm run mcp',
    },
    openapi: '/openapi.json',
    wellKnown: '/.well-known/ai-commerce.json',
  }
}
