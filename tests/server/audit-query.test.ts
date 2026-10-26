import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AuditLog } from '../../src/ai/audit.js'
import { createAppServer, type AppServer } from '../../src/server/create-server.js'
import { MemoryRepository } from '../../src/repo/json-repository.js'

describe('AuditLog.query', () => {
  it('filters by actor, role, path, status, and code', () => {
    const log = new AuditLog(100)
    log.record({
      actor: 'a1',
      role: 'agent',
      method: 'GET',
      path: '/api/agent/products',
      status: 200,
      durationMs: 1,
      at: '2025-12-01T00:00:00.000Z',
    })
    log.record({
      actor: 'm1',
      role: 'merchant',
      method: 'POST',
      path: '/api/merchant/products',
      status: 403,
      code: 'FORBIDDEN',
      durationMs: 2,
      at: '2026-01-01T00:00:00.000Z',
    })
    log.record({
      actor: 'a1',
      role: 'agent',
      method: 'GET',
      path: '/api/agent/audit',
      status: 429,
      code: 'RATE_LIMITED',
      durationMs: 3,
      traceId: 'tr_1',
      at: '2026-06-01T00:00:00.000Z',
    })

    expect(log.query({ actor: 'a1' })).toHaveLength(2)
    expect(log.query({ role: 'merchant' })).toHaveLength(1)
    expect(log.query({ pathPrefix: '/api/merchant' })[0]?.actor).toBe('m1')
    expect(log.query({ pathContains: 'audit' })).toHaveLength(1)
    expect(log.query({ status: 429, code: 'RATE_LIMITED' })).toHaveLength(1)
    expect(log.query({ method: 'post' })[0]?.role).toBe('merchant')
    expect(log.query({ traceId: 'tr_1' })).toHaveLength(1)
    expect(log.query({ since: '2026-03-01T00:00:00.000Z' })).toHaveLength(1)
    expect(log.query({ until: '2025-12-15T00:00:00.000Z' })).toHaveLength(1)
    expect(log.query({ until: '2026-02-01T00:00:00.000Z' })).toHaveLength(2)
    expect(log.query({ limit: 1 })).toHaveLength(1)
  })

  it('list remains a newest-window helper', () => {
    const log = new AuditLog(2)
    log.record({
      actor: '1',
      role: 'agent',
      method: 'GET',
      path: '/a',
      status: 200,
      durationMs: 1,
    })
    log.record({
      actor: '2',
      role: 'agent',
      method: 'GET',
      path: '/b',
      status: 200,
      durationMs: 1,
    })
    log.record({
      actor: '3',
      role: 'agent',
      method: 'GET',
      path: '/c',
      status: 200,
      durationMs: 1,
    })
    expect(log.list()).toEqual(log.query({ limit: 50 }))
    expect(log.list(2).map((e) => e.actor)).toEqual(['2', '3'])
  })
})

describe('audit query HTTP API', () => {
  let app: AppServer
  let baseUrl: string

  beforeAll(async () => {
    app = createAppServer({
      repo: new MemoryRepository(),
      rateLimit: { capacity: 200, refillPerSec: 50 },
    })
    ;({ baseUrl } = await app.listen(0))

    // Generate distinct audit rows
    await fetch(`${baseUrl}/api/customer/products`, {
      headers: { authorization: 'Bearer customer-token', 'x-trace-id': 'audit_trace_cust' },
    })
    await fetch(`${baseUrl}/api/merchant/metrics`, {
      headers: { authorization: 'Bearer merchant-token' },
    })
    await fetch(`${baseUrl}/api/agent/products`, {
      headers: { authorization: 'Bearer agent-token', 'x-trace-id': 'audit_trace_agent' },
    })
    // Forced 403 for filterable code
    await fetch(`${baseUrl}/api/merchant/metrics`, {
      headers: { authorization: 'Bearer customer-token' },
    })
  })

  afterAll(async () => {
    await app.close()
  })

  it('queries with filters via GET /api/agent/audit', async () => {
    const res = await fetch(
      `${baseUrl}/api/agent/audit?role=agent&pathPrefix=/api/agent&limit=20`,
      { headers: { authorization: 'Bearer agent-merchant-token' } },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      count: number
      events: Array<{ role: string; path: string; traceId?: string }>
    }
    expect(body.count).toBe(body.events.length)
    expect(body.events.length).toBeGreaterThan(0)
    expect(body.events.every((e) => e.role === 'agent')).toBe(true)
    expect(body.events.every((e) => e.path.startsWith('/api/agent'))).toBe(true)
  })

  it('filters by status/code and traceId', async () => {
    const forbidden = await fetch(`${baseUrl}/api/agent/audit?status=403&code=FORBIDDEN`, {
      headers: { 'x-api-key': 'merchant-key' },
    })
    const forbiddenBody = (await forbidden.json()) as {
      events: Array<{ status: number; code?: string }>
    }
    expect(forbiddenBody.events.length).toBeGreaterThan(0)
    expect(forbiddenBody.events.every((e) => e.status === 403 && e.code === 'FORBIDDEN')).toBe(
      true,
    )

    const byTrace = await fetch(`${baseUrl}/api/merchant/audit?traceId=audit_trace_agent`, {
      headers: { authorization: 'Bearer merchant-token' },
    })
    const traced = (await byTrace.json()) as { events: Array<{ traceId?: string }> }
    expect(traced.events.length).toBeGreaterThan(0)
    expect(traced.events.every((e) => e.traceId === 'audit_trace_agent')).toBe(true)
  })

  it('rejects customer on audit query routes', async () => {
    const res = await fetch(`${baseUrl}/api/agent/audit`, {
      headers: { authorization: 'Bearer customer-token' },
    })
    expect(res.status).toBe(403)
  })
})
