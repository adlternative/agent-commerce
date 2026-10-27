import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_AUTH,
  DEFAULT_JWT_SECRET,
  DOCKER_INSECURE_JWT_SECRET,
  TEST_JWT_SECRET,
  authenticate,
  authHasDemoCredentials,
  buildAuthConfig,
  demoCredentialsEnabled,
  MissingJwtSecretError,
  resolveJwtSecret,
  signJwt,
  verifyJwt,
  type AuthConfig,
} from '../../src/server/auth.js'
import { DomainError } from '../../src/domain/errors.js'
import { createAppServer } from '../../src/server/create-server.js'
import { MemoryRepository } from '../../src/repo/json-repository.js'
import { buildAiCommerceDiscovery } from '../../src/ai/well-known.js'

function fakeReq(headers: Record<string, string | string[] | undefined>) {
  return { headers } as import('node:http').IncomingMessage
}

describe('API key + JWT auth', () => {
  it('accepts X-API-Key for each demo role', () => {
    expect(authenticate(fakeReq({ 'x-api-key': 'customer-key' }), DEFAULT_AUTH)).toEqual({
      role: 'customer',
      subject: 'cust_demo',
    })
    expect(authenticate(fakeReq({ 'x-api-key': 'merchant-key' }), DEFAULT_AUTH)).toEqual({
      role: 'merchant',
      subject: 'merchant_demo',
    })
    expect(authenticate(fakeReq({ 'x-api-key': 'agent-key' }), DEFAULT_AUTH)).toEqual({
      role: 'agent',
      subject: 'agent_demo',
      scopes: ['agent:customer'],
    })
    expect(authenticate(fakeReq({ 'x-api-key': 'agent-merchant-key' }), DEFAULT_AUTH)).toEqual({
      role: 'agent',
      subject: 'agent_merchant_demo',
      scopes: ['agent:merchant'],
    })
  })

  it('accepts Authorization: ApiKey', () => {
    expect(
      authenticate(fakeReq({ authorization: 'ApiKey agent-key' }), DEFAULT_AUTH).role,
    ).toBe('agent')
  })

  it('rejects unknown API keys', () => {
    expect(() => authenticate(fakeReq({ 'x-api-key': 'nope' }), DEFAULT_AUTH)).toThrow(DomainError)
    try {
      authenticate(fakeReq({ 'x-api-key': 'nope' }), DEFAULT_AUTH)
    } catch (e) {
      expect((e as DomainError).code).toBe('UNAUTHORIZED')
    }
  })

  it('mints and verifies HS256 JWTs without external deps', () => {
    const token = signJwt(
      { sub: 'agent_jwt', role: 'agent', scopes: ['agent:customer'] },
      TEST_JWT_SECRET,
    )
    const actor = verifyJwt(token, { secret: TEST_JWT_SECRET })
    expect(actor).toEqual({
      role: 'agent',
      subject: 'agent_jwt',
      scopes: ['agent:customer'],
    })
  })

  it('agent JWT without scopes authenticates but has no scopes claim', () => {
    const token = signJwt({ sub: 'agent_bare', role: 'agent' }, TEST_JWT_SECRET)
    const actor = verifyJwt(token, { secret: TEST_JWT_SECRET })
    expect(actor).toEqual({ role: 'agent', subject: 'agent_bare' })
    expect(actor.scopes).toBeUndefined()
  })

  it('rejects tampered JWT signatures', () => {
    const token = signJwt({ sub: 'x', role: 'customer' }, TEST_JWT_SECRET)
    const [h, p] = token.split('.')
    const badSig = createHmac('sha256', 'wrong').update(`${h}.${p}`).digest('base64url')
    expect(() => verifyJwt(`${h}.${p}.${badSig}`, { secret: TEST_JWT_SECRET })).toThrow(
      DomainError,
    )
  })

  it('rejects expired JWTs', () => {
    const token = signJwt(
      { sub: 'x', role: 'merchant', exp: Math.floor(Date.now() / 1000) - 60 },
      TEST_JWT_SECRET,
    )
    expect(() => verifyJwt(token, { secret: TEST_JWT_SECRET, clockSkewSec: 0 })).toThrow(
      DomainError,
    )
  })

  it('prefers opaque bearer tokens over JWT parsing', () => {
    const actor = authenticate(fakeReq({ authorization: 'Bearer customer-token' }), DEFAULT_AUTH)
    expect(actor.role).toBe('customer')
  })

  it('authenticates Bearer JWT when opaque lookup misses', () => {
    const jwt = signJwt({ sub: 'cust_from_jwt', role: 'customer' }, TEST_JWT_SECRET)
    const actor = authenticate(fakeReq({ authorization: `Bearer ${jwt}` }), DEFAULT_AUTH)
    expect(actor).toEqual({ role: 'customer', subject: 'cust_from_jwt' })
  })

  it('HTTP accepts API key and JWT on protected routes', async () => {
    const app = createAppServer({
      repo: new MemoryRepository(),
      rateLimit: { capacity: 100, refillPerSec: 10 },
    })
    const { baseUrl } = await app.listen(0)
    try {
      const byKey = await fetch(`${baseUrl}/api/customer/products`, {
        headers: { 'x-api-key': 'customer-key' },
      })
      expect(byKey.status).toBe(200)

      const jwt = signJwt(
        { sub: 'agent_http', role: 'agent', scopes: ['agent:customer'] },
        TEST_JWT_SECRET,
      )
      const byJwt = await fetch(`${baseUrl}/api/agent/products`, {
        headers: { authorization: `Bearer ${jwt}` },
      })
      expect(byJwt.status).toBe(200)

      const bareAgentJwt = signJwt({ sub: 'agent_no_scope', role: 'agent' }, TEST_JWT_SECRET)
      const denied = await fetch(`${baseUrl}/api/merchant/metrics`, {
        headers: { authorization: `Bearer ${bareAgentJwt}` },
      })
      expect(denied.status).toBe(403)
      const deniedBody = (await denied.json()) as { code: string }
      expect(deniedBody.code).toBe('FORBIDDEN')

      const merchantScoped = signJwt(
        { sub: 'agent_m', role: 'agent', scopes: ['agent:merchant'] },
        TEST_JWT_SECRET,
      )
      const merchantOk = await fetch(`${baseUrl}/api/merchant/metrics`, {
        headers: { authorization: `Bearer ${merchantScoped}` },
      })
      expect(merchantOk.status).toBe(200)
    } finally {
      await app.close()
    }
  })

  it('works with custom apiKeys + jwt secret', () => {
    const config: AuthConfig = {
      tokens: {},
      apiKeys: { 'prod-key': { role: 'merchant', subject: 'm1' } },
      jwt: { secret: 'custom-secret' },
    }
    expect(authenticate(fakeReq({ 'x-api-key': 'prod-key' }), config).subject).toBe('m1')
    const jwt = signJwt(
      { sub: 'a1', role: 'agent', scopes: ['agent:merchant'] },
      'custom-secret',
    )
    expect(authenticate(fakeReq({ authorization: `Bearer ${jwt}` }), config)).toEqual({
      role: 'agent',
      subject: 'a1',
      scopes: ['agent:merchant'],
    })
  })

  it('opaque agent-token carries agent:customer only', () => {
    expect(authenticate(fakeReq({ authorization: 'Bearer agent-token' }), DEFAULT_AUTH)).toEqual({
      role: 'agent',
      subject: 'agent_demo',
      scopes: ['agent:customer'],
    })
    expect(
      authenticate(fakeReq({ authorization: 'Bearer agent-merchant-token' }), DEFAULT_AUTH),
    ).toEqual({
      role: 'agent',
      subject: 'agent_merchant_demo',
      scopes: ['agent:merchant'],
    })
  })
})

describe('fail-closed JWT secret + demo credentials (ACP-19 / #654)', () => {
  it('refuses resolveJwtSecret in production without JWT_SECRET', () => {
    expect(() => resolveJwtSecret({ NODE_ENV: 'production' })).toThrow(MissingJwtSecretError)
    expect(() => buildAuthConfig({ env: { NODE_ENV: 'production' } })).toThrow(
      MissingJwtSecretError,
    )
    try {
      resolveJwtSecret({ NODE_ENV: 'production' })
      expect.unreachable('expected MissingJwtSecretError')
    } catch (err) {
      expect(err).toBeInstanceOf(MissingJwtSecretError)
      expect((err as Error).message).toMatch(/openssl rand -hex 32/)
    }
  })

  it('uses JWT_SECRET from env in production and disables demos by default', () => {
    const auth = buildAuthConfig({
      env: { NODE_ENV: 'production', JWT_SECRET: 'prod-only-secret' },
    })
    expect(auth.jwt?.secret).toBe('prod-only-secret')
    expect(authHasDemoCredentials(auth)).toBe(false)
    expect(Object.keys(auth.tokens)).toHaveLength(0)
  })

  it('ALLOW_DEMO_TOKENS=1 re-enables demo credentials in production', () => {
    expect(
      demoCredentialsEnabled({ NODE_ENV: 'production', ALLOW_DEMO_TOKENS: '1' }),
    ).toBe(true)
    const auth = buildAuthConfig({
      env: {
        NODE_ENV: 'production',
        JWT_SECRET: 'prod-only-secret',
        ALLOW_DEMO_TOKENS: '1',
      },
    })
    expect(auth.tokens['merchant-token']?.role).toBe('merchant')
  })

  it('non-production without JWT_SECRET gets an ephemeral secret (not the legacy default)', () => {
    const a = resolveJwtSecret({ NODE_ENV: 'development' })
    const b = resolveJwtSecret({ NODE_ENV: 'development' })
    expect(a).not.toBe(DEFAULT_JWT_SECRET)
    expect(b).not.toBe(DEFAULT_JWT_SECRET)
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(32)
  })

  it('DEFAULT_AUTH must not use the legacy public DEFAULT_JWT_SECRET', () => {
    expect(DEFAULT_AUTH.jwt?.secret).toBe(TEST_JWT_SECRET)
    expect(DEFAULT_AUTH.jwt?.secret).not.toBe(DEFAULT_JWT_SECRET)
  })

  /**
   * Security regression: forging a merchant JWT with the old hardcoded secret MUST 401.
   * Before the fix this returned 200 — that failure is the proof the gate works.
   */
  it('rejects merchant JWT forged with DEFAULT_JWT_SECRET (legacy public secret)', async () => {
    const auth = buildAuthConfig({
      jwtSecret: 'server-secret-not-legacy',
      allowDemoCredentials: false,
    })
    const app = createAppServer({
      repo: new MemoryRepository(),
      auth,
      rateLimit: { capacity: 100, refillPerSec: 10 },
    })
    const { baseUrl } = await app.listen(0)
    try {
      const forged = signJwt(
        { sub: 'attacker', role: 'merchant', exp: 9_999_999_999 },
        DEFAULT_JWT_SECRET,
      )
      const metrics = await fetch(`${baseUrl}/api/merchant/metrics`, {
        headers: { authorization: `Bearer ${forged}` },
      })
      expect(metrics.status).toBe(401)
      const metricsBody = (await metrics.json()) as { code: string }
      expect(metricsBody.code).toBe('UNAUTHORIZED')

      const orders = await fetch(`${baseUrl}/api/merchant/orders`, {
        headers: { authorization: `Bearer ${forged}` },
      })
      expect(orders.status).toBe(401)

      const demo = await fetch(`${baseUrl}/api/merchant/metrics`, {
        headers: { authorization: 'Bearer merchant-token' },
      })
      expect(demo.status).toBe(401)
    } finally {
      await app.close()
    }
  })

  /**
   * ACP-30 / #680: docker-compose used to default JWT_SECRET to a known string while
   * NODE_ENV=production. Forging a merchant JWT with that secret MUST 401.
   */
  it('rejects merchant JWT forged with DOCKER_INSECURE_JWT_SECRET (compose default)', async () => {
    expect(DOCKER_INSECURE_JWT_SECRET).toBe('dev-docker-change-me')
    const auth = buildAuthConfig({
      jwtSecret: 'server-secret-not-docker-default',
      allowDemoCredentials: false,
    })
    const app = createAppServer({
      repo: new MemoryRepository(),
      auth,
      rateLimit: { capacity: 100, refillPerSec: 10 },
    })
    const { baseUrl } = await app.listen(0)
    try {
      const forged = signJwt(
        { sub: 'anon', role: 'merchant', exp: 9_999_999_999 },
        DOCKER_INSECURE_JWT_SECRET,
      )
      const metrics = await fetch(`${baseUrl}/api/merchant/metrics`, {
        headers: { authorization: `Bearer ${forged}` },
      })
      expect(metrics.status).toBe(401)
      const metricsBody = (await metrics.json()) as { code: string }
      expect(metricsBody.code).toBe('UNAUTHORIZED')

      const orders = await fetch(`${baseUrl}/api/merchant/orders`, {
        headers: { authorization: `Bearer ${forged}` },
      })
      expect(orders.status).toBe(401)
      expect(((await orders.json()) as { code: string }).code).toBe('UNAUTHORIZED')
    } finally {
      await app.close()
    }
  })

  it('docker-compose requires JWT_SECRET and defaults ALLOW_DEMO_TOKENS to 0', () => {
    const compose = readFileSync(join(process.cwd(), 'docker-compose.yml'), 'utf8')
    expect(compose).not.toMatch(/dev-docker-change-me/)
    expect(compose).toMatch(/JWT_SECRET:\s*\$\{JWT_SECRET:\?/)
    expect(compose).toMatch(/ALLOW_DEMO_TOKENS:\s*\$\{ALLOW_DEMO_TOKENS:-0\}/)
    expect(compose).not.toMatch(/ALLOW_DEMO_TOKENS:\s*\$\{ALLOW_DEMO_TOKENS:-1\}/)
  })

  it('well-known omits all demo tokens when demo credentials are off', async () => {
    const auth = buildAuthConfig({
      jwtSecret: 'server-secret-not-legacy',
      allowDemoCredentials: false,
    })
    expect(authHasDemoCredentials(auth)).toBe(false)

    const doc = buildAiCommerceDiscovery('http://127.0.0.1:9', {
      includeDemoCredentials: false,
    }) as {
      authentication: {
        bearer: { tokens?: unknown }
        apiKey: { keys?: unknown }
        tokens?: unknown
        demoCredentials: string
      }
    }
    expect(doc.authentication.bearer.tokens).toBeUndefined()
    expect(doc.authentication.apiKey.keys).toBeUndefined()
    expect(doc.authentication.tokens).toBeUndefined()
    expect(doc.authentication.demoCredentials).toBe('disabled')

    const app = createAppServer({
      repo: new MemoryRepository(),
      auth,
      rateLimit: { capacity: 100, refillPerSec: 10 },
    })
    const { baseUrl } = await app.listen(0)
    try {
      const res = await fetch(`${baseUrl}/.well-known/ai-commerce.json`)
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        authentication: {
          bearer: { tokens?: unknown }
          apiKey: { keys?: unknown }
          tokens?: unknown
        }
      }
      expect(body.authentication.bearer.tokens).toBeUndefined()
      expect(body.authentication.apiKey.keys).toBeUndefined()
      expect(body.authentication.tokens).toBeUndefined()
      const serialized = JSON.stringify(body)
      expect(serialized).not.toContain('customer-token')
      expect(serialized).not.toContain('merchant-token')
      expect(serialized).not.toContain('agent-token')
      expect(serialized).not.toContain('agent-merchant-token')
      expect(serialized).not.toContain('customer-key')
      expect(serialized).not.toContain('merchant-key')
    } finally {
      await app.close()
    }
  })
})
