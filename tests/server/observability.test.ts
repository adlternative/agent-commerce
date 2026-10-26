import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAppServer, type AppServer } from '../../src/server/create-server.js'
import { MemoryRepository } from '../../src/repo/json-repository.js'
import { createLogger } from '../../src/server/logger.js'

describe('HTTP observability', () => {
  let app: AppServer
  let baseUrl: string
  const lines: string[] = []

  beforeAll(async () => {
    app = createAppServer({
      repo: new MemoryRepository(),
      observability: {
        logger: createLogger({ service: 'test' }, { sink: (l) => lines.push(l) }),
      },
    })
    ;({ baseUrl } = await app.listen(0))
  })

  afterAll(async () => {
    await app.close()
  })

  it('propagates X-Trace-Id through response, logs, and audit', async () => {
    lines.length = 0
    app.audit.clear()
    app.metrics.reset()

    const res = await fetch(`${baseUrl}/health`, {
      headers: { 'x-trace-id': 'obs_trace_fixed_01' },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('x-trace-id')).toBe('obs_trace_fixed_01')

    const parsed = lines.map((l) => JSON.parse(l) as { msg: string; traceId?: string })
    expect(parsed.some((e) => e.msg === 'request.start' && e.traceId === 'obs_trace_fixed_01')).toBe(
      true,
    )
    expect(parsed.some((e) => e.msg === 'request.end' && e.traceId === 'obs_trace_fixed_01')).toBe(
      true,
    )

    // Hit an authenticated route so audit records the same traceId.
    const products = await fetch(`${baseUrl}/api/customer/products`, {
      headers: {
        authorization: 'Bearer customer-token',
        'x-trace-id': 'obs_trace_fixed_01',
      },
    })
    expect(products.status).toBe(200)
    const audit = app.audit.list(10)
    expect(audit.some((e) => e.traceId === 'obs_trace_fixed_01' && e.path === '/api/customer/products')).toBe(
      true,
    )
  })

  it('exposes Prometheus metrics at GET /metrics without auth', async () => {
    app.metrics.reset()
    await fetch(`${baseUrl}/health`)
    const res = await fetch(`${baseUrl}/metrics`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type') ?? '').toMatch(/text\/plain/)
    expect(res.headers.get('x-trace-id')).toBeTruthy()
    const body = await res.text()
    expect(body).toContain('http_requests_total')
    expect(body).toContain('path="/health"')
  })

  it('mints a trace id when none is provided', async () => {
    const res = await fetch(`${baseUrl}/health`)
    const id = res.headers.get('x-trace-id')
    expect(id).toBeTruthy()
    expect(id!.length).toBeGreaterThanOrEqual(16)
  })
})
