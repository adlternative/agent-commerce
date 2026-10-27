import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildOpenApi, routePathToOpenApi } from '../../src/server/openapi.js'
import { listLiveRoutes } from '../../src/server/create-server.js'

describe('openapi', () => {
  it('is OpenAPI 3.1, covers the live route registry, and writes docs/openapi.json', () => {
    const doc = buildOpenApi()
    expect(doc.openapi).toBe('3.1.0')
    expect(doc.info.title).toBe('Agent Commerce API')
    expect(doc.components.securitySchemes.BearerAuth).toBeTruthy()
    expect(doc.components.securitySchemes.ApiKeyAuth).toBeTruthy()
    expect(doc.components.schemas.Product).toBeTruthy()
    expect(doc.components.schemas.Order).toBeTruthy()
    expect(doc.components.schemas.Cart).toBeTruthy()
    expect(doc.components.schemas.Promotion).toBeTruthy()
    expect(doc.components.schemas.Return).toBeTruthy()
    expect(doc.components.schemas.Error).toBeTruthy()

    const registry = listLiveRoutes()
    expect(registry.length).toBeGreaterThanOrEqual(48)
    for (const { method, path } of registry) {
      const oaPath = routePathToOpenApi(path)
      const item = doc.paths[oaPath as keyof typeof doc.paths] as Record<string, unknown> | undefined
      expect(item, `missing path ${oaPath} (from ${method} ${path})`).toBeTruthy()
      expect(
        item?.[method.toLowerCase()],
        `missing ${method} ${oaPath}`,
      ).toBeTruthy()
    }

    const merchantProductPost = (
      doc.paths['/api/merchant/products'] as { post?: { requestBody?: { content?: Record<string, { schema?: { properties?: Record<string, unknown>; required?: string[] } }> } } }
    ).post
    const schema = merchantProductPost?.requestBody?.content?.['application/json']?.schema
    expect(schema?.properties?.sku).toBeTruthy()
    expect(schema?.properties?.name).toBeTruthy()
    expect(schema?.properties?.priceCents).toBeTruthy()
    expect(schema?.required).toEqual(expect.arrayContaining(['sku', 'name', 'priceCents']))

    const out = join(process.cwd(), 'docs', 'openapi.json')
    mkdirSync(join(process.cwd(), 'docs'), { recursive: true })
    writeFileSync(out, JSON.stringify(doc, null, 2))
    const roundtrip = JSON.parse(readFileSync(out, 'utf8')) as { openapi: string }
    expect(roundtrip.openapi).toBe('3.1.0')
  })
})
