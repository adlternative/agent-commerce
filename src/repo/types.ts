import type { Product } from '../domain/product.js'
import type { StockLevel, Reservation } from '../domain/inventory.js'
import type { Cart } from '../domain/cart.js'
import type { Promotion } from '../domain/promotion.js'
import type { Order } from '../domain/order.js'
import type { Payment } from '../domain/payment.js'
import type { ReturnRequest } from '../domain/return.js'
import type { IdempotencyRecord } from '../domain/idempotency.js'

/** Snapshot shape shared by JSON and SQLite repositories. */
export type CommerceDb = {
  products: Product[]
  stock: StockLevel[]
  reservations: Reservation[]
  carts: Cart[]
  promotions: Promotion[]
  orders: Order[]
  payments: Payment[]
  returns: ReturnRequest[]
  idempotency: IdempotencyRecord[]
}

export function emptyDb(): CommerceDb {
  return {
    products: [],
    stock: [],
    reservations: [],
    carts: [],
    promotions: [],
    orders: [],
    payments: [],
    returns: [],
    idempotency: [],
  }
}

/**
 * Repository port — JSON file or SQLite adapters.
 * Domain / service callers stay backend-agnostic.
 */
export interface CommerceRepository {
  read(): Promise<CommerceDb>
  /** Exclusive transaction: load → mutate → persist atomically. */
  transaction<T>(fn: (db: CommerceDb) => T | Promise<T>): Promise<T>
  /**
   * Read + write probe for GET /readyz.
   * Must verify the underlying store is actually usable (not a no-op stub).
   * Throws DomainError (`STORE_NOT_READY` / store read-write failures) on failure.
   */
  checkReady(): Promise<void>
}
