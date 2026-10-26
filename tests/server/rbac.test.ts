import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAppServer, type AppServer } from '../../src/server/create-server.js'
import { MemoryRepository } from '../../src/repo/json-repository.js'
import { roleAllows, requireRole, type Actor } from '../../src/server/auth.js'
import { DomainError } from '../../src/domain/errors.js'

describe('three-role RBAC matrix', () => {
  it('documents customer / merchant / agent surfaces', () => {
    expect(roleAllows('customer', 'customer')).toBe(true)
    expect(roleAllows('customer', 'merchant')).toBe(false)
    expect(roleAllows('customer', 'agent')).toBe(false)
    expect(roleAllows('customer', 'audit')).toBe(false)

    expect(roleAllows('merchant', 'merchant')).toBe(true)
    expect(roleAllows('merchant', 'customer')).toBe(false)
    expect(roleAllows('merchant', 'agent')).toBe(false)
    expect(roleAllows('merchant', 'audit')).toBe(true)

    expect(roleAllows('agent', 'customer')).toBe(true)
    expect(roleAllows('agent', 'merchant')).toBe(true)
    expect(roleAllows('agent', 'agent')).toBe(true)
    expect(roleAllows('agent', 'audit')).toBe(true)
  })

  it('requireRole throws FORBIDDEN for disallowed roles', () => {
    const customer: Actor = { role: 'customer', subject: 'c' }
    expect(() => requireRole(customer, ['merchant', 'agent'])).toThrow(DomainError)
    try {
      requireRole(customer, ['merchant'])
    } catch (e) {
      expect((e as DomainError).code).toBe('FORBIDDEN')
      expect((e as DomainError).retryable).toBe(false)
    }
    expect(() => requireRole(customer, ['customer', 'agent'])).not.toThrow()
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

  it('allows merchant and agent to query audit; customer cannot', async () => {
    const merchantAudit = await hit('/api/merchant/audit?limit=5', 'merchant-token')
    expect(merchantAudit.status).toBe(200)

    const agentAudit = await hit('/api/agent/audit?limit=5', 'agent-token')
    expect(agentAudit.status).toBe(200)

    const customerAudit = await hit('/api/merchant/audit', 'customer-token')
    expect(customerAudit).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('allows agent across customer and merchant surfaces', async () => {
    expect((await hit('/api/customer/products', 'agent-token')).status).toBe(200)
    expect((await hit('/api/merchant/metrics', 'agent-token')).status).toBe(200)
    expect((await hit('/api/agent/products', 'agent-token')).status).toBe(200)
  })
})
