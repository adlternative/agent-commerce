import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAppServer, type AppServer } from '../../src/server/create-server.js'
import { MemoryRepository } from '../../src/repo/json-repository.js'

type ProductPage = {
  items: Array<{ id: string; sku: string; name: string }>
  nextCursor: string | null
  hasMore: boolean
}

async function getJson(
  baseUrl: string,
  path: string,
  token: string,
): Promise<{ status: number; body: ProductPage }> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  const body = (await res.json()) as ProductPage
  return { status: res.status, body }
}

describe('product list pagination envelope', () => {
  let app: AppServer
  let baseUrl: string

  beforeAll(async () => {
    app = createAppServer({ repo: new MemoryRepository() })
    ;({ baseUrl } = await app.listen(0))

    for (let i = 1; i <= 5; i += 1) {
      const res = await fetch(`${baseUrl}/api/merchant/products`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer merchant-token',
          'content-type': 'application/json',
          'idempotency-key': `page-seed-${i}`,
        },
        body: JSON.stringify({
          sku: `PAGE-${i}`,
          name: `Page Product ${i}`,
          priceCents: 1000 + i,
          tags: ['paging'],
          agentNotes: `Fixture ${i} for cursor pages.`,
        }),
      })
      expect(res.status).toBe(200)
    }
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /api/customer/products without limit returns {items,nextCursor} (full set)', async () => {
    const { status, body } = await getJson(baseUrl, '/api/customer/products', 'customer-token')
    expect(status).toBe(200)
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items.length).toBeGreaterThanOrEqual(5)
    expect(body.nextCursor).toBeNull()
    expect(body.hasMore).toBe(false)
    expect(Object.keys(body).sort()).toEqual(['hasMore', 'items', 'nextCursor'])
  })

  it('GET /api/customer/products?limit=2 returns a page with nextCursor', async () => {
    const { status, body } = await getJson(
      baseUrl,
      '/api/customer/products?limit=2',
      'customer-token',
    )
    expect(status).toBe(200)
    expect(body.items).toHaveLength(2)
    expect(typeof body.nextCursor).toBe('string')
    expect(body.nextCursor).toBeTruthy()
    expect(body.hasMore).toBe(true)
  })

  it('GET /api/customer/products with cursor walks pages without overlap', async () => {
    const page1 = await getJson(baseUrl, '/api/customer/products?limit=2', 'customer-token')
    expect(page1.status).toBe(200)
    expect(page1.body.nextCursor).toBeTruthy()

    const page2 = await getJson(
      baseUrl,
      `/api/customer/products?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor!)}`,
      'customer-token',
    )
    expect(page2.status).toBe(200)
    expect(page2.body.items.length).toBeGreaterThan(0)

    const ids1 = new Set(page1.body.items.map((p) => p.id))
    for (const p of page2.body.items) {
      expect(ids1.has(p.id)).toBe(false)
    }

    // Exhaust remaining pages
    let cursor = page2.body.nextCursor
    const seen = new Set([...ids1, ...page2.body.items.map((p) => p.id)])
    while (cursor) {
      const next = await getJson(
        baseUrl,
        `/api/customer/products?limit=2&cursor=${encodeURIComponent(cursor)}`,
        'customer-token',
      )
      expect(next.status).toBe(200)
      for (const p of next.body.items) {
        expect(seen.has(p.id)).toBe(false)
        seen.add(p.id)
      }
      cursor = next.body.nextCursor
    }
    expect(seen.size).toBeGreaterThanOrEqual(5)
  })

  it('GET /api/merchant/products always returns {items,nextCursor}', async () => {
    const full = await getJson(baseUrl, '/api/merchant/products?activeOnly=false', 'merchant-token')
    expect(full.status).toBe(200)
    expect(Array.isArray(full.body.items)).toBe(true)
    expect(full.body.items.length).toBeGreaterThanOrEqual(5)
    expect(full.body.nextCursor).toBeNull()
    expect(full.body.hasMore).toBe(false)

    const page = await getJson(
      baseUrl,
      '/api/merchant/products?activeOnly=false&limit=2',
      'merchant-token',
    )
    expect(page.status).toBe(200)
    expect(page.body.items).toHaveLength(2)
    expect(page.body.nextCursor).toBeTruthy()
    expect(page.body.hasMore).toBe(true)

    const page2 = await getJson(
      baseUrl,
      `/api/merchant/products?activeOnly=false&limit=2&cursor=${encodeURIComponent(page.body.nextCursor!)}`,
      'merchant-token',
    )
    expect(page2.status).toBe(200)
    const overlap = page.body.items.some((p) => page2.body.items.some((q) => q.id === p.id))
    expect(overlap).toBe(false)
  })
})
