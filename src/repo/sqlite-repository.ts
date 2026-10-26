import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite'
import { DomainError } from '../domain/errors.js'

// Vitest/Vite rewrites bare `node:sqlite` imports; load via createRequire instead.
const nodeRequire = createRequire(import.meta.url)
const { DatabaseSync } = nodeRequire('node:sqlite') as typeof import('node:sqlite')
import type { Product } from '../domain/product.js'
import {
  DEFAULT_RESERVATION_TTL_MS,
  type Reservation,
  type StockLevel,
} from '../domain/inventory.js'
import type { Cart } from '../domain/cart.js'
import type { Promotion } from '../domain/promotion.js'
import type { Order } from '../domain/order.js'
import type { Payment } from '../domain/payment.js'
import type { ReturnRequest } from '../domain/return.js'
import type { IdempotencyRecord } from '../domain/idempotency.js'
import { emptyDb, type CommerceDb, type CommerceRepository } from './types.js'
import { MIGRATIONS } from './schema.js'

function parseJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T
  } catch (err) {
    throw new DomainError('STORE_READ_FAILED', `invalid JSON in ${label}`, {
      cause: err,
      retryable: false,
    })
  }
}

/**
 * SQLite-backed repository (node:sqlite DatabaseSync).
 *
 * Same CommerceRepository port as JsonFileRepository: exclusive `transaction()`
 * serializes in-process writers; SQLite BEGIN IMMEDIATE guards the file.
 */
export class SqliteRepository implements CommerceRepository {
  private chain: Promise<unknown> = Promise.resolve()
  private readonly db: DatabaseSyncType
  private readonly path: string

  constructor(path: string) {
    this.path = path
    // Sync open after ensuring parent dir exists is done in openStatic / migrate.
    // Constructor assumes directory already exists (factory creates it).
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec('PRAGMA busy_timeout = 5000;')
    this.db.exec('PRAGMA foreign_keys = ON;')
    this.applyMigrations()
  }

  /** Create parent directory then open. Prefer this over `new` for file paths. */
  static async open(path: string): Promise<SqliteRepository> {
    if (path !== ':memory:') {
      await mkdir(dirname(path), { recursive: true })
    }
    return new SqliteRepository(path)
  }

  close(): void {
    this.db.close()
  }

  /** Applied migration versions (for tests / migrate tooling). */
  migrationVersions(): number[] {
    const rows = this.db
      .prepare('SELECT version FROM schema_migrations ORDER BY version')
      .all() as Array<{ version: number }>
    return rows.map((r) => r.version)
  }

  /** True when no commerce rows exist (fresh DB after migrations). */
  isEmpty(): boolean {
    const count = (table: string): number => {
      const row = this.db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }
      return row.c
    }
    return (
      count('products') === 0 &&
      count('stock') === 0 &&
      count('orders') === 0 &&
      count('carts') === 0 &&
      count('idempotency') === 0
    )
  }

  /** Replace entire DB contents (used by JSON → SQLite migration). */
  async replaceAll(data: CommerceDb): Promise<void> {
    await this.runExclusive(() => {
      this.db.exec('BEGIN IMMEDIATE')
      try {
        this.writeDb(data)
        this.db.exec('COMMIT')
      } catch (err) {
        try {
          this.db.exec('ROLLBACK')
        } catch {
          /* ignore */
        }
        throw err
      }
    })
  }

  async read(): Promise<CommerceDb> {
    try {
      return this.loadDb()
    } catch (err) {
      if (err instanceof DomainError) throw err
      throw new DomainError('STORE_READ_FAILED', 'failed to read SQLite store', {
        cause: err,
        retryable: true,
      })
    }
  }

  async transaction<T>(fn: (db: CommerceDb) => T | Promise<T>): Promise<T> {
    return this.runExclusive(async () => {
      this.db.exec('BEGIN IMMEDIATE')
      try {
        const draft = this.loadDb()
        const result = await fn(draft)
        this.writeDb(draft)
        this.db.exec('COMMIT')
        return result
      } catch (err) {
        try {
          this.db.exec('ROLLBACK')
        } catch {
          /* ignore */
        }
        throw err
      }
    })
  }

  /**
   * Prove SQLite is readable and writable (for GET /readyz).
   * Uses a dedicated readiness_probe row under BEGIN IMMEDIATE — not a no-op.
   */
  async checkReady(): Promise<void> {
    try {
      await this.runExclusive(() => {
        const ping = this.db.prepare('SELECT 1 AS ok').get() as { ok: number } | undefined
        if (!ping || ping.ok !== 1) {
          throw new Error('sqlite SELECT 1 failed')
        }
        this.db.exec('BEGIN IMMEDIATE')
        try {
          this.db.exec(`
            CREATE TABLE IF NOT EXISTS readiness_probe (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              checked_at TEXT NOT NULL
            );
          `)
          const checkedAt = new Date().toISOString()
          this.db
            .prepare(
              `INSERT INTO readiness_probe (id, checked_at) VALUES (1, ?)
               ON CONFLICT(id) DO UPDATE SET checked_at = excluded.checked_at`,
            )
            .run(checkedAt)
          const row = this.db.prepare('SELECT checked_at FROM readiness_probe WHERE id = 1').get() as
            | { checked_at: string }
            | undefined
          if (!row?.checked_at) {
            throw new Error('sqlite readiness probe row missing after write')
          }
          this.db.exec('COMMIT')
        } catch (err) {
          try {
            this.db.exec('ROLLBACK')
          } catch {
            /* ignore */
          }
          throw err
        }
      })
    } catch (err) {
      if (err instanceof DomainError) {
        throw new DomainError('STORE_NOT_READY', err.message, {
          cause: err,
          retryable: true,
          hint: err.hint,
        })
      }
      throw new DomainError('STORE_NOT_READY', 'sqlite store not readable/writable', {
        cause: err,
        retryable: true,
      })
    }
  }

  private runExclusive<T>(fn: () => T | Promise<T>): Promise<T> {
    const run = this.chain.then(() => fn())
    this.chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  private applyMigrations(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `)
    const applied = new Set(this.migrationVersions())
    for (const m of MIGRATIONS) {
      if (applied.has(m.version)) continue
      this.db.exec('BEGIN IMMEDIATE')
      try {
        this.db.exec(m.sql)
        this.db
          .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
          .run(m.version, new Date().toISOString())
        this.db.exec('COMMIT')
      } catch (err) {
        try {
          this.db.exec('ROLLBACK')
        } catch {
          /* ignore */
        }
        throw new DomainError('STORE_MIGRATE_FAILED', `migration v${m.version} failed`, {
          cause: err,
          retryable: false,
        })
      }
    }
  }

  private loadDb(): CommerceDb {
    const db = emptyDb()

    const productRows = this.db.prepare('SELECT * FROM products').all() as Array<Record<string, unknown>>
    db.products = productRows.map(
      (r): Product => ({
        id: String(r.id),
        sku: String(r.sku),
        name: String(r.name),
        description: String(r.description ?? ''),
        priceCents: Number(r.price_cents),
        tags: parseJson<string[]>(String(r.tags_json ?? '[]'), 'products.tags'),
        agentNotes: String(r.agent_notes ?? ''),
        active: Boolean(r.active),
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
      }),
    )

    const stockRows = this.db.prepare('SELECT * FROM stock').all() as Array<Record<string, unknown>>
    db.stock = stockRows.map(
      (r): StockLevel => ({
        productId: String(r.product_id),
        onHand: Number(r.on_hand),
        reserved: Number(r.reserved),
      }),
    )

    const reservationRows = this.db
      .prepare('SELECT * FROM reservations')
      .all() as Array<Record<string, unknown>>
    db.reservations = reservationRows.map((r): Reservation => {
      const createdAt = String(r.created_at)
      const expiresAt =
        r.expires_at != null
          ? String(r.expires_at)
          : new Date(new Date(createdAt).getTime() + DEFAULT_RESERVATION_TTL_MS).toISOString()
      return {
        id: String(r.id),
        productId: String(r.product_id),
        quantity: Number(r.quantity),
        status: r.status as Reservation['status'],
        createdAt,
        expiresAt,
      }
    })

    const cartRows = this.db.prepare('SELECT * FROM carts').all() as Array<Record<string, unknown>>
    db.carts = cartRows.map((r): Cart => {
      const cart: Cart = {
        id: String(r.id),
        customerId: String(r.customer_id),
        items: parseJson(String(r.items_json ?? '[]'), 'carts.items'),
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
      }
      if (r.promotion_code != null) cart.promotionCode = String(r.promotion_code)
      return cart
    })

    const promoRows = this.db.prepare('SELECT * FROM promotions').all() as Array<Record<string, unknown>>
    db.promotions = promoRows.map((r) =>
      parseJson<Promotion>(String(r.payload_json), 'promotions.payload'),
    )

    const orderRows = this.db.prepare('SELECT * FROM orders').all() as Array<Record<string, unknown>>
    db.orders = orderRows.map((r): Order => {
      const order: Order = {
        id: String(r.id),
        customerId: String(r.customer_id),
        cartId: String(r.cart_id),
        status: r.status as Order['status'],
        lines: parseJson(String(r.lines_json), 'orders.lines'),
        subtotalCents: Number(r.subtotal_cents),
        discountCents: Number(r.discount_cents),
        totalCents: Number(r.total_cents),
        reservationIds: parseJson(String(r.reservation_ids_json ?? '[]'), 'orders.reservationIds'),
        idempotencyKey: String(r.idempotency_key),
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
      }
      if (r.promotion_code != null) order.promotionCode = String(r.promotion_code)
      return order
    })

    const paymentRows = this.db.prepare('SELECT * FROM payments').all() as Array<Record<string, unknown>>
    db.payments = paymentRows.map(
      (r): Payment => ({
        id: String(r.id),
        orderId: String(r.order_id),
        amountCents: Number(r.amount_cents),
        status: r.status as Payment['status'],
        idempotencyKey: String(r.idempotency_key),
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
      }),
    )

    const returnRows = this.db.prepare('SELECT * FROM returns').all() as Array<Record<string, unknown>>
    db.returns = returnRows.map(
      (r): ReturnRequest => ({
        id: String(r.id),
        orderId: String(r.order_id),
        reason: String(r.reason),
        amountCents: Number(r.amount_cents),
        status: r.status as ReturnRequest['status'],
        idempotencyKey: String(r.idempotency_key),
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
      }),
    )

    const idempRows = this.db
      .prepare('SELECT * FROM idempotency')
      .all() as Array<Record<string, unknown>>
    db.idempotency = idempRows.map((r): IdempotencyRecord => {
      const rec: IdempotencyRecord = {
        key: String(r.key),
        scope: String(r.scope),
        resourceId: String(r.resource_id),
        createdAt: String(r.created_at),
      }
      if (r.request_hash != null) rec.requestHash = String(r.request_hash)
      return rec
    })

    return db
  }

  private writeDb(data: CommerceDb): void {
    this.db.exec(`
      DELETE FROM idempotency;
      DELETE FROM returns;
      DELETE FROM payments;
      DELETE FROM orders;
      DELETE FROM promotions;
      DELETE FROM carts;
      DELETE FROM reservations;
      DELETE FROM stock;
      DELETE FROM products;
    `)

    const insertProduct = this.db.prepare(`
      INSERT INTO products (
        id, sku, name, description, price_cents, tags_json, agent_notes, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const p of data.products) {
      insertProduct.run(
        p.id,
        p.sku,
        p.name,
        p.description,
        p.priceCents,
        JSON.stringify(p.tags),
        p.agentNotes,
        p.active ? 1 : 0,
        p.createdAt,
        p.updatedAt,
      )
    }

    const insertStock = this.db.prepare(
      `INSERT INTO stock (product_id, on_hand, reserved) VALUES (?, ?, ?)`,
    )
    for (const s of data.stock) {
      insertStock.run(s.productId, s.onHand, s.reserved)
    }

    const insertReservation = this.db.prepare(`
      INSERT INTO reservations (id, product_id, quantity, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    for (const r of data.reservations) {
      const expiresAt =
        r.expiresAt ??
        new Date(new Date(r.createdAt).getTime() + DEFAULT_RESERVATION_TTL_MS).toISOString()
      insertReservation.run(r.id, r.productId, r.quantity, r.status, r.createdAt, expiresAt)
    }

    const insertCart = this.db.prepare(`
      INSERT INTO carts (id, customer_id, items_json, promotion_code, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    for (const c of data.carts) {
      insertCart.run(
        c.id,
        c.customerId,
        JSON.stringify(c.items),
        c.promotionCode ?? null,
        c.createdAt,
        c.updatedAt,
      )
    }

    const insertPromo = this.db.prepare(
      `INSERT INTO promotions (code, payload_json) VALUES (?, ?)`,
    )
    for (const p of data.promotions) {
      insertPromo.run(p.code, JSON.stringify(p))
    }

    const insertOrder = this.db.prepare(`
      INSERT INTO orders (
        id, customer_id, cart_id, status, lines_json,
        subtotal_cents, discount_cents, total_cents, promotion_code,
        reservation_ids_json, idempotency_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const o of data.orders) {
      insertOrder.run(
        o.id,
        o.customerId,
        o.cartId,
        o.status,
        JSON.stringify(o.lines),
        o.subtotalCents,
        o.discountCents,
        o.totalCents,
        o.promotionCode ?? null,
        JSON.stringify(o.reservationIds),
        o.idempotencyKey,
        o.createdAt,
        o.updatedAt,
      )
    }

    const insertPayment = this.db.prepare(`
      INSERT INTO payments (
        id, order_id, amount_cents, status, idempotency_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    for (const p of data.payments) {
      insertPayment.run(
        p.id,
        p.orderId,
        p.amountCents,
        p.status,
        p.idempotencyKey,
        p.createdAt,
        p.updatedAt,
      )
    }

    const insertReturn = this.db.prepare(`
      INSERT INTO returns (
        id, order_id, reason, amount_cents, status, idempotency_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const r of data.returns) {
      insertReturn.run(
        r.id,
        r.orderId,
        r.reason,
        r.amountCents,
        r.status,
        r.idempotencyKey,
        r.createdAt,
        r.updatedAt,
      )
    }

    const insertIdemp = this.db.prepare(`
      INSERT INTO idempotency (scope, key, resource_id, request_hash, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    for (const i of data.idempotency) {
      insertIdemp.run(i.scope, i.key, i.resourceId, i.requestHash ?? null, i.createdAt)
    }
  }
}
