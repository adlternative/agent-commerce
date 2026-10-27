import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildOpenApi, routePathToOpenApi } from '../../src/server/openapi.js'
import { listLiveRoutes } from '../../src/server/create-server.js'

type OpenApiDoc = {
  paths: Record<string, Record<string, unknown>>
  components: {
    securitySchemes: Record<string, unknown>
    schemas: Record<string, unknown>
  }
}

function countOps(paths: Record<string, Record<string, unknown>>): number {
  let n = 0
  for (const item of Object.values(paths)) {
    for (const key of Object.keys(item)) {
      if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(key)) n += 1
    }
  }
  return n
}

function isEmptyObjectSchema(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object') return true
  const s = schema as Record<string, unknown>
  if (s.$ref) return false
  if (s.type !== 'object') return false
  const props = s.properties
  if (props && typeof props === 'object' && Object.keys(props as object).length > 0) return false
  if (Array.isArray(s.oneOf) || Array.isArray(s.anyOf) || Array.isArray(s.allOf)) return false
  return true
}

describe('openapi drift check', () => {
  it('docs/openapi.json matches buildOpenApi()', () => {
    const generated = buildOpenApi()
    const onDisk = JSON.parse(
      readFileSync(join(process.cwd(), 'docs', 'openapi.json'), 'utf8'),
    ) as unknown
    expect(onDisk).toEqual(generated)
  })

  it('reverse coverage: every live registry method+path appears in OpenAPI paths', () => {
    // Live registry = createAppServer wiring (Router builtins + registerRoutes), not a routes.ts scan.
    const registry = listLiveRoutes()
    expect(registry.length).toBeGreaterThanOrEqual(48)

    const doc = buildOpenApi() as OpenApiDoc
    const missing: string[] = []
    for (const { method, path } of registry) {
      const oaPath = routePathToOpenApi(path)
      const op = doc.paths[oaPath]?.[method.toLowerCase()]
      if (!op) missing.push(`${method} ${path} → ${oaPath}`)
    }
    expect(missing, `undeclared live routes:\n${missing.join('\n')}`).toEqual([])
    expect(countOps(doc.paths)).toBeGreaterThanOrEqual(registry.length)
  })

  it('write ops that accept a body have non-empty requestBody schemas', () => {
    const doc = buildOpenApi() as OpenApiDoc
    const bodyBearing: Array<{ path: string; method: string; requiredKeys?: string[] }> = [
      { path: '/api/merchant/products', method: 'post', requiredKeys: ['sku', 'name', 'priceCents'] },
      { path: '/api/merchant/products/{id}', method: 'put', requiredKeys: ['sku', 'name', 'priceCents'] },
      { path: '/api/merchant/products/{id}/stock', method: 'post', requiredKeys: ['delta'] },
      { path: '/api/merchant/promotions', method: 'post' },
      { path: '/api/customer/carts/{id}/items', method: 'post', requiredKeys: ['productId', 'quantity'] },
      { path: '/api/customer/carts/{id}/items/{productId}', method: 'patch', requiredKeys: ['quantity'] },
      { path: '/api/customer/carts/{id}/promotion', method: 'post', requiredKeys: ['code'] },
      { path: '/api/customer/orders', method: 'post', requiredKeys: ['cartId'] },
      { path: '/api/customer/orders/{id}/returns', method: 'post', requiredKeys: ['reason'] },
      { path: '/api/webhooks/payment', method: 'post', requiredKeys: ['eventId', 'type', 'orderId'] },
      { path: '/api/agent/products', method: 'post', requiredKeys: ['sku', 'name', 'priceCents'] },
      { path: '/api/agent/orders', method: 'post', requiredKeys: ['cartId'] },
    ]

    for (const { path, method, requiredKeys } of bodyBearing) {
      const op = doc.paths[path]?.[method] as
        | { requestBody?: { content?: { 'application/json'?: { schema?: unknown } } } }
        | undefined
      expect(op, `missing ${method.toUpperCase()} ${path}`).toBeTruthy()
      const schema = op?.requestBody?.content?.['application/json']?.schema
      expect(schema, `missing requestBody schema for ${method.toUpperCase()} ${path}`).toBeTruthy()
      expect(
        isEmptyObjectSchema(schema),
        `${method.toUpperCase()} ${path} requestBody must not be empty object`,
      ).toBe(false)
      if (requiredKeys) {
        const s = schema as { required?: string[]; properties?: Record<string, unknown> }
        for (const key of requiredKeys) {
          expect(
            s.required?.includes(key) || s.properties?.[key],
            `${method.toUpperCase()} ${path} missing field ${key}`,
          ).toBeTruthy()
        }
      }
    }

    // Bodyless writes still declare an explicit (possibly empty) requestBody.
    for (const { path, method } of [
      { path: '/api/customer/orders/{id}/pay', method: 'post' },
      { path: '/api/merchant/orders/{id}/ship', method: 'post' },
      { path: '/api/merchant/orders/{id}/receive', method: 'post' },
      { path: '/api/merchant/reservations/release-expired', method: 'post' },
    ]) {
      const op = doc.paths[path]?.[method] as { requestBody?: unknown } | undefined
      expect(op?.requestBody, `expected requestBody on ${method.toUpperCase()} ${path}`).toBeTruthy()
    }
  })

  it('components.schemas covers Product/Order/Cart/Promotion/Return/Error', () => {
    const doc = buildOpenApi() as OpenApiDoc
    for (const name of ['Product', 'Order', 'Cart', 'Promotion', 'Return', 'Error']) {
      expect(doc.components.schemas[name], `missing components.schemas.${name}`).toBeTruthy()
    }
  })

  it('committed OpenAPI still documents /metrics and core commerce ops', () => {
    const onDisk = JSON.parse(
      readFileSync(join(process.cwd(), 'docs', 'openapi.json'), 'utf8'),
    ) as OpenApiDoc

    expect(onDisk.paths['/metrics']?.get).toBeTruthy()
    expect(onDisk.paths['/health']?.get).toBeTruthy()
    expect(onDisk.paths['/healthz']?.get).toBeTruthy()
    expect(onDisk.paths['/readyz']?.get).toBeTruthy()
    expect(onDisk.paths['/api/customer/orders']?.post).toBeTruthy()
    expect(onDisk.paths['/api/merchant/products']?.post).toBeTruthy()
    expect(onDisk.paths['/api/merchant/products/{id}/stock']?.post).toBeTruthy()
    expect(onDisk.paths['/api/merchant/reservations/release-expired']?.post).toBeTruthy()
    expect(onDisk.paths['/api/agent/products']?.get).toBeTruthy()
    expect(onDisk.paths['/api/agent/audit']?.get).toBeTruthy()
    expect(onDisk.paths['/api/merchant/audit']?.get).toBeTruthy()
    expect(onDisk.components.securitySchemes.ApiKeyAuth).toBeTruthy()
  })
})
