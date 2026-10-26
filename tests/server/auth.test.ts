import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  DEFAULT_AUTH,
  DEFAULT_JWT_SECRET,
  authenticate,
  signJwt,
  verifyJwt,
  type AuthConfig,
} from '../../src/server/auth.js'
import { DomainError } from '../../src/domain/errors.js'
import { createAppServer } from '../../src/server/create-server.js'
import { MemoryRepository } from '../../src/repo/json-repository.js'

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
    const token = signJwt({ sub: 'agent_jwt', role: 'agent' }, DEFAULT_JWT_SECRET)
    const actor = verifyJwt(token, { secret: DEFAULT_JWT_SECRET })
    expect(actor).toEqual({ role: 'agent', subject: 'agent_jwt' })
  })

  it('rejects tampered JWT signatures', () => {
    const token = signJwt({ sub: 'x', role: 'customer' }, DEFAULT_JWT_SECRET)
    const [h, p] = token.split('.')
    const badSig = createHmac('sha256', 'wrong').update(`${h}.${p}`).digest('base64url')
    expect(() => verifyJwt(`${h}.${p}.${badSig}`, { secret: DEFAULT_JWT_SECRET })).toThrow(
      DomainError,
    )
  })

  it('rejects expired JWTs', () => {
    const token = signJwt(
      { sub: 'x', role: 'merchant', exp: Math.floor(Date.now() / 1000) - 60 },
      DEFAULT_JWT_SECRET,
    )
    expect(() => verifyJwt(token, { secret: DEFAULT_JWT_SECRET, clockSkewSec: 0 })).toThrow(
      DomainError,
    )
  })

  it('prefers opaque bearer tokens over JWT parsing', () => {
    const actor = authenticate(fakeReq({ authorization: 'Bearer customer-token' }), DEFAULT_AUTH)
    expect(actor.role).toBe('customer')
  })

  it('authenticates Bearer JWT when opaque lookup misses', () => {
    const jwt = signJwt({ sub: 'cust_from_jwt', role: 'customer' }, DEFAULT_JWT_SECRET)
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

      const jwt = signJwt({ sub: 'agent_http', role: 'agent' }, DEFAULT_JWT_SECRET)
      const byJwt = await fetch(`${baseUrl}/api/agent/products`, {
        headers: { authorization: `Bearer ${jwt}` },
      })
      expect(byJwt.status).toBe(200)
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
    const jwt = signJwt({ sub: 'a1', role: 'agent' }, 'custom-secret')
    expect(authenticate(fakeReq({ authorization: `Bearer ${jwt}` }), config)).toEqual({
      role: 'agent',
      subject: 'a1',
    })
  })
})
