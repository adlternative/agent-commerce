import type { IncomingMessage, ServerResponse } from 'node:http'
import { DomainError, isDomainError } from '../domain/errors.js'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

export type RequestContext = {
  req: IncomingMessage
  res: ServerResponse
  url: URL
  params: Record<string, string>
  query: URLSearchParams
  body: unknown
  idempotencyKey?: string
  actor: { role: 'customer' | 'merchant' | 'agent'; subject: string }
}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  if (chunks.length === 0) return undefined
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new DomainError('INVALID_JSON', 'request body must be valid JSON', {
      retryable: false,
    })
  }
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers?: Record<string, string>,
): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    ...headers,
  })
  res.end(payload)
}

export function sendError(res: ServerResponse, err: unknown): void {
  if (isDomainError(err)) {
    const status = statusForCode(err.code)
    sendJson(res, status, err.toJSON())
    return
  }
  if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ZodError') {
    const z = err as unknown as { issues: { message: string; path: (string | number)[] }[] }
    sendJson(res, 400, {
      code: 'VALIDATION_ERROR',
      message: 'request validation failed',
      hint: z.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      retryable: false,
    })
    return
  }
  const message = err instanceof Error ? err.message : 'internal error'
  sendJson(res, 500, {
    code: 'INTERNAL_ERROR',
    message,
    retryable: true,
  })
}

function statusForCode(code: string): number {
  switch (code) {
    case 'UNAUTHORIZED':
      return 401
    case 'FORBIDDEN':
      return 403
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
    case 'INSUFFICIENT_STOCK':
    case 'EMPTY_CART':
    case 'INVALID_TRANSITION':
    case 'ORDER_NOT_PAYABLE':
    case 'ORDER_NOT_RETURNABLE':
    case 'PROMO_INACTIVE':
    case 'PRODUCT_INACTIVE':
    case 'VALIDATION_ERROR':
    case 'INVALID_JSON':
    case 'IDEMPOTENCY_KEY_REQUIRED':
    case 'INVALID_CENTS':
    case 'INVALID_QUANTITY':
      return 400
    default:
      return 400
  }
}

export function getIdempotencyKey(req: IncomingMessage): string | undefined {
  const h = req.headers['idempotency-key']
  if (Array.isArray(h)) return h[0]
  return h
}
