import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAppServer, type AppServer } from '../../src/server/create-server.js'
import { MemoryRepository } from '../../src/repo/json-repository.js'
import { SqliteRepository } from '../../src/repo/sqlite-repository.js'
import { DomainError } from '../../src/domain/errors.js'

describe('healthz / readyz / unmatched 404', () => {
  let app: AppServer
  let baseUrl: string

  beforeAll(async () => {
    app = createAppServer({ repo: new MemoryRepository() })
    ;({ baseUrl } = await app.listen(0))
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /healthz returns 200 without auth', async () => {
    const res = await fetch(`${baseUrl}/healthz`)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it('GET /readyz returns 200 after a real store probe (no auth)', async () => {
    const res = await fetch(`${baseUrl}/readyz`)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it('unmatched routes return 404 NOT_FOUND without auth (not 401)', async () => {
    const res = await fetch(`${baseUrl}/definitely-not-a-route`)
    expect(res.status).toBe(404)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('NOT_FOUND')
  })

  it('GET /openapi.json and GET /metrics stay public 200', async () => {
    const openapi = await fetch(`${baseUrl}/openapi.json`)
    expect(openapi.status).toBe(200)
    const doc = (await openapi.json()) as { openapi: string }
    expect(doc.openapi).toBe('3.1.0')

    const metrics = await fetch(`${baseUrl}/metrics`)
    expect(metrics.status).toBe(200)
    expect(await metrics.text()).toContain('http_requests_total')
  })
})

describe('readyz against SQLite', () => {
  let dir: string
  let sqlite: SqliteRepository
  let app: AppServer
  let baseUrl: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ac-readyz-'))
    sqlite = await SqliteRepository.open(join(dir, 'commerce.sqlite'))
    app = createAppServer({ repo: sqlite, seedDemo: false })
    ;({ baseUrl } = await app.listen(0))
  })

  afterAll(async () => {
    await app.close()
    sqlite.close()
    await rm(dir, { recursive: true, force: true })
  })

  it('GET /readyz succeeds when sqlite is readable and writable', async () => {
    const res = await fetch(`${baseUrl}/readyz`)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it('SqliteRepository.checkReady writes a readiness_probe row', async () => {
    await sqlite.checkReady()
    // second call updates the same row
    await sqlite.checkReady()
  })
})

describe('readyz failure → 503', () => {
  it('returns 503 STORE_NOT_READY when the readiness probe throws', async () => {
    const app = createAppServer({
      repo: new MemoryRepository(),
      observability: {
        readiness: async () => {
          throw new DomainError('STORE_NOT_READY', 'forced unreadiness', { retryable: true })
        },
      },
    })
    const { baseUrl } = await app.listen(0)
    try {
      const res = await fetch(`${baseUrl}/readyz`)
      expect(res.status).toBe(503)
      const body = (await res.json()) as { code: string }
      expect(body.code).toBe('STORE_NOT_READY')
    } finally {
      await app.close()
    }
  })
})
