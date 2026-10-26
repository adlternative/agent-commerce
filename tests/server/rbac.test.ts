import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAppServer, type AppServer } from '../../src/server/create-server.js'
import { MemoryRepository } from '../../src/repo/json-repository.js'
import {
  roleAllows,
  requireRole,
  actorMayAccess,
  type Actor,
} from '../../src/server/auth.js'
import { DomainError } from '../../src/domain/errors.js'

describe('three-role RBAC matrix with agent scopes', () => {
  it('documents customer / merchant / agent surfaces (scopes required for agents)', () => {
    expect(roleAllows('customer', 'customer')).toBe(true)
    expect(roleAllows('customer', 'merchant')).toBe(false)
    expect(roleAllows('customer', 'agent')).toBe(false)
    expect(roleAllows('customer', 'audit')).toBe(false)

    expect(roleAllows('merchant', 'merchant')).toBe(true)
    expect(roleAllows('merchant', 'customer')).toBe(false)
    expect(roleAllows('merchant', 'agent')).toBe(false)
    expect(roleAllows('merchant', 'audit')).toBe(true)

    // Agent role alone — no implicit customer/merchant/audit power
    expect(roleAllows('agent', 'customer')).toBe(false)
    expect(roleAllows('agent', 'merchant')).toBe(false)
    expect(roleAllows('agent', 'agent')).toBe(false)
    expect(roleAllows('agent', 'audit')).toBe(false)

    expect(roleAllows('agent', 'customer', ['agent:customer'])).toBe(true)
    expect(roleAllows('agent', 'merchant', ['agent:customer'])).toBe(false)
    expect(roleAllows('agent', 'agent', ['agent:customer'])).toBe(true)
    expect(roleAllows('agent', 'audit', ['agent:customer'])).toBe(false)

    expect(roleAllows('agent', 'customer', ['agent:merchant'])).toBe(false)
    expect(roleAllows('agent', 'merchant', ['agent:merchant'])).toBe(true)
    expect(roleAllows('agent', 'agent', ['agent:merchant'])).toBe(true)
    expect(roleAllows('agent', 'audit', ['agent:merchant'])).toBe(true)
  })

  it('requireRole / actorMayAccess enforce scopes (no bare-agent escape hatch)', () => {
    const customer: Actor = { role: 'customer', subject: 'c' }
    expect(() => requireRole(customer, ['merchant', 'agent:merchant'])).toThrow(DomainError)
    try {
      requireRole(customer, ['merchant'])
    } catch (e) {
      expect((e as DomainError).code).toBe('FORBIDDEN')
      expect((e as DomainError).retryable).toBe(false)
    }
    expect(() => requireRole(customer, ['customer', 'agent:customer'])).not.toThrow()

    const agentNoScope: Actor = { role: 'agent', subject: 'a' }
    expect(actorMayAccess(agentNoScope, ['agent'])).toBe(false)
    expect(actorMayAccess(agentNoScope, ['agent:customer'])).toBe(false)
    expect(actorMayAccess(agentNoScope, ['merchant', 'agent:merchant'])).toBe(false)

    const agentCustomer: Actor = {
      role: 'agent',
      subject: 'ac',
      scopes: ['agent:customer'],
    }
    expect(actorMayAccess(agentCustomer, ['customer', 'agent:customer'])).toBe(true)
    expect(actorMayAccess(agentCustomer, ['merchant', 'agent:merchant'])).toBe(false)
    expect(() => requireRole(agentCustomer, ['merchant', 'agent:merchant'])).toThrow(DomainError)

    const agentMerchant: Actor = {
      role: 'agent',
      subject: 'am',
      scopes: ['agent:merchant'],
    }
    expect(actorMayAccess(agentMerchant, ['merchant', 'agent:merchant'])).toBe(true)
    expect(actorMayAccess(agentMerchant, ['customer', 'agent:customer'])).toBe(false)
  })
})

describe('HTTP RBAC enforcement', () => {
  let app: AppServer
  let baseUrl: string

  beforeAll(async () => {
    app = createAppServer({
      repo: new MemoryRepository(),
      rateLimit: { capacity: 200, refillPerSec: 50 },
    })
    ;({ baseUrl } = await app.listen(0))
  })

  afterAll(async () => {
    await app.close()
  })

  async function hit(path: string, token: string) {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    const json = (await res.json()) as { code?: string }
    return { status: res.status, code: json.code }
  }

  it('blocks customer from merchant and agent-only routes', async () => {
    const merchant = await hit('/api/merchant/metrics', 'customer-token')
    expect(merchant).toMatchObject({ status: 403, code: 'FORBIDDEN' })

    const agentOnly = await hit('/api/agent/products', 'customer-token')
    expect(agentOnly).toMatchObject({ status: 403, code: 'FORBIDDEN' })

    const audit = await hit('/api/agent/audit', 'customer-token')
    expect(audit).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('blocks merchant from customer and agent-only routes', async () => {
    const customer = await hit('/api/customer/products', 'merchant-token')
    expect(customer).toMatchObject({ status: 403, code: 'FORBIDDEN' })

    const agentOnly = await hit('/api/agent/products', 'merchant-token')
    expect(agentOnly).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('allows merchant audit; agent:customer cannot; agent:merchant can', async () => {
    const merchantAudit = await hit('/api/merchant/audit?limit=5', 'merchant-token')
    expect(merchantAudit.status).toBe(200)

    const agentCustomerAudit = await hit('/api/agent/audit?limit=5', 'agent-token')
    expect(agentCustomerAudit).toMatchObject({ status: 403, code: 'FORBIDDEN' })

    const agentMerchantAudit = await hit('/api/agent/audit?limit=5', 'agent-merchant-token')
    expect(agentMerchantAudit.status).toBe(200)

    const customerAudit = await hit('/api/merchant/audit', 'customer-token')
    expect(customerAudit).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('matrix: customer | agent:customer | agent:merchant × four routes', async () => {
    const tokens = [
      'customer-token',
      'agent-token', // agent:customer only
      'agent-merchant-token', // agent:merchant only
    ] as const
    const routes = [
      '/api/customer/products',
      '/api/merchant/metrics',
      '/api/agent/products',
      '/api/agent/audit?limit=5',
    ] as const

    // expected status [tokenIndex][routeIndex]
    const expected: number[][] = [
      // customer-token
      [200, 403, 403, 403],
      // agent:customer
      [200, 403, 200, 403],
      // agent:merchant
      [403, 200, 403, 200],
    ]

    for (let t = 0; t < tokens.length; t++) {
      for (let r = 0; r < routes.length; r++) {
        const result = await hit(routes[r]!, tokens[t]!)
        expect(
          result.status,
          `${tokens[t]} → ${routes[r]}`,
        ).toBe(expected[t]![r])
        if (expected[t]![r] === 403) {
          expect(result.code).toBe('FORBIDDEN')
        }
      }
    }
  })
})
