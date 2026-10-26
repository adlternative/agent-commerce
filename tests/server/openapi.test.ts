import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildOpenApi } from '../../src/server/openapi.js'

describe('openapi', () => {
  it('is OpenAPI 3.1 and writes docs/openapi.json', () => {
    const doc = buildOpenApi()
    expect(doc.openapi).toBe('3.1.0')
    expect(doc.paths['/api/customer/orders']).toBeTruthy()
    expect(doc.paths['/api/merchant/products']).toBeTruthy()
    expect(doc.paths['/api/agent/products']).toBeTruthy()

    const out = join(process.cwd(), 'docs', 'openapi.json')
    mkdirSync(join(process.cwd(), 'docs'), { recursive: true })
    writeFileSync(out, JSON.stringify(doc, null, 2))
    const roundtrip = JSON.parse(readFileSync(out, 'utf8')) as { openapi: string }
    expect(roundtrip.openapi).toBe('3.1.0')
  })
})
