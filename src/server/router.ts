import type { IncomingMessage, ServerResponse } from 'node:http'
import type { HttpMethod, RequestContext } from './http.js'
import { readJsonBody, sendJson, getIdempotencyKey } from './http.js'
import { authenticate, type AuthConfig, type Role, requireRole } from './auth.js'
import { isDomainError } from '../domain/errors.js'
import type { AuditLog } from '../ai/audit.js'
import type { TokenBucket } from '../ai/rate-limit.js'
import { buildAiCommerceDiscovery } from '../ai/well-known.js'
import { createLogger, resolveTraceId, type Logger } from './logger.js'
import { HttpMetrics } from './metrics.js'

export type RouteHandler = (ctx: RequestContext) => Promise<unknown> | unknown

export type AiAdapters = {
  rateLimit?: TokenBucket
  audit?: AuditLog
}

export type Observability = {
  logger?: Logger
  metrics?: HttpMetrics
}

type Route = {
  method: HttpMethod
  pattern: RegExp
  paramNames: string[]
  /** Path template used for metrics labels (e.g. /api/customer/orders/:id). */
  pathTemplate: string
  roles: Role[]
  handler: RouteHandler
}

function corsHeaders(traceId?: string, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers':
      'authorization, content-type, idempotency-key, x-api-key, x-trace-id, traceparent',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-expose-headers': 'x-trace-id, retry-after',
    ...extra,
  }
  if (traceId) {
    headers['x-trace-id'] = traceId
  }
  return headers
}

function statusForCode(code: string): number {
  switch (code) {
    case 'UNAUTHORIZED':
      return 401
    case 'FORBIDDEN':
      return 403
    case 'RATE_LIMITED':
      return 429
    case 'NOT_FOUND':
    case 'PRODUCT_NOT_FOUND':
    case 'CART_NOT_FOUND':
    case 'ORDER_NOT_FOUND':
    case 'STOCK_NOT_FOUND':
    case 'PROMO_NOT_FOUND':
    case 'CART_ITEM_NOT_FOUND':
    case 'PAYMENT_NOT_FOUND':
      return 404
    case 'IDEMPOTENCY_KEY_REUSE':
      return 409
    default:
      return 400
  }
}

function sendErr(
  res: ServerResponse,
  err: unknown,
  traceId: string,
  extraHeaders?: Record<string, string>,
): void {
  if (res.headersSent) return
  if (isDomainError(err)) {
    sendJson(res, statusForCode(err.code), err.toJSON(), corsHeaders(traceId, extraHeaders))
    return
  }
  if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ZodError') {
    const z = err as unknown as { issues: { message: string; path: (string | number)[] }[] }
  sendJson(
      res,
      400,
      {
        code: 'VALIDATION_ERROR',
        message: 'request validation failed',
        hint: z.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        retryable: false,
      },
      corsHeaders(traceId, extraHeaders),
    )
    return
  }
  sendJson(
    res,
    500,
    {
      code: 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : 'internal error',
      retryable: true,
    },
    corsHeaders(traceId, extraHeaders),
  )
}

export class Router {
  private readonly routes: Route[] = []
  private readonly auth: AuthConfig
  private openApiProvider?: () => unknown
  private ai: AiAdapters = {}
  private readonly logger: Logger
  private readonly metrics: HttpMetrics

  constructor(auth: AuthConfig, ai: AiAdapters = {}, obs: Observability = {}) {
    this.auth = auth
    this.ai = ai
    this.logger = obs.logger ?? createLogger({ service: 'agent-commerce' })
    this.metrics = obs.metrics ?? new HttpMetrics()
  }

  getMetrics(): HttpMetrics {
    return this.metrics
  }

  /** Registered API route templates (excludes public /health, /metrics, …). */
  listRoutes(): Array<{ method: HttpMethod; path: string }> {
    return this.routes.map((r) => ({ method: r.method, path: r.pathTemplate }))
  }

  setOpenApiProvider(fn: () => unknown): void {
    this.openApiProvider = fn
  }

  on(method: HttpMethod, path: string, roles: Role[], handler: RouteHandler): void {
    const paramNames: string[] = []
    const pattern = new RegExp(
      `^${path
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_m, name: string) => {
          paramNames.push(name)
          return '([^/]+)'
        })}$`,
    )
    this.routes.push({ method, pattern, paramNames, pathTemplate: path, roles, handler })
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const started = Date.now()
    let actorLabel = 'anonymous'
    let roleLabel = 'none'
    let status = 500
    let errorCode: string | undefined
    let metricPath = req.url?.split('?')[0] ?? '/'
    const method = (req.method ?? 'GET').toUpperCase() as HttpMethod
    const host = req.headers.host ?? 'localhost'
    const url = new URL(req.url ?? '/', `http://${host}`)
    const traceId = resolveTraceId(req.headers['x-trace-id'], req.headers['traceparent'])
    const log = this.logger.child({ traceId })

    log.info('request.start', { method, path: url.pathname })

    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders(traceId))
        res.end()
        status = 204
        metricPath = 'OPTIONS'
        return
      }

      if (method === 'GET' && url.pathname === '/health') {
        metricPath = '/health'
        sendJson(res, 200, { ok: true }, corsHeaders(traceId))
        status = 200
        return
      }
      if (method === 'GET' && url.pathname === '/metrics') {
        metricPath = '/metrics'
        const body = this.metrics.renderPrometheus()
        res.writeHead(200, {
          ...corsHeaders(traceId),
          'content-type': 'text/plain; version=0.0.4; charset=utf-8',
          'content-length': Buffer.byteLength(body),
        })
        res.end(body)
        status = 200
        return
      }
      if (method === 'GET' && url.pathname === '/.well-known/ai-commerce.json') {
        metricPath = '/.well-known/ai-commerce.json'
        sendJson(res, 200, buildAiCommerceDiscovery(`http://${host}`), corsHeaders(traceId))
        status = 200
        return
      }
      if (method === 'GET' && url.pathname === '/openapi.json' && this.openApiProvider) {
        metricPath = '/openapi.json'
        sendJson(res, 200, this.openApiProvider(), corsHeaders(traceId))
        status = 200
        return
      }

      const actor = authenticate(req, this.auth)
      actorLabel = actor.subject
      roleLabel = actor.role
      const rateKey = `${actor.role}:${actor.subject}`
      try {
        this.ai.rateLimit?.take(rateKey)
      } catch (err) {
        if (isDomainError(err) && err.code === 'RATE_LIMITED' && this.ai.rateLimit) {
          const retryAfter = String(this.ai.rateLimit.retryAfterSec(rateKey))
          status = 429
          errorCode = 'RATE_LIMITED'
          metricPath = url.pathname
          sendErr(res, err, traceId, { 'retry-after': retryAfter })
          return
        }
        throw err
      }

      const match = this.routes.find((r) => r.method === method && r.pattern.test(url.pathname))
      if (!match) {
        status = 404
        metricPath = url.pathname
        sendJson(
          res,
          404,
          {
            code: 'NOT_FOUND',
            message: `no route for ${method} ${url.pathname}`,
            retryable: false,
          },
          corsHeaders(traceId),
        )
        return
      }
      metricPath = match.pathTemplate
      requireRole(actor, match.roles)

      const m = match.pattern.exec(url.pathname)!
      const params: Record<string, string> = {}
      match.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(m[i + 1]!)
      })

      const needsBody = method === 'POST' || method === 'PUT' || method === 'PATCH'
      const body = needsBody ? await readJsonBody(req) : undefined
      const idempotencyKey = getIdempotencyKey(req)

      const ctx: RequestContext = {
        req,
        res,
        url,
        params,
        query: url.searchParams,
        body,
        idempotencyKey,
        actor,
        traceId,
        log,
      }

      const result = await match.handler(ctx)
      if (result === undefined) {
        res.writeHead(204, corsHeaders(traceId))
        res.end()
        status = 204
        return
      }
      sendJson(res, 200, result, corsHeaders(traceId))
      status = 200
    } catch (err) {
      if (isDomainError(err)) {
        status = statusForCode(err.code)
        errorCode = err.code
        log.warn('request.error', { method, path: url.pathname, code: err.code, status })
      } else {
        status = 500
        errorCode = 'INTERNAL_ERROR'
        log.error('request.error', {
          method,
          path: url.pathname,
          code: errorCode,
          status,
          err: err instanceof Error ? err.message : String(err),
        })
      }
      sendErr(res, err, traceId)
    } finally {
      const durationMs = Date.now() - started
      this.metrics.record(method, metricPath, status, durationMs)
      log.info('request.end', {
        method,
        path: url.pathname,
        route: metricPath,
        status,
        durationMs,
        actor: actorLabel,
        role: roleLabel,
        code: errorCode,
      })
      this.ai.audit?.record({
        actor: actorLabel,
        role: roleLabel,
        method,
        path: url.pathname,
        status,
        idempotencyKey: getIdempotencyKey(req),
        code: errorCode,
        durationMs,
        traceId,
      })
    }
  }
}
