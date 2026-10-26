import { createHmac, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { DomainError } from '../domain/errors.js'

export type Role = 'customer' | 'merchant' | 'agent'

export const ROLES: readonly Role[] = ['customer', 'merchant', 'agent'] as const

export type Actor = {
  role: Role
  subject: string
}

export type JwtConfig = {
  /** HS256 secret (Node crypto only — no external JWT deps). */
  secret: string
  /** Optional max clock skew when validating `exp` (seconds). Default 5. */
  clockSkewSec?: number
}

export type AuthConfig = {
  /** Map opaque bearer token → actor */
  tokens: Record<string, Actor>
  /** Map API key (X-API-Key / Authorization: ApiKey) → actor */
  apiKeys?: Record<string, Actor>
  /** When set, Bearer tokens shaped like JWT are verified as HS256. */
  jwt?: JwtConfig
}

export const DEFAULT_JWT_SECRET = 'agent-commerce-dev-jwt-secret'

export const DEFAULT_AUTH: AuthConfig = {
  tokens: {
    'customer-token': { role: 'customer', subject: 'cust_demo' },
    'merchant-token': { role: 'merchant', subject: 'merchant_demo' },
    'agent-token': { role: 'agent', subject: 'agent_demo' },
  },
  apiKeys: {
    'customer-key': { role: 'customer', subject: 'cust_demo' },
    'merchant-key': { role: 'merchant', subject: 'merchant_demo' },
    'agent-key': { role: 'agent', subject: 'agent_demo' },
  },
  jwt: { secret: DEFAULT_JWT_SECRET },
}

function isRole(value: unknown): value is Role {
  return value === 'customer' || value === 'merchant' || value === 'agent'
}

function unauthorized(message: string, hint?: string): never {
  throw new DomainError('UNAUTHORIZED', message, {
    hint,
    retryable: false,
  })
}

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export type JwtClaims = {
  sub: string
  role: Role
  iat?: number
  exp?: number
}

/** Mint a compact HS256 JWT (no external deps). */
export function signJwt(claims: JwtClaims, secret: string): string {
  if (!claims.sub || !isRole(claims.role)) {
    throw new Error('signJwt requires sub and a valid role')
  }
  const now = Math.floor(Date.now() / 1000)
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' })
  const payload = b64urlJson({
    sub: claims.sub,
    role: claims.role,
    iat: claims.iat ?? now,
    ...(claims.exp !== undefined ? { exp: claims.exp } : {}),
  })
  const data = `${header}.${payload}`
  const sig = createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}.${sig}`
}

/** Verify HS256 JWT and return the actor. */
export function verifyJwt(token: string, config: JwtConfig): Actor {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    unauthorized('invalid JWT', 'expected header.payload.signature')
  }
  const [headerB64, payloadB64, sig] = parts
  let header: { alg?: string; typ?: string }
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: string
      typ?: string
    }
  } catch {
    unauthorized('invalid JWT header')
  }
  if (header.alg !== 'HS256') {
    unauthorized('unsupported JWT alg', 'only HS256 is accepted')
  }
  const data = `${headerB64}.${payloadB64}`
  const expected = createHmac('sha256', config.secret).update(data).digest('base64url')
  if (!safeEqual(sig, expected)) {
    unauthorized('invalid JWT signature')
  }
  let claims: Record<string, unknown>
  try {
    claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >
  } catch {
    unauthorized('invalid JWT payload')
  }
  const skew = config.clockSkewSec ?? 5
  const now = Math.floor(Date.now() / 1000)
  if (typeof claims.exp === 'number' && claims.exp + skew < now) {
    unauthorized('JWT expired', 'mint a new token')
  }
  if (typeof claims.nbf === 'number' && claims.nbf - skew > now) {
    unauthorized('JWT not yet valid')
  }
  if (typeof claims.sub !== 'string' || !claims.sub) {
    unauthorized('JWT missing sub')
  }
  if (!isRole(claims.role)) {
    unauthorized('JWT missing or invalid role', `role must be one of ${ROLES.join(', ')}`)
  }
  return { role: claims.role, subject: claims.sub }
}

function looksLikeJwt(token: string): boolean {
  const parts = token.split('.')
  return parts.length === 3 && parts.every((p) => p.length > 0)
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name]
  if (Array.isArray(raw)) return raw[0]
  return raw
}

/**
 * Resolve the request actor from X-API-Key, Authorization: ApiKey, opaque Bearer,
 * or HS256 JWT Bearer. Opaque tokens are checked before JWT so demo tokens stay stable.
 */
export function authenticate(req: IncomingMessage, config: AuthConfig = DEFAULT_AUTH): Actor {
  const apiKeyHeader = headerValue(req, 'x-api-key')?.trim()
  if (apiKeyHeader) {
    const actor = config.apiKeys?.[apiKeyHeader]
    if (!actor) {
      unauthorized('unknown or revoked API key', 'use a valid X-API-Key')
    }
    return actor
  }

  const header = headerValue(req, 'authorization')
  if (!header) {
    unauthorized('missing Authorization header', 'use Authorization: Bearer <token|jwt> or X-API-Key')
  }

  const apiKeyMatch = /^ApiKey\s+(.+)$/i.exec(header.trim())
  if (apiKeyMatch?.[1]) {
    const actor = config.apiKeys?.[apiKeyMatch[1].trim()]
    if (!actor) {
      unauthorized('unknown or revoked API key', 'use a valid ApiKey')
    }
    return actor
  }

  const bearerMatch = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (!bearerMatch?.[1]) {
    unauthorized('invalid Authorization header', 'expected Bearer token/JWT or ApiKey')
  }
  const credential = bearerMatch[1].trim()

  const opaque = config.tokens[credential]
  if (opaque) {
    return opaque
  }

  if (config.jwt && looksLikeJwt(credential)) {
    return verifyJwt(credential, config.jwt)
  }

  unauthorized('unknown or revoked token', 'provide a valid bearer token, JWT, or API key')
}

export function requireRole(actor: Actor, allowed: Role[]): void {
  if (!allowed.includes(actor.role)) {
    throw new DomainError('FORBIDDEN', `role ${actor.role} cannot access this route`, {
      hint: `allowed: ${allowed.join(', ')}`,
      retryable: false,
    })
  }
}

/** Static capability matrix for the three commerce roles. */
export function roleAllows(role: Role, surface: 'customer' | 'merchant' | 'agent' | 'audit'): boolean {
  switch (surface) {
    case 'customer':
      return role === 'customer' || role === 'agent'
    case 'merchant':
      return role === 'merchant' || role === 'agent'
    case 'agent':
      return role === 'agent'
    case 'audit':
      return role === 'agent' || role === 'merchant'
    default:
      return false
  }
}
