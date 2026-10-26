import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildOpenApi } from '../../src/server/openapi.js'

describe('openapi drift check', () => {
  it('docs/openapi.json matches buildOpenApi()', () => {
    const generated = buildOpenApi()
    const onDisk = JSON.parse(
      readFileSync(join(process.cwd(), 'docs', 'openapi.json'), 'utf8'),
    ) as unknown
    expect(onDisk).toEqual(generated)
  })

  it('committed OpenAPI still documents /metrics and core commerce ops', () => {
    const onDisk = JSON.parse(
      readFileSync(join(process.cwd(), 'docs', 'openapi.json'), 'utf8'),
    ) as {
      paths: Record<string, Record<string, unknown>>
      components: { securitySchemes: Record<string, unknown> }
    }

    expect(onDisk.paths['/metrics']?.get).toBeTruthy()
    expect(onDisk.paths['/health']?.get).toBeTruthy()
    expect(onDisk.paths['/healthz']?.get).toBeTruthy()
    expect(onDisk.paths['/readyz']?.get).toBeTruthy()
    expect(onDisk.paths['/api/customer/orders']?.post).toBeTruthy()
    expect(onDisk.paths['/api/merchant/products']?.post).toBeTruthy()
    expect(onDisk.paths['/api/agent/products']?.get).toBeTruthy()
    expect(onDisk.paths['/api/agent/audit']?.get).toBeTruthy()
    expect(onDisk.paths['/api/merchant/audit']?.get).toBeTruthy()
    expect(onDisk.components.securitySchemes.ApiKeyAuth).toBeTruthy()
  })
})
