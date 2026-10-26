import { describe, expect, it } from 'vitest'
import { HttpMetrics } from '../../src/server/metrics.js'

describe('HttpMetrics', () => {
  it('aggregates counters and renders Prometheus text', () => {
    const m = new HttpMetrics()
    m.record('GET', '/health', 200, 3)
    m.record('GET', '/health', 200, 5)
    m.record('POST', '/api/customer/orders', 400, 12)

    const snap = m.snapshot()
    expect(snap.requestsTotal).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'GET', path: '/health', status: '200', value: 2 }),
        expect.objectContaining({
          method: 'POST',
          path: '/api/customer/orders',
          status: '400',
          value: 1,
        }),
      ]),
    )

    const text = m.renderPrometheus()
    expect(text).toContain('# TYPE http_requests_total counter')
    expect(text).toContain('http_requests_total{method="GET",path="/health",status="200"} 2')
    expect(text).toContain(
      'http_request_duration_ms_sum{method="GET",path="/health"} 8',
    )
    expect(text).toContain(
      'http_request_duration_ms_count{method="GET",path="/health"} 2',
    )
  })

  it('escapes label values', () => {
    const m = new HttpMetrics()
    m.record('GET', '/q"x', 200, 1)
    expect(m.renderPrometheus()).toContain('path="/q\\"x"')
  })
})
