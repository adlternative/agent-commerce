import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JsonFileRepository } from '../../src/repo/json-repository.js'
import { CommerceService } from '../../src/services/commerce.js'

describe('JsonFileRepository', () => {
  it('persists products across instances', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-commerce-'))
    const path = join(dir, 'db.json')
    const repo = new JsonFileRepository(path)
    const svc = new CommerceService(repo)

    const product = await svc.upsertProduct(
      { sku: 'X', name: 'X', priceCents: 100 },
      'json-upsert-1',
    )
    await svc.adjustStock(product.id, 2, 'json-stock-1')

    const raw = JSON.parse(await readFile(path, 'utf8')) as {
      products: { id: string }[]
      stock: { onHand: number }[]
    }
    expect(raw.products[0]?.id).toBe(product.id)
    expect(raw.stock[0]?.onHand).toBe(2)

    const svc2 = new CommerceService(new JsonFileRepository(path))
    expect((await svc2.getProduct(product.id)).sku).toBe('X')
  })
})
