import { describe, expect, it, afterEach } from 'vitest'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DomainError } from '../../src/domain/errors.js'
import { CommerceService } from '../../src/services/commerce.js'
import { SqliteRepository } from '../../src/repo/sqlite-repository.js'
import { migrateEmptySqlite, migrateJsonToSqlite } from '../../src/repo/migrate-json.js'
import { createRepository } from '../../src/repo/create-repository.js'
import { emptyDb } from '../../src/repo/types.js'

const openRepos: SqliteRepository[] = []

afterEach(() => {
  while (openRepos.length) {
    openRepos.pop()?.close()
  }
})

async function tmpSqlite(): Promise<{ dir: string; path: string; repo: SqliteRepository }> {
  const dir = await mkdtemp(join(tmpdir(), 'ac-sqlite-'))
  const path = join(dir, 'commerce.sqlite')
  const repo = await SqliteRepository.open(path)
  openRepos.push(repo)
  return { dir, path, repo }
}

describe('SqliteRepository', () => {
  it('applies schema migrations on empty database', async () => {
    const { repo } = await tmpSqlite()
    expect(repo.migrationVersions()).toEqual([1])
    expect(repo.isEmpty()).toBe(true)
    const db = await repo.read()
    expect(db).toEqual(emptyDb())
  })

  it('persists products across instances', async () => {
    const { path, repo } = await tmpSqlite()
    const svc = new CommerceService(repo)
    const product = await svc.upsertProduct(
      { sku: 'SQ', name: 'SQLite Widget', priceCents: 250 },
      'sqlite-upsert-1',
    )
    await svc.adjustStock(product.id, 4, 'sqlite-stock-1')
    repo.close()
    openRepos.pop()

    const repo2 = await SqliteRepository.open(path)
    openRepos.push(repo2)
    const svc2 = new CommerceService(repo2)
    expect((await svc2.getProduct(product.id)).sku).toBe('SQ')
    expect((await svc2.checkInventory(product.id)).onHand).toBe(4)
  })

  it('getStockByProductIds uses one WHERE IN for 50 ids (no N+1)', async () => {
    const { repo } = await tmpSqlite()
    const svc = new CommerceService(repo)
    const ids: string[] = []
    for (let i = 0; i < 50; i++) {
      const p = await svc.upsertProduct(
        { sku: `IN-${i}`, name: `Batch ${i}`, priceCents: 100 + i },
        `batch-upsert-${i}`,
      )
      await svc.adjustStock(p.id, i % 5, `batch-stock-${i}`)
      ids.push(p.id)
    }

    let prepareCount = 0
    const db = (repo as unknown as { db: { prepare: (sql: string) => unknown } }).db
    const origPrepare = db.prepare.bind(db)
    db.prepare = (sql: string) => {
      if (sql.includes('WHERE product_id IN')) prepareCount += 1
      return origPrepare(sql)
    }

    const rows = await repo.getStockByProductIds(ids)
    expect(prepareCount).toBe(1)
    expect(rows).toHaveLength(50)
    expect(rows.every((r) => ids.includes(r.productId))).toBe(true)
  })

  it('enforces unique idempotency (scope, key)', async () => {
    const { repo } = await tmpSqlite()
    await repo.transaction((db) => {
      db.idempotency.push({
        key: 'k1',
        scope: 'place_order',
        resourceId: 'o1',
        createdAt: new Date().toISOString(),
      })
    })
    await expect(
      repo.transaction((db) => {
        db.idempotency.push({
          key: 'k1',
          scope: 'place_order',
          resourceId: 'o2',
          createdAt: new Date().toISOString(),
        })
      }),
    ).rejects.toThrow()
  })
})

describe('migrate empty + from JSON', () => {
  it('migrateEmptySqlite creates schema', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ac-mig-empty-'))
    const path = join(dir, 'empty.sqlite')
    const repo = await migrateEmptySqlite(path)
    openRepos.push(repo)
    expect(repo.migrationVersions()).toContain(1)
    expect(repo.isEmpty()).toBe(true)
  })

  it('imports existing commerce.json into empty SQLite', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ac-mig-json-'))
    const jsonPath = join(dir, 'commerce.json')
    const sqlitePath = join(dir, 'commerce.sqlite')
    const now = new Date().toISOString()
    await writeFile(
      jsonPath,
      JSON.stringify({
        ...emptyDb(),
        products: [
          {
            id: 'p-json',
            sku: 'FROM-JSON',
            name: 'Imported',
            description: '',
            priceCents: 99,
            tags: ['legacy'],
            agentNotes: 'from json',
            active: true,
            createdAt: now,
            updatedAt: now,
          },
        ],
        stock: [{ productId: 'p-json', onHand: 7, reserved: 1 }],
      }),
    )

    const repo = await SqliteRepository.open(sqlitePath)
    openRepos.push(repo)
    const result = await migrateJsonToSqlite(jsonPath, repo)
    expect(result.migrated).toBe(true)
    expect(result.productCount).toBe(1)

    const db = await repo.read()
    expect(db.products[0]?.sku).toBe('FROM-JSON')
    expect(db.stock[0]).toEqual({ productId: 'p-json', onHand: 7, reserved: 1 })

    // Second call is a no-op
    const again = await migrateJsonToSqlite(jsonPath, repo)
    expect(again.migrated).toBe(false)
    expect(again.reason).toBe('sqlite-already-populated')
  })

  it('createRepository auto-migrates sibling JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ac-create-repo-'))
    await mkdir(dir, { recursive: true })
    const jsonPath = join(dir, 'commerce.json')
    const sqlitePath = join(dir, 'commerce.sqlite')
    const now = new Date().toISOString()
    await writeFile(
      jsonPath,
      JSON.stringify({
        ...emptyDb(),
        products: [
          {
            id: 'p1',
            sku: 'AUTO',
            name: 'Auto',
            description: '',
            priceCents: 10,
            tags: [],
            agentNotes: '',
            active: true,
            createdAt: now,
            updatedAt: now,
          },
        ],
      }),
    )

    const opened = await createRepository({
      backend: 'sqlite',
      dataPath: sqlitePath,
      migrateFromJsonPath: jsonPath,
    })
    if (opened.sqlite) openRepos.push(opened.sqlite)
    expect(opened.migration?.migrated).toBe(true)
    expect((await opened.repo.read()).products[0]?.sku).toBe('AUTO')
  })
})

describe('SqliteRepository concurrency', () => {
  it('serializes parallel writes without losing updates', async () => {
    const { repo } = await tmpSqlite()
    const svc = new CommerceService(repo)
    const product = await svc.upsertProduct(
      { sku: 'PAR', name: 'Parallel', priceCents: 100 },
      'par-upsert',
    )
    await svc.adjustStock(product.id, 0, 'par-stock-0')

    const N = 20
    await Promise.all(
      Array.from({ length: N }, (_, i) =>
        svc.adjustStock(product.id, 1, `par-inc-${i}`),
      ),
    )

    const stock = await svc.checkInventory(product.id)
    expect(stock.onHand).toBe(N)
  })

  it('prevents inventory oversell under parallel placeOrder', async () => {
    const { repo } = await tmpSqlite()
    const svc = new CommerceService(repo)
    const product = await svc.upsertProduct(
      { sku: 'OV', name: 'Oversell', priceCents: 500 },
      'ov-upsert',
    )
    await svc.adjustStock(product.id, 5, 'ov-stock')

    const carts = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        svc.createCart(`c-${i}`, `ov-cart-${i}`).then(async (cart) => {
          await svc.addItem(cart.id, product.id, 1, `ov-add-${i}`)
          return cart
        }),
      ),
    )

    const attempts = await Promise.all(
      carts.map((cart, i) =>
        svc.placeOrder(cart.id, `ov-place-${i}`).then(
          (order) => ({ ok: true as const, orderId: order.id }),
          (err: unknown) => {
            expect(err).toBeInstanceOf(DomainError)
            expect((err as DomainError).code).toBe('INSUFFICIENT_STOCK')
            return { ok: false as const }
          },
        ),
      ),
    )

    expect(attempts.filter((a) => a.ok)).toHaveLength(5)
    expect(attempts.filter((a) => !a.ok)).toHaveLength(5)
    const stock = await svc.checkInventory(product.id)
    expect(stock.onHand).toBe(5)
    expect(stock.reserved).toBe(5)
  })
})
