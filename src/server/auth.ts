import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { DomainError } from '../domain/errors.js'

export type Role = 'customer' | 'merchant' | 'agent'

/** Explicit agent capability scopes — never implied by role alone. */
export type AgentScope = 'agent:customer' | 'agent:merchant'

export const ROLES: readonly Role[] = ['customer', 'merchant', 'agent'] as const

export const AGENT_SCOPES: readonly AgentScope[] = ['agent:customer', 'agent:merchant'] as const

/**
 * Route access entries: human roles, or explicit agent scopes.
 * Bare `'agent'` is intentionally not a grant — agents must hold a scope.
 */
export type AccessPrincipal = Role | AgentScope

export type Actor = {
  role: Role
  subject: string
  /** Agent capability scopes. Ignored for customer/merchant. Empty ⇒ no agent surface access. */
  scopes?: AgentScope[]
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

/**
 * Former hardcoded HS256 secret that shipped in public source.
 * NEVER use for signing or as a server default — kept only so regression tests can prove
 * JWTs forged with this value are rejected (401).
 */
export const DEFAULT_JWT_SECRET = 'agent-commerce-dev-jwt-secret'

/**
 * Former docker-compose default HS256 secret (ACP-30 / #680).
 * NEVER use as a compose/runtime default — kept only so regression tests can prove
 * JWTs forged with this value are rejected (401).
 */
export const DOCKER_INSECURE_JWT_SECRET = 'dev-docker-change-me'

/** Stable non-public secret for in-process DEFAULT_AUTH / unit tests. */
export const TEST_JWT_SECRET = 'agent-commerce-test-jwt-secret'

/** Opaque demo bearer tokens (local / explicit allow only). */
export const DEMO_TOKENS: Record<string, Actor> = {
  'customer-token': { role: 'customer', subject: 'cust_demo' },
  'merchant-token': { role: 'merchant', subject: 'merchant_demo' },
  /** Shopping-only agent — no merchant surface. */
  'agent-token': {
    role: 'agent',
    subject: 'agent_demo',
    scopes: ['agent:customer'],
  },
  /** Merchant-ops agent — no customer surface. */
  'agent-merchant-token': {
    role: 'agent',
    subject: 'agent_merchant_demo',
    scopes: ['agent:merchant'],
  },
}

/** Demo API keys (local / explicit allow only). */
export const DEMO_API_KEYS: Record<string, Actor> = {
  'customer-key': { role: 'customer', subject: 'cust_demo' },
  'merchant-key': { role: 'merchant', subject: 'merchant_demo' },
  'agent-key': {
    role: 'agent',
    subject: 'agent_demo',
    scopes: ['agent:customer'],
  },
  'agent-merchant-key': {
    role: 'agent',
    subject: 'agent_merchant_demo',
    scopes: ['agent:merchant'],
  },
}

export class MissingJwtSecretError extends Error {
  constructor() {
    super(
      'Refusing to start: JWT_SECRET is required when NODE_ENV=production. ' +
        'Set a strong secret via the JWT_SECRET environment variable ' +
        '(e.g. export JWT_SECRET=$(openssl rand -hex 32)). ' +
        'Demo tokens require ALLOW_DEMO_TOKENS=1 (or a non-production NODE_ENV).',
    )
    this.name = 'MissingJwtSecretError'
  }
}

/**
 * Demo credentials are on when ALLOW_DEMO_TOKENS=1, or when NODE_ENV is not production.
 * Production defaults fail-closed (no demo tokens/keys) unless explicitly allowed.
 */
export function demoCredentialsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.ALLOW_DEMO_TOKENS === '1') return true
  return env.NODE_ENV !== 'production'
}

/**
 * Resolve HS256 secret:
 * - JWT_SECRET env → use it
 * - production without JWT_SECRET → refuse (throw MissingJwtSecretError)
 * - non-production without JWT_SECRET → ephemeral random secret (never logged)
 */
export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.JWT_SECRET?.trim()
  if (fromEnv) return fromEnv
  if (env.NODE_ENV === 'production') {
    throw new MissingJwtSecretError()
  }
  return randomBytes(32).toString('hex')
}

export type BuildAuthConfigOptions = {
  env?: NodeJS.ProcessEnv
  /** Override JWT secret (tests). */
  jwtSecret?: string
  /** Force demo credentials on/off (tests). */
  allowDemoCredentials?: boolean
}

/** Build AuthConfig from env (fail-closed in production). */
export function buildAuthConfig(options: BuildAuthConfigOptions = {}): AuthConfig {
  const env = options.env ?? process.env
  const secret = options.jwtSecret ?? resolveJwtSecret(env)
  const demos =
    options.allowDemoCredentials !== undefined
      ? options.allowDemoCredentials
      : demoCredentialsEnabled(env)
  return {
    tokens: demos ? { ...DEMO_TOKENS } : {},
    apiKeys: demos ? { ...DEMO_API_KEYS } : {},
    jwt: { secret },
  }
}

/** Whether this config advertises/accepts demo opaque tokens or API keys. */
export function authHasDemoCredentials(config: AuthConfig): boolean {
  return Object.keys(config.tokens).length > 0 || Object.keys(config.apiKeys ?? {}).length > 0
}

/**
 * In-process default for unit tests / createAppServer when auth is omitted.
 * Uses a non-public test secret and demo credentials — never the legacy public DEFAULT_JWT_SECRET.
 */
export const DEFAULT_AUTH: AuthConfig = buildAuthConfig({
  jwtSecret: TEST_JWT_SECRET,
  allowDemoCredentials: true,
})

function isRole(value: unknown): value is Role {
  return value === 'customer' || value === 'merchant' || value === 'agent'
}

function isAgentScope(value: unknown): value is AgentScope {
  return value === 'agent:customer' || value === 'agent:merchant'
}

function normalizeScopes(raw: unknown): AgentScope[] | undefined {
  if (raw === undefined || raw === null) return undefined
  if (!Array.isArray(raw)) return undefined
  const scopes = raw.filter(isAgentScope)
  return scopes
}

export function hasAgentScope(actor: Actor, scope: AgentScope): boolean {
  if (actor.role !== 'agent') return false
  return (actor.scopes ?? []).includes(scope)
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
  /** Agent scopes claim (required for agent surface access). */
  scopes?: AgentScope[]
  iat?: number
  exp?: number
}

/** Mint a compact HS256 JWT (no external deps). */
export function signJwt(claims: JwtClaims, secret: string): string {
  if (!claims.sub || !isRole(claims.role)) {
    throw new Error('signJwt requires sub and a valid role')
  }
  const scopes = normalizeScopes(claims.scopes)
  if (claims.role === 'agent' && scopes && scopes.length === 0) {
    throw new Error('signJwt agent scopes must be non-empty when provided')
  }
  const now = Math.floor(Date.now() / 1000)
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' })
  const payload = b64urlJson({
    sub: claims.sub,
    role: claims.role,
    ...(scopes && scopes.length > 0 ? { scopes } : {}),
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
  const scopes = normalizeScopes(claims.scopes)
  if (claims.scopes !== undefined && claims.scopes !== null && scopes === undefined) {
    unauthorized(
      'JWT scopes invalid',
      `scopes must be an array of ${AGENT_SCOPES.join(', ')}`,
    )
  }
  const actor: Actor = { role: claims.role, subject: claims.sub }
  if (claims.role === 'agent' && scopes && scopes.length > 0) {
    actor.scopes = scopes
  }
  return actor
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

/** Whether `actor` satisfies at least one entry in the route access list. */
export function actorMayAccess(actor: Actor, allowed: AccessPrincipal[]): boolean {
  for (const entry of allowed) {
    if (entry === 'agent:customer' || entry === 'agent:merchant') {
      if (hasAgentScope(actor, entry)) return true
      continue
    }
    // Bare 'agent' is never a grant (no default-on escape hatch).
    if (entry === 'agent') continue
    if (actor.role === entry) return true
  }
  return false
}

export function requireRole(actor: Actor, allowed: AccessPrincipal[]): void {
  if (!actorMayAccess(actor, allowed)) {
    const scopeHint =
      actor.role === 'agent'
        ? `; agent scopes=[${(actor.scopes ?? []).join(',') || 'none'}]`
        : ''
    throw new DomainError(
      'FORBIDDEN',
      `role ${actor.role} cannot access this route${scopeHint}`,
      {
        hint: `allowed: ${allowed.join(', ')}`,
        retryable: false,
      },
    )
  }
}

/**
 * Static capability matrix. Agent merchant/customer access requires the matching scope —
 * role `agent` alone never implies merchant (or customer) power.
 */
export function roleAllows(
  role: Role,
  surface: 'customer' | 'merchant' | 'agent' | 'audit',
  scopes: readonly AgentScope[] = [],
): boolean {
  switch (surface) {
    case 'customer':
      return role === 'customer' || (role === 'agent' && scopes.includes('agent:customer'))
    case 'merchant':
      return role === 'merchant' || (role === 'agent' && scopes.includes('agent:merchant'))
    case 'agent':
      return role === 'agent' && scopes.length > 0
    case 'audit':
      return role === 'merchant' || (role === 'agent' && scopes.includes('agent:merchant'))
    default:
      return false
  }
}
