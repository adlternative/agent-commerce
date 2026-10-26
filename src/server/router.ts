import type { IncomingMessage, ServerResponse } from 'node:http'
import type { HttpMethod, RequestContext } from './http.js'
import { readJsonBody, sendJson, getIdempotencyKey } from './http.js'
import { authenticate, type AuthConfig, type Role, requireRole } from './auth.js'
import { isDomainError } from '../domain/errors.js'
import type { AuditLog } from '../ai/audit.js'
import type { TokenBucket } from '../ai/rate-limit.js'
import { buildAiCommerceDiscovery } from '../ai/well-known.js'

export type RouteHandler = (ctx: RequestContext) => Promise<unknown> | unknown

export type AiAdapters = {
  rateLimit?: TokenBucket
  audit?: AuditLog
}

type Route = {
  method: HttpMethod
  pattern: RegExp
  paramNames: string[]
  roles: Role[]
  handler: RouteHandler
}

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type, idempotency-key',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  }
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

function sendErr(res: ServerResponse, err: unknown): void {
  if (res.headersSent) return
  if (isDomainError(err)) {
    sendJson(res, statusForCode(err.code), err.toJSON(), corsHeaders())
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
      corsHeaders(),
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
    corsHeaders(),
  )
}

export class Router {
  private readonly routes: Route[] = []
  private readonly auth: AuthConfig
  private openApiProvider?: () => unknown
  private ai: AiAdapters = {}

  constructor(auth: AuthConfig, ai: AiAdapters = {}) {
    this.auth = auth
    this.ai = ai
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
    this.routes.push({ method, pattern, paramNames, roles, handler })
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const started = Date.now()
    let actorLabel = 'anonymous'
    let roleLabel = 'none'
    let status = 500
    let errorCode: string | undefined
    const method = (req.method ?? 'GET').toUpperCase() as HttpMethod
    const host = req.headers.host ?? 'localhost'
    const url = new URL(req.url ?? '/', `http://${host}`)

    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders())
        res.end()
        status = 204
        return
      }

      if (method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, { ok: true }, corsHeaders())
        status = 200
        return
      }
      if (method === 'GET' && url.pathname === '/.well-known/ai-commerce.json') {
        sendJson(res, 200, buildAiCommerceDiscovery(`http://${host}`), corsHeaders())
        status = 200
        return
      }
      if (method === 'GET' && url.pathname === '/openapi.json' && this.openApiProvider) {
        sendJson(res, 200, this.openApiProvider(), corsHeaders())
        status = 200
        return
      }

      const actor = authenticate(req, this.auth)
      actorLabel = actor.subject
      roleLabel = actor.role
      this.ai.rateLimit?.take(`${actor.role}:${actor.subject}`)

      const match = this.routes.find((r) => r.method === method && r.pattern.test(url.pathname))
      if (!match) {
        status = 404
        sendJson(
          res,
          404,
          {
            code: 'NOT_FOUND',
            message: `no route for ${method} ${url.pathname}`,
            retryable: false,
          },
          corsHeaders(),
        )
        return
      }
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
      }

      const result = await match.handler(ctx)
      if (result === undefined) {
        res.writeHead(204, corsHeaders())
        res.end()
        status = 204
        return
      }
      sendJson(res, 200, result, corsHeaders())
      status = 200
    } catch (err) {
      if (isDomainError(err)) {
        status = statusForCode(err.code)
        errorCode = err.code
      } else {
        status = 500
        errorCode = 'INTERNAL_ERROR'
      }
      sendErr(res, err)
    } finally {
      this.ai.audit?.record({
        actor: actorLabel,
        role: roleLabel,
        method,
        path: url.pathname,
        status,
        idempotencyKey: getIdempotencyKey(req),
        code: errorCode,
        durationMs: Date.now() - started,
      })
    }
  }
}
