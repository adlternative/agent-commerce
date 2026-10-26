import { describe, expect, it } from 'vitest'
import { TokenBucket } from '../../src/ai/rate-limit.js'
import { DomainError } from '../../src/domain/errors.js'
import { createAppServer } from '../../src/server/create-server.js'
import { MemoryRepository } from '../../src/repo/json-repository.js'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('token bucket pressure', () => {
  it('allows exactly capacity under synchronous burst pressure', () => {
    const bucket = new TokenBucket(10, 0)
    let ok = 0
    let limited = 0
    for (let i = 0; i < 40; i++) {
      try {
        bucket.take('burst')
        ok += 1
      } catch (e) {
        expect((e as DomainError).code).toBe('RATE_LIMITED')
        limited += 1
      }
    }
    expect(ok).toBe(10)
    expect(limited).toBe(30)
  })

  it('isolates keys under interleaved pressure', () => {
    const bucket = new TokenBucket(3, 0)
    for (let i = 0; i < 3; i++) bucket.take('a')
    expect(() => bucket.take('a')).toThrow(DomainError)
    // sibling key still has full capacity
    bucket.take('b')
    bucket.take('b')
    bucket.take('b')
    expect(() => bucket.take('b')).toThrow(DomainError)
  })

  it('refills after time under sustained pressure', async () => {
    const bucket = new TokenBucket(1, 50) // 50 tokens/sec
    bucket.take('r')
    expect(() => bucket.take('r')).toThrow(DomainError)
    await sleep(30)
    expect(() => bucket.take('r')).not.toThrow()
  })

  it('reports retryAfterSec when empty', () => {
    const bucket = new TokenBucket(1, 1)
    bucket.take('x')
    expect(bucket.retryAfterSec('x')).toBeGreaterThanOrEqual(1)
  })

  it('survives concurrent microtask storm with exact capacity wins', async () => {
    const capacity = 8
    const bucket = new TokenBucket(capacity, 0)
    const results = await Promise.all(
      Array.from({ length: 50 }, async () => {
        try {
          bucket.take('storm')
          return 'ok' as const
        } catch {
          return 'limited' as const
        }
      }),
    )
    expect(results.filter((r) => r === 'ok')).toHaveLength(capacity)
    expect(results.filter((r) => r === 'limited')).toHaveLength(50 - capacity)
  })
})

describe('HTTP rate limit pressure', () => {
  it('returns 429 + Retry-After under parallel request pressure', async () => {
    const capacity = 5
    const app = createAppServer({
      repo: new MemoryRepository(),
      rateLimit: { capacity, refillPerSec: 0 },
    })
    const { baseUrl } = await app.listen(0)
    try {
      const responses = await Promise.all(
        Array.from({ length: 25 }, () =>
          fetch(`${baseUrl}/api/agent/products`, {
            headers: { authorization: 'Bearer agent-token' },
          }),
        ),
      )
      const statuses = responses.map((r) => r.status)
      const ok = statuses.filter((s) => s === 200).length
      const limited = statuses.filter((s) => s === 429).length
      expect(ok).toBe(capacity)
      expect(limited).toBe(25 - capacity)

      const sample429 = responses.find((r) => r.status === 429)!
      expect(sample429.headers.get('retry-after')).toBeTruthy()
      const body = (await sample429.json()) as { code: string; retryable: boolean }
      expect(body).toMatchObject({ code: 'RATE_LIMITED', retryable: true })
    } finally {
      await app.close()
    }
  })

  it('does not share budgets across different subjects', async () => {
    const app = createAppServer({
      repo: new MemoryRepository(),
      rateLimit: { capacity: 2, refillPerSec: 0 },
      auth: {
        tokens: {
          'agent-a': {
            role: 'agent',
            subject: 'agent_a',
            scopes: ['agent:customer'],
          },
          'agent-b': {
            role: 'agent',
            subject: 'agent_b',
            scopes: ['agent:customer'],
          },
        },
        apiKeys: {},
      },
    })
    const { baseUrl } = await app.listen(0)
    try {
      for (let i = 0; i < 2; i++) {
        const res = await fetch(`${baseUrl}/api/agent/products`, {
          headers: { authorization: 'Bearer agent-a' },
        })
        expect(res.status).toBe(200)
      }
      const limitedA = await fetch(`${baseUrl}/api/agent/products`, {
        headers: { authorization: 'Bearer agent-a' },
      })
      expect(limitedA.status).toBe(429)

      const okB = await fetch(`${baseUrl}/api/agent/products`, {
        headers: { authorization: 'Bearer agent-b' },
      })
      expect(okB.status).toBe(200)
    } finally {
      await app.close()
    }
  })
})
