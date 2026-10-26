import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAppServer, type AppServer } from '../../src/server/create-server.js'
import { MemoryRepository } from '../../src/repo/json-repository.js'
import { TokenBucket } from '../../src/ai/rate-limit.js'
import { paginate, encodeCursor, decodeCursor } from '../../src/ai/pagination.js'
import { AuditLog } from '../../src/ai/audit.js'
import { DomainError } from '../../src/domain/errors.js'
import { buildAiCommerceDiscovery } from '../../src/ai/well-known.js'

describe('token bucket', () => {
  it('allows bursts then rate-limits', () => {
    const bucket = new TokenBucket(2, 0)
    bucket.take('a')
    bucket.take('a')
    expect(() => bucket.take('a')).toThrow(DomainError)
    try {
      bucket.take('a')
    } catch (e) {
      expect((e as DomainError).code).toBe('RATE_LIMITED')
      expect((e as DomainError).retryable).toBe(true)
    }
  })
})

describe('cursor pagination', () => {
  it('pages stably with nextCursor', () => {
    const items = [1, 2, 3, 4, 5]
    const page1 = paginate(items, { limit: 2 })
    expect(page1.items).toEqual([1, 2])
    expect(page1.hasMore).toBe(true)
    const page2 = paginate(items, { cursor: page1.nextCursor, limit: 2 })
    expect(page2.items).toEqual([3, 4])
    const page3 = paginate(items, { cursor: page2.nextCursor, limit: 2 })
    expect(page3.items).toEqual([5])
    expect(page3.hasMore).toBe(false)
    expect(page3.nextCursor).toBeNull()
    expect(decodeCursor(encodeCursor(3))).toBe(3)
  })
})

describe('audit log', () => {
  it('keeps a ring of events', () => {
    const log = new AuditLog(2)
    log.record({
      actor: 'a',
      role: 'agent',
      method: 'GET',
      path: '/x',
      status: 200,
      durationMs: 1,
    })
    log.record({
      actor: 'b',
      role: 'agent',
      method: 'GET',
      path: '/y',
      status: 200,
      durationMs: 2,
    })
    log.record({
      actor: 'c',
      role: 'agent',
      method: 'GET',
      path: '/z',
      status: 200,
      durationMs: 3,
    })
    expect(log.list()).toHaveLength(2)
    expect(log.list()[0]?.actor).toBe('b')
  })
})

describe('AI HTTP adapter integration', () => {
  let app: AppServer
  let baseUrl: string

  beforeAll(async () => {
    app = createAppServer({
      repo: new MemoryRepository(),
      rateLimit: { capacity: 100, refillPerSec: 10 },
    })
    ;({ baseUrl } = await app.listen(0))
    await fetch(`${baseUrl}/api/merchant/products`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer merchant-token',
        'content-type': 'application/json',
        'idempotency-key': 'ai-seed',
      },
      body: JSON.stringify({ sku: 'Z', name: 'Z', priceCents: 100 }),
    })
  })

  afterAll(async () => {
    await app.close()
  })

  it('serves /.well-known/ai-commerce.json', async () => {
    const res = await fetch(`${baseUrl}/.well-known/ai-commerce.json`)
    expect(res.status).toBe(200)
    const doc = (await res.json()) as {
      mcp: { tools: unknown[] }
      conventions: { idempotencyHeader: string }
    }
    expect(doc.conventions.idempotencyHeader).toBe('Idempotency-Key')
    expect(doc.mcp.tools.length).toBe(16)
    expect(buildAiCommerceDiscovery().wellKnown).toBe('/.well-known/ai-commerce.json')
  })

  it('paginates agent products with cursor', async () => {
    for (let i = 0; i < 4; i++) {
      await fetch(`${baseUrl}/api/merchant/products`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer merchant-token',
          'content-type': 'application/json',
          'idempotency-key': `ai-seed-${i}`,
        },
        body: JSON.stringify({ sku: `S${i}`, name: `S${i}`, priceCents: 100 + i }),
      })
    }
    const res = await fetch(`${baseUrl}/api/agent/products?limit=2`, {
      headers: { authorization: 'Bearer agent-token' },
    })
    const page = (await res.json()) as {
      items: unknown[]
      nextCursor: string | null
      hasMore: boolean
    }
    expect(page.items).toHaveLength(2)
    expect(page.hasMore).toBe(true)
    const res2 = await fetch(
      `${baseUrl}/api/agent/products?limit=2&cursor=${encodeURIComponent(page.nextCursor!)}`,
      { headers: { authorization: 'Bearer agent-token' } },
    )
    const page2 = (await res2.json()) as { items: unknown[]; hasMore: boolean }
    expect(page2.items.length).toBeGreaterThan(0)
  })

  it('records audit events and exposes them', async () => {
    await fetch(`${baseUrl}/api/agent/products`, {
      headers: { authorization: 'Bearer agent-token' },
    })
    const res = await fetch(`${baseUrl}/api/agent/audit?limit=10`, {
      headers: { authorization: 'Bearer agent-token' },
    })
    const body = (await res.json()) as { events: { path: string }[] }
    expect(body.events.some((e) => e.path.includes('/api/'))).toBe(true)
  })
})

describe('AI rate limit HTTP', () => {
  it('returns 429 with structured RATE_LIMITED error', async () => {
    const app = createAppServer({
      repo: new MemoryRepository(),
      rateLimit: { capacity: 1, refillPerSec: 0 },
    })
    const { baseUrl } = await app.listen(0)
    try {
      const ok = await fetch(`${baseUrl}/api/agent/products`, {
        headers: { authorization: 'Bearer agent-token' },
      })
      expect(ok.status).toBe(200)
      const limited = await fetch(`${baseUrl}/api/agent/products`, {
        headers: { authorization: 'Bearer agent-token' },
      })
      expect(limited.status).toBe(429)
      const body = (await limited.json()) as { code: string; retryable: boolean }
      expect(body).toMatchObject({ code: 'RATE_LIMITED', retryable: true })
    } finally {
      await app.close()
    }
  })
})
