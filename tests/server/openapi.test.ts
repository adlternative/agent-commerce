import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildOpenApi } from '../../src/server/openapi.js'

/** Paths that must remain documented — OpenAPI regression guard. */
const REQUIRED_PATH_OPS: Array<{ path: string; method: string }> = [
  { path: '/health', method: 'get' },
  { path: '/metrics', method: 'get' },
  { path: '/api/customer/products', method: 'get' },
  { path: '/api/customer/orders', method: 'post' },
  { path: '/api/customer/orders/{id}/pay', method: 'post' },
  { path: '/api/merchant/products', method: 'post' },
  { path: '/api/merchant/orders', method: 'get' },
  { path: '/api/agent/products', method: 'get' },
  { path: '/api/agent/orders', method: 'post' },
  { path: '/api/agent/audit', method: 'get' },
  { path: '/api/merchant/audit', method: 'get' },
]

describe('openapi', () => {
  it('is OpenAPI 3.1 and writes docs/openapi.json', () => {
    const doc = buildOpenApi()
    expect(doc.openapi).toBe('3.1.0')
    expect(doc.info.title).toBe('Agent Commerce API')
    expect(doc.components.securitySchemes.BearerAuth).toBeTruthy()
    expect(doc.components.securitySchemes.ApiKeyAuth).toBeTruthy()

    for (const { path, method } of REQUIRED_PATH_OPS) {
      const item = doc.paths[path as keyof typeof doc.paths] as Record<string, unknown> | undefined
      expect(item, `missing path ${path}`).toBeTruthy()
      expect(item?.[method], `missing ${method.toUpperCase()} ${path}`).toBeTruthy()
    }

    const out = join(process.cwd(), 'docs', 'openapi.json')
    mkdirSync(join(process.cwd(), 'docs'), { recursive: true })
    writeFileSync(out, JSON.stringify(doc, null, 2))
    const roundtrip = JSON.parse(readFileSync(out, 'utf8')) as { openapi: string }
    expect(roundtrip.openapi).toBe('3.1.0')
  })
})
