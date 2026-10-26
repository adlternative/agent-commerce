import { describe, expect, it } from 'vitest'
import { createLogger, resolveTraceId } from '../../src/server/logger.js'

describe('resolveTraceId', () => {
  it('prefers a valid x-trace-id header', () => {
    expect(resolveTraceId('abc_trace_01')).toBe('abc_trace_01')
  })

  it('extracts trace-id from W3C traceparent', () => {
    const tp = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
    expect(resolveTraceId(undefined, tp)).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
  })

  it('mints a new id when headers are missing', () => {
    const id = resolveTraceId(undefined)
    expect(id).toMatch(/^[0-9a-f]{32}$/)
  })

  it('rejects malformed x-trace-id and falls back', () => {
    const id = resolveTraceId('bad id with spaces!')
    expect(id).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('createLogger', () => {
  it('emits structured JSON with inherited child fields', () => {
    const lines: string[] = []
    const root = createLogger({ service: 'test' }, { sink: (l) => lines.push(l) })
    const child = root.child({ traceId: 't1' })
    child.info('hello', { path: '/x' })
    expect(lines).toHaveLength(1)
    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>
    expect(parsed.level).toBe('info')
    expect(parsed.msg).toBe('hello')
    expect(parsed.service).toBe('test')
    expect(parsed.traceId).toBe('t1')
    expect(parsed.path).toBe('/x')
    expect(typeof parsed.ts).toBe('string')
  })

  it('respects minLevel', () => {
    const lines: string[] = []
    const log = createLogger({}, { sink: (l) => lines.push(l), minLevel: 'warn' })
    log.info('skip')
    log.warn('keep')
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]!).msg).toBe('keep')
  })
})
